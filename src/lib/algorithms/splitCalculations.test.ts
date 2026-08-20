import { describe, it, expect } from 'vitest';
import { calculateSplits } from './splitCalculations';

describe('splitCalculations', () => {
  it('splits 100 EUR equally among 3 friends and accounts for 1 cent remainder', () => {
    const { results, isValid } = calculateSplits(100.0, 'EQUAL', ['u1', 'u2', 'u3']);

    expect(isValid).toBe(true);
    expect(results.length).toBe(3);

    // Total must sum to exactly 100.00: 33.34 + 33.33 + 33.33 = 100.00
    const sum = results.reduce((acc, r) => acc + r.amountOwed, 0);
    expect(Math.round(sum * 100) / 100).toBe(100.0);
    expect(results[0].amountOwed).toBe(33.34);
    expect(results[1].amountOwed).toBe(33.33);
    expect(results[2].amountOwed).toBe(33.33);
  });

  it('validates exact splits matching the total', () => {
    const custom = {
      u1: { exact: 60.5 },
      u2: { exact: 39.5 },
    };
    const { results, isValid } = calculateSplits(100.0, 'EXACT', ['u1', 'u2'], custom);

    expect(isValid).toBe(true);
    expect(results.find((r) => r.userId === 'u1')?.amountOwed).toBe(60.5);
    expect(results.find((r) => r.userId === 'u2')?.amountOwed).toBe(39.5);
  });

  it('rejects exact splits that do not sum to total', () => {
    const custom = {
      u1: { exact: 60.0 },
      u2: { exact: 30.0 }, // 90 instead of 100
    };
    const { isValid, errorMessage } = calculateSplits(100.0, 'EXACT', ['u1', 'u2'], custom);

    expect(isValid).toBe(false);
    expect(errorMessage).toContain('no coincide con el total');
  });

  it('calculates percentage splits properly (70% - 30%)', () => {
    const custom = {
      u1: { percentage: 70 },
      u2: { percentage: 30 },
    };
    const { results, isValid } = calculateSplits(150.0, 'PERCENTAGE', ['u1', 'u2'], custom);

    expect(isValid).toBe(true);
    expect(results.find((r) => r.userId === 'u1')?.amountOwed).toBe(105.0);
    expect(results.find((r) => r.userId === 'u2')?.amountOwed).toBe(45.0);
  });

  it('calculates shares / portions splits (e.g. couple 2 shares, single 1 share)', () => {
    const custom = {
      u1: { shares: 2 }, // Couple pays 2/3 of 90 = 60
      u2: { shares: 1 }, // Single pays 1/3 of 90 = 30
    };
    const { results, isValid } = calculateSplits(90.0, 'SHARES', ['u1', 'u2'], custom);

    expect(isValid).toBe(true);
    expect(results.find((r) => r.userId === 'u1')?.amountOwed).toBe(60.0);
    expect(results.find((r) => r.userId === 'u2')?.amountOwed).toBe(30.0);
  });
});
