'use client';

import React, { useState } from 'react';
import { Expense } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { getCategoryInfo } from '@/lib/categories';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { ReceiptModal } from '@/components/expenses/ReceiptModal';
import { LocationModal } from '@/components/expenses/LocationModal';
import { Receipt, Trash2, Pencil, Users, Globe, MapPin } from 'lucide-react';

export interface ExpenseCardProps {
  expense: Expense;
  baseCurrency?: string;
  onEdit?: (expense: Expense) => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  baseCurrency = 'EUR',
  onEdit,
}) => {
  const { currentUser, deleteExpense } = usePachas();
  const [showReceipt, setShowReceipt] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCreator = expense.created_by === currentUser.id;
  const isForeign = expense.currency !== baseCurrency;
  const hasLocation = !!(expense.latitude && expense.longitude);
  const category = getCategoryInfo(expense.category);

  // Payers info
  const payerProfiles = expense.payers?.map((p) => p.profile).filter(Boolean) || [expense.creator];
  const firstPayer = payerProfiles[0];
  const isMultiPayer = (expense.payers?.length || 0) > 1;

  // Calculate user share in the original expense currency
  const userPaidOriginal =
    expense.payers?.find((p) => p.user_id === currentUser.id)?.amount_paid ||
    (expense.created_by === currentUser.id && !expense.payers?.length ? expense.amount : 0);

  const userParticipant = expense.participants?.find((p) => p.user_id === currentUser.id);
  const expenseBaseAmount = expense.converted_amount || expense.amount || 1;
  const userOwedConverted = userParticipant ? userParticipant.amount_owed : 0;
  // Convert user owed portion back to the expense's original currency for display on this specific card
  const userOwedOriginal = (userOwedConverted / expenseBaseAmount) * expense.amount;
  const userInvolved = userPaidOriginal > 0 || !!userParticipant;
  const netDiff = Math.round((userPaidOriginal - userOwedOriginal) * 100) / 100;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCreator) {
      alert('Solo el creador de este gasto puede eliminarlo.');
      return;
    }

    if (confirm(`¿Seguro que deseas eliminar el gasto "${expense.title}"?`)) {
      setIsDeleting(true);
      try {
        await deleteExpense(expense.group_id, expense.id);
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el gasto');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCreator) {
      alert('Solo el creador de este gasto puede editarlo.');
      return;
    }
    if (onEdit) {
      onEdit(expense);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3 group">
        {/* Left: Category Icon + Title + Meta */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${category.bgColor} border ${category.borderColor}`}
          >
            {category.emoji}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {expense.title}
              </h4>
              {isForeign && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-0.5 shrink-0">
                  <Globe className="w-2.5 h-2.5" />
                  {expense.currency}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{formatDate(expense.expense_date, 'd MMM')}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>Pagó</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isMultiPayer ? 'Varios amigos' : firstPayer?.full_name?.split(' ')[0] || 'Alguien'}
                </span>
              </div>

              {/* Number of participants badge */}
              {expense.participants && expense.participants.length > 0 && (
                <div className="flex items-center gap-0.5 text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                  <Users className="w-2.5 h-2.5" />
                  <span>{expense.participants.length}</span>
                </div>
              )}

              {/* Location indicator chip */}
              {hasLocation && (
                <button
                  type="button"
                  onClick={() => setShowLocation(true)}
                  className="flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline max-w-[140px] truncate"
                  title={expense.location_name || 'Ver en mapa'}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{expense.location_name?.split(',')[0] || 'En mapa'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount in ORIGINAL currency + User share + Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            {/* Show value in ORIGINAL currency without converting it in the list */}
            <span className="text-base font-black text-slate-900 dark:text-white block">
              {formatMoney(expense.amount, expense.currency)}
            </span>

            {userInvolved && (
              <span
                className={`text-[11px] font-semibold ${
                  netDiff > 0.01
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : netDiff < -0.01
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500'
                }`}
              >
                {netDiff > 0.01
                  ? `Prestaste ${formatMoney(userPaidOriginal - userOwedOriginal, expense.currency)}`
                  : netDiff < -0.01
                  ? `Tu parte: ${formatMoney(userOwedOriginal - userPaidOriginal, expense.currency)}`
                  : 'Aportaste tu parte'}
              </span>
            )}
          </div>

          {/* Location button */}
          {hasLocation && (
            <button
              onClick={() => setShowLocation(true)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors"
              title="Ver ubicación en el mapa"
            >
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </button>
          )}

          {/* Receipt thumbnail button */}
          {expense.receipt_url && (
            <button
              onClick={() => setShowReceipt(true)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors"
              title="Ver foto del ticket"
            >
              <Receipt className="w-5 h-5" />
            </button>
          )}

          {/* Creator Only Actions: Edit and Delete buttons */}
          {isCreator && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Edit button */}
              <button
                onClick={handleEditClick}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all"
                title="Editar gasto"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {/* Delete button */}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                title="Eliminar gasto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptUrl={expense.receipt_url || null}
        title={expense.title}
      />

      <LocationModal
        isOpen={showLocation}
        onClose={() => setShowLocation(false)}
        title={expense.title}
        latitude={expense.latitude || null}
        longitude={expense.longitude || null}
        locationName={expense.location_name}
      />
    </>
  );
};
