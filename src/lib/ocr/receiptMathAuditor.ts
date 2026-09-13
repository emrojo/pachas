import { ScannedLineItem, ScannedReceiptData } from '@/lib/ocr/receiptScanner';
import { TaxBracketSummary } from '@/lib/taxes';

export type ReceiptAuditStatus =
  | 'balanced_included' // Taxes are included in item prices (sum of items == total)
  | 'balanced_excluded' // Taxes are added at end or items are net prices (sum of items + tax == total, or sum of items == subtotal)
  | 'discrepancy'       // The numbers do not match within tolerance
  | 'no_items';         // No line items found to audit

export interface TaxBracketAuditResult {
  tax_rate: number;
  expectedBase?: number;
  actualBase: number;
  expectedTax?: number;
  actualTax: number;
  expectedTotal?: number;
  actualTotal: number;
  isBalanced: boolean;
}

export interface ReceiptAuditReport {
  isConsistent: boolean;
  taxIncluded: boolean;
  itemsPriceIncludesTax: boolean;
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
  taxBreakdown?: TaxBracketSummary[];
  taxBreakdownBalanced?: boolean;
  bracketAudits?: TaxBracketAuditResult[];
}

const round2 = (val: number): number => Math.round(val * 100) / 100;

/**
 * Reconciles and infers tax rates for items using bracket targets from the receipt.
 * Evaluates combinations to ensure the sum of products per bracket squares
 * with the base or total of each tax bracket declared in the invoice.
 */
