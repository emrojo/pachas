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
});
