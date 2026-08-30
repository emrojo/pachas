import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';
import { sanitizeText } from '@/lib/security/sanitize';
import { notifyGroupMembers } from '@/lib/notifications/webPush';

async function autoHealGroupMessagesTable(pool: any) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.group_messages (
        id uuid primary key default uuid_generate_v4(),
        group_id uuid references public.groups(id) on delete cascade not null,
        user_id uuid references public.profiles(id) on delete cascade not null,
        message text not null,
        gif_url text,
        reactions jsonb default '{}'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `);
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS gif_url text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reactions jsonb default '{}'::jsonb;`).catch(() => {});
  } catch {
    // Ignored if table creation is restricted
  }
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const groupId = params?.id;
    if (!groupId) {
      return NextResponse.json({ error: 'ID de grupo no válido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ messages: [] });
    }

    await autoHealGroupMessagesTable(pool);

    try {
      const res = await pool.query(
        `SELECT m.id, m.group_id, m.user_id, m.message, m.gif_url, m.reactions, m.created_at,
                p.full_name as author_name, p.avatar_url as author_avatar, p.email as author_email
         FROM public.group_messages m
         LEFT JOIN public.profiles p ON p.id = m.user_id
         WHERE m.group_id::text = $1::text
         ORDER BY m.created_at ASC`,
        [groupId]
      );

      const messages = res.rows.map((row) => ({
        id: row.id,
        group_id: row.group_id,
        user_id: row.user_id,
        message: row.message || '',
        gif_url: row.gif_url || null,
        reactions: (typeof row.reactions === 'object' && row.reactions !== null) ? row.reactions : {},
        created_at: row.created_at,
        profile: {
          id: row.user_id,
          email: row.author_email || '',
          full_name: row.author_name || 'Amigo',
          avatar_url: row.author_avatar || null,
        },
      }));

      return NextResponse.json({ messages });
    } catch (queryErr: any) {
      if (queryErr.code === '42P01' || String(queryErr.message).includes('group_messages')) {
        return NextResponse.json({ messages: [] });
      }
      throw queryErr;
    }
  } catch (err: any) {
    console.warn('Notice in group messages GET:', err.message || err);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const groupId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const rawMessage = body.message || '';
    const cleanMessage = sanitizeText(rawMessage, 1000);
    const gifUrl = body.gif_url ? String(body.gif_url).trim() : null;

    if (!cleanMessage.trim() && !gifUrl) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    const messageId = body.id && !body.id.startsWith('msg-') ? body.id : randomUUID();
    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json({
        message: {
          id: messageId,
          group_id: groupId,
          user_id: payload.sub,
          message: cleanMessage,
          gif_url: gifUrl,
          reactions: {},
          created_at: new Date().toISOString(),
          profile: {
            id: payload.sub,
            email: payload.email || '',
            full_name: payload.full_name || 'Amigo',
            avatar_url: null,
          },
        },
      });
    }

    await autoHealGroupMessagesTable(pool);

    try {
      await pool.query(
        `INSERT INTO public.group_messages (id, group_id, user_id, message, gif_url, reactions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, gif_url = EXCLUDED.gif_url`,
        [messageId, groupId, payload.sub, cleanMessage, gifUrl, JSON.stringify({})]
      );
    } catch (insertErr: any) {
      if (insertErr.code === '42P01' || String(insertErr.message).includes('group_messages')) {
        console.warn('public.group_messages not found in PostgreSQL, message saved in client cache.');
      } else {
        throw insertErr;
      }
    }

    // Fetch author details
    let authorProfile = {
      id: payload.sub,
      email: payload.email || '',
      full_name: payload.full_name || 'Amigo',
      avatar_url: null as string | null,
    };

    try {
      const authorRes = await pool.query(
        `SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id = $1`,
        [payload.sub]
      );
      if (authorRes.rows.length > 0) {
        authorProfile = authorRes.rows[0];
      }
    } catch {}

    // Dispatch real-time Push Notification to other members
    try {
      const groupRes = await pool.query(
        `SELECT name FROM public.groups WHERE id = $1`,
        [groupId]
      );
      const groupName = groupRes.rows[0]?.name || 'Grupo';

      const snippet = cleanMessage.trim()
        ? cleanMessage.length > 60
          ? cleanMessage.slice(0, 57) + '...'
          : cleanMessage
        : 'ha enviado un GIF';

      await notifyGroupMembers(
        groupId,
        payload.sub,
        {
          title: `💬 ${authorProfile.full_name} en ${groupName}`,
          body: snippet,
          url: `/groups/${groupId}?tab=members&chat=true`,
          data: {
            type: 'group_message_created',
            groupId,
            messageId,
            url: `/groups/${groupId}?tab=members&chat=true`,
          },
        }
      );
    } catch (notifErr) {
      console.warn('Could not dispatch group chat push notifications:', notifErr);
    }

    return NextResponse.json({
      message: {
        id: messageId,
        group_id: groupId,
        user_id: payload.sub,
        message: cleanMessage,
        gif_url: gifUrl,
        reactions: {},
        created_at: new Date().toISOString(),
        profile: authorProfile,
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/groups/[id]/messages:', err);
    return NextResponse.json({ error: err.message || 'Error al enviar el mensaje' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const groupId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'ID de mensaje no proporcionado' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true });
    }

    // Check if user is message author or group admin
    const isSuperAdmin = payload.role === 'admin';
    let isGroupAdmin = false;

    try {
      const memberCheck = await pool.query(
        `SELECT role FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, payload.sub]
      );
      if (memberCheck.rows[0]?.role === 'admin') {
        isGroupAdmin = true;
      }
    } catch {}

    if (isSuperAdmin || isGroupAdmin) {
      await pool.query(
        `DELETE FROM public.group_messages WHERE id = $1 AND group_id = $2`,
        [messageId, groupId]
      );
    } else {
      await pool.query(
        `DELETE FROM public.group_messages WHERE id = $1 AND group_id = $2 AND user_id = $3`,
        [messageId, groupId, payload.sub]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/groups/[id]/messages:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar el mensaje' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const groupId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const { messageId, emoji } = body;

    if (!messageId || !emoji) {
      return NextResponse.json({ error: 'Datos de reacción incompletos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true });
    }

    // Retrieve current reactions
    const currentRes = await pool.query(
      `SELECT reactions FROM public.group_messages WHERE id = $1 AND group_id = $2`,
      [messageId, groupId]
    );

    let reactions: Record<string, string[]> = {};
    if (currentRes.rows.length > 0 && typeof currentRes.rows[0].reactions === 'object' && currentRes.rows[0].reactions !== null) {
      reactions = currentRes.rows[0].reactions;
    }

    const userList = reactions[emoji] || [];
    if (userList.includes(payload.sub)) {
      reactions[emoji] = userList.filter((id) => id !== payload.sub);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...userList, payload.sub];
    }

    await pool.query(
      `UPDATE public.group_messages SET reactions = $1 WHERE id = $2 AND group_id = $3`,
      [JSON.stringify(reactions), messageId, groupId]
    );

    return NextResponse.json({ success: true, reactions });
  } catch (err: any) {
    console.error('Error in PATCH /api/groups/[id]/messages:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar la reacción' }, { status: 500 });
  }
}
