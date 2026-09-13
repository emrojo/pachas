import { ScannedLineItem, ScannedReceiptData } from '@/lib/ocr/receiptScanner';

export type ReceiptAuditStatus =
  | 'balanced_included' // Taxes are included in item prices (sum of items == total)
  | 'balanced_excluded' // Taxes are added at end (sum of items + tax == total, or sum of items == subtotal)
  | 'discrepancy'       // The numbers do not match within tolerance
  | 'no_items';         // No line items found to audit

export interface ReceiptAuditReport {
  isConsistent: boolean;
  taxIncluded: boolean;
  taxName: string;
  taxRate?: number;
  taxAmount: number;
  subtotal: number;
  itemsSum: number;
  totalAmount: number;
  calculatedTotal: number;
  discrepancy: number; // Difference in currency units (0.00 if balanced)
  status: ReceiptAuditStatus;
  summaryMessage: string;
  warnings: string[];
  reconciledItems: ScannedLineItem[];
}

const round2 = (val: number): number => Math.round(val * 100) / 100;

/**
 * Audits a scanned receipt mathematically:
 * 1. Checks and reconciles line items (quantity, unit_price, line total).
 * 2. Determines definitively whether taxes are included in item prices or added at the end.
 * 3. Verifies that items sum + taxes equal the invoice total.
 * 4. Generates an audit report with status, auto-corrections, and warnings.
 */
