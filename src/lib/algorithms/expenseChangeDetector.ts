import { Expense, Profile, ExpenseCategory, SplitType } from '@/types/database';
import { CreateExpenseInput } from '@/context/PachasContext';
import { formatMoney } from '@/lib/currencies';
import { CATEGORIES } from '@/lib/categories';

export interface ExpenseChangeDiff {
  fieldKey: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

export interface DetectChangesOptions {
  members?: Array<{ user_id: string; profile?: Profile }>;
  currency?: string;
}

function resolveMemberName(userId: string, members?: Array<{ user_id: string; profile?: Profile }>): string {
  if (!members) return userId;
  const m = members.find((mem) => mem.user_id === userId);
  return m?.profile?.full_name || m?.profile?.email?.split('@')[0] || userId;
}

function formatCategoryLabel(cat?: ExpenseCategory): string {
  if (!cat) return 'General';
  const info = CATEGORIES[cat];
  return info ? `${info.emoji} ${info.label}` : cat;
}

function formatSplitTypeLabel(splitType?: SplitType): string {
  switch (splitType) {
    case 'EQUAL':
      return 'A partes iguales';
    case 'EXACT':
      return 'Importes exactos';
    case 'PERCENTAGE':
      return 'Por porcentajes (%)';
    case 'SHARES':
      return 'Por raciones / partes';
    case 'ITEMIZED':
      return 'Por productos (desglosado)';
    default:
      return splitType || 'Estándar';
  }
}

function formatDateTimePretty(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return isoStr;
  }
}

/**
 * Compares an existing Expense with pending updated data from the expense form.
 * Returns a list of detected differences with user-friendly labels and values.
 */
