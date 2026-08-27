import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { hashPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token de recuperación no válido o ausente.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // Verify token validity
    const tokenRes = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.used, u.email
       FROM auth.password_reset_tokens t
       JOIN auth.users u ON u.id = t.user_id
       WHERE t.token = $1`,
      [token.trim()]
    );

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'El enlace de recuperación no es válido o ya ha sido utilizado.' },
        { status: 400 }
      );
    }

    const row = tokenRes.rows[0];

    if (row.used) {
      return NextResponse.json(
        { error: 'Este enlace de recuperación ya ha sido utilizado anteriormente.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(row.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'El enlace de recuperación ha caducado. Por favor, solicita uno nuevo.' },
        { status: 400 }
      );
    }

    // Hash new password and update user record
    const hashedPassword = hashPassword(newPassword);

    await pool.query(
      'UPDATE auth.users SET encrypted_password = $1 WHERE id = $2',
      [hashedPassword, row.user_id]
    );

    // Mark token as used
    await pool.query(
      'UPDATE auth.password_reset_tokens SET used = true WHERE id = $1',
      [row.id]
    );

    return NextResponse.json({
      success: true,
      message: '¡Tu contraseña ha sido actualizada con éxito! Ya puedes iniciar sesión.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al restablecer la contraseña' },
      { status: 500 }
    );
  }
}
