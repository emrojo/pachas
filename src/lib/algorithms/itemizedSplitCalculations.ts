import { CalculatedSplitResult } from '@/lib/algorithms/splitCalculations';
import { formatMoney } from '@/lib/currencies';

export interface LineItemInput {
  id: string;
  description: string;
  description_original?: string;
  price: number;
  assignedUserIds: string[];
}

export interface ItemizedSplitCalculationResult {
  results: CalculatedSplitResult[];
  itemsTotal: number;
  difference: number;
  isBalanced: boolean;
  errorMessage?: string;
}

/**
 * Calculates itemized expense splits based on line items assigned to specific group members.
 * 
 * Rules:
 * 1. 1 member assigned -> Pays 100% of the line item price.
 * 2. N members assigned -> Price split equally among the N members (cents balanced without loss).
 * 3. 0 members assigned -> Price split equally among all members of the group.
 * 4. Strict balance: sum of item prices must square with totalAmount (within 0.01 tolerance).
 */
export function calculateItemizedSplits(
  totalAmount: number,
  items: LineItemInput[],
  allGroupMemberIds: string[],
  currencyCode: string = 'EUR'
): ItemizedSplitCalculationResult {
  const round2 = (val: number) => Math.round(val * 100) / 100;

  // Calculate sum of item prices in cents
  let totalItemCents = 0;
  for (const item of items) {
    const p = Math.max(0, Number(item.price) || 0);
    totalItemCents += Math.round(p * 100);
  }

  const itemsTotal = round2(totalItemCents / 100);
  const targetTotal = round2(totalAmount);
  const diffCents = Math.round(targetTotal * 100) - totalItemCents;
  const difference = round2(diffCents / 100);
  const isBalanced = items.length > 0 && Math.abs(difference) <= 0.01;

  if (items.length === 0) {
    return {
      results: [],
      itemsTotal: 0,
      difference: targetTotal,
      isBalanced: false,
      errorMessage: 'No hay productos desglosados en el ticket.',
    };
  }

  if (allGroupMemberIds.length === 0) {
    return {
      results: [],
      itemsTotal,
      difference,
      isBalanced: false,
      errorMessage: 'El grupo no tiene participantes disponibles para el reparto.',
    };
  }

  // Accumulate cents owed per user
  const userCentsMap: Record<string, number> = {};
  for (const id of allGroupMemberIds) {
    userCentsMap[id] = 0;
  }

  for (const item of items) {
    const rawPrice = Math.max(0, Number(item.price) || 0);
    const itemCents = Math.round(rawPrice * 100);
    if (itemCents <= 0) continue;

    // Determine target consumers: assigned users, or entire group if empty
    const validAssigned = (item.assignedUserIds || []).filter((id) => allGroupMemberIds.includes(id));
    const consumers = validAssigned.length > 0 ? validAssigned : allGroupMemberIds;

    const count = consumers.length;
    if (count === 0) continue;

    const baseCents = Math.floor(itemCents / count);
    const remainderCents = itemCents % count;

    consumers.forEach((userId, idx) => {
      const share = baseCents + (idx < remainderCents ? 1 : 0);
      userCentsMap[userId] = (userCentsMap[userId] || 0) + share;
    });
  }

  // If balanced and there's a 1 cent rounding difference with totalAmount, adjust the first non-zero user
  if (isBalanced && diffCents !== 0) {
    const firstUserId = Object.keys(userCentsMap).find((u) => userCentsMap[u] > 0) || allGroupMemberIds[0];
    if (firstUserId) {
      userCentsMap[firstUserId] = Math.max(0, (userCentsMap[firstUserId] || 0) + diffCents);
    }
  }

  // Generate results list
  const results: CalculatedSplitResult[] = [];
  const finalSumCents = Object.values(userCentsMap).reduce((acc, c) => acc + c, 0);

  for (const [userId, cents] of Object.entries(userCentsMap)) {
    if (cents > 0) {
      results.push({
        userId,
        amountOwed: round2(cents / 100),
        percentage: finalSumCents > 0 ? round2((cents / finalSumCents) * 100) : undefined,
      });
    }
  }

  let errorMessage: string | undefined;
  if (!isBalanced) {
    const sumFormatted = formatMoney(itemsTotal, currencyCode);
    const totalFormatted = formatMoney(targetTotal, currencyCode);
    const diffFormatted = formatMoney(Math.abs(difference), currencyCode);
    errorMessage = `La suma de productos (${sumFormatted}) no coincide con el total de la factura (${totalFormatted}). Descuadre: ${
      difference > 0 ? '+' : '-'
    }${diffFormatted}`;
  }

  return {
    results,
    itemsTotal,
    difference,
    isBalanced,
    errorMessage,
  };
}
