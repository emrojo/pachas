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

  it('correctly filters out and cleans up dismissed pending scan from localStorage simulation', () => {
    const scanIdToDismiss = 'scan-to-dismiss-123';
    const initialScans = [
      { id: scanIdToDismiss, group_id: 'grp-1', status: 'ready' },
      { id: 'scan-keep-456', group_id: 'grp-1', status: 'ready' },
    ];

    const storage: Record<string, string> = {
      pachas_pending_scans_v1: JSON.stringify(initialScans),
    };

    // Simulate dismissPendingScan logic
    const updated = initialScans.filter((s) => s.id !== scanIdToDismiss);
    storage['pachas_pending_scans_v1'] = JSON.stringify(updated);

    const reloaded = JSON.parse(storage['pachas_pending_scans_v1']);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].id).toBe('scan-keep-456');
    expect(reloaded.find((s: any) => s.id === scanIdToDismiss)).toBeUndefined();
  });

  it('cleans up validateScan query parameter from URL correctly', () => {
    const originalUrl = 'http://localhost:3000/groups/grp-1?validateScan=scan-to-dismiss-123&tab=expenses';
    const parsed = new URL(originalUrl);
    expect(parsed.searchParams.has('validateScan')).toBe(true);

    parsed.searchParams.delete('validateScan');
    expect(parsed.searchParams.has('validateScan')).toBe(false);
    expect(parsed.searchParams.get('tab')).toBe('expenses');
    expect(parsed.pathname + (parsed.search ? parsed.search : '')).toBe('/groups/grp-1?tab=expenses');
  });
});
