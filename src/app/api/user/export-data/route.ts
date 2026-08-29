import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';

export async function GET(request: NextRequest) {
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

    let exportData: any = {
      export_date: new Date().toISOString(),
      user: {
        id: userId,
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
      },
      groups: [],
      created_expenses: [],
      expense_participations: [],
      settlements: [],
    };

    if (pool) {
      try {
        // User Profile
        const profRes = await pool.query('SELECT * FROM public.profiles WHERE id = $1', [userId]);
        if (profRes.rows.length > 0) {
          exportData.user = profRes.rows[0];
        }

        // Groups
        const grpRes = await pool.query(
          `SELECT g.*, gm.role as member_role, gm.joined_at
           FROM public.groups g
           JOIN public.group_members gm ON gm.group_id = g.id
           WHERE gm.user_id = $1`,
          [userId]
        );
        exportData.groups = grpRes.rows;

        // Created Expenses
        const expRes = await pool.query(
          `SELECT * FROM public.expenses WHERE created_by = $1`,
          [userId]
        );
        exportData.created_expenses = expRes.rows;

        // Participations
        const partRes = await pool.query(
          `SELECT * FROM public.expense_participants WHERE user_id = $1`,
          [userId]
        );
        exportData.expense_participations = partRes.rows;

        // Settlements
        const setRes = await pool.query(
          `SELECT * FROM public.settlements WHERE from_user_id = $1 OR to_user_id = $1`,
          [userId]
        );
        exportData.settlements = setRes.rows;
      } catch (dbErr) {
        console.warn('Database export query error:', dbErr);
      }
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="pachas-datos-personales-${userId.slice(0, 8)}.json"`,
      },
    });
  } catch (err: any) {
    console.error('Export data error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al exportar datos' },
      { status: 500 }
    );
  }
}
