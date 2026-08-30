import { NextRequest, NextResponse } from 'next/server';
import { signJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user } = body;

    if (!user || !user.id || !user.email) {
      return NextResponse.json({ error: 'Usuario no válido' }, { status: 400 });
    }

    const isAdmin = isServerAdmin(user.email, user.id, user.role);
    const effectiveRole = isAdmin ? 'admin' : (user.role || 'member');
    const enrichedUser = { ...user, role: effectiveRole };

    const token = await signJwt({
      sub: enrichedUser.id,
      email: enrichedUser.email,
      role: effectiveRole,
      full_name: enrichedUser.full_name || enrichedUser.email.split('@')[0],
    });

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');

    const response = NextResponse.json({ success: true, user: enrichedUser });

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
