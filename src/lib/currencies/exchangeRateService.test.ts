import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHistoricalExchangeRate,
  recalculateExpenseForNewBaseCurrency,
  recalculateAllExpensesForNewBaseCurrency,
  getCleanDate,
} from './exchangeRateService';
import { Expense } from '@/types/database';

describe('Exchange Rate Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 1.0 for identity currency pairs without calling external network', async () => {
    const result = await getHistoricalExchangeRate('EUR', 'EUR', '2026-08-10');
    expect(result.rate).toBe(1.0);
    expect(result.provider).toBe('Identity');
    expect(result.fromCurrency).toBe('EUR');
    expect(result.toCurrency).toBe('EUR');
  });

  it('cleans date strings properly', () => {
    expect(getCleanDate('2026-08-10T14:30:00Z')).toBe('2026-08-10');
    expect(getCleanDate('2024-05-15 10:00:00')).toBe('2024-05-15');
    expect(getCleanDate('2025-01-01')).toBe('2025-01-01');
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
    const results = await recalculateAllExpensesForNewBaseCurrency(expenses, 'EUR', (c) => {
      progressCount = c;
    });

    expect(results).toHaveLength(1);
    expect(results[0].converted_amount).toBe(60);
    expect(progressCount).toBe(1);
  });
});
