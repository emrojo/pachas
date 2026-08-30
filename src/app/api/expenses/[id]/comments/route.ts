import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';
import { sanitizeText } from '@/lib/security/sanitize';
import { notifyGroupMembers } from '@/lib/notifications/webPush';

async function autoHealCommentsTable(pool: any) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.expense_comments (
        id uuid primary key default uuid_generate_v4(),
        expense_id uuid references public.expenses(id) on delete cascade not null,
        user_id uuid references public.profiles(id) on delete cascade not null,
        comment text not null,
        gif_url text,
        reactions jsonb default '{}'::jsonb,
        created_at timestamp with time zone default timezone('utc'::text, now()) not null
      );
    `);
    await pool.query(`ALTER TABLE public.expense_comments ADD COLUMN IF NOT EXISTS gif_url text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.expense_comments ADD COLUMN IF NOT EXISTS reactions jsonb default '{}'::jsonb;`).catch(() => {});
  } catch {
    // Ignored if permissions are restricted
  }
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const expenseId = params?.id;
    if (!expenseId) {
      return NextResponse.json({ error: 'ID de gasto no válido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ comments: [] });
    }

    await autoHealCommentsTable(pool);

    try {
      const res = await pool.query(
        `SELECT c.id, c.expense_id, c.user_id, c.comment, c.gif_url, c.reactions, c.created_at,
                p.full_name as author_name, p.avatar_url as author_avatar, p.email as author_email
         FROM public.expense_comments c
         LEFT JOIN public.profiles p ON p.id = c.user_id
         WHERE c.expense_id::text = $1::text
         ORDER BY c.created_at ASC`,
        [expenseId]
      );

      const comments = res.rows.map((row) => ({
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.user_id,
        comment: row.comment || '',
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

      return NextResponse.json({ comments });
    } catch (queryErr: any) {
      if (queryErr.code === '42P01' || String(queryErr.message).includes('expense_comments')) {
        return NextResponse.json({ comments: [] });
      }
      throw queryErr;
    }
  } catch (err: any) {
    console.warn('Notice in expense comments GET:', err.message || err);
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const expenseId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const rawComment = body.comment || '';
    const cleanComment = sanitizeText(rawComment, 500);
    const gifUrl = body.gif_url ? String(body.gif_url).trim() : null;

    if (!cleanComment.trim() && !gifUrl) {
      return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    }

    const commentId = body.id && !body.id.startsWith('cmt-') ? body.id : randomUUID();
    const pool = getDbPool();

    // Check if group is frozen
    if (pool) {
      try {
        const grpRes = await pool.query(
          'SELECT g.is_frozen FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = $1',
          [expenseId]
        );
        if (grpRes.rows.length > 0 && grpRes.rows[0].is_frozen) {
          return NextResponse.json(
            { error: 'El grupo se encuentra temporalmente congelado por moderación. Los comentarios están suspendidos.' },
            { status: 403 }
          );
        }
      } catch {}
    }

    if (!pool) {
      return NextResponse.json({
        comment: {
          id: commentId,
          expense_id: expenseId,
          user_id: payload.sub,
          comment: cleanComment,
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

    await autoHealCommentsTable(pool);

    try {
      await pool.query(
        `INSERT INTO public.expense_comments (id, expense_id, user_id, comment, gif_url, reactions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET comment = EXCLUDED.comment, gif_url = EXCLUDED.gif_url`,
        [commentId, expenseId, payload.sub, cleanComment, gifUrl, JSON.stringify({})]
      );
    } catch (insertErr: any) {
      if (insertErr.code === '42P01' || String(insertErr.message).includes('expense_comments')) {
        console.warn('public.expense_comments not found in PostgreSQL, comment saved in client cache.');
      } else {
        throw insertErr;
      }
    }

    // Fetch author profile
    const profileRes = await pool.query(
      `SELECT id, email, full_name, avatar_url FROM public.profiles WHERE id = $1`,
      [payload.sub]
    );
    const authorProfile = profileRes.rows[0] || {
      id: payload.sub,
      email: payload.email || '',
      full_name: payload.full_name || 'Amigo',
      avatar_url: null,
    };

    // Fetch expense and group details, and mirror comment into group_messages
    let targetGroupId: string | null = null;
    try {
      const expRes = await pool.query(
        `SELECT e.title, e.group_id, e.amount, e.currency, g.name as group_name
         FROM public.expenses e
         JOIN public.groups g ON g.id = e.group_id
         WHERE e.id = $1`,
        [expenseId]
      );
      if (expRes.rows.length > 0) {
        const exp = expRes.rows[0];
        targetGroupId = exp.group_id;

        // Auto-mirror into group_messages table so it seamlessly appears in the group chat stream
        try {
          await pool.query(
            `CREATE TABLE IF NOT EXISTS public.group_messages (
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
            )`
          );
          await pool.query(
            `INSERT INTO public.group_messages (id, group_id, user_id, message, gif_url, reactions, expense_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [commentId, exp.group_id, payload.sub, cleanComment, gifUrl, JSON.stringify({}), expenseId]
          );
        } catch (mirrorErr) {
          console.warn('Notice mirroring expense comment to group chat:', mirrorErr);
        }

        // Single push notification dispatching (prevents double notifications)
        const preview = cleanComment ? (cleanComment.length > 65 ? `${cleanComment.substring(0, 62)}...` : cleanComment) : '🎬 [GIF animado]';
        notifyGroupMembers(exp.group_id, payload.sub, {
          title: `💬 Comentario en ${exp.title}`,
          body: `${authorProfile.full_name}: "${preview}"`,
          url: `/groups/${exp.group_id}?tab=expenses&expenseId=${expenseId}&comments=true`,
          data: {
            type: 'comment_created',
            groupId: exp.group_id,
            expenseId: expenseId,
            url: `/groups/${exp.group_id}?tab=expenses&expenseId=${expenseId}&comments=true`,
          },
        }).catch((pushErr) => console.warn('Push notification for comment failed:', pushErr));
      }
    } catch (notifErr) {
      console.warn('Could not dispatch comment notification or mirror to chat:', notifErr);
    }

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        expense_id: expenseId,
        user_id: payload.sub,
        comment: cleanComment,
        gif_url: gifUrl,
        reactions: {},
        created_at: new Date().toISOString(),
        profile: authorProfile,
      },
    });
  } catch (err: any) {
    console.error('Error creating expense comment:', err);
    return NextResponse.json({ error: err.message || 'Error al guardar comentario' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const expenseId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const { commentId, emoji } = body;

    if (!commentId || !emoji) {
      return NextResponse.json({ error: 'Datos de reacción incompletos' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true, commentId, emoji });
    }

    await autoHealCommentsTable(pool);

    const cRes = await pool.query(
      `SELECT reactions FROM public.expense_comments WHERE id::text = $1::text`,
      [commentId]
    );

    let reactions: Record<string, string[]> = {};
    if (cRes.rows.length > 0 && cRes.rows[0].reactions && typeof cRes.rows[0].reactions === 'object') {
      reactions = { ...cRes.rows[0].reactions };
    }

    const userList = reactions[emoji] || [];
    const hasReacted = userList.includes(payload.sub);

    if (hasReacted) {
      reactions[emoji] = userList.filter((uId) => uId !== payload.sub);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji] = [...userList, payload.sub];
    }

    await pool.query(
      `UPDATE public.expense_comments SET reactions = $1 WHERE id::text = $2::text`,
      [JSON.stringify(reactions), commentId]
    );

    return NextResponse.json({ success: true, commentId, reactions });
  } catch (err: any) {
    console.error('Error toggling comment reaction:', err);
    return NextResponse.json({ error: err.message || 'Error al reaccionar al comentario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const expenseId = params?.id;
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const url = new URL(request.url);
    const commentId = url.searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'ID de comentario no proporcionado' }, { status: 400 });
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(
          `DELETE FROM public.expense_comments WHERE id::text = $1::text AND (user_id::text = $2::text OR expense_id::text = $3::text)`,
          [commentId, payload.sub, expenseId]
        );
      } catch (delErr: any) {
        if (delErr.code !== '42P01') throw delErr;
      }
    }

    return NextResponse.json({ success: true, commentId });
  } catch (err: any) {
    console.error('Error deleting expense comment:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar comentario' }, { status: 500 });
  }
}
