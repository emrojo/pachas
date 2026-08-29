import { describe, it, expect } from 'vitest';
import { cleanPdfText } from './export';

describe('cleanPdfText', () => {
  it('strips emoji characters and surrogate pairs that corrupt standard PDF fonts', () => {
    expect(cleanPdfText('👤 Carlos')).toBe('Carlos');
    expect(cleanPdfText('🏖️ Playa & Sol 🍹')).toBe('Playa & Sol');
    expect(cleanPdfText('Ana García 🧑‍💻')).toBe('Ana García');
  });

  it('preserves accented Latin characters and standard symbols', () => {
    expect(cleanPdfText('María José González-López')).toBe('María José González-López');
    expect(cleanPdfText('Cena (10€ c/u) / Café & Té')).toBe('Cena (10€ c/u) / Café & Té');
  });

  it('handles null, undefined and empty strings safely', () => {
    expect(cleanPdfText(null)).toBe('');
    expect(cleanPdfText(undefined)).toBe('');
    expect(cleanPdfText('')).toBe('');
  });
});
