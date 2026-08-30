import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isDemoModeAllowed } from '@/lib/authConfig';

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('sb-access-token')?.value;
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL)?.trim().toLowerCase();

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (payload.role === 'admin' || (adminEmail && payload.email?.toLowerCase() === adminEmail)) return true;
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query(`SELECT role, email FROM public.profiles WHERE id::text = $1::text`, [payload.sub]);
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (user.role === 'admin' || (adminEmail && user.email?.toLowerCase() === adminEmail)) return true;
          }
        } catch {}
      }
    }
  }

  if (isDemoModeAllowed()) {
    const demoCookie = request.cookies.get('pachas_demo_user')?.value;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(demoCookie));
        if (parsed.id === 'user-1' || parsed.email === 'ana@example.com' || parsed.role === 'admin') return true;
      } catch {}
    }
  }

  return false;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Acceso denegado. Se requiere ser Administrador.' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const body = await request.json();
    const { role } = body;

    if (!role || (role !== 'admin' && role !== 'member')) {
      return NextResponse.json({ error: 'Rol inválido (debe ser admin o member)' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ success: true, userId: targetUserId, role });
    }

    await pool.query(
      `UPDATE public.profiles
       SET role = $1
       WHERE id::text = $2::text`,
      [role, targetUserId]
    );

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      role,
      message: `Rol actualizado a ${role} con éxito.`,
    });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar rol' }, { status: 500 });
  }
}
