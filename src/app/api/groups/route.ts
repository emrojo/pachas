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
         RETURNING *`,
        [id, name, description, icon_emoji, cover_image_url, base_currency, invite_code, payload.sub]
      );

      const memberId = randomUUID();
      await client.query(
        `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, 'admin', NOW())
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [memberId, id, payload.sub]
      );

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
      SELECT g.*
      FROM public.groups g
      WHERE g.id IN (
        SELECT gm.group_id FROM public.group_members gm WHERE gm.user_id = $1
      ) OR g.created_by = $1
      ORDER BY g.created_at DESC
    `;

    const res = await pool.query(query, [payload.sub]);
    return NextResponse.json({ success: true, groups: res.rows });
  } catch (err: any) {
    console.error('API get groups error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener grupos' }, { status: 500 });
  }
}
