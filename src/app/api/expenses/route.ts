import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id = randomUUID(),
      groupId,
      title,
      amount,
      currency = 'EUR',
      exchangeRate = 1.0,
      convertedAmount = amount,
      category = 'other',
      expenseDate = new Date().toISOString().split('T')[0],
      receiptUrl = null,
      notes = null,
      splitType = 'EQUAL',
      latitude = null,
      longitude = null,
      locationName = null,
      payers = [],
      participants = [],
    } = body;

    if (!groupId || !title || !amount) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert into public.expenses
      await client.query(
        `INSERT INTO public.expenses (
          id, group_id, created_by, title, amount, currency, exchange_rate,
          converted_amount, category, expense_date, receipt_url, notes,
          split_type, latitude, longitude, location_name, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          exchange_rate = EXCLUDED.exchange_rate,
          converted_amount = EXCLUDED.converted_amount,
          category = EXCLUDED.category,
          expense_date = EXCLUDED.expense_date,
          receipt_url = EXCLUDED.receipt_url,
          notes = EXCLUDED.notes,
          split_type = EXCLUDED.split_type,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          location_name = EXCLUDED.location_name,
          updated_at = NOW()`,
        [
          id,
          groupId,
          payload.sub,
          title,
          amount,
          currency,
          exchangeRate,
          convertedAmount,
          category,
          expenseDate.includes('T') ? expenseDate.split('T')[0] : expenseDate,
          receiptUrl,
          notes,
          splitType,
          latitude,
          longitude,
          locationName,
        ]
      );

      // 2. Insert Payers
      await client.query('DELETE FROM public.expense_payers WHERE expense_id = $1', [id]);
      for (const p of payers) {
        const payerId = p.id && !p.id.startsWith('p-') ? p.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_payers (id, expense_id, user_id, amount_paid)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (expense_id, user_id) DO UPDATE SET amount_paid = EXCLUDED.amount_paid`,
          [payerId, id, p.userId || p.user_id, p.amountPaid || p.amount_paid]
        );
      }

      // 3. Insert Participants
      await client.query('DELETE FROM public.expense_participants WHERE expense_id = $1', [id]);
      for (const pt of participants) {
        const partId = pt.id && !pt.id.startsWith('part-') ? pt.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_participants (id, expense_id, user_id, amount_owed, percentage, shares)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (expense_id, user_id) DO UPDATE SET
             amount_owed = EXCLUDED.amount_owed,
             percentage = EXCLUDED.percentage,
             shares = EXCLUDED.shares`,
          [
            partId,
            id,
            pt.userId || pt.user_id,
            pt.amountOwed !== undefined ? pt.amountOwed : pt.amount_owed,
            pt.percentage || null,
            pt.shares || null,
          ]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        expense: {
          id,
          group_id: groupId,
          created_by: payload.sub,
          title,
          amount,
          currency,
          exchange_rate: exchangeRate,
          converted_amount: convertedAmount,
          category,
          expense_date: expenseDate,
          receipt_url: receiptUrl,
          notes,
          split_type: splitType,
          latitude,
          longitude,
          location_name: locationName,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('API create expense error:', err);
    return NextResponse.json(
      { error: err.message || 'Error al guardar el gasto en PostgreSQL' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    let query = `
      SELECT e.*,
             json_agg(DISTINCT jsonb_build_object(
               'id', ep.id,
               'expense_id', ep.expense_id,
               'user_id', ep.user_id,
               'amount_paid', ep.amount_paid,
               'profile', jsonb_build_object(
                 'id', pp.id,
                 'full_name', pp.full_name,
                 'avatar_url', pp.avatar_url,
                 'email', pp.email
               )
             )) FILTER (WHERE ep.id IS NOT NULL) as payers,
             json_agg(DISTINCT jsonb_build_object(
               'id', epart.id,
               'expense_id', epart.expense_id,
               'user_id', epart.user_id,
               'amount_owed', epart.amount_owed,
               'percentage', epart.percentage,
               'shares', epart.shares,
               'profile', jsonb_build_object(
                 'id', ppart.id,
                 'full_name', ppart.full_name,
                 'avatar_url', ppart.avatar_url,
                 'email', ppart.email
               )
             )) FILTER (WHERE epart.id IS NOT NULL) as participants,
             jsonb_build_object(
               'id', pcreator.id,
               'full_name', pcreator.full_name,
               'avatar_url', pcreator.avatar_url,
               'email', pcreator.email
             ) as creator
      FROM public.expenses e
      LEFT JOIN public.profiles pcreator ON pcreator.id = e.created_by
      LEFT JOIN public.expense_payers ep ON ep.expense_id = e.id
      LEFT JOIN public.profiles pp ON pp.id = ep.user_id
      LEFT JOIN public.expense_participants epart ON epart.expense_id = e.id
      LEFT JOIN public.profiles ppart ON ppart.id = epart.user_id
    `;

    const params: any[] = [];
    if (groupId) {
      query += ` WHERE e.group_id = $1`;
      params.push(groupId);
    }
    query += ` GROUP BY e.id, pcreator.id ORDER BY e.expense_date DESC, e.created_at DESC`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, expenses: res.rows });
  } catch (err: any) {
    console.error('API get expenses error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener gastos' }, { status: 500 });
  }
}
