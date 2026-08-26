'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LocationPicker } from '@/components/ui/LocationPicker';
import { CATEGORIES } from '@/lib/categories';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyByCode,
  formatMoney,
  parseEuropeanAmount,
  formatNumber,
} from '@/lib/currencies';
import { SplitType, ExpenseCategory, Expense } from '@/types/database';
import { calculateSplits } from '@/lib/algorithms/splitCalculations';
import { validateAndCompressImage, sanitizeText } from '@/lib/security/sanitize';

import {
  toDateTimeLocalValue,
  fromDateTimeLocalToISOWithTimezone,
  getCurrentDateTimeISOWithTimezone,
  getUserTimezoneLabel,
} from '@/lib/utils';
import {
  Receipt,
  Users,
  Check,
  Percent,
  Calculator,
  PieChart,
  Split,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CreditCard,
  Globe,
  MapPin,
  Clock,
} from 'lucide-react';

export interface ExpenseFormProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  expenseToEdit?: Expense | null;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  groupId,
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
}) => {
  const { getGroup, getGroupMembers, currentUser, addExpense, updateExpense } = usePachas();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);

  const baseCurrency = group?.base_currency || 'EUR';

  // Form State
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [exchangeRateStr, setExchangeRateStr] = useState('1,0000');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [expenseDateTime, setExpenseDateTime] = useState(() =>
    toDateTimeLocalValue(getCurrentDateTimeISOWithTimezone())
  );
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Geolocation state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  // Accordion collapsed states (both collapsed by default)
  const [isWhoPaidOpen, setIsWhoPaidOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);

  // Payers state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [singlePayerId, setSinglePayerId] = useState(currentUser?.id || '');
  const [customPayers, setCustomPayers] = useState<Record<string, string>>({
    ...(currentUser?.id ? { [currentUser.id]: '' } : {}),
  });

  // Participants & Split state
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [customSplits, setCustomSplits] = useState<
    Record<string, { exact?: number; percentage?: number; shares?: number }>
  >({});

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Default exchange rate calculator
  const getDefaultExchangeRate = (currCode: string): number => {
    const currObj = getCurrencyByCode(currCode);
    const baseObj = getCurrencyByCode(baseCurrency);
    return currObj.rateToEur / baseObj.rateToEur;
  };

  // Initialize or populate form when opening or changing expenseToEdit
  useEffect(() => {
    if (!isOpen) return;

    if (expenseToEdit) {
      setTitle(expenseToEdit.title);
      setAmountStr(expenseToEdit.amount.toFixed(2).replace('.', ','));
      setCurrency(expenseToEdit.currency);
      const rate = expenseToEdit.exchange_rate || getDefaultExchangeRate(expenseToEdit.currency);
      setExchangeRateStr(rate.toFixed(4).replace('.', ','));
      setCategory(expenseToEdit.category);
      setExpenseDateTime(toDateTimeLocalValue(expenseToEdit.expense_date));
      setNotes(expenseToEdit.notes || '');
      setReceiptUrl(expenseToEdit.receipt_url || null);
      setSplitType(expenseToEdit.split_type);

      // Populate location
      setLatitude(expenseToEdit.latitude || null);
      setLongitude(expenseToEdit.longitude || null);
      setLocationName(expenseToEdit.location_name || null);

      // Populate payers
      if (expenseToEdit.payers && expenseToEdit.payers.length > 1) {
        setIsMultiPayer(true);
        const map: Record<string, string> = {};
        expenseToEdit.payers.forEach((p) => {
          map[p.user_id] = p.amount_paid.toFixed(2).replace('.', ',');
        });
        setCustomPayers(map);
      } else if (expenseToEdit.payers && expenseToEdit.payers.length === 1) {
        setIsMultiPayer(false);
        setSinglePayerId(expenseToEdit.payers[0].user_id);
      } else {
        setIsMultiPayer(false);
        setSinglePayerId(expenseToEdit.created_by);
      }

      // Populate participants
      if (expenseToEdit.participants && expenseToEdit.participants.length > 0) {
        setSelectedParticipants(expenseToEdit.participants.map((p) => p.user_id));
        const customMap: Record<string, { exact?: number; percentage?: number; shares?: number }> = {};
        expenseToEdit.participants.forEach((p) => {
          customMap[p.user_id] = {
            exact: p.amount_owed,
            percentage: p.percentage || undefined,
            shares: p.shares || undefined,
          };
        });
        setCustomSplits(customMap);
      }
    } else {
      // New expense defaults
      const defaultUserId = currentUser?.id || members[0]?.user_id || '';
      setTitle('');
      setAmountStr('');
      setCurrency(baseCurrency);
      setExchangeRateStr('1,0000');
      setCategory('food');
      setExpenseDateTime(toDateTimeLocalValue(getCurrentDateTimeISOWithTimezone()));
      setNotes('');
      setReceiptUrl(null);
      setLatitude(null);
      setLongitude(null);
      setLocationName(null);
      setIsMultiPayer(false);
      setSinglePayerId(defaultUserId);
      setCustomPayers(defaultUserId ? { [defaultUserId]: '' } : {});
      setSelectedParticipants(members.map((m) => m.user_id));
      setSplitType('EQUAL');
      setCustomSplits({});
      setIsWhoPaidOpen(false);
      setIsSplitOpen(false);
    }
  }, [isOpen, expenseToEdit, members, currentUser?.id, baseCurrency]);


  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    const rate = getDefaultExchangeRate(newCurrency);
    setExchangeRateStr(rate.toFixed(4).replace('.', ','));
  };

  const totalAmount = parseEuropeanAmount(amountStr);
  const isForeign = currency !== baseCurrency;
  const currencyObj = getCurrencyByCode(currency);

  // Exchange rate applied
  const exchangeRate = parseEuropeanAmount(exchangeRateStr) || getDefaultExchangeRate(currency) || 1.0;
  const convertedTotal = isForeign
    ? Math.round((totalAmount / exchangeRate) * 100) / 100
    : totalAmount;

  // Selected single payer object
  const currentSinglePayer = members.find((m) => m.user_id === singlePayerId)?.profile || currentUser;

  // Toggle single participant
  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length === 1) return; // Must keep at least one
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  // Select all participants
  const selectAllParticipants = () => {
    setSelectedParticipants(members.map((m) => m.user_id));
  };

  // Handle Photo Receipt upload securely
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await validateAndCompressImage(file, 800, 0.8);
        setReceiptUrl(compressed);
      } catch (err: any) {
        alert(err.message || 'Error al procesar el ticket');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Introduce el concepto o título del gasto');
      return;
    }
    if (totalAmount <= 0) {
      setErrorMessage('Introduce un importe válido mayor que 0 (ej: 25,50)');
      return;
    }
    if (selectedParticipants.length === 0) {
      setErrorMessage('Selecciona al menos un amigo para compartir el gasto');
      return;
    }

    // Prepare Payers
    let payersList: { userId: string; amountPaid: number }[] = [];
    if (isMultiPayer) {
      let sumPaid = 0;
      for (const [uid, val] of Object.entries(customPayers)) {
        const amt = parseEuropeanAmount(val);
        if (amt > 0) {
          payersList.push({ userId: uid, amountPaid: amt });
          sumPaid += amt;
        }
      }
      const diff = Math.round((totalAmount - sumPaid) * 100) / 100;
      if (Math.abs(diff) > 0.02) {
        setErrorMessage(
          `La suma pagada (${formatMoney(sumPaid, currency)}) no coincide con el total (${formatMoney(totalAmount, currency)})`
        );
        return;
      }
    } else {
      payersList = [{ userId: singlePayerId, amountPaid: totalAmount }];
    }

    // Validate Splits in the transaction currency
    const splitValidation = calculateSplits(
      totalAmount,
      splitType,
      selectedParticipants,
      customSplits,
      currency
    );

    if (!splitValidation.isValid) {
      setErrorMessage(splitValidation.errorMessage || 'Error en el reparto');
      return;
    }

    try {
      setIsLoading(true);
      const finalIsoDate = fromDateTimeLocalToISOWithTimezone(expenseDateTime);

      if (expenseToEdit) {
        await updateExpense(groupId, expenseToEdit.id, {
          groupId,
          title: sanitizeText(title, 120),
          amount: totalAmount,
          currency,
          exchangeRate,
          category,
          expenseDate: finalIsoDate,
          receiptUrl,
          latitude,
          longitude,
          locationName: sanitizeText(locationName, 150) || null,
          notes: sanitizeText(notes, 500) || undefined,
          splitType,
          payers: payersList,
          selectedParticipantIds: selectedParticipants,
          splitCustomInputs: customSplits,
        });
      } else {
        await addExpense({
          groupId,
          title: sanitizeText(title, 120),
          amount: totalAmount,
          currency,
          exchangeRate,
          category,
          expenseDate: finalIsoDate,
          receiptUrl,
          latitude,
          longitude,
          locationName: sanitizeText(locationName, 150) || null,
          notes: sanitizeText(notes, 500) || undefined,
          splitType,
          payers: payersList,
          selectedParticipantIds: selectedParticipants,
          splitCustomInputs: customSplits,
        });
      }

      // Reset and close
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el gasto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}
      description={`Grupo: ${group?.name || ''}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* LÍNEA 1: Concepto del Gasto */}
        <div>
          <Input
            label="Concepto del Gasto *"
            placeholder="Ej: Cena restaurante, Alquiler furgoneta, Supermercado..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="text-base py-3"
          />
        </div>

        {/* LÍNEA 2: Importe y Divisa */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            Importe y Divisa *
          </label>
          <div className="flex rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <div className="flex items-center pl-4 pr-1 text-slate-400 font-extrabold text-2xl select-none">
              {currencyObj.symbol}
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full px-2 py-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white bg-transparent focus:outline-none placeholder:text-slate-300"
              required
            />
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 px-3.5 border-l border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PANEL MULTIDIVISA DETALLADO */}
        {isForeign && (
          <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Conversión de Divisa ({currency} ➔ {baseCurrency})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Moneda del viaje: {baseCurrency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Valor Original ({currency})
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-0.5">
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Tipo de Cambio
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-500 font-semibold">1 {baseCurrency} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exchangeRateStr}
                    onChange={(e) => setExchangeRateStr(e.target.value)}
                    className="w-20 text-xs font-bold px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                  />
                  <span className="text-xs text-slate-500 font-semibold">{currency}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-500/30 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                  En Moneda del Viaje
                </span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  {formatMoney(convertedTotal, baseCurrency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* GEOLOCALIZACIÓN Y MAPA DE GOOGLE */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            Ubicación del Gasto (Google Maps)
          </label>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            locationName={locationName}
            onChange={({ latitude, longitude, locationName }) => {
              setLatitude(latitude);
              setLongitude(longitude);
              setLocationName(locationName);
            }}
            isEditing={!!expenseToEdit}
          />
        </div>

        {/* Categoría del gasto */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Categoría
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.values(CATEGORIES).map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-emerald-500 shadow-sm scale-105`
                      : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span
                    className={`text-[11px] font-medium leading-tight line-clamp-1 ${
                      isSelected ? cat.textColor : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 1: ¿Quién pagó el gasto? (COLAPSADA POR DEFECTO) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsWhoPaidOpen(!isWhoPaidOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  ¿Quién pagó el gasto?
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {!isMultiPayer ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar profile={currentSinglePayer} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {currentUser && singlePayerId === currentUser.id
                          ? `Tú (${currentUser.full_name?.split(' ')[0] || ''})`
                          : currentSinglePayer?.full_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Varios amigos pagaron a medias
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                {isWhoPaidOpen ? 'Cerrar' : 'Cambiar pagador'}
              </span>
              {isWhoPaidOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isWhoPaidOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 space-y-3 mt-3">
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-slate-500">Selecciona quién realizó el pago:</span>
                <button
                  type="button"
                  onClick={() => setIsMultiPayer(!isMultiPayer)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  {isMultiPayer ? 'Volver a un solo pagador' : 'Varios amigos pagaron'}
                </button>
              </div>

              {!isMultiPayer ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {members.map((m) => {
                    const isSelected = singlePayerId === m.user_id;
                    const isMe = currentUser && m.user_id === currentUser.id;
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => {
                          setSinglePayerId(m.user_id);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <Avatar profile={m.profile} size="sm" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {isMe ? 'Tú' : m.profile?.full_name?.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Indica cuánto pagó cada amigo (Total: {formatMoney(totalAmount, currency)}):
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {members.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar profile={m.profile} size="sm" />
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {m.profile?.full_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 w-28">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={customPayers[m.user_id] || ''}
                            onChange={(e) =>
                              setCustomPayers({
                                ...customPayers,
                                [m.user_id]: e.target.value,
                              })
                            }
                            className="w-full text-right text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent"
                          />
                          <span className="text-xs text-slate-500">{currencyObj.symbol}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: ¿Con quién se comparte? (COLAPSADA POR DEFECTO) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setIsSplitOpen(!isSplitOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  ¿Con quién se comparte?
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {selectedParticipants.length === members.length
                    ? `Todos los amigos (${members.length}) • `
                    : `${selectedParticipants.length} de ${members.length} amigos • `}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {splitType === 'EQUAL'
                      ? 'A partes iguales'
                      : splitType === 'EXACT'
                      ? 'Importes exactos'
                      : splitType === 'PERCENTAGE'
                      ? 'Porcentajes'
                      : 'Raciones'}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                {isSplitOpen ? 'Cerrar' : 'Personalizar reparto'}
              </span>
              {isSplitOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isSplitOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 space-y-4 mt-3">
              <div className="flex items-center justify-between pt-3">
                <span className="text-xs text-slate-500">
                  Elige los amigos que participan en este gasto:
                </span>
                <button
                  type="button"
                  onClick={selectAllParticipants}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  Seleccionar todos
                </button>
              </div>

              {/* Participants Chips */}
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isSelected = selectedParticipants.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => toggleParticipant(m.user_id)}
                      className={`px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <Avatar profile={m.profile} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-xs font-medium">
                        {currentUser && m.user_id === currentUser.id ? 'Tú' : m.profile?.full_name?.split(' ')[0]}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}

                    </button>
                  );
                })}
              </div>

              {/* Split Mode Selector Tabs */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  Modo de reparto
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSplitType('EQUAL')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'EQUAL'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    Igual
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('EXACT')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'EXACT'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Exacto (€)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('PERCENTAGE')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'PERCENTAGE'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    % Porc.
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('SHARES')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'SHARES'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    Raciones
                  </button>
                </div>

                {/* Custom Split Inputs per Participant (if not EQUAL) */}
                {splitType !== 'EQUAL' && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                    {selectedParticipants.map((userId) => {
                      const m = members.find((mem) => mem.user_id === userId);
                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar profile={m?.profile} size="sm" />
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {m?.profile?.full_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={
                                splitType === 'EXACT'
                                  ? '0,00'
                                  : splitType === 'PERCENTAGE'
                                  ? '50'
                                  : '1'
                              }
                              value={
                                splitType === 'EXACT'
                                  ? customSplits[userId]?.exact !== undefined
                                    ? String(customSplits[userId]?.exact).replace('.', ',')
                                    : ''
                                  : splitType === 'PERCENTAGE'
                                  ? customSplits[userId]?.percentage !== undefined
                                    ? String(customSplits[userId]?.percentage).replace('.', ',')
                                    : ''
                                  : customSplits[userId]?.shares !== undefined
                                  ? String(customSplits[userId]?.shares)
                                  : ''
                              }
                              onChange={(e) => {
                                const val = parseEuropeanAmount(e.target.value);
                                setCustomSplits({
                                  ...customSplits,
                                  [userId]: {
                                    ...customSplits[userId],
                                    ...(splitType === 'EXACT' ? { exact: val } : {}),
                                    ...(splitType === 'PERCENTAGE' ? { percentage: val } : {}),
                                    ...(splitType === 'SHARES' ? { shares: val } : {}),
                                  },
                                });
                              }}
                              className="w-full text-right text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent"
                            />
                            <span className="text-xs text-slate-500 font-semibold">
                              {splitType === 'EXACT' ? '€' : splitType === 'PERCENTAGE' ? '%' : 'partes'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fecha y Hora del gasto y Foto de Ticket */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* DateTime Picker with Timezone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Fecha y Hora
              </label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate max-w-[130px]" title={getUserTimezoneLabel()}>
                {getUserTimezoneLabel()}
              </span>
            </div>
            <div className="relative">
              <input
                type="datetime-local"
                value={expenseDateTime}
                onChange={(e) => setExpenseDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          </div>

          {/* Receipt Photo Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Foto de Ticket / Recibo
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>{receiptUrl ? 'Foto añadida ✓' : 'Subir foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => setReceiptUrl(null)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="brand" isLoading={isLoading} className="flex-1 text-sm font-bold">
            {expenseToEdit ? 'Guardar Cambios' : `Guardar Gasto (${formatMoney(totalAmount, currency)})`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
