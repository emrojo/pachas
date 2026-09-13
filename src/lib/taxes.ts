/**
 * Tax Utilities for Pachas (IVA / VAT / Sales Tax / TVA / MwSt)
 * 
 * Supports international tax calculation, label resolution, and breakdown
 * for receipts both with tax included (retail/Europe) and tax added at the end (US/wholesale).
 */

export interface TaxBreakdown {
  netPrice: number;    // Base imponible (without tax)
  taxAmount: number;   // Cuota de impuesto
  totalPrice: number;  // Total a pagar (netPrice + taxAmount)
  taxRate: number;     // Porcentaje de impuesto (e.g. 21)
  taxName: string;     // e.g. 'IVA', 'VAT', 'Tax'
}

/**
 * Common preset tax rates by currency code for one-tap selection
 */
export const PRESET_TAX_RATES: Record<string, number[]> = {
  EUR: [0, 4, 10, 21],      // España / Europa común
  GBP: [0, 5, 20],          // UK VAT
  USD: [0, 5, 7, 8.25, 10], // US Sales tax
  CAD: [0, 5, 13, 15],      // Canada GST/HST
  MXN: [0, 8, 16],          // México IVA
  ARS: [0, 10.5, 21],       // Argentina IVA
  BRL: [0, 7, 12, 18],      // Brasil
  JPY: [0, 8, 10],          // Japón
  CHF: [0, 2.6, 3.8, 8.1],  // Suiza
};

/**
 * Resolves the appropriate tax name (e.g. 'IVA', 'VAT', 'TVA', 'Sales Tax')
 * based on currency, user locale, or scanner detected name.
 */
export function resolveTaxLabel(currency?: string, locale?: string, detectedName?: string | null): string {
  if (detectedName && detectedName.trim().length >= 2) {
    return detectedName.trim().toUpperCase();
  }

  const cur = (currency || 'EUR').toUpperCase();
  const lang = (locale || 'es').toLowerCase();

  switch (cur) {
    case 'GBP':
      return 'VAT';
    case 'USD':
      return 'Sales Tax';
    case 'CAD':
      return 'GST/HST';
    case 'JPY':
      return 'Tax';
    case 'MXN':
    case 'ARS':
    case 'COP':
    case 'CLP':
    case 'PEN':
      return 'IVA';
    case 'EUR':
      if (lang.startsWith('fr')) return 'TVA';
      if (lang.startsWith('de')) return 'MwSt';
      if (lang.startsWith('it')) return 'IVA';
      if (lang.startsWith('pt')) return 'IVA';
      if (lang.startsWith('en')) return 'VAT';
      return 'IVA'; // Default Spanish
    default:
      return lang.startsWith('es') ? 'IVA' : 'Tax';
  }
}

/**
 * Returns available preset tax rates for a currency (or fallback [0, 4, 10, 21])
 */
export function getPresetTaxRates(currency?: string): number[] {
  const cur = (currency || 'EUR').toUpperCase();
  return PRESET_TAX_RATES[cur] || [0, 4, 10, 21];
}

/**
 * Calculates net price, tax amount, and total price with 2 decimal places precision.
 * 
 * @param inputPrice - The price entered or scanned
 * @param taxRate - The percentage rate (e.g. 21 for 21%)
 * @param isTaxIncluded - If true, inputPrice is totalPrice. If false, inputPrice is netPrice.
 * @param taxName - Optional tax name
 */
export function calculateTaxBreakdown(
  inputPrice: number,
  taxRate: number = 0,
  isTaxIncluded: boolean = true,
  taxName: string = 'IVA'
): TaxBreakdown {
  const round2 = (num: number) => Math.round(num * 100) / 100;
  const price = Math.max(0, Number(inputPrice) || 0);
  const rate = Math.max(0, Number(taxRate) || 0);

  if (rate <= 0) {
    return {
      netPrice: round2(price),
      taxAmount: 0,
      totalPrice: round2(price),
      taxRate: 0,
      taxName,
    };
  }

  if (isTaxIncluded) {
    // Total price is already fixed; extract net base and tax
    const net = round2(price / (1 + rate / 100));
    const tax = round2(price - net);
    return {
      netPrice: net,
      taxAmount: tax,
      totalPrice: round2(price),
      taxRate: rate,
      taxName,
    };
  } else {
    // Input price is net base; add tax to compute total
    const net = round2(price);
    const tax = round2(net * (rate / 100));
    const total = round2(net + tax);
    return {
      netPrice: net,
      taxAmount: tax,
      totalPrice: total,
      taxRate: rate,
      taxName,
    };
  }
}
