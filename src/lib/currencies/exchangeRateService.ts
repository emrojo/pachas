import { Expense, ExpenseParticipant, ExpensePayer } from '@/types/database';
import { getCurrencyByCode } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';

export interface ExchangeRateResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  date: string;
  provider: 'ECB (Frankfurter)' | 'Open Exchange Rates' | 'Fallback Local' | 'Identity';
  isEstimated?: boolean;
}

// Memory cache to prevent duplicate HTTP requests in the same session
const memoryRateCache: Record<string, ExchangeRateResult> = {};

/**
 * Extracts a clean YYYY-MM-DD string from a date object, ISO string, or dateTime string.
 */
export function getCleanDate(dateOrISO?: string | Date | null): string {
  if (!dateOrISO) {
    return new Date().toISOString().split('T')[0];
  }
  if (typeof dateOrISO === 'string') {
    // If it contains a 'T' or space, take the first portion
    const datePart = dateOrISO.split('T')[0].split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  try {
    const d = new Date(dateOrISO);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Fetches the official or reliable historical exchange rate for a given currency pair on a specific date.
 */
export async function getHistoricalExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  dateOrISO?: string | Date | null
): Promise<ExchangeRateResult> {
  const from = (fromCurrency || 'EUR').toUpperCase().trim();
  const to = (toCurrency || 'EUR').toUpperCase().trim();
  const dateStr = getCleanDate(dateOrISO);

  // 1. Identity check
  if (from === to) {
    return {
      fromCurrency: from,
      toCurrency: to,
      rate: 1.0,
      date: dateStr,
      provider: 'Identity',
    };
  }

  // 2. Cache check
  const cacheKey = `pachas_rate_${from}_${to}_${dateStr}`;
  if (memoryRateCache[cacheKey]) {
    return memoryRateCache[cacheKey];
  }

  if (typeof window !== 'undefined') {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr) as ExchangeRateResult;
        if (parsed && typeof parsed.rate === 'number' && parsed.rate > 0) {
          memoryRateCache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  // Ensure date is not in the future (use latest if future)
  const todayStr = new Date().toISOString().split('T')[0];
  const isFuture = dateStr > todayStr;
  const queryDate = isFuture ? 'latest' : dateStr;

  // 3. Provider 1: Frankfurter API (European Central Bank - ECB Official Rates)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url =
      queryDate === 'latest'
        ? `https://api.frankfurter.app/latest?from=${from}&to=${to}`
        : `https://api.frankfurter.app/${queryDate}?from=${from}&to=${to}`;

    let res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    // If date returned 404 (e.g. recent weekend or unreleased fix), fallback to latest
    if (!res.ok && queryDate !== 'latest') {
      const fallbackUrl = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
      res = await fetch(fallbackUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    }
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawRate = data.rates?.[to];
      if (typeof rawRate === 'number' && rawRate > 0) {
        const roundedRate = Math.round(rawRate * 10000) / 10000;
        const result: ExchangeRateResult = {
          fromCurrency: from,
          toCurrency: to,
          rate: roundedRate,
          date: data.date || dateStr,
          provider: 'ECB (Frankfurter)',
        };
        saveToCache(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    // Continue to next provider
  }

  // 4. Provider 2: Open Exchange Rates Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawRate = data.rates?.[to];
      if (typeof rawRate === 'number' && rawRate > 0) {
        const roundedRate = Math.round(rawRate * 10000) / 10000;
        const result: ExchangeRateResult = {
          fromCurrency: from,
          toCurrency: to,
          rate: roundedRate,
          date: dateStr,
          provider: 'Open Exchange Rates',
        };
        saveToCache(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 5. Provider 3: Static Local Fallback Matrix
  const fromObj = getCurrencyByCode(from);
  const toObj = getCurrencyByCode(to);
  const fallbackRate =
    fromObj.rateToEur > 0 && toObj.rateToEur > 0
      ? toObj.rateToEur / fromObj.rateToEur
      : 1.0;
  const roundedFallback = Math.round(fallbackRate * 10000) / 10000;

  const fallbackResult: ExchangeRateResult = {
    fromCurrency: from,
    toCurrency: to,
    rate: roundedFallback,
    date: dateStr,
    provider: 'Fallback Local',
    isEstimated: true,
  };

  saveToCache(cacheKey, fallbackResult);
  return fallbackResult;
}

function saveToCache(key: string, result: ExchangeRateResult) {
  memoryRateCache[key] = result;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(result));
    } catch {
      // ignore quota errors
    }
  }
}

/**
 * Recalculates a single Expense for a new group base currency,
 * adjusting its exchange_rate, converted_amount, and participant shares.
 */
export async function recalculateExpenseForNewBaseCurrency(
  expense: Expense,
  newBaseCurrency: string,
  oldBaseCurrency?: string
): Promise<Expense> {
  const expenseCurrency = (
    expense.currency ||
    oldBaseCurrency ||
    'EUR'
  ).toUpperCase().trim();
  const newBase = newBaseCurrency.toUpperCase().trim();
  const rawOriginalAmount = Number(expense.amount) || 0;
  const paymentDate = getCleanDate(expense.expense_date || expense.created_at);

  let newExchangeRate = 1.0;
  let newConvertedAmount = rawOriginalAmount;

  if (expenseCurrency === newBase) {
    newExchangeRate = 1.0;
    newConvertedAmount = rawOriginalAmount;
  } else {
    const rateInfo = await getHistoricalExchangeRate(
      expenseCurrency,
      newBase,
      paymentDate
    );
    newExchangeRate = rateInfo.rate;
    newConvertedAmount = Math.round(rawOriginalAmount * newExchangeRate * 100) / 100;
  }

  // Recalculate participant quotas
  const splitType = expense.split_type || 'EQUAL';
  const participants = expense.participants || [];
  const totalParticipants = participants.length || 1;

  let updatedParticipants: ExpenseParticipant[] = [];

  if (splitType === 'EQUAL') {
    const equalShare =
      Math.round((newConvertedAmount / totalParticipants) * 100) / 100;
    let accumulated = 0;
    updatedParticipants = participants.map((p, idx) => {
      // Adjust remainder cent to last participant
      const share =
        idx === participants.length - 1
          ? Math.round((newConvertedAmount - accumulated) * 100) / 100
          : equalShare;
      accumulated += share;
      return {
        ...p,
        amount_owed: share,
      };
    });
  } else if (splitType === 'PERCENTAGE') {
    let accumulated = 0;
    updatedParticipants = participants.map((p, idx) => {
      const pct = Number(p.percentage) || 0;
      const share =
        idx === participants.length - 1
          ? Math.round((newConvertedAmount - accumulated) * 100) / 100
          : Math.round(newConvertedAmount * (pct / 100) * 100) / 100;
      accumulated += share;
      return {
        ...p,
        amount_owed: share,
      };
    });
  } else if (splitType === 'SHARES') {
    const totalShares = participants.reduce(
      (acc, p) => acc + (Number(p.shares) || 1),
      0
    );
    let accumulated = 0;
    updatedParticipants = participants.map((p, idx) => {
      const sh = Number(p.shares) || 1;
      const share =
        idx === participants.length - 1
          ? Math.round((newConvertedAmount - accumulated) * 100) / 100
          : Math.round(newConvertedAmount * (sh / (totalShares || 1)) * 100) / 100;
      accumulated += share;
      return {
        ...p,
        amount_owed: share,
      };
    });
  } else {
    // EXACT split: scale proportionally according to new converted amount
    const oldConverted = Number(expense.converted_amount) || rawOriginalAmount || 1;
    let accumulated = 0;
    updatedParticipants = participants.map((p, idx) => {
      const oldOwed = Number(p.amount_owed) || 0;
      const ratio = oldConverted > 0 ? oldOwed / oldConverted : 1 / totalParticipants;
      const share =
        idx === participants.length - 1
          ? Math.round((newConvertedAmount - accumulated) * 100) / 100
          : Math.round(newConvertedAmount * ratio * 100) / 100;
      accumulated += share;
      return {
        ...p,
        amount_owed: share,
      };
    });
  }

  // Recalculate payers (if recorded in base currency)
  const updatedPayers: ExpensePayer[] = (expense.payers || []).map((p) => ({
    ...p,
    // Note: payers' amount_paid is stored in original transaction currency
  }));

  return {
    ...expense,
    exchange_rate: newExchangeRate,
    converted_amount: newConvertedAmount,
    participants: updatedParticipants,
    payers: updatedPayers,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Recalculates all expenses in a group for a new base currency,
 * fetching official historical exchange rates for each expense date.
 */
export async function recalculateAllExpensesForNewBaseCurrency(
  expenses: Expense[],
  newBaseCurrency: string,
  oldBaseCurrency?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Expense[]> {
  const total = expenses.length;
  const results: Expense[] = [];

  for (let i = 0; i < total; i++) {
    const updated = await recalculateExpenseForNewBaseCurrency(
      expenses[i],
      newBaseCurrency,
      oldBaseCurrency
    );
    results.push(updated);
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
}
