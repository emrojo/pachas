'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney, parseEuropeanAmount, formatNumber } from '@/lib/currencies';
import { Profile } from '@/types/database';
import { generateUUID } from '@/lib/id';
import { resolveTaxLabel, getPresetTaxRates, calculateTaxBreakdown } from '@/lib/taxes';
import {
  calculateItemizedSplits,
  LineItemInput,
} from '@/lib/algorithms/itemizedSplitCalculations';
import {
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Users,
  Sparkles,
  Receipt,
  Percent,
  Check,
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
  defaultTaxName?: string;
  taxIncluded?: boolean;
  taxAmount?: number;
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
  defaultTaxName,
  taxIncluded = true,
  taxAmount = 0,
}) => {
  const { t, language } = useTranslation();

  const targetTotal = totalInvoiceAmount !== undefined ? totalInvoiceAmount : totalAmount;
  const updateItems = onChange || onChangeItems || (() => {});

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const activeTaxLabel = useMemo(
    () => defaultTaxName || resolveTaxLabel(currency, language),
    [defaultTaxName, currency, language]
  );
  const presetTaxRates = useMemo(() => getPresetTaxRates(currency), [currency]);

  const calc = useMemo(() => {
    return calculateItemizedSplits(targetTotal, items, memberIds, currency, { taxIncluded, taxAmount });
  }, [targetTotal, items, memberIds, currency, taxIncluded, taxAmount]);

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
      quantity: 1,
      tax_name: activeTaxLabel,
      tax_rate: presetTaxRates.includes(10) ? 10 : presetTaxRates[presetTaxRates.length - 1] || 0,
      tax_amount: 0,
      assignedUserIds: [],
      assignedShares: {},
    };
    updateItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    updateItems(next);
  };

  const handleUpdateItem = (index: number, updates: Partial<LineItemInput>) => {
    const next = items.map((it, i) => {
      if (i !== index) return it;
      const merged = { ...it, ...updates };

      // Recompute tax_amount if price or tax_rate changed
      if (updates.price !== undefined || updates.tax_rate !== undefined) {
        const rate = merged.tax_rate || 0;
        const price = merged.price || 0;
        merged.tax_amount = Math.round(price * (rate / 100) * 100) / 100;
      }

      // Recompute unit price
      const qty = Math.max(1, merged.quantity || 1);
      const totalLine = (merged.price || 0) + (merged.tax_amount || 0);
      merged.unit_price = Math.round((totalLine / qty) * 100) / 100;

      return merged;
    });
    updateItems(next);
  };

  // STEPPER: Item Quantity [+] and [-] without keyboard
  const handleItemQuantityChange = (index: number, delta: number) => {
    if (isReadOnly) return;
    const item = items[index];
    if (!item) return;
    const currentQty = Math.max(1, Number(item.quantity) || 1);
    const newQty = Math.max(1, currentQty + delta);
    if (newQty === currentQty) return;

    handleUpdateItem(index, { quantity: newQty });
  };

  // STEPPER: User Assigned Units [+] and [-] without keyboard
  const handleUserUnitsChange = (index: number, userId: string, delta: number) => {
    if (isReadOnly) return;
    const item = items[index];
    if (!item) return;

    const totalQty = Math.max(1, Number(item.quantity) || 1);
    const currentShares = { ...(item.assignedShares || {}) };
    const currentUnit = currentShares[userId] || 0;
    const nextUnit = Math.max(0, currentUnit + delta);

    // Sum currently assigned to other users
    let otherSum = 0;
    for (const [uid, count] of Object.entries(currentShares)) {
      if (uid !== userId) otherSum += count;
    }

    // Cap at remaining units available
    const allowed = Math.min(nextUnit, totalQty - otherSum);

    if (allowed <= 0) {
      delete currentShares[userId];
    } else {
      currentShares[userId] = allowed;
    }

    const assignedUserIds = Object.keys(currentShares).filter((uid) => currentShares[uid] > 0);
    handleUpdateItem(index, { assignedShares: currentShares, assignedUserIds });
  };

  // ONE-TAP: "Asignar Resto" button for a member
  const handleAssignRemainingToUser = (index: number, userId: string) => {
    if (isReadOnly) return;
    const item = items[index];
    if (!item) return;

    const totalQty = Math.max(1, Number(item.quantity) || 1);
    const currentShares = { ...(item.assignedShares || {}) };

    let assignedSum = 0;
    for (const count of Object.values(currentShares)) {
      assignedSum += count;
    }

    const remaining = Math.max(0, totalQty - assignedSum);
    if (remaining <= 0) return;

    currentShares[userId] = (currentShares[userId] || 0) + remaining;
    const assignedUserIds = Object.keys(currentShares).filter((uid) => currentShares[uid] > 0);
    handleUpdateItem(index, { assignedShares: currentShares, assignedUserIds });
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
              <span>{t('expenses.itemsTableTitle') || 'Desglose de productos y tasas'}</span>
              <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('expenses.splitItemsSubtitle') || 'Asigna con los pulsadores (+) y (-) cuántas unidades tomó cada uno. Todo debe quedar repartido.'}
            </p>
          </div>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 hover:bg-emerald-200/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
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
            const qty = Math.max(1, Number(item.quantity) || 1);
            const shares = item.assignedShares || {};
            
            // Calculate assigned units
            let assignedUnits = 0;
            for (const count of Object.values(shares)) {
              assignedUnits += Number(count) || 0;
            }

            // Fallback: if no shares but assignedUserIds has length
            if (assignedUnits === 0 && (item.assignedUserIds || []).length > 0) {
              assignedUnits = item.assignedUserIds.length;
            }

            const remainingUnits = Math.max(0, qty - assignedUnits);
            const isFullyAssigned = assignedUnits === qty;
            const isOverAssigned = assignedUnits > qty;

            const netPrice = Math.max(0, Number(item.price) || 0);
            const taxRate = Math.max(0, Number(item.tax_rate) || 0);
            const taxAmount = Math.max(0, Number(item.tax_amount) || Math.round(netPrice * (taxRate / 100) * 100) / 100);
            const lineTotal = Math.round((netPrice + taxAmount) * 100) / 100;
            const unitPriceWithTax = Math.round((lineTotal / qty) * 100) / 100;

            return (
              <div
                key={item.id || idx}
                className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-3 transition-all hover:border-emerald-500/30"
              >
                {/* Row 1: Description, Quantity Stepper, Price & Delete */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Product Description */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={item.description}
                      onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                      placeholder={t('expenses.productDescPlaceholder') || 'Ej: Cerveza, Pizza, Ensalada...'}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    {item.description_original && item.description_original.trim() !== item.description.trim() && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider shrink-0">
                          🌐 {t('expenses.originalDescription') || 'Original'}:
                        </span>
                        <span className="truncate italic" title={item.description_original}>
                          {item.description_original}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Quantity Stepper + Net Price + Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {/* Quantity Stepper (100% Táctil sin teclado) */}
                    <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        disabled={isReadOnly || qty <= 1}
                        onClick={() => handleItemQuantityChange(idx, -1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all cursor-pointer"
                        title="Disminuir cantidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <div className="px-2 text-xs font-black tabular-nums text-slate-900 dark:text-white min-w-[34px] text-center">
                        {qty} <span className="text-[10px] font-semibold text-slate-400">ud.</span>
                      </div>

                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => handleItemQuantityChange(idx, 1)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                        title="Aumentar cantidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Net Price Input */}
                    <div className="w-28 relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={isReadOnly}
                        value={
                          typeof item.price === 'number' && item.price > 0
                            ? String(item.price).replace('.', ',')
                            : item.price === 0
                            ? ''
                            : String(item.price)
                        }
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
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0 cursor-pointer"
                        title={t('common.delete') || 'Eliminar'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Tax Breakdown Bar & Tax Rate Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                  {/* Tax Rate Preset Chips (One-touch) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {activeTaxLabel}:
                    </span>
                    {presetTaxRates.map((r) => {
                      const isSelected = taxRate === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleUpdateItem(idx, { tax_rate: r })}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {r}%
                        </button>
                      );
                    })}
                  </div>

                  {/* Calculated Breakdown Pill: Base + Tax = Total */}
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100/80 dark:bg-slate-800/60 px-2 py-0.8 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    <span>Base: <strong className="text-slate-900 dark:text-white tabular-nums">{formatMoney(netPrice, currency)}</strong></span>
                    <span className="text-slate-400">+</span>
                    <span>{activeTaxLabel} ({taxRate}%): <strong className="text-slate-900 dark:text-white tabular-nums">{formatMoney(taxAmount, currency)}</strong></span>
                    <span className="text-slate-400">=</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      Total: {formatMoney(lineTotal, currency)}
                    </span>
                    {qty > 1 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        ({formatMoney(unitPriceWithTax, currency)}/ud.)
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Member Units Assignment (100% Táctil sin teclado) */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                      {t('expenses.assignedTo') || 'Reparto por persona'}:
                    </span>

                    {/* Distribution Status Badge */}
                    <div>
                      {isFullyAssigned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Todas asignadas ({assignedUnits}/{qty})</span>
                        </span>
                      )}
                      {!isFullyAssigned && remainingUnits > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Quedan {remainingUnits} por asignar ({assignedUnits}/{qty})</span>
                        </span>
                      )}
                      {isOverAssigned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Exceso: {assignedUnits - qty} de más</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Member interactive stepper chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {members.map((m) => {
                      const userUnits = shares[m.user_id] || 0;
                      const hasAssigned = userUnits > 0;
                      const name = m.profile?.full_name || m.profile?.email?.split('@')[0] || 'U';
                      const userShareCost = qty > 0 ? Math.round(((userUnits / qty) * lineTotal) * 100) / 100 : 0;

                      return (
                        <div
                          key={m.user_id}
                          className={`inline-flex items-center gap-1.5 p-1 pl-1.5 rounded-xl text-xs transition-all border ${
                            hasAssigned
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-2xs'
                              : 'bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200/70 dark:border-slate-700/70'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              if (!hasAssigned && remainingUnits > 0) {
                                handleUserUnitsChange(idx, m.user_id, 1);
                              } else if (!hasAssigned && remainingUnits === 0 && qty === 1) {
                                // If 1 total qty, toggle to this user
                                handleUpdateItem(idx, { assignedShares: { [m.user_id]: 1 }, assignedUserIds: [m.user_id] });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Avatar profile={m.profile} size="sm" className="w-4 h-4 text-[9px]" />
                            <span className="font-semibold truncate max-w-[85px]">{name}</span>
                          </button>

                          {/* Stepper controls inside the chip */}
                          {hasAssigned ? (
                            <div className="inline-flex items-center gap-1 ml-0.5">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => handleUserUnitsChange(idx, m.user_id, -1)}
                                className="w-4.5 h-4.5 rounded flex items-center justify-center bg-white dark:bg-slate-800 text-slate-600 hover:text-rose-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs transition-all cursor-pointer"
                                title="Restar 1 unidad"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>

                              <span className="font-black text-xs tabular-nums text-emerald-700 dark:text-emerald-300 px-0.5">
                                {userUnits}
                              </span>

                              <button
                                type="button"
                                disabled={isReadOnly || remainingUnits <= 0}
                                onClick={() => handleUserUnitsChange(idx, m.user_id, 1)}
                                className="w-4.5 h-4.5 rounded flex items-center justify-center bg-white dark:bg-slate-800 text-slate-600 hover:text-emerald-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 shadow-2xs transition-all cursor-pointer"
                                title="Sumar 1 unidad"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>

                              <span className="text-[10px] font-bold text-slate-400 tabular-nums ml-0.5">
                                ({formatMoney(userShareCost, currency)})
                              </span>
                            </div>
                          ) : (
                            // When not assigned yet, show tap to add 1 unit or assign remainder
                            <button
                              type="button"
                              disabled={isReadOnly || remainingUnits <= 0}
                              onClick={() => handleUserUnitsChange(idx, m.user_id, 1)}
                              className="px-1 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Asignar 1 unidad a este amigo"
                            >
                              +1
                            </button>
                          )}

                          {/* ONE-TAP: "Asignar resto" button if units remain */}
                          {!isReadOnly && remainingUnits > 0 && (
                            <button
                              type="button"
                              onClick={() => handleAssignRemainingToUser(idx, m.user_id)}
                              className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer shrink-0"
                              title={`Asignar todas las ${remainingUnits} unidades restantes a ${name}`}
                            >
                              +{remainingUnits} resto
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Balancing & Tax Reconciliation Card */}
      <div
        className={`p-4 rounded-xl border-2 transition-all shadow-xs ${
          calc.isBalanced
            ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600/70 text-emerald-950 dark:text-emerald-100'
            : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600/70 text-amber-950 dark:text-amber-100'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                calc.isBalanced ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {calc.isBalanced ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span>
                  {calc.isBalanced
                    ? t('expenses.ticketBalanced') || '¡Factura e impuestos cuadrados al 100%!'
                    : calc.hasUnassignedItems
                    ? 'Hay productos con unidades sin repartir'
                    : t('expenses.ticketUnbalancedTitle') || 'Descuadre en los productos'}
                </span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    calc.isBalanced
                      ? 'bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100'
                      : 'bg-amber-200/60 dark:bg-amber-800/60 text-amber-900 dark:text-amber-100'
                  }`}
                >
                  {calc.difference === 0
                    ? '0,00 ' + currency
                    : `${calc.difference > 0 ? '+' : '-'}${formatMoney(Math.abs(calc.difference), currency)}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                {calc.isBalanced
                  ? 'Todos los productos y sus impuestos están completamente distribuidos y coinciden con el total.'
                  : calc.errorMessage ||
                    'Ajusta las cantidades y productos para que el 100% quede asignado y coincida con el total de la factura.'}
              </p>
            </div>
          </div>

          {/* Totals Summary: Base + Taxes = Total */}
          <div className="text-right shrink-0 self-end sm:self-auto space-y-0.5">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              Base: {formatMoney(calc.itemsNetTotal, currency)} + {activeTaxLabel}: {formatMoney(calc.itemsTaxTotal, currency)}
            </div>
            <div className="text-xs sm:text-sm font-black tabular-nums">
              <span className={calc.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {formatMoney(calc.itemsTotal, currency)}
              </span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-slate-900 dark:text-white">
                {formatMoney(targetTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Live calculated share per participant breakdown */}
        {calc.results.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="text-[10px] uppercase font-black tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <span>{t('expenses.breakdownPreview') || 'Total a pagar por amigo (Base + Impuesto)'}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {calc.results.map((res) => {
                const name = getMemberName(res.userId);
                return (
                  <div
                    key={res.userId}
                    className="inline-flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-800 shadow-2xs"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{name}:</span>
                    <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatMoney(res.amountOwed, currency)}
                    </span>
                    {res.netOwed !== undefined && res.taxOwed !== undefined && res.taxOwed > 0 && (
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        (Base {formatMoney(res.netOwed, currency)} + {activeTaxLabel} {formatMoney(res.taxOwed, currency)})
                      </span>
                    )}
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
