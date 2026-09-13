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

  it('reconciles multi-bracket taxes (e.g. Spain 10% food + 21% alcohol) and verifies base matches', () => {
    // 10% bracket (food): Paella 20.00€ + Ensalada 10.00€ = 30.00€ (Base: 27.27€, Cuota: 2.73€)
    // 21% bracket (alcohol): Cerveza 6.00€ + Copa 10.00€ = 16.00€ (Base: 13.22€, Cuota: 2.78€)
    // Total: 46.00€, Tax total: 5.51€
    const report = auditAndReconcileReceipt({
      amount: 46.00,
      tax_name: 'IVA',
      tax_included: true,
      tax_amount: 5.51,
      tax_breakdown: [
        { tax_rate: 10, total_amount: 30.00, base_amount: 27.27, tax_amount: 2.73 },
        { tax_rate: 21, total_amount: 16.00, base_amount: 13.22, tax_amount: 2.78 },
      ],
      items: [
        { description: 'Paella Valenciana', price: 20.00, quantity: 1, tax_rate: 10 },
        { description: 'Ensalada Mixta', price: 10.00, quantity: 1, tax_rate: 10 },
        { description: 'Cerveza Doble', price: 6.00, quantity: 2, tax_rate: 21 },
        { description: 'Copa Ginebra', price: 10.00, quantity: 1, tax_rate: 21 },
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxIncluded).toBe(true);
    expect(report.itemsPriceIncludesTax).toBe(true);
    expect(report.taxBreakdownBalanced).toBe(true);
    expect(report.reconciledItems[0].tax_rate).toBe(10);
    expect(report.reconciledItems[0].tax_amount).toBeGreaterThan(0);
    expect(report.reconciledItems[2].tax_rate).toBe(21);
    expect(report.reconciledItems[2].tax_amount).toBeGreaterThan(0);
  });

  it('infers missing tax rates for items using receipt tax breakdown targets', () => {
    // Total is 25.00€
    // Breakdown: 10% bracket total: 15.00€; 21% bracket total: 10.00€
    // Two items: Pizza 15.00€ (tax_rate missing), Gin Tonic 10.00€ (tax_rate missing)
    const report = auditAndReconcileReceipt({
      amount: 25.00,
      tax_name: 'IVA',
      tax_included: true,
      tax_breakdown: [
        { tax_rate: 10, total_amount: 15.00 },
        { tax_rate: 21, total_amount: 10.00 },
      ],
      items: [
        { description: 'Pizza 4 Quesos', price: 15.00 }, // missing tax_rate
        { description: 'Gin Tonic', price: 10.00 },      // missing tax_rate
      ],
    });

    expect(report.isConsistent).toBe(true);
    expect(report.taxBreakdownBalanced).toBe(true);

    const pizza = report.reconciledItems.find((it) => it.description.includes('Pizza'));
    const gin = report.reconciledItems.find((it) => it.description.includes('Gin'));

    expect(pizza?.tax_rate).toBe(10);
    expect(gin?.tax_rate).toBe(21);
    expect(pizza?.tax_amount).toBeCloseTo(1.36, 2);
    expect(gin?.tax_amount).toBeCloseTo(1.74, 2);
  });
});

