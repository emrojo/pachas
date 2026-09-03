import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { realtimeHub } from '@/lib/realtime/sse';

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

    const groupRes = await pool.query('SELECT * FROM public.groups WHERE id::text = $1', [groupId]);
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }
    const group = groupRes.rows[0];

    const membersRes = await pool.query(
      `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
              COALESCE(p.id, gm.user_id) as profile_id,
              COALESCE(p.full_name, 'Amigo') as full_name,
              p.avatar_url, p.bizum_phone, p.email,
              COALESCE(p.is_banned, false) as is_banned, p.ban_reason
       FROM public.group_members gm
       LEFT JOIN public.profiles p ON p.id::text = gm.user_id::text
       WHERE gm.group_id::text = $1
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    let members = membersRes.rows.map((m) => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role || 'member',
      joined_at: m.joined_at,
      profile: {
        id: m.profile_id,
        email: m.email || '',
        full_name: m.full_name,
        avatar_url: m.avatar_url || null,
        bizum_phone: m.bizum_phone || null,
        role: m.role,
        is_banned: Boolean(m.is_banned),
        ban_reason: m.ban_reason || null,
      },
    }));

    // If creator is not in group_members, auto-add to table and array
    if (group.created_by && !members.some((m) => String(m.user_id) === String(group.created_by))) {
      try {
        const creatorProfRes = await pool.query(
          'SELECT id, email, full_name, avatar_url, bizum_phone, is_banned, ban_reason FROM public.profiles WHERE id::text = $1',
          [group.created_by]
        );
        const cp = creatorProfRes.rows[0];
        const newMemberId = (await import('crypto')).randomUUID();
        const now = new Date().toISOString();

        await pool.query(
          `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
           VALUES ($1, $2, $3, 'admin', NOW())
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [newMemberId, group.id, group.created_by]
        );

        members.unshift({
          id: newMemberId,
          group_id: group.id,
          user_id: group.created_by,
          role: 'admin',
          joined_at: now,
          profile: {
            id: group.created_by,
            email: cp?.email || '',
            full_name: cp?.full_name || 'Creador',
            avatar_url: cp?.avatar_url || null,
            bizum_phone: cp?.bizum_phone || null,
            role: 'admin',
            is_banned: Boolean(cp?.is_banned),
            ban_reason: cp?.ban_reason || null,
          },
        });
      } catch (err) {
        console.warn('Could not auto-insert creator into group_members:', err);
      }
    }

    group.members = members;

    return NextResponse.json({ success: true, group, members });
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

    const updateRes = await pool.query(
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
       WHERE id = $18
       RETURNING *`,
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

    const updatedGroup = updateRes.rows[0];

    // Broadcast real-time group updates (title, cover, currency, frozen, etc.)
    if (updatedGroup) {
      realtimeHub.broadcast({
        type: 'group_updated',
        groupId,
        userId: user.userId,
        payload: updatedGroup,
      });
    }

    return NextResponse.json({ success: true, id: groupId, group: updatedGroup });
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
    const user = authResult.user!;

    const params = await props.params;
    const groupId = params?.id;
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await pool.query('DELETE FROM public.groups WHERE id = $1', [groupId]);

    // Broadcast real-time group deletion
    realtimeHub.broadcast({
      type: 'group_deleted',
      groupId,
      userId: user.userId,
      payload: { groupId },
    });

    return NextResponse.json({ success: true, id: groupId });
  } catch (err: any) {
    console.error('API delete group error:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar grupo' }, { status: 500 });
  }
}

