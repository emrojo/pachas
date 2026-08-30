import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { isDemoModeAllowed } from '@/lib/authConfig';
import { DEMO_USERS } from '@/lib/demoData';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;
  let payload = token ? await verifyJwt(token) : null;

  // Fallback to demo cookie when demo mode is active
  if (!payload && isDemoModeAllowed()) {
    const demoCookie = request.cookies.get('pachas_demo_user')?.value;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(demoCookie));
        if (parsed?.id && parsed?.email) {
          const matched = DEMO_USERS.find(
            (d) => d.id === parsed.id || d.email.toLowerCase() === parsed.email.toLowerCase()
          );
          const isAdmin = isServerAdmin(parsed.email, parsed.id, parsed.role);
          const effectiveRole = isAdmin ? 'admin' : (matched?.role || parsed.role || 'member');
          return NextResponse.json(
            {
              user: {
                id: parsed.id,
                email: parsed.email,
                full_name: matched?.full_name || parsed.email.split('@')[0],
                avatar_url: matched?.avatar_url || null,
                bizum_phone: matched?.bizum_phone || null,
                role: effectiveRole,
                is_banned: Boolean(parsed.is_banned),
                ban_reason: parsed.ban_reason || null,
              },
            },
            {
              headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
            }
          );
        }
      } catch {}
    }
  }

  if (!payload) {
    return NextResponse.json(
      { user: null },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
  }

  try {
    const isAdmin = isServerAdmin(payload.email, payload.sub, payload.role);
    const pool = getDbPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM public.profiles WHERE id::text = $1::text', [payload.sub]);
      if (res.rows.length > 0) {
        const user = res.rows[0];
        const effectiveRole = isAdmin ? 'admin' : (user.role || 'member');
        if (isAdmin && user.role !== 'admin') {
          pool.query('UPDATE public.profiles SET role = $1 WHERE id::text = $2::text', ['admin', payload.sub]).catch(() => {});
        }
        return NextResponse.json(
          {
            user: {
              ...user,
              role: effectiveRole,
              is_banned: Boolean(user.is_banned),
              banned_at: user.banned_at || null,
              ban_reason: user.ban_reason || null,
            },
          },
          {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
          }
        );
      }
    }

    const effectiveRole = isAdmin ? 'admin' : (payload.role || 'member');
    return NextResponse.json(
      {
        user: {
          id: payload.sub,
          email: payload.email,
          full_name: payload.full_name || payload.email.split('@')[0],
          role: effectiveRole,
          is_banned: false,
        },
      },
      {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { user: null, error: err.message },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
      }
    );
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
    const { full_name, bizum_phone, avatar_url } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // 1. Upsert public.profiles
    const res = await pool.query(
      `INSERT INTO public.profiles (id, email, full_name, bizum_phone, avatar_url, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
         bizum_phone = EXCLUDED.bizum_phone,
         avatar_url = EXCLUDED.avatar_url,
         updated_at = NOW()
       RETURNING *`,
      [
        payload.sub,
        payload.email || '',
        full_name !== undefined && full_name !== null ? full_name : null,
        bizum_phone !== undefined ? bizum_phone : null,
        avatar_url !== undefined ? avatar_url : null,
      ]
    );

    // 2. Also update auth.users raw_user_meta_data for consistency in background
    pool.query(
      `UPDATE auth.users
       SET raw_user_meta_data = jsonb_set(
         jsonb_set(
           COALESCE(raw_user_meta_data, '{}'::jsonb),
           '{avatar_url}',
           to_jsonb($1::text)
         ),
         '{full_name}',
         to_jsonb($2::text)
       )
       WHERE id = $3`,
      [
        avatar_url || '',
        full_name || payload.full_name || '',
        payload.sub,
      ]
    ).catch(() => {});

    const updatedProfile = res.rows[0] || {
      id: payload.sub,
      email: payload.email,
      full_name,
      bizum_phone,
      avatar_url,
      role: payload.role || 'member',
    };

    return NextResponse.json({
      success: true,
      user: updatedProfile,
    });
  } catch (err: any) {
    console.error('Error updating profile in /api/auth/me:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar perfil' }, { status: 500 });
  }
}
