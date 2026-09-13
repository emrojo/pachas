import { CalculatedSplitResult } from '@/lib/algorithms/splitCalculations';
import { formatMoney } from '@/lib/currencies';

export interface LineItemInput {
  id: string;
  description: string;
  description_original?: string;
  price: number; // Net base price
  quantity?: number; // Total units (default 1)
  unit_price?: number | null;
  tax_name?: string; // 'IVA', 'VAT', 'Tax'
  tax_rate?: number; // e.g. 21, 10, 4, 0
  tax_amount?: number; // Total tax for this line item
  assignedUserIds: string[];
  assignedShares?: Record<string, number>; // user_id -> quantity of units consumed
}

export interface CalculatedItemizedUserSplit extends CalculatedSplitResult {
  userId: string;
  amountOwed: number; // Total to pay (Base + Tax)
  netOwed?: number;   // Base imponible
  taxOwed?: number;   // Cuota de impuesto
  percentage?: number;
}

export interface ItemizedSplitCalculationResult {
  results: CalculatedItemizedUserSplit[];
  itemsTotal: number;      // Total with tax (Base + Tax)
  itemsNetTotal: number;   // Total base without tax
  itemsTaxTotal: number;   // Total tax
  difference: number;
  isBalanced: boolean;
  hasUnassignedItems?: boolean;
  unassignedItemDescriptions?: string[];
  errorMessage?: string;
}

export interface ItemizedSplitOptions {
  taxIncluded?: boolean;
  taxAmount?: number;
}

/**
 * Calculates itemized expense splits based on line items with quantities,
 * proportional user consumption, and tax breakdown.
 * 
 * Rules:
 * 1. Total to split per line item = Base Price (`price`) + Tax Amount (`tax_amount`).
 *    If taxes are excluded and added at the bottom, tax is proportionally distributed
 *    across users based on their net consumption.
 * 2. Every line item must be 100% distributed before saving:
 *    Sum of user assigned units must equal item `quantity`.
 * 3. User pays: (units_user / total_quantity) * line_item_total.
 * 4. Sum of all items must square with totalAmount (tolerance 0.01).
 */
