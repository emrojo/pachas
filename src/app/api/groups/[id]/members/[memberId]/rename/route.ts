import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { sanitizeText } from '@/lib/security/sanitize';

export async function PATCH(
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

    const body = await request.json();
    const newName = sanitizeText(body?.name || '', 60).trim();

    if (!newName) {
      return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Verify requesting user is member or admin of group
    const memberCheck = await pool.query(
      `SELECT role FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2`,
      [groupId, user.userId]
    );

    if (memberCheck.rows.length === 0 && !user.isAdmin) {
      return NextResponse.json({ error: 'No tienes permiso para modificar este grupo' }, { status: 403 });
    }

    // Find the target group member
    const targetMemberRes = await pool.query(
      `SELECT * FROM public.group_members WHERE (id::text = $1 OR user_id::text = $1) AND group_id::text = $2`,
      [memberId, groupId]
    );

    if (targetMemberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });
    }

    const targetMember = targetMemberRes.rows[0];

    // Only unclaimed members (or members that haven't been claimed yet) can be renamed in this manner
    if (!targetMember.is_unclaimed && targetMember.claimed_by) {
      return NextResponse.json(
        { error: 'No se puede renombrar a un miembro que ya ha sido reclamado por un usuario real' },
        { status: 400 }
      );
    }

    // Update group_members provisional_name
    await pool.query(
      `UPDATE public.group_members
       SET provisional_name = $1
       WHERE id::text = $2`,
      [newName, targetMember.id]
    );

    // Update provisional profile full_name if still pointing to placeholder profile
    await pool.query(
      `UPDATE public.profiles
       SET full_name = $1, updated_at = NOW()
       WHERE id::text = $2 AND is_unclaimed = TRUE`,
      [newName, targetMember.user_id]
    );

    return NextResponse.json({
      success: true,
      memberId: targetMember.id,
      provisional_name: newName,
    });
  } catch (err: any) {
    console.error('Error renaming unclaimed member:', err);
    return NextResponse.json({ error: err.message || 'Error al renombrar miembro' }, { status: 500 });
  }
}
