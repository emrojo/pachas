import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyJwt } from '@/lib/auth/jwt';
import { ExpenseCategory } from '@/types/database';

export interface SensitiveBox {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  label?: string;
}

export interface VisionScanResult {
  title?: string;
  amount?: number;
  amountFormatted?: string;
  date?: string; // YYYY-MM-DDTHH:mm
  category?: ExpenseCategory;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  currency?: string;
  sensitiveBoxes?: SensitiveBox[];
  confidence: number;
  source: string;
}

const VALID_CATEGORIES: ExpenseCategory[] = [
  'food',
  'shopping',
  'transport',
  'accommodation',
  'activities',
  'other',
];

export function getGeminiApiKey(): string | undefined {
  const sanitizeKey = (raw?: string) => {
    if (!raw) return undefined;
    let clean = raw.trim().replace(/^["']|["']$/g, '').trim();
    // Ignore example placeholder
    if (!clean || clean.startsWith('AIzaSy...') || clean === 'tu_api_key_aqui') {
      return undefined;
    }
    return clean;
  };

  // 1. Direct process.env check
  const envKey = sanitizeKey(process.env.GEMINI_API_KEY);
  if (envKey) return envKey;

  // 2. Direct filesystem read from deploy/.env.production, .env.production, etc.
  const candidatePaths = [
    path.resolve(process.cwd(), 'deploy/.env.production'),
    path.resolve(process.cwd(), '.env.production'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'deploy/.env'),
    path.resolve(process.cwd(), '.env'),
    '/app/deploy/.env.production',
    '/app/.env.production',
    '/app/.env.local',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(/* turbopackIgnore: true */ p)) {
        const content = fs.readFileSync(/* turbopackIgnore: true */ p, 'utf-8');
        const match = content.match(/^\s*GEMINI_API_KEY\s*=\s*(?:["']?)([^#\r\n"']+)(?:["']?)/m);
        if (match && match[1]) {
          const key = sanitizeKey(match[1]);
          if (key) {
            process.env.GEMINI_API_KEY = key;
            console.log(`[Gemini OCR] 🔑 GEMINI_API_KEY cargada con éxito desde ${p}`);
            return key;
          }
        }
      }
    } catch {}
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Session verification (Optional in local mode, enforced when tokens present)
    const token = request.cookies.get('sb-access-token')?.value;
    if (token) {
      const payload = await verifyJwt(token);
      if (!payload?.sub) {
        // Token exists but is invalid
        return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 });
      }
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey || !apiKey.trim()) {
      console.log('[Gemini OCR] ⚠️ GEMINI_API_KEY no configurada. Activando fallback a OCR local.');
      return NextResponse.json(
        {
          fallback: true,
          message: 'GEMINI_API_KEY no configurada. Usando OCR local en el cliente.',
        },
        { status: 200 }
      );
    }

    const body = await request.json();
    const { image } = body;

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Se requiere imagen en formato data URL o base64' }, { status: 400 });
    }

    // 2. Parse MIME type and clean base64 data
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const base64Data = match ? match[2] : image;

    if (!base64Data || base64Data.length < 50) {
      return NextResponse.json({ error: 'Datos de imagen insuficientes' }, { status: 400 });
    }

    // 3. System prompt for structured receipt extraction with sensitive information detection
    const prompt = `Analiza detalladamente esta fotografía de un ticket, factura o recibo de compra (restaurante, supermercado, hotel, transporte, etc.).
Extrae la información económica clave con máxima precisión y detecta cualquier dato bancario o sensible para su censura. Responde ESTRICTAMENTE en formato JSON válido sin texto adicional.

Esquema JSON requerido:
{
  "title": "Nombre comercial del comercio, tienda o restaurante (limpio, sin CIF/NIF, dirección ni palabras como S.L.)",
  "amount": 0.00,
  "amountFormatted": "0,00",
  "date": "YYYY-MM-DDTHH:mm",
  "category": "food" | "shopping" | "transport" | "accommodation" | "activities" | "other",
  "locationName": "Dirección física (calle, número, código postal y/o ciudad) del establecimiento si aparece en el ticket (ej: 'C/ Gran Vía 28, Madrid') o null",
  "currency": "EUR",
  "sensitiveBoxes": [
    {
      "box_2d": [ymin, xmin, ymax, xmax],
      "label": "Datos de tarjeta / Banco / DNI"
    }
  ]
}

Reglas críticas de extracción:
1. amount: Número decimal puro (ej: 42.50). Busca el total final pagado (TOTAL, TOTAL FACTURA, IMPORTE A PAGAR, TOTAL EUR/€). Nunca tomes subtotales ni bases imponibles si hay un total final con impuestos.
2. amountFormatted: Representación con coma decimal europea (ej: "42,50").
3. date: Fecha y hora EXACTA en formato ISO "YYYY-MM-DDTHH:mm". Busca activamente la hora y minutos impresos en el ticket (ej: 14:35 o 21:10). Si solo aparece fecha sin hora, usa las 12:00. Si el año no aparece, usa el año actual.
4. category: Clasifica según el negocio:
   - "food": restaurantes, bares, cafeterías, tapas, pizzas, comida rápida.
   - "shopping": supermercados (Mercadona, Carrefour, Lidl, Día), tiendas, farmacias, ropa, compras generales.
   - "transport": taxis, uber, gasolina/gasolineras (Repsol, Cepsa), billetes de tren, metro, autobús, peajes, parkings, vuelos.
   - "accommodation": hoteles, hostales, pensiones, airbnb, campings.
   - "activities": museos, cine, teatro, parques de atracciones, tours, excursiones, espectáculos.
   - "other": cualquier otro concepto.
5. locationName: Dirección o ciudad del comercio encontrada en el ticket. Si no hay dirección legible, devuelve null.
6. title: El nombre comercial más visible (ej: "Mercadona", "Restaurante El Faro", "Repsol", "Burger King", "Zara").
7. sensitiveBoxes: Coordenadas de cajas delimitadoras normalizadas [ymin, xmin, ymax, xmax] en escala de 0 a 1000 que cubran información bancaria o sensible:
   - Números de tarjeta de crédito/débito (PAN, **** 1234, fecha caducidad, tipo de tarjeta).
   - Datos bancarios, números de cuenta, IBAN, códigos de autorización de datáfono, PINs o firmas.
   - DNI/NIF/CIF del cliente, nombres personales o teléfonos privados del comprador.
   Si no hay información sensible presente en la imagen, devuelve un array vacío: [].
8. IMPORTANTE: Devuelve EXCLUSIVAMENTE el objeto JSON que empieza por { y termina por }, sin explicaciones, ni saludos, ni texto conversacional antes o después.`;

    // 4. Call Google Gemini Vision API with expanded cascade and dynamic ListModels discovery
    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
    ];

    let lastError = '';
    let rawContent = '';
    let successfulModel = 'gemini-1.5-flash';

    // Helper to send generateContent request to a specific model name
    const tryGenerateWithModel = async (modelName: string): Promise<string | null> => {
      try {
        const cleanName = modelName.replace(/^models\//, '');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:generateContent?key=${apiKey}`;

        console.log(`[Gemini OCR] 📸 Probando modelo: ${cleanName}...`);

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                  {
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        });

        clearTimeout(timeoutId);

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            successfulModel = cleanName;
            return text;
          }
        } else {
          const errText = await geminiResponse.text().catch(() => '');
          lastError = `HTTP ${geminiResponse.status} (${cleanName}): ${errText}`;
          console.warn(`[Gemini OCR] ${cleanName} no disponible:`, lastError);
        }
      } catch (err: any) {
        lastError = err.message || 'Error de conexión';
      }
      return null;
    };

    // First attempt: try direct candidate models
    for (const m of candidateModels) {
      const resText = await tryGenerateWithModel(m);
      if (resText) {
        rawContent = resText;
        break;
      }
    }

    // Second attempt: if direct candidates fail, query Google ListModels API to discover available models for this key
    if (!rawContent) {
      try {
        console.log('[Gemini OCR] 🔍 Consultando ModelService.ListModels para descubrir modelos disponibles...');
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await fetch(listUrl);
        if (listRes.ok) {
          const listData = await listRes.json();
          // Filter ONLY multimodal vision Gemini models (exclude text-only gemma, embeddings, aqa)
          const available = (listData.models || [])
            .filter((m: any) =>
              m.supportedGenerationMethods?.includes('generateContent') &&
              m.name.toLowerCase().includes('gemini') &&
              !m.name.toLowerCase().includes('gemma') &&
              !m.name.toLowerCase().includes('embedding') &&
              !m.name.toLowerCase().includes('aqa') &&
              !m.name.toLowerCase().includes('imagen')
            )
            .map((m: any) => m.name)
            .sort((a: string, b: string) => {
              const aFlash = a.includes('flash') ? 0 : 1;
              const bFlash = b.includes('flash') ? 0 : 1;
              return aFlash - bFlash;
            });

          console.log('[Gemini OCR] 📋 Modelos Gemini visión disponibles:', available);

          for (const discoveredModel of available) {
            const resText = await tryGenerateWithModel(discoveredModel);
            if (resText) {
              rawContent = resText;
              break;
            }
          }
        } else {
          const listErr = await listRes.text().catch(() => '');
          lastError = `ListModels HTTP ${listRes.status}: ${listErr}`;
          console.warn('[Gemini OCR] Error en ListModels:', lastError);
        }
      } catch (listExc: any) {
        lastError = `ListModels Exception: ${listExc.message}`;
      }
    }

    if (!rawContent) {
      return NextResponse.json(
        {
          fallback: true,
          error: `No se pudo procesar con Gemini: ${lastError}`,
        },
        { status: 200 }
      );
    }

    // 5. Parse and validate JSON output (robust multi-tier fault-tolerant extraction)
    const extractJson = (text: string): any => {
      if (!text || typeof text !== 'string') return null;

      const cleanCandidate = (s: string) =>
        s
          .replace(/```(?:json)?/gi, '')
          .replace(/```/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*/g, '')
          .replace(/,\s*([}\]])/g, '$1')
          .trim();

      // 1. Direct parse attempt
      try {
        return JSON.parse(text.trim());
      } catch {}

      // 2. Parse on cleaned candidate
      try {
        return JSON.parse(cleanCandidate(text));
      } catch {}

      // 3. Markdown code fence extraction ```json ... ``` or ``` ... ```
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch && fenceMatch[1]) {
        try {
          return JSON.parse(fenceMatch[1].trim());
        } catch {}
        try {
          return JSON.parse(cleanCandidate(fenceMatch[1]));
        } catch {}
      }

      // 4. Outermost curly braces extraction { ... }
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch && braceMatch[0]) {
        try {
          return JSON.parse(braceMatch[0].trim());
        } catch {}
        try {
          return JSON.parse(cleanCandidate(braceMatch[0]));
        } catch {}
      }

      // 5. Regex key-value extraction fallback
      try {
        const titleMatch = text.match(/"?title"?\s*:\s*["']?([^"',}\n\r]+)["']?/i);
        const amountMatch = text.match(/"?amount"?\s*:\s*["']?([0-9]+(?:[.,][0-9]{1,2})?)["']?/i);
        const dateMatch = text.match(/"?date"?\s*:\s*["']?([^"',}\n\r]+)["']?/i);
        const categoryMatch = text.match(/"?category"?\s*:\s*["']?([^"',}\n\r]+)["']?/i);
        const locMatch = text.match(/"?locationName"?\s*:\s*["']?([^"',}\n\r]+)["']?/i);

        let parsedAmount: number | undefined;
        if (amountMatch && amountMatch[1]) {
          const num = parseFloat(amountMatch[1].replace(',', '.'));
          if (!isNaN(num)) parsedAmount = num;
        }

        if (titleMatch || parsedAmount !== undefined) {
          return {
            title: titleMatch ? titleMatch[1].trim() : undefined,
            amount: parsedAmount,
            date: dateMatch ? dateMatch[1].trim() : undefined,
            category: categoryMatch ? categoryMatch[1].trim() : undefined,
            locationName: locMatch ? locMatch[1].trim() : undefined,
          };
        }
      } catch {}

      // 6. Heuristic line-by-line fallback from raw text if model outputted plain text
      try {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const monetaryRegex = /(\d{1,5}[.,]\d{2})/;
        let foundAmount: number | undefined;
        for (let i = lines.length - 1; i >= 0; i--) {
          const m = lines[i].match(monetaryRegex);
          if (m) {
            const val = parseFloat(m[1].replace(',', '.'));
            if (!isNaN(val) && val > 0 && val < 50000) {
              foundAmount = val;
              break;
            }
          }
        }
        const firstLine = lines.find((l) => !l.startsWith('{') && !l.startsWith('```') && l.length > 2 && l.length < 50);
        if (foundAmount !== undefined || firstLine) {
          return {
            title: firstLine || 'Ticket escaneado',
            amount: foundAmount,
            category: 'food',
          };
        }
      } catch {}

      return null;
    };

    const parsed = extractJson(rawContent) || {
      title: 'Ticket escaneado',
      category: 'food',
    };

    const detectedAmount = typeof parsed.amount === 'number' && !isNaN(parsed.amount) ? Math.round(parsed.amount * 100) / 100 : undefined;
    const detectedAmountFormatted = detectedAmount !== undefined
      ? parsed.amountFormatted || detectedAmount.toFixed(2).replace('.', ',')
      : undefined;

    const detectedCategory: ExpenseCategory = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'food';

    const detectedLocationName = parsed.locationName ? String(parsed.locationName).trim() : undefined;

    // 6. Geocode address to resolve GPS coordinates & Google Maps location
    let detectedLatitude: number | undefined;
    let detectedLongitude: number | undefined;
    let detectedMapsUrl: string | undefined;

    if (detectedLocationName) {
      const queriesToTry = [
        detectedLocationName,
        parsed.title ? `${parsed.title}, ${detectedLocationName}` : undefined,
        detectedLocationName.replace(/^[Cc]\/|calle|avda|avenida|pza|plaza/i, '').trim(),
      ].filter(Boolean) as string[];

      for (const query of queriesToTry) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
          const geoRes = await fetch(geoUrl, {
            headers: {
              'User-Agent': 'Pachas-Receipt-Scanner/1.0',
              'Accept-Language': 'es,en',
            },
            signal: AbortSignal.timeout(3000),
          });
          if (geoRes.ok) {
            const geoList = await geoRes.json();
            if (geoList && geoList.length > 0) {
              const lat = parseFloat(geoList[0].lat);
              const lon = parseFloat(geoList[0].lon);
              if (!isNaN(lat) && !isNaN(lon)) {
                detectedLatitude = Math.round(lat * 100000) / 100000;
                detectedLongitude = Math.round(lon * 100000) / 100000;
                detectedMapsUrl = `https://www.google.com/maps?q=${detectedLatitude},${detectedLongitude}`;
                console.log(`[Gemini OCR] 📍 Coordenadas geolocalizadas: lat=${detectedLatitude}, lon=${detectedLongitude} (${detectedMapsUrl})`);
                break;
              }
            }
          }
        } catch {}
      }
    }

    const cleanTitle = (raw: string | undefined): string | undefined => {
      if (!raw || typeof raw !== 'string') return undefined;
      let t = raw
        .replace(/^[\d\.\s\*\-]+/, '')
        .replace(/\*\*/g, '')
        .replace(/^(?:title|nombre|comercio|establecimiento|merchant)\s*:\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (/^(?:currency|amount|date|category|total|importe|subtotal|fecha|iva|cif|nif)/i.test(t) || t.length < 2) {
        return undefined;
      }
      return t || undefined;
    };

    const normalizeOcrDateTime = (rawDate: string | undefined, text: string): string | undefined => {
      if (!rawDate && !text) return undefined;
      const combined = `${rawDate || ''} ${text}`;

      // Search for time pattern: HH:mm or HH:mm:ss
      let foundTime = '';
      const timeMatch = combined.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/);
      if (timeMatch) {
        foundTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      }

      if (rawDate) {
        const clean = String(rawDate).trim();
        // Match ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm
        const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
        if (isoMatch) {
          const y = isoMatch[1];
          const m = isoMatch[2];
          const d = isoMatch[3];
          const time = isoMatch[4] ? `${isoMatch[4]}:${isoMatch[5]}` : foundTime || '12:00';
          return `${y}-${m}-${d}T${time}`;
        }

        // Match European DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        const euMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:[T\s](\d{2}):(\d{2}))?/);
        if (euMatch) {
          const d = euMatch[1].padStart(2, '0');
          const m = euMatch[2].padStart(2, '0');
          let y = euMatch[3];
          if (y.length === 2) y = `20${y}`;
          const time = euMatch[4] ? `${euMatch[4]}:${euMatch[5]}` : foundTime || '12:00';
          return `${y}-${m}-${d}T${time}`;
        }
      }

      // If rawDate wasn't provided or didn't parse, try finding date in full text
      const dateMatchInText = text.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);
      if (dateMatchInText) {
        const d = dateMatchInText[1].padStart(2, '0');
        const m = dateMatchInText[2].padStart(2, '0');
        let y = dateMatchInText[3];
        if (y.length === 2) y = `20${y}`;
        const time = foundTime || '12:00';
        return `${y}-${m}-${d}T${time}`;
      }

      return rawDate ? String(rawDate).trim() : undefined;
    };

    const sanitizeSensitiveBoxes = (rawBoxes: any): SensitiveBox[] => {
      if (!Array.isArray(rawBoxes)) return [];
      return rawBoxes
        .filter((b) => b && Array.isArray(b.box_2d) && b.box_2d.length === 4)
        .map((b) => {
          const coords = b.box_2d.map((val: any) => {
            const num = Number(val);
            if (isNaN(num)) return 0;
            return num <= 1.0 && num > 0 ? Math.round(num * 1000) : Math.min(1000, Math.max(0, Math.round(num)));
          }) as [number, number, number, number];
          return {
            box_2d: coords,
            label: typeof b.label === 'string' ? b.label.slice(0, 100) : 'Información sensible',
          };
        });
    };

    const result: VisionScanResult = {
      title: cleanTitle(parsed.title),
      amount: detectedAmount,
      amountFormatted: detectedAmountFormatted,
      date: normalizeOcrDateTime(parsed.date, rawContent),
      category: detectedCategory,
      locationName: detectedLocationName,
      latitude: detectedLatitude,
      longitude: detectedLongitude,
      mapsUrl: detectedMapsUrl,
      currency: parsed.currency || 'EUR',
      sensitiveBoxes: sanitizeSensitiveBoxes(parsed.sensitiveBoxes),
      confidence: detectedAmount ? 0.98 : 0.7,
      source: successfulModel || 'gemini-1.5-flash',
    };

    console.log(`[Gemini 1.5 Flash] ✨ Resultado extraído con éxito: Comercio="${result.title}", Total=${result.amount}€, Fecha=${result.date}, Categoría=${result.category}, Ubicación="${result.locationName || 'N/A'}", GPS=${result.latitude ? `${result.latitude},${result.longitude}` : 'No'}`);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.warn('[Gemini OCR] Exception scanning receipt:', err);
    return NextResponse.json(
      {
        fallback: true,
        error: err.name === 'AbortError' ? 'Timeout en Gemini API' : err.message,
      },
      { status: 200 }
    );
  }
}
