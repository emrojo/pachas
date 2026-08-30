import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { randomUUID } from 'crypto';
import { notifyGroupMembers } from '@/lib/notifications/webPush';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const body = await request.json();
    const { inviteCode, enableNotifications = false } = body;

    if (!inviteCode) {
      return NextResponse.json({ error: 'Código de invitación requerido.' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // Ensure notifications_enabled column exists
    try {
      await pool.query(`
        alter table public.group_members
        add column if not exists notifications_enabled boolean default false not null;
      `);
    } catch {
      // Ignored if permissions are restricted
    }

    // 1. Find group
    const groupRes = await pool.query(
      `SELECT * FROM public.groups WHERE LOWER(invite_code) = LOWER($1)`,
      [inviteCode.trim()]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado con este código de invitación.' }, { status: 404 });
    }

    const group = groupRes.rows[0];

    if (group.is_archived) {
      return NextResponse.json(
        { error: 'Este grupo ha sido archivado y no admite nuevos miembros.' },
        { status: 400 }
      );
    }

    // 2. Insert member into group_members if not already joined
    const memberId = randomUUID();
    try {
      await pool.query(
        `INSERT INTO public.group_members (id, group_id, user_id, role, notifications_enabled, joined_at)
         VALUES ($1, $2, $3, 'member', $4, NOW())
         ON CONFLICT (group_id, user_id) DO UPDATE SET notifications_enabled = EXCLUDED.notifications_enabled`,
        [memberId, group.id, user.userId, Boolean(enableNotifications)]
      );
    } catch (insertErr: any) {
      if (insertErr.code === '42703' || String(insertErr.message).includes('notifications_enabled')) {
        await pool.query(
          `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
           VALUES ($1, $2, $3, 'member', NOW())
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [memberId, group.id, user.userId]
        );
      } else {
        throw insertErr;
      }
    }

    // 3. Fetch all members with their profile
    const membersRes = await pool.query(
      `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
              p.full_name, p.avatar_url, p.bizum_phone, p.email
       FROM public.group_members gm
       JOIN public.profiles p ON p.id = gm.user_id
       WHERE gm.group_id = $1`,
      [group.id]
    );

    const members = membersRes.rows.map((m) => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      profile: {
        id: m.user_id,
        email: m.email,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        bizum_phone: m.bizum_phone,
        role: m.role,
      },
    }));

    // Dispatch push notification to existing group members
    try {
      const joiner = members.find((m) => m.user_id === user.userId)?.profile;
      const joinerName = joiner?.full_name || user.email?.split('@')[0] || 'Un nuevo amigo';
      notifyGroupMembers(group.id, user.userId, {
        title: `👥 Nuevo miembro en ${group.name}`,
        body: `${joinerName} se ha unido al grupo.`,
        url: `/groups/${group.id}`,
      }).catch((pushErr) => console.warn('Push notification for new member failed:', pushErr));
    } catch (notifErr) {
      console.warn('Could not dispatch join notification:', notifErr);
    }

    return NextResponse.json({
      success: true,
      group,
      members,
    });
  } catch (err: any) {
    console.error('Error joining group:', err);
    return NextResponse.json(
      { error: err.message || 'Error al unirse al grupo' },
      { status: 500 }
    );
  }
}
