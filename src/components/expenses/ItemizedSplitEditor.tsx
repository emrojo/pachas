'use client';

import React, { useEffect, useMemo } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney, parseEuropeanAmount, formatNumber } from '@/lib/currencies';
import { Profile } from '@/types/database';
import { generateUUID } from '@/lib/id';
import {
  calculateItemizedSplits,
  LineItemInput,
} from '@/lib/algorithms/itemizedSplitCalculations';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Sparkles,
  DollarSign,
  Scale,
} from 'lucide-react';

export interface ItemizedSplitEditorProps {
  items: LineItemInput[];
  onChangeItems?: (items: LineItemInput[]) => void;
  onChange?: (items: LineItemInput[]) => void;
  members: Array<{ user_id: string; profile?: Profile }>;
  totalAmount?: number;
  totalInvoiceAmount?: number;
  currency: string;
  isReadOnly?: boolean;
  onBalanceChange?: (isBalanced: boolean, diff: number) => void;
}

export const ItemizedSplitEditor: React.FC<ItemizedSplitEditorProps> = ({
  items,
  onChangeItems,
  onChange,
  members,
  totalAmount = 0,
  totalInvoiceAmount,
  currency,
  isReadOnly = false,
  onBalanceChange,
}) => {
  const { t } = useTranslation();

  const targetTotal = totalInvoiceAmount !== undefined ? totalInvoiceAmount : totalAmount;
  const updateItems = onChange || onChangeItems || (() => {});

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const calc = useMemo(() => {
    return calculateItemizedSplits(targetTotal, items, memberIds, currency);
  }, [targetTotal, items, memberIds, currency]);

  useEffect(() => {
    if (onBalanceChange) {
      onBalanceChange(calc.isBalanced, calc.difference);
    }
  }, [calc.isBalanced, calc.difference, onBalanceChange]);

  const handleAddItem = () => {
    const newItem: LineItemInput = {
      id: generateUUID(),
      description: '',
      price: 0,
      assignedUserIds: [],
    };
    updateItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    updateItems(next);
  };

  const handleUpdateItem = (index: number, updates: Partial<LineItemInput>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...updates } : it));
    updateItems(next);
  };

  const handleToggleMember = (index: number, userId: string) => {
    if (isReadOnly) return;
    const item = items[index];
    if (!item) return;

    const current = item.assignedUserIds || [];
    let nextAssigned: string[];
    if (current.includes(userId)) {
      nextAssigned = current.filter((id) => id !== userId);
    } else {
      nextAssigned = [...current, userId];
    }
    handleUpdateItem(index, { assignedUserIds: nextAssigned });
  };

  const getMemberName = (userId: string): string => {
    const m = members.find((mem) => mem.user_id === userId);
    return m?.profile?.full_name || m?.profile?.email?.split('@')[0] || t('common.member') || 'Usuario';
  };

  return (
    <div className="space-y-4 rounded-2xl border-2 border-emerald-500/20 bg-slate-50/60 dark:bg-slate-900/40 p-4 transition-all shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{t('expenses.itemsTableTitle') || 'Desglose de productos del ticket'}</span>
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('expenses.splitItemsSubtitle') || 'Asigna cada producto a quien lo consumió. Si no seleccionas a nadie, se comparte entre todo el grupo.'}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 hover:bg-emerald-200/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('expenses.addProduct') || 'Añadir producto'}</span>
          </button>
        )}
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <p>{t('expenses.noItemsYet') || 'No hay productos desglosados todavía. Añade uno con el botón superior.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const assigned = item.assignedUserIds || [];
            const isSingle = assigned.length === 1;
            const isMulti = assigned.length > 1;
            const isGroup = assigned.length === 0;

            const singleName = isSingle ? getMemberName(assigned[0]) : '';
            const perPerson = isMulti
              ? Math.round((item.price / assigned.length) * 100) / 100
              : isGroup && members.length > 0
              ? Math.round((item.price / members.length) * 100) / 100
              : item.price;

            return (
              <div
                key={item.id || idx}
                className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-2.5 transition-all hover:border-emerald-500/30"
              >
                {/* Inputs: Description + Price + Delete */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={item.description}
                      onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                      placeholder={t('expenses.productDescPlaceholder') || 'Ej: Cerveza, Pizza, Ensalada...'}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="w-28 shrink-0 relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={isReadOnly}
                      value={typeof item.price === 'number' && item.price > 0 ? String(item.price).replace('.', ',') : (item.price === 0 ? '' : String(item.price))}
                      onChange={(e) => {
                        const parsed = parseEuropeanAmount(e.target.value);
                        handleUpdateItem(idx, { price: parsed });
                      }}
                      placeholder="0,00"
                      className="w-full text-xs font-black tabular-nums text-right pr-7 pl-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                      {currency}
                    </span>
                  </div>

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                      title={t('common.delete') || 'Eliminar'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Member selection chips */}
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                      {t('expenses.assignedTo') || 'Consumidores'}:
                    </span>

                    {/* Dynamic rule badge */}
                    <div className="text-[10px] font-bold">
                      {isSingle && (
                        <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                          {t('expenses.paidByOne', { name: singleName }) || `Paga ${singleName} (100%)`}
                        </span>
                      )}
                      {isMulti && (
                        <span className="text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded-md border border-sky-200/60 dark:border-sky-800/60">
                          {t('expenses.itemizedSharedByMultiple', { count: assigned.length, amount: formatMoney(perPerson, currency) }) ||
                            `Compartido entre ${assigned.length} (${formatMoney(perPerson, currency)} c/u)`}
                        </span>
                      )}
                      {isGroup && (
                        <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                          {t('expenses.paidByAll', { amount: formatMoney(perPerson, currency) }) ||
                            `Compartido por todos (${formatMoney(perPerson, currency)} c/u)`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {members.map((m) => {
                      const isSelected = assigned.includes(m.user_id);
                      const name = m.profile?.full_name || m.profile?.email?.split('@')[0] || 'U';

                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleToggleMember(idx, m.user_id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.8 rounded-lg text-xs font-semibold transition-all border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-transparent'
                          } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <Avatar
                            profile={m.profile}
                            size="sm"
                            className="w-3.5 h-3.5 text-[9px]"
                          />
                          <span className="truncate max-w-[90px]">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Balancing / Reconciliation Card */}
      <div
        className={`p-3.5 rounded-xl border-2 transition-all shadow-xs ${
          calc.isBalanced
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600/70 text-emerald-950 dark:text-emerald-100'
            : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600/70 text-rose-950 dark:text-rose-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                calc.isBalanced ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
              }`}
            >
              {calc.isBalanced ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span>
                  {calc.isBalanced
                    ? t('expenses.ticketBalanced') || '¡Total cuadrado con la factura!'
                    : t('expenses.ticketUnbalancedTitle') || 'Descuadre en los productos'}
                </span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    calc.isBalanced
                      ? 'bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100'
                      : 'bg-rose-200/60 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100'
                  }`}
                >
                  {calc.difference === 0
                    ? '0,00 ' + currency
                    : `${calc.difference > 0 ? '+' : '-'}${formatMoney(Math.abs(calc.difference), currency)}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                {calc.isBalanced
                  ? 'La suma de los productos coincide exactamente con el importe total del gasto.'
                  : `La suma de productos (${formatMoney(calc.itemsTotal, currency)}) no coincide con el total de la factura (${formatMoney(totalAmount, currency)}). Ajusta los productos para poder guardar.`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 self-end sm:self-auto">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Suma productos / Total
            </div>
            <div className="text-xs sm:text-sm font-black tabular-nums">
              <span className={calc.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {formatMoney(calc.itemsTotal, currency)}
              </span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-slate-900 dark:text-white">
                {formatMoney(totalAmount, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Live calculated share per participant preview when balanced */}
        {calc.isBalanced && calc.results.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
            <div className="text-[10px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
              {t('expenses.breakdownPreview') || 'Reparto resultante por persona'}:
            </div>
            <div className="flex flex-wrap gap-2">
              {calc.results.map((res) => {
                const name = getMemberName(res.userId);
                return (
                  <div
                    key={res.userId}
                    className="inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-900/60 px-2 py-1 rounded-lg text-xs border border-emerald-300/60 dark:border-emerald-700/60"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{name}:</span>
                    <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatMoney(res.amountOwed, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
