/**
 * Tax Utilities for Pachas (IVA / VAT / Sales Tax / TVA / MwSt)
 * 
 * Supports international tax calculation, label resolution, and breakdown
 * for receipts both with tax included (retail/Europe) and tax added at the end (US/wholesale).
 */

import { InvoiceType } from '@/types/database';

export interface TaxBreakdown {
  netPrice: number;    // Base imponible (without tax)
  taxAmount: number;   // Cuota de impuesto
  totalPrice: number;  // Total a pagar (netPrice + taxAmount)
  taxRate: number;     // Porcentaje de impuesto (e.g. 21)
  taxName: string;     // e.g. 'IVA', 'VAT', 'Tax'
}

export interface TaxBracketSummary {
  tax_rate: number;
  base_amount?: number;
  tax_amount?: number;
  total_amount?: number;
}

export interface TaxBracketDetail {
  rate: number;
  name: string;
  description: string;
  productExamples: string[];
}

export interface CountryTaxInfo {
  countryCode: string;
  countryName: string;
  taxName: string;
  defaultIncluded: boolean;
  brackets: TaxBracketDetail[];
}

export const TAX_BRACKETS_BY_COUNTRY: Record<string, CountryTaxInfo> = {
  ES: {
    countryCode: 'ES',
    countryName: 'España',
    taxName: 'IVA',
    defaultIncluded: true,
    brackets: [
      {
        rate: 4,
        name: 'Superreducido (4% / 0% / 2%)',
        description: 'Alimentos básicos de primera necesidad, medicamentos y prensa',
        productExamples: [
          'pan', 'harina panificable', 'leche', 'queso', 'huevos', 'frutas', 'verduras',
          'hortalizas', 'legumbres', 'tubérculos', 'cereales', 'aceite de oliva',
          'medicamentos para uso humano', 'libros', 'periódicos', 'revistas',
        ],
      },
      {
        rate: 10,
        name: 'Reducido (10%)',
        description: 'Restauración, hostelería, transporte de viajeros y resto de alimentos',
        productExamples: [
          'restaurante', 'menú', 'platos de comida', 'raciones', 'cafetería', 'comida para llevar',
          'carnes', 'pescados', 'pastas', 'conservas', 'embutidos', 'agua mineral / envasada',
          'refrescos servidos en mesa en hostelería', 'transporte de pasajeros', 'taxi', 'tren',
        ],
      },
      {
        rate: 21,
        name: 'General (21%)',
        description: 'Bebidas alcohólicas, refrescos en tienda, droguería, tecnología, ropa, ocio y servicios',
        productExamples: [
          'cerveza', 'vino', 'copas', 'licores', 'cócteles', 'bebidas alcohólicas',
          'refrescos o zumos azucarados comprados en supermercado', 'higiene personal',
          'droguería', 'limpieza', 'cosmética', 'ropa', 'calzado', 'electrónica',
          'gasolina / combustible', 'tabaco', 'discotecas', 'servicios profesionales',
        ],
      },
      {
        rate: 0,
        name: 'Exento (0%)',
        description: 'Servicios sanitarios, médicos, formación reglada y sellos',
        productExamples: ['servicios médicos', 'consultas de salud', 'educación reglada', 'sellos'],
      },
    ],
  },
  FR: {
    countryCode: 'FR',
    countryName: 'Francia',
    taxName: 'TVA',
    defaultIncluded: true,
    brackets: [
      {
        rate: 2.1,
        name: 'Taux super-réduit (2.1%)',
        description: 'Médicaments remboursables, presse d’information',
        productExamples: ['presse', 'médicaments remboursables'],
      },
      {
        rate: 5.5,
        name: 'Taux réduit (5.5%)',
        description: 'Produits alimentaires de base, livres, cantines scolaires',
        productExamples: ['alimentation de base', 'pain', 'lait', 'livres'],
      },
      {
        rate: 10,
        name: 'Taux intermédiaire (10%)',
        description: 'Restauration sur place ou à emporter, transports, hébergement hôtelier',
        productExamples: ['restaurant', 'café', 'repas', 'transport', 'hôtel'],
      },
      {
        rate: 20,
        name: 'Taux normal (20%)',
        description: 'Alcools, boissons sucrées, produits manufacturés et services généraux',
        productExamples: ['alcool', 'bière', 'vin', 'vêtements', 'carburant', 'électronique'],
      },
    ],
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Alemania',
    taxName: 'MwSt',
    defaultIncluded: true,
    brackets: [
      {
        rate: 7,
        name: 'Ermäßigter Steuersatz (7%)',
        description: 'Grundnahrungsmittel, Bücher, Zeitschriften, Take-away Essen',
        productExamples: ['Grundnahrungsmittel', 'Brot', 'Milch', 'Bücher', 'Essen zum Mitnehmen'],
      },
      {
        rate: 19,
        name: 'Regelsteuersatz (19%)',
        description: 'Restaurantverzehr, Alkohol, Dienstleistungen, Konsumgüter',
        productExamples: ['Restaurant', 'Bier', 'Wein', 'Alkohol', 'Kleidung', 'Benzin'],
      },
    ],
  },
  IT: {
    countryCode: 'IT',
    countryName: 'Italia',
    taxName: 'IVA',
    defaultIncluded: true,
    brackets: [
      {
        rate: 4,
        name: 'Minima (4%)',
        description: 'Alimenti di prima necessità, libri, giornali',
        productExamples: ['pane', 'latte', 'frutta', 'giornali', 'libri'],
      },
      {
        rate: 10,
        name: 'Ridotta (10%)',
        description: 'Ristorazione, bar, alberghi, carni, pesce',
        productExamples: ['ristorante', 'bar', 'caffè', 'pizzeria', 'hotel', 'carne'],
      },
      {
        rate: 22,
        name: 'Ordinaria (22%)',
        description: 'Bevande alcoliche, abbigliamento, carburanti, servizi',
        productExamples: ['alcolici', 'birra', 'vino', 'abbigliamento', 'elettronica'],
      },
    ],
  },
  PT: {
    countryCode: 'PT',
    countryName: 'Portugal',
    taxName: 'IVA',
    defaultIncluded: true,
    brackets: [
      {
        rate: 6,
        name: 'Taxa reduzida (6%)',
        description: 'Alimentos essenciais, livros, medicamentos, transportes',
        productExamples: ['pão', 'leite', 'fruta', 'livros', 'medicamentos'],
      },
      {
        rate: 13,
        name: 'Taxa intermédia (13%)',
        description: 'Restauração e alimentação preparada, vinho de mesa',
        productExamples: ['restaurante', 'refeições', 'vinho de mesa', 'entradas em espetáculos'],
      },
      {
        rate: 23,
        name: 'Taxa normal (23%)',
        description: 'Cerveja, bebidas espirituosas, refrigerantes, geral',
        productExamples: ['cerveja', 'refrigerantes', 'licores', 'combustível', 'vestuário'],
      },
    ],
  },
  GB: {
    countryCode: 'GB',
    countryName: 'Reino Unido',
    taxName: 'VAT',
    defaultIncluded: true,
    brackets: [
      {
        rate: 0,
        name: 'Zero rate (0%)',
        description: 'Most supermarket food, children clothing, books',
        productExamples: ['groceries', 'raw food', 'bread', 'milk', 'books'],
      },
      {
        rate: 5,
        name: 'Reduced rate (5%)',
        description: 'Domestic energy, children car seats',
        productExamples: ['energy', 'car seats'],
      },
      {
        rate: 20,
        name: 'Standard rate (20%)',
        description: 'Restaurants, hot takeaway food, alcoholic drinks, confectionary',
        productExamples: ['restaurant meals', 'hot takeaway', 'beer', 'wine', 'spirits', 'clothing'],
      },
    ],
  },
  US: {
    countryCode: 'US',
    countryName: 'Estados Unidos',
    taxName: 'Sales Tax',
    defaultIncluded: false,
    brackets: [
      {
        rate: 8.25,
        name: 'State / Local Sales Tax (0% - 10%)',
        description: 'Impuesto añadido al final sobre el subtotal según estado o ciudad',
        productExamples: ['general goods', 'prepared food', 'services'],
      },
    ],
  },
};

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

