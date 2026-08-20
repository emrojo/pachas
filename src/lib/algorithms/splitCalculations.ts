import { SplitType } from '@/types/database';
import { getCurrencyByCode, formatMoney } from '@/lib/currencies';

export interface ParticipantSplitInput {
  userId: string;
  exactAmount?: number;
  percentage?: number;
  shares?: number;
}

export interface CalculatedSplitResult {
  userId: string;
  amountOwed: number;
  percentage?: number;
  shares?: number;
}

/**
 * Calculates the exact amount owed by each participant based on split type.
 * Accurately handles floating-point remainder cents so the sum exactly equals total.
 */
export function calculateSplits(
  totalAmount: number,
  splitType: SplitType,
  selectedUserIds: string[],
  customInputs: Record<string, { exact?: number; percentage?: number; shares?: number }> = {},
  currencyCode: string = 'EUR'
): { results: CalculatedSplitResult[]; isValid: boolean; errorMessage?: string } {
  const currencyObj = getCurrencyByCode(currencyCode);

  if (selectedUserIds.length === 0) {
    return {
      results: [],
      isValid: false,
      errorMessage: 'Debes seleccionar al menos un participante',
    };
  }

  if (totalAmount <= 0) {
    return {
      results: [],
      isValid: false,
      errorMessage: 'El importe total debe ser mayor que 0',
    };
  }

  const count = selectedUserIds.length;

  // 1. EQUAL SPLIT
  if (splitType === 'EQUAL') {
    const totalCents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents % count;

    const results: CalculatedSplitResult[] = selectedUserIds.map((userId, idx) => {
      // Give remainder cents to the first few participants
      const cents = baseCents + (idx < remainderCents ? 1 : 0);
      return {
        userId,
        amountOwed: cents / 100,
      };
    });

    return { results, isValid: true };
  }

  // 2. EXACT AMOUNTS
  if (splitType === 'EXACT') {
    let sumExact = 0;
    const results: CalculatedSplitResult[] = [];

    for (const userId of selectedUserIds) {
      const amt = Number(customInputs[userId]?.exact || 0);
      sumExact += amt;
      results.push({
        userId,
        amountOwed: Math.round(amt * 100) / 100,
      });
    }

    const diff = Math.round((totalAmount - sumExact) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const sumFormatted = formatMoney(sumExact, currencyCode);
      const totalFormatted = formatMoney(totalAmount, currencyCode);
      const diffFormatted = formatMoney(Math.abs(diff), currencyCode);
      return {
        results,
        isValid: false,
        errorMessage: `La suma de importes (${sumFormatted}) no coincide con el total (${totalFormatted}). Diferencia: ${diff > 0 ? '+' : '-'}${diffFormatted}`,
      };
    }

    return { results, isValid: true };
  }

  // 3. PERCENTAGE SPLIT
  if (splitType === 'PERCENTAGE') {
    let sumPercent = 0;
    for (const userId of selectedUserIds) {
      sumPercent += Number(customInputs[userId]?.percentage || 0);
    }

    if (Math.abs(sumPercent - 100) > 0.01) {
      const pctFormatted = sumPercent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return {
        results: [],
        isValid: false,
        errorMessage: `La suma de porcentajes debe ser exactamente 100% (actualmente: ${pctFormatted}%)`,
      };
    }

    const totalCents = Math.round(totalAmount * 100);
    let distributedCents = 0;
    const results: CalculatedSplitResult[] = [];

    selectedUserIds.forEach((userId, idx) => {
      const pct = Number(customInputs[userId]?.percentage || 0);
      if (idx === selectedUserIds.length - 1) {
        // Last person absorbs rounding discrepancy
        const cents = totalCents - distributedCents;
        results.push({
          userId,
          amountOwed: cents / 100,
          percentage: pct,
        });
      } else {
        const cents = Math.round((totalCents * pct) / 100);
        distributedCents += cents;
        results.push({
          userId,
          amountOwed: cents / 100,
          percentage: pct,
        });
      }
    });

    return { results, isValid: true };
  }

  // 4. SHARES SPLIT (Raciones)
  if (splitType === 'SHARES') {
    let totalShares = 0;
    for (const userId of selectedUserIds) {
      const s = Number(customInputs[userId]?.shares || 1);
      totalShares += s <= 0 ? 1 : s;
    }

    if (totalShares <= 0) {
      return {
        results: [],
        isValid: false,
        errorMessage: 'El número total de raciones debe ser mayor que 0',
      };
    }

    const totalCents = Math.round(totalAmount * 100);
    let distributedCents = 0;
    const results: CalculatedSplitResult[] = [];

    selectedUserIds.forEach((userId, idx) => {
      const s = Number(customInputs[userId]?.shares || 1);
      const safeShares = s <= 0 ? 1 : s;

      if (idx === selectedUserIds.length - 1) {
        // Last person absorbs rounding discrepancy
        const cents = totalCents - distributedCents;
        results.push({
          userId,
          amountOwed: cents / 100,
          shares: safeShares,
        });
      } else {
        const cents = Math.round((totalCents * safeShares) / totalShares);
        distributedCents += cents;
        results.push({
          userId,
          amountOwed: cents / 100,
          shares: safeShares,
        });
      }
    });

    return { results, isValid: true };
  }

  return { results: [], isValid: false, errorMessage: 'Modo de reparto no válido' };
}
