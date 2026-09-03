import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ inviteCode: string }> }
) {
  try {
    const params = await props.params;
    const inviteCode = params?.inviteCode?.trim();
    if (!inviteCode) {
      return NextResponse.json({ error: 'Código de invitación no válido' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Base de datos no configurada. Verifica la variable DATABASE_URL.' },
        { status: 500 }
      );
    }

    // 1. Fetch group by invite code
    const groupRes = await pool.query(
      `SELECT id, name, description, icon_emoji, cover_image_url, base_currency, invite_code, is_archived, created_at
       FROM public.groups
       WHERE LOWER(invite_code) = LOWER($1)`,
      [inviteCode]
    );

    if (groupRes.rows.length === 0) {
      return NextResponse.json({ error: 'Grupo no encontrado con este código de invitación' }, { status: 404 });
    }

    const group = groupRes.rows[0];

    // 2. Fetch current members with their profile (LEFT JOIN prevents omitting members without profiles)
    const membersRes = await pool.query(
      `SELECT gm.id, gm.group_id, gm.user_id, gm.role, gm.joined_at,
              COALESCE(p.full_name, 'Amigo') as full_name,
              p.avatar_url, p.bizum_phone, p.email
       FROM public.group_members gm
       LEFT JOIN public.profiles p ON p.id::text = gm.user_id::text
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
        email: m.email || '',
        full_name: m.full_name,
        avatar_url: m.avatar_url || null,
        bizum_phone: m.bizum_phone || null,
        role: m.role,
      },
    }));

    return NextResponse.json({
      success: true,
      group,
      members,
    });
  } catch (err: any) {
    console.error('Error fetching group invite:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener la información del grupo' },
      { status: 500 }
    );
  }
}
