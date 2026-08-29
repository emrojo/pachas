import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { randomBytes } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email/mailer';
import { isDemoModeAllowed } from '@/lib/authConfig';
import { DEMO_USERS } from '@/lib/demoData';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Introduce un correo electrónico válido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pool = getDbPool();
    const demoAllowed = isDemoModeAllowed();

    // Determine Base URL for absolute reset link in emails
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    let userId: string | null = null;
    let fullName: string | undefined = undefined;

    if (pool) {
      // Ensure password_reset_tokens table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          token text UNIQUE NOT NULL,
          expires_at timestamp with time zone NOT NULL,
          used boolean DEFAULT false NOT NULL,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
      `);

      // Query user case-insensitively
      const userRes = await pool.query(
        `SELECT u.id, u.email, p.full_name, u.raw_user_meta_data 
         FROM auth.users u 
         LEFT JOIN public.profiles p ON p.id = u.id 
         WHERE LOWER(u.email) = LOWER($1)`,
        [cleanEmail]
      );

      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        fullName = userRes.rows[0].full_name || userRes.rows[0].raw_user_meta_data?.full_name;
      }
    }

    // If not found in DB but demo mode is allowed, check demo users
    if (!userId && demoAllowed) {
      const demoUser = DEMO_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (demoUser) {
        userId = demoUser.id;
        fullName = demoUser.full_name;
      }
    }

    if (!userId) {
      // If user does not exist, return standard generic message to prevent enumeration
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: 'Si el correo electrónico está registrado, recibirás un enlace de recuperación.',
      });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    if (pool) {
      // Invalidate prior unused tokens
      await pool.query(
        'UPDATE auth.password_reset_tokens SET used = true WHERE user_id = $1 AND used = false',
        [userId]
      );

      // Insert new token
      await pool.query(
        'INSERT INTO auth.password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, expiresAt]
      );
    }

    const absoluteResetUrl = `${baseUrl}/reset-password?token=${token}`;
    const relativeResetUrl = `/reset-password?token=${token}`;

    // Send the actual email
    const emailResult = await sendPasswordResetEmail({
      to: cleanEmail,
      resetUrl: absoluteResetUrl,
      fullName,
    });

    const isRealEmailSent = emailResult.success && emailResult.provider !== 'simulation';

    return NextResponse.json({
      success: true,
      emailSent: isRealEmailSent,
      provider: emailResult.provider,
      message: isRealEmailSent
        ? 'Hemos enviado un correo electrónico con el enlace para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.'
        : 'Se ha generado el enlace de recuperación. Si no has configurado un servidor de correo SMTP en el servidor, puedes usar el enlace directamente:',
      resetUrl: relativeResetUrl,
      token,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar la solicitud de recuperación' },
      { status: 500 }
    );
  }
}
