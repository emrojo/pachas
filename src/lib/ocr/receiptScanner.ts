import { ExpenseCategory } from '@/types/database';

export interface SensitiveBox {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  label?: string;
}

export interface TranslatedBox {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  originalText: string;
  translatedText: string;
}

export interface ScannedLineItem {
  id?: string;
  description: string;
  description_original?: string | null;
  price: number;
}

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
  detectedLanguage?: string;
  sensitiveBoxes?: SensitiveBox[];
  translatedBoxes?: TranslatedBox[];
  receiptTranslatedUrl?: string | null;
  items?: ScannedLineItem[];
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

  // 6. EXTRACT LINE ITEMS (heuristic fallback)
  const detectedItems: ScannedLineItem[] = [];
  const itemLineRegex = /^([a-zA-Z0-9\s\.\/\-\*\(\)]{2,50}?)\s+[:=]?\s*(\d{1,4}[,\.]\d{2})\s*(?:€|eur)?$/i;
  const nonItemKeywords = [
    'total', 'subtotal', 'iva', 'base', 'importe', 'suma', 'pagar', 'cobrado',
    'tarjeta', 'visa', 'mastercard', 'cambio', 'entregado', 'nif', 'cif', 'fecha',
    'hora', 'mesa', 'factura', 'gracias', 'ticket', 'atendido', 'caja', 'terminal'
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (nonItemKeywords.some((kw) => lower.includes(kw))) continue;

    const match = trimmed.match(itemLineRegex);
    if (match && match[1] && match[2]) {
      const desc = match[1].trim();
      const pr = parseFloat(match[2].replace(',', '.'));
      if (desc.length >= 2 && !isNaN(pr) && pr > 0 && pr < 10000) {
        detectedItems.push({
          description: desc,
          price: Math.round(pr * 100) / 100,
        });
      }
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
    items: detectedItems.length > 0 ? detectedItems : undefined,
    confidence: Math.round(score * 100) / 100,
  };
}

/**
 * Renders a visual translated overlay onto the receipt image using HTML5 Canvas,
 * mirroring Google Lens / Apple Live Text style visual text replacement.
 */
export async function generateTranslatedReceiptOverlay(
  base64Image: string,
  translatedBoxes: TranslatedBox[]
): Promise<string | null> {
  if (typeof window === 'undefined' || !base64Image || !translatedBoxes || translatedBoxes.length === 0) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          // Draw the base receipt
          ctx.drawImage(img, 0, 0, w, h);

          // Render translated text pills over each detected line item / box
          for (const box of translatedBoxes) {
            if (!box.translatedText || !box.box_2d || box.box_2d.length !== 4) continue;
            const [ymin, xmin, ymax, xmax] = box.box_2d;

            const boxLeft = (xmin / 1000) * w;
            const boxTop = (ymin / 1000) * h;
            const boxW = Math.max(20, ((xmax - xmin) / 1000) * w);
            const boxH = Math.max(14, ((ymax - ymin) / 1000) * h);

            const padX = Math.max(3, boxW * 0.03);
            const padY = Math.max(2, boxH * 0.08);
            const rectX = Math.max(0, boxLeft - padX);
            const rectY = Math.max(0, boxTop - padY);
            const rectW = Math.min(w - rectX, boxW + padX * 2);
            const rectH = Math.min(h - rectY, boxH + padY * 2);

            ctx.save();
            // Semi-opaque pill background with subtle emerald highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
            ctx.lineWidth = Math.max(1, Math.round(rectH * 0.05));

            const radius = Math.min(rectH / 2, 6);
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(rectX, rectY, rectW, rectH, radius);
            } else {
              ctx.rect(rectX, rectY, rectW, rectH);
            }
            ctx.fill();
            ctx.stroke();

            // Draw crisp translated text
            ctx.fillStyle = '#0f172a'; // slate-900
            const fontSize = Math.max(9, Math.min(Math.round(rectH * 0.65), 28));
            ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            ctx.save();
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(rectX, rectY, rectW, rectH, radius);
            } else {
              ctx.rect(rectX, rectY, rectW, rectH);
            }
            ctx.clip();
            ctx.fillText(box.translatedText, rectX + padX * 1.5, rectY + rectH / 2, rectW - padX * 3);
            ctx.restore();

            ctx.restore();
          }

          // Lens watermark badge in bottom-right corner
          const badgeH = Math.max(22, Math.round(h * 0.032));
          const badgeW = Math.max(140, Math.round(w * 0.32));
          const badgeX = w - badgeW - 14;
          const badgeY = h - badgeH - 14;

          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
          } else {
            ctx.rect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.fill();

          ctx.fillStyle = '#10b981';
          ctx.font = `700 ${Math.max(10, Math.round(badgeH * 0.52))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🌐 Pachas AI Lens', badgeX + badgeW / 2, badgeY + badgeH / 2);
          ctx.restore();

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (e) {
          console.warn('[ReceiptScanner] Canvas translation error:', e);
          resolve(null);
        }
      };

      img.onerror = () => {
        resolve(null);
      };

      img.src = base64Image;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Intelligent Receipt Scanner
 * 1. Prioritizes Multimodal AI Vision (Google Gemini 1.5 Flash) via /api/ocr/scan for ~99% accuracy.
 * 2. Gracefully falls back to local client OCR (tesseract.js) if offline or API key not configured.
 */
export async function scanReceipt(imageDataUrl: string, targetLanguage: string = 'es'): Promise<ScannedReceiptData> {
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
      body: JSON.stringify({ image: imageDataUrl, targetLanguage }),
      signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(45000) : undefined,
    });

    if (res.ok) {
      const json = await res.json();
      console.log('[ReceiptScanner] /api/ocr/scan response:', json);
      if (json.success && json.data) {
        const d = json.data;

        let receiptTranslatedUrl: string | null = null;
        if (d.translatedBoxes && d.translatedBoxes.length > 0 && typeof window !== 'undefined') {
          try {
            receiptTranslatedUrl = await generateTranslatedReceiptOverlay(imageDataUrl, d.translatedBoxes);
          } catch (overlayErr) {
            console.warn('[ReceiptScanner] Overlay creation failed:', overlayErr);
          }
        }

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
          detectedLanguage: d.detectedLanguage,
          items: d.items || [],
          sensitiveBoxes: d.sensitiveBoxes || [],
          translatedBoxes: d.translatedBoxes || [],
          receiptTranslatedUrl,
          confidence: d.confidence || 0.98,
          source: d.source || 'gemini-1.5-flash',
        };
      } else if (json.fallback && json.rawText) {
        console.log('[ReceiptScanner] 📝 Extrayendo datos desde rawText del servidor...');
        const parsed = parseReceiptText(json.rawText);
        if (parsed.amount || parsed.title) {
          return {
            ...parsed,
            source: 'gemini-text-extracted',
            confidence: 0.9,
          };
        }
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
