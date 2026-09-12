import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { sanitizeText } from '@/lib/security/sanitize';

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) return true;
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query(
            `SELECT role, email FROM public.profiles WHERE id::text = $1::text`,
            [payload.sub]
          );
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (isServerAdmin(user.email, payload.sub, user.role)) return true;
          }
        } catch {}
      }
    }
  }

  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (isServerAdmin(parsed.email, parsed.id, parsed.role)) return true;
    } catch {}
  }

  return false;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador.' },
        { status: 403 }
      );
    }

    const params = await props.params;
    const targetUserId = params?.id;
    if (!targetUserId) {
      return NextResponse.json({ error: 'ID de usuario no especificado' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({
        user: {
          id: targetUserId,
          full_name: 'Usuario Demo',
          email: 'demo@pachas.app',
          role: 'member',
          bizum_phone: null,
          avatar_url: null,
          preferred_language: 'es',
          is_banned: false,
          created_at: new Date().toISOString(),
        },
        groups: [],
        allGroups: [],
      });
    }

    // 1. Fetch user profile
    const userRes = await pool.query(
      `SELECT 
        p.id, 
        p.email, 
        COALESCE(
          CASE WHEN p.full_name ILIKE 'unclaimed-%' THEN NULL ELSE NULLIF(TRIM(p.full_name), '') END,
          gm.provisional_name,
          p.full_name,
          'Usuario provisional'
        ) AS full_name,
        p.role, 
        p.bizum_phone, 
        p.avatar_url, 
        p.preferred_language,
        COALESCE(p.is_banned, false) as is_banned, 
        p.banned_at, 
        p.ban_reason, 
        COALESCE(p.is_unclaimed, gm.is_unclaimed, (p.email ILIKE 'unclaimed-%'), false) as is_unclaimed,
        gm.provisional_name,
        p.created_at, 
        p.updated_at
       FROM public.profiles p
       LEFT JOIN LATERAL (
         SELECT provisional_name, is_unclaimed
         FROM public.group_members
         WHERE user_id = p.id AND (is_unclaimed = true OR provisional_name IS NOT NULL)
         ORDER BY joined_at DESC
         LIMIT 1
       ) gm ON true
       WHERE p.id::text = $1::text`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const user = userRes.rows[0];

    // 2. Fetch groups the user belongs to
    const groupsRes = await pool.query(
      `SELECT g.id, g.name, g.description, g.icon_emoji, g.base_currency,
              gm.role, gm.joined_at, COALESCE(gm.is_unclaimed, false) as is_unclaimed
       FROM public.group_members gm
       JOIN public.groups g ON g.id = gm.group_id
       WHERE gm.user_id::text = $1::text
       ORDER BY gm.joined_at DESC`,
      [targetUserId]
    );

    // 3. Fetch all active groups in system for easy adding
    const allGroupsRes = await pool.query(
      `SELECT id, name, icon_emoji, base_currency
       FROM public.groups
       WHERE is_archived = false
       ORDER BY name ASC`
    );

    return NextResponse.json({
      user,
      groups: groupsRes.rows || [],
      allGroups: allGroupsRes.rows || [],
    });
  } catch (err: any) {
    console.error('Error fetching admin user details:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener datos del usuario' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador.' },
        { status: 403 }
      );
    }

    const params = await props.params;
    const targetUserId = params?.id;
    if (!targetUserId) {
      return NextResponse.json({ error: 'ID de usuario no especificado' }, { status: 400 });
    }

    const body = await request.json();
    const fullName = sanitizeText(body.fullName || body.full_name || '', 100);
    const email = (body.email || '').trim().toLowerCase();
    const bizumPhone = body.bizumPhone !== undefined ? sanitizeText(body.bizumPhone, 20) : (body.bizum_phone !== undefined ? sanitizeText(body.bizum_phone, 20) : null);
    const preferredLanguage = (body.preferredLanguage || body.preferred_language || 'es').trim().toLowerCase();
    const role = (body.role || 'member').trim().toLowerCase();
    const avatarUrl = body.avatarUrl !== undefined ? body.avatarUrl : (body.avatar_url !== undefined ? body.avatar_url : null);

    if (!fullName) {
      return NextResponse.json({ error: 'El nombre completo es obligatorio.' }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: 'Rol inválido. Debe ser "admin" o "member".' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({
        success: true,
        user: {
          id: targetUserId,
          full_name: fullName,
          email,
          role,
          bizum_phone: bizumPhone,
          avatar_url: avatarUrl,
          preferred_language: preferredLanguage,
          updated_at: new Date().toISOString(),
        },
      });
    }

    // Check email uniqueness if email is changed
    if (email) {
      const emailCheck = await pool.query(
        `SELECT id FROM public.profiles WHERE LOWER(email) = LOWER($1) AND id::text != $2::text`,
        [email, targetUserId]
      );
      if (emailCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'El correo electrónico ya está registrado por otro usuario.' },
          { status: 400 }
        );
      }
    }

    // Update public.profiles
    const updateRes = await pool.query(
      `UPDATE public.profiles
       SET full_name = $1,
           email = COALESCE(NULLIF($2, ''), email),
           bizum_phone = $3,
           preferred_language = $4,
           role = $5,
           avatar_url = $6,
           updated_at = NOW()
       WHERE id::text = $7::text
       RETURNING id, email, full_name, role, bizum_phone, avatar_url, preferred_language,
                 COALESCE(is_banned, false) as is_banned, banned_at, ban_reason, created_at, updated_at`,
      [fullName, email, bizumPhone || null, preferredLanguage, role, avatarUrl || null, targetUserId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos.' }, { status: 404 });
    }

    const updatedProfile = updateRes.rows[0];

    // If email or name changed, also sync auth.users if available
    try {
      if (email) {
        await pool.query(
          `UPDATE auth.users
           SET email = $1,
               raw_user_meta_data = jsonb_set(
                 COALESCE(raw_user_meta_data, '{}'::jsonb),
                 '{full_name}',
                 to_jsonb($2::text)
               )
           WHERE id::text = $3::text`,
          [email, fullName, targetUserId]
        );
      } else {
        await pool.query(
          `UPDATE auth.users
           SET raw_user_meta_data = jsonb_set(
                 COALESCE(raw_user_meta_data, '{}'::jsonb),
                 '{full_name}',
                 to_jsonb($1::text)
               )
           WHERE id::text = $2::text`,
          [fullName, targetUserId]
        );
      }
    } catch (authSyncErr) {
      console.warn('Could not sync auth.users on admin update (non-fatal):', authSyncErr);
    }

    return NextResponse.json({
      success: true,
      user: updatedProfile,
      message: 'Usuario actualizado correctamente.',
    });
  } catch (err: any) {
    console.error('Error updating user as admin:', err);
    return NextResponse.json(
      { error: err.message || 'Error al actualizar el usuario' },
      { status: 500 }
    );
  }
}
