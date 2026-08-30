import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
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
        expense_id uuid references public.expenses(id) on delete cascade,
        reply_to_id uuid references public.group_messages(id) on delete set null,
        reply_to_snippet jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `);
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS gif_url text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reactions jsonb default '{}'::jsonb;`).catch(() => {});
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS expense_id uuid;`).catch(() => {});
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid;`).catch(() => {});
    await pool.query(`ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS reply_to_snippet jsonb;`).catch(() => {});
  } catch {
    // Ignored if table creation is restricted
  }
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
        `SELECT m.id, m.group_id, m.user_id, m.message, m.gif_url, m.reactions, m.expense_id, m.reply_to_id, m.reply_to_snippet, m.created_at,
                p.full_name as author_name, p.avatar_url as author_avatar, p.email as author_email,
                e.title as expense_title, e.amount as expense_amount, e.currency as expense_currency
         FROM public.group_messages m
         LEFT JOIN public.profiles p ON p.id = m.user_id
         LEFT JOIN public.expenses e ON e.id = m.expense_id
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
        expense_id: row.expense_id || null,
        expense_title: row.expense_title || null,
        expense_amount: row.expense_amount !== null && row.expense_amount !== undefined ? Number(row.expense_amount) : null,
        expense_currency: row.expense_currency || null,
        reply_to_id: row.reply_to_id || null,
        reply_to_snippet: (typeof row.reply_to_snippet === 'object' && row.reply_to_snippet !== null) ? row.reply_to_snippet : null,
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
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const params = await props.params;
    const groupId = params?.id;

    const body = await request.json();
    const rawMessage = body.message || '';
    const cleanMessage = sanitizeText(rawMessage, 1000);
    const gifUrl = body.gif_url ? String(body.gif_url).trim() : null;
    const replyToId = body.reply_to_id ? String(body.reply_to_id) : null;
    const replyToSnippet = body.reply_to_snippet && typeof body.reply_to_snippet === 'object' ? body.reply_to_snippet : null;
    const expenseId = body.expense_id ? String(body.expense_id) : (replyToSnippet?.expense_id ? String(replyToSnippet.expense_id) : null);

    if (!cleanMessage.trim() && !gifUrl) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    const messageId = body.id && !body.id.startsWith('msg-') ? body.id : randomUUID();
    const pool = getDbPool();

    // Check if group is frozen
    if (pool) {
      try {
        const grpRes = await pool.query('SELECT is_frozen FROM public.groups WHERE id = $1', [groupId]);
        if (grpRes.rows.length > 0 && grpRes.rows[0].is_frozen) {
          return NextResponse.json(
            { error: 'El grupo se encuentra temporalmente congelado por moderación. El chat está suspendido.' },
            { status: 403 }
          );
        }
      } catch {}
    }

    if (!pool) {
      return NextResponse.json({
        message: {
          id: messageId,
          group_id: groupId,
          user_id: user.userId,
          message: cleanMessage,
          gif_url: gifUrl,
          reactions: {},
          expense_id: expenseId,
          expense_title: replyToSnippet?.expense_title || null,
          reply_to_id: replyToId,
          reply_to_snippet: replyToSnippet,
          created_at: new Date().toISOString(),
          profile: {
            id: user.userId,
            email: user.email || '',
            full_name: user.email?.split('@')[0] || 'Amigo',
            avatar_url: null,
          },
        },
      });
    }

    await autoHealGroupMessagesTable(pool);

    try {
      await pool.query(
        `INSERT INTO public.group_messages (id, group_id, user_id, message, gif_url, reactions, expense_id, reply_to_id, reply_to_snippet, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, gif_url = EXCLUDED.gif_url, reply_to_snippet = EXCLUDED.reply_to_snippet`,
        [
          messageId,
          groupId,
          user.userId,
          cleanMessage,
          gifUrl,
          JSON.stringify({}),
          expenseId,
          replyToId,
          replyToSnippet ? JSON.stringify(replyToSnippet) : null,
        ]
      );
    } catch (insertErr: any) {
      if (insertErr.code === '42P01' || String(insertErr.message).includes('group_messages')) {
        console.warn('public.group_messages not found in PostgreSQL, message saved in client cache.');
      } else {
        await pool.query(
          `INSERT INTO public.group_messages (id, group_id, user_id, message, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [messageId, groupId, user.userId, cleanMessage]
        ).catch(() => {});
      }
    }

    // If this chat message relates to an expense, also record it as an expense comment in public.expense_comments!
    if (expenseId) {
      try {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS public.expense_comments (
            id uuid primary key default uuid_generate_v4(),
            expense_id uuid references public.expenses(id) on delete cascade not null,
            user_id uuid references public.profiles(id) on delete cascade not null,
            comment text not null,
            gif_url text,
            reactions jsonb default '{}'::jsonb,
            created_at timestamp with time zone default timezone('utc'::text, now()) not null
          )`
        );
        const commentId = randomUUID();
        await pool.query(
          `INSERT INTO public.expense_comments (id, expense_id, user_id, comment, gif_url, reactions, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [commentId, expenseId, user.userId, cleanMessage, gifUrl, JSON.stringify({})]
        );
      } catch (commentErr) {
        console.warn('Notice attaching chat message to expense comment:', commentErr);
      }
    }

    // Fetch author info and return
    let authorProfile: any = { id: user.userId, full_name: 'Amigo', avatar_url: null, email: user.email };
    try {
      const pRes = await pool.query('SELECT full_name, avatar_url, email FROM public.profiles WHERE id::text = $1::text', [user.userId]);
      if (pRes.rows.length > 0) {
        authorProfile = { id: user.userId, ...pRes.rows[0] };
      }
    } catch {}

    // Dispatch background web push notifications to other group members
    try {
      const grpRes = await pool.query('SELECT name FROM public.groups WHERE id::text = $1::text', [groupId]);
      const groupName = grpRes.rows[0]?.name || 'el grupo';
      const senderName = authorProfile.full_name || 'Alguien';

      notifyGroupMembers(groupId, user.userId, {
        title: `💬 ${senderName} en "${groupName}"`,
        body: cleanMessage.length > 80 ? `${cleanMessage.substring(0, 80)}...` : cleanMessage,
        url: `/groups/${groupId}?tab=chat`,
        data: {
          type: 'group_message',
          groupId,
          messageId,
          url: `/groups/${groupId}?tab=chat`,
        },
      }).catch((pushErr) => {
        console.warn('Non-fatal push notification error:', pushErr);
      });
    } catch (notifErr) {
      console.warn('Could not dispatch group message notification:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: {
        id: messageId,
        group_id: groupId,
        user_id: user.userId,
        message: cleanMessage,
        gif_url: gifUrl,
        reactions: {},
        expense_id: expenseId,
        expense_title: replyToSnippet?.expense_title || null,
        reply_to_id: replyToId,
        reply_to_snippet: replyToSnippet,
        created_at: new Date().toISOString(),
        profile: authorProfile,
      },
    });
  } catch (err: any) {
    console.error('API create group message error:', err);
    return NextResponse.json({ error: err.message || 'Error al enviar mensaje' }, { status: 500 });
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
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'ID de mensaje no proporcionado' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true });
    }

    // Check if user is message author or group admin
    const isSuperAdmin = user.isAdmin;
    let isGroupAdmin = false;

    try {
      const memberCheck = await pool.query(
        `SELECT role FROM public.group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, user.userId]
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
        [messageId, groupId, user.userId]
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
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const params = await props.params;
    const groupId = params?.id;

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
    if (userList.includes(user.userId)) {
      reactions[emoji] = userList.filter((id) => id !== user.userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...userList, user.userId];
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
