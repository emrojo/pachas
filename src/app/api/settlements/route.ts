import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { notifyGroupMembers } from '@/lib/notifications/webPush';
import { realtimeHub } from '@/lib/realtime/sse';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

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

    // Check if group is frozen
    try {
      const grpRes = await pool.query('SELECT is_frozen FROM public.groups WHERE id = $1', [groupId]);
      if (grpRes.rows.length > 0 && grpRes.rows[0].is_frozen) {
        return NextResponse.json(
          { error: 'El grupo se encuentra temporalmente congelado por moderación. No se pueden registrar pagos.' },
          { status: 403 }
        );
      }
    } catch {}

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

    // Notify subscribed group members in background
    notifyGroupMembers(groupId, user.userId, {
      title: `Deuda liquidada`,
      body: `${user.email?.split('@')[0] || 'Un amigo'} ha registrado un pago de ${amount} ${currency}.`,
      url: `/groups/${groupId}`,
      tag: `settlement-${id}`,
      data: { groupId, settlementId: id },
    }).catch(() => {});

    // Broadcast real-time settlement creation to all connected clients
    realtimeHub.broadcast({
      type: 'settlement_created',
      groupId,
      userId: user.userId,
      payload: {
        id,
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: Number(amount),
        currency,
        payment_method: paymentMethod,
        notes,
        settled_at: settledAt,
        created_at: new Date().toISOString(),
      },
    });

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
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

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
