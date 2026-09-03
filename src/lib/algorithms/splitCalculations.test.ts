import { describe, it, expect } from 'vitest';
import { calculateSplits } from './splitCalculations';
import { parseEuropeanAmount } from '../currencies';

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

  it('supports decimal amounts parsed from comma and dot notation in exact splits', () => {
    const inputU1 = '60,75';
    const inputU2 = '39.25';
    const custom = {
      u1: { exact: parseEuropeanAmount(inputU1) },
      u2: { exact: parseEuropeanAmount(inputU2) },
    };
    const { results, isValid } = calculateSplits(100.0, 'EXACT', ['u1', 'u2'], custom);

    expect(isValid).toBe(true);
    expect(results.find((r) => r.userId === 'u1')?.amountOwed).toBe(60.75);
    expect(results.find((r) => r.userId === 'u2')?.amountOwed).toBe(39.25);
  });

  it('excludes participants with 0 or undefined amount in exact split from results', () => {
    const custom = {
      u1: { exact: 60.0 },
      u2: { exact: 40.0 },
      u3: { exact: 0 },
    };
    const { results, isValid } = calculateSplits(100.0, 'EXACT', ['u1', 'u2', 'u3'], custom);

    expect(isValid).toBe(true);
    expect(results.length).toBe(2);
    expect(results.find((r) => r.userId === 'u1')?.amountOwed).toBe(60.0);
    expect(results.find((r) => r.userId === 'u2')?.amountOwed).toBe(40.0);
    expect(results.find((r) => r.userId === 'u3')).toBeUndefined();
  });

  it('correctly calculates remainder when one participant gets the remainder amount', () => {
    const totalAmount = 125.50;
    const custom = {
      u1: { exact: 45.20 },
      u2: { exact: 30.10 },
    };
    const sumOthers = (custom.u1.exact || 0) + (custom.u2.exact || 0);
    const remainder = Math.round((totalAmount - sumOthers) * 100) / 100;
    expect(remainder).toBe(50.20);

    const fullCustom = {
      ...custom,
      u3: { exact: remainder },
    };
    const { results, isValid } = calculateSplits(totalAmount, 'EXACT', ['u1', 'u2', 'u3'], fullCustom);

    expect(isValid).toBe(true);
    expect(results.length).toBe(3);
    expect(results.find((r) => r.userId === 'u3')?.amountOwed).toBe(50.20);
  });
});
