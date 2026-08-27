import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = await verifyJwt(token);
  if (!payload) {

    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM public.profiles WHERE id = $1', [payload.sub]);
      if (res.rows.length > 0) {
        return NextResponse.json({ user: res.rows[0] });
      }
    }

    return NextResponse.json({
      user: {
        id: payload.sub,
        email: payload.email,
        full_name: payload.full_name || payload.email.split('@')[0],
        role: payload.role || 'member',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ user: null, error: err.message }, { status: 500 });
  }
}
