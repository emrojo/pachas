import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { sanitizeText } from '@/lib/security/sanitize';
import { verifyJwt } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetType, targetId, targetTitle, reason, details } = body;

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
        reporterEmail = payload.email;
      }
    }

    const cleanReason = sanitizeText(reason, 50);
    const cleanDetails = details ? sanitizeText(details, 500) : null;
    const cleanTargetTitle = targetTitle ? sanitizeText(targetTitle, 120) : null;

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.content_reports (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            target_type text NOT NULL,
            target_id text NOT NULL,
            target_title text,
            reason text NOT NULL,
            details text,
            reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
            reporter_email text,
            status text DEFAULT 'pending' NOT NULL,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
          );
        `);

        await pool.query(
          `INSERT INTO public.content_reports (target_type, target_id, target_title, reason, details, reporter_id, reporter_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [targetType, targetId, cleanTargetTitle, cleanReason, cleanDetails, reporterId, reporterEmail]
        );
      } catch (dbErr) {
        console.warn('Could not persist report to database:', dbErr);
      }
    }

    console.log(`[Pachas Safety Report] Type: ${targetType}, ID: ${targetId}, Reason: ${cleanReason}, Details: ${cleanDetails}, Reporter: ${reporterEmail || 'anon'}`);

    return NextResponse.json({
      success: true,
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
