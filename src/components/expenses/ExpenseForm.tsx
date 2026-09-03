'use client';

import React, { useState, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
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
import { getHistoricalExchangeRate, ExchangeRateResult } from '@/lib/currencies/exchangeRateService';

import {
  formatDate,
  toDateTimeLocalValue,
  fromDateTimeLocalToISOWithTimezone,
  getCurrentDateTimeISOWithTimezone,
  getUserTimezoneLabel,
  formatLocaleDate,
  hasSpecificTime,
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
  Calendar,
  Trash2,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Sparkles,
  Eye,
  ScanLine,
  Camera,
  Plus,
} from 'lucide-react';
import { ReportContentModal } from '@/components/safety/ReportContentModal';
import { ReceiptModal } from '@/components/expenses/ReceiptModal';
import { ExpenseCommentsSection } from '@/components/expenses/ExpenseCommentsSection';
import { ReceiptRedactionModal } from '@/components/expenses/ReceiptRedactionModal';
import { scanReceipt, ScannedReceiptData } from '@/lib/ocr/receiptScanner';

// Helper to parse date string into { dateStr: "DD/MM/YYYY", timeStr: "HH:mm", isoDate: "YYYY-MM-DD" }
function splitEuropeanDateTime(rawIsoOrDate?: string | null): { dateStr: string; timeStr: string; isoDate: string } {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  const defaultDateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const defaultTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const defaultIsoDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if (!rawIsoOrDate) {
    return { dateStr: defaultDateStr, timeStr: defaultTimeStr, isoDate: defaultIsoDate };
  }

  const str = String(rawIsoOrDate).trim();

  // Match ISO YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2];
    const d = isoMatch[3];
    const h = isoMatch[4] || (hasSpecificTime(str) ? '12' : pad(now.getHours()));
    const min = isoMatch[5] || (hasSpecificTime(str) ? '00' : pad(now.getMinutes()));
    return {
      dateStr: `${d}/${m}/${y}`,
      timeStr: `${h}:${min}`,
      isoDate: `${y}-${m}-${d}`,
    };
  }

  // Match European DD/MM/YYYY HH:mm or DD/MM/YYYY
  const euMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:[T\s](\d{2}):(\d{2}))?/);
  if (euMatch) {
    const d = euMatch[1].padStart(2, '0');
    const m = euMatch[2].padStart(2, '0');
    let y = euMatch[3];
    if (y.length === 2) y = `20${y}`;
    const h = euMatch[4] || pad(now.getHours());
    const min = euMatch[5] || pad(now.getMinutes());
    return {
      dateStr: `${d}/${m}/${y}`,
      timeStr: `${h}:${min}`,
      isoDate: `${y}-${m}-${d}`,
    };
  }

  return { dateStr: defaultDateStr, timeStr: defaultTimeStr, isoDate: defaultIsoDate };
}

// Convert DD/MM/YYYY + HH:mm into ISO string with timezone
function combineEuropeanDateTimeToISO(dateStr: string, timeStr: string): string {
  const parts = (dateStr || '').trim().split(/[\/\.-]/);
  let d = 1, m = 1, y = new Date().getFullYear();
  if (parts.length >= 3) {
    d = parseInt(parts[0], 10) || 1;
    m = parseInt(parts[1], 10) || 1;
    y = parseInt(parts[2], 10) || y;
    if (y < 100) y += 2000;
  }
  const timeParts = (timeStr || '').trim().split(':');
  const h = timeParts[0] ? parseInt(timeParts[0], 10) : 12;
  const min = timeParts[1] ? parseInt(timeParts[1], 10) : 0;

  const dateObj = new Date(y, m - 1, d, h, min, 0);
  return getCurrentDateTimeISOWithTimezone(dateObj);
}

