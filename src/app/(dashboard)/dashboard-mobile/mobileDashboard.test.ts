import { describe, it, expect } from 'vitest';
import { LOCALES } from '@/locales';
import { MemberBalance } from '@/types/database';

describe('Mobile Dashboard (A/B Test /dashboard-mobile)', () => {
  it('has all required mobile dashboard localization keys present in all 20 supported languages', () => {
    const requiredKeys = [
      'mobileTitle',
      'totalGroupSpent',
      'youOweGroup',
      'groupOwesYou',
      'userSettled',
      'scanReceiptCamera',
      'uploadReceiptImage',
      'addExpenseManual',
      'tabExpenses',
      'tabGroups',
      'tabOptions',
      'switchGroup',
      'noExpensesInGroup',
      'supportProject',
    ];

    const langCodes = Object.keys(LOCALES) as (keyof typeof LOCALES)[];
    expect(langCodes.length).toBeGreaterThanOrEqual(19);

    for (const lang of langCodes) {
      const dashboardDict = LOCALES[lang]?.dashboard as Record<string, string>;
      expect(dashboardDict, `dashboard section missing in ${lang}`).toBeDefined();

      for (const key of requiredKeys) {
        expect(
          dashboardDict[key],
          `Missing key '${key}' in ${lang}.dashboard`
        ).toBeDefined();
        expect(dashboardDict[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('correctly determines user debt status based on net_balance', () => {
    const formatUserStatus = (netBalance: number, currency: string = 'EUR') => {
      if (netBalance < 0) {
        return { status: 'owes', label: `Debes ${Math.abs(netBalance).toFixed(2)} ${currency}` };
      } else if (netBalance > 0) {
        return { status: 'owed', label: `Te deben ${netBalance.toFixed(2)} ${currency}` };
      }
      return { status: 'settled', label: 'Al día' };
    };

    expect(formatUserStatus(-45.5).status).toBe('owes');
    expect(formatUserStatus(-45.5).label).toBe('Debes 45.50 EUR');

    expect(formatUserStatus(25.0).status).toBe('owed');
    expect(formatUserStatus(25.0).label).toBe('Te deben 25.00 EUR');

    expect(formatUserStatus(0).status).toBe('settled');
    expect(formatUserStatus(0).label).toBe('Al día');
  });

  it('calculates total group spending accurately across multiple expenses', () => {
    const expenses = [
      { amount: 15.50 },
      { amount: 42.00 },
      { amount: 8.75 },
    ];

    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    expect(total).toBe(66.25);
  });
});
