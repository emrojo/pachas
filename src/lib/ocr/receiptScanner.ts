import { ExpenseCategory } from '@/types/database';

export interface ScannedReceiptData {
  amount?: number;
  amountFormatted?: string;
  date?: string; // YYYY-MM-DDTHH:mm
  title?: string;
  category?: ExpenseCategory;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  currency?: string;
  rawText?: string;
  confidence: number;
  source?: string;
}

/**
 * Category keyword patterns for auto-categorization
 */
const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  food: [
    'restaurante', 'restaurant', 'cafe', 'cafeteria', 'bar', 'tapas', 'pizza', 'pizzeria',
    'burger', 'hamburgues', 'taberna', 'cerveceria', 'bistro', 'comida', 'cena', 'almuerzo',
    'desayuno', 'menu', 'sushi', 'chiringuito', 'brunch', 'vinos', 'coctel'
  ],
  shopping: [
    'supermercado', 'supermarket', 'mercadona', 'carrefour', 'lidl', 'dia', 'eroski',
    'aldi', 'alcampo', 'hipercor', 'fruteria', 'panaderia', 'carniceria', 'compra',
    'alimentacion', 'market', 'groceries', 'bazar', 'tienda', 'zara', 'shopping'
  ],
  transport: [
    'taxi', 'uber', 'cabify', 'bolt', 'renfe', 'ave', 'metro', 'bus', 'autobus',
    'gasolina', 'combustible', 'gasolinera', 'repsol', 'cepsa', 'bp', 'shell', 'galp',
    'peaje', 'autopista', 'aparcamiento', 'parking', 'vuelo', 'ryanair', 'vueling', 'iberia'
  ],
  accommodation: [
    'hotel', 'hostal', 'pension', 'airbnb', 'booking', 'resort', 'apartamento',
    'habitacion', 'alojamiento', 'stay', 'motel', 'camping', 'suite'
  ],
  activities: [
    'entrada', 'ticket', 'museo', 'museum', 'cine', 'teatro', 'concierto', 'festival',
    'tour', 'excursion', 'barco', 'crucero', 'parque', 'atracciones', 'show', 'bolos',
    'escape', 'karting', 'aventura', 'alquiler'
  ],
  other: [],
};

/**
 * Parses raw text extracted from a receipt to find:
 * 1. Total amount (€, $, etc.)
 * 2. Date
 * 3. Title / Merchant name
 * 4. Suggested category
 */
