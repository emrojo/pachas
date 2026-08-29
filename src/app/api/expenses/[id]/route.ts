import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { randomUUID } from 'crypto';

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
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
      ocrStatus,
      ocr_status = ocrStatus,
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

      // Auto-heal column if needed
      await client.query("ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'completed'");

      await client.query(
        `UPDATE public.expenses SET
           title = $1, amount = $2, currency = $3,
           category = $4, expense_date = $5,
           receipt_url = $6, notes = $7, split_type = $8,
           latitude = $9, longitude = $10, location_name = $11,
           ocr_status = COALESCE($12, ocr_status),
           updated_at = NOW()
         WHERE id = $13`,
        [
          title,
          amount,
          currency,
          category,
          expenseDate?.includes('T') ? expenseDate.split('T')[0] : expenseDate,
          receiptUrl,
          notes,
          splitType,
          latitude,
          longitude,
          locationName,
          ocr_status || null,
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

      // Save exchange rate into public.exchange_rates if foreign currency
      try {
        const expGroupRes = await client.query('SELECT group_id FROM public.expenses WHERE id = $1', [expenseId]);
        const gId = expGroupRes.rows[0]?.group_id;
        if (gId) {
          const groupRes = await client.query('SELECT base_currency FROM public.groups WHERE id = $1', [gId]);
          const baseCurrency = (groupRes.rows[0]?.base_currency || 'EUR').toUpperCase().trim();
          const expCurrency = (currency || baseCurrency).toUpperCase().trim();
          const cleanDate = expenseDate?.includes('T') ? expenseDate.split('T')[0] : expenseDate;

          if (expCurrency !== baseCurrency && exchangeRate && Number(exchangeRate) > 0 && cleanDate) {
            await client.query(`
              create table if not exists public.exchange_rates (
                id uuid primary key default uuid_generate_v4(),
                from_currency text not null,
                to_currency text not null,
                rate_date date not null,
                rate decimal(16, 6) not null check (rate > 0),
                provider text not null,
                is_estimated boolean default false not null,
                created_at timestamp with time zone default timezone('utc'::text, now()) not null,
                unique(from_currency, to_currency, rate_date)
              );
            `);

            await client.query(
              `INSERT INTO public.exchange_rates (
                 from_currency, to_currency, rate_date, rate, provider, is_estimated
               ) VALUES ($1, $2, $3, $4, $5, false)
               ON CONFLICT (from_currency, to_currency, rate_date)
               DO UPDATE SET rate = EXCLUDED.rate, provider = EXCLUDED.provider`,
              [expCurrency, baseCurrency, cleanDate, exchangeRate, 'ECB / Expense Recorded']
            );
          }
        }
      } catch (rateErr) {
        console.warn('Failed to upsert exchange rate in PUT /api/expenses/[id]:', rateErr);
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
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
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
