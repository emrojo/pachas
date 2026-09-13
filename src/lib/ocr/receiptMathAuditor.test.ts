import { describe, it, expect } from 'vitest';
import { auditAndReconcileReceipt } from './receiptMathAuditor';

describe('Receipt Math Auditor and Tax Inclusion Engine', () => {
  it('correctly identifies tax included when items sum equals the invoice total', () => {
    // Typical Spanish restaurant bill: 32 + 7.50 + 6 + 1.80 = 47.30
    const report = auditAndReconcileReceipt({
      amount: 47.30,
      tax_name: 'IVA',
      tax_rate: 10,
      tax_amount: 4.30,
      subtotal: 43.00,
      tax_included: true,
      items: [
        { description: 'Paella', price: 32.00, quantity: 2, unit_price: 16.00 },
        { description: 'Ensalada', price: 7.50, quantity: 1, unit_price: 7.50 },
        { description: 'Cerveza', price: 6.00, quantity: 2, unit_price: 3.00 },
        { description: 'Cafe', price: 1.80, quantity: 1, unit_price: 1.80 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxIncluded).toBe(true);
    expect(report.status).toBe('balanced_included');
    expect(report.discrepancy).toBe(0);
    expect(report.itemsSum).toBe(47.30);
    expect(report.totalAmount).toBe(47.30);
    expect(report.subtotal).toBe(43.00);
  });

  it('correctly identifies tax added at end when items sum equals subtotal', () => {
    // US / B2B invoice: items sum = 100.00, tax = 21.00, total = 121.00
    const report = auditAndReconcileReceipt({
      amount: 121.00,
      tax_name: 'VAT',
      tax_rate: 21,
      tax_amount: 21.00,
      subtotal: 100.00,
      tax_included: false,
      items: [
        { description: 'Consulting service', price: 80.00, quantity: 1, unit_price: 80.00 },
        { description: 'Documentation', price: 20.00, quantity: 1, unit_price: 20.00 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxIncluded).toBe(false);
    expect(report.status).toBe('balanced_excluded');
    expect(report.itemsSum).toBe(100.00);
    expect(report.taxAmount).toBe(21.00);
    expect(report.totalAmount).toBe(121.00);
    expect(report.discrepancy).toBe(0);
  });

  it('auto-corrects tax_included if AI wrongly marked tax_included=true but numbers prove tax is added at end', () => {
    // AI returned tax_included: true by mistake, but items sum is 50.00 and tax is 10.00, total is 60.00
    const report = auditAndReconcileReceipt({
      amount: 60.00,
      tax_name: 'Sales Tax',
      tax_rate: 20,
      tax_amount: 10.00,
      subtotal: 50.00,
      tax_included: true, // Incorrect flag from OCR
      items: [
        { description: 'Shirt', price: 30.00, quantity: 1, unit_price: 30.00 },
        { description: 'Pants', price: 20.00, quantity: 1, unit_price: 20.00 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxIncluded).toBe(false); // Auto-corrected to false
    expect(report.status).toBe('balanced_excluded');
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('auto-corrects tax_included if AI wrongly marked tax_included=false but items already sum to total', () => {
    // AI returned tax_included: false, but items sum is 47.30 and total is 47.30
    const report = auditAndReconcileReceipt({
      amount: 47.30,
      tax_name: 'IVA',
      tax_rate: 10,
      tax_amount: 4.30,
      tax_included: false, // Incorrect flag from OCR
      items: [
        { description: 'Paella', price: 47.30, quantity: 1, unit_price: 47.30 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxIncluded).toBe(true); // Auto-corrected to true
    expect(report.status).toBe('balanced_included');
  });

  it('detects discrepancies when items sum does not square with total', () => {
    // Discrepancy: items sum = 35.00, but total is 47.30 (missing line)
    const report = auditAndReconcileReceipt({
      amount: 47.30,
      tax_name: 'IVA',
      tax_rate: 10,
      tax_amount: 4.30,
      tax_included: true,
      items: [
        { description: 'Paella', price: 35.00, quantity: 1, unit_price: 35.00 },
      ],
    });

    expect(report.isConsistent).toBe(false);
    expect(report.status).toBe('discrepancy');
    expect(Math.abs(report.discrepancy)).toBeCloseTo(12.30, 2);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('reconciles unit_price if quantity > 1 and unit_price was missing or inconsistent', () => {
    const report = auditAndReconcileReceipt({
      amount: 30.00,
      items: [
        { description: 'Cervezas', price: 30.00, quantity: 6 }, // unit_price missing
      ],
    });

    expect(report.reconciledItems[0].unit_price).toBe(5.00);
    expect(report.reconciledItems[0].quantity).toBe(6);
  });

  it('smooths 1-cent penny rounding differences automatically', () => {
    // Sum is 10.01 but total is 10.00 (1 cent off)
    const report = auditAndReconcileReceipt({
      amount: 10.00,
      tax_included: true,
      items: [
        { description: 'Item 1', price: 3.34, quantity: 1 },
        { description: 'Item 2', price: 3.34, quantity: 1 },
        { description: 'Item 3', price: 3.33, quantity: 1 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.discrepancy).toBe(0);
    expect(report.itemsSum).toBe(10.00);
  });
});
