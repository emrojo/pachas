import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const excludeGroupId = searchParams.get('excludeGroupId');

    let query = `
      SELECT 
        p.id, 
        p.full_name, 
        p.email, 
        p.avatar_url, 
        p.bizum_phone, 
        COALESCE(p.is_banned, false) AS is_banned,
        p.ban_reason,
        COUNT(DISTINCT my_gm.group_id) AS shared_groups_count
      FROM public.group_members my_gm
      JOIN public.group_members other_gm ON other_gm.group_id = my_gm.group_id
      JOIN public.profiles p ON p.id::text = other_gm.user_id::text
      WHERE my_gm.user_id::text = $1
        AND other_gm.user_id::text != $1
    `;

    const queryParams: any[] = [user.userId];

    if (excludeGroupId) {
      query += `
        AND other_gm.user_id::text NOT IN (
          SELECT gm_ex.user_id::text 
          FROM public.group_members gm_ex 
          WHERE gm_ex.group_id::text = $2
        )
      `;
      queryParams.push(excludeGroupId);
    }

    query += `
      GROUP BY p.id, p.full_name, p.email, p.avatar_url, p.bizum_phone, p.is_banned, p.ban_reason
      ORDER BY p.full_name ASC
    `;

    const res = await pool.query(query, queryParams);

    const contacts = res.rows.map((row) => ({
      id: row.id,
      email: row.email || '',
      full_name: row.full_name || 'Amigo',
      avatar_url: row.avatar_url || null,
      bizum_phone: row.bizum_phone || null,
      is_banned: Boolean(row.is_banned),
      ban_reason: row.ban_reason || null,
      shared_groups_count: Number(row.shared_groups_count || 1),
    }));

    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (err: any) {
    console.error('Error fetching known contacts:', err);
    return NextResponse.json(
      { error: err.message || 'Error al obtener contactos conocidos' },
      { status: 500 }
    );
  }
}
