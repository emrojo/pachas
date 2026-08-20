export interface Currency {
  code: string;
  symbol: string;
  name: string;
  rateToEur: number; // Approximate default exchange rate relative to 1 EUR
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', rateToEur: 1.0 },
  { code: 'USD', symbol: '$', name: 'Dólar estadounidense', rateToEur: 1.08 },
  { code: 'GBP', symbol: '£', name: 'Libra esterlina', rateToEur: 0.85 },
  { code: 'JPY', symbol: '¥', name: 'Yen japonés', rateToEur: 165.5 },
  { code: 'CHF', symbol: 'CHF', name: 'Franco suizo', rateToEur: 0.95 },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano', rateToEur: 21.5 },
  { code: 'ARS', symbol: '$', name: 'Peso argentino', rateToEur: 1050.0 },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño', rateToEur: 5.9 },
  { code: 'MAD', symbol: 'DH', name: 'Dírham marroquí', rateToEur: 10.8 },
  { code: 'THB', symbol: '฿', name: 'Baht tailandés', rateToEur: 39.5 },
];

export function getCurrencyByCode(code: string): Currency {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || {
      code: code.toUpperCase(),
      symbol: code.toUpperCase(),
      name: code.toUpperCase(),
      rateToEur: 1.0,
    }
  );
}

/**
 * Formats a monetary number in European format:
 * Uses dot (.) for thousands and comma (,) for decimals. (e.g. 1.250,50 €)
 */
export function formatMoney(amount: number, currencyCode: string = 'EUR'): string {
  const currency = getCurrencyByCode(currencyCode);
  const formatted = Math.abs(amount).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted} ${currency.symbol}`;
}

/**
 * Formats standard numbers with European decimal comma (e.g. 25,50)
 */
export function formatNumber(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parses user input amounts supporting both commas (12,50) and dots (12.50)
 */
export function parseEuropeanAmount(input: string | number): number {
  if (typeof input === 'number') return input;
  if (!input) return 0;
  const normalized = input.toString().trim().replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}
