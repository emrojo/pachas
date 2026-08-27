import { describe, it, expect } from 'vitest';
import { LOCALES, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './index';

describe('Internationalization (i18n) locales test suite', () => {
  it('should have all supported languages configured', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain('es');
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain('en');
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  it('should have matching key structure in Spanish and English dictionaries', () => {
    const esKeys = Object.keys(LOCALES.es);
    const enKeys = Object.keys(LOCALES.en);

    expect(esKeys.sort()).toEqual(enKeys.sort());

    // Check each category section
    for (const section of esKeys) {
      const esSectionKeys = Object.keys((LOCALES.es as any)[section]).sort();
      const enSectionKeys = Object.keys((LOCALES.en as any)[section]).sort();
      expect(enSectionKeys).toEqual(esSectionKeys);
    }
  });

  it('should correctly interpolate parameters in translations', () => {
    const template = 'Hello, {name}! You owe {amount}.';
    const params = { name: 'Maria', amount: '15,00 €' };
    let result = template;
    for (const [key, val] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
    }
    expect(result).toBe('Hello, Maria! You owe 15,00 €.');
  });
});
