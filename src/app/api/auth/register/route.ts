import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { hashPassword } from '@/lib/auth/password';
import { signJwt } from '@/lib/auth/jwt';
import { sanitizeText } from '@/lib/security/sanitize';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Introduce un correo electrónico válido' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'Introduce tu nombre completo' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = sanitizeText(fullName, 100);
    const cleanPhone = phone ? sanitizeText(phone, 25) : null;
    const pool = getDbPool();

    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // Check if user already exists
    const existingCheck = await pool.query('SELECT id FROM auth.users WHERE email = $1', [cleanEmail]);
    if (existingCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Ya existe una cuenta con este correo electrónico.' }, { status: 409 });
    }

    const userId = randomUUID();
    const hashedPassword = hashPassword(password);
    const role = cleanEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ? 'admin' : 'member';

    // Insert user into auth.users
    await pool.query(
      `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        cleanEmail,
        hashedPassword,
        JSON.stringify({ full_name: cleanName, bizum_phone: cleanPhone, role }),
      ]
    );

    // Insert or update public.profiles
    await pool.query(
      `INSERT INTO public.profiles (id, email, full_name, bizum_phone, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         bizum_phone = EXCLUDED.bizum_phone,
         role = EXCLUDED.role`,
      [userId, cleanEmail, cleanName, cleanPhone, role]
    );

    const userProfile = {
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      bizum_phone: cleanPhone,
      avatar_url: null,
      role,
      created_at: new Date().toISOString(),
    };

    // Issue signed session JWT
    const token = await signJwt({
      sub: userId,
      email: cleanEmail,
      role,
      full_name: cleanName,
    });


    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true, user: userProfile }, { status: 201 });

    // Set standard session cookie
    response.cookies.set('sb-access-token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('API register error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor al crear el usuario' },
      { status: 500 }
    );
  }
}