function reconcileItemTaxRatesWithBrackets(
  items: ScannedLineItem[],
  taxBreakdown: TaxBracketSummary[],
  itemsPriceIncludesTax: boolean,
  defaultTaxRate?: number
): { reconciledItems: ScannedLineItem[]; bracketAudits: TaxBracketAuditResult[]; allBalanced: boolean } {
  if (items.length === 0 || taxBreakdown.length === 0) {
    return { reconciledItems: items, bracketAudits: [], allBalanced: true };
  }

  const distinctRates = Array.from(new Set(taxBreakdown.map((b) => round2(b.tax_rate))));

  // Helper to get target amount for a bracket
  const getBracketTarget = (b: TaxBracketSummary): number | undefined => {
    if (itemsPriceIncludesTax) {
      if (typeof b.total_amount === 'number' && b.total_amount > 0) return round2(b.total_amount);
      if (typeof b.base_amount === 'number' && b.base_amount > 0) {
        return round2(b.base_amount * (1 + b.tax_rate / 100));
      }
    } else {
      if (typeof b.base_amount === 'number' && b.base_amount > 0) return round2(b.base_amount);
      if (typeof b.total_amount === 'number' && b.total_amount > 0) {
        return round2(b.total_amount / (1 + b.tax_rate / 100));
      }
    }
    return undefined;
  };

  const bracketTargetMap = new Map<number, number>();
  for (const b of taxBreakdown) {
    const target = getBracketTarget(b);
    if (target !== undefined) {
      bracketTargetMap.set(round2(b.tax_rate), target);
    }
  }

  // Work with a copy of items
  const currentItems = items.map((it) => ({ ...it }));

  // Helper to evaluate current bracket balance
  const evaluateBalance = (itemsToCheck: ScannedLineItem[]): { audits: TaxBracketAuditResult[]; balanced: boolean } => {
    const audits: TaxBracketAuditResult[] = [];
    let allBalanced = true;

    for (const b of taxBreakdown) {
      const rate = round2(b.tax_rate);
      const itemsForRate = itemsToCheck.filter((it) => round2(Number(it.tax_rate) || 0) === rate);
      const sumLinePrices = round2(itemsForRate.reduce((acc, it) => acc + (it.price || 0), 0));

      let actualBase = 0;
      let actualTax = 0;
      let actualTotal = 0;

      if (itemsPriceIncludesTax) {
        actualTotal = sumLinePrices;
        actualBase = round2(actualTotal / (1 + rate / 100));
        actualTax = round2(actualTotal - actualBase);
      } else {
        actualBase = sumLinePrices;
        actualTax = round2(actualBase * (rate / 100));
        actualTotal = round2(actualBase + actualTax);
      }

      const expectedTarget = bracketTargetMap.get(rate);
      const actualTarget = itemsPriceIncludesTax ? actualTotal : actualBase;
      const isBalanced = expectedTarget !== undefined ? Math.abs(expectedTarget - actualTarget) <= 0.06 : true;

      if (!isBalanced) {
        allBalanced = false;
      }

      audits.push({
        tax_rate: rate,
        expectedBase: b.base_amount,
        actualBase,
        expectedTax: b.tax_amount,
        actualTax,
        expectedTotal: b.total_amount,
        actualTotal,
        isBalanced,
      });
    }

    return { audits, balanced: allBalanced };
  };

  // 1. Initial evaluation
  const initial = evaluateBalance(currentItems);
  if (initial.balanced) {
    return { reconciledItems: currentItems, bracketAudits: initial.audits, allBalanced: true };
  }

  // 2. If single bracket in breakdown, all items must belong to it
  if (distinctRates.length === 1) {
    const singleRate = distinctRates[0];
    for (const it of currentItems) {
      it.tax_rate = singleRate;
    }
    const evalSingle = evaluateBalance(currentItems);
    return { reconciledItems: currentItems, bracketAudits: evalSingle.audits, allBalanced: evalSingle.balanced };
  }

  // 3. For items with missing or non-matching tax_rate, or when re-assignment can achieve balance:
  // If item count is manageable (<= 15), test combinatorial assignments across distinct rates
  if (currentItems.length <= 15 && distinctRates.length <= 4) {
    let bestItems = currentItems;
    let bestDiscrepancy = 999999;
    let foundExact = false;

    // Helper to evaluate discrepancy of an assignment
    const calcDiscrepancy = (candidateItems: ScannedLineItem[]): number => {
      let disc = 0;
      for (const [rate, target] of bracketTargetMap.entries()) {
        const sum = round2(
          candidateItems
            .filter((it) => round2(Number(it.tax_rate) || 0) === rate)
            .reduce((acc, it) => acc + (it.price || 0), 0)
        );
        disc += Math.abs(sum - target);
      }
      return round2(disc);
    };

    // Recursive search
    const search = (itemIdx: number, workingItems: ScannedLineItem[]) => {
      if (foundExact) return;

      if (itemIdx === workingItems.length) {
        const disc = calcDiscrepancy(workingItems);
        if (disc < bestDiscrepancy) {
          bestDiscrepancy = disc;
          bestItems = workingItems.map((it) => ({ ...it }));
          if (disc <= 0.05) {
            foundExact = true;
          }
        }
        return;
      }

      const item = workingItems[itemIdx];
      const existingRate = typeof item.tax_rate === 'number' ? round2(item.tax_rate) : undefined;
      const candidateList = distinctRates.slice().sort((a, b) => {
        if (a === existingRate) return -1;
        if (b === existingRate) return 1;
        return 0;
      });

      for (const r of candidateList) {
        workingItems[itemIdx].tax_rate = r;
        search(itemIdx + 1, workingItems);
        if (foundExact) return;
      }
      workingItems[itemIdx].tax_rate = existingRate;
    };

    search(0, currentItems.map((it) => ({ ...it })));

    if (foundExact || bestDiscrepancy <= 0.1) {
      const finalEval = evaluateBalance(bestItems);
      return { reconciledItems: bestItems, bracketAudits: finalEval.audits, allBalanced: finalEval.balanced };
    }
  }

  // 4. Greedy fallback: assign any unassigned items to bracket with largest remaining deficit
  for (const it of currentItems) {
    if (it.tax_rate === undefined || !distinctRates.includes(round2(it.tax_rate))) {
      let bestRate = distinctRates[0];
      let maxDeficit = -999999;
      for (const r of distinctRates) {
        const target = bracketTargetMap.get(r) || 0;
        const currentSum = round2(
          currentItems
            .filter((x) => round2(Number(x.tax_rate) || 0) === r)
            .reduce((acc, x) => acc + (x.price || 0), 0)
        );
        const deficit = target - currentSum;
        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          bestRate = r;
        }
      }
      it.tax_rate = bestRate;
    }
  }

  const finalEval = evaluateBalance(currentItems);
  return { reconciledItems: currentItems, bracketAudits: finalEval.audits, allBalanced: finalEval.balanced };
}

/**
 * Audits a scanned receipt mathematically:
 * 1. Checks and reconciles line items (quantity, unit_price, line total).
 * 2. Determines definitively whether taxes are included in the invoice total (taxIncluded)
 *    AND whether the line item prices include tax (itemsPriceIncludesTax: true)
 *    or are net base prices (itemsPriceIncludesTax: false where sum(items) + tax == total).
 * 3. Reconciles multiple tax brackets (tax_breakdown), inferring and assigning tax rates to each product.
 * 4. Computes exact tax_amount per line item and squares totals.
 * 5. Generates an audit report with status, auto-corrections, and warnings.
 */