export function parseReceiptText(rawText: string): ScannedReceiptData {
  if (!rawText || !rawText.trim()) {
    return { rawText: '', confidence: 0 };
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let detectedAmount: number | undefined;
  let detectedAmountStr: string | undefined;
  let detectedDate: string | undefined;
  let detectedTitle: string | undefined;
  let detectedCategory: ExpenseCategory | undefined;

  // 1. EXTRACT TOTAL AMOUNT
  // Patterns like: "TOTAL: 45,80", "TOTAL EUR 45.80", "IMPORTE: 120,00 €", "SUMA 15,50"
  const totalKeywords = ['total', 'importe', 'suma', 'subtotal', 'pagar', 'cobrado', 'amount', 'tarjeta', 'visa', 'mastercard'];
  const monetaryRegex = /(?:total|importe|suma|pagar|cobrado|amount|eur|€)?\s*[:=\s]?\s*(\d{1,5}[,\.]\d{2})\s*(?:€|eur|usd|\$)?/i;

  // Check lines containing total keywords first
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const hasTotalKeyword = totalKeywords.some((kw) => lower.includes(kw));

    if (hasTotalKeyword) {
      const match = line.match(/(\d{1,5}[,\.]\d{2})/);
      if (match) {
        const num = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(num) && num > 0) {
          detectedAmount = num;
          detectedAmountStr = match[1].replace('.', ',');
          break;
        }
      }
    }
  }

  // Fallback: If no explicit total line matched, find all monetary numbers and pick the maximum
  if (!detectedAmount) {
    const allNumbers: number[] = [];
    for (const line of lines) {
      const matches = line.matchAll(/(\d{1,5}[,\.]\d{2})/g);
      for (const m of matches) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(val) && val > 0 && val < 50000) {
          allNumbers.push(val);
        }
      }
    }
    if (allNumbers.length > 0) {
      detectedAmount = Math.max(...allNumbers);
      detectedAmountStr = detectedAmount.toFixed(2).replace('.', ',');
    }
  }

  // 2. EXTRACT DATE
  // Patterns: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
  const datePatterns = [
    /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\b/, // 29/08/2026 or 29-08-2026
    /\b(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})\b/, // 2026-08-29
    /\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2})\b/,   // 29/08/26
  ];

  // Optional time pattern: HH:MM
  let detectedTime = '12:00';
  for (const line of lines) {
    const timeMatch = line.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
    if (timeMatch) {
      detectedTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      break;
    }
  }

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        let day: number, month: number, year: number;
        if (match[3].length === 4) {
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        } else if (match[1].length === 4) {
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
        } else {
          day = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          year = 2000 + parseInt(match[3], 10);
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2050) {
          const pad = (n: number) => (n < 10 ? '0' : '') + n;
          detectedDate = `${year}-${pad(month)}-${pad(day)}T${detectedTime}`;
          break;
        }
      }
    }
    if (detectedDate) break;
  }

  // 3. EXTRACT TITLE / MERCHANT NAME
  // Skip tax IDs (CIF, NIF, B12345678), "FACTURA SIMPLIFICADA", purely numeric lines
  const ignorePatterns = [
    /cif/i, /nif/i, /iva/i, /factura/i, /simplificada/i, /ticket/i, /recibo/i,
    /telefono/i, /tel/i, /fecha/i, /hora/i, /terminal/i, /tpv/i, /operacion/i,
    /^\d+$/, /^[0-9\s\.\,\:\-\/\\]+$/
  ];

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    const shouldIgnore = ignorePatterns.some((p) => p.test(line));
    if (!shouldIgnore && line.length >= 3 && line.length <= 50) {
      // Capitalize cleanly
      detectedTitle = line
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      break;
    }
  }

  // 4. EXTRACT LOCATION / ADDRESS
  let detectedLocation: string | undefined;
  const addressRegex = /(?:c\/|calle|avda|avenida|plaza|pza|p\.º|paseo|crta|carretera|poligono|pol\.)\s+[^,\n\r]+/i;
  for (const line of lines) {
    if (addressRegex.test(line) && line.length >= 6 && line.length <= 80) {
      detectedLocation = line.trim();
      break;
    }
  }

  // 5. DETECT CATEGORY
  const fullTextLower = rawText.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (cat === 'other') continue;
    if (keywords.some((kw) => fullTextLower.includes(kw))) {
      detectedCategory = cat as ExpenseCategory;
      break;
    }
  }

  // Calculate confidence score (0 to 1)
  let score = 0;
  if (detectedAmount) score += 0.40;
  if (detectedDate) score += 0.25;
  if (detectedTitle) score += 0.15;
  if (detectedLocation) score += 0.10;
  if (detectedCategory) score += 0.10;

  return {
    amount: detectedAmount,
    amountFormatted: detectedAmountStr,
    date: detectedDate,
    title: detectedTitle,
    category: detectedCategory,
    locationName: detectedLocation,
    rawText,
    confidence: Math.round(score * 100) / 100,
  };
}

/**
 * Intelligent Receipt Scanner
 * 1. Prioritizes Multimodal AI Vision (Google Gemini 1.5 Flash) via /api/ocr/scan for ~99% accuracy.
 * 2. Gracefully falls back to local client OCR (tesseract.js) if offline or API key not configured.
 */
export async function scanReceipt(imageDataUrl: string): Promise<ScannedReceiptData> {
  if (!imageDataUrl) {
    return { rawText: '', confidence: 0 };
  }

  // 1. Try Gemini 1.5 Flash Vision via Server Endpoint
  try {
    const res = await fetch('/api/ocr/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageDataUrl }),
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(45000) : undefined,
    });

    if (res.ok) {
      const json = await res.json();
      console.log('[ReceiptScanner] /api/ocr/scan response:', json);
      if (json.success && json.data) {
        const d = json.data;
        return {
          amount: d.amount,
          amountFormatted: d.amountFormatted,
          date: d.date,
          title: d.title,
          category: d.category,
          locationName: d.locationName,
          latitude: d.latitude,
          longitude: d.longitude,
          mapsUrl: d.mapsUrl,
          currency: d.currency,
          confidence: d.confidence || 0.98,
          source: d.source || 'gemini-1.5-flash',
        };
      } else if (json.fallback) {
        console.warn('[ReceiptScanner] Servidor solicitó fallback:', json.message || json.error);
      }
    } else {
      console.warn(`[ReceiptScanner] /api/ocr/scan respondió con código HTTP ${res.status}`);
    }
  } catch (visionErr) {
    console.warn('[ReceiptScanner] Gemini Vision API no disponible, usando OCR local:', visionErr);
  }

  // 2. Fallback to Local Client-Side OCR (tesseract.js with 10s timeout)
  try {
    const tesseractPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa+eng');
      const ret = await worker.recognize(imageDataUrl);
      await worker.terminate();
      return ret.data.text || '';
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract local OCR timeout')), 10000)
    );

    const text = await Promise.race([tesseractPromise, timeoutPromise]);
    const parsed = parseReceiptText(text);
    return {
      ...parsed,
      source: 'tesseract-ocr',
    };
  } catch (err) {
    console.warn('[ReceiptScanner] Local OCR fallback error:', err);
    return {
      ...parseReceiptText(''),
      source: 'tesseract-ocr',
    };
  }
}