export function auditAndReconcileReceipt(data: Partial<ScannedReceiptData>): ReceiptAuditReport {
  const warnings: string[] = [];
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const totalAmount = Math.max(0, typeof data.amount === 'number' ? round2(data.amount) : 0);
  const taxName = data.tax_name?.trim() || 'IVA';
  const rawTaxRate = typeof data.tax_rate === 'number' && !isNaN(data.tax_rate) ? round2(data.tax_rate) : undefined;
  let taxAmount = Math.max(0, typeof data.tax_amount === 'number' && !isNaN(data.tax_amount) ? round2(data.tax_amount) : 0);
  let subtotal = Math.max(0, typeof data.subtotal === 'number' && !isNaN(data.subtotal) ? round2(data.subtotal) : 0);
  let initialTaxIncluded = typeof data.tax_included === 'boolean' ? data.tax_included : true;

  // 1. Reconcile each individual line item
  const reconciledItems: ScannedLineItem[] = [];
  let itemsSum = 0;

  for (const it of rawItems) {
    if (!it) continue;
    const desc = String(it.description || '').trim();
    if (!desc) continue;

    const linePrice = Math.max(0, round2(Number(it.price) || 0));
    const rawQty = Number(it.quantity) || 1;
    const quantity = Math.max(1, Math.round(rawQty * 100) / 100);

    let unitPrice = it.unit_price !== undefined && it.unit_price !== null ? round2(Number(it.unit_price)) : undefined;

    // Verify quantity * unit_price ≈ linePrice
    if (unitPrice !== undefined && unitPrice > 0) {
      const expectedTotal = round2(quantity * unitPrice);
      if (Math.abs(expectedTotal - linePrice) > 0.05 && linePrice > 0) {
        // Discrepancy in unit price, recompute from total line price
        warnings.push(`El precio unitario de "${desc}" (${unitPrice}) no cuadraba con el total (${linePrice}). Se ha recalculado.`);
        unitPrice = round2(linePrice / quantity);
      }
    } else if (linePrice > 0) {
      unitPrice = round2(linePrice / quantity);
    }

    const itemTaxRate = typeof it.tax_rate === 'number' ? round2(it.tax_rate) : rawTaxRate;
    const itemTaxName = it.tax_name || taxName;
    const itemTaxAmount = typeof it.tax_amount === 'number' ? round2(it.tax_amount) : 0;

    const reconciledItem: ScannedLineItem = {
      description: desc,
      price: linePrice,
      quantity,
      unit_price: unitPrice,
      tax_name: itemTaxName,
      tax_rate: itemTaxRate,
      tax_amount: itemTaxAmount,
    };

    if (it.id) reconciledItem.id = it.id;
    if (it.description_original) reconciledItem.description_original = it.description_original;
    if (it.assigned_user_ids && it.assigned_user_ids.length > 0) reconciledItem.assigned_user_ids = it.assigned_user_ids;
    if (it.assigned_shares && Object.keys(it.assigned_shares).length > 0) reconciledItem.assigned_shares = it.assigned_shares;

    reconciledItems.push(reconciledItem);

    itemsSum += linePrice;
  }

  itemsSum = round2(itemsSum);

  // If no items are present, audit cannot compare item sums
  if (reconciledItems.length === 0) {
    if (subtotal === 0 && taxAmount > 0 && totalAmount > taxAmount) {
      subtotal = round2(totalAmount - taxAmount);
    }
    return {
      isConsistent: totalAmount > 0,
      taxIncluded: initialTaxIncluded,
      taxName,
      taxRate: rawTaxRate,
      taxAmount,
      subtotal: subtotal || totalAmount,
      itemsSum: 0,
      totalAmount,
      calculatedTotal: totalAmount,
      discrepancy: 0,
      status: 'no_items',
      summaryMessage: 'Factura sin desglose de productos individuales.',
      warnings,
      reconciledItems: [],
    };
  }

  // 2. Identify tax inclusion hypothesis and consistency
  // Hypothesis A: Taxes are included in item prices (sum of items ≈ totalAmount)
  const diffIncluded = round2(Math.abs(itemsSum - totalAmount));
  // Hypothesis B: Taxes are added at end (sum of items + taxAmount ≈ totalAmount)
  const diffExcluded = round2(Math.abs((itemsSum + taxAmount) - totalAmount));
  // Hypothesis C: Sum of items matches subtotal (base imponible)
  const diffSubtotal = subtotal > 0 ? round2(Math.abs(itemsSum - subtotal)) : 999999;

  let finalTaxIncluded = initialTaxIncluded;
  let status: ReceiptAuditStatus = 'discrepancy';
  let discrepancy = 0;
  let summaryMessage = '';

  if (diffIncluded <= 0.05 && diffIncluded <= diffExcluded) {
    // Definitive: Items already include taxes (typical in Spain & Europe)
    finalTaxIncluded = true;
    status = 'balanced_included';
    discrepancy = round2(itemsSum - totalAmount);

    if (subtotal === 0 || Math.abs((subtotal + taxAmount) - totalAmount) > 0.05) {
      // Reconcile subtotal if missing or divergent
      subtotal = round2(totalAmount - taxAmount);
    }

    summaryMessage = `Factura cuadrada: Los precios de los productos ya incluyen ${taxName} (${totalAmount.toFixed(2)} €).`;
    if (initialTaxIncluded === false) {
      warnings.push(`Se detectó automáticamente que los precios incluyen ${taxName} porque la suma de productos (${itemsSum.toFixed(2)} €) coincide con el total.`);
    }
  } else if (diffExcluded <= 0.05 || (diffSubtotal <= 0.05 && taxAmount > 0)) {
    // Definitive: Items are net base prices and tax is added at the end (typical in USA / B2B)
    finalTaxIncluded = false;
    status = 'balanced_excluded';
    discrepancy = round2((itemsSum + taxAmount) - totalAmount);

    if (subtotal === 0 || Math.abs(subtotal - itemsSum) > 0.05) {
      subtotal = itemsSum;
    }

    // If taxAmount was 0 or unread, deduce it
    if (taxAmount === 0 && totalAmount > itemsSum) {
      taxAmount = round2(totalAmount - itemsSum);
    }

    summaryMessage = `Factura cuadrada: Precios en base imponible (${itemsSum.toFixed(2)} €) + ${taxName} (${taxAmount.toFixed(2)} €) = Total (${totalAmount.toFixed(2)} €).`;
    if (initialTaxIncluded === true) {
      warnings.push(`Se detectó automáticamente que los impuestos no estaban incluidos en los precios: Base (${itemsSum.toFixed(2)} €) + ${taxName} (${taxAmount.toFixed(2)} €) = Total (${totalAmount.toFixed(2)} €).`);
    }
  } else {
    // Inconsistent / Discrepancy detected: Neither hypothesis cleanly balanced
    status = 'discrepancy';
    finalTaxIncluded = initialTaxIncluded;

    if (finalTaxIncluded) {
      discrepancy = round2(itemsSum - totalAmount);
      summaryMessage = `Aviso de descuadre: La suma de productos (${itemsSum.toFixed(2)} €) difiere del total (${totalAmount.toFixed(2)} €) en ${Math.abs(discrepancy).toFixed(2)} €.`;
    } else {
      discrepancy = round2((itemsSum + taxAmount) - totalAmount);
      summaryMessage = `Aviso de descuadre: Base (${itemsSum.toFixed(2)} €) + ${taxName} (${taxAmount.toFixed(2)} €) difiere del total (${totalAmount.toFixed(2)} €) en ${Math.abs(discrepancy).toFixed(2)} €.`;
    }
    warnings.push(`Existe una diferencia de ${Math.abs(discrepancy).toFixed(2)} € entre los productos leídos y el total del ticket.`);
  }

  // 3. Smooth penny balancing if discrepancy is minute (<= 0.02)
  if (Math.abs(discrepancy) > 0 && Math.abs(discrepancy) <= 0.02 && reconciledItems.length > 0) {
    // Adjust single cent on largest item
    let maxIdx = 0;
    for (let i = 1; i < reconciledItems.length; i++) {
      const currItem = reconciledItems[i];
      const maxItem = reconciledItems[maxIdx];
      if (currItem && maxItem && currItem.price > maxItem.price) {
        maxIdx = i;
      }
    }
    const targetItem = reconciledItems[maxIdx];
    if (targetItem) {
      targetItem.price = round2(targetItem.price - discrepancy);
      if (targetItem.quantity && targetItem.quantity > 0) {
        targetItem.unit_price = round2(targetItem.price / targetItem.quantity);
      }
    }
    itemsSum = round2(itemsSum - discrepancy);
    discrepancy = 0;
    status = finalTaxIncluded ? 'balanced_included' : 'balanced_excluded';
    warnings.push('Se ha ajustado una diferencia de céntimos por redondeo para cuadrar exactamente con la factura.');
  }

  const isConsistent = Math.abs(discrepancy) <= 0.02;
  const calculatedTotal = round2(itemsSum + (finalTaxIncluded ? 0 : taxAmount));

  return {
    isConsistent,
    taxIncluded: finalTaxIncluded,
    taxName,
    taxRate: rawTaxRate,
    taxAmount,
    subtotal: subtotal || (finalTaxIncluded ? round2(totalAmount - taxAmount) : itemsSum),
    itemsSum,
    totalAmount,
    calculatedTotal,
    discrepancy,
    status,
    summaryMessage,
    warnings,
    reconciledItems,
  };
}