export function auditAndReconcileReceipt(data: Partial<ScannedReceiptData>): ReceiptAuditReport {
  const warnings: string[] = [];
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const totalAmount = Math.max(0, typeof data.amount === 'number' ? round2(data.amount) : 0);
  const taxName = data.tax_name?.trim() || 'IVA';
  const rawTaxRate = typeof data.tax_rate === 'number' && !isNaN(data.tax_rate) ? round2(data.tax_rate) : undefined;
  let taxAmount = Math.max(0, typeof data.tax_amount === 'number' && !isNaN(data.tax_amount) ? round2(data.tax_amount) : 0);
  let subtotal = Math.max(0, typeof data.subtotal === 'number' && !isNaN(data.subtotal) ? round2(data.subtotal) : 0);
  const initialTaxIncluded = typeof data.tax_included === 'boolean' ? data.tax_included : true;
  const rawBreakdown = Array.isArray(data.tax_breakdown) ? data.tax_breakdown : [];

  // Sanitize tax breakdown
  const taxBreakdown: TaxBracketSummary[] = rawBreakdown
    .filter((b) => b && typeof b.tax_rate === 'number' && !isNaN(b.tax_rate))
    .map((b) => ({
      tax_rate: round2(b.tax_rate),
      base_amount: typeof b.base_amount === 'number' ? round2(b.base_amount) : undefined,
      tax_amount: typeof b.tax_amount === 'number' ? round2(b.tax_amount) : undefined,
      total_amount: typeof b.total_amount === 'number' ? round2(b.total_amount) : undefined,
    }));

  // If taxAmount was 0 but taxBreakdown has taxes, sum them up
  if (taxAmount === 0 && taxBreakdown.length > 0) {
    const sumBreakdownTax = round2(taxBreakdown.reduce((acc, b) => acc + (b.tax_amount || 0), 0));
    if (sumBreakdownTax > 0) {
      taxAmount = sumBreakdownTax;
    }
  }

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
      tax_included: typeof it.tax_included === 'boolean' ? it.tax_included : undefined,
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
      itemsPriceIncludesTax: initialTaxIncluded,
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
      taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
      taxBreakdownBalanced: true,
    };
  }

  // 2. Identify tax inclusion hypothesis and consistency
  // Hypothesis A: Item prices include taxes (retail PVP): sum(items) ≈ totalAmount
  const diffIncluded = round2(Math.abs(itemsSum - totalAmount));

  // Hypothesis B: Item prices are net base: sum(items) + taxAmount ≈ totalAmount
  const diffNetWithTax = round2(Math.abs((itemsSum + taxAmount) - totalAmount));

  // Hypothesis C: Item prices match subtotal: sum(items) ≈ subtotal
  const diffSubtotal = subtotal > 0 ? round2(Math.abs(itemsSum - subtotal)) : 999999;

  let finalTaxIncluded = initialTaxIncluded;
  let itemsPriceIncludesTax = true;
  let status: ReceiptAuditStatus = 'discrepancy';
  let discrepancy = 0;
  let summaryMessage = '';

  if (diffIncluded <= 0.05 && diffIncluded <= diffNetWithTax) {
    // Definitive: Both total and item prices have tax included
    finalTaxIncluded = true;
    itemsPriceIncludesTax = true;
    status = 'balanced_included';
    discrepancy = round2(itemsSum - totalAmount);

    if (subtotal === 0 || Math.abs((subtotal + taxAmount) - totalAmount) > 0.05) {
      subtotal = round2(totalAmount - taxAmount);
    }

    summaryMessage = `Factura cuadrada: Los precios de los productos ya incluyen ${taxName} (${totalAmount.toFixed(2)} €).`;
    if (initialTaxIncluded === false) {
      warnings.push(`Se detectó automáticamente que los precios incluyen ${taxName} porque la suma de productos (${itemsSum.toFixed(2)} €) coincide con el total.`);
    }
  } else if (diffNetWithTax <= 0.05 || (diffSubtotal <= 0.05 && taxAmount > 0)) {
    // Definitive: Items are net base prices and tax is added at the end (typical in USA / B2B)
    finalTaxIncluded = false;
    itemsPriceIncludesTax = false;
    status = 'balanced_excluded';
    discrepancy = round2((itemsSum + taxAmount) - totalAmount);

    if (subtotal === 0 || Math.abs(subtotal - itemsSum) > 0.05) {
      subtotal = itemsSum;
    }

    if (taxAmount === 0 && totalAmount > itemsSum) {
      taxAmount = round2(totalAmount - itemsSum);
    }

    summaryMessage = `Factura cuadrada: Precios en base imponible (${itemsSum.toFixed(2)} €) + ${taxName} (${taxAmount.toFixed(2)} €) = Total (${totalAmount.toFixed(2)} €).`;
    if (initialTaxIncluded === true) {
      warnings.push(`Se detectó automáticamente que los impuestos no estaban incluidos en los precios: Base (${itemsSum.toFixed(2)} €) + ${taxName} (${taxAmount.toFixed(2)} €) = Total (${totalAmount.toFixed(2)} €).`);
    }
  } else {
    // Discrepancy detected between items and total
    status = 'discrepancy';
    const itemWithTaxFlag = rawItems.find((it) => typeof it?.tax_included === 'boolean');
    if (itemWithTaxFlag && typeof itemWithTaxFlag.tax_included === 'boolean') {
      itemsPriceIncludesTax = itemWithTaxFlag.tax_included;
      finalTaxIncluded = itemWithTaxFlag.tax_included;
    } else if (typeof data.items_price_includes_tax === 'boolean') {
      itemsPriceIncludesTax = data.items_price_includes_tax;
      finalTaxIncluded = data.items_price_includes_tax;
    } else {
      finalTaxIncluded = initialTaxIncluded;
      itemsPriceIncludesTax = initialTaxIncluded;
    }

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
    status = itemsPriceIncludesTax ? 'balanced_included' : 'balanced_excluded';
    warnings.push('Se ha ajustado una diferencia de céntimos por redondeo para cuadrar exactamente con la factura.');
  }

  // 4. Reconcile tax brackets and infer per-item tax rate
  let bracketAudits: TaxBracketAuditResult[] = [];
  let taxBreakdownBalanced = true;
  let reconciledItemsList = reconciledItems;

  if (taxBreakdown.length > 0) {
    const bracketRes = reconcileItemTaxRatesWithBrackets(
      reconciledItemsList,
      taxBreakdown,
      itemsPriceIncludesTax,
      rawTaxRate
    );
    reconciledItemsList = bracketRes.reconciledItems;
    bracketAudits = bracketRes.bracketAudits;
    taxBreakdownBalanced = bracketRes.allBalanced;

    if (taxBreakdownBalanced && taxBreakdown.length > 1) {
      warnings.push(`Se han cuadrado los ${reconciledItemsList.length} productos con los ${taxBreakdown.length} tramos de ${taxName} de la factura.`);
    }
  }

  // 5. Calculate and verify item tax_amount for each product
  let calculatedItemsTaxSum = 0;
  for (const it of reconciledItemsList) {
    const rate = typeof it.tax_rate === 'number' ? round2(it.tax_rate) : rawTaxRate || 0;
    it.tax_rate = rate;
    it.tax_name = it.tax_name || taxName;
    it.tax_included = itemsPriceIncludesTax;

    if (itemsPriceIncludesTax) {
      // Product price includes tax: cuota = price - price / (1 + rate / 100)
      if (rate > 0) {
        it.tax_amount = round2(it.price - (it.price / (1 + rate / 100)));
      } else {
        it.tax_amount = 0;
      }
    } else {
      // Product price is net base: cuota = price * (rate / 100)
      if (rate > 0) {
        it.tax_amount = round2(it.price * (rate / 100));
      } else {
        it.tax_amount = 0;
      }
    }
    calculatedItemsTaxSum += it.tax_amount || 0;
  }
  calculatedItemsTaxSum = round2(calculatedItemsTaxSum);

  // If invoice taxAmount was missing or 0, deduce it from reconciled items
  if (taxAmount === 0 && calculatedItemsTaxSum > 0) {
    taxAmount = calculatedItemsTaxSum;
    if (subtotal === 0) {
      subtotal = itemsPriceIncludesTax ? round2(totalAmount - taxAmount) : itemsSum;
    }
  }

  // Adjust penny rounding on item tax cuotas if needed to match global taxAmount
  if (taxAmount > 0 && Math.abs(calculatedItemsTaxSum - taxAmount) > 0 && Math.abs(calculatedItemsTaxSum - taxAmount) <= 0.02) {
    const taxDiff = round2(calculatedItemsTaxSum - taxAmount);
    let maxTaxItem = reconciledItemsList[0];
    for (const it of reconciledItemsList) {
      if ((it.tax_amount || 0) > (maxTaxItem?.tax_amount || 0)) {
        maxTaxItem = it;
      }
    }
    if (maxTaxItem && maxTaxItem.tax_amount !== undefined) {
      maxTaxItem.tax_amount = round2(maxTaxItem.tax_amount - taxDiff);
    }
  }

  const isConsistent = Math.abs(discrepancy) <= 0.02;
  const calculatedTotal = round2(itemsPriceIncludesTax ? itemsSum : itemsSum + taxAmount);

  return {
    isConsistent,
    taxIncluded: finalTaxIncluded,
    itemsPriceIncludesTax,
    taxName,
    taxRate: rawTaxRate,
    taxAmount,
    subtotal: subtotal || (itemsPriceIncludesTax ? round2(totalAmount - taxAmount) : itemsSum),
    itemsSum,
    totalAmount,
    calculatedTotal,
    discrepancy,
    status,
    summaryMessage,
    warnings,
    reconciledItems: reconciledItemsList,
    taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
    taxBreakdownBalanced,
    bracketAudits: bracketAudits.length > 0 ? bracketAudits : undefined,
  };
}

