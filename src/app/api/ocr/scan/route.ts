import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyJwt } from '@/lib/auth/jwt';
import { ExpenseCategory } from '@/types/database';

export interface VisionScanResult {
  title?: string;
  amount?: number;
  amountFormatted?: string;
  date?: string; // YYYY-MM-DDTHH:mm
  category?: ExpenseCategory;
  currency?: string;
  confidence: number;
  source: 'gemini-1.5-flash' | 'fallback';
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

    // 3. System prompt for structured receipt extraction
    const prompt = `Analiza detalladamente esta fotografía de un ticket, factura o recibo de compra (restaurante, supermercado, hotel, transporte, etc.).
Extrae la información económica clave con máxima precisión y responde ESTRICTAMENTE en formato JSON válido sin texto adicional.

Esquema JSON requerido:
{
  "title": "Nombre comercial del comercio, tienda o restaurante (limpio, sin CIF/NIF, dirección ni palabras como S.L.)",
  "amount": 0.00,
  "amountFormatted": "0,00",
  "date": "YYYY-MM-DDTHH:mm",
  "category": "food" | "shopping" | "transport" | "accommodation" | "activities" | "other",
  "currency": "EUR"
}

Reglas críticas de extracción:
1. amount: Número decimal puro (ej: 42.50). Busca el total final pagado (TOTAL, TOTAL FACTURA, IMPORTE A PAGAR, TOTAL EUR/€). Nunca tomes subtotales ni bases imponibles si hay un total final con impuestos.
2. amountFormatted: Representación con coma decimal europea (ej: "42,50").
3. date: Fecha y hora en formato ISO "YYYY-MM-DDTHH:mm". Si no se indican minutos o solo fecha, usa las 12:00 (ej: "2026-08-15T12:00"). Si el año no aparece, usa el año actual.
4. category: Clasifica según el negocio:
   - "food": restaurantes, bares, cafeterías, tapas, pizzas, comida rápida.
   - "shopping": supermercados (Mercadona, Carrefour, Lidl, Día), tiendas, farmacias, ropa, compras generales.
   - "transport": taxis, uber, gasolina/gasolineras (Repsol, Cepsa), billetes de tren, metro, autobús, peajes, parkings, vuelos.
   - "accommodation": hoteles, hostales, pensiones, airbnb, campings.
   - "activities": museos, cine, teatro, parques de atracciones, tours, excursiones, espectáculos.
   - "other": cualquier otro concepto.
5. title: El nombre comercial más visible (ej: "Mercadona", "Restaurante El Faro", "Repsol", "Burger King", "Zara").`;

    // 4. Call Google Gemini 1.5 Flash API with 12s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    console.log(`[Gemini 1.5 Flash] 📸 Procesando ticket con IA de Visión (tamaño base64: ${base64Data.length} chars)...`);
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

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text().catch(() => '');
      console.warn(`[Gemini OCR] Error ${geminiResponse.status} from Gemini API:`, errText);
      return NextResponse.json(
        {
          fallback: true,
          error: `Gemini API error: ${geminiResponse.status}`,
        },
        { status: 200 }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json({ fallback: true, error: 'Respuesta vacía de Gemini' }, { status: 200 });
    }

    // 5. Parse and validate JSON output
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent.trim());
    } catch {
      // Clean possible markdown code fences (```json ... ```)
      const cleaned = rawContent.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const detectedAmount = typeof parsed.amount === 'number' && !isNaN(parsed.amount) ? Math.round(parsed.amount * 100) / 100 : undefined;
    const detectedAmountFormatted = detectedAmount !== undefined
      ? parsed.amountFormatted || detectedAmount.toFixed(2).replace('.', ',')
      : undefined;

    const detectedCategory: ExpenseCategory = VALID_CATEGORIES.includes(parsed.category)
      ? parsed.category
      : 'food';

    const result: VisionScanResult = {
      title: parsed.title ? String(parsed.title).trim() : undefined,
      amount: detectedAmount,
      amountFormatted: detectedAmountFormatted,
      date: parsed.date ? String(parsed.date).trim() : undefined,
      category: detectedCategory,
      currency: parsed.currency || 'EUR',
      confidence: 0.98,
      source: 'gemini-1.5-flash',
    };

    console.log(`[Gemini 1.5 Flash] ✨ Resultado extraído con éxito: Comercio="${result.title}", Total=${result.amount}€, Fecha=${result.date}, Categoría=${result.category}`);

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
