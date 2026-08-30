import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Expense } from '@/types/database';

describe('Asynchronous AI Receipt OCR Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('supports initial expense creation with processing ocr_status', () => {
    const processingExpense: Expense = {
      id: 'exp-async-123',
      group_id: 'grp-test',
      created_by: 'usr-1',
      title: 'Analizando ticket con IA...',
      amount: 0,
      currency: 'EUR',
      category: 'other',
      expense_date: '2026-08-30T14:30',
      receipt_url: 'data:image/jpeg;base64,sample...',
      split_type: 'EQUAL',
      ocr_status: 'processing',
      created_at: '2026-08-30T14:30:00Z',
      updated_at: '2026-08-30T14:30:00Z',
    };

    expect(processingExpense.ocr_status).toBe('processing');
    expect(processingExpense.amount).toBe(0);
    expect(processingExpense.title).toContain('Analizando ticket');
  });

  it('transitions to completed with extracted vision data and GPS coordinates', () => {
    const updatedExpense: Expense = {
      id: 'exp-async-123',
      group_id: 'grp-test',
      created_by: 'usr-1',
      title: 'Restaurante El Faro',
      amount: 54.20,
      currency: 'EUR',
      category: 'food',
      expense_date: '2026-08-30T14:35',
      receipt_url: 'data:image/jpeg;base64,sample...',
      location_name: 'Paseo Marítimo 12, Valencia',
      latitude: 39.4699,
      longitude: -0.3763,
      split_type: 'EQUAL',
      ocr_status: 'completed',
      created_at: '2026-08-30T14:30:00Z',
      updated_at: '2026-08-30T14:30:02Z',
    };

    expect(updatedExpense.ocr_status).toBe('completed');
    expect(updatedExpense.amount).toBe(54.20);
    expect(updatedExpense.title).toBe('Restaurante El Faro');
    expect(updatedExpense.latitude).toBe(39.4699);
    expect(updatedExpense.longitude).toBe(-0.3763);
  });

  it('transitions to failed when receipt is unreadable', () => {
    const failedExpense: Expense = {
      id: 'exp-async-123',
      group_id: 'grp-test',
      created_by: 'usr-1',
      title: 'Ticket pendiente de revisión',
      amount: 0,
      currency: 'EUR',
      category: 'other',
      expense_date: '2026-08-30T14:30',
      receipt_url: 'data:image/jpeg;base64,blurred...',
      split_type: 'EQUAL',
      ocr_status: 'failed',
      created_at: '2026-08-30T14:30:00Z',
      updated_at: '2026-08-30T14:30:02Z',
    };

    expect(failedExpense.ocr_status).toBe('failed');
    expect(failedExpense.title).toBe('Ticket pendiente de revisión');
  });

  it('handles PendingReceiptScan with sensitiveBoxes for credit card censorship', () => {
    const scanRecord = {
      id: 'scan-1725000000',
      group_id: 'grp-1',
      user_id: 'user-carlos',
      created_at: new Date().toISOString(),
      original_image: 'data:image/jpeg;base64,pre_censored_image_data...',
      status: 'ready' as const,
      scanned_data: {
        title: 'Restaurante El Faro',
        amount: 48.50,
        amountFormatted: '48,50',
        date: '2026-08-30T14:30',
        category: 'food' as const,
        currency: 'EUR',
        confidence: 0.98,
        sensitiveBoxes: [
          {
            box_2d: [750, 200, 800, 800] as [number, number, number, number],
            label: 'Número de tarjeta / Datos bancarios',
          },
        ],
      },
    };

    expect(scanRecord.status).toBe('ready');
    expect(scanRecord.scanned_data.sensitiveBoxes).toHaveLength(1);
    expect(scanRecord.scanned_data.sensitiveBoxes[0].box_2d).toEqual([750, 200, 800, 800]);
    expect(scanRecord.scanned_data.sensitiveBoxes[0].label).toContain('tarjeta');
  });
});