export function calculateItemizedSplits(
  totalAmount: number,
  items: LineItemInput[],
  allGroupMemberIds: string[],
  currencyCode: string = 'EUR',
  options?: ItemizedSplitOptions
): ItemizedSplitCalculationResult {
  const round2 = (val: number) => Math.round(val * 100) / 100;

  if (items.length === 0) {
    const targetTotal = round2(totalAmount);
    return {
      results: [],
      itemsTotal: 0,
      itemsNetTotal: 0,
      itemsTaxTotal: 0,
      difference: targetTotal,
      isBalanced: false,
      errorMessage: 'No hay productos desglosados en el ticket.',
    };
  }

  if (allGroupMemberIds.length === 0) {
    return {
      results: [],
      itemsTotal: 0,
      itemsNetTotal: 0,
      itemsTaxTotal: 0,
      difference: round2(totalAmount),
      isBalanced: false,
      errorMessage: 'El grupo no tiene participantes disponibles para el reparto.',
    };
  }

  let totalItemCents = 0;
  let totalNetCents = 0;
  let totalTaxCents = 0;

  const unassignedItemDescriptions: string[] = [];
  const userCentsMap: Record<string, number> = {};
  const userNetCentsMap: Record<string, number> = {};
  const userTaxCentsMap: Record<string, number> = {};

  for (const id of allGroupMemberIds) {
    userCentsMap[id] = 0;
    userNetCentsMap[id] = 0;
    userTaxCentsMap[id] = 0;
  }

  // Process each line item
  for (const item of items) {
    const rawNetPrice = Math.max(0, Number(item.price) || 0);
    const rawTaxAmount = Math.max(
      0,
      item.tax_amount !== undefined && item.tax_amount !== null
        ? Number(item.tax_amount) || 0
        : item.tax_rate
        ? round2(rawNetPrice * (Number(item.tax_rate) / 100))
        : 0
    );

    const netCents = Math.round(rawNetPrice * 100);
    const taxCents = Math.round(rawTaxAmount * 100);
    const itemTotalCents = netCents + taxCents;

    totalNetCents += netCents;
    totalTaxCents += taxCents;
    totalItemCents += itemTotalCents;

    const totalQty = Math.max(1, Number(item.quantity) || 1);

    // Resolve user consumption shares
    const assignedShares = item.assignedShares || {};
    const validAssignedUsers = (item.assignedUserIds || []).filter((id) => allGroupMemberIds.includes(id));

    // Normalize shares map
    const userUnits: Record<string, number> = {};
    let totalAssignedUnits = 0;

    // Check if assignedShares has explicit positive numbers
    let hasExplicitShares = false;
    for (const uid of allGroupMemberIds) {
      if (assignedShares[uid] && assignedShares[uid] > 0) {
        hasExplicitShares = true;
        userUnits[uid] = Number(assignedShares[uid]);
        totalAssignedUnits += userUnits[uid];
      }
    }

    // Fallback: if no explicit shares map, but assignedUserIds exists
    if (!hasExplicitShares && validAssignedUsers.length > 0) {
      // If 1 user assigned and totalQty is anything, user took all units
      if (validAssignedUsers.length === 1) {
        const singleUid = validAssignedUsers[0];
        userUnits[singleUid] = totalQty;
        totalAssignedUnits = totalQty;
      } else {
        // Distribute 1 unit per user or split totalQty equally
        const sharePerUser = totalQty / validAssignedUsers.length;
        for (const uid of validAssignedUsers) {
          userUnits[uid] = sharePerUser;
          totalAssignedUnits += sharePerUser;
        }
      }
    }

    // Check if the item is fully distributed
    const isQtyDistributed = Math.abs(totalAssignedUnits - totalQty) <= 0.001;
    if (!isQtyDistributed || totalAssignedUnits <= 0) {
      const desc = item.description || 'Producto';
      unassignedItemDescriptions.push(
        `${desc} (${totalAssignedUnits.toFixed(0)} de ${totalQty.toFixed(0)} unidades asignadas)`
      );
    }

    if (totalAssignedUnits <= 0) continue;

    // Calculate each user's share for this item with remainder cent allocation
    const usersWithShares = Object.keys(userUnits).filter((uid) => userUnits[uid] > 0);
    let distributedItemCents = 0;
    let distributedNetCents = 0;
    let distributedTaxCents = 0;

    usersWithShares.forEach((uid, idx) => {
      const proportion = userUnits[uid] / totalAssignedUnits;
      const isLast = idx === usersWithShares.length - 1;

      const userTotal = isLast
        ? itemTotalCents - distributedItemCents
        : Math.round(itemTotalCents * proportion);

      const userNet = isLast
        ? netCents - distributedNetCents
        : Math.round(netCents * proportion);

      const userTax = userTotal - userNet;

      distributedItemCents += userTotal;
      distributedNetCents += userNet;
      distributedTaxCents += userTax;

      userCentsMap[uid] = (userCentsMap[uid] || 0) + userTotal;
      userNetCentsMap[uid] = (userNetCentsMap[uid] || 0) + userNet;
      userTaxCentsMap[uid] = (userTaxCentsMap[uid] || 0) + userTax;
    });
  }

  // If taxes are excluded and added at the bottom, distribute them proportionally to each user's net consumption
  if (options?.taxIncluded === false && (options?.taxAmount ?? 0) > 0 && totalTaxCents === 0 && totalNetCents > 0) {
    const bottomTaxCents = Math.round(options.taxAmount! * 100);
    totalTaxCents = bottomTaxCents;
    totalItemCents = totalNetCents + bottomTaxCents;

    const netActiveUsers = Object.keys(userNetCentsMap).filter((uid) => (userNetCentsMap[uid] || 0) > 0);
    let distributedBottomTaxCents = 0;

    netActiveUsers.forEach((uid, idx) => {
      const isLast = idx === netActiveUsers.length - 1;
      const userNet = userNetCentsMap[uid] || 0;
      const userTax = isLast
        ? bottomTaxCents - distributedBottomTaxCents
        : Math.round(bottomTaxCents * (userNet / totalNetCents));

      distributedBottomTaxCents += userTax;
      userTaxCentsMap[uid] = userTax;
      userCentsMap[uid] = userNet + userTax;
    });
  }

  const itemsTotal = round2(totalItemCents / 100);
  const itemsNetTotal = round2(totalNetCents / 100);
  const itemsTaxTotal = round2(totalTaxCents / 100);
  const targetTotal = round2(totalAmount);
  const diffCents = Math.round(targetTotal * 100) - totalItemCents;
  const difference = round2(diffCents / 100);

  const hasUnassignedItems = unassignedItemDescriptions.length > 0;
  const isBalanced = items.length > 0 && Math.abs(difference) <= 0.01 && !hasUnassignedItems;

  // If balanced and there's a 1 cent rounding difference with totalAmount, adjust the first non-zero user
  if (isBalanced && diffCents !== 0) {
    const firstUserId = Object.keys(userCentsMap).find((u) => userCentsMap[u] > 0) || allGroupMemberIds[0];
    if (firstUserId) {
      userCentsMap[firstUserId] = Math.max(0, (userCentsMap[firstUserId] || 0) + diffCents);
    }
  }

  // Generate results list
  const results: CalculatedItemizedUserSplit[] = [];
  const finalSumCents = Object.values(userCentsMap).reduce((acc, c) => acc + c, 0);

  for (const [userId, cents] of Object.entries(userCentsMap)) {
    if (cents > 0) {
      results.push({
        userId,
        amountOwed: round2(cents / 100),
        netOwed: round2((userNetCentsMap[userId] || 0) / 100),
        taxOwed: round2((userTaxCentsMap[userId] || 0) / 100),
        percentage: finalSumCents > 0 ? round2((cents / finalSumCents) * 100) : undefined,
      });
    }
  }

  let errorMessage: string | undefined;
  if (hasUnassignedItems) {
    errorMessage = `Debes distribuir todas las unidades de los productos antes de guardar: ${unassignedItemDescriptions.join(', ')}.`;
  } else if (Math.abs(difference) > 0.01) {
    const sumFormatted = formatMoney(itemsTotal, currencyCode);
    const totalFormatted = formatMoney(targetTotal, currencyCode);
    const diffFormatted = formatMoney(Math.abs(difference), currencyCode);
    errorMessage = `La suma de productos con impuestos (${sumFormatted}) no coincide con el total de la factura (${totalFormatted}). Descuadre: ${
      difference > 0 ? '+' : '-'
    }${diffFormatted}`;
  }

  return {
    results,
    itemsTotal,
    itemsNetTotal,
    itemsTaxTotal,
    difference,
    isBalanced,
    hasUnassignedItems,
    unassignedItemDescriptions,
    errorMessage,
  };
}
