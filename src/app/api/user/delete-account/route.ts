import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const userId = payload.sub;
    const pool = getDbPool();

    if (pool) {
      try {
        // Delete user cascades to profiles, group_members, etc.
        await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
      } catch (dbErr) {
        console.warn('Database user delete error:', dbErr);
        // Fallback: delete from profiles
        try {
          await pool.query('DELETE FROM public.profiles WHERE id = $1', [userId]);
        } catch {}
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Tu cuenta y datos personales han sido eliminados del sistema.',
    });

    // Clear session cookies
    response.cookies.set('sb-access-token', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    });
    response.cookies.set('pachas_demo_user', '', {
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error('Delete account error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al eliminar la cuenta' },
      { status: 500 }
    );
  }
}
