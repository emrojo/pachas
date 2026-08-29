import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/postgres';
import { getCurrencyByCode } from '@/lib/currencies';
import { getCleanDate } from '@/lib/currencies/exchangeRateService';

interface RateRecord {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  provider: string;
  isEstimated?: boolean;
}

/**
 * Resolves exchange rate from external APIs if not in DB
 */
async function resolveExternalRate(
  from: string,
  to: string,
  dateStr: string
): Promise<RateRecord> {
  const cleanFrom = from.toUpperCase().trim();
  const cleanTo = to.toUpperCase().trim();
  const cleanDate = getCleanDate(dateStr);

  if (cleanFrom === cleanTo) {
    return {
      fromCurrency: cleanFrom,
      toCurrency: cleanTo,
      rate: 1.0,
      date: cleanDate,
      provider: 'Identity',
      isEstimated: false,
    };
  }

  // Ensure queryDate is not in the future for Frankfurter
  const todayStr = new Date().toISOString().split('T')[0];
  const isFuture = cleanDate > todayStr;
  const queryDate = isFuture ? 'latest' : cleanDate;

  // 1. Provider: Frankfurter API (ECB Official Historical Rates)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const url =
      queryDate === 'latest'
        ? `https://api.frankfurter.app/latest?from=${cleanFrom}&to=${cleanTo}`
        : `https://api.frankfurter.app/${queryDate}?from=${cleanFrom}&to=${cleanTo}`;

    let res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok && queryDate !== 'latest') {
      const fallbackUrl = `https://api.frankfurter.app/latest?from=${cleanFrom}&to=${cleanTo}`;
      res = await fetch(fallbackUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    }
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawRate = data.rates?.[cleanTo];
      if (typeof rawRate === 'number' && rawRate > 0) {
        const roundedRate = Math.round(rawRate * 10000) / 10000;
        return {
          fromCurrency: cleanFrom,
          toCurrency: cleanTo,
          rate: roundedRate,
          date: data.date || cleanDate,
          provider: 'ECB (Frankfurter)',
          isEstimated: false,
        };
      }
    }
  } catch {
    // Continue to next provider
  }

  // 2. Provider: Open Exchange Rates Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://open.er-api.com/v6/latest/${cleanFrom}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawRate = data.rates?.[cleanTo];
      if (typeof rawRate === 'number' && rawRate > 0) {
        const roundedRate = Math.round(rawRate * 10000) / 10000;
        return {
          fromCurrency: cleanFrom,
          toCurrency: cleanTo,
          rate: roundedRate,
          date: cleanDate,
          provider: 'Open Exchange Rates',
          isEstimated: false,
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // 3. Fallback Local Matrix
  const fromObj = getCurrencyByCode(cleanFrom);
  const toObj = getCurrencyByCode(cleanTo);
  const fallbackRate =
    fromObj.rateToEur > 0 && toObj.rateToEur > 0
      ? toObj.rateToEur / fromObj.rateToEur
      : 1.0;
  const roundedFallback = Math.round(fallbackRate * 10000) / 10000;

  return {
    fromCurrency: cleanFrom,
    toCurrency: cleanTo,
    rate: roundedFallback,
    date: cleanDate,
    provider: 'Fallback Local',
    isEstimated: true,
  };
}

/**
 * GET /api/exchange-rates?from=USD&to=EUR&date=2026-08-28
 * Retrieves exchange rate from central DB table, fetching and inserting if missing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get('from') || 'EUR').toUpperCase().trim();
  const to = (searchParams.get('to') || 'EUR').toUpperCase().trim();
  const rawDate = searchParams.get('date');
  const dateStr = getCleanDate(rawDate);

  if (from === to) {
    return NextResponse.json({
      success: true,
      data: {
        fromCurrency: from,
        toCurrency: to,
        rate: 1.0,
        date: dateStr,
        provider: 'Identity',
        isEstimated: false,
      },
    });
  }

  const pool = getDbPool();

  // 1. Try DB lookup first
  if (pool) {
    try {
      // Ensure table exists on the fly if needed
      await pool.query(`
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

      const res = await pool.query(
        `SELECT from_currency, to_currency, rate_date::text as date, rate, provider, is_estimated
         FROM public.exchange_rates
         WHERE from_currency = $1 AND to_currency = $2 AND rate_date = $3`,
        [from, to, dateStr]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        return NextResponse.json({
          success: true,
          data: {
            fromCurrency: row.from_currency,
            toCurrency: row.to_currency,
            rate: parseFloat(row.rate),
            date: row.date,
            provider: row.provider,
            isEstimated: row.is_estimated,
          },
          cached: true,
        });
      }
    } catch (err) {
      console.warn('DB lookup failed in exchange-rates:', err);
    }
  }

  // 2. Fetch from external provider
  const rateData = await resolveExternalRate(from, to, dateStr);

  // 3. Save to DB table for future global reuse across all groups and expenses
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO public.exchange_rates (
           from_currency, to_currency, rate_date, rate, provider, is_estimated
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (from_currency, to_currency, rate_date)
         DO UPDATE SET rate = EXCLUDED.rate, provider = EXCLUDED.provider, is_estimated = EXCLUDED.is_estimated`,
        [
          rateData.fromCurrency,
          rateData.toCurrency,
          rateData.date,
          rateData.rate,
          rateData.provider,
          rateData.isEstimated || false,
        ]
      );
    } catch (err) {
      console.warn('DB insert failed in exchange-rates:', err);
    }
  }

  return NextResponse.json({
    success: true,
    data: rateData,
    cached: false,
  });
}

/**
 * POST /api/exchange-rates
 * Bulk resolution and caching of multiple date/currency pairs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: Array<{ from: string; to: string; date: string }> = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const pool = getDbPool();
    if (pool) {
      try {
        await pool.query(`
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
      } catch {}
    }

    const results: RateRecord[] = [];

    for (const item of items) {
      const from = (item.from || 'EUR').toUpperCase().trim();
      const to = (item.to || 'EUR').toUpperCase().trim();
      const dateStr = getCleanDate(item.date);

      if (from === to) {
        results.push({
          fromCurrency: from,
          toCurrency: to,
          rate: 1.0,
          date: dateStr,
          provider: 'Identity',
          isEstimated: false,
        });
        continue;
      }

      let found = false;
      if (pool) {
        try {
          const res = await pool.query(
            `SELECT from_currency, to_currency, rate_date::text as date, rate, provider, is_estimated
             FROM public.exchange_rates
             WHERE from_currency = $1 AND to_currency = $2 AND rate_date = $3`,
            [from, to, dateStr]
          );
          if (res.rows.length > 0) {
            const row = res.rows[0];
            results.push({
              fromCurrency: row.from_currency,
              toCurrency: row.to_currency,
              rate: parseFloat(row.rate),
              date: row.date,
              provider: row.provider,
              isEstimated: row.is_estimated,
            });
            found = true;
          }
        } catch {}
      }

      if (!found) {
        const rateData = await resolveExternalRate(from, to, dateStr);
        results.push(rateData);

        if (pool) {
          try {
            await pool.query(
              `INSERT INTO public.exchange_rates (
                 from_currency, to_currency, rate_date, rate, provider, is_estimated
               ) VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (from_currency, to_currency, rate_date)
               DO UPDATE SET rate = EXCLUDED.rate, provider = EXCLUDED.provider, is_estimated = EXCLUDED.is_estimated`,
              [
                rateData.fromCurrency,
                rateData.toCurrency,
                rateData.date,
                rateData.rate,
                rateData.provider,
                rateData.isEstimated || false,
              ]
            );
          } catch {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error processing batch exchange rates' }, { status: 500 });
  }
}
