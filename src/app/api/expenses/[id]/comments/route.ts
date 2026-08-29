import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';
import { sanitizeText } from '@/lib/security/sanitize';

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

    const res = await pool.query(
      `SELECT c.id, c.expense_id, c.user_id, c.comment, c.created_at,
              p.full_name as author_name, p.avatar_url as author_avatar, p.email as author_email
       FROM public.expense_comments c
       LEFT JOIN public.profiles p ON p.id = c.user_id
       WHERE c.expense_id = $1
       ORDER BY c.created_at ASC`,
      [expenseId]
    );

    const comments = res.rows.map((row) => ({
      id: row.id,
      expense_id: row.expense_id,
      user_id: row.user_id,
      comment: row.comment,
      created_at: row.created_at,
      profile: {
        id: row.user_id,
        email: row.author_email || '',
        full_name: row.author_name || 'Amigo',
        avatar_url: row.author_avatar || null,
      },
    }));

    return NextResponse.json({ comments });
  } catch (err: any) {
    console.error('Error fetching expense comments:', err);
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

    if (!cleanComment.trim()) {
      return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    }

    const commentId = body.id || `cmt-${randomUUID()}`;
    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json({
        comment: {
          id: commentId,
          expense_id: expenseId,
          user_id: payload.sub,
          comment: cleanComment,
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

    await pool.query(
      `INSERT INTO public.expense_comments (id, expense_id, user_id, comment, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET comment = EXCLUDED.comment`,
      [commentId, expenseId, payload.sub, cleanComment]
    );

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

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        expense_id: expenseId,
        user_id: payload.sub,
        comment: cleanComment,
        created_at: new Date().toISOString(),
        profile: authorProfile,
      },
    });
  } catch (err: any) {
    console.error('Error creating expense comment:', err);
    return NextResponse.json({ error: err.message || 'Error al guardar comentario' }, { status: 500 });
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
      await pool.query(
        `DELETE FROM public.expense_comments WHERE id = $1 AND (user_id = $2 OR expense_id = $3)`,
        [commentId, payload.sub, expenseId]
      );
    }

    return NextResponse.json({ success: true, commentId });
  } catch (err: any) {
    console.error('Error deleting expense comment:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar comentario' }, { status: 500 });
  }
}
