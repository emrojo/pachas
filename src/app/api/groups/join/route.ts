import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Debes iniciar sesión para unirte a un grupo.' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({ error: 'Código de invitación requerido.' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // 1. Find group
    const groupRes = await pool.query(
      `SELECT * FROM public.groups WHERE LOWER(invite_code) = LOWER($1)`,
      [inviteCode.trim()]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado con este código de invitación.' }, { status: 404 });
    }

    const group = groupRes.rows[0];

    if (group.is_archived) {
      return NextResponse.json(
        { error: 'Este grupo ha sido archivado y no admite nuevos miembros.' },
        { status: 400 }
      );
    }

    // 2. Insert member into group_members if not already joined
    const memberId = randomUUID();
    await pool.query(
      `INSERT INTO public.group_members (id, group_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, 'member', NOW())
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [memberId, group.id, payload.sub]
    );

    // 3. Fetch all members with their profile
    const membersRes = await pool.query(
      `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
              p.full_name, p.avatar_url, p.bizum_phone, p.email
       FROM public.group_members gm
       JOIN public.profiles p ON p.id = gm.user_id
       WHERE gm.group_id = $1`,
      [group.id]
    );

    const members = membersRes.rows.map((m) => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      role: m.role,
      joined_at: m.joined_at,
      profile: {
        id: m.user_id,
        email: m.email,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        bizum_phone: m.bizum_phone,
        role: m.role,
      },
    }));

    return NextResponse.json({
      success: true,
      group,
      members,
    });
  } catch (err: any) {
    console.error('Error joining group:', err);
    return NextResponse.json(
      { error: err.message || 'Error al unirse al grupo' },
      { status: 500 }
    );
  }
}