export function detectExpenseChanges(
  original: Expense,
  updated: CreateExpenseInput,
  options?: DetectChangesOptions
): ExpenseChangeDiff[] {
  const diffs: ExpenseChangeDiff[] = [];
  const members = options?.members || [];
  const baseCurr = options?.currency || original.currency || 'EUR';

  // 1. Title / Concept
  const oldTitle = (original.title || '').trim();
  const newTitle = (updated.title || '').trim();
  if (oldTitle !== newTitle) {
    diffs.push({
      fieldKey: 'title',
      fieldLabel: 'Concepto / Título',
      oldValue: oldTitle,
      newValue: newTitle,
    });
  }

  // 2. Amount and Currency
  const oldAmt = Number(original.amount) || 0;
  const newAmt = Number(updated.amount) || 0;
  const oldCurr = original.currency || baseCurr;
  const newCurr = updated.currency || baseCurr;

  if (Math.abs(oldAmt - newAmt) > 0.009 || oldCurr !== newCurr) {
    diffs.push({
      fieldKey: 'amount',
      fieldLabel: 'Importe total',
      oldValue: formatMoney(oldAmt, oldCurr),
      newValue: formatMoney(newAmt, newCurr),
    });
  }

  // 3. Category
  if (original.category !== updated.category) {
    diffs.push({
      fieldKey: 'category',
      fieldLabel: 'Categoría',
      oldValue: formatCategoryLabel(original.category),
      newValue: formatCategoryLabel(updated.category),
    });
  }

  // 4. Date & Time (check YYYY-MM-DD and HH:mm)
  const oldDtStr = formatDateTimePretty(original.expense_date);
  const newDtStr = formatDateTimePretty(updated.expenseDate);
  if (oldDtStr && newDtStr && oldDtStr !== newDtStr) {
    diffs.push({
      fieldKey: 'expense_date',
      fieldLabel: 'Fecha y hora',
      oldValue: oldDtStr,
      newValue: newDtStr,
    });
  }

  // 5. Payers
  const oldPayers = original.payers || [];
  const newPayers = updated.payers || [];

  const formatPayersSummary = (list: Array<{ userId?: string; user_id?: string; amountPaid?: number; amount_paid?: number }>) => {
    if (list.length === 0) return 'Sin pagador especificado';
    return list
      .map((p) => {
        const uid = p.userId || p.user_id || '';
        const name = resolveMemberName(uid, members);
        const amt = Number(p.amountPaid ?? p.amount_paid ?? 0);
        return `${name} (${formatMoney(amt, newCurr)})`;
      })
      .join(', ');
  };

  const oldPayersSummary = formatPayersSummary(oldPayers);
  const newPayersSummary = formatPayersSummary(newPayers);

  // Check if count, users, or amounts changed
  let payersChanged = oldPayers.length !== newPayers.length;
  if (!payersChanged) {
    for (const np of newPayers) {
      const match = oldPayers.find((op) => op.user_id === np.userId);
      if (!match || Math.abs(Number(match.amount_paid) - Number(np.amountPaid)) > 0.009) {
        payersChanged = true;
        break;
      }
    }
  }

  if (payersChanged) {
    diffs.push({
      fieldKey: 'payers',
      fieldLabel: 'Pagado por',
      oldValue: oldPayersSummary,
      newValue: newPayersSummary,
    });
  }

  // 6. Split Type
  const oldSplitType = original.split_type || 'EQUAL';
  const newSplitType = updated.splitType || 'EQUAL';
  if (oldSplitType !== newSplitType) {
    diffs.push({
      fieldKey: 'split_type',
      fieldLabel: 'Tipo de reparto',
      oldValue: formatSplitTypeLabel(oldSplitType),
      newValue: formatSplitTypeLabel(newSplitType),
    });
  }

  // 7. Participants sharing the expense
  if (newSplitType !== 'ITEMIZED') {
    const oldPartIds = (original.participants || []).map((p) => p.user_id).sort();
    const newPartIds = [...(updated.selectedParticipantIds || [])].sort();

    const partsChanged =
      oldPartIds.length !== newPartIds.length ||
      oldPartIds.some((id, i) => id !== newPartIds[i]);

    if (partsChanged) {
      const formatPartsList = (ids: string[]) => {
        if (ids.length === 0) return 'Nadie';
        if (ids.length === members.length && members.length > 0) return `Todos (${ids.length} amigos)`;
        return `${ids.length} amigos: ` + ids.map((id) => resolveMemberName(id, members)).join(', ');
      };

      diffs.push({
        fieldKey: 'participants',
        fieldLabel: 'Participantes',
        oldValue: formatPartsList(oldPartIds),
        newValue: formatPartsList(newPartIds),
      });
    }
  }

  // 8. Line Items (Itemized breakdown)
  if (newSplitType === 'ITEMIZED' || oldSplitType === 'ITEMIZED') {
    const oldItems = original.items || [];
    const newItems = updated.items || [];

    let itemsChanged = oldItems.length !== newItems.length;
    if (!itemsChanged) {
      for (let i = 0; i < newItems.length; i++) {
        const oi = oldItems[i];
        const ni = newItems[i];
        if (
          !oi ||
          !ni ||
          oi.description !== ni.description ||
          Math.abs(Number(oi.price) - Number(ni.price)) > 0.009 ||
          (Number(oi.quantity) || 1) !== (Number(ni.quantity) || 1)
        ) {
          itemsChanged = true;
          break;
        }
      }
    }

    if (itemsChanged) {
      diffs.push({
        fieldKey: 'items',
        fieldLabel: 'Productos desglosados',
        oldValue: `${oldItems.length} productos`,
        newValue: `${newItems.length} productos`,
      });
    }
  }

  // 9. Notes
  const oldNotes = (original.notes || '').trim();
  const newNotes = (updated.notes || '').trim();
  if (oldNotes !== newNotes) {
    diffs.push({
      fieldKey: 'notes',
      fieldLabel: 'Notas / Observaciones',
      oldValue: oldNotes || '(Sin notas)',
      newValue: newNotes || '(Sin notas)',
    });
  }

  // 10. Location
  const oldLoc = (original.location_name || '').trim();
  const newLoc = (updated.locationName || '').trim();
  if (oldLoc !== newLoc) {
    diffs.push({
      fieldKey: 'location',
      fieldLabel: 'Ubicación',
      oldValue: oldLoc || '(Sin ubicación)',
      newValue: newLoc || '(Sin ubicación)',
    });
  }

  // 11. Receipt Attachment
  const hadReceipt = Boolean(original.receipt_url);
  const hasReceipt = Boolean(updated.receiptUrl);
  if (hadReceipt !== hasReceipt) {
    diffs.push({
      fieldKey: 'receipt',
      fieldLabel: 'Foto del ticket',
      oldValue: hadReceipt ? 'Con ticket adjunto' : 'Sin ticket',
      newValue: hasReceipt ? 'Con ticket adjunto' : 'Ticket eliminado',
    });
  }

  return diffs;
}
