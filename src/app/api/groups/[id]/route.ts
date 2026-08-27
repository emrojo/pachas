import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const groupId = params?.id;
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
      WHERE g.id = $1
      GROUP BY g.id
    `;

    const res = await pool.query(query, [groupId]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, group: res.rows[0] });
  } catch (err: any) {
    console.error('API get single group error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener grupo' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {

  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const groupId = params?.id;
    const body = await request.json();
    const {
      name,
      description,
      icon_emoji,
      cover_image_url,
      base_currency,
      is_archived,
      archived_at,
    } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await pool.query(
      `UPDATE public.groups SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon_emoji = COALESCE($3, icon_emoji),
         cover_image_url = COALESCE($4, cover_image_url),
         base_currency = COALESCE($5, base_currency),
         is_archived = COALESCE($6, is_archived),
         archived_at = $7,
         updated_at = NOW()
       WHERE id = $8`,
      [
        name,
        description,
        icon_emoji,
        cover_image_url,
        base_currency,
        is_archived,
        archived_at !== undefined ? archived_at : null,
        groupId,
      ]
    );

    return NextResponse.json({ success: true, id: groupId });
  } catch (err: any) {
    console.error('API update group error:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar grupo' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const groupId = params?.id;
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await pool.query('DELETE FROM public.groups WHERE id = $1', [groupId]);
    return NextResponse.json({ success: true, id: groupId });
  } catch (err: any) {
    console.error('API delete group error:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar grupo' }, { status: 500 });
  }
}
