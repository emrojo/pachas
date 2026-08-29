import { describe, it, expect } from 'vitest';
import { parseReceiptText } from './receiptScanner';

describe('OCR Receipt Scanner Text Parsing Engine', () => {
  it('extracts total amount from restaurant receipt text with European decimals', () => {
    const receiptSample = `
      RESTAURANTE EL FARO
      NIF: B-12345678
      CALLE MAYOR 12, MADRID
      FECHA: 29/08/2026 14:35
      ------------------------
      2x PAELLA MIXTA    32,00
      1x ENSALADA VERDE   7,50
      2x CERVEZA ESTRELLA 6,00
      1x CAFE SOLO        1,80
      ------------------------
      BASE IMPONIBLE:    42,91
      IVA (10%):          4,39
      TOTAL:             47,30 EUR
      FORMA DE PAGO: TARJETA
    `;

    const data = parseReceiptText(receiptSample);
    expect(data.amount).toBe(47.30);
    expect(data.amountFormatted).toBe('47,30');
    expect(data.date).toBe('2026-08-29T14:35');
    expect(data.title).toBe('Restaurante El Faro');
    expect(data.category).toBe('food');
    expect(data.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('extracts supermarket groceries ticket details', () => {
    const supermarketSample = `
      SUPERMERCADO MERCADONA
      FACTURA SIMPLIFICADA: 2026-08912
      FECHA: 15/07/2026 19:10
      LECHE ENTERA       1,20
      PAN ARTESANO       0,95
      AGUA MINERAL       0,60
      FRUTA VARIADA      4,50
      TOTAL FACTURA:     7,25 €
      PAGADO CON VISA
    `;

    const data = parseReceiptText(supermarketSample);
    expect(data.amount).toBe(7.25);
    expect(data.amountFormatted).toBe('7,25');
    expect(data.date).toBe('2026-07-15T19:10');
    expect(data.title).toBe('Supermercado Mercadona');
    expect(data.category).toBe('shopping');
  });

  it('extracts transport and gas station receipts', () => {
    const gasSample = `
      ESTACION DE SERVICIO REPSOL
      AUTOPISTA A-6 KM 45
      20-08-2026 09:20
      DIESEL PLUS 35L
      IMPORTE TOTAL: 55,40 EUR
      GRACIAS POR SU VISITA
    `;

    const data = parseReceiptText(gasSample);
    expect(data.amount).toBe(55.40);
    expect(data.amountFormatted).toBe('55,40');
    expect(data.date).toBe('2026-08-20T09:20');
    expect(data.category).toBe('transport');
  });

  it('extracts hotel and accommodation receipts', () => {
    const hotelSample = `
      HOTEL PLAYA GRANDE
      CHECKOUT: 2026-08-10 11:00
      HABITACION DOBLE 2 NOCHES
      TOTAL PAGAR: 240,00 €
    `;

    const data = parseReceiptText(hotelSample);
    expect(data.amount).toBe(240.00);
    expect(data.amountFormatted).toBe('240,00');
    expect(data.date).toBe('2026-08-10T11:00');
    expect(data.category).toBe('accommodation');
  });

  it('handles empty or unparseable text safely without crashing', () => {
    const emptyResult = parseReceiptText('');
    expect(emptyResult.amount).toBeUndefined();
    expect(emptyResult.confidence).toBe(0);

    const noisyResult = parseReceiptText('asdfghjkl qwerty 12345');
    expect(noisyResult.rawText).toBeDefined();
  });
});
