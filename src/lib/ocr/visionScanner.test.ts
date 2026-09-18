import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanReceipt } from './receiptScanner';

describe('Intelligent Receipt Vision Scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly processes response from Gemini 1.5 Flash API endpoint', async () => {
    const mockVisionResponse = {
      success: true,
      data: {
        title: 'Restaurante El Faro',
        amount: 48.5,
        amountFormatted: '48,50',
        date: '2026-08-30T14:30',
        category: 'food',
        locationName: 'Paseo Marítimo 12, Valencia',
        latitude: 39.4699,
        longitude: -0.3763,
        mapsUrl: 'https://www.google.com/maps?q=39.4699,-0.3763',
        currency: 'EUR',
        confidence: 0.98,
        source: 'gemini-1.5-flash',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVisionResponse,
    });

    const result = await scanReceipt('data:image/jpeg;base64,mockBase64ImageData...');

    expect(result.title).toBe('Restaurante El Faro');
    expect(result.amount).toBe(48.5);
    expect(result.amountFormatted).toBe('48,50');
    expect(result.date).toBe('2026-08-30T14:30');
    expect(result.category).toBe('food');
    expect(result.locationName).toBe('Paseo Marítimo 12, Valencia');
    expect(result.latitude).toBe(39.4699);
    expect(result.longitude).toBe(-0.3763);
    expect(result.mapsUrl).toBe('https://www.google.com/maps?q=39.4699,-0.3763');
    expect(result.source).toBe('gemini-1.5-flash');
    expect(result.confidence).toBe(0.98);
  });

  it('handles empty image input gracefully', async () => {
    const result = await scanReceipt('');
    expect(result.confidence).toBe(0);
  });

  it('correctly processes foreign receipt translation with bilingual items and translatedBoxes', async () => {
    const mockBilingualResponse = {
      success: true,
      data: {
        title: 'Trattoria Bella Napoli',
        amount: 32.0,
        amountFormatted: '32,00',
        date: '2026-09-12T20:15',
        category: 'food',
        locationName: 'Via Toledo 45, Napoli',
        detectedLanguage: 'it',
        items: [
          {
            description: 'Agua mineral',
            description_original: 'Acqua minerale',
            price: 2.5,
          },
          {
            description: 'Pizza margarita',
            description_original: 'Pizza margherita',
            price: 8.5,
          },
        ],
        translatedBoxes: [
          {
            box_2d: [120, 100, 150, 400],
            originalText: 'Acqua minerale',
            translatedText: 'Agua mineral',
          },
        ],
        confidence: 0.98,
        source: 'gemini-1.5-flash',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBilingualResponse,
    });

    const result = await scanReceipt('data:image/jpeg;base64,mockImageData...', 'es');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ocr/scan',
      expect.objectContaining({
        body: JSON.stringify({ image: 'data:image/jpeg;base64,mockImageData...', targetLanguage: 'es' }),
      })
    );

    expect(result.detectedLanguage).toBe('it');
    expect(result.items).toHaveLength(2);
    expect(result.items?.[0].description).toBe('Agua mineral');
    expect(result.items?.[0].description_original).toBe('Acqua minerale');
    expect(result.translatedBoxes).toHaveLength(1);
    expect(result.translatedBoxes?.[0].translatedText).toBe('Agua mineral');
  });

  it('reads GEMINI_API_KEY from environment or file fallback safely', async () => {
    const { getGeminiApiKey } = await import('@/app/api/ocr/scan/route');
    process.env.GEMINI_API_KEY = 'test-key-123';
    expect(getGeminiApiKey()).toBe('test-key-123');
    delete process.env.GEMINI_API_KEY;
  });

  it('correctly propagates tax_included, tax_breakdown, and item tax fields', async () => {
    const mockTaxResponse = {
      success: true,
      data: {
        title: 'Supermercado Central',
        amount: 23.50,
        amountFormatted: '23,50',
        subtotal: 21.00,
        tax_name: 'IVA',
        tax_rate: 10,
        tax_amount: 2.50,
        tax_included: true,
        items_price_includes_tax: true,
        tax_breakdown: [
          { tax_rate: 10, base_amount: 15.00, tax_amount: 1.50, total_amount: 16.50 },
          { tax_rate: 21, base_amount: 5.79, tax_amount: 1.21, total_amount: 7.00 },
        ],
        items: [
          { description: 'Alimentos', price: 16.50, tax_rate: 10, tax_amount: 1.50 },
          { description: 'Champú', price: 7.00, tax_rate: 21, tax_amount: 1.21 },
        ],
        confidence: 0.98,
        source: 'gemini-1.5-flash',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTaxResponse,
    });

    const result = await scanReceipt('data:image/jpeg;base64,sample...', 'es', 'EUR');

    expect(result.tax_name).toBe('IVA');
    expect(result.tax_included).toBe(true);
    expect(result.tax_amount).toBe(2.50);
    expect(result.tax_breakdown).toHaveLength(2);
    expect(result.items?.[0].tax_rate).toBe(10);
    expect(result.items?.[1].tax_rate).toBe(21);
    expect(result.items_price_includes_tax).toBe(true);
  });

  it('correctly parses and preserves Ollama VLM scanned result source', async () => {
    const mockOllamaResponse = {
      success: true,
      data: {
        title: 'Café Ollama Qwen',
        amount: 8.50,
        amountFormatted: '8,50',
        date: '2026-09-19T10:30',
        category: 'food',
        confidence: 0.98,
        source: 'ollama-qwen2.5vl:7b',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOllamaResponse,
    });

    const result = await scanReceipt('data:image/jpeg;base64,sample...');

    expect(result.title).toBe('Café Ollama Qwen');
    expect(result.amount).toBe(8.50);
    expect(result.source).toBe('ollama-qwen2.5vl:7b');
    expect(result.confidence).toBe(0.98);
  });
});

