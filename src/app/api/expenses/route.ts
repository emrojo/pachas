import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { verifyJwt } from '@/lib/auth/jwt';
import { notifyGroupMembers } from '@/lib/notifications/webPush';
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
      amount = 0,
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
      ocrStatus = 'completed',
      ocr_status = ocrStatus,
      payers = [],
      participants = [],
    } = body;

    if (!groupId || !title || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Auto-heal ocr_status column outside transaction if database permissions allow
    try {
      await pool.query("ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'completed'");
    } catch {
      // Ignored if permissions are restricted
    }

    const cleanDate = expenseDate.includes('T') ? expenseDate.split('T')[0] : expenseDate;
    const safeExchangeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1.0;
    const rawAmount = Number(amount);
    const dbAmount = !isNaN(rawAmount) ? rawAmount : 0;
    const safeConvertedAmount =
      convertedAmount !== undefined && !isNaN(Number(convertedAmount))
        ? Number(convertedAmount)
        : Math.round(dbAmount * safeExchangeRate * 100) / 100;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert into public.expenses (supports converted_amount, exchange_rate, ocr_status)
      try {
        await client.query(
          `INSERT INTO public.expenses (
            id, group_id, created_by, title, amount, currency,
            exchange_rate, converted_amount,
            category, expense_date, receipt_url, notes,
            split_type, latitude, longitude, location_name, ocr_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
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
            ocr_status = EXCLUDED.ocr_status,
            updated_at = NOW()`,
          [
            id,
            groupId,
            payload.sub,
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
            ocr_status || 'completed',
          ]
        );
      } catch (insertErr: any) {
        if (insertErr.code === '42703' || String(insertErr.message).includes('ocr_status')) {
          try {
            // Fallback without ocr_status but preserving converted_amount & exchange_rate
            await client.query(
              `INSERT INTO public.expenses (
                id, group_id, created_by, title, amount, currency,
                exchange_rate, converted_amount,
                category, expense_date, receipt_url, notes,
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
              ]
            );
          } catch (secondErr: any) {
            if (secondErr.code === '42703') {
              // Minimal fallback without exchange_rate or converted_amount
              await client.query(
                `INSERT INTO public.expenses (
                  id, group_id, created_by, title, amount, currency,
                  category, expense_date, receipt_url, notes,
                  split_type, latitude, longitude, location_name, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET
                  title = EXCLUDED.title,
                  amount = EXCLUDED.amount,
                  currency = EXCLUDED.currency,
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
                ]
              );
            } else {
              throw secondErr;
            }
          }
        } else {
          throw insertErr;
        }
      }

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

      // 4. Save exchange rate into public.exchange_rates if foreign currency
      try {
        const groupRes = await client.query('SELECT base_currency FROM public.groups WHERE id = $1', [groupId]);
        const baseCurrency = (groupRes.rows[0]?.base_currency || 'EUR').toUpperCase().trim();
        const expCurrency = (currency || baseCurrency).toUpperCase().trim();
        const cleanDate = expenseDate.includes('T') ? expenseDate.split('T')[0] : expenseDate;

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
      } catch (rateErr) {
        console.warn('Failed to upsert exchange rate in POST /api/expenses:', rateErr);
      }

      await client.query('COMMIT');

      // 5. Trigger WebPush notification to subscribed group members in background
      notifyGroupMembers(groupId, payload.sub, {
        title: `Nuevo gasto: ${title}`,
        body: `${payload.full_name || 'Un amigo'} ha añadido un gasto de ${amount} ${currency}.`,
        url: `/groups/${groupId}`,
        tag: `expense-${id}`,
        data: { groupId, expenseId: id },
      }).catch(() => {});

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
    const expenses = res.rows.map((row: any) => ({
      ...row,
      amount: parseFloat(row.amount) || 0,
      exchange_rate: row.exchange_rate ? parseFloat(row.exchange_rate) : 1.0,
      converted_amount: row.converted_amount ? parseFloat(row.converted_amount) : (parseFloat(row.amount) || 0),
      latitude: row.latitude !== null && row.latitude !== undefined ? parseFloat(row.latitude) : null,
      longitude: row.longitude !== null && row.longitude !== undefined ? parseFloat(row.longitude) : null,
      creator: row.creator && row.creator.id ? row.creator : undefined,
      payers: (row.payers || []).map((p: any) => ({
        ...p,
        amount_paid: parseFloat(p.amount_paid) || 0,
        profile: p.profile && p.profile.id ? p.profile : undefined,
      })),
      participants: (row.participants || []).map((pt: any) => ({
        ...pt,
        amount_owed: parseFloat(pt.amount_owed) || 0,
        percentage: pt.percentage !== null && pt.percentage !== undefined ? parseFloat(pt.percentage) : null,
        shares: pt.shares !== null && pt.shares !== undefined ? parseFloat(pt.shares) : null,
        profile: pt.profile && pt.profile.id ? pt.profile : undefined,
      })),
    }));

    return NextResponse.json({ success: true, expenses });
  } catch (err: any) {
    console.error('API get expenses error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener gastos' }, { status: 500 });
  }
}