export interface ExpenseFormProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  expenseToEdit?: Expense | null;
  isReadOnly?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  groupId,
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
  isReadOnly: explicitReadOnly,
}) => {
  const {
    getGroup,
    getGroupMembers,
    currentUser,
    addExpense,
    scanAndCreateExpenseAsync,
    updateExpense,
    deleteExpense,
    queueReceiptScan,
    addNotification,
  } = usePachas();
  const { t, language } = useTranslation();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);

  const baseCurrency = group?.base_currency || 'EUR';

  // Permission calculation: Only the creator of the expense can edit or delete it
  const isCreator = currentUser && expenseToEdit ? expenseToEdit.created_by === currentUser.id : true;
  const isReadOnly =
    explicitReadOnly !== undefined
      ? explicitReadOnly
      : expenseToEdit
      ? !isCreator
      : false;

  const creatorProfile = expenseToEdit
    ? members.find((m) => m.user_id === expenseToEdit.created_by)?.profile || expenseToEdit.creator
    : null;

  // Form State
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [exchangeRateStr, setExchangeRateStr] = useState('1,0000');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [dateDisplayStr, setDateDisplayStr] = useState(() => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  });
  const [timeDisplayStr, setTimeDisplayStr] = useState(() => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const [expenseDateTime, setExpenseDateTime] = useState(() =>
    toDateTimeLocalValue(getCurrentDateTimeISOWithTimezone())
  );
  const datePickerRef = React.useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [isScanPanelOpen, setIsScanPanelOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [rateSourceInfo, setRateSourceInfo] = useState<{
    source: string;
    date: string;
    rate: number;
  } | null>(null);

  // Geolocation state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  // Accordion collapsed states (both collapsed by default, expanded in read-only mode)
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
  const [customSplitInputs, setCustomSplitInputs] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDeleteExpense = async () => {
    if (!expenseToEdit) return;
    if (confirm(`¿Estás seguro de que deseas eliminar definitivamente el gasto "${expenseToEdit.title}"?`)) {
      try {
        setIsDeleting(true);
        await deleteExpense(groupId, expenseToEdit.id);
        onClose();
        if (onSuccess) onSuccess();
      } catch (err: any) {
        setErrorMessage(err.message || 'Error al eliminar el gasto');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Default exchange rate calculator (value of 1 unit of foreign currency in baseCurrency)
  const getDefaultExchangeRate = (currCode: string): number => {
    const fromObj = getCurrencyByCode(currCode);
    const toObj = getCurrencyByCode(baseCurrency);
    return fromObj.rateToEur > 0 && toObj.rateToEur > 0
      ? toObj.rateToEur / fromObj.rateToEur
      : 1.0;
  };


  // Fetch official rate from European Central Bank (Frankfurter) or fallback
  const fetchOfficialRate = async (currCode: string, dateVal: string) => {
    if (currCode.toUpperCase() === baseCurrency.toUpperCase()) {
      setExchangeRateStr('1,0000');
      setRateSourceInfo(null);
      return;
    }

    try {
      setIsFetchingRate(true);
      const res = await getHistoricalExchangeRate(currCode, baseCurrency, dateVal);
      setExchangeRateStr(res.rate.toFixed(4).replace('.', ','));
      setRateSourceInfo({
        source: res.provider,
        date: res.date,
        rate: res.rate,
      });
    } catch {
      const fallback = getDefaultExchangeRate(currCode);
      setExchangeRateStr(fallback.toFixed(4).replace('.', ','));
    } finally {
      setIsFetchingRate(false);
    }
  };

  // Initialize or populate form when opening or changing expenseToEdit
  useEffect(() => {
    if (!isOpen) return;

    if (expenseToEdit) {
      const numAmount = Number(expenseToEdit.amount) || 0;
      const expCurrency = expenseToEdit.currency || baseCurrency;
      const targetDateIso = expenseToEdit.expense_date || getCurrentDateTimeISOWithTimezone();

      setTitle(expenseToEdit.title || '');
      setAmountStr(numAmount.toFixed(2).replace('.', ','));
      setCurrency(expCurrency);
      const rawRate = Number(expenseToEdit.exchange_rate);
      const rate =
        rawRate && !isNaN(rawRate) && rawRate > 0
          ? rawRate
          : getDefaultExchangeRate(expCurrency);
      setExchangeRateStr(rate.toFixed(4).replace('.', ','));
      setCategory(expenseToEdit.category || 'food');
      const dt = splitEuropeanDateTime(targetDateIso);
      setDateDisplayStr(dt.dateStr);
      setTimeDisplayStr(dt.timeStr);
      setExpenseDateTime(toDateTimeLocalValue(targetDateIso));
      setNotes(expenseToEdit.notes || '');
      setReceiptUrl(expenseToEdit.receipt_url || null);
      setSplitType(expenseToEdit.split_type || 'EQUAL');

      // Fetch official rate directly using expense's user-specified date
      if (expCurrency !== baseCurrency && !isReadOnly) {
        fetchOfficialRate(expCurrency, targetDateIso);
      } else {
        setRateSourceInfo(null);
      }

      // Auto expand accordions in read-only mode to see all details immediately
      if (isReadOnly) {
        setIsWhoPaidOpen(true);
        setIsSplitOpen(true);
      } else {
        setIsWhoPaidOpen(false);
        setIsSplitOpen(false);
      }

      // Populate location
      setLatitude(expenseToEdit.latitude !== null && expenseToEdit.latitude !== undefined ? Number(expenseToEdit.latitude) : null);
      setLongitude(expenseToEdit.longitude !== null && expenseToEdit.longitude !== undefined ? Number(expenseToEdit.longitude) : null);
      setLocationName(expenseToEdit.location_name || null);

      // Populate payers
      if (expenseToEdit.payers && expenseToEdit.payers.length > 1) {
        setIsMultiPayer(true);
        const map: Record<string, string> = {};
        expenseToEdit.payers.forEach((p) => {
          const amt = Number(p.amount_paid) || 0;
          map[p.user_id] = amt.toFixed(2).replace('.', ',');
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
        const stringInputs: Record<string, string> = {};
        expenseToEdit.participants.forEach((p) => {
          customMap[p.user_id] = {
            exact: p.amount_owed !== undefined && p.amount_owed !== null ? Number(p.amount_owed) : undefined,
            percentage: p.percentage !== undefined && p.percentage !== null ? Number(p.percentage) : undefined,
            shares: p.shares !== undefined && p.shares !== null ? Number(p.shares) : undefined,
          };
          if (expenseToEdit.split_type === 'EXACT' && p.amount_owed !== undefined && p.amount_owed !== null) {
            stringInputs[p.user_id] = String(p.amount_owed).replace('.', ',');
          } else if (expenseToEdit.split_type === 'PERCENTAGE' && p.percentage !== undefined && p.percentage !== null) {
            stringInputs[p.user_id] = String(p.percentage).replace('.', ',');
          } else if (expenseToEdit.split_type === 'SHARES' && p.shares !== undefined && p.shares !== null) {
            stringInputs[p.user_id] = String(p.shares);
          }
        });
        setCustomSplits(customMap);
        setCustomSplitInputs(stringInputs);
      }
    } else {

      // New expense defaults
      const defaultUserId = currentUser?.id || members[0]?.user_id || '';
      const nowIso = getCurrentDateTimeISOWithTimezone();
      const dt = splitEuropeanDateTime(nowIso);
      setTitle('');
      setAmountStr('');
      setCurrency(baseCurrency);
      setExchangeRateStr('1,0000');
      setCategory('food');
      setDateDisplayStr(dt.dateStr);
      setTimeDisplayStr(dt.timeStr);
      setExpenseDateTime(toDateTimeLocalValue(nowIso));
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
      setCustomSplitInputs({});
      setIsWhoPaidOpen(false);
      setIsSplitOpen(false);
      setRateSourceInfo(null);
    }
  }, [isOpen, expenseToEdit, members, currentUser?.id, baseCurrency, isReadOnly]);


  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (!isReadOnly) {
      fetchOfficialRate(newCurrency, expenseDateTime);
    }
  };

  const handleDateInputChange = (val: string) => {
    setDateDisplayStr(val);
    const combined = combineEuropeanDateTimeToISO(val, timeDisplayStr);
    setExpenseDateTime(toDateTimeLocalValue(combined));
    if (currency !== baseCurrency && !isReadOnly) {
      fetchOfficialRate(currency, combined);
    }
  };

  const handleNativeDateChange = (isoYmd: string) => {
    if (!isoYmd) return;
    const [y, m, d] = isoYmd.split('-');
    const newDateStr = `${d}/${m}/${y}`;
    setDateDisplayStr(newDateStr);
    const combined = combineEuropeanDateTimeToISO(newDateStr, timeDisplayStr);
    setExpenseDateTime(toDateTimeLocalValue(combined));
    if (currency !== baseCurrency && !isReadOnly) {
      fetchOfficialRate(currency, combined);
    }
  };

  const handleTimeInputChange = (val: string) => {
    setTimeDisplayStr(val);
    const combined = combineEuropeanDateTimeToISO(dateDisplayStr, val);
    setExpenseDateTime(toDateTimeLocalValue(combined));
  };

  const setTodayDate = () => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    handleDateInputChange(todayStr);
  };

  const setYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    const yesterdayStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    handleDateInputChange(yesterdayStr);
  };

  const setNowTime = () => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' : '') + n;
    const nowTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    handleTimeInputChange(nowTimeStr);
  };

  const handleDateTimeChange = (newDateTime: string) => {
    setExpenseDateTime(newDateTime);
    const dt = splitEuropeanDateTime(newDateTime);
    setDateDisplayStr(dt.dateStr);
    setTimeDisplayStr(dt.timeStr);
    if (!isReadOnly && currency !== baseCurrency) {
      fetchOfficialRate(currency, newDateTime);
    }
  };

  const totalAmount = parseEuropeanAmount(amountStr);
  const isForeign = currency !== baseCurrency;
  const currencyObj = getCurrencyByCode(currency);

  // Exchange rate applied (1 Foreign = X Base)
  const exchangeRate = parseEuropeanAmount(exchangeRateStr) || getDefaultExchangeRate(currency) || 1.0;
  const convertedTotal = isForeign
    ? Math.round((totalAmount * exchangeRate) * 100) / 100
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

  const handleAssignRemainder = (userId: string, remainder: number) => {
    if (isReadOnly) return;
    const roundedRemainder = Math.max(0, Math.round(remainder * 100) / 100);
    const formatted = roundedRemainder.toFixed(2).replace('.', ',');
    setCustomSplitInputs((prev) => ({
      ...prev,
      [userId]: formatted,
    }));
    setCustomSplits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        exact: roundedRemainder,
      },
    }));
  };

  const [preCensorImage, setPreCensorImage] = useState<string | null>(null);

  // Handle Photo Receipt upload securely and open pre-redaction canvas
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await validateAndCompressImage(file, 1200, 0.85);
        setPreCensorImage(compressed);
      } catch (err: any) {
        alert(err.message || 'Error al procesar el ticket');
      }
    }
  };

  const handleConfirmPreCensored = async (censoredDataUrl: string) => {
    setIsScanPanelOpen(false);
    setReceiptUrl(censoredDataUrl);
    setPreCensorImage(null);

    // Run OCR scan on censored image
    setIsScanningReceipt(true);
    try {
      const data = await scanReceipt(censoredDataUrl);
      if (data && (data.amount || data.title || data.date)) {
        setScannedData(data);
      }
    } catch (ocrErr) {
      console.warn('OCR scanning failed:', ocrErr);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleApplyScannedData = () => {
    if (!scannedData) return;
    if (scannedData.title && (!title.trim() || title === t('expenses.expenseTitle'))) {
      setTitle(scannedData.title);
    }
    if (scannedData.amountFormatted) {
      setAmountStr(scannedData.amountFormatted);
    }
    if (scannedData.category) {
      setCategory(scannedData.category);
    }
    if (scannedData.date) {
      const dt = splitEuropeanDateTime(scannedData.date);
      setDateDisplayStr(dt.dateStr);
      setTimeDisplayStr(dt.timeStr);
      setExpenseDateTime(toDateTimeLocalValue(scannedData.date));
    }
    if (scannedData.locationName) {
      setLocationName(scannedData.locationName);
    }
    if (
      scannedData.latitude !== undefined &&
      scannedData.latitude !== null &&
      scannedData.longitude !== undefined &&
      scannedData.longitude !== null
    ) {
      setLatitude(scannedData.latitude);
      setLongitude(scannedData.longitude);
    }
    setScannedData(null);
  };

  const handleSaveAsyncWithReceipt = async () => {
    if (!receiptUrl) return;
    try {
      setIsLoading(true);
      await queueReceiptScan(groupId, receiptUrl);
      if (currentUser) {
        addNotification({
          user_id: currentUser.id,
          type: 'receipt_pending',
          title: '⏳ Procesando factura con IA...',
          message: 'Analizando conceptos e importes en segundo plano. Te avisaremos en cuanto esté lista para validar.',
          group_id: groupId,
        });
      }
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el ticket en segundo plano');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      onClose();
      return;
    }
    if ((!title.trim() || totalAmount <= 0) && receiptUrl && !expenseToEdit) {
      await handleSaveAsyncWithReceipt();
      return;
    }
    if (!title.trim()) {
      setErrorMessage(t('expenses.expenseTitle'));
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

    // Filtramos los participantes que efectivamente participan:
    // En reparto EXACTO, si un amigo tiene 0 o vacío, no participa en el reparto.
    const activeParticipants = splitType === 'EXACT'
      ? selectedParticipants.filter((id) => (customSplits[id]?.exact || 0) > 0)
      : selectedParticipants;

    if (activeParticipants.length === 0) {
      setErrorMessage(
        splitType === 'EXACT'
          ? 'Debes asignar un importe mayor a 0 a al menos un participante'
          : 'Selecciona al menos un amigo para compartir el gasto'
      );
      return;
    }

    // Validate Splits in the transaction currency
    const splitValidation = calculateSplits(
      totalAmount,
      splitType,
      activeParticipants,
      customSplits,
      currency
    );

    if (!splitValidation.isValid) {
      setErrorMessage(splitValidation.errorMessage || 'Error en el reparto');
      return;
    }

    try {
      setIsLoading(true);
      const finalIsoDate = combineEuropeanDateTimeToISO(dateDisplayStr, timeDisplayStr);

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
          selectedParticipantIds: activeParticipants,
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
          selectedParticipantIds: activeParticipants,
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
      title={isReadOnly ? t('expenses.viewExpense') : expenseToEdit ? t('expenses.editExpense') : t('expenses.addExpense')}
      description={`${t('nav.groups')}: ${group?.name || ''}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Banner de Modo Sólo Lectura */}
        {isReadOnly && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center text-base shrink-0">
                👁️
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  {t('expenses.readOnlyBanner', { name: creatorProfile?.full_name || t('common.someone') })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Banner de Escaneo OCR en progreso */}
        {isScanningReceipt && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <ScanLine className="w-4 h-4 animate-spin text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                {t('ocr.scanningReceipt')}
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                {t('ocr.scanningReceiptSubtitle')}
              </p>
            </div>
          </div>
        )}

        {/* Banner de Datos detectados por OCR */}
        {scannedData && !isReadOnly && (scannedData.amount || scannedData.title || scannedData.date) && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 shadow-xs text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950 dark:text-emerald-100">
                    {t('ocr.detectedTitle')}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                    {scannedData.source?.includes('gemini') ? '✨ Gemini Flash' : 'IA OCR'}
                  </span>
                </div>
                <div className="text-emerald-800 dark:text-emerald-300 text-[11px] mt-0.5 flex flex-wrap gap-x-2">
                  {scannedData.amountFormatted && (
                    <span className="font-bold">💰 {scannedData.amountFormatted} {currency}</span>
                  )}
                  {scannedData.date && (
                    <span>🗓️ {formatDate(scannedData.date, scannedData.date.includes('T') ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy')}</span>
                  )}
                  {scannedData.title && (
                    <span className="truncate max-w-[180px]">📍 "{scannedData.title}"</span>
                  )}
                  {scannedData.locationName && (
                    <span className="truncate max-w-[200px]" title={scannedData.locationName}>
                      🗺️ {scannedData.locationName} {scannedData.latitude !== undefined && '📍 (Google Maps)'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                size="sm"
                variant="brand"
                onClick={handleApplyScannedData}
                className="text-xs font-bold px-3 py-1.5 shadow-xs shrink-0 w-full sm:w-auto"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {t('ocr.applyData')}
              </Button>
              <button
                type="button"
                onClick={() => setScannedData(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Acceso discreto para escanear/subir ticket con IA (secundario frente a la edición manual) */}
        {!isReadOnly && !receiptUrl && (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-2.5 sm:p-3 transition-all">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {t('expenses.scanTicketPrompt')}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block truncate">
                    {t('expenses.scanTicketDesc')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsScanPanelOpen(!isScanPanelOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-300 dark:border-emerald-700/80 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shrink-0 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-emerald-500" />
                <span>{isScanPanelOpen ? t('common.close') : t('expenses.scanOrUpload')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isScanPanelOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Panel de captura desplegable bajo demanda */}
            {isScanPanelOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-200">
                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs">
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('expenses.scanWithCamera')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors shadow-2xs">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{t('expenses.uploadFromGallery')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Banner de Ticket Adjunto en la parte superior (si ya se ha subido/capturado) */}
        {!isReadOnly && receiptUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">
                    {t('expenses.receiptAttached')}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {t('expenses.receiptAttachedDesc')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors shadow-2xs"
                  title={t('expenses.viewReceipt')}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('expenses.viewReceipt')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl(null);
                    setScannedData(null);
                  }}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title={t('expenses.removeReceipt')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!expenseToEdit && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 border border-teal-200 dark:border-teal-800/60 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-teal-900 dark:text-teal-200 font-medium truncate">
                    {t('expenses.saveAndProcessAsyncHint')}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveAsyncWithReceipt}
                  className="shrink-0 text-xs font-bold border-teal-400 dark:border-teal-700 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                >
                  {t('expenses.saveAndProcessAsync')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* LÍNEA 1: Concepto del Gasto */}
        <div>
          <Input
            label={`${t('expenses.expenseTitle')} *`}
            placeholder={t('expenses.expenseTitlePlaceholder')}
            value={title}
            onChange={(e) => !isReadOnly && setTitle(e.target.value)}
            required
            autoFocus={!isReadOnly}
            disabled={isReadOnly}
            className={`text-base py-3 ${isReadOnly ? 'bg-slate-50 dark:bg-slate-800/50 cursor-default' : ''}`}
          />
        </div>

        {/* LÍNEA 2: Importe y Divisa */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('expenses.amount')} *
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
              onChange={(e) => !isReadOnly && setAmountStr(e.target.value)}
              readOnly={isReadOnly}
              className={`w-full px-2 py-3 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white bg-transparent focus:outline-none placeholder:text-slate-300 ${
                isReadOnly ? 'cursor-default' : ''
              }`}
              required
            />
            <select
              value={currency}
              onChange={(e) => !isReadOnly && handleCurrencyChange(e.target.value)}
              disabled={isReadOnly}
              className={`bg-slate-100 dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 px-3.5 border-l border-slate-200 dark:border-slate-700 focus:outline-none ${
                isReadOnly ? 'cursor-default' : 'cursor-pointer'
              }`}
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
                  {t('expenses.currency')} ({currency} ➔ {baseCurrency})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {t('groups.baseCurrency')}: {baseCurrency}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {t('expenses.amount')} ({currency})
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white block mt-0.5">
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200/80 dark:border-amber-800/40 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {t('expenses.exchangeRate')}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-500 font-semibold">1 {currency} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={exchangeRateStr}
                    onChange={(e) => !isReadOnly && setExchangeRateStr(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-20 text-xs font-bold px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                  />
                  <span className="text-xs text-slate-500 font-semibold">{baseCurrency}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-500/30 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                  {t('groups.baseCurrency')}
                </span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  {formatMoney(convertedTotal, baseCurrency)}
                </span>
              </div>
            </div>

            {/* Official Rate Badge or Loading state */}
            {isFetchingRate ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />
                <span>{t('expenses.fetchingExchangeRate')}</span>
              </div>
            ) : rateSourceInfo ? (
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-800/40 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">
                    {t('expenses.officialRateApplied', {
                      source: rateSourceInfo.source,
                      date: formatLocaleDate(rateSourceInfo.date, language),
                      from: currency,
                      to: baseCurrency,
                      rate: rateSourceInfo.rate.toFixed(4),
                    })}
                  </span>
                </div>

                {parseEuropeanAmount(exchangeRateStr) !== rateSourceInfo.rate && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setExchangeRateStr(rateSourceInfo.rate.toFixed(4).replace('.', ','))}
                    className="text-[10px] font-bold text-amber-900 dark:text-amber-200 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    title={t('expenses.resetOfficialRate')}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('expenses.resetOfficialRate')}</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* BOTÓN RÁPIDO "GUARDAR GASTO" (Justo debajo de los datos de la cantidad) */}
        {!isReadOnly && (
          <div className="pt-0.5">
            <Button
              type="submit"
              variant="brand"
              isLoading={isLoading || isDeleting}
              className="w-full text-sm font-bold shadow-md shadow-emerald-600/15 py-2.5 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{expenseToEdit ? t('expenses.saveChanges') : t('expenses.quickSave', { amount: formatMoney(totalAmount, currency) })}</span>
            </Button>
          </div>
        )}

        {/* GEOLOCALIZACIÓN Y MAPA DE GOOGLE */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('expenses.location')}
          </label>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            locationName={locationName}
            onChange={({ latitude, longitude, locationName }) => {
              if (!isReadOnly) {
                setLatitude(latitude);
                setLongitude(longitude);
                setLocationName(locationName);
              }
            }}
            isEditing={!!expenseToEdit}
            disabled={isReadOnly}
          />
        </div>

        {/* Categoría del gasto */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            {t('expenses.category')}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.values(CATEGORIES).map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => !isReadOnly && setCategory(cat.id)}
                  disabled={isReadOnly}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-emerald-500 shadow-sm scale-105`
                      : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  } ${isReadOnly && !isSelected ? 'opacity-40' : ''}`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span
                    className={`text-[11px] font-medium leading-tight line-clamp-1 ${
                      isSelected ? cat.textColor : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t(`categories.${cat.id}` as any) || cat.label.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 1: ¿Quién pagó el gasto? */}
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
                  {t('expenses.whoPaid')}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {!isMultiPayer ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar profile={currentSinglePayer} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {currentUser && singlePayerId === currentUser.id
                          ? `${t('common.you')} (${currentUser.full_name?.split(' ')[0] || ''})`
                          : currentSinglePayer?.full_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {t('expenses.paidByMultiple')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                {isWhoPaidOpen ? t('common.close') : isReadOnly ? t('common.details') : t('common.edit')}
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
                <span className="text-xs text-slate-500">
                  {isReadOnly ? t('expenses.whoPaid') : t('expenses.whoPaid')}
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsMultiPayer(!isMultiPayer)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    {isMultiPayer ? t('expenses.singlePayer') : t('expenses.multiPayer')}
                  </button>
                )}
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
                          if (!isReadOnly) setSinglePayerId(m.user_id);
                        }}
                        disabled={isReadOnly}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        } ${isReadOnly && !isSelected ? 'opacity-40' : ''}`}
                      >
                        <Avatar profile={m.profile} size="sm" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {isMe ? t('common.you') : m.profile?.full_name?.split(' ')[0] || t('common.friend')}
                        </span>

                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    {t('expenses.splitSummary')} ({t('common.total')}: {formatMoney(totalAmount, currency)}):
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {members.map((m) => {
                      const val = customPayers[m.user_id] || '';
                      const amt = parseEuropeanAmount(val);
                      if (isReadOnly && amt <= 0) return null;

                      return (
                        <div
                          key={m.user_id}
                          className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar profile={m.profile} size="sm" />
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {m.profile?.full_name || expenseToEdit?.payers?.find((p) => p.user_id === m.user_id)?.profile?.full_name || t('common.friend')}
                            </span>

                          </div>
                          <div className="flex items-center gap-1 w-28">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={customPayers[m.user_id] || ''}
                              onChange={(e) =>
                                !isReadOnly &&
                                setCustomPayers({
                                  ...customPayers,
                                  [m.user_id]: e.target.value,
                                })
                              }
                              readOnly={isReadOnly}
                              className="w-full text-right text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent"
                            />
                            <span className="text-xs text-slate-500">{currencyObj.symbol}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: ¿Con quién se comparte? */}
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
                  {t('expenses.whoShares')}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {selectedParticipants.length === members.length
                    ? `${t('common.all')} (${members.length}) • `
                    : `${selectedParticipants.length} / ${members.length} • `}
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {splitType === 'EQUAL'
                      ? t('expenses.splitModes.equal')
                      : splitType === 'EXACT'
                      ? t('expenses.splitModes.exact')
                      : splitType === 'PERCENTAGE'
                      ? t('expenses.splitModes.percentage')
                      : t('expenses.splitModes.shares')}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hidden sm:inline">
                {isSplitOpen ? t('common.close') : isReadOnly ? t('common.details') : t('common.edit')}
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
                  {t('expenses.whoShares')}
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={selectAllParticipants}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    {t('common.all')}
                  </button>
                )}
              </div>

              {/* Participants Chips */}
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isSelected = selectedParticipants.includes(m.user_id);
                  if (isReadOnly && !isSelected) return null;

                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => !isReadOnly && toggleParticipant(m.user_id)}
                      disabled={isReadOnly}
                      className={`px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <Avatar profile={m.profile} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-xs font-medium">
                        {currentUser && m.user_id === currentUser.id ? t('common.you') : m.profile?.full_name?.split(' ')[0] || t('common.friend')}
                      </span>

                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Split Mode Selector Tabs */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                  {t('expenses.splitModes.equal')}
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isReadOnly) {
                        setSplitType('EQUAL');
                        setCustomSplitInputs({});
                      }
                    }}
                    disabled={isReadOnly}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'EQUAL'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5" />
                    {t('expenses.splitModes.equal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isReadOnly) {
                        setSplitType('EXACT');
                        setCustomSplitInputs({});
                      }
                    }}
                    disabled={isReadOnly}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'EXACT'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    {t('expenses.splitModes.exact')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isReadOnly) {
                        setSplitType('PERCENTAGE');
                        setCustomSplitInputs({});
                      }
                    }}
                    disabled={isReadOnly}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'PERCENTAGE'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    {t('expenses.splitModes.percentage')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isReadOnly) {
                        setSplitType('SHARES');
                        setCustomSplitInputs({});
                      }
                    }}
                    disabled={isReadOnly}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      splitType === 'SHARES'
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    {t('expenses.splitModes.shares')}
                  </button>
                </div>

                {/* Custom Split Inputs per Participant (if not EQUAL) */}
                {splitType !== 'EQUAL' && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {selectedParticipants.map((userId) => {
                      const m = members.find((mem) => mem.user_id === userId);
                      const sumOtherExact = selectedParticipants
                        .filter((id) => id !== userId)
                        .reduce((acc, id) => acc + (customSplits[id]?.exact || 0), 0);
                      const remainingForUser = Math.max(0, Math.round((totalAmount - sumOtherExact) * 100) / 100);
                      const currentExact = customSplits[userId]?.exact;
                      const isZeroExact = splitType === 'EXACT' && (currentExact === 0 || currentExact === undefined);

                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar profile={m?.profile} size="sm" />
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate block">
                                {m?.profile?.full_name || expenseToEdit?.participants?.find((p) => p.user_id === userId)?.profile?.full_name || t('common.friend')}
                              </span>
                              {isZeroExact && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                                  {t('expenses.notParticipating')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {splitType === 'EXACT' && !isReadOnly && remainingForUser > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAssignRemainder(userId, remainingForUser)}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 transition-colors flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                                title={t('expenses.assignRemainderTitle', { amount: formatMoney(remainingForUser, currency) })}
                              >
                                <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>{t('expenses.assignRemainder')}</span>
                              </button>
                            )}

                            <div className="flex items-center gap-1 w-24 sm:w-28">
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
                                  customSplitInputs[userId] !== undefined
                                    ? customSplitInputs[userId]
                                    : splitType === 'EXACT'
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
                                  if (isReadOnly) return;
                                  const raw = e.target.value;
                                  const sanitized = raw.replace(/[^0-9.,]/g, '');
                                  setCustomSplitInputs((prev) => ({
                                    ...prev,
                                    [userId]: sanitized,
                                  }));
                                  const val = parseEuropeanAmount(sanitized);
                                  setCustomSplits((prev) => ({
                                    ...prev,
                                    [userId]: {
                                      ...prev[userId],
                                      ...(splitType === 'EXACT' ? { exact: val } : {}),
                                      ...(splitType === 'PERCENTAGE' ? { percentage: val } : {}),
                                      ...(splitType === 'SHARES' ? { shares: val } : {}),
                                    },
                                  }));
                                }}
                                readOnly={isReadOnly}
                                className="w-full text-right text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent"
                              />
                              <span className="text-xs text-slate-500 font-semibold">
                                {splitType === 'EXACT' ? currencyObj.symbol : splitType === 'PERCENTAGE' ? '%' : t('expenses.splitModes.shares')}
                              </span>
                            </div>
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

        {/* NOTAS Y OBSERVACIONES */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('common.notes')}
          </label>
          <textarea
            rows={2}
            placeholder={isReadOnly ? '' : t('common.notes')}
            value={notes}
            onChange={(e) => !isReadOnly && setNotes(e.target.value)}
            readOnly={isReadOnly}
            className={`w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm resize-none ${
              isReadOnly ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300' : ''
            }`}
          />
        </div>

        {/* FECHA Y HORA DEL GASTO (Estricto formato europeo DD/MM/AAAA y 24h) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {t('expenses.dateTime')}
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium" title={getUserTimezoneLabel()}>
              {getUserTimezoneLabel()}
            </span>
          </div>
          {isReadOnly ? (
            <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {dateDisplayStr} • {timeDisplayStr}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Fecha Europea DD/MM/AAAA */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Fecha <span className="text-[10px] text-slate-400 font-normal">(DD/MM/AAAA)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={setTodayDate}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Hoy
                    </button>
                    <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
                    <button
                      type="button"
                      onClick={setYesterdayDate}
                      className="text-[11px] font-bold text-slate-500 hover:underline"
                    >
                      Ayer
                    </button>
                  </div>
                </div>
                <div className="relative flex items-center">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/AAAA (ej: 30/08/2026)"
                    value={dateDisplayStr}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-mono"
                  />
                  {/* Native hidden date picker for calendar click */}
                  <input
                    type="date"
                    ref={datePickerRef}
                    value={(() => {
                      const parts = (dateDisplayStr || '').split(/[\/\.-]/);
                      if (parts.length >= 3) {
                        const d = parts[0].padStart(2, '0');
                        const m = parts[1].padStart(2, '0');
                        let y = parts[2];
                        if (y.length === 2) y = `20${y}`;
                        return `${y}-${m}-${d}`;
                      }
                      return '';
                    })()}
                    onChange={(e) => handleNativeDateChange(e.target.value)}
                    className="absolute right-2 opacity-0 w-6 h-6 cursor-pointer"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.click()}
                    className="absolute right-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1"
                    title="Abrir calendario"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hora HH:mm (24h) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Hora <span className="text-[10px] text-slate-400 font-normal">(24h)</span>
                  </span>
                  <button
                    type="button"
                    onClick={setNowTime}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Ahora
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="HH:MM (ej: 14:35)"
                    value={timeDisplayStr}
                    onChange={(e) => handleTimeInputChange(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOTO DEL TICKET / FACTURA */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            {t('expenses.receiptPhoto')}
          </label>
            <div className="flex items-center gap-2">
              {!isReadOnly ? (
                <>
                  {/* Botón 1: Hacer foto directamente con la cámara */}
                  <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-xs font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/60 cursor-pointer transition-colors shadow-xs">
                    <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{t('expenses.takePhoto')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Botón 2: Subir archivo o galería */}
                  <label className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs">
                    <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{receiptUrl ? t('expenses.changeReceipt') : t('expenses.uploadFromGallery')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {receiptUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowReceiptModal(true)}
                        className="p-2.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-colors shadow-xs shrink-0"
                        title={t('expenses.viewReceipt')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptUrl(null);
                          setScannedData(null);
                        }}
                        className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors shrink-0"
                        title={t('expenses.removeReceipt')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </>
              ) : receiptUrl ? (
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 transition-colors shadow-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{t('expenses.viewReceipt')}</span>
                </button>
              ) : (
                <div className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400 text-center">
                  {t('expenses.noReceipt')}
                </div>
              )}
            </div>
            {!isReadOnly && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{t('expenses.receiptSafetyWarning')}</span>
              </p>
            )}
          </div>

        {/* Comentarios y aclaraciones del gasto */}
        {expenseToEdit?.id && (
          <ExpenseCommentsSection
            expenseId={expenseToEdit.id}
            expenseTitle={expenseToEdit.title}
            groupId={groupId}
          />
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Submit Buttons / Delete Action / ReadOnly Action */}
        <div className="pt-2">
          {isReadOnly ? (
            <div className="flex items-center gap-2">
              {expenseToEdit && (
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 shrink-0"
                  title={t('expenses.reportExpense')}
                >
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span className="hidden sm:inline">{t('expenses.reportExpense')}</span>
                </button>
              )}
              <Button
                type="button"
                variant="brand"
                onClick={onClose}
                className="flex-1 text-sm font-bold shadow-md shadow-emerald-600/20"
              >
                {t('expenses.closeDetail')}
              </Button>
            </div>
          ) : expenseToEdit ? (
            <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleDeleteExpense}
                disabled={isDeleting || isLoading}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                title={t('expenses.deleteExpense')}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? '...' : t('expenses.deleteExpense')}</span>
              </button>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <Button type="button" variant="outline" onClick={onClose} className="px-4">
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  isLoading={isLoading}
                  disabled={isDeleting}
                  className="text-sm font-bold px-5"
                >
                  {t('expenses.saveChanges')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="brand"
                isLoading={isLoading}
                disabled={isDeleting}
                className="flex-1 text-sm font-bold"
              >
                {t('expenses.quickSave', { amount: formatMoney(totalAmount, currency) })}
              </Button>
            </div>
          )}
        </div>

      </form>

      <ReportContentModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="expense"
        targetId={expenseToEdit?.id || ''}
        targetTitle={expenseToEdit?.title}
        groupId={groupId || expenseToEdit?.group_id}
        targetUrl={
          (groupId || expenseToEdit?.group_id) && expenseToEdit?.id
            ? `/groups/${groupId || expenseToEdit?.group_id}?tab=expenses&expenseId=${expenseToEdit.id}`
            : undefined
        }
      />

      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptUrl={receiptUrl}
        title={title || expenseToEdit?.title || t('expenses.receiptPhoto')}
      />

      {preCensorImage && (
        <ReceiptRedactionModal
          isOpen={!!preCensorImage}
          onClose={() => setPreCensorImage(null)}
          imageSrc={preCensorImage}
          onConfirmRedaction={handleConfirmPreCensored}
        />
      )}
    </Modal>
  );
};

