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
        [id, name, description, icon_emoji, cover_image_url, base_currency, invite_code, payload.sub]
      );

      const memberId = randomUUID();
      const notificationsEnabled = body.notifications_enabled !== undefined ? Boolean(body.notifications_enabled) : true;
      try {
        await client.query(
          `INSERT INTO public.group_members (id, group_id, user_id, role, notifications_enabled, joined_at)
           VALUES ($1, $2, $3, 'admin', $4, NOW())
           ON CONFLICT (group_id, user_id) DO UPDATE SET notifications_enabled = EXCLUDED.notifications_enabled`,
          [memberId, id, payload.sub, notificationsEnabled]
        );
      } catch (insertErr: any) {
        if (insertErr.code === '42703' || String(insertErr.message).includes('notifications_enabled')) {
          await client.query(
            `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
             VALUES ($1, $2, $3, 'admin', NOW())
             ON CONFLICT (group_id, user_id) DO NOTHING`,
            [memberId, id, payload.sub]
          );
        } else {
          throw insertErr;
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        group: groupRes.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
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
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const query = `
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
                     'bizum_phone', p.bizum_phone
                   )
                 )
               ) FILTER (WHERE gm.id IS NOT NULL),
               '[]'::json
             ) as members
      FROM public.groups g
      LEFT JOIN public.group_members gm ON gm.group_id = g.id
      LEFT JOIN public.profiles p ON p.id = gm.user_id
      WHERE g.id IN (
        SELECT gm2.group_id FROM public.group_members gm2 WHERE gm2.user_id = $1
      ) OR g.created_by = $1
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;

    const res = await pool.query(query, [payload.sub]);
    return NextResponse.json({ success: true, groups: res.rows });
  } catch (err: any) {
    console.error('API get groups error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener grupos' }, { status: 500 });
  }
}
