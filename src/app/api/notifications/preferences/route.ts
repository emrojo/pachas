import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    if (!token) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ enabled: false, isMember: true });
    }

    // Auto-create dedicated preferences table if not exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.user_group_notifications (
          id uuid primary key default uuid_generate_v4(),
          user_id uuid not null,
          group_id uuid not null,
          enabled boolean default false not null,
          created_at timestamp with time zone default now(),
          unique(user_id, group_id)
        );
      `);
    } catch {}

    // 1. Check dedicated preferences table first
    try {
      const prefRes = await pool.query(
        `SELECT enabled FROM public.user_group_notifications
         WHERE group_id::text = $1::text AND user_id::text = $2::text`,
        [groupId, payload.sub]
      );
      if (prefRes.rows.length > 0) {
        return NextResponse.json({
          enabled: Boolean(prefRes.rows[0].enabled),
          isMember: true,
        });
      }
    } catch {}

    // 2. Fallback to public.group_members
    try {
      const res = await pool.query(
        `SELECT notifications_enabled
         FROM public.group_members
         WHERE group_id::text = $1::text AND user_id::text = $2::text`,
        [groupId, payload.sub]
      );

      if (res.rows.length > 0) {
        return NextResponse.json({
          enabled: Boolean(res.rows[0].notifications_enabled),
          isMember: true,
        });
      }

      // Check if user is creator of the group
      const groupRes = await pool.query(
        `SELECT created_by FROM public.groups WHERE id::text = $1::text`,
        [groupId]
      );
      if (groupRes.rows.length > 0 && groupRes.rows[0].created_by === payload.sub) {
        return NextResponse.json({ enabled: false, isMember: true });
      }

      return NextResponse.json({ enabled: false, isMember: false });
    } catch (queryErr: any) {
      try {
        const memRes = await pool.query(
          `SELECT id FROM public.group_members WHERE group_id::text = $1::text AND user_id::text = $2::text`,
          [groupId, payload.sub]
        );
        return NextResponse.json({
          enabled: false,
          isMember: memRes.rows.length > 0,
        });
      } catch {
        return NextResponse.json({ enabled: false, isMember: true });
      }
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

    // 1. Ensure dedicated table exists and upsert preference
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.user_group_notifications (
          id uuid primary key default uuid_generate_v4(),
          user_id uuid not null,
          group_id uuid not null,
          enabled boolean default false not null,
          created_at timestamp with time zone default now(),
          unique(user_id, group_id)
        );
      `);

      await pool.query(
        `INSERT INTO public.user_group_notifications (user_id, group_id, enabled)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (user_id, group_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [payload.sub, groupId, enabled]
      );
    } catch (prefTableErr) {
      console.warn('Notice saving into user_group_notifications:', prefTableErr);
    }

    // 2. Also try updating public.group_members if possible
    try {
      await pool.query(
        `UPDATE public.group_members
         SET notifications_enabled = $1
         WHERE group_id::text = $2::text AND user_id::text = $3::text`,
        [enabled, groupId, payload.sub]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      enabled,
      groupId,
    });
  } catch (err: any) {
    console.error('Error updating notification preferences:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar preferencias' }, { status: 500 });
  }
}
