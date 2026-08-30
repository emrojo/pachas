import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';

async function autoHealGroupFrozenColumns(pool: any) {
  try {
    await pool.query(`
      ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE NOT NULL;
      ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
      ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS frozen_reason TEXT;
      ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS freeze_type TEXT DEFAULT 'full';
    `);
  } catch {}
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const params = await props.params;
    const groupId = params?.id;
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await autoHealGroupFrozenColumns(pool);

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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const params = await props.params;
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
      is_frozen,
      frozen_at,
      frozen_by,
      frozen_reason,
      freeze_type,
    } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await autoHealGroupFrozenColumns(pool);

    const isAdmin = user.isAdmin;

    // Only system superadmins can freeze or unfreeze groups
    const safeIsFrozen = isAdmin && is_frozen !== undefined ? is_frozen : undefined;
    const safeFrozenAt = isAdmin && is_frozen !== undefined ? (is_frozen ? (frozen_at || new Date().toISOString()) : null) : undefined;
    const safeFrozenBy = isAdmin && is_frozen !== undefined ? (is_frozen ? (frozen_by || user.userId) : null) : undefined;
    const safeFrozenReason = isAdmin && is_frozen !== undefined ? (is_frozen ? (frozen_reason || 'Bajo investigación por moderación') : null) : undefined;
    const safeFreezeType = isAdmin && is_frozen !== undefined ? (is_frozen ? (freeze_type || 'full') : null) : undefined;

    await pool.query(
      `UPDATE public.groups SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon_emoji = COALESCE($3, icon_emoji),
         cover_image_url = COALESCE($4, cover_image_url),
         base_currency = COALESCE($5, base_currency),
         is_archived = COALESCE($6, is_archived),
         archived_at = CASE WHEN $7::boolean IS TRUE THEN $8 ELSE archived_at END,
         is_frozen = COALESCE($9, is_frozen),
         frozen_at = CASE WHEN $10::boolean IS TRUE THEN $11 ELSE frozen_at END,
         frozen_by = CASE WHEN $12::boolean IS TRUE THEN $13 ELSE frozen_by END,
         frozen_reason = CASE WHEN $14::boolean IS TRUE THEN $15 ELSE frozen_reason END,
         freeze_type = CASE WHEN $16::boolean IS TRUE THEN $17 ELSE freeze_type END,
         updated_at = NOW()
       WHERE id = $18`,
      [
        name,
        description,
        icon_emoji,
        cover_image_url,
        base_currency,
        is_archived,
        is_archived !== undefined,
        archived_at !== undefined ? archived_at : null,
        safeIsFrozen,
        safeIsFrozen !== undefined,
        safeFrozenAt,
        safeIsFrozen !== undefined,
        safeFrozenBy,
        safeIsFrozen !== undefined,
        safeFrozenReason,
        safeIsFrozen !== undefined,
        safeFreezeType,
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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const params = await props.params;
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

