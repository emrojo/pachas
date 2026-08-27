import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyPassword } from '@/lib/auth/password';
import { signJwt } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Introduce tu correo y contraseña' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // Query auth.users
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.encrypted_password, u.raw_user_meta_data, p.full_name, p.avatar_url, p.bizum_phone, p.role
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       WHERE u.email = $1`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Credenciales no válidas' }, { status: 401 });
    }

    const row = userRes.rows[0];
    const isPasswordValid = verifyPassword(password, row.encrypted_password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Credenciales no válidas' }, { status: 401 });
    }

    const role = row.role || (cleanEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ? 'admin' : 'member');
    const fullName = row.full_name || row.raw_user_meta_data?.full_name || cleanEmail.split('@')[0];

    const userProfile = {
      id: row.id,
      email: row.email,
      full_name: fullName,
      avatar_url: row.avatar_url || row.raw_user_meta_data?.avatar_url || null,
      bizum_phone: row.bizum_phone || row.raw_user_meta_data?.bizum_phone || null,
      role,
      created_at: new Date().toISOString(),
    };

    // Sign session JWT
    const token = await signJwt({
      sub: row.id,
      email: row.email,
      role,
      full_name: fullName,
    });


    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true, user: userProfile });

    response.cookies.set('sb-access-token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('API login error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al iniciar sesión' },
      { status: 500 }
    );
  }
}
