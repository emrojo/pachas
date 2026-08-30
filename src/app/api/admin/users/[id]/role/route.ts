import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { getDbPool } from '@/lib/db/postgres';
import { isServerAdmin } from '@/lib/auth/adminAuth';

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;
  const token = bearerToken || request.cookies.get('sb-access-token')?.value;

  if (token) {
    const payload = await verifyJwt(token);
    if (payload?.sub) {
      if (isServerAdmin(payload.email, payload.sub, payload.role)) return true;
      const pool = getDbPool();
      if (pool) {
        try {
          const uRes = await pool.query(`SELECT role, email FROM public.profiles WHERE id::text = $1::text`, [payload.sub]);
          if (uRes.rows.length > 0) {
            const user = uRes.rows[0];
            if (isServerAdmin(user.email, payload.sub, user.role)) return true;
          }
        } catch {}
      }
    }
  }

  const demoCookie = request.cookies.get('pachas_demo_user')?.value;
  if (demoCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(demoCookie));
      if (isServerAdmin(parsed.email, parsed.id, parsed.role)) return true;
    } catch {}
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
