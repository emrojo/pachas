import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { sanitizeText } from '@/lib/security/sanitize';
import { verifyJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { notifyAppAdmins } from '@/lib/notifications/webPush';

async function autoHealSupportTable(pool: any) {
  try {
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by UUID;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;`).catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        sender_id UUID NOT NULL,
        sender_role TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        attachment_url TEXT,
        is_read_by_user BOOLEAN DEFAULT FALSE NOT NULL,
        is_read_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `).catch(async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.support_messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          sender_id UUID NOT NULL,
          sender_role TEXT NOT NULL,
          message TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          attachment_url TEXT,
          is_read_by_user BOOLEAN DEFAULT FALSE NOT NULL,
          is_read_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
      `).catch(() => {});
    });
  } catch {}
}

async function resolveUserAuth(request: NextRequest): Promise<{ userId: string; email?: string; role?: string; isAdmin: boolean } | null> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      const isAdmin = isServerAdmin(payload.email, payload.sub, payload.role);
      return { userId: payload.sub, email: payload.email, role: payload.role, isAdmin };
    }
  }

  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (parsed?.id) {
        const isAdmin = isServerAdmin(parsed.email, parsed.id, parsed.role);
        return { userId: parsed.id, email: parsed.email, role: parsed.role, isAdmin };
      }
    } catch {}
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveUserAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ messages: [], conversations: [] });
    }

    await autoHealSupportTable(pool);

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const loadConversations = searchParams.get('conversations') === 'true';

    let hasBanCol = false;
    try {
      const checkCol = await pool.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_banned'
      `);
      hasBanCol = checkCol.rows.length > 0;
    } catch {}

    // If admin is requesting all conversation summaries
    if (auth.isAdmin && loadConversations && !requestedUserId) {
      let convRes;
      try {
        convRes = await pool.query(`
          SELECT 
            m.user_id,
            COALESCE(p.full_name, 'Usuario') as user_name,
            p.email as user_email,
            p.avatar_url as user_avatar,
            COALESCE(p.is_banned, FALSE) as is_banned,
            p.ban_reason,
            COUNT(CASE WHEN m.is_read_by_admin = FALSE AND m.sender_role = 'user' THEN 1 END)::int as unread_count,
            MAX(m.created_at) as last_message_at,
            (
              SELECT message 
              FROM public.support_messages 
              WHERE user_id = m.user_id 
              ORDER BY created_at DESC 
              LIMIT 1
            ) as last_message,
            (
              SELECT category 
              FROM public.support_messages 
              WHERE user_id = m.user_id 
              ORDER BY created_at DESC 
              LIMIT 1
            ) as last_category
          FROM public.support_messages m
          LEFT JOIN public.profiles p ON p.id::text = m.user_id::text
          GROUP BY m.user_id, p.full_name, p.email, p.avatar_url, p.is_banned, p.ban_reason
          ORDER BY last_message_at DESC
        `);
      } catch (err: any) {
        // If is_banned column is missing on profiles, query without it
        if (err?.message?.includes('is_banned')) {
          convRes = await pool.query(`
            SELECT 
              m.user_id,
              COALESCE(p.full_name, 'Usuario') as user_name,
              p.email as user_email,
              p.avatar_url as user_avatar,
              FALSE as is_banned,
              NULL as ban_reason,
              COUNT(CASE WHEN m.is_read_by_admin = FALSE AND m.sender_role = 'user' THEN 1 END)::int as unread_count,
              MAX(m.created_at) as last_message_at,
              (
                SELECT message 
                FROM public.support_messages 
                WHERE user_id = m.user_id 
                ORDER BY created_at DESC 
                LIMIT 1
              ) as last_message,
              (
                SELECT category 
                FROM public.support_messages 
                WHERE user_id = m.user_id 
                ORDER BY created_at DESC 
                LIMIT 1
              ) as last_category
            FROM public.support_messages m
            LEFT JOIN public.profiles p ON p.id::text = m.user_id::text
            GROUP BY m.user_id, p.full_name, p.email, p.avatar_url
            ORDER BY last_message_at DESC
          `).catch(() => ({ rows: [] }));
        } else {
          return NextResponse.json({ conversations: [] });
        }
      }

      return NextResponse.json({ conversations: convRes?.rows || [] });
    }

    // Determine target user thread
    const targetUserId = auth.isAdmin && requestedUserId ? requestedUserId : auth.userId;

    let msgRes;
    try {
      msgRes = await pool.query(
        `SELECT 
          m.id,
          m.user_id,
          m.sender_id,
          m.sender_role,
          m.message,
          m.category,
          m.attachment_url,
          m.is_read_by_user,
          m.is_read_by_admin,
          m.created_at,
          p.full_name as sender_name,
          p.avatar_url as sender_avatar,
          up.full_name as user_name,
          up.email as user_email
        FROM public.support_messages m
        LEFT JOIN public.profiles p ON p.id::text = m.sender_id::text
        LEFT JOIN public.profiles up ON up.id::text = m.user_id::text
        WHERE m.user_id::text = $1::text
        ORDER BY m.created_at ASC`,
        [targetUserId]
      );
    } catch (err: any) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: msgRes?.rows || [] });
  } catch (err: any) {
    console.error('Error fetching support messages:', err);
    return NextResponse.json({ messages: [], conversations: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveUserAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { message, category, attachmentUrl, targetUserId } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await autoHealSupportTable(pool);

    const cleanMessage = sanitizeText(message, 2000);
    const cleanCategory = category ? sanitizeText(category, 50) : 'general';
    const cleanAttachmentUrl = attachmentUrl ? sanitizeText(attachmentUrl, 500) : null;

    let finalUserId: string;
    let senderRole: 'user' | 'admin';

    if (auth.isAdmin && targetUserId) {
      finalUserId = targetUserId;
      senderRole = 'admin';
    } else {
      finalUserId = auth.userId;
      senderRole = 'user';
    }

    const isReadByUser = senderRole === 'user';
    const isReadByAdmin = senderRole === 'admin';

    const insertRes = await pool.query(
      `INSERT INTO public.support_messages 
       (user_id, sender_id, sender_role, message, category, attachment_url, is_read_by_user, is_read_by_admin, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [finalUserId, auth.userId, senderRole, cleanMessage, cleanCategory, cleanAttachmentUrl, isReadByUser, isReadByAdmin]
    );

    const savedMessage = insertRes.rows[0];

    // Notification Dispatching
    if (senderRole === 'user') {
      // Notify System Admins
      try {
        const uRes = await pool.query('SELECT full_name, email FROM public.profiles WHERE id::text = $1::text', [auth.userId]);
        const userName = uRes.rows[0]?.full_name || auth.email || 'Un usuario';

        await notifyAppAdmins({
          title: `💬 Mensaje de Soporte (${cleanCategory})`,
          body: `${userName}: "${cleanMessage.substring(0, 80)}"`,
          url: `/admin?tab=support&userId=${auth.userId}`,
          data: {
            type: 'support_message_received',
            userId: auth.userId,
            url: `/admin?tab=support&userId=${auth.userId}`,
          },
        });
      } catch (notifErr) {
        console.warn('Could not dispatch admin notification for support message:', notifErr);
      }
    } else {
      // Notify User from Admin
      try {
        await pool.query(
          `INSERT INTO public.notifications (user_id, type, title, message, action_url, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT DO NOTHING`,
          [
            finalUserId,
            'support_message_received',
            '💬 Respuesta del Administrador de Pachas',
            cleanMessage.length > 100 ? `${cleanMessage.substring(0, 100)}...` : cleanMessage,
            '/notifications',
          ]
        );
      } catch (notifErr) {
        console.warn('Could not dispatch user notification from admin:', notifErr);
      }
    }

    return NextResponse.json({ success: true, message: savedMessage }, { status: 201 });
  } catch (err: any) {
    console.error('Error posting support message:', err);
    return NextResponse.json({ error: err.message || 'Error al enviar mensaje de soporte' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await resolveUserAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true });
    }

    await autoHealSupportTable(pool);

    const targetUserId = auth.isAdmin && userId ? userId : auth.userId;

    if (auth.isAdmin) {
      await pool.query(
        `UPDATE public.support_messages SET is_read_by_admin = TRUE WHERE user_id = $1`,
        [targetUserId]
      );
    } else {
      await pool.query(
        `UPDATE public.support_messages SET is_read_by_user = TRUE WHERE user_id = $1`,
        [targetUserId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error marking support messages as read:', err);
    return NextResponse.json({ error: err.message || 'Error al marcar como leídos' }, { status: 500 });
  }
}
