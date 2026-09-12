import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { requireActiveUser } from '@/lib/auth/userAuth';
import { notifyGroupMembers } from '@/lib/notifications/webPush';
import { isServerAdmin } from '@/lib/auth/adminAuth';
import { realtimeHub } from '@/lib/realtime/sse';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const user = authResult.user!;

    const body = await request.json();
    const rawGroupId = body.groupId || body.group_id;
    const cleanGroupId = typeof rawGroupId === 'string' ? rawGroupId.trim() : rawGroupId;
    const groupId = cleanGroupId;

    const {
      id = randomUUID(),
      title,
      amount = 0,
      currency = 'EUR',
      exchangeRate = 1.0,
      convertedAmount = amount,
      category = 'other',
      expenseDate = new Date().toISOString().split('T')[0],
      receiptUrl = null,
      receipt_url = receiptUrl,
      receiptTranslatedUrl = null,
      receipt_translated_url = receiptTranslatedUrl,
      notes = null,
      splitType = 'EQUAL',
      latitude = null,
      longitude = null,
      locationName = null,
      ocrStatus = 'completed',
      ocr_status = ocrStatus,
      payers = [],
      participants = [],
      items = [],
    } = body;
    const finalReceiptUrl = receipt_url || receiptUrl || null;
    const finalReceiptTranslatedUrl = receipt_translated_url || receiptTranslatedUrl || null;

    if (!cleanGroupId || !title || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 500 });
    }

    // Check if target group exists and whether it is frozen
    try {
      const grpCheck = await pool.query('SELECT id, is_frozen FROM public.groups WHERE id = $1', [cleanGroupId]);
      if (grpCheck.rows.length === 0) {
        return NextResponse.json(
          { error: `El grupo indicado no existe en la base de datos. Si acabas de resetear la base de datos, por favor crea un nuevo grupo en la aplicación.` },
          { status: 404 }
        );
      }
      if (grpCheck.rows[0].is_frozen && !user.isAdmin) {
        return NextResponse.json(
          { error: 'El grupo se encuentra temporalmente congelado por moderación. No se pueden añadir nuevos gastos.' },
          { status: 403 }
        );
      }
    } catch (grpErr: any) {
      if (grpErr.status === 404 || grpErr.status === 403) throw grpErr;
    }

    // Auto-heal ocr_status column and upgrade expense_date to timestamptz outside transaction if database permissions allow
    try {
      await pool.query("ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'completed'");
    } catch {
      // Ignored if permissions are restricted
    }
    try {
      await pool.query("ALTER TABLE public.expenses ALTER COLUMN expense_date TYPE timestamp with time zone USING expense_date::timestamp with time zone");
    } catch {
      // Ignored if permissions are restricted or already migrated
    }

    const cleanDate = expenseDate || new Date().toISOString();
    const safeExchangeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 1.0;
    const rawAmount = Number(amount);
    // If amount is 0 (OCR processing placeholder), use 0.01 for PostgreSQL check (amount > 0) constraint
    const dbAmount = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 0.01;
    const safeConvertedAmount =
      convertedAmount !== undefined && !isNaN(Number(convertedAmount)) && Number(convertedAmount) > 0
        ? Number(convertedAmount)
        : Math.round(dbAmount * safeExchangeRate * 100) / 100;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure creator profile exists in public.profiles to satisfy created_by foreign key.
      // Uses a SAVEPOINT so that if the INSERT fails (e.g. FK violation to auth.users),
      // the outer transaction is NOT left in an aborted state.
      await client.query('SAVEPOINT ensure_profile');
      try {
        await client.query(
          `INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
          [user.userId, user.email || `${user.userId}@pachas.local`, user.email?.split('@')[0] || 'Usuario', user.role || 'member']
        );
        await client.query('RELEASE SAVEPOINT ensure_profile');
      } catch (profErr) {
        console.warn('Profile ensure non-fatal warning in /api/expenses:', profErr);
        await client.query('ROLLBACK TO SAVEPOINT ensure_profile');
      }

      // 1. Insert or update expense
      const insertQuery = `
        INSERT INTO public.expenses (
          id, group_id, created_by, title, amount, currency,
          exchange_rate, converted_amount, category, expense_date,
          receipt_url, receipt_translated_url, notes, split_type, latitude, longitude,
          location_name, ocr_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          exchange_rate = EXCLUDED.exchange_rate,
          converted_amount = EXCLUDED.converted_amount,
          category = EXCLUDED.category,
          expense_date = EXCLUDED.expense_date,
          receipt_url = EXCLUDED.receipt_url,
          receipt_translated_url = EXCLUDED.receipt_translated_url,
          notes = EXCLUDED.notes,
          split_type = EXCLUDED.split_type,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          location_name = EXCLUDED.location_name,
          ocr_status = EXCLUDED.ocr_status,
          updated_at = NOW()
        RETURNING *;
      `;

      // Insert expense — uses SAVEPOINT so that if the primary INSERT fails due to a
      // missing column, the transaction is rolled back to a clean state and fallback query runs.
      await client.query('SAVEPOINT insert_expense');
      try {
        await client.query(insertQuery, [
          id,
          groupId,
          user.userId,
          title,
          dbAmount,
          currency,
          safeExchangeRate,
          safeConvertedAmount,
          category,
          cleanDate,
          finalReceiptUrl,
          finalReceiptTranslatedUrl,
          notes,
          splitType,
          latitude,
          longitude,
          locationName,
          ocr_status || 'completed',
        ]);
        await client.query('RELEASE SAVEPOINT insert_expense');
      } catch (insertErr: any) {
        await client.query('ROLLBACK TO SAVEPOINT insert_expense');
        // Fallback: insert without receipt_translated_url / ocr_status if older schema
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
            user.userId,
            title,
            dbAmount,
            currency,
            category,
            cleanDate,
            finalReceiptUrl,
            notes,
            splitType,
            latitude,
            longitude,
            locationName,
          ]
        );
      }

      // 2. Clear and insert payers
      await client.query('DELETE FROM public.expense_payers WHERE expense_id = $1', [id]);
      for (const payer of payers) {
        const payerId = payer.id && !payer.id.startsWith('payer-') ? payer.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_payers (id, expense_id, user_id, amount_paid)
           VALUES ($1, $2, $3, $4)`,
          [payerId, id, payer.user_id, payer.amount_paid]
        );
      }

      // 3. Clear and insert participants
      await client.query('DELETE FROM public.expense_participants WHERE expense_id = $1', [id]);
      for (const part of participants) {
        const partId = part.id && !part.id.startsWith('part-') ? part.id : randomUUID();
        await client.query(
          `INSERT INTO public.expense_participants (id, expense_id, user_id, amount_owed, percentage, shares, has_paid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            partId,
            id,
            part.user_id,
            part.amount_owed,
            part.percentage !== undefined ? part.percentage : null,
            part.shares !== undefined ? part.shares : null,
            Boolean(part.has_paid || part.hasPaid),
          ]
        );
      }

      // 3b. Clear and insert expense line items if present
      await client.query('SAVEPOINT save_expense_items');
      try {
        await client.query('DELETE FROM public.expense_items WHERE expense_id = $1', [id]);
        if (Array.isArray(items) && items.length > 0) {
          for (const it of items) {
            const itemId = it.id && !it.id.startsWith('item-') ? it.id : randomUUID();
            const desc = (it.description || 'Producto').trim();
            const descOrig = it.description_original ? String(it.description_original).trim() : null;
            const itemPrice = Math.max(0, Number(it.price) || 0);
            const assigned = Array.isArray(it.assigned_user_ids) ? it.assigned_user_ids : [];
            await client.query(
              `INSERT INTO public.expense_items (id, expense_id, description, description_original, price, assigned_user_ids)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [itemId, id, desc, descOrig, itemPrice, assigned]
            ).catch(async () => {
              await client.query(
                `INSERT INTO public.expense_items (id, expense_id, description, price, assigned_user_ids)
                 VALUES ($1, $2, $3, $4, $5)`,
                [itemId, id, desc, itemPrice, assigned]
              );
            });
          }
        }
        await client.query('RELEASE SAVEPOINT save_expense_items');
      } catch (itemsErr) {
        console.warn('Expense items non-fatal insert error:', itemsErr);
        await client.query('ROLLBACK TO SAVEPOINT save_expense_items');
      }

      // 4. Record/Upsert the exchange rate in `exchange_rates` if different from base currency.
      // Uses SAVEPOINT so a DDL/DML failure (e.g. permissions, table lock) does NOT abort
      // the expense COMMIT — saving exchange rates is best-effort.
      await client.query('SAVEPOINT exchange_rate');
      try {
        const grpRes = await client.query('SELECT base_currency FROM public.groups WHERE id = $1', [groupId]);
        const baseCurrency = grpRes.rows[0]?.base_currency || 'EUR';
        const expCurrency = (currency || 'EUR').toUpperCase();

        if (expCurrency !== baseCurrency && exchangeRate && exchangeRate > 0) {
          const cleanDate = (expenseDate || new Date().toISOString()).split('T')[0];
          await client.query(`
            CREATE TABLE IF NOT EXISTS public.exchange_rates (
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
        await client.query('RELEASE SAVEPOINT exchange_rate');
      } catch (rateErr) {
        console.warn('Failed to upsert exchange rate in POST /api/expenses:', rateErr);
        await client.query('ROLLBACK TO SAVEPOINT exchange_rate');
      }

      await client.query('COMMIT');

      // 5. Trigger WebPush notification to subscribed group members in background
      notifyGroupMembers(groupId, user.userId, {
        title: `Nuevo gasto: ${title}`,
        body: `${user.email?.split('@')[0] || 'Un amigo'} ha añadido un gasto de ${amount} ${currency}.`,
        url: `/groups/${groupId}`,
        tag: `expense-${id}`,
        data: { groupId, expenseId: id },
      }).catch(() => {});

      // 6. Fetch fully populated expense with profiles
      const fullExpRes = await pool.query(
        `SELECT e.*,
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
                  'has_paid', COALESCE(epart.has_paid, false),
                  'profile', jsonb_build_object(
                    'id', ppart.id,
                    'full_name', ppart.full_name,
                    'avatar_url', ppart.avatar_url,
                    'email', ppart.email
                  )
                )) FILTER (WHERE epart.id IS NOT NULL) as participants,
                json_agg(DISTINCT jsonb_build_object(
                  'id', ei.id,
                  'expense_id', ei.expense_id,
                  'description', ei.description,
                  'description_original', ei.description_original,
                  'price', ei.price,
                  'assigned_user_ids', ei.assigned_user_ids
                )) FILTER (WHERE ei.id IS NOT NULL) as items,
                jsonb_build_object(
                  'id', pcreator.id,
                  'full_name', pcreator.full_name,
                  'avatar_url', pcreator.avatar_url,
                  'email', pcreator.email
                ) as creator
         FROM public.expenses e
         LEFT JOIN public.profiles pcreator ON pcreator.id::text = e.created_by::text
         LEFT JOIN public.expense_payers ep ON ep.expense_id::text = e.id::text
         LEFT JOIN public.profiles pp ON pp.id::text = ep.user_id::text
         LEFT JOIN public.expense_participants epart ON epart.expense_id::text = e.id::text
         LEFT JOIN public.profiles ppart ON ppart.id::text = epart.user_id::text
         LEFT JOIN public.expense_items ei ON ei.expense_id::text = e.id::text
         WHERE e.id::text = $1
         GROUP BY e.id, pcreator.id`,
        [id]
      );

      let createdExpense: any;
      if (fullExpRes.rows.length > 0) {
        const row = fullExpRes.rows[0];
        createdExpense = {
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
            has_paid: Boolean(pt.has_paid),
            profile: pt.profile && pt.profile.id ? pt.profile : undefined,
          })),
          items: (row.items || []).map((it: any) => ({
            ...it,
            price: parseFloat(it.price) || 0,
          })),
        };
      } else {
        createdExpense = {
          id,
          group_id: groupId,
          created_by: user.userId,
          title,
          amount,
          currency,
          exchange_rate: exchangeRate,
          converted_amount: convertedAmount,
          category,
          expense_date: cleanDate,
          receipt_url: receiptUrl,
          notes,
          split_type: splitType,
          items: items || [],
          latitude,
          longitude,
          location_name: locationName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          payers,
          participants,
        };
      }

      // 7. Broadcast real-time expense creation to all connected clients
      realtimeHub.broadcast({
        type: 'expense_created',
        groupId,
        userId: user.userId,
        payload: createdExpense,
      });

      return NextResponse.json({
        success: true,
        expense: createdExpense,
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
    const authResult = await requireActiveUser(request);
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

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
               'has_paid', COALESCE(epart.has_paid, false),
               'profile', jsonb_build_object(
                 'id', ppart.id,
                 'full_name', ppart.full_name,
                 'avatar_url', ppart.avatar_url,
                 'email', ppart.email
               )
             )) FILTER (WHERE epart.id IS NOT NULL) as participants,
             json_agg(DISTINCT jsonb_build_object(
               'id', ei.id,
               'expense_id', ei.expense_id,
               'description', ei.description,
               'description_original', ei.description_original,
               'price', ei.price,
               'assigned_user_ids', ei.assigned_user_ids
             )) FILTER (WHERE ei.id IS NOT NULL) as items,
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
      LEFT JOIN public.expense_items ei ON ei.expense_id = e.id
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
        has_paid: Boolean(pt.has_paid),
        profile: pt.profile && pt.profile.id ? pt.profile : undefined,
      })),
      items: (row.items || []).map((it: any) => ({
        ...it,
        price: parseFloat(it.price) || 0,
      })),
    }));

    return NextResponse.json({ success: true, expenses });
  } catch (err: any) {
    console.error('API get expenses error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener gastos' }, { status: 500 });
  }
}

