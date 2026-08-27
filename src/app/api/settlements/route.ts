import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
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
    const {
      id = randomUUID(),
      groupId,
      fromUserId,
      toUserId,
      amount,
      currency = 'EUR',
      paymentMethod = 'BIZUM',
      notes = null,
      settledAt = new Date().toISOString(),
    } = body;

    if (!groupId || !fromUserId || !toUserId || !amount) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await pool.query(
      `INSERT INTO public.settlements (
         id, group_id, from_user_id, to_user_id, amount, currency,
         payment_method, notes, settled_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        groupId,
        fromUserId,
        toUserId,
        amount,
        currency,
        paymentMethod,
        notes,
        settledAt,
      ]
    );

    return NextResponse.json({
      success: true,
      settlement: {
        id,
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        currency,
        payment_method: paymentMethod,
        notes,
        settled_at: settledAt,
      },
    });
  } catch (err: any) {
    console.error('API create settlement error:', err);
    return NextResponse.json({ error: err.message || 'Error al guardar liquidación' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    let query = `
      SELECT s.*,
             jsonb_build_object(
               'id', fp.id,
               'full_name', fp.full_name,
               'avatar_url', fp.avatar_url,
               'bizum_phone', fp.bizum_phone,
               'email', fp.email
             ) as from_profile,
             jsonb_build_object(
               'id', tp.id,
               'full_name', tp.full_name,
               'avatar_url', tp.avatar_url,
               'bizum_phone', tp.bizum_phone,
               'email', tp.email
             ) as to_profile
      FROM public.settlements s
      JOIN public.profiles fp ON fp.id = s.from_user_id
      JOIN public.profiles tp ON tp.id = s.to_user_id
    `;

    const params: any[] = [];
    if (groupId) {
      query += ` WHERE s.group_id = $1`;
      params.push(groupId);
    }
    query += ` ORDER BY s.settled_at DESC`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, settlements: res.rows });
  } catch (err: any) {
    console.error('API get settlements error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener liquidaciones' }, { status: 500 });
  }
}
