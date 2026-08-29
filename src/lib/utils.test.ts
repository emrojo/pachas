import { describe, it, expect } from 'vitest';
import { formatDate, formatEuropeanDate, formatEuropeanDateTime, formatLocaleDate } from './utils';

describe('Date formatting utilities', () => {
  it('formats dates strictly in day/month/year format (dd/MM/yyyy)', () => {
    const isoDate = '2026-08-29T14:30:00';
    expect(formatDate(isoDate, 'dd/MM/yyyy')).toBe('29/08/2026');
    expect(formatEuropeanDate(isoDate)).toBe('29/08/2026');
    expect(formatEuropeanDateTime(isoDate)).toBe('29/08/2026 14:30');
  });

  it('enforces day/month/year standard in formatLocaleDate regardless of language', () => {
    expect(formatLocaleDate('2026-08-29', 'es')).toBe('29/08/2026');
    expect(formatLocaleDate('2026-08-29', 'en')).toBe('29/08/2026');
    expect(formatLocaleDate('2026-01-05', 'fr')).toBe('05/01/2026');
    expect(formatLocaleDate('2026-12-31T10:00:00', 'de')).toBe('31/12/2026');
  });

  it('handles invalid or empty inputs gracefully', () => {
    expect(formatLocaleDate(null)).toBe('');
    expect(formatLocaleDate(undefined)).toBe('');
    expect(formatLocaleDate('')).toBe('');
  });
});
