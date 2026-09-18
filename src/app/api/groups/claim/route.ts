import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { realtimeHub } from '@/lib/realtime/sse';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token')?.trim();

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token de reclamo requerido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const res = await pool.query(
      `SELECT gm.id, gm.group_id, gm.provisional_name, gm.is_unclaimed, gm.claimed_by, gm.claimed_at,
              g.name as group_name, g.description as group_description,
              g.icon_emoji, g.cover_image_url, g.base_currency, g.invite_code, g.is_archived,
              p.full_name as claimed_by_name
       FROM public.group_members gm
       JOIN public.groups g ON g.id = gm.group_id
       LEFT JOIN public.profiles p ON p.id = gm.claimed_by
       WHERE gm.claim_token = $1`,
      [token]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        status: 'invalid_or_used',
        error: 'Este enlace de invitación ya ha sido utilizado o no es válido.',
      });
    }

    const row = res.rows[0];

    if (!row.is_unclaimed || row.claimed_by) {
      return NextResponse.json({
        valid: false,
        status: 'already_claimed',
        provisional_name: row.provisional_name,
        claimed_by_name: row.claimed_by_name,
        group: {
          id: row.group_id,
          name: row.group_name,
          invite_code: row.invite_code,
        },
      });
    }

    return NextResponse.json({
      valid: true,
      status: 'available',
      member: {
        id: row.id,
        provisional_name: row.provisional_name || 'Amigo',
      },
      group: {
        id: row.group_id,
        name: row.group_name,
        description: row.group_description,
        icon_emoji: row.icon_emoji,
        cover_image_url: row.cover_image_url,
        base_currency: row.base_currency,
        invite_code: row.invite_code,
        is_archived: row.is_archived,
      },
    });
  } catch (err: any) {
    console.error('Error checking claim token:', err);
    return NextResponse.json({ error: err.message || 'Error al verificar enlace' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const body = await request.json();
    const token = body?.claimToken?.trim();
    const enableNotifications = Boolean(body?.enableNotifications);

    if (!token) {
      return NextResponse.json({ error: 'Token de reclamo requerido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock member row for update to prevent concurrent race condition claiming
      const memberRes = await client.query(
        `SELECT gm.*, g.name as group_name, g.invite_code, g.is_archived
         FROM public.group_members gm
         JOIN public.groups g ON g.id = gm.group_id
         WHERE gm.claim_token = $1
         FOR UPDATE OF gm`,
        [token]
      );

      if (memberRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Este enlace de invitación ya ha sido utilizado o no es válido.' },
          { status: 404 }
        );
      }

      const gm = memberRes.rows[0];

      if (gm.is_archived) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'El grupo ha sido archivado y no admite nuevos miembros.' },
          { status: 400 }
        );
      }

      if (!gm.is_unclaimed || gm.claimed_by) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Este puesto provisional ya ha sido reclamado por otro usuario.' },
          { status: 409 }
        );
      }

      const oldDummyUserId = gm.user_id;
      const groupId = gm.group_id;

      // Ensure joining user has a profile in public.profiles to satisfy FK
      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
        [user.userId, user.email || `${user.userId}@pachas.local`, user.email?.split('@')[0] || 'Amigo', user.role || 'member']
      );

      // Fetch ALL group memberships where oldDummyUserId is currently a provisional member
      const allMembershipsRes = await client.query(
        `SELECT gm_all.id, gm_all.group_id, gm_all.provisional_name, g.name as group_name, g.invite_code, g.is_archived
         FROM public.group_members gm_all
         JOIN public.groups g ON g.id = gm_all.group_id
         WHERE gm_all.user_id::text = $1 AND gm_all.claimed_at IS NULL
         FOR UPDATE OF gm_all`,
        [oldDummyUserId]
      );

      const claimedGroups: Array<{ id: string; name: string; inviteCode: string }> = [];

      for (const targetGm of allMembershipsRes.rows) {
        const targetGroupId = targetGm.group_id;

        // Reassign expenses, payers, participants, settlements in this group
        await client.query(
          `UPDATE public.expense_payers ep
           SET user_id = $1
           FROM public.expenses e
           WHERE ep.expense_id = e.id AND e.group_id::text = $2 AND ep.user_id::text = $3`,
          [user.userId, targetGroupId, oldDummyUserId]
        );
        await client.query(
          `UPDATE public.expense_participants ep
           SET user_id = $1
           FROM public.expenses e
           WHERE ep.expense_id = e.id AND e.group_id::text = $2 AND ep.user_id::text = $3`,
          [user.userId, targetGroupId, oldDummyUserId]
        );
        await client.query(
          `UPDATE public.settlements
           SET from_user_id = $1
           WHERE group_id::text = $2 AND from_user_id::text = $3`,
          [user.userId, targetGroupId, oldDummyUserId]
        );
        await client.query(
          `UPDATE public.settlements
           SET to_user_id = $1
           WHERE group_id::text = $2 AND to_user_id::text = $3`,
          [user.userId, targetGroupId, oldDummyUserId]
        );
        await client.query(
          `UPDATE public.expenses
           SET created_by = $1
           WHERE group_id::text = $2 AND created_by::text = $3`,
          [user.userId, targetGroupId, oldDummyUserId]
        );

        // Check if current user is ALREADY a member of targetGroupId
        const existingUserMemberRes = await client.query(
          `SELECT id FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2`,
          [targetGroupId, user.userId]
        );

        if (existingUserMemberRes.rows.length > 0) {
          // Merge: delete the provisional row and update existing member record
          const existingMemberId = existingUserMemberRes.rows[0].id;
          await client.query(
            `DELETE FROM public.group_members WHERE id::text = $1`,
            [targetGm.id]
          );
          await client.query(
            `UPDATE public.group_members
             SET provisional_name = COALESCE(provisional_name, $1),
                 claimed_by = $2,
                 claimed_at = NOW()
             WHERE id::text = $3`,
            [targetGm.provisional_name, user.userId, existingMemberId]
          );
        } else {
          // Assign provisional member row to real user
          await client.query(
            `UPDATE public.group_members
             SET user_id = $1,
                 is_unclaimed = FALSE,
                 claimed_by = $1,
                 claimed_at = NOW(),
                 claim_token = NULL,
                 notifications_enabled = $2
             WHERE id::text = $3`,
            [user.userId, enableNotifications, targetGm.id]
          );
        }

        claimedGroups.push({
          id: targetGroupId,
          name: targetGm.group_name,
          inviteCode: targetGm.invite_code,
        });
      }

      // Update public.profiles: mark old dummy profile as no longer unclaimed
      await client.query(
        `UPDATE public.profiles
         SET is_unclaimed = FALSE,
             updated_at = NOW()
         WHERE id::text = $1`,
        [oldDummyUserId]
      );

      await client.query('COMMIT');

      // Realtime broadcasts for all claimed groups
      for (const cg of claimedGroups) {
        realtimeHub.broadcast({
          type: 'member_joined',
          groupId: cg.id,
          userId: user.userId,
          payload: {
            userId: user.userId,
            groupId: cg.id,
            claimedProvisional: true,
          },
        });
      }

      return NextResponse.json({
        success: true,
        groupId: gm.group_id,
        groupName: gm.group_name,
        inviteCode: gm.invite_code,
        provisionalName: gm.provisional_name,
        memberId: gm.id,
        claimedGroups,
        claimedCount: claimedGroups.length,
      });
    } catch (txErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error claiming group member:', err);
    return NextResponse.json({ error: err.message || 'Error al reclamar miembro' }, { status: 500 });
  }
}
