import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { sanitizeText } from '@/lib/security/sanitize';
import { verifyJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';

async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; adminId?: string; email?: string }> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) {
        return { isAdmin: true, adminId: payload.sub, email: payload.email };
      }
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query(
            'SELECT role, email FROM public.profiles WHERE id::text = $1::text',
            [payload.sub]
          );
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (isServerAdmin(user.email, payload.sub, user.role)) {
              return { isAdmin: true, adminId: payload.sub, email: user.email };
            }
          }
        } catch {}
      }
    }
  }

  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (isServerAdmin(parsed.email, parsed.id, parsed.role)) {
        return { isAdmin: true, adminId: parsed.id, email: parsed.email };
      }
    } catch {}
  }

  return { isAdmin: false };
}

async function autoHealBanColumns(pool: any) {
  try {
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by UUID;`).catch(() => {});
    await pool.query(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;`).catch(() => {});
  } catch {}
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador de Sistema.' },
        { status: 403 }
      );
    }

    const params = await props.params;
    const targetUserId = params.id;

    const body = await request.json();
    const { reason } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await autoHealBanColumns(pool);

    const cleanReason = reason ? sanitizeText(reason, 500) : 'Infracción de las normas de la comunidad / moderación';

    await pool.query(
      `UPDATE public.profiles
       SET is_banned = TRUE,
           banned_at = NOW(),
           banned_by = $1,
           ban_reason = $2
       WHERE id::text = $3::text`,
      [auth.adminId || null, cleanReason, targetUserId]
    );

    // Notify user
    try {
      await pool.query(
        `INSERT INTO public.notifications (user_id, type, title, message, action_url, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        [
          targetUserId,
          'user_banned',
          '🚫 Cuenta suspendida',
          `Tu cuenta ha sido suspendida: "${cleanReason}". Puedes contactar con el administrador a través del chat de soporte para formular aclaraciones.`,
          '/notifications',
        ]
      );
    } catch {}

    return NextResponse.json({ success: true, userId: targetUserId, is_banned: true, ban_reason: cleanReason });
  } catch (err: any) {
    console.error('Error banning user:', err);
    return NextResponse.json({ error: err.message || 'Error al banear usuario' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador de Sistema.' },
        { status: 403 }
      );
    }

    const params = await props.params;
    const targetUserId = params.id;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await autoHealBanColumns(pool);

    await pool.query(
      `UPDATE public.profiles
       SET is_banned = FALSE,
           banned_at = NULL,
           banned_by = NULL,
           ban_reason = NULL
       WHERE id::text = $1::text`,
      [targetUserId]
    );

    // Notify user
    try {
      await pool.query(
        `INSERT INTO public.notifications (user_id, type, title, message, action_url, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        [
          targetUserId,
          'user_unbanned',
          '🟢 Cuenta reactivada',
          'Tu cuenta ha sido reactivada por el administrador. Ya puedes volver a acceder con normalidad.',
          '/dashboard',
        ]
      );
    } catch {}

    return NextResponse.json({ success: true, userId: targetUserId, is_banned: false });
  } catch (err: any) {
    console.error('Error unbanning user:', err);
    return NextResponse.json({ error: err.message || 'Error al desbanear usuario' }, { status: 500 });
  }
}
