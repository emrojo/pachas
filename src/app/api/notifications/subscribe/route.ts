import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';

export async function POST(request: NextRequest) {
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
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Datos de suscripción incompletos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Ensure table exists
    await pool.query(`
      create table if not exists public.push_subscriptions (
        id uuid primary key default uuid_generate_v4(),
        user_id uuid references public.profiles(id) on delete cascade not null,
        endpoint text not null unique,
        p256dh text not null,
        auth text not null,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `);

    // Upsert subscription
    await pool.query(
      `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         created_at = NOW()`,
      [payload.sub, endpoint, keys.p256dh, keys.auth]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error saving push subscription:', err);
    return NextResponse.json({ error: err.message || 'Error al guardar suscripción' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const payload = await verifyJwt(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    if (endpoint) {
      await pool.query(
        `DELETE FROM public.push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [payload.sub, endpoint]
      );
    } else {
      await pool.query(
        `DELETE FROM public.push_subscriptions WHERE user_id = $1`,
        [payload.sub]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting push subscription:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar suscripción' }, { status: 500 });
  }
}
