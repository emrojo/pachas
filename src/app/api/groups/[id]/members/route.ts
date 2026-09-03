import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { realtimeHub } from '@/lib/realtime/sse';
import { randomUUID } from 'crypto';

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

    if (!groupId) {
      return NextResponse.json({ error: 'ID de grupo requerido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // 1. Verify group exists and get creator
    const groupRes = await pool.query(
      'SELECT id, name, created_by FROM public.groups WHERE id::text = $1',
      [groupId]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }
    const group = groupRes.rows[0];

    // 2. Fetch all members with their profile
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

    // If creator is not in group_members, auto-add to table and memory
    if (group.created_by && !members.some((m) => String(m.user_id) === String(group.created_by))) {
      try {
        const creatorProfRes = await pool.query(
          'SELECT id, email, full_name, avatar_url, bizum_phone, is_banned, ban_reason FROM public.profiles WHERE id::text = $1',
          [group.created_by]
        );
        const cp = creatorProfRes.rows[0];
        const newMemberId = randomUUID();
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

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (err: any) {
    console.error('Error fetching group members:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener miembros del grupo' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { userId, email, fullName, role = 'member' } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Verify group exists
    const groupRes = await pool.query('SELECT * FROM public.groups WHERE id::text = $1', [groupId]);
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }
    const group = groupRes.rows[0];

    let targetUserId = userId;
    let targetEmail = email?.trim()?.toLowerCase();
    let targetName = fullName?.trim();

    // If targetUserId provided, look up profile
    if (targetUserId) {
      const profRes = await pool.query('SELECT * FROM public.profiles WHERE id::text = $1', [targetUserId]);
      if (profRes.rows.length > 0) {
        targetName = profRes.rows[0].full_name || targetName;
        targetEmail = profRes.rows[0].email || targetEmail;
      }
    } else if (targetEmail) {
      // Lookup profile by email or create new profile
      const profRes = await pool.query('SELECT * FROM public.profiles WHERE LOWER(email) = LOWER($1)', [targetEmail]);
      if (profRes.rows.length > 0) {
        targetUserId = profRes.rows[0].id;
        targetName = profRes.rows[0].full_name;
      } else {
        targetUserId = randomUUID();
        if (!targetName) targetName = targetEmail.split('@')[0];
        await pool.query(
          `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
           VALUES ($1, $2, $3, 'member', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [targetUserId, targetEmail, targetName]
        );
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Usuario o correo no especificado' }, { status: 400 });
    }

    // Ensure target profile exists to avoid FK error
    await pool.query(
      `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'member', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [targetUserId, targetEmail || `${targetUserId}@pachas.local`, targetName || 'Amigo']
    );

    const newMemberId = randomUUID();
    await pool.query(
      `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [newMemberId, group.id, targetUserId, role]
    );

    // Fetch full added member profile
    const finalProfRes = await pool.query(
      'SELECT id, email, full_name, avatar_url, bizum_phone, is_banned, ban_reason FROM public.profiles WHERE id::text = $1',
      [targetUserId]
    );
    const prof = finalProfRes.rows[0] || {
      id: targetUserId,
      email: targetEmail || '',
      full_name: targetName || 'Amigo',
      avatar_url: null,
      bizum_phone: null,
      is_banned: false,
      ban_reason: null,
    };

    const newMember = {
      id: newMemberId,
      group_id: group.id,
      user_id: targetUserId,
      role,
      joined_at: new Date().toISOString(),
      profile: prof,
    };

    // Broadcast real-time member_joined
    realtimeHub.broadcast({
      type: 'member_joined',
      groupId: group.id,
      userId: user.userId,
      payload: {
        member: newMember,
        group,
      },
    });

    return NextResponse.json({ success: true, member: newMember });
  } catch (err: any) {
    console.error('Error adding group member:', err);
    return NextResponse.json(
      { error: err.message || 'Error al agregar miembro al grupo' },
      { status: 500 }
    );
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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!groupId || !targetUserId) {
      return NextResponse.json({ error: 'groupId y userId son obligatorios' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Check permissions: either admin of group, or self-removal
    const isSelf = String(user.userId) === String(targetUserId);
    if (!isSelf && !user.isAdmin) {
      const userRoleRes = await pool.query(
        'SELECT role FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
        [groupId, user.userId]
      );
      if (userRoleRes.rows.length === 0 || userRoleRes.rows[0].role !== 'admin') {
        return NextResponse.json({ error: 'No tienes permisos para eliminar miembros de este grupo' }, { status: 403 });
      }
    }

    await pool.query(
      'DELETE FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
      [groupId, targetUserId]
    );

    realtimeHub.broadcast({
      type: 'member_removed',
      groupId,
      userId: user.userId,
      payload: {
        userId: targetUserId,
        groupId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error removing group member:', err);
    return NextResponse.json(
      { error: err.message || 'Error al eliminar miembro' },
      { status: 500 }
    );
  }
}
