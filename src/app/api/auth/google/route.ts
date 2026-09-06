import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { signJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { randomUUID } from 'crypto';

interface GoogleTokenInfo {
  email: string;
  email_verified: string;
  name: string;
  picture: string;
  sub: string;
  aud: string;
}

/**
 * POST /api/auth/google
 *
 * Authenticates a user via Google OAuth credential (id_token).
 * - If the user already exists (by email), logs them in.
 * - If the user is new, creates auth.users + public.profiles automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential) {
      return NextResponse.json(
        { error: 'Token de Google no proporcionado' },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Login con Google no configurado en el servidor' },
        { status: 503 }
      );
    }

    // 1. Verify the Google id_token using Google's tokeninfo endpoint
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!verifyRes.ok) {
      return NextResponse.json(
        { error: 'Token de Google inválido o expirado' },
        { status: 401 }
      );
    }

    const tokenInfo: GoogleTokenInfo = await verifyRes.json();

    // 2. Validate audience matches our client ID
    if (tokenInfo.aud !== clientId) {
      return NextResponse.json(
        { error: 'Token de Google no corresponde a esta aplicación' },
        { status: 401 }
      );
    }

    // 3. Validate email is verified
    if (tokenInfo.email_verified !== 'true') {
      return NextResponse.json(
        { error: 'La cuenta de Google no tiene el email verificado' },
        { status: 401 }
      );
    }

    const googleEmail = tokenInfo.email.trim().toLowerCase();
    const googleName = tokenInfo.name || googleEmail.split('@')[0];
    const googleAvatar = tokenInfo.picture || null;

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // 4. Auto-heal: ensure auth_provider column exists
    try {
      await pool.query(
        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';"
      ).catch(() => {});
    } catch {}

    // 5. Check if user already exists by email
    let userRes;
    try {
      userRes = await pool.query(
        `SELECT u.id, u.email, u.raw_user_meta_data,
                p.full_name, p.avatar_url, p.bizum_phone, p.preferred_language, p.role, p.is_banned, p.ban_reason
         FROM auth.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         WHERE LOWER(u.email) = LOWER($1)`,
        [googleEmail]
      );
    } catch {
      // Fallback query without newer profile columns
      userRes = await pool.query(
        `SELECT u.id, u.email, u.raw_user_meta_data,
                p.full_name, p.avatar_url, p.bizum_phone, p.role
         FROM auth.users u
         LEFT JOIN public.profiles p ON p.id = u.id
         WHERE LOWER(u.email) = LOWER($1)`,
        [googleEmail]
      );
    }

    let userId: string;
    let userProfile: Record<string, any>;

    if (userRes.rows.length > 0) {
      // ── EXISTING USER: Log them in ──
      const row = userRes.rows[0];

      // Check ban status
      if (row.is_banned) {
        return NextResponse.json(
          {
            error: row.ban_reason
              ? `Cuenta suspendida: ${row.ban_reason}`
              : 'Tu cuenta ha sido suspendida por los administradores.',
            is_banned: true,
            ban_reason: row.ban_reason || null,
          },
          { status: 403 }
        );
      }

      userId = row.id;
      const isAdmin = isServerAdmin(googleEmail, row.id, row.role);
      const role = isAdmin ? 'admin' : (row.role || 'member');
      const fullName = row.full_name || row.raw_user_meta_data?.full_name || googleName;

      userProfile = {
        id: row.id,
        email: row.email,
        full_name: fullName,
        avatar_url: row.avatar_url || row.raw_user_meta_data?.avatar_url || googleAvatar,
        bizum_phone: row.bizum_phone || row.raw_user_meta_data?.bizum_phone || null,
        preferred_language: row.preferred_language || row.raw_user_meta_data?.preferred_language || 'es',
        role,
        created_at: new Date().toISOString(),
      };

      // Update avatar from Google if the user doesn't have one yet
      if (!row.avatar_url && googleAvatar) {
        try {
          await pool.query(
            'UPDATE public.profiles SET avatar_url = $1 WHERE id = $2 AND (avatar_url IS NULL OR avatar_url = \'\')',
            [googleAvatar, userId]
          );
        } catch {}
      }
    } else {
      // ── NEW USER: Auto-register ──
      userId = randomUUID();
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
      const role = googleEmail === adminEmail ? 'admin' : 'member';

      // Insert into auth.users
      try {
        await pool.query(
          `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, auth_provider)
           VALUES ($1, $2, '', $3, 'google')`,
          [
            userId,
            googleEmail,
            JSON.stringify({
              full_name: googleName,
              avatar_url: googleAvatar,
              preferred_language: 'es',
              role,
            }),
          ]
        );
      } catch (insertErr: any) {
        // Fallback if auth_provider column doesn't exist yet
        if (insertErr?.message?.includes('auth_provider')) {
          await pool.query(
            `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
             VALUES ($1, $2, '', $3)`,
            [
              userId,
              googleEmail,
              JSON.stringify({
                full_name: googleName,
                avatar_url: googleAvatar,
                preferred_language: 'es',
                role,
              }),
            ]
          );
        } else {
          throw insertErr;
        }
      }

      // Insert into public.profiles
      await pool.query(
        `INSERT INTO public.profiles (id, email, full_name, avatar_url, preferred_language, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           avatar_url = EXCLUDED.avatar_url,
           preferred_language = EXCLUDED.preferred_language,
           role = EXCLUDED.role`,
        [userId, googleEmail, googleName, googleAvatar, 'es', role]
      );

      userProfile = {
        id: userId,
        email: googleEmail,
        full_name: googleName,
        avatar_url: googleAvatar,
        bizum_phone: null,
        preferred_language: 'es',
        role,
        created_at: new Date().toISOString(),
      };
    }

    // 6. Issue session JWT
    const token = await signJwt({
      sub: userId,
      email: googleEmail,
      role: userProfile.role,
      full_name: userProfile.full_name,
    });

    const response = NextResponse.json({ success: true, user: userProfile });

    response.cookies.set('sb-access-token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('API Google auth error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al autenticar con Google' },
      { status: 500 }
    );
  }
}
