import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { randomUUID } from 'crypto';
import { notifyGroupMembers } from '@/lib/notifications/webPush';

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

    // Check if group is frozen
    try {
      const grpRes = await pool.query(
        'SELECT g.is_frozen FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = $1',
        [expenseId]
      );
      if (grpRes.rows.length > 0 && grpRes.rows[0].is_frozen) {
        const isAdmin = isServerAdmin(payload.email, payload.sub, payload.role);
        if (!isAdmin) {
          return NextResponse.json(
            { error: 'El grupo se encuentra temporalmente congelado por moderación. No se pueden modificar gastos.' },
            { status: 403 }
          );
        }
      }
    } catch {}

    // Auto-heal column outside transaction if database permissions allow
    try {
      await pool.query("ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'completed'");
    } catch {
      // Ignored if permissions are restricted
    }

    const safeExchangeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1.0;
    const rawAmount = Number(amount);
    const dbAmount = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 0.01;
    const safeConvertedAmount =
      convertedAmount !== undefined && !isNaN(Number(convertedAmount)) && Number(convertedAmount) > 0
        ? Number(convertedAmount)
        : Math.round(dbAmount * safeExchangeRate * 100) / 100;
    const cleanDate = expenseDate || new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      try {
        await client.query(
          `UPDATE public.expenses SET
             title = $1, amount = $2, currency = $3,
             exchange_rate = $4, converted_amount = $5,
             category = $6, expense_date = $7,
             receipt_url = $8, notes = $9, split_type = $10,
             latitude = $11, longitude = $12, location_name = $13,
             ocr_status = COALESCE($14, ocr_status),
             updated_at = NOW()
           WHERE id = $15`,
          [
            title,
            dbAmount,
            currency,
            safeExchangeRate,
            safeConvertedAmount,
            category,
            cleanDate,
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
      } catch (updateErr: any) {
        if (updateErr.code === '42703' || String(updateErr.message).includes('ocr_status')) {
          try {
            await client.query(
              `UPDATE public.expenses SET
                 title = $1, amount = $2, currency = $3,
                 exchange_rate = $4, converted_amount = $5,
                 category = $6, expense_date = $7,
                 receipt_url = $8, notes = $9, split_type = $10,
                 latitude = $11, longitude = $12, location_name = $13,
                 updated_at = NOW()
               WHERE id = $14`,
              [
                title,
                dbAmount,
                currency,
                safeExchangeRate,
                safeConvertedAmount,
                category,
                cleanDate,
                receiptUrl,
                notes,
                splitType,
                latitude,
                longitude,
                locationName,
                expenseId,
              ]
            );
          } catch (thirdErr: any) {
            if (thirdErr.code === '42703') {
              await client.query(
                `UPDATE public.expenses SET
                   title = $1, amount = $2, currency = $3,
                   category = $4, expense_date = $5,
                   receipt_url = $6, notes = $7, split_type = $8,
                   latitude = $9, longitude = $10, location_name = $11,
                   updated_at = NOW()
                 WHERE id = $12`,
                [
                  title,
                  dbAmount,
                  currency,
                  category,
                  cleanDate,
                  receiptUrl,
                  notes,
                  splitType,
                  latitude,
                  longitude,
                  locationName,
                  expenseId,
                ]
              );
            } else {
              throw thirdErr;
            }
          }
        } else {
          throw updateErr;
        }
      }

      // Re-insert Payers
      await client.query('DELETE FROM public.expense_payers WHERE expense_id = $1', [expenseId]);
      for (const p of payers) {
        const payerId = p.id && !p.id.startsWith('p-') ? p.id : randomUUID();
        const pAmt = Number(p.amountPaid !== undefined ? p.amountPaid : p.amount_paid);
        const dbPAmt = !isNaN(pAmt) && pAmt > 0 ? pAmt : 0.01;
        await client.query(
          `INSERT INTO public.expense_payers (id, expense_id, user_id, amount_paid)
           VALUES ($1, $2, $3, $4)`,
          [payerId, expenseId, p.userId || p.user_id, dbPAmt]
        );
      }

      // Re-insert Participants
      await client.query('DELETE FROM public.expense_participants WHERE expense_id = $1', [expenseId]);
      for (const pt of participants) {
        const partId = pt.id && !pt.id.startsWith('part-') ? pt.id : randomUUID();
        const ptAmt = Number(pt.amountOwed !== undefined ? pt.amountOwed : pt.amount_owed);
        const dbPtAmt = !isNaN(ptAmt) && ptAmt > 0 ? ptAmt : 0.01;
        await client.query(
          `INSERT INTO public.expense_participants (id, expense_id, user_id, amount_owed, percentage, shares)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            partId,
            expenseId,
            pt.userId || pt.user_id,
            dbPtAmt,
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

      // Dispatch push notification to group members
      try {
        const pool = getDbPool();
        if (pool) {
          const groupRes = await pool.query(
            `SELECT e.group_id, g.name as group_name, p.full_name as editor_name
             FROM public.expenses e
             JOIN public.groups g ON g.id = e.group_id
             LEFT JOIN public.profiles p ON p.id = $2
             WHERE e.id = $1`,
            [expenseId, payload.sub]
          );
          if (groupRes.rows.length > 0) {
            const g = groupRes.rows[0];
            const editor = g.editor_name || payload.full_name || 'Un amigo';
            const formattedAmt = typeof dbAmount === 'number' ? dbAmount.toFixed(2).replace('.', ',') : String(dbAmount);
            const isOcrFinished = body.ocr_status === 'completed' && title !== 'Analizando ticket con IA...';

            if (isOcrFinished) {
              notifyGroupMembers(g.group_id, payload.sub, {
                title: `✨ Factura procesada en ${g.group_name}`,
                body: `Se reconoció "${title}" por ${formattedAmt} ${currency || 'EUR'}`,
                url: `/groups/${g.group_id}`,
              }).catch((pushErr) => console.warn('Push notification for ocr completion failed:', pushErr));
            } else {
              notifyGroupMembers(g.group_id, payload.sub, {
                title: `✏️ Gasto modificado en ${g.group_name}`,
                body: `${editor} modificó "${title}" (${formattedAmt} ${currency || 'EUR'})`,
                url: `/groups/${g.group_id}`,
              }).catch((pushErr) => console.warn('Push notification for expense update failed:', pushErr));
            }
          }
        }
      } catch (notifErr) {
        console.warn('Could not dispatch expense update notification:', notifErr);
      }

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

    // Check if group is frozen
    try {
      const grpRes = await pool.query(
        'SELECT g.is_frozen FROM public.expenses e JOIN public.groups g ON g.id = e.group_id WHERE e.id = $1',
        [expenseId]
      );
      if (grpRes.rows.length > 0 && grpRes.rows[0].is_frozen) {
        const isAdmin = isServerAdmin(payload.email, payload.sub, payload.role);
        if (!isAdmin) {
          return NextResponse.json(
            { error: 'El grupo se encuentra temporalmente congelado por moderación. Solo el administrador puede eliminar gastos.' },
            { status: 403 }
          );
        }
      }
    } catch {}

    // Query expense info before deletion to notify group
    let deletedExpenseInfo: { title: string; amount: string; currency: string; group_id: string; group_name: string; deleter_name: string } | null = null;
    try {
      const expRes = await pool.query(
        `SELECT e.title, e.amount, e.currency, e.group_id, g.name as group_name, p.full_name as deleter_name
         FROM public.expenses e
         JOIN public.groups g ON g.id = e.group_id
         LEFT JOIN public.profiles p ON p.id = $2
         WHERE e.id = $1`,
        [expenseId, payload.sub]
      );
      if (expRes.rows.length > 0) {
        const row = expRes.rows[0];
        const numAmt = Number(row.amount) || 0;
        deletedExpenseInfo = {
          title: row.title,
          amount: numAmt.toFixed(2).replace('.', ','),
          currency: row.currency || 'EUR',
          group_id: row.group_id,
          group_name: row.group_name,
          deleter_name: row.deleter_name || payload.full_name || 'Un amigo',
        };
      }
    } catch (infoErr) {
      console.warn('Could not query expense info before deletion:', infoErr);
    }

    await pool.query('DELETE FROM public.expenses WHERE id = $1', [expenseId]);

    // Dispatch push notification to group members
    if (deletedExpenseInfo) {
      try {
        notifyGroupMembers(deletedExpenseInfo.group_id, payload.sub, {
          title: `🗑️ Gasto eliminado en ${deletedExpenseInfo.group_name}`,
          body: `${deletedExpenseInfo.deleter_name} eliminó "${deletedExpenseInfo.title}" (${deletedExpenseInfo.amount} ${deletedExpenseInfo.currency})`,
          url: `/groups/${deletedExpenseInfo.group_id}`,
        }).catch((pushErr) => console.warn('Push notification for expense deletion failed:', pushErr));
      } catch (notifErr) {
        console.warn('Could not dispatch delete notification:', notifErr);
      }
    }

    return NextResponse.json({ success: true, id: expenseId });
  } catch (err: any) {
    console.error('API delete expense error:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar gasto' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const expenseId = params?.id;
    if (!expenseId) {
      return NextResponse.json({ error: 'ID de gasto no proporcionado' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    const expRes = await pool.query(
      `SELECT e.*, p.full_name as created_by_name
       FROM public.expenses e
       LEFT JOIN public.profiles p ON p.id = e.created_by
       WHERE e.id::text = $1`,
      [expenseId]
    );

    if (expRes.rows.length === 0) {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    const expense = expRes.rows[0];

    // Fetch payers
    const payersRes = await pool.query(
      'SELECT * FROM public.expense_payers WHERE expense_id::text = $1',
      [expenseId]
    );

    // Fetch splits
    const splitsRes = await pool.query(
      'SELECT * FROM public.expense_splits WHERE expense_id::text = $1',
      [expenseId]
    );

    return NextResponse.json({
      expense: {
        ...expense,
        amount: Number(expense.amount),
        converted_amount: Number(expense.converted_amount || expense.amount),
        exchange_rate: Number(expense.exchange_rate || 1),
        latitude: expense.latitude ? Number(expense.latitude) : null,
        longitude: expense.longitude ? Number(expense.longitude) : null,
        payers: payersRes.rows.map((p) => ({
          ...p,
          amount_paid: Number(p.amount_paid),
        })),
        splits: splitsRes.rows.map((s) => ({
          ...s,
          amount_owed: Number(s.amount_owed),
        })),
      },
    });
  } catch (err: any) {
    console.error('API get single expense error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener gasto' }, { status: 500 });
  }
}