/**
 * Set of European ISO country codes (EU-27 + UK, EEA, EFTA, microstates, etc.)
 */
export const EUROPEAN_COUNTRY_CODES = new Set([
  // EU-27
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Non-EU European, EFTA, microstates, UK
  'GB', 'UK', 'CH', 'NO', 'IS', 'LI', 'AD', 'MC', 'SM', 'VA', 'AL', 'BA', 'ME', 'MK', 'RS', 'MD', 'UA',
]);

/**
 * Set of common European currencies
 */
export const EUROPEAN_CURRENCIES = new Set([
  'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'ISK',
]);

/**
 * Returns true if the ISO country code represents a European territory.
 */
export function isEuropeanCountry(countryCode?: string): boolean {
  if (!countryCode) return false;
  return EUROPEAN_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

/**
 * Returns true if the currency code represents a European currency.
 */
export function isEuropeanCurrency(currency?: string): boolean {
  if (!currency) return false;
  return EUROPEAN_CURRENCIES.has(currency.trim().toUpperCase());
}

/**
 * Resolves the applicable tax legislation code based on country and European status.
 */
export function getApplicableLegislation(options: {
  isEurope?: boolean;
  countryCode?: string;
  currency?: string;
}): string {
  const code = options.countryCode?.trim().toUpperCase();
  const cur = options.currency?.trim().toUpperCase();
  const isEu = options.isEurope ?? (isEuropeanCountry(code) || isEuropeanCurrency(cur));

  if (!isEu) {
    if (code === 'US' || cur === 'USD') return 'US_SALES_TAX';
    return 'NON_EU';
  }

  if (code === 'ES' || (!code && cur === 'EUR')) {
    return 'ES_RD_1619_2012'; // Real Decreto 1619/2012 de Facturación (España)
  }

  if (code === 'GB' || code === 'UK' || cur === 'GBP') {
    return 'UK_VAT_ACT_1994'; // Value Added Tax Act 1994 (UK)
  }

  return 'EU_DIRECTIVE_2006_112'; // Directiva 2006/112/CE del Consejo de la UE
}

/**
 * Detects whether an establishment/receipt belongs to a European jurisdiction,
 * determining the legal framework and invoice classification.
 */
export function detectEuropeanJurisdiction(options: {
  currency?: string;
  countryCode?: string;
  rawText?: string;
  invoiceType?: InvoiceType;
}): {
  isEurope: boolean;
  legislation: string;
  invoiceType: InvoiceType;
  countryCode?: string;
} {
  const code = options.countryCode?.trim().toUpperCase();
  const cur = options.currency?.trim().toUpperCase();
  const text = (options.rawText || '').toLowerCase();

  let isEu = false;
  let resolvedCountry = code;

  if (code && isEuropeanCountry(code)) {
    isEu = true;
  } else if (cur && isEuropeanCurrency(cur)) {
    isEu = true;
  } else if (
    text.includes('españa') || text.includes('spain') ||
    text.includes('madrid') || text.includes('barcelona') ||
    text.includes('valencia') || text.includes('sevilla') ||
    text.includes('nif:') || text.includes('cif:') ||
    text.includes('factura simplificada') || text.includes('iva incluido')
  ) {
    isEu = true;
    if (!resolvedCountry) resolvedCountry = 'ES';
  } else if (
    text.includes('france') || text.includes('deutschland') || text.includes('italia') ||
    text.includes('paris') || text.includes('berlin') || text.includes('roma') ||
    text.includes('tva') || text.includes('mwst')
  ) {
    isEu = true;
  }

  const legislation = getApplicableLegislation({
    isEurope: isEu,
    countryCode: resolvedCountry,
    currency: cur,
  });

  let invType: InvoiceType = options.invoiceType || (isEu ? 'simplified' : 'standard');

  if (!options.invoiceType && isEu) {
    // If text contains explicit customer tax ID or mentions full invoice, treat as full
    const hasBuyerData = (
      (text.includes('cliente:') || text.includes('datos del cliente') || text.includes('factura ordinaria') || text.includes('factura completa') || text.includes('destinatario:')) &&
      (text.includes('nif') || text.includes('cif') || text.includes('vat id'))
    );
    invType = hasBuyerData ? 'full' : 'simplified';
  }

  return {
    isEurope: isEu,
    legislation,
    invoiceType: invType,
    countryCode: resolvedCountry,
  };
}

/**
 * Builds structured tax bracket context and product classification rules
 * to inject directly into the multimodal AI vision prompt.
 */
export function getCountryTaxPromptContext(currency?: string, language?: string): string {
  const cur = (currency || 'EUR').toUpperCase();
  const lang = (language || 'es').toLowerCase();

  let primaryCountryCode = 'ES';
  if (cur === 'GBP') primaryCountryCode = 'GB';
  else if (cur === 'USD') primaryCountryCode = 'US';
  else if (cur === 'EUR') {
    if (lang.startsWith('fr')) primaryCountryCode = 'FR';
    else if (lang.startsWith('de')) primaryCountryCode = 'DE';
    else if (lang.startsWith('it')) primaryCountryCode = 'IT';
    else if (lang.startsWith('pt')) primaryCountryCode = 'PT';
    else primaryCountryCode = 'ES';
  }

  const primaryCountry = TAX_BRACKETS_BY_COUNTRY[primaryCountryCode] || TAX_BRACKETS_BY_COUNTRY.ES;

  let context = `--- CONTEXTO TRIBUTARIO Y TRAMOS DE IMPUESTOS POR PAÍS ---\n`;
  context += `Jurisdicción de referencia esperada (según divisa ${cur} e idioma ${lang}): ${primaryCountry.countryName} (${primaryCountry.taxName}).\n`;
  context += `Tramos base y tipos impositivos vigentes en ${primaryCountry.countryName}:\n`;

  for (const b of primaryCountry.brackets) {
    context += `  • ${b.name} [${b.rate}%]: ${b.description}.\n    Ejemplos de productos: ${b.productExamples.slice(0, 12).join(', ')}.\n`;
  }

  context += `\nOtros países frecuentes si el ticket procede del extranjero:\n`;
  for (const [code, info] of Object.entries(TAX_BRACKETS_BY_COUNTRY)) {
    if (code === primaryCountryCode) continue;
    const ratesStr = info.brackets.map((b) => `${b.rate}%`).join(', ');
    context += `  • ${info.countryName} (${info.taxName}): tramos [${ratesStr}].\n`;
  }

  context += `\n--- NORMATIVA EUROPEA: FACTURA SIMPLIFICADA VS FACTURA COMPLETA ---\n`;
  context += `1. Jurisdicción Europea (is_europe): Identifica si el establecimiento emisor está en Europa (España, Francia, Alemania, Italia, etc.) por la dirección, CIF/NIF, ciudad o moneda (EUR, GBP, etc.).\n`;
  context += `2. Tipo de Factura (invoice_type):\n`;
  context += `   - "simplified": Ticket de caja, TPV o factura simplificada expedida al consumidor final sin NIF/CIF ni datos fiscales completos del cliente comprador.\n`;
  context += `     ¡IMPERATIVO LEGAL EN EUROPA!: En una Factura Simplificada, TODOS los precios unitarios e importes mostrados de los productos YA INCLUYEN EL IVA POR LEY (Art. 7.1.f RD 1619/2012 / Directiva 2006/112/CE / Ley de Consumidores). Por tanto: tax_included=true para todos los productos, y su precio neto sin IVA se deduce decrementando el impuesto.\n`;
  context += `   - "full": Factura completa u ordinaria (B2B o con datos fiscales del comprador: NIF/CIF, razón social y domicilio fiscal). Puede detallar bases imponibles netas antes de impuestos o precios con IVA.\n`;
  context += `   - "standard" / "other": Facturas de fuera de Europa (ej. EE.UU. donde el Sales Tax se añade al final).\n`;
  context += `3. Legislación aplicable (tax_legislation):\n`;
  context += `   - "ES_RD_1619_2012" si el emisor es de España.\n`;
  context += `   - "EU_DIRECTIVE_2006_112" si es de otro país de la Unión Europea.\n`;
  context += `   - "UK_VAT_ACT_1994" si es de Reino Unido.\n`;
  context += `   - "US_SALES_TAX" si es de Estados Unidos.\n`;
  context += `   - "NON_EU" para otros países.\n`;
  context += `----------------------------------------------------------`;
  return context;
}

