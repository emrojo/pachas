import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyPassword } from '@/lib/auth/password';
import { signJwt } from '@/lib/auth/jwt';
import { DEMO_USERS } from '@/lib/demoData';
import { isDemoModeAllowed } from '@/lib/authConfig';
import { isServerAdmin } from '@/lib/auth/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, isDemo } = body;

    if (!email) {
      return NextResponse.json({ error: 'Introduce tu correo electrónico' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const demoAllowed = isDemoModeAllowed();

    // 1. If explicit demo selection is allowed
    if (isDemo && demoAllowed) {
      const demoUser = DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (demoUser) {
        const isAdmin = isServerAdmin(demoUser.email, demoUser.id, demoUser.role);
        const role = isAdmin ? 'admin' : demoUser.role;
        const finalUser = { ...demoUser, role };
        const token = await signJwt({
          sub: finalUser.id,
          email: finalUser.email,
          role,
          full_name: finalUser.full_name,
        });

        const response = NextResponse.json({ success: true, user: finalUser });
        response.cookies.set('sb-access-token', token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      }
    }

    if (!password) {
      return NextResponse.json({ error: 'Introduce tu contraseña' }, { status: 400 });
    }

    const pool = getDbPool();

    // 2. Query PostgreSQL database if pool is configured
    if (pool) {
      try {
        const userRes = await pool.query(
          `SELECT u.id, u.email, u.encrypted_password, u.raw_user_meta_data, p.full_name, p.avatar_url, p.bizum_phone, p.role
           FROM auth.users u
           LEFT JOIN public.profiles p ON p.id = u.id
           WHERE LOWER(u.email) = LOWER($1)`,
          [cleanEmail]
        );

        if (userRes.rows.length > 0) {
          const row = userRes.rows[0];
          const isPasswordValid = verifyPassword(password, row.encrypted_password);

          if (isPasswordValid) {
            const isAdmin = isServerAdmin(cleanEmail, row.id, row.role);
            const role = isAdmin ? 'admin' : (row.role || 'member');
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

            const token = await signJwt({
              sub: row.id,
              email: row.email,
              role,
              full_name: fullName,
            });

            const response = NextResponse.json({ success: true, user: userProfile });
            response.cookies.set('sb-access-token', token, {
              httpOnly: true,
              secure: isHttps,
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 7,
            });

            return response;
          }
        }
      } catch (dbErr) {
        console.warn('Database query error in login:', dbErr);
      }
    }

    // 3. Fallback for demo users when demo mode is active
    if (demoAllowed) {
      const demoUser = DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (demoUser) {
        const token = await signJwt({
          sub: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
          full_name: demoUser.full_name,
        });

        const response = NextResponse.json({ success: true, user: demoUser });
        response.cookies.set('sb-access-token', token, {
          httpOnly: true,
          secure: isHttps,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return response;
      }
    }

    if (!pool && !demoAllowed) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Credenciales no válidas' }, { status: 401 });
  } catch (err: any) {
    console.error('API login error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al iniciar sesión' },
      { status: 500 }
    );
  }
}
