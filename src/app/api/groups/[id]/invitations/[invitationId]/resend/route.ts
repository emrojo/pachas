import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { sendGroupInvitationEmail } from '@/lib/email/mailer';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const params = await props.params;
    const groupId = params?.id;
    const invitationId = params?.invitationId;

    if (!groupId || !invitationId) {
      return NextResponse.json({ error: 'Parámetros incompletos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Verify user is member of group
    if (!user.isAdmin) {
      const memberCheck = await pool.query(
        'SELECT 1 FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
        [groupId, user.userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'No perteneces a este grupo' }, { status: 403 });
      }
    }

    // Fetch invitation
    const invRes = await pool.query(
      `SELECT gi.*, g.name as group_name, g.icon_emoji, g.invite_code
       FROM public.group_invitations gi
       JOIN public.groups g ON g.id::text = gi.group_id::text
       WHERE gi.id::text = $1 AND gi.group_id::text = $2`,
      [invitationId, groupId]
    );

    if (invRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }

    const invitation = invRes.rows[0];

    // Fetch inviter profile name
    const inviterProf = await pool.query(
      'SELECT full_name FROM public.profiles WHERE id::text = $1',
      [user.userId]
    );
    const inviterName = inviterProf.rows[0]?.full_name || user.email?.split('@')[0] || 'Un amigo';

    // Determine Base URL
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const inviteUrl = `${baseUrl}/join/${invitation.invite_code}?email=${encodeURIComponent(invitation.email)}`;

    const emailRes = await sendGroupInvitationEmail({
      to: invitation.email,
      groupName: invitation.group_name,
      groupEmoji: invitation.icon_emoji,
      inviterName,
      inviteUrl,
      customMessage: invitation.custom_message || undefined,
    });

    // Refresh expiration date and ensure status is pending
    await pool.query(
      `UPDATE public.group_invitations 
       SET status = 'pending', expires_at = NOW() + INTERVAL '14 days'
       WHERE id::text = $1`,
      [invitationId]
    );

    return NextResponse.json({
      success: true,
      provider: emailRes.provider,
      message: `Invitación reenviada correctamente a ${invitation.email}`,
    });
  } catch (err: any) {
    console.error('Error resending invitation:', err);
    return NextResponse.json(
      { error: err.message || 'Error al reenviar la invitación' },
      { status: 500 }
    );
  }
}
