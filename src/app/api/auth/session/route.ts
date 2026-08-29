import { NextRequest, NextResponse } from 'next/server';
import { signJwt } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user } = body;

    if (!user || !user.id || !user.email) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
    }

    const token = await signJwt({
      sub: user.id,
      email: user.email,
      role: user.role || 'member',
      full_name: user.full_name || user.email.split('@')[0],
    });

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const response = NextResponse.json({ success: true, user });

    response.cookies.set('sb-access-token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Session sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('sb-access-token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return response;
}
