import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatEuropeanDate,
  formatEuropeanDateTime,
  formatLocaleDate,
  formatExpenseDisplayDate,
  toDateTimeLocalValue,
  hasSpecificTime,
} from './utils';

describe('Date formatting utilities', () => {
  it('formats dates strictly in day/month/year format (dd/MM/yyyy)', () => {
    const isoDate = '2026-08-29T14:30:00';
    expect(formatDate(isoDate, 'dd/MM/yyyy')).toBe('29/08/2026');
    expect(formatEuropeanDate(isoDate)).toBe('29/08/2026');
    expect(formatEuropeanDateTime(isoDate)).toBe('29/08/2026 14:30');
  });

  it('strictly prohibits MM/dd/yyyy format and corrects to dd/MM/yyyy', () => {
    const isoDate = '2026-08-29T14:30:00';
    expect(formatDate(isoDate, 'MM/dd/yyyy')).toBe('29/08/2026');
    expect(formatDate(isoDate, 'MM-dd-yyyy')).toBe('29-08-2026');
  });

  it('enforces day/month/year standard in formatLocaleDate regardless of language', () => {
    expect(formatLocaleDate('2026-08-29', 'es')).toBe('29/08/2026');
    expect(formatLocaleDate('2026-08-29', 'en')).toBe('29/08/2026');
    expect(formatLocaleDate('2026-01-05', 'fr')).toBe('05/01/2026');
    expect(formatLocaleDate('2026-12-31T10:00:00', 'de')).toBe('31/12/2026');
  });

  it('parses toDateTimeLocalValue with exact hours and minutes without timezone skew', () => {
    expect(toDateTimeLocalValue('2026-08-30T14:35')).toBe('2026-08-30T14:35');
    expect(toDateTimeLocalValue('2026-08-30T21:10:00')).toBe('2026-08-30T21:10');
    expect(toDateTimeLocalValue('30/08/2026 18:45')).toBe('2026-08-30T18:45');
  });

  it('identifies specific times and formats expense cards cleanly', () => {
    expect(hasSpecificTime('2026-08-30T14:35')).toBe(true);
    expect(hasSpecificTime('2026-08-30')).toBe(false);
    expect(hasSpecificTime('2026-08-30T00:00:00')).toBe(false);

    expect(formatExpenseDisplayDate('2026-08-30T14:35')).toBe('30 ago, 14:35');
    expect(formatExpenseDisplayDate('2026-08-30')).toBe('30 ago');
    expect(formatExpenseDisplayDate('2026-08-30T00:00:00')).toBe('30 ago');
  });

  it('handles invalid or empty inputs gracefully', () => {
    expect(formatLocaleDate(null)).toBe('');
    expect(formatLocaleDate(undefined)).toBe('');
    expect(formatLocaleDate('')).toBe('');
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(formatExpenseDisplayDate(null)).toBe('');
  });
});

