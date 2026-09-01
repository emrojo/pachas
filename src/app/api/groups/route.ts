import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
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
      name,
      description = '',
      icon_emoji = '🏖️',
      cover_image_url = null,
      base_currency = 'EUR',
      invite_code = Math.random().toString(36).substring(2, 8).toLowerCase(),
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre del grupo es obligatorio' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure creator profile exists in public.profiles to satisfy foreign keys
      try {
        await client.query(
          `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
          [user.userId, user.email || `${user.userId}@pachas.local`, user.email?.split('@')[0] || 'Usuario', user.role || 'member']
        );
      } catch (profErr) {
        console.warn('Profile ensure non-fatal warning in /api/groups:', profErr);
      }

      const groupRes = await client.query(
        `INSERT INTO public.groups (
           id, name, description, icon_emoji, cover_image_url, base_currency,
           invite_code, created_by, is_archived, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           icon_emoji = EXCLUDED.icon_emoji,
           cover_image_url = EXCLUDED.cover_image_url,
           base_currency = EXCLUDED.base_currency,
           updated_at = NOW()
         RETURNING *`,
        [id, name, description, icon_emoji, cover_image_url, base_currency, invite_code, user.userId]
      );

      const memberId = randomUUID();
      const notificationsEnabled = body.notifications_enabled !== undefined ? Boolean(body.notifications_enabled) : true;
      try {
        await client.query(
          `INSERT INTO public.group_members (id, group_id, user_id, role, notifications_enabled, joined_at)
           VALUES ($1, $2, $3, 'admin', $4, NOW())
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [memberId, id, user.userId, notificationsEnabled]
        );
      } catch (memErr) {
        console.warn('Group member auto-join non-fatal warning:', memErr);
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, group: groupRes.rows[0] });
    } catch (dbErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('API create group error:', err);
    return NextResponse.json({ error: err.message || 'Error al crear grupo' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const fetchAll = searchParams.get('all') === 'true' && user.isAdmin;

    let query = `
      SELECT g.*,
             COALESCE(
               json_agg(
                 jsonb_build_object(
                   'id', gm.id,
                   'group_id', gm.group_id,
                   'user_id', gm.user_id,
                   'role', gm.role,
                   'joined_at', gm.joined_at,
                   'profile', jsonb_build_object(
                     'id', p.id,
                     'full_name', p.full_name,
                     'avatar_url', p.avatar_url,
                     'email', p.email,
                     'bizum_phone', p.bizum_phone,
                     'is_banned', COALESCE(p.is_banned, false),
                     'ban_reason', p.ban_reason
                   )
                 )
               ) FILTER (WHERE gm.id IS NOT NULL),
               '[]'::json
             ) as members
      FROM public.groups g
      LEFT JOIN public.group_members gm ON gm.group_id = g.id
      LEFT JOIN public.profiles p ON p.id = gm.user_id
    `;

    const params: any[] = [];
    if (!fetchAll) {
      query += `
        WHERE g.id IN (
          SELECT gm2.group_id FROM public.group_members gm2 WHERE gm2.user_id = $1
        ) OR g.created_by = $1
      `;
      params.push(user.userId);
    }

    query += `
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, groups: res.rows });
  } catch (err: any) {
    console.error('API get groups error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener grupos' }, { status: 500 });
  }
}
