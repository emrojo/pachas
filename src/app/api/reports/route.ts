import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { sanitizeText } from '@/lib/security/sanitize';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { notifyAppAdmins } from '@/lib/notifications/webPush';

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
        resolution_notes text,
        evidence_snapshot jsonb,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS target_url text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS group_id uuid;`).catch(() => {});
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS resolution_notes text;`).catch(() => {});
    await pool.query(`ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS evidence_snapshot jsonb;`).catch(() => {});
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request, { requireAdmin: true });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
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
        COALESCE(r.target_title, e.title, g.name) as target_title,
        COALESCE(
          r.target_url,
          CASE 
            WHEN (r.target_type = 'expense' OR r.target_type = 'receipt') AND COALESCE(r.group_id, e.group_id) IS NOT NULL 
              THEN '/groups/' || COALESCE(r.group_id, e.group_id)::text || '?tab=expenses&expenseId=' || r.target_id
            WHEN r.target_type = 'group' 
              THEN '/groups/' || r.target_id
            ELSE NULL
          END
        ) as target_url,
        COALESCE(r.group_id, e.group_id) as group_id,
        r.reason,
        r.details,
        r.reporter_id,
        r.reporter_email,
        r.status,
        r.resolution_notes,
        r.evidence_snapshot,
        r.created_at,
        p.full_name as reporter_name,
        p.avatar_url as reporter_avatar,
        e.created_by as expense_author_id,
        exp_author.full_name as expense_author_name,
        exp_author.email as expense_author_email,
        exp_author.avatar_url as expense_author_avatar
      FROM public.content_reports r
      LEFT JOIN public.profiles p ON p.id = r.reporter_id
      LEFT JOIN public.expenses e ON (r.target_type IN ('expense', 'receipt') AND e.id::text = r.target_id)
      LEFT JOIN public.profiles exp_author ON exp_author.id = e.created_by
      LEFT JOIN public.groups g ON (r.target_type = 'group' AND g.id::text = r.target_id)
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
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const body = await request.json();
    const { targetType, targetId, targetTitle, targetUrl, groupId, reason, details } = body;

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para el reporte' }, { status: 400 });
    }

    const reporterId = user.userId;
    const reporterEmail = user.email || null;

    const cleanReason = sanitizeText(reason, 100);
    const cleanDetails = details ? sanitizeText(details, 500) : null;
    let cleanTargetTitle = targetTitle ? sanitizeText(targetTitle, 200) : null;
    let cleanTargetUrl = targetUrl ? sanitizeText(targetUrl, 500) : null;
    let cleanGroupId = groupId ? String(groupId).trim() : null;

    const pool = getDbPool();
    let reportId = null;

    if (pool) {
      await autoHealReportsTable(pool);

      try {
        // Auto-resolve group_id and target_url from database if not supplied
        if ((!cleanGroupId || !cleanTargetTitle) && (targetType === 'expense' || targetType === 'receipt')) {
          const expRes = await pool.query(
            'SELECT group_id, title FROM public.expenses WHERE id::text = $1::text',
            [targetId]
          );
          if (expRes.rows.length > 0) {
            cleanGroupId = expRes.rows[0].group_id;
            if (!cleanTargetTitle) cleanTargetTitle = expRes.rows[0].title;
            if (!cleanTargetUrl && cleanGroupId) {
              cleanTargetUrl = `/groups/${cleanGroupId}?tab=expenses&expenseId=${targetId}`;
            }
          }
        } else if ((!cleanGroupId || !cleanTargetTitle) && targetType === 'comment') {
          const cRes = await pool.query(
            `SELECT c.expense_id, e.group_id, e.title 
             FROM public.expense_comments c 
             JOIN public.expenses e ON e.id = c.expense_id 
             WHERE c.id::text = $1::text`,
            [targetId]
          );
          if (cRes.rows.length > 0) {
            cleanGroupId = cRes.rows[0].group_id;
            if (!cleanTargetTitle) cleanTargetTitle = `Comentario en: ${cRes.rows[0].title}`;
            if (!cleanTargetUrl && cleanGroupId) {
              cleanTargetUrl = `/groups/${cleanGroupId}?tab=expenses&expenseId=${cRes.rows[0].expense_id}&comments=true`;
            }
          }
        } else if (cleanGroupId && !cleanTargetUrl && (targetType === 'expense' || targetType === 'receipt')) {
          cleanTargetUrl = `/groups/${cleanGroupId}?tab=expenses&expenseId=${targetId}`;
        } else if (cleanGroupId && !cleanTargetUrl && targetType === 'group') {
          cleanTargetUrl = `/groups/${cleanGroupId}`;
        }

        const insRes = await pool.query(
          `INSERT INTO public.content_reports (target_type, target_id, target_title, target_url, group_id, reason, details, reporter_id, reporter_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [targetType, targetId, cleanTargetTitle, cleanTargetUrl, cleanGroupId || null, cleanReason, cleanDetails, reporterId, reporterEmail]
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
    const authResult = await requireActiveUser(request, { requireAdmin: true });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await request.json();
    const { reportId, status, resolutionNotes, evidenceSnapshot } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Faltan parámetros reportId y status' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true, status });
    }

    await autoHealReportsTable(pool);

    const safeNotes = resolutionNotes !== undefined ? sanitizeText(resolutionNotes, 500) : null;
    const safeEvidence = evidenceSnapshot !== undefined ? JSON.stringify(evidenceSnapshot) : null;

    const updateRes = await pool.query(
      `UPDATE public.content_reports
       SET status = $1,
           resolution_notes = COALESCE($2, resolution_notes),
           evidence_snapshot = COALESCE($3::jsonb, evidence_snapshot)
       WHERE id = $4
       RETURNING reporter_id, reporter_email, target_title, target_type, reason, group_id`,
      [status, safeNotes, safeEvidence, reportId]
    );

    // Feedback notification to the reporter if user is known
    if (updateRes.rows.length > 0 && updateRes.rows[0].reporter_id) {
      const repRow = updateRes.rows[0];
      try {
        const isActionTaken = status === 'action_taken';
        const notifTitle = isActionTaken ? '🛡️ Tu reporte ha sido resuelto' : 'ℹ️ Tu reporte ha sido revisado';
        const notifBody = isActionTaken
          ? `Se han tomado medidas sobre "${repRow.target_title || repRow.target_type}".` + (safeNotes ? ` Nota: ${safeNotes}` : '')
          : `El equipo de moderación ha revisado "${repRow.target_title || repRow.target_type}".` + (safeNotes ? ` Nota: ${safeNotes}` : '');

        // Persist notification in database for reporter
        await pool.query(
          `INSERT INTO public.notifications (user_id, type, title, message, group_id, action_url, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT DO NOTHING`,
          [repRow.reporter_id, 'system', notifTitle, notifBody, repRow.group_id || null, '/notifications']
        ).catch(() => {});
      } catch (repErr) {
        console.warn('Could not dispatch notification to reporter:', repErr);
      }
    }

    return NextResponse.json({ success: true, reportId, status });
  } catch (err: any) {
    console.error('Error updating report status:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar reporte' }, { status: 500 });
  }
}
