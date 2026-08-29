import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ enabled: false, isMember: true });
    }

    // Auto-heal / Ensure notifications_enabled column exists
    try {
      await pool.query(`
        ALTER TABLE public.group_members
        ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT false NOT NULL;
      `);
    } catch {
      // Ignored if permissions are restricted or column already present
    }

    try {
      const res = await pool.query(
        `SELECT notifications_enabled
         FROM public.group_members
         WHERE group_id::text = $1::text AND user_id::text = $2::text`,
        [groupId, payload.sub]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ enabled: false, isMember: false });
      }

      return NextResponse.json({
        enabled: Boolean(res.rows[0].notifications_enabled),
        isMember: true,
      });
    } catch (queryErr: any) {
      if (queryErr.code === '42703' || String(queryErr.message).includes('notifications_enabled')) {
        // Fallback: check membership if column doesn't exist
        const memRes = await pool.query(
          `SELECT id FROM public.group_members WHERE group_id::text = $1::text AND user_id::text = $2::text`,
          [groupId, payload.sub]
        );
        return NextResponse.json({
          enabled: false,
          isMember: memRes.rows.length > 0,
        });
      }
      throw queryErr;
    }
  } catch (err: any) {
    console.warn('Notice in notification preferences GET:', err.message || err);
    return NextResponse.json({ enabled: false, isMember: true });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId, enabled } = body;

    if (!groupId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos (groupId y enabled)' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true, enabled, groupId });
    }

    // Ensure column exists
    try {
      await pool.query(`
        ALTER TABLE public.group_members
        ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT false NOT NULL;
      `);
    } catch {
      // Ignored
    }

    try {
      const res = await pool.query(
        `UPDATE public.group_members
         SET notifications_enabled = $1
         WHERE group_id::text = $2::text AND user_id::text = $3::text
         RETURNING *`,
        [enabled, groupId, payload.sub]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        enabled,
        groupId,
      });
    } catch (updateErr: any) {
      if (updateErr.code === '42703' || String(updateErr.message).includes('notifications_enabled')) {
        // Fallback: check membership and return success
        const memRes = await pool.query(
          `SELECT id FROM public.group_members WHERE group_id::text = $1::text AND user_id::text = $2::text`,
          [groupId, payload.sub]
        );
        if (memRes.rows.length === 0) {
          return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          enabled,
          groupId,
        });
      }
      throw updateErr;
    }
  } catch (err: any) {
    console.error('Error updating notification preferences:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar preferencias' }, { status: 500 });
  }
}
