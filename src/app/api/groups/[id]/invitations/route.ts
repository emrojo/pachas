import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { randomBytes, randomUUID } from 'crypto';
import { sendGroupInvitationEmail } from '@/lib/email/mailer';

export async function GET(
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

    if (!groupId) {
      return NextResponse.json({ error: 'ID de grupo requerido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Verify user belongs to group or is admin
    if (!user.isAdmin) {
      const memberCheck = await pool.query(
        'SELECT 1 FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
        [groupId, user.userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'No perteneces a este grupo' }, { status: 403 });
      }
    }

    // Ensure group_invitations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.group_invitations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
        invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')) NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')) NOT NULL,
        custom_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '14 days') NOT NULL,
        accepted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // Fetch active invitations
    const invRes = await pool.query(
      `SELECT gi.id, gi.group_id, gi.invited_by, gi.email, gi.role, gi.token, gi.status,
              gi.custom_message, gi.created_at, gi.expires_at, gi.accepted_at,
              p.full_name as inviter_name, p.avatar_url as inviter_avatar
       FROM public.group_invitations gi
       LEFT JOIN public.profiles p ON p.id::text = gi.invited_by::text
       WHERE gi.group_id::text = $1
       ORDER BY gi.created_at DESC`,
      [groupId]
    );

    const invitations = invRes.rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      invited_by: r.invited_by,
      email: r.email,
      role: r.role,
      token: r.token,
      status: r.status,
      custom_message: r.custom_message,
      created_at: r.created_at,
      expires_at: r.expires_at,
      accepted_at: r.accepted_at,
      inviter: r.invited_by ? {
        id: r.invited_by,
        full_name: r.inviter_name || 'Amigo',
        avatar_url: r.inviter_avatar || null,
      } : undefined,
    }));

    return NextResponse.json({ success: true, invitations });
  } catch (err: any) {
    console.error('Error fetching group invitations:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener invitaciones' },
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

    if (!groupId) {
      return NextResponse.json({ error: 'ID de grupo requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { email, emails, customMessage, role = 'member' } = body;

    // Parse list of emails (single or comma/semicolon/newline separated)
    const rawList: string[] = [];
    if (Array.isArray(emails)) {
      rawList.push(...emails);
    } else if (typeof emails === 'string') {
      rawList.push(...emails.split(/[\n,;]+/));
    }
    if (email && typeof email === 'string') {
      rawList.push(...email.split(/[\n,;]+/));
    }

    const emailList = Array.from(
      new Set(
        rawList
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      )
    );

    if (emailList.length === 0) {
      return NextResponse.json(
        { error: 'Debes proporcionar al menos un correo electrónico válido.' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Verify group
    const groupRes = await pool.query(
      'SELECT id, name, icon_emoji, invite_code, is_archived, is_frozen FROM public.groups WHERE id::text = $1',
      [groupId]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }
    const group = groupRes.rows[0];

    if (group.is_archived) {
      return NextResponse.json({ error: 'El grupo está archivado y no admite invitaciones.' }, { status: 400 });
    }
    if (group.is_frozen) {
      return NextResponse.json({ error: 'El grupo está congelado temporalmente.' }, { status: 400 });
    }

    // Verify user is member or admin
    if (!user.isAdmin) {
      const memberCheck = await pool.query(
        'SELECT 1 FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
        [groupId, user.userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'No tienes permisos para invitar en este grupo' }, { status: 403 });
      }
    }

    // Get current inviter profile name
    const inviterProf = await pool.query(
      'SELECT full_name FROM public.profiles WHERE id::text = $1',
      [user.userId]
    );
    const inviterName = inviterProf.rows[0]?.full_name || user.email?.split('@')[0] || 'Un amigo';

    // Get current group members' emails
    const existingMembersRes = await pool.query(
      `SELECT LOWER(p.email) as email 
       FROM public.group_members gm
       JOIN public.profiles p ON p.id::text = gm.user_id::text
       WHERE gm.group_id::text = $1`,
      [groupId]
    );
    const existingEmails = new Set(existingMembersRes.rows.map((r) => r.email));

    // Ensure group_invitations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.group_invitations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
        invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')) NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')) NOT NULL,
        custom_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '14 days') NOT NULL,
        accepted_at TIMESTAMP WITH TIME ZONE
      );
    `);

    // Determine Base URL for email invitation links
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const results = [];
    const skippedAlreadyMembers = [];

    for (const targetEmail of emailList) {
      if (existingEmails.has(targetEmail)) {
        skippedAlreadyMembers.push(targetEmail);
        continue;
      }

      const token = randomBytes(24).toString('hex');
      const invId = randomUUID();

      // Upsert/Insert invitation
      await pool.query(
        `INSERT INTO public.group_invitations (id, group_id, invited_by, email, role, token, status, custom_message, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), NOW() + INTERVAL '14 days')`,
        [invId, group.id, user.userId, targetEmail, role, token, customMessage || null]
      );

      const inviteUrl = `${baseUrl}/join/${group.invite_code}?email=${encodeURIComponent(targetEmail)}`;

      const emailRes = await sendGroupInvitationEmail({
        to: targetEmail,
        groupName: group.name,
        groupEmoji: group.icon_emoji,
        inviterName,
        inviteUrl,
        customMessage: customMessage?.trim() || undefined,
      });

      results.push({
        id: invId,
        email: targetEmail,
        token,
        provider: emailRes.provider,
        success: emailRes.success,
        inviteUrl,
      });
    }

    if (results.length === 0 && skippedAlreadyMembers.length > 0) {
      return NextResponse.json(
        {
          error: `Los siguientes usuarios ya son miembros del grupo: ${skippedAlreadyMembers.join(', ')}`,
          alreadyMembers: skippedAlreadyMembers,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invitedCount: results.length,
      invitations: results,
      skippedCount: skippedAlreadyMembers.length,
      skippedAlreadyMembers,
      message: results.length === 1
        ? `Invitación enviada correctamente a ${results[0].email}`
        : `Se han enviado ${results.length} invitaciones correctamente`,
    });
  } catch (err: any) {
    console.error('Error sending group invitations:', err);
    return NextResponse.json(
      { error: err.message || 'Error al enviar las invitaciones' },
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
    const invitationId = searchParams.get('invitationId');

    if (!groupId || !invitationId) {
      return NextResponse.json({ error: 'groupId e invitationId requeridos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Check permissions
    if (!user.isAdmin) {
      const memberCheck = await pool.query(
        'SELECT role FROM public.group_members WHERE group_id::text = $1 AND user_id::text = $2',
        [groupId, user.userId]
      );
      if (memberCheck.rows.length === 0) {
        return NextResponse.json({ error: 'No perteneces a este grupo' }, { status: 403 });
      }
    }

    await pool.query(
      'UPDATE public.group_invitations SET status = $1 WHERE id::text = $2 AND group_id::text = $3',
      ['cancelled', invitationId, groupId]
    );

    return NextResponse.json({ success: true, message: 'Invitación cancelada' });
  } catch (err: any) {
    console.error('Error cancelling invitation:', err);
    return NextResponse.json(
      { error: err.message || 'Error al cancelar la invitación' },
      { status: 500 }
    );
  }
}
