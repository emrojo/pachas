import { describe, it, expect } from 'vitest';
import {
  isEuropeanCountry,
  isEuropeanCurrency,
  getApplicableLegislation,
  detectEuropeanJurisdiction,
  calculateTaxBreakdown,
  getCountryTaxPromptContext,
} from './taxes';

describe('Taxes & European Jurisdiction Module', () => {
  describe('isEuropeanCountry', () => {
    it('recognizes EU and European countries', () => {
      expect(isEuropeanCountry('ES')).toBe(true);
      expect(isEuropeanCountry('FR')).toBe(true);
      expect(isEuropeanCountry('DE')).toBe(true);
      expect(isEuropeanCountry('IT')).toBe(true);
      expect(isEuropeanCountry('PT')).toBe(true);
      expect(isEuropeanCountry('GB')).toBe(true);
      expect(isEuropeanCountry('UK')).toBe(true);
      expect(isEuropeanCountry('CH')).toBe(true);
      expect(isEuropeanCountry('NO')).toBe(true);
    });

    it('returns false for non-European countries or invalid inputs', () => {
      expect(isEuropeanCountry('US')).toBe(false);
      expect(isEuropeanCountry('CA')).toBe(false);
      expect(isEuropeanCountry('JP')).toBe(false);
      expect(isEuropeanCountry('MX')).toBe(false);
      expect(isEuropeanCountry(undefined)).toBe(false);
      expect(isEuropeanCountry('')).toBe(false);
    });
  });

  describe('isEuropeanCurrency', () => {
    it('recognizes European currencies', () => {
      expect(isEuropeanCurrency('EUR')).toBe(true);
      expect(isEuropeanCurrency('GBP')).toBe(true);
      expect(isEuropeanCurrency('CHF')).toBe(true);
      expect(isEuropeanCurrency('SEK')).toBe(true);
      expect(isEuropeanCurrency('NOK')).toBe(true);
      expect(isEuropeanCurrency('PLN')).toBe(true);
    });

    it('returns false for non-European currencies', () => {
      expect(isEuropeanCurrency('USD')).toBe(false);
      expect(isEuropeanCurrency('CAD')).toBe(false);
      expect(isEuropeanCurrency('JPY')).toBe(false);
      expect(isEuropeanCurrency('MXN')).toBe(false);
      expect(isEuropeanCurrency(undefined)).toBe(false);
    });
  });

  describe('getApplicableLegislation', () => {
    it('returns ES_RD_1619_2012 for Spain', () => {
      expect(getApplicableLegislation({ countryCode: 'ES' })).toBe('ES_RD_1619_2012');
      expect(getApplicableLegislation({ currency: 'EUR' })).toBe('ES_RD_1619_2012');
    });

    it('returns UK_VAT_ACT_1994 for United Kingdom', () => {
      expect(getApplicableLegislation({ countryCode: 'GB' })).toBe('UK_VAT_ACT_1994');
      expect(getApplicableLegislation({ countryCode: 'UK' })).toBe('UK_VAT_ACT_1994');
      expect(getApplicableLegislation({ currency: 'GBP' })).toBe('UK_VAT_ACT_1994');
    });

    it('returns EU_DIRECTIVE_2006_112 for other European countries', () => {
      expect(getApplicableLegislation({ countryCode: 'FR' })).toBe('EU_DIRECTIVE_2006_112');
      expect(getApplicableLegislation({ countryCode: 'DE' })).toBe('EU_DIRECTIVE_2006_112');
      expect(getApplicableLegislation({ countryCode: 'IT' })).toBe('EU_DIRECTIVE_2006_112');
      expect(getApplicableLegislation({ isEurope: true, countryCode: 'CH' })).toBe('EU_DIRECTIVE_2006_112');
    });

    it('returns US_SALES_TAX or NON_EU for non-European countries', () => {
      expect(getApplicableLegislation({ countryCode: 'US' })).toBe('US_SALES_TAX');
      expect(getApplicableLegislation({ currency: 'USD' })).toBe('US_SALES_TAX');
      expect(getApplicableLegislation({ countryCode: 'JP' })).toBe('NON_EU');
      expect(getApplicableLegislation({ countryCode: 'MX' })).toBe('NON_EU');
    });
  });

  describe('detectEuropeanJurisdiction', () => {
    it('detects Spain simplified invoice from text and currency', () => {
      const res = detectEuropeanJurisdiction({
        currency: 'EUR',
        rawText: 'Restaurante Casa Pepe Madrid NIF: B12345678 Factura Simplificada Total 45.50€',
      });
      expect(res.isEurope).toBe(true);
      expect(res.legislation).toBe('ES_RD_1619_2012');
      expect(res.invoiceType).toBe('simplified');
    });

    it('detects full invoice when buyer data is present in European receipt', () => {
      const res = detectEuropeanJurisdiction({
        countryCode: 'ES',
        rawText: 'Factura Ordinaria\nDatos del cliente:\nNombre: Empresa SL\nNIF: B98765432\nTotal 120.00€',
      });
      expect(res.isEurope).toBe(true);
      expect(res.legislation).toBe('ES_RD_1619_2012');
      expect(res.invoiceType).toBe('full');
    });

    it('detects non-European receipts correctly', () => {
      const res = detectEuropeanJurisdiction({
        currency: 'USD',
        countryCode: 'US',
        rawText: 'Starbucks New York NY Total $12.50 Sales Tax $1.10',
      });
      expect(res.isEurope).toBe(false);
      expect(res.legislation).toBe('US_SALES_TAX');
      expect(res.invoiceType).toBe('standard');
    });
  });

  describe('calculateTaxBreakdown', () => {
    it('correctly calculates net price when tax is included (PVP)', () => {
      const breakdown = calculateTaxBreakdown(110, 10, true, 'IVA');
      expect(breakdown.totalPrice).toBe(110);
      expect(breakdown.netPrice).toBe(100);
      expect(breakdown.taxAmount).toBe(10);
    });

    it('correctly calculates total price when tax is not included', () => {
      const breakdown = calculateTaxBreakdown(100, 21, false, 'IVA');
      expect(breakdown.netPrice).toBe(100);
      expect(breakdown.taxAmount).toBe(21);
      expect(breakdown.totalPrice).toBe(121);
    });
  });

  describe('getCountryTaxPromptContext', () => {
    it('includes European regulation guidelines in prompt context', () => {
      const prompt = getCountryTaxPromptContext('EUR', 'es');
      expect(prompt).toContain('Factura Simplificada');
      expect(prompt).toContain('RD 1619/2012');
      expect(prompt).toContain('Directiva 2006/112/CE');
      expect(prompt).toContain('is_europe');
      expect(prompt).toContain('invoice_type');
    });
  });
});
