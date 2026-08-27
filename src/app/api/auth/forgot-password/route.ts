import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Introduce un correo electrónico válido.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

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

    // Check if user exists
    const userRes = await pool.query('SELECT id, email FROM auth.users WHERE email = $1', [cleanEmail]);

    if (userRes.rows.length === 0) {
      // To prevent email enumeration attacks in public production, return generic success message
      return NextResponse.json({
        success: true,
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
      });
    }

    const userId = userRes.rows[0].id;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

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

    const resetUrl = `/reset-password?token=${token}`;

    return NextResponse.json({
      success: true,
      message: 'Instrucciones enviadas. Haz clic en el enlace para continuar con el restablecimiento.',
      resetUrl,
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
