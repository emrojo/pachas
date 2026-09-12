'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCircle2,
  RotateCcw,
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
  FileText,
  MessageSquare,
} from 'lucide-react';
import { ReportContentModal } from '@/components/safety/ReportContentModal';
import { ReceiptModal } from '@/components/expenses/ReceiptModal';
import { ExpenseCommentsSection } from '@/components/expenses/ExpenseCommentsSection';
import { ReceiptRedactionModal } from '@/components/expenses/ReceiptRedactionModal';
import { scanReceipt, ScannedReceiptData } from '@/lib/ocr/receiptScanner';
import { ItemizedSplitEditor } from '@/components/expenses/ItemizedSplitEditor';
import { LineItemInput } from '@/lib/algorithms/itemizedSplitCalculations';
import { generateUUID } from '@/lib/id';

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
  isMobileView?: boolean;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  groupId,
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
  isReadOnly: explicitReadOnly,
  isMobileView = false,
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
    isGroupAdmin,
  } = usePachas();
  const { t, language } = useTranslation();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);

  const baseCurrency = group?.base_currency || 'EUR';

  // Permission calculation: Creator, Group Admin, or App Admin can edit or delete it
  const isCreator = currentUser && expenseToEdit ? expenseToEdit.created_by === currentUser.id : true;
  const isGroupAdminUser = currentUser ? (isGroupAdmin ? isGroupAdmin(groupId) : false) : false;
  const isAppAdminUser = currentUser?.role === 'admin';
  const canEdit = isCreator || isGroupAdminUser || isAppAdminUser;
  const isReadOnly =
    explicitReadOnly !== undefined
      ? explicitReadOnly
      : expenseToEdit
      ? !canEdit
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

  // Mobile accordion collapsed states (all secondary sections collapsed by default on mobile)
  const [isCategoryOpen, setIsCategoryOpen] = useState(!isMobileView);
  const [isDateTimeOpen, setIsDateTimeOpen] = useState(!isMobileView);
  const [isLocationOpen, setIsLocationOpen] = useState(!isMobileView && Boolean(expenseToEdit?.location_name || expenseToEdit?.latitude));
  const [isNotesOpen, setIsNotesOpen] = useState(!isMobileView && Boolean(expenseToEdit?.notes));
  const [isReceiptSectionOpen, setIsReceiptSectionOpen] = useState(!isMobileView && Boolean(expenseToEdit?.receipt_url));
  const [isCommentsOpen, setIsCommentsOpen] = useState(!isMobileView);

  // Payers state
  const [isMultiPayer, setIsMultiPayer] = useState(false);
  const [multiPayerMode, setMultiPayerMode] = useState<'EQUAL' | 'EXACT'>('EQUAL');
  const [selectedPayerIds, setSelectedPayerIds] = useState<string[]>([]);
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
  const [reimbursedParticipantIds, setReimbursedParticipantIds] = useState<string[]>([]);
  const [isReimbursementOpen, setIsReimbursementOpen] = useState(true);

  // Itemized line-items state ("Separar gastos por productos")
  const [splitByItems, setSplitByItems] = useState(false);
  const [wantItemizedSplit, setWantItemizedSplit] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [isItemsBalanced, setIsItemsBalanced] = useState(true);

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
        setIsCategoryOpen(true);
        setIsDateTimeOpen(true);
        setIsLocationOpen(Boolean(expenseToEdit.location_name || expenseToEdit.latitude));
        setIsNotesOpen(Boolean(expenseToEdit.notes));
        setIsReceiptSectionOpen(Boolean(expenseToEdit.receipt_url));
        setIsCommentsOpen(true);
      } else if (isMobileView) {
        setIsWhoPaidOpen(false);
        setIsSplitOpen(false);
        setIsCategoryOpen(false);
        setIsDateTimeOpen(false);
        setIsLocationOpen(Boolean(expenseToEdit.location_name || expenseToEdit.latitude));
        setIsNotesOpen(Boolean(expenseToEdit.notes));
        setIsReceiptSectionOpen(Boolean(expenseToEdit.receipt_url));
        setIsCommentsOpen(false);
      } else {
        setIsWhoPaidOpen(false);
        setIsSplitOpen(false);
        setIsCategoryOpen(true);
        setIsDateTimeOpen(true);
        setIsLocationOpen(true);
        setIsNotesOpen(true);
        setIsReceiptSectionOpen(true);
        setIsCommentsOpen(true);
      }

      // Populate location
      setLatitude(expenseToEdit.latitude !== null && expenseToEdit.latitude !== undefined ? Number(expenseToEdit.latitude) : null);
      setLongitude(expenseToEdit.longitude !== null && expenseToEdit.longitude !== undefined ? Number(expenseToEdit.longitude) : null);
      setLocationName(expenseToEdit.location_name || null);

      // Populate payers
      if (expenseToEdit.payers && expenseToEdit.payers.length > 1) {
        setIsMultiPayer(true);
        const map: Record<string, string> = {};
        const pIds = expenseToEdit.payers.map((p) => p.user_id);
        setSelectedPayerIds(pIds);

        const amounts = expenseToEdit.payers.map((p) => Number(p.amount_paid) || 0);
        const minAmt = Math.min(...amounts);
        const maxAmt = Math.max(...amounts);
        const isBasicallyEqual = Math.abs(maxAmt - minAmt) <= 0.02;
        setMultiPayerMode(isBasicallyEqual ? 'EQUAL' : 'EXACT');

        expenseToEdit.payers.forEach((p) => {
          const amt = Number(p.amount_paid) || 0;
          map[p.user_id] = amt.toFixed(2).replace('.', ',');
        });
        setCustomPayers(map);
      } else if (expenseToEdit.payers && expenseToEdit.payers.length === 1) {
        setIsMultiPayer(false);
        setMultiPayerMode('EQUAL');
        setSinglePayerId(expenseToEdit.payers[0].user_id);
        setSelectedPayerIds([expenseToEdit.payers[0].user_id]);
      } else {
        setIsMultiPayer(false);
        setMultiPayerMode('EQUAL');
        setSinglePayerId(expenseToEdit.created_by);
        setSelectedPayerIds([expenseToEdit.created_by]);
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
        const reimbursed = expenseToEdit.participants
          .filter((p) => Boolean(p.has_paid))
          .map((p) => p.user_id);
        setReimbursedParticipantIds(reimbursed);
      } else {
        setReimbursedParticipantIds([]);
      }

      // Populate itemized line items if present
      if (expenseToEdit.split_type === 'ITEMIZED' || (expenseToEdit.items && expenseToEdit.items.length > 0)) {
        setSplitByItems(true);
        setLineItems(
          (expenseToEdit.items || []).map((it) => ({
            id: it.id || generateUUID(),
            description: it.description,
            price: Number(it.price) || 0,
            assignedUserIds: it.assigned_user_ids || [],
          }))
        );
      } else {
        setSplitByItems(false);
        setLineItems([]);
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
      setMultiPayerMode('EQUAL');
      setSelectedPayerIds(defaultUserId ? [defaultUserId] : []);
      setSinglePayerId(defaultUserId);
      setCustomPayers(defaultUserId ? { [defaultUserId]: '' } : {});
      setSelectedParticipants(members.map((m) => m.user_id));
      setSplitType('EQUAL');
      setSplitByItems(false);
      setWantItemizedSplit(false);
      setLineItems([]);
      setCustomSplits({});
      setCustomSplitInputs({});
      setReimbursedParticipantIds([]);
      if (isMobileView) {
        setIsCategoryOpen(false);
        setIsDateTimeOpen(false);
        setIsLocationOpen(false);
        setIsNotesOpen(false);
        setIsReceiptSectionOpen(false);
        setIsCommentsOpen(false);
      } else {
        setIsCategoryOpen(true);
        setIsDateTimeOpen(true);
        setIsLocationOpen(true);
        setIsNotesOpen(true);
        setIsReceiptSectionOpen(true);
        setIsCommentsOpen(true);
      }
      setIsWhoPaidOpen(false);
      setIsSplitOpen(false);
      setRateSourceInfo(null);
    }
  }, [isOpen, expenseToEdit, members, currentUser?.id, baseCurrency, isReadOnly, isMobileView]);


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
  const currentSinglePayer = members.find((m) => m.user_id === singlePayerId)?.profile || expenseToEdit?.payers?.[0]?.profile || currentUser;

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

  // Toggle payer in equal multi-payer mode
  const toggleSelectedPayer = (userId: string) => {
    if (isReadOnly) return;
    if (selectedPayerIds.includes(userId)) {
      setSelectedPayerIds(selectedPayerIds.filter((id) => id !== userId));
    } else {
      setSelectedPayerIds([...selectedPayerIds, userId]);
    }
  };

  // Select all payers in equal multi-payer mode
  const selectAllPayers = () => {
    if (isReadOnly) return;
    setSelectedPayerIds(members.map((m) => m.user_id));
  };

  // Switch to EQUAL mode, preserving existing positive payers if any
  const handleSwitchToEqual = () => {
    setMultiPayerMode('EQUAL');
    const active = Object.entries(customPayers)
      .filter(([_, val]) => parseEuropeanAmount(val) > 0)
      .map(([uid]) => uid);
    if (active.length > 0) {
      setSelectedPayerIds(active);
    } else if (selectedPayerIds.length === 0) {
      setSelectedPayerIds(singlePayerId ? [singlePayerId] : members.map((m) => m.user_id));
    }
  };

  // Calculate equal splits among selected payers with exact penny balancing
  const equalPayerSplits = useMemo(() => {
    if (selectedPayerIds.length === 0 || totalAmount <= 0) return [];
    return calculateSplits(totalAmount, 'EQUAL', selectedPayerIds, {}, currency).results;
  }, [totalAmount, selectedPayerIds, currency]);

  // Synchronize equal split amounts into customPayers state for seamless editing
  useEffect(() => {
    if (isMultiPayer && multiPayerMode === 'EQUAL' && equalPayerSplits.length > 0) {
      const newMap: Record<string, string> = {};
      equalPayerSplits.forEach((r) => {
        newMap[r.userId] = r.amountOwed.toFixed(2).replace('.', ',');
      });
      setCustomPayers(newMap);
    }
  }, [isMultiPayer, multiPayerMode, equalPayerSplits]);

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

  const handleAssignPercentageRemainder = (userId: string, remainder: number) => {
    if (isReadOnly) return;
    const roundedRemainder = Math.max(0, Math.round(remainder * 100) / 100);
    const formatted = roundedRemainder % 1 === 0 ? String(roundedRemainder) : roundedRemainder.toFixed(2).replace('.', ',');
    setCustomSplitInputs((prev) => ({
      ...prev,
      [userId]: formatted,
    }));
    setCustomSplits((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        percentage: roundedRemainder,
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
      if (data && (data.amount || data.title || data.date || (data.items && data.items.length > 0))) {
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
    if (scannedData.items && scannedData.items.length > 0) {
      const parsedItems: LineItemInput[] = scannedData.items.map((it) => ({
        id: generateUUID(),
        description: it.description,
        price: it.price,
        assignedUserIds: [], // Empty means shared equally by all group members
      }));
      setLineItems(parsedItems);
      if (wantItemizedSplit) {
        setSplitByItems(true);
        setSplitType('ITEMIZED');
        setIsSplitOpen(true);
      }
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
    if (splitByItems) {
      if (lineItems.length === 0) {
        setErrorMessage(t('expenses.itemizedItemsRequired') || 'Debes añadir al menos un producto en el desglose.');
        return;
      }
      for (const item of lineItems) {
        if (!item.description.trim()) {
          setErrorMessage(t('expenses.itemizedDescriptionRequired') || 'Todos los productos deben tener descripción.');
          return;
        }
        if (item.price <= 0) {
          setErrorMessage(t('expenses.itemizedPricePositive') || 'El precio de todos los productos debe ser mayor que 0.');
          return;
        }
      }
      const sumItems = lineItems.reduce((acc, it) => acc + (Number(it.price) || 0), 0);
      const diff = Math.round((totalAmount - sumItems) * 100) / 100;
      if (Math.abs(diff) > 0.01) {
        setErrorMessage(
          t('expenses.itemizedSumMismatch', {
            itemsTotal: formatMoney(sumItems, currency),
            invoiceTotal: formatMoney(totalAmount, currency),
          }) || `La suma de los productos (${formatMoney(sumItems, currency)}) no coincide con el total (${formatMoney(totalAmount, currency)}).`
        );
        return;
      }
    } else {
      if (selectedParticipants.length === 0) {
        setErrorMessage('Selecciona al menos un amigo para compartir el gasto');
        return;
      }
    }

    // Prepare Payers
    let payersList: { userId: string; amountPaid: number }[] = [];
    if (isMultiPayer) {
      if (multiPayerMode === 'EQUAL') {
        if (selectedPayerIds.length === 0) {
          setErrorMessage(t('expenses.selectAtLeastOnePayer') || 'Selecciona al menos un amigo que haya pagado');
          return;
        }
        const splitRes = calculateSplits(totalAmount, 'EQUAL', selectedPayerIds, {}, currency);
        if (!splitRes.isValid || splitRes.results.length === 0) {
          setErrorMessage(splitRes.errorMessage || 'Error al repartir el pago a partes iguales');
          return;
        }
        payersList = splitRes.results.map((r) => ({
          userId: r.userId,
          amountPaid: r.amountOwed,
        }));
      } else {
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
      }
    } else {
      payersList = [{ userId: singlePayerId, amountPaid: totalAmount }];
    }

    // Filtramos los participantes que efectivamente participan:
    let activeParticipants: string[] = [];
    if (!splitByItems) {
      activeParticipants = splitType === 'EXACT'
        ? selectedParticipants.filter((id) => (customSplits[id]?.exact || 0) > 0)
        : splitType === 'PERCENTAGE'
        ? selectedParticipants.filter((id) => (customSplits[id]?.percentage || 0) > 0)
        : selectedParticipants;

      if (activeParticipants.length === 0) {
        setErrorMessage(
          splitType === 'EXACT'
            ? 'Debes asignar un importe mayor a 0 a al menos un participante'
            : splitType === 'PERCENTAGE'
            ? 'Debes asignar un porcentaje mayor a 0% a al menos un participante'
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
    } else {
      activeParticipants = members.map((m) => m.user_id);
    }

    try {
      setIsLoading(true);
      const finalIsoDate = combineEuropeanDateTimeToISO(dateDisplayStr, timeDisplayStr);

      const itemsToSave = splitByItems
        ? lineItems.map((it) => ({
            id: it.id,
            description: it.description,
            price: it.price,
            assigned_user_ids: it.assignedUserIds,
          }))
        : undefined;

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
          splitType: splitByItems ? 'ITEMIZED' : splitType,
          items: itemsToSave,
          payers: payersList,
          selectedParticipantIds: activeParticipants,
          splitCustomInputs: customSplits,
          reimbursedParticipantIds,
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
          splitType: splitByItems ? 'ITEMIZED' : splitType,
          items: itemsToSave,
          payers: payersList,
          selectedParticipantIds: activeParticipants,
          splitCustomInputs: customSplits,
          reimbursedParticipantIds,
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

  // 1. Category Section
  const renderCategorySection = () => {
    const categoryContent = (
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {Object.values(CATEGORIES).map((cat) => {
          const isSelected = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => !isReadOnly && setCategory(cat.id)}
              disabled={isReadOnly}
              className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                isSelected
                  ? `${cat.bgColor} ${cat.borderColor} ring-2 ring-emerald-500 shadow-sm scale-105`
                  : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              } ${isReadOnly && !isSelected ? 'opacity-40' : ''}`}
            >
              <span className={isMobileView ? 'text-2xl' : 'text-xl'}>{cat.emoji}</span>
              <span
                className={`font-medium leading-tight line-clamp-1 ${isMobileView ? 'text-xs font-bold' : 'text-[11px]'} ${
                  isSelected ? cat.textColor : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t(`categories.${cat.id}` as any) || cat.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    );

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsCategoryOpen(!isCategoryOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-2xl shrink-0">
                {CATEGORIES[category]?.emoji || '🧾'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.category')}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {t(`categories.${category}` as any) || CATEGORIES[category]?.label || 'General'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isCategoryOpen ? t('common.close') : t('common.edit')}
              </span>
              {isCategoryOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isCategoryOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                {categoryContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
          {t('expenses.category')}
        </label>
        {categoryContent}
      </div>
    );
  };

  // 2. Location Section
  const renderLocationSection = () => {
    const locationContent = (
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
    );

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsLocationOpen(!isLocationOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.location')}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {locationName || (latitude ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : 'Sin ubicación')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isLocationOpen ? t('common.close') : locationName ? t('common.edit') : '+ Añadir'}
              </span>
              {isLocationOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isLocationOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                {locationContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
          {t('expenses.location')}
        </label>
        {locationContent}
      </div>
    );
  };

  // 3. Notes Section
  const renderNotesSection = () => {
    const notesContent = (
      <textarea
        rows={2}
        placeholder={isReadOnly ? '' : t('common.notes')}
        value={notes}
        onChange={(e) => !isReadOnly && setNotes(e.target.value)}
        readOnly={isReadOnly}
        className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm resize-none ${
          isReadOnly ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300' : ''
        }`}
      />
    );

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsNotesOpen(!isNotesOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('common.notes')}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {notes.trim() ? notes.trim() : 'Sin notas'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isNotesOpen ? t('common.close') : notes.trim() ? t('common.edit') : '+ Añadir'}
              </span>
              {isNotesOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isNotesOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                {notesContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
          {t('common.notes')}
        </label>
        {notesContent}
      </div>
    );
  };

  // 4. DateTime Section
  const renderDateTimeSection = () => {
    const dateTimeContent = isReadOnly ? (
      <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-3 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
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
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Fecha <span className="text-[10px] text-slate-400 font-normal">(DD/MM/AAAA)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={setTodayDate}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Hoy
              </button>
              <span className="text-slate-300 dark:text-slate-700 text-[10px]">•</span>
              <button
                type="button"
                onClick={setYesterdayDate}
                className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
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
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-mono"
            />
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
              className="absolute right-2.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1 cursor-pointer"
              title="Abrir calendario"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hora HH:mm (24h) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Hora <span className="text-[10px] text-slate-400 font-normal">(24h)</span>
            </span>
            <button
              type="button"
              onClick={setNowTime}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
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
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm font-mono"
            />
          </div>
        </div>
      </div>
    );

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsDateTimeOpen(!isDateTimeOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.dateTime')}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {dateDisplayStr} • {timeDisplayStr}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isDateTimeOpen ? t('common.close') : t('common.edit')}
              </span>
              {isDateTimeOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isDateTimeOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                {dateTimeContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {t('expenses.dateTime')}
          </label>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium" title={getUserTimezoneLabel()}>
            {getUserTimezoneLabel()}
          </span>
        </div>
        {dateTimeContent}
      </div>
    );
  };

  // 5. Receipt Section
  const renderReceiptSection = () => {
    const receiptContent = (
      <div>
        <div className="flex items-center gap-2">
          {!isReadOnly ? (
            <>
              {/* Botón 1: Hacer foto directamente con la cámara */}
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/60 cursor-pointer transition-colors shadow-xs">
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
              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs">
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
                    className="p-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-2xl text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
                    title={t('expenses.viewReceipt')}
                  >
                    <Eye className="w-4.5 h-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptUrl(null);
                      setScannedData(null);
                    }}
                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-2xl text-xs font-bold transition-colors shadow-xs shrink-0 cursor-pointer"
                    title={t('expenses.removeReceipt')}
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </>
              )}
            </>
          ) : receiptUrl ? (
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/40 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 transition-colors shadow-xs cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>{t('expenses.viewReceipt')}</span>
            </button>
          ) : (
            <div className="flex-1 px-3 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-400 text-center font-medium">
              {t('expenses.noReceipt')}
            </div>
          )}
        </div>
        {!isReadOnly && (
          <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-start gap-1">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('expenses.receiptSafetyWarning')}</span>
          </p>
        )}
      </div>
    );

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsReceiptSectionOpen(!isReceiptSectionOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.receiptPhoto')}
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  {receiptUrl ? '✅ Ticket adjuntado' : 'Sin ticket adjuntado'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isReceiptSectionOpen ? t('common.close') : receiptUrl ? t('common.edit') : '+ Adjuntar'}
              </span>
              {isReceiptSectionOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isReceiptSectionOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                {receiptContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
          {t('expenses.receiptPhoto')}
        </label>
        {receiptContent}
      </div>
    );
  };

  // 6. Comments Section
  const renderCommentsSection = () => {
    if (!expenseToEdit?.id) return null;

    if (isMobileView) {
      return (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsCommentsOpen(!isCommentsOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Comentarios y Debate
                </span>
                <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                  Debate del gasto
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {isCommentsOpen ? t('common.close') : 'Ver'}
              </span>
              {isCommentsOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isCommentsOpen && (
            <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 mt-2 animate-in fade-in duration-200">
              <div className="pt-3">
                <ExpenseCommentsSection
                  expenseId={expenseToEdit.id}
                  expenseTitle={expenseToEdit.title}
                  groupId={groupId}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <ExpenseCommentsSection
        expenseId={expenseToEdit.id}
        expenseTitle={expenseToEdit.title}
        groupId={groupId}
      />
    );
  };

  // 7. Reimbursement / Payment to Lender Section
  const renderReimbursementSection = () => {
    if (selectedParticipants.length === 0) return null;

    // Debtors are participants who owe money to the lender(s)
    const debtors = selectedParticipants.filter((id) => {
      if (!isMultiPayer && id === singlePayerId) return false;
      return true;
    });

    if (debtors.length === 0) return null;

    const paidCount = debtors.filter((id) => reimbursedParticipantIds.includes(id)).length;
    const totalDebtors = debtors.length;
    const isAllPaid = totalDebtors > 0 && paidCount === totalDebtors;
    const isPartialPaid = paidCount > 0 && paidCount < totalDebtors;

    const toggleReimbursed = (userId: string) => {
      if (isReadOnly) return;
      setReimbursedParticipantIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    };

    const markAllReimbursed = () => {
      if (isReadOnly) return;
      setReimbursedParticipantIds(debtors);
    };

    const markAllPending = () => {
      if (isReadOnly) return;
      setReimbursedParticipantIds([]);
    };

    return (
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => setIsReimbursementOpen(!isReimbursementOpen)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`rounded-2xl flex items-center justify-center shrink-0 ${
                isMobileView ? 'w-10 h-10' : 'w-8 h-8 rounded-xl'
              } ${
                isAllPaid
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : isPartialPaid
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {isAllPaid ? (
                <CheckCircle2 className={isMobileView ? 'w-5 h-5' : 'w-4 h-4'} />
              ) : isPartialPaid ? (
                <RotateCcw className={isMobileView ? 'w-5 h-5' : 'w-4 h-4'} />
              ) : (
                <Clock className={isMobileView ? 'w-5 h-5' : 'w-4 h-4'} />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                {t('expenses.reimbursedToLender')}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1 font-bold rounded-full px-2 py-0.5 text-xs ${
                    isAllPaid
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700/80'
                      : isPartialPaid
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80'
                      : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{isAllPaid ? '✅' : isPartialPaid ? '🔄' : '⏳'}</span>
                  <span>
                    {isAllPaid
                      ? t('expenses.statusCompleted')
                      : isPartialPaid
                      ? `${t('expenses.statusPartial')} (${paidCount}/${totalDebtors})`
                      : t('expenses.statusPending')}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-emerald-600 dark:text-emerald-400 font-bold ${
                isMobileView ? 'text-xs' : 'text-xs font-semibold hidden sm:inline'
              }`}
            >
              {isReimbursementOpen ? t('common.close') : isReadOnly ? t('common.details') : t('common.edit')}
            </span>
            {isReimbursementOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>

        {isReimbursementOpen && (
          <div className="p-4 pt-0 border-t border-slate-200/60 dark:border-slate-800 space-y-3 mt-2">
            {!isReadOnly && debtors.length > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isAllPaid
                    ? t('expenses.allReimbursedNotice')
                    : `${paidCount} de ${totalDebtors} han devuelto`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={markAllReimbursed}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Marcar todos
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={markAllPending}
                    className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {debtors.map((userId) => {
                const m = members.find((mem) => mem.user_id === userId);
                const isPaid = reimbursedParticipantIds.includes(userId);

                return (
                  <div
                    key={userId}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                      isPaid
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar profile={m?.profile} size={isMobileView ? 'md' : 'sm'} />
                      <div className="min-w-0">
                        <span
                          className={`font-bold block truncate text-slate-900 dark:text-white ${
                            isMobileView ? 'text-base' : 'text-xs'
                          }`}
                        >
                          {currentUser && userId === currentUser.id
                            ? t('common.you')
                            : m?.profile?.full_name || expenseToEdit?.participants?.find((p) => p.user_id === userId)?.profile?.full_name || t('common.friend')}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => toggleReimbursed(userId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                          isReadOnly ? 'cursor-default' : 'active:scale-95'
                        } ${
                          isPaid
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300/70 dark:border-slate-700'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{t('expenses.reimbursedToLender')}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t('expenses.pendingReimbursement')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReadOnly ? t('expenses.viewExpense') : expenseToEdit ? t('expenses.editExpense') : t('expenses.addExpense')}
      description={`${t('nav.groups')}: ${group?.name || ''}`}
      maxWidth={isMobileView ? 'md' : 'lg'}
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

        {/* Banner de Edición como Administrador */}
        {!isReadOnly && expenseToEdit && !isCreator && (isGroupAdminUser || isAppAdminUser) && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-base shrink-0">
                🛡️
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-emerald-900 dark:text-emerald-200 block">
                  {t('expenses.adminEditingNotice', { name: creatorProfile?.full_name || t('common.someone') })}
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
        {scannedData && !isReadOnly && (scannedData.amount || scannedData.title || scannedData.date || (scannedData.items && scannedData.items.length > 0)) && (
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
                  {scannedData.items && scannedData.items.length > 0 && (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      🧾 {t('expenses.itemizedDetected', { count: scannedData.items.length }) || `${scannedData.items.length} productos detectados`}
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
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isScanPanelOpen ? t('common.close') : t('expenses.scanOrUpload')}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isScanPanelOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Panel de captura desplegable bajo demanda */}
            {isScanPanelOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-2 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                {/* Opción de Separar gastos con IA */}
                <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors select-none text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={wantItemizedSplit}
                    onChange={(e) => setWantItemizedSplit(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
                    <span className="font-semibold flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <Sparkles className="w-3 h-3" />
                      {t('expenses.splitByItemsToggle')}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ({t('expenses.splitByItemsToggleDesc')})
                    </span>
                  </div>
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
          {isMobileView && (
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {t('expenses.expenseTitle')} *
            </label>
          )}
          <Input
            label={isMobileView ? undefined : `${t('expenses.expenseTitle')} *`}
            placeholder={t('expenses.expenseTitlePlaceholder')}
            value={title}
            onChange={(e) => !isReadOnly && setTitle(e.target.value)}
            required
            autoFocus={!isReadOnly}
            disabled={isReadOnly}
            className={`${
              isMobileView
                ? 'text-lg sm:text-xl font-bold py-3.5 px-4 rounded-2xl'
                : 'text-base py-3'
            } ${isReadOnly ? 'bg-slate-50 dark:bg-slate-800/50 cursor-default' : ''}`}
          />
        </div>

        {/* LÍNEA 2: Importe y Divisa */}
        <div>
          <label className={`block uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 ${
            isMobileView ? 'text-sm font-bold text-slate-700 dark:text-slate-300' : 'text-xs font-semibold'
          }`}>
            {t('expenses.amount')} *
          </label>
          <div className="flex rounded-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <div className={`flex items-center pl-4 pr-1 text-slate-400 font-extrabold select-none ${
              isMobileView ? 'text-3xl font-black' : 'text-2xl'
            }`}>
              {currencyObj.symbol}
            </div>

            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => !isReadOnly && setAmountStr(e.target.value)}
              readOnly={isReadOnly}
              className={`w-full px-2 font-black text-slate-900 dark:text-white bg-transparent focus:outline-none placeholder:text-slate-300 ${
                isMobileView ? 'py-3.5 text-3xl sm:text-4xl font-mono' : 'py-3 text-2xl sm:text-3xl'
              } ${isReadOnly ? 'cursor-default' : ''}`}
              required
            />
            <select
              value={currency}
              onChange={(e) => !isReadOnly && handleCurrencyChange(e.target.value)}
              disabled={isReadOnly}
              className={`bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 px-3.5 border-l border-slate-200 dark:border-slate-700 focus:outline-none ${
                isMobileView ? 'text-sm sm:text-base cursor-pointer' : 'text-xs sm:text-sm'
              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
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
              disabled={isDeleting || (splitByItems && !isItemsBalanced)}
              title={splitByItems && !isItemsBalanced ? (t('expenses.itemizedBalanceMismatch') || 'El desglose no cuadra con el importe total') : undefined}
              className={`w-full font-bold shadow-md shadow-emerald-600/15 flex items-center justify-center gap-2 ${
                isMobileView ? 'py-3.5 text-base rounded-2xl shadow-emerald-600/25' : 'py-2.5 text-sm'
              }`}
            >
              <Check className={isMobileView ? "w-5 h-5 stroke-[2.5]" : "w-4 h-4"} />
              <span>{expenseToEdit ? t('expenses.saveChanges') : t('expenses.quickSave', { amount: formatMoney(totalAmount, currency) })}</span>
            </Button>
          </div>
        )}

        {/* En móvil: Categoría antes de Quién pagó */}
        {isMobileView ? (
          renderCategorySection()
        ) : (
          <>
            {renderLocationSection()}
            {renderCategorySection()}
          </>
        )}

        {/* SECCIÓN 1: ¿Quién pagó el gasto? */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsWhoPaidOpen(!isWhoPaidOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 ${isMobileView ? 'w-10 h-10' : 'w-8 h-8 rounded-xl'}`}>
                <CreditCard className={isMobileView ? "w-5 h-5" : "w-4 h-4"} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.whoPaid')}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {!isMultiPayer ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar profile={currentSinglePayer} size="sm" className={isMobileView ? "w-6 h-6 text-xs" : "w-5 h-5 text-[10px]"} />
                      <span className={`font-bold text-slate-900 dark:text-white truncate ${isMobileView ? 'text-base' : 'text-xs'}`}>
                        {currentUser && singlePayerId === currentUser.id
                          ? `${t('common.you')} (${currentUser.full_name?.split(' ')[0] || ''})`
                          : currentSinglePayer?.full_name}
                      </span>
                    </div>
                  ) : (
                    <span className={`font-bold text-slate-900 dark:text-white truncate ${isMobileView ? 'text-base' : 'text-xs'}`}>
                      {multiPayerMode === 'EQUAL' && selectedPayerIds.length > 0
                        ? t('expenses.paidByMultipleEqual', { count: selectedPayerIds.length })
                        : t('expenses.paidByMultiple')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-emerald-600 dark:text-emerald-400 font-bold ${isMobileView ? 'text-xs' : 'text-xs font-semibold hidden sm:inline'}`}>
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
                    onClick={() => {
                      const next = !isMultiPayer;
                      setIsMultiPayer(next);
                      if (next && selectedPayerIds.length === 0) {
                        setSelectedPayerIds(singlePayerId ? [singlePayerId] : members.map((m) => m.user_id));
                      }
                    }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
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
                <div className="space-y-3 pt-1">
                  {/* Selector de modo: A partes iguales vs Cantidades exactas */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={handleSwitchToEqual}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        multiPayerMode === 'EQUAL'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {t('expenses.multiPayerEqual') || 'A partes iguales'}
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setMultiPayerMode('EXACT')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        multiPayerMode === 'EXACT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {t('expenses.multiPayerExact') || 'Cantidades exactas'}
                    </button>
                  </div>

                  {multiPayerMode === 'EQUAL' ? (
                    <div className="space-y-3">
                      {/* Cabecera de seleccion y boton Todos */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('expenses.multiPayerSelectHint') || 'Selecciona los amigos que pagaron el gasto:'}
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={selectAllPayers}
                            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                          >
                            {t('common.all')} ({members.length})
                          </button>
                        )}
                      </div>

                      {/* Chips de amigos que pagaron */}
                      <div className="flex flex-wrap gap-2">
                        {members.map((m) => {
                          const isSelected = selectedPayerIds.includes(m.user_id);
                          if (isReadOnly && !isSelected) return null;

                          return (
                            <button
                              key={m.user_id}
                              type="button"
                              onClick={() => toggleSelectedPayer(m.user_id)}
                              disabled={isReadOnly}
                              className={`px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all ${
                                isReadOnly ? 'cursor-default' : 'cursor-pointer active:scale-95'
                              } ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                              }`}
                            >
                              <Avatar profile={m.profile} size="sm" className="w-5 h-5 text-[10px]" />
                              <span className={`text-xs font-medium ${isMobileView ? 'text-sm' : ''}`}>
                                {currentUser && m.user_id === currentUser.id
                                  ? t('common.you')
                                  : m.profile?.full_name?.split(' ')[0] || t('common.friend')}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Resumen del reparto a partes iguales */}
                      {selectedPayerIds.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                          {t('expenses.selectAtLeastOnePayer') || 'Selecciona al menos un amigo que haya pagado'}
                        </div>
                      ) : totalAmount > 0 ? (
                        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                              {t('expenses.eachPayerAmount', {
                                amount: formatMoney(
                                  Math.round((totalAmount / selectedPayerIds.length) * 100) / 100,
                                  currency
                                ),
                              })}
                            </span>
                            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                              {selectedPayerIds.length} {selectedPayerIds.length === 1 ? (t('common.friend') || 'pagador') : 'pagadores'}
                            </span>
                          </div>

                          {/* Desglose individual de cada pagador */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {selectedPayerIds.map((uid) => {
                              const m = members.find((mem) => mem.user_id === uid);
                              const splitInfo = equalPayerSplits.find((r) => r.userId === uid);
                              const payerAmt = splitInfo ? splitInfo.amountOwed : (totalAmount / selectedPayerIds.length);
                              const name = currentUser && uid === currentUser.id
                                ? t('common.you')
                                : m?.profile?.full_name?.split(' ')[0] || t('common.friend');

                              return (
                                <span
                                  key={uid}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200"
                                >
                                  <span>{name}:</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    {formatMoney(payerAmt, currency)}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
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
          )}
        </div>

        {/* SECCIÓN 2: ¿Con quién se comparte? */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsSplitOpen(!isSplitOpen)}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 ${isMobileView ? 'w-10 h-10' : 'w-8 h-8 rounded-xl'}`}>
                <Users className={isMobileView ? "w-5 h-5" : "w-4 h-4"} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  {t('expenses.whoShares')}
                </span>
                <span className={`font-bold text-slate-900 dark:text-white mt-0.5 block truncate ${isMobileView ? 'text-base' : 'text-xs'}`}>
                  {splitByItems ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t('expenses.itemizedSplit')}</span>
                      <span>• {lineItems.length} {t('expenses.itemizedItemsCount', { count: lineItems.length }) || `${lineItems.length} productos`}</span>
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-emerald-600 dark:text-emerald-400 font-bold ${isMobileView ? 'text-xs' : 'text-xs font-semibold hidden sm:inline'}`}>
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
              {splitByItems ? (
                <div className="pt-3 space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {t('expenses.itemizedSplitTitle')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                        IA / Desglose
                      </span>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('expenses.confirmSwitchToNormalSplit') || '¿Deseas volver al reparto estándar? Se descartará el desglose por productos.')) {
                            setSplitByItems(false);
                            setSplitType('EQUAL');
                          }
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                      >
                        {t('expenses.switchToNormalSplit') || 'Volver a reparto estándar'}
                      </button>
                    )}
                  </div>

                  <ItemizedSplitEditor
                    items={lineItems}
                    onChange={setLineItems}
                    members={members}
                    totalInvoiceAmount={totalAmount}
                    currency={currency}
                    isReadOnly={isReadOnly}
                    onBalanceChange={setIsItemsBalanced}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-xs text-slate-500">
                      {t('expenses.whoShares')}
                    </span>
                    <div className="flex items-center gap-3">
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setSplitByItems(true);
                            setSplitType('ITEMIZED');
                            if (lineItems.length === 0 && totalAmount > 0) {
                              setLineItems([
                                {
                                  id: generateUUID(),
                                  description: title.trim() || t('expenses.expenseTitle'),
                                  price: totalAmount,
                                  assignedUserIds: [],
                                },
                              ]);
                            }
                          }}
                          className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          <span>{t('expenses.splitByItemsToggle')}</span>
                        </button>
                      )}
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

                      const sumOtherPercentage = selectedParticipants
                        .filter((id) => id !== userId)
                        .reduce((acc, id) => acc + (customSplits[id]?.percentage || 0), 0);
                      const remainingPercentageForUser = Math.max(0, Math.round((100 - sumOtherPercentage) * 100) / 100);
                      const currentPercentage = customSplits[userId]?.percentage;
                      const isZeroPercentage = splitType === 'PERCENTAGE' && (currentPercentage === 0 || currentPercentage === undefined);

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
                              {isZeroPercentage && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                                  {t('expenses.notParticipatingPercent') || 'No participa (0%)'}
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

                            {splitType === 'PERCENTAGE' && !isReadOnly && remainingPercentageForUser > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAssignPercentageRemainder(userId, remainingPercentageForUser)}
                                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 transition-colors flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                                title={t('expenses.assignPercentageRemainderTitle', { percent: `${remainingPercentageForUser}` }) || `Asignar el resto (${remainingPercentageForUser}%) a este amigo`}
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
            </>
          )}
        </div>
      )}
        </div>

        {/* SECCIÓN 3: Estado de devolución al prestador */}
        {renderReimbursementSection()}

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

        {/* Secciones secundarias después de reparto */}
        {isMobileView ? (
          <>
            {renderDateTimeSection()}
            {renderReceiptSection()}
            {renderLocationSection()}
            {renderNotesSection()}
            {renderCommentsSection()}
          </>
        ) : (
          <>
            {renderNotesSection()}
            {renderDateTimeSection()}
            {renderReceiptSection()}
            {renderCommentsSection()}
          </>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium">
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
                  className={`font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 shrink-0 cursor-pointer ${
                    isMobileView ? 'px-4 py-3 text-sm rounded-2xl' : 'px-3.5 py-2 text-xs rounded-xl'
                  }`}
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
                className={`flex-1 font-bold shadow-md shadow-emerald-600/20 ${isMobileView ? 'py-3.5 text-base rounded-2xl' : 'text-sm'}`}
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
                className={`font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 cursor-pointer ${
                  isMobileView ? 'px-4 py-3 text-sm rounded-2xl' : 'px-3.5 py-2 text-xs rounded-xl'
                }`}
                title={t('expenses.deleteExpense')}
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? '...' : t('expenses.deleteExpense')}</span>
              </button>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className={isMobileView ? 'px-4 py-3 text-sm sm:text-base rounded-2xl font-bold' : 'px-4'}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  isLoading={isLoading}
                  disabled={isDeleting || (splitByItems && !isItemsBalanced)}
                  title={splitByItems && !isItemsBalanced ? (t('expenses.itemizedBalanceMismatch') || 'El desglose no cuadra con el importe total') : undefined}
                  className={`font-bold ${isMobileView ? 'px-5 py-3 text-sm sm:text-base rounded-2xl shadow-md shadow-emerald-600/20' : 'text-sm px-5'}`}
                >
                  {t('expenses.saveChanges')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className={`flex-1 ${isMobileView ? 'py-3.5 text-base rounded-2xl font-bold' : ''}`}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="brand"
                isLoading={isLoading}
                disabled={isDeleting || (splitByItems && !isItemsBalanced)}
                title={splitByItems && !isItemsBalanced ? (t('expenses.itemizedBalanceMismatch') || 'El desglose no cuadra con el importe total') : undefined}
                className={`flex-1 font-bold ${isMobileView ? 'py-3.5 text-base rounded-2xl shadow-md shadow-emerald-600/20' : 'text-sm'}`}
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

