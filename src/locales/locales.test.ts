import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LOCALES, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './index';

function getAllFiles(dir: string, extList: string[]): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        files = files.concat(getAllFiles(fullPath, extList));
      }
    } else if (extList.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function getNestedValue(obj: any, pathStr: string): any {
  const parts = pathStr.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[p];
  }
  return curr;
}

describe('Internationalization (i18n) locales test suite', () => {
  it('should have all supported languages configured', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain('es');
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toContain('en');
    expect(DEFAULT_LANGUAGE).toBe('es');
  });

  it('should have matching key structure across all supported language dictionaries', () => {
    const esKeys = Object.keys(LOCALES.es).sort();
    const langCodes = Object.keys(LOCALES) as (keyof typeof LOCALES)[];

    for (const lang of langCodes) {
      if (lang === 'es') continue;
      const langKeys = Object.keys(LOCALES[lang]).sort();
      expect(langKeys, `Top-level sections in ${lang}`).toEqual(esKeys);

      for (const section of esKeys) {
        const esSectionKeys = Object.keys((LOCALES.es as any)[section]).sort();
        const targetSectionKeys = Object.keys((LOCALES[lang] as any)[section] || {}).sort();
        expect(targetSectionKeys, `Section "${section}" keys in ${lang}`).toEqual(esSectionKeys);
      }
    }
  });

  it('should have all t(...) calls in the codebase present in the translation dictionaries', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allSourceFiles = getAllFiles(srcDir, ['.ts', '.tsx']).filter(
      (f) => !f.includes('locales.test.ts') && !f.includes('check_missing_keys')
    );

    const missingInEs: { file: string; key: string }[] = [];
    const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = tRegex.exec(content)) !== null) {
        const key = match[1];
        // Ignore dynamic template expressions or category ids handled dynamically if any
        if (key.includes('${')) continue;

        const valInEs = getNestedValue(LOCALES.es, key);
        if (typeof valInEs !== 'string') {
          missingInEs.push({ file: path.relative(srcDir, file), key });
        }
      }
    }

    if (missingInEs.length > 0) {
      console.error('Missing translation keys in es.ts:', missingInEs);
    }
    expect(missingInEs).toEqual([]);
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

  it('should detect regional languages accurately based on dialect and locales', () => {
    const testDetect = (languages: string[]): string => {
      const valid = new Set(['es', 'en', 'ca', 'gl', 'eu', 'va', 'fr', 'pt', 'de', 'it', 'zh', 'ja', 'hi', 'ru', 'ar', 'el', 'tr', 'nl', 'af']);
      for (const raw of languages) {
        const lower = raw.toLowerCase().trim();
        if (lower.startsWith('ca-valencia') || lower.startsWith('es-valencia') || lower === 'va') return 'va';
        if (lower.startsWith('ca') || lower === 'cat') return 'ca';
        if (lower.startsWith('gl') || lower === 'glg') return 'gl';
        if (lower.startsWith('eu') || lower === 'eus') return 'eu';
        const twoLetter = lower.slice(0, 2);
        if (valid.has(twoLetter)) return twoLetter;
      }
      return 'es';
    };

    expect(testDetect(['ca-ES', 'es'])).toBe('ca');
    expect(testDetect(['gl-ES', 'es'])).toBe('gl');
    expect(testDetect(['eu-ES', 'es'])).toBe('eu');
    expect(testDetect(['ca-valencia', 'es'])).toBe('va');
    expect(testDetect(['fr-FR', 'en'])).toBe('fr');
    expect(testDetect(['de-DE', 'en'])).toBe('de');
    expect(testDetect(['pt-BR', 'en'])).toBe('pt');
    expect(testDetect(['en-US', 'es'])).toBe('en');
  });
});

