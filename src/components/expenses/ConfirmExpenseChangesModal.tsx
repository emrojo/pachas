'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/context/LanguageContext';
import { ExpenseChangeDiff } from '@/lib/algorithms/expenseChangeDetector';
import { AlertTriangle, ArrowRight, Check, RotateCcw } from 'lucide-react';

export interface ConfirmExpenseChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  changes: ExpenseChangeDiff[];
  isLoading?: boolean;
}

export const ConfirmExpenseChangesModal: React.FC<ConfirmExpenseChangesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  changes,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('expenses.confirmEditTitle') || 'Confirmar modificaciones en el gasto'}
      description={
        t('expenses.confirmEditSubtitle') ||
        'Se han detectado cambios respecto a los datos originales. Revisa las modificaciones antes de guardar:'
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              {t('expenses.changesDetectedCount', { count: changes.length }) ||
                `${changes.length} ${changes.length === 1 ? 'campo modificado' : 'campos modificados'}`}
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              {t('expenses.confirmEditWarning') ||
                'Al confirmar, las deudas y balances del grupo se actualizarán automáticamente con estos nuevos datos.'}
            </p>
          </div>
        </div>

        {/* Changes list */}
        <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
          {changes.map((change) => (
            <div
              key={change.fieldKey}
              className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {change.fieldLabel}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-2 text-xs">
                {/* Before */}
                <div className="p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 font-medium">
                  <span className="block text-[10px] text-rose-500 dark:text-rose-400 font-semibold uppercase mb-0.5">
                    {t('expenses.fieldOriginal') || 'Anterior'}
                  </span>
                  <span className="line-through decoration-rose-400/80 break-words">{change.oldValue}</span>
                </div>

                {/* Arrow */}
                <div className="flex justify-center text-slate-400 shrink-0">
                  <ArrowRight className="w-4 h-4 hidden sm:block" />
                  <span className="sm:hidden text-center text-xs font-bold text-slate-400">↓</span>
                </div>

                {/* After */}
                <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-bold">
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase mb-0.5">
                    {t('expenses.fieldModified') || 'Nuevo'}
                  </span>
                  <span className="break-words">{change.newValue}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs font-bold gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('expenses.keepEditing') || 'Seguir editando'}
          </Button>

          <Button
            type="button"
            variant="brand"
            onClick={onConfirm}
            isLoading={isLoading}
            className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20"
          >
            <Check className="w-4 h-4" />
            {t('expenses.confirmAndSave') || 'Confirmar y Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
