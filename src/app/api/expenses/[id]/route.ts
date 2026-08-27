import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const expenseId = params?.id;
    const body = await request.json();
    const {
      title,
      amount,
      currency,
      exchangeRate = 1.0,
      convertedAmount = amount,
      category,
      expenseDate,
      receiptUrl,
      notes,
      splitType,
      latitude,
      longitude,
      locationName,
      payers = [],
      participants = [],
    } = body;

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE public.expenses SET
           title = $1, amount = $2, currency = $3, exchange_rate = $4,
           converted_amount = $5, category = $6, expense_date = $7,
           receipt_url = $8, notes = $9, split_type = $10,
           latitude = $11, longitude = $12, location_name = $13,
           updated_at = NOW()
         WHERE id = $14`,
        [
          title,
          amount,
          currency,
          exchangeRate,
          convertedAmount,
          category,
          expenseDate?.includes('T') ? expenseDate.split('T')[0] : expenseDate,
          receiptUrl,
          notes,
          splitType,
          latitude,
          longitude,
          locationName,
          expenseId,
        ]
      );

      // Re-insert Payers
      await client.query('DELETE FROM public.expense_payers WHERE expense_id = $1', [expenseId]);
      for (const p of payers) {
        const payerId = p.id && !p.id.startsWith('p-') ? p.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_payers (id, expense_id, user_id, amount_paid)
           VALUES ($1, $2, $3, $4)`,
          [payerId, expenseId, p.userId || p.user_id, p.amountPaid || p.amount_paid]
        );
      }

      // Re-insert Participants
      await client.query('DELETE FROM public.expense_participants WHERE expense_id = $1', [expenseId]);
      for (const pt of participants) {
        const partId = pt.id && !pt.id.startsWith('part-') ? pt.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_participants (id, expense_id, user_id, amount_owed, percentage, shares)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            partId,
            expenseId,
            pt.userId || pt.user_id,
            pt.amountOwed !== undefined ? pt.amountOwed : pt.amount_owed,
            pt.percentage || null,
            pt.shares || null,
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, id: expenseId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('API update expense error:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar gasto' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
    }

    const expenseId = params?.id;
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    await pool.query('DELETE FROM public.expenses WHERE id = $1', [expenseId]);
    return NextResponse.json({ success: true, id: expenseId });
  } catch (err: any) {
    console.error('API delete expense error:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar gasto' }, { status: 500 });
  }
}
