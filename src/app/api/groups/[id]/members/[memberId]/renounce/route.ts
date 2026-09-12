import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { randomUUID } from 'crypto';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const params = await props.params;
    const groupId = params?.id;
    const memberId = params?.memberId;

    if (!groupId || !memberId) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Find the target group member
    const targetMemberRes = await pool.query(
      `SELECT gm.*, g.created_by as group_creator
       FROM public.group_members gm
       JOIN public.groups g ON g.id = gm.group_id
       WHERE (gm.id::text = $1 OR gm.user_id::text = $1) AND gm.group_id::text = $2`,
      [memberId, groupId]
    );

    if (targetMemberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Miembro no encontrado en este grupo' }, { status: 404 });
    }

    const targetMember = targetMemberRes.rows[0];

    // Check permissions: requesting user must be the claimed member, or an admin of the group, or the group creator
    const userMemberCheck = await pool.query(
      `SELECT role FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2`,
      [groupId, user.userId]
    );
    const isGroupAdmin = userMemberCheck.rows.length > 0 && userMemberCheck.rows[0].role === 'admin';
    const isSelf = String(targetMember.user_id) === String(user.userId) || String(targetMember.claimed_by) === String(user.userId);
    const isCreator = String(targetMember.group_creator) === String(user.userId);

    if (!isSelf && !isGroupAdmin && !isCreator && !user.isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permiso para renunciar o liberar a este miembro' },
        { status: 403 }
      );
    }

    // Must be either currently claimed or have a provisional identity
    const currentUserId = targetMember.user_id;
    const provisionalName = targetMember.provisional_name || 'Amigo';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create new provisional user profile
      const newProvUserId = randomUUID();
      const newClaimToken = randomUUID();
      const provEmail = `unclaimed-${newProvUserId.substring(0, 8)}@pachas.local`;

      await client.query(
        `INSERT INTO auth.users (id, email, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [newProvUserId, provEmail]
      ).catch(() => {});

      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role, is_unclaimed, created_at, updated_at)
         VALUES ($1, $2, $3, 'member', TRUE, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [newProvUserId, provEmail, provisionalName]
      );

      // Reassign expense payers for this group from currentUserId to newProvUserId
      await client.query(
        `UPDATE public.expense_payers ep
         SET user_id = $1
         FROM public.expenses e
         WHERE ep.expense_id = e.id AND e.group_id::text = $2 AND ep.user_id::text = $3`,
        [newProvUserId, groupId, currentUserId]
      );

      // Reassign expense participants for this group from currentUserId to newProvUserId
      await client.query(
        `UPDATE public.expense_participants ep
         SET user_id = $1
         FROM public.expenses e
         WHERE ep.expense_id = e.id AND e.group_id::text = $2 AND ep.user_id::text = $3`,
        [newProvUserId, groupId, currentUserId]
      );

      // Reassign settlements for this group
      await client.query(
        `UPDATE public.settlements
         SET from_user_id = $1
         WHERE group_id::text = $2 AND from_user_id::text = $3`,
        [newProvUserId, groupId, currentUserId]
      );
      await client.query(
        `UPDATE public.settlements
         SET to_user_id = $1
         WHERE group_id::text = $2 AND to_user_id::text = $3`,
        [newProvUserId, groupId, currentUserId]
      );

      // Reassign created expenses
      await client.query(
        `UPDATE public.expenses
         SET created_by = $1
         WHERE group_id::text = $2 AND created_by::text = $3`,
        [newProvUserId, groupId, currentUserId]
      );

      // Update group_members row to unclaimed state with new claim token
      await client.query(
        `UPDATE public.group_members
         SET user_id = $1,
             is_unclaimed = TRUE,
             claimed_by = NULL,
             claimed_at = NULL,
             claim_token = $2,
             provisional_name = $3
         WHERE id::text = $4`,
        [newProvUserId, newClaimToken, provisionalName, targetMember.id]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        memberId: targetMember.id,
        is_unclaimed: true,
        provisional_name: provisionalName,
        claim_token: newClaimToken,
      });
    } catch (txErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Error renouncing group member slot:', err);
    return NextResponse.json({ error: err.message || 'Error al renunciar al puesto' }, { status: 500 });
  }
}
