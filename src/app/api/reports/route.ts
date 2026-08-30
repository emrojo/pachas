import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { sanitizeText } from '@/lib/security/sanitize';
import { verifyJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { notifyAppAdmins } from '@/lib/notifications/webPush';

async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; userId?: string; email?: string }> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) {
        return { isAdmin: true, userId: payload.sub, email: payload.email };
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
              return { isAdmin: true, userId: payload.sub, email: user.email };
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
        return { isAdmin: true, userId: parsed.id, email: parsed.email };
      }
    } catch {}
  }

  return { isAdmin: false };
}

async function autoHealReportsTable(pool: any) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.content_reports (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        target_type text NOT NULL,
        target_id text NOT NULL,
        target_title text,
        target_url text,
        group_id uuid,
        reason text NOT NULL,
        details text,
        reporter_id uuid,
        reporter_email text,
        status text DEFAULT 'pending' NOT NULL,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS target_url text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS group_id uuid;`).catch(() => {});
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const auth = await checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador de Sistema.' },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ reports: [] });
    }

    await autoHealReportsTable(pool);

    const res = await pool.query(`
      SELECT 
        r.id,
        r.target_type,
        r.target_id,
        r.target_title,
        r.target_url,
        r.group_id,
        r.reason,
        r.details,
        r.reporter_id,
        r.reporter_email,
        r.status,
        r.created_at,
        p.full_name as reporter_name,
        p.avatar_url as reporter_avatar
      FROM public.content_reports r
      LEFT JOIN public.profiles p ON p.id = r.reporter_id
      ORDER BY r.created_at DESC
    `);

    return NextResponse.json({ reports: res.rows });
  } catch (err: any) {
    console.error('Error fetching admin reports:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener reportes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetType, targetId, targetTitle, targetUrl, groupId, reason, details } = body;

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para el reporte' }, { status: 400 });
    }

    // Resolve current user if logged in
    const token = request.cookies.get('sb-access-token')?.value;
    let reporterId: string | null = null;
    let reporterEmail: string | null = null;

    if (token) {
      const payload = await verifyJwt(token);
      if (payload) {
        reporterId = payload.sub;
        reporterEmail = payload.email || null;
      }
    }

    const cleanReason = sanitizeText(reason, 50);
    const cleanDetails = details ? sanitizeText(details, 500) : null;
    const cleanTargetTitle = targetTitle ? sanitizeText(targetTitle, 120) : null;
    const cleanTargetUrl = targetUrl ? sanitizeText(targetUrl, 255) : null;

    const pool = getDbPool();
    let reportId = null;

    if (pool) {
      try {
        await autoHealReportsTable(pool);

        const insRes = await pool.query(
          `INSERT INTO public.content_reports (target_type, target_id, target_title, target_url, group_id, reason, details, reporter_id, reporter_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [targetType, targetId, cleanTargetTitle, cleanTargetUrl, groupId || null, cleanReason, cleanDetails, reporterId, reporterEmail]
        );
        if (insRes.rows.length > 0) {
          reportId = insRes.rows[0].id;
        }
      } catch (dbErr) {
        console.warn('Could not persist report to database:', dbErr);
      }
    }

    console.log(`[Pachas Safety Report] Type: ${targetType}, ID: ${targetId}, Reason: ${cleanReason}, Details: ${cleanDetails}, Reporter: ${reporterEmail || 'anon'}`);

    // Dispatch real-time Push Notification to all system administrators
    try {
      const targetLabel = cleanTargetTitle ? `"${cleanTargetTitle}"` : targetType;
      await notifyAppAdmins({
        title: '🛡️ Nuevo reporte de contenido',
        body: `${reporterEmail || 'Un usuario'} ha reportado ${targetType} ${targetLabel}: "${cleanReason}"`,
        url: '/admin?tab=reports',
        data: {
          type: 'content_reported',
          targetType,
          targetId,
          url: '/admin?tab=reports',
        },
      });
    } catch (notifErr) {
      console.warn('Could not dispatch admin push notification for safety report:', notifErr);
    }

    return NextResponse.json({
      success: true,
      reportId,
      message: 'Reporte registrado con éxito. Será revisado por un administrador.',
    }, { status: 201 });
  } catch (err: any) {
    console.error('API report error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al procesar el reporte' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requieren privilegios de Administrador de Sistema.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reportId, status } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Faltan parámetros reportId y status' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true, status });
    }

    await autoHealReportsTable(pool);

    await pool.query(
      `UPDATE public.content_reports
       SET status = $1
       WHERE id = $2`,
      [status, reportId]
    );

    return NextResponse.json({ success: true, reportId, status });
  } catch (err: any) {
    console.error('Error updating report status:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar reporte' }, { status: 500 });
  }
}
