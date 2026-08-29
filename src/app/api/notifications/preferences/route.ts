import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const payload = await verifyJwt(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');

  if (!groupId) {
    return NextResponse.json({ error: 'Falta groupId' }, { status: 400 });
  }

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
  }

  try {
    const res = await pool.query(
      `SELECT notifications_enabled
       FROM public.group_members
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, payload.sub]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ enabled: false, isMember: false });
    }

    return NextResponse.json({
      enabled: Boolean(res.rows[0].notifications_enabled),
      isMember: true,
    });
  } catch (err: any) {
    console.error('Error fetching notification preferences:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const payload = await verifyJwt(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { groupId, enabled } = body;

    if (!groupId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos (groupId y enabled)' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Ensure column exists
    await pool.query(`
      alter table public.group_members
      add column if not exists notifications_enabled boolean default false not null;
    `);

    const res = await pool.query(
      `UPDATE public.group_members
       SET notifications_enabled = $1
       WHERE group_id = $2 AND user_id = $3
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
  } catch (err: any) {
    console.error('Error updating notification preferences:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
