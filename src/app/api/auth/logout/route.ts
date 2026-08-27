import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada con éxito' });

  // Clear auth cookies
  response.cookies.set('sb-access-token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('sb-refresh-token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}
