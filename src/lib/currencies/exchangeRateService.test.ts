import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHistoricalExchangeRate,
  recalculateExpenseForNewBaseCurrency,
  recalculateAllExpensesForNewBaseCurrency,
  getCleanDate,
  clearExchangeRateCache,
} from './exchangeRateService';
import { Expense } from '@/types/database';

describe('Exchange Rate Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearExchangeRateCache();
  });

  it('returns 1.0 for identity currency pairs without calling external network', async () => {
    const result = await getHistoricalExchangeRate('EUR', 'EUR', '2026-08-10');
    expect(result.rate).toBe(1.0);
    expect(result.provider).toBe('Identity');
    expect(result.fromCurrency).toBe('EUR');
    expect(result.toCurrency).toBe('EUR');
  });

  it('cleans date strings properly across ISO, European, and timezone formats', () => {
    expect(getCleanDate('2026-08-10T14:30:00Z')).toBe('2026-08-10');
    expect(getCleanDate('2024-05-15 10:00:00')).toBe('2024-05-15');
    expect(getCleanDate('2025-01-01')).toBe('2025-01-01');
    expect(getCleanDate('15/05/2024')).toBe('2024-05-15');
    expect(getCleanDate('15-05-2024')).toBe('2024-05-15');
    expect(getCleanDate('15.05.2024')).toBe('2024-05-15');
    expect(getCleanDate('2024-05-15T00:30:00+02:00')).toBe('2024-05-15');
  });

  it('fetches rate from mocked Frankfurter API successfully', async () => {
    const mockResponse = {
      amount: 1,
      base: 'USD',
      date: '2024-05-15',
      rates: { EUR: 0.9232 },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await getHistoricalExchangeRate('USD', 'EUR', '2024-05-15');
    expect(result.rate).toBe(0.9232);
    expect(result.provider).toBe('ECB (Frankfurter)');
    expect(result.date).toBe('2024-05-15');
  });

  it('falls back to local static table if network fails completely', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await getHistoricalExchangeRate('USD', 'EUR', '2023-01-01');
    expect(result.rate).toBeGreaterThan(0);
    expect(result.provider).toBe('Fallback Local');
    expect(result.isEstimated).toBe(true);
  });

  it('recalculates single expense for a new base currency accurately', async () => {
    const mockExpense: Expense = {
      id: 'e-1',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Dinner NYC',
      amount: 100,
      currency: 'USD',
      exchange_rate: 0.9,
      converted_amount: 90,
      category: 'food',
      split_type: 'EQUAL',
      expense_date: '2026-08-10',
      created_at: '2026-08-10T20:00:00Z',
      updated_at: '2026-08-10T20:00:00Z',
      payers: [{ id: 'p-1', expense_id: 'e-1', user_id: 'u-1', amount_paid: 100 }],
      participants: [
        { id: 'pt-1', expense_id: 'e-1', user_id: 'u-1', amount_owed: 45 },
        { id: 'pt-2', expense_id: 'e-1', user_id: 'u-2', amount_owed: 45 },
      ],
    };

    // If new base currency is USD: identity conversion
    const recalculatedUSD = await recalculateExpenseForNewBaseCurrency(mockExpense, 'USD');
    expect(recalculatedUSD.exchange_rate).toBe(1.0);
    expect(recalculatedUSD.converted_amount).toBe(100);
    expect(recalculatedUSD.participants?.[0].amount_owed).toBe(50);
    expect(recalculatedUSD.participants?.[1].amount_owed).toBe(50);
  });

  it('applies different historical exchange rates depending on the exact payment date', async () => {
    const expenseDate1: Expense = {
      id: 'e-date-1',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Comida Mayo 2024',
      amount: 100,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 100,
      category: 'food',
      split_type: 'EQUAL',
      expense_date: '2024-05-15',
      created_at: '2024-05-15T12:00:00Z',
      updated_at: '2024-05-15T12:00:00Z',
      payers: [{ id: 'p-1', expense_id: 'e-date-1', user_id: 'u-1', amount_paid: 100 }],
      participants: [{ id: 'pt-1', expense_id: 'e-date-1', user_id: 'u-1', amount_owed: 100 }],
    };

    const expenseDate2: Expense = {
      id: 'e-date-2',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Comida Agosto 2026',
      amount: 100,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 100,
      category: 'food',
      split_type: 'EQUAL',
      expense_date: '2026-08-10',
      created_at: '2026-08-10T12:00:00Z',
      updated_at: '2026-08-10T12:00:00Z',
      payers: [{ id: 'p-2', expense_id: 'e-date-2', user_id: 'u-1', amount_paid: 100 }],
      participants: [{ id: 'pt-2', expense_id: 'e-date-2', user_id: 'u-1', amount_owed: 100 }],
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('2024-05-15')) {
        return {
          ok: true,
          json: async () => ({ amount: 1, base: 'EUR', date: '2024-05-15', rates: { USD: 1.0832 } }),
        } as Response;
      }
      if (url.includes('2026-08-10')) {
        return {
          ok: true,
          json: async () => ({ amount: 1, base: 'EUR', date: '2026-08-10', rates: { USD: 1.1555 } }),
        } as Response;
      }
      return { ok: false } as Response;
    });

    const res1 = await recalculateExpenseForNewBaseCurrency(expenseDate1, 'USD', 'EUR');
    const res2 = await recalculateExpenseForNewBaseCurrency(expenseDate2, 'USD', 'EUR');

    expect(res1.exchange_rate).toBe(1.0832);
    expect(res1.converted_amount).toBe(108.32);

    expect(res2.exchange_rate).toBe(1.1555);
    expect(res2.converted_amount).toBe(115.55);
  });

  it('uses user-specified expense_date strictly and ignores system creation timestamp (created_at)', async () => {
    // Expense occurred on 15/05/2024 but was entered into system on 29/08/2026
    const userExpense: Expense = {
      id: 'e-date-user',
      group_id: 'g-1',
      created_by: 'u-1',
      title: 'Restaurante pasado',
      amount: 100,
      currency: 'EUR',
      exchange_rate: 1,
      converted_amount: 100,
      category: 'food',
      split_type: 'EQUAL',
      expense_date: '15/05/2024', // User-specified date (European format)
      created_at: '2026-08-29T13:00:00Z', // Today's creation timestamp
      updated_at: '2026-08-29T13:00:00Z',
      payers: [{ id: 'p-1', expense_id: 'e-date-user', user_id: 'u-1', amount_paid: 100 }],
      participants: [{ id: 'pt-1', expense_id: 'e-date-user', user_id: 'u-1', amount_owed: 100 }],
    };

    let requestedUrl = '';
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ amount: 1, base: 'EUR', date: '2024-05-15', rates: { USD: 1.0832 } }),
      } as Response;
    });

    const res = await recalculateExpenseForNewBaseCurrency(userExpense, 'USD', 'EUR');

    expect(requestedUrl).toContain('2024-05-15');
    expect(requestedUrl).not.toContain('2026-08-29');
    expect(res.exchange_rate).toBe(1.0832);
    expect(res.converted_amount).toBe(108.32);
  });

  it('recalculates multiple expenses in batch', async () => {
    const expenses: Expense[] = [
      {
        id: 'e-1',
        group_id: 'g-1',
        created_by: 'u-1',
        title: 'Gasto 1',
        amount: 60,
        currency: 'EUR',
        exchange_rate: 1,
        converted_amount: 60,
        category: 'food',
        split_type: 'EQUAL',
        expense_date: '2026-08-10',
        created_at: '2026-08-10T20:00:00Z',
        updated_at: '2026-08-10T20:00:00Z',
        payers: [{ id: 'p-1', expense_id: 'e-1', user_id: 'u-1', amount_paid: 60 }],
        participants: [
          { id: 'pt-1', expense_id: 'e-1', user_id: 'u-1', amount_owed: 30 },
          { id: 'pt-2', expense_id: 'e-1', user_id: 'u-2', amount_owed: 30 },
        ],
      },
    ];

    let progressCount = 0;
    const results = await recalculateAllExpensesForNewBaseCurrency(expenses, 'EUR', 'EUR', (c) => {
      progressCount = c;
    });

    expect(results).toHaveLength(1);
    expect(results[0].converted_amount).toBe(60);
    expect(progressCount).toBe(1);
  });
});
