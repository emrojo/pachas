'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { CATEGORIES } from '@/lib/categories';
import { SUPPORTED_CURRENCIES, formatMoney, parseEuropeanAmount } from '@/lib/currencies';
import { ExpenseCategory, PendingReceiptScan, SplitType, InvoiceType } from '@/types/database';
import {
  ShieldAlert,
  Check,
  Trash2,
  Receipt,
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Users,
  Paintbrush,
  Square,
  Eraser,
  Undo2,
  AlertTriangle,
  CreditCard,
  Building,
  ZoomIn,
  CheckCircle2,
  Calculator,
  X,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ReceiptModal } from './ReceiptModal';
import { ItemizedSplitEditor } from './ItemizedSplitEditor';
import { LineItemInput, calculateItemizedSplits } from '@/lib/algorithms/itemizedSplitCalculations';
import { auditAndReconcileReceipt, ReceiptAuditReport } from '@/lib/ocr/receiptMathAuditor';
import { generateUUID } from '@/lib/id';

export interface ReceiptValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingScan: PendingReceiptScan | null;
  groupId: string;
  isMobileView?: boolean;
}

// European date helper
function splitEuropeanDateTime(rawIsoOrDate?: string | null): { dateStr: string; timeStr: string } {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  const defaultDateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const defaultTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  if (!rawIsoOrDate) return { dateStr: defaultDateStr, timeStr: defaultTimeStr };

  const str = String(rawIsoOrDate).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2];
    const d = isoMatch[3];
    const hh = isoMatch[4] || '12';
    const mm = isoMatch[5] || '00';
    return { dateStr: `${d}/${m}/${y}`, timeStr: `${hh}:${mm}` };
  }

  const euMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})(?:[T\s](\d{2}):(\d{2}))?/);
  if (euMatch) {
    const d = euMatch[1].padStart(2, '0');
    const m = euMatch[2].padStart(2, '0');
    let y = euMatch[3];
    if (y.length === 2) y = `20${y}`;
    const h = euMatch[4] || pad(now.getHours());
    const min = euMatch[5] || pad(now.getMinutes());
    return { dateStr: `${d}/${m}/${y}`, timeStr: `${h}:${min}` };
  }

  return { dateStr: defaultDateStr, timeStr: defaultTimeStr };
}

function combineEuropeanDateTimeToISO(dateStr: string, timeStr: string): string {
  const dParts = dateStr.trim().split(/[/.-]/);
  let y = new Date().getFullYear();
  let m = new Date().getMonth() + 1;
  let d = new Date().getDate();

  if (dParts.length >= 3) {
    d = parseInt(dParts[0], 10) || d;
    m = parseInt(dParts[1], 10) || m;
    y = parseInt(dParts[2], 10) || y;
  }
  const tParts = (timeStr || '12:00').trim().split(':');
  const hh = parseInt(tParts[0], 10) || 0;
  const mm = parseInt(tParts[1], 10) || 0;

  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
}

export const ReceiptValidationModal: React.FC<ReceiptValidationModalProps> = ({
  isOpen,
  onClose,
  pendingScan,
  groupId,
  isMobileView,
}) => {
  const { getGroup, getGroupMembers, currentUser, confirmPendingScan, dismissPendingScan } = usePachas();
  const { t } = useTranslation();

  const [isMobile, setIsMobile] = useState(Boolean(isMobileView));

  useEffect(() => {
    if (isMobileView !== undefined) {
      setIsMobile(isMobileView);
      return;
    }
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobileView]);

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState(group?.base_currency || 'EUR');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [dateDisplayStr, setDateDisplayStr] = useState('');
  const [timeDisplayStr, setTimeDisplayStr] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [payerId, setPayerId] = useState(currentUser?.id || '');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [splitByItems, setSplitByItems] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [isItemsBalanced, setIsItemsBalanced] = useState(true);
  const [taxName, setTaxName] = useState('IVA');
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxRate, setTaxRate] = useState<number | undefined>(undefined);
  const [subtotal, setSubtotal] = useState<number | undefined>(undefined);
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('simplified');
  const [taxLegislation, setTaxLegislation] = useState<string | undefined>(undefined);
  const [isEurope, setIsEurope] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedTotalAmount = parseEuropeanAmount(amountStr);
  const auditReport: ReceiptAuditReport = useMemo(() => {
    return auditAndReconcileReceipt({
      amount: parsedTotalAmount,
      subtotal,
      tax_name: taxName,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      tax_included: taxIncluded,
      invoice_type: invoiceType,
      tax_legislation: taxLegislation,
      is_europe: isEurope,
      items: lineItems.map((it) => ({
        id: it.id,
        description: it.description,
        description_original: it.description_original,
        price: it.price,
        quantity: it.quantity,
        unit_price: it.unit_price,
        net_price: it.net_price,
        tax_name: it.tax_name || taxName,
        tax_rate: it.tax_rate !== undefined ? it.tax_rate : taxRate,
        tax_amount: it.tax_amount,
        assigned_user_ids: it.assignedUserIds,
        assigned_shares: it.assignedShares,
      })),
    });
  }, [parsedTotalAmount, subtotal, taxName, taxAmount, taxRate, taxIncluded, invoiceType, taxLegislation, isEurope, lineItems]);

  // Canvas extra redaction states
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'brush' | 'box' | 'eraser'>('brush');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapshotBeforeBox, setSnapshotBeforeBox] = useState<ImageData | null>(null);
  const [zoomModalUrl, setZoomModalUrl] = useState<string | null>(null);

  // Initialize form fields and canvas when pendingScan changes
  useEffect(() => {
    if (!isOpen || !pendingScan) return;

    const data = pendingScan.scanned_data || {};
    setTitle(data.title || 'Ticket escaneado');
    setAmountStr(data.amountFormatted || (typeof data.amount === 'number' ? String(data.amount) : ''));
    setCurrency(data.currency || group?.base_currency || 'EUR');
    setCategory(data.category || 'food');
    setTaxName(data.tax_name || 'IVA');
    setTaxAmount(typeof data.tax_amount === 'number' ? data.tax_amount : 0);
    setTaxRate(typeof data.tax_rate === 'number' ? data.tax_rate : undefined);
    setSubtotal(typeof data.subtotal === 'number' ? data.subtotal : undefined);
    setTaxIncluded(typeof data.tax_included === 'boolean' ? data.tax_included : true);
    if (data.invoice_type) {
      setInvoiceType(data.invoice_type);
    }
    if (data.tax_legislation) {
      setTaxLegislation(data.tax_legislation);
    }
    if (typeof data.is_europe === 'boolean') {
      setIsEurope(data.is_europe);
    }

    const dt = splitEuropeanDateTime(data.date);
    setDateDisplayStr(dt.dateStr);
    setTimeDisplayStr(dt.timeStr);
    setLocationName(data.locationName || '');
    setLatitude(data.latitude);
    setLongitude(data.longitude);

    if (currentUser) {
      setPayerId(currentUser.id);
    }
    const allMemberIds = members.map((m) => m.user_id);
    setSelectedParticipants(allMemberIds.length > 0 ? allMemberIds : (currentUser ? [currentUser.id] : []));

    const rawItems = Array.isArray(data.items) ? data.items : [];
    if (rawItems.length > 0) {
      setLineItems(
        rawItems.map((it: any) => ({
          id: it.id || generateUUID(),
          description: it.description || '',
          description_original: it.description_original || undefined,
          price: Number(it.price) || 0,
          net_price: typeof it.net_price === 'number' ? it.net_price : undefined,
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_price: typeof it.unit_price === 'number' ? it.unit_price : null,
          tax_name: it.tax_name || data.tax_name || 'IVA',
          tax_rate: typeof it.tax_rate === 'number' ? it.tax_rate : (typeof data.tax_rate === 'number' ? data.tax_rate : 0),
          tax_amount: typeof it.tax_amount === 'number' ? it.tax_amount : 0,
          assignedUserIds: it.assigned_user_ids || [],
          assignedShares: it.assigned_shares || {},
        }))
      );
      setSplitByItems(true);
    } else {
      setLineItems([]);
      setSplitByItems(false);
    }

    // Render image on canvas and apply sensitiveBoxes auto-censoring
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pendingScan.original_image;

    img.onload = () => {
      baseImageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxDim = 1200;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);

        // Apply auto-detected sensitive bounding boxes from AI (in distinct gray #4b5563)
        const sensitiveBoxes = data.sensitiveBoxes || [];
        if (sensitiveBoxes.length > 0) {
          ctx.fillStyle = '#4b5563';
          sensitiveBoxes.forEach((sb: any) => {
            if (Array.isArray(sb.box_2d) && sb.box_2d.length === 4) {
              const [ymin, xmin, ymax, xmax] = sb.box_2d;
              // Scale from 0..1000 to canvas dimensions
              const top = (ymin / 1000) * h;
              const left = (xmin / 1000) * w;
              const boxW = Math.max(10, ((xmax - xmin) / 1000) * w);
              const boxH = Math.max(10, ((ymax - ymin) / 1000) * h);

              ctx.fillRect(left, top, boxW, boxH);
            }
          });
        }

        const initial = ctx.getImageData(0, 0, w, h);
        setHistory([initial]);
      }
    };
  }, [isOpen, pendingScan, groupId]);

  // Coordinate helper
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const erasePoint = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!baseImageRef.current) return;
    const radius = 16;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const eraseSegment = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    if (!baseImageRef.current) return;
    const radius = 16;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(coords);
    setLastPoint(coords);

    if (drawMode === 'brush') {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (drawMode === 'box') {
      setSnapshotBeforeBox(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } else if (drawMode === 'eraser') {
      erasePoint(ctx, canvas, coords.x, coords.y);
    }
  };

  const handleMoveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCanvasCoordinates(e);

    if (drawMode === 'brush') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (drawMode === 'box' && startPoint && snapshotBeforeBox) {
      ctx.putImageData(snapshotBeforeBox, 0, 0);
      const x = Math.min(startPoint.x, coords.x);
      const y = Math.min(startPoint.y, coords.y);
      const w = Math.abs(coords.x - startPoint.x);
      const h = Math.abs(coords.y - startPoint.y);

      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h);
    } else if (drawMode === 'eraser' && lastPoint) {
      eraseSegment(ctx, canvas, lastPoint.x, lastPoint.y, coords.x, coords.y);
    }

    setLastPoint(coords);
  };

  const handleEndDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPoint(null);
    setLastPoint(null);
    setSnapshotBeforeBox(null);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory((prev) => [...prev.slice(-10), current]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const previous = newHistory[newHistory.length - 1];

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(newHistory);
    }
  };

  const handleToggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      if (selectedParticipants.length === 1) return;
      setSelectedParticipants(selectedParticipants.filter((id) => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const cleanupUrlValidateScanParam = () => {
    if (typeof window !== 'undefined' && window.history) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('validateScan')) {
          url.searchParams.delete('validateScan');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch {}
    }
  };

  const handleClose = () => {
    cleanupUrlValidateScanParam();
    onClose();
  };

  const handleDismiss = () => {
    if (!pendingScan) return;
    if (confirm('¿Descartar este ticket escaneado? No se creará ningún gasto en el grupo.')) {
      dismissPendingScan(pendingScan.id);
      cleanupUrlValidateScanParam();
      onClose();
    }
  };

  const handleConfirmAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingScan) return;

    const parsedAmt = parseEuropeanAmount(amountStr);
    if (!parsedAmt || parsedAmt <= 0) {
      setError('Por favor, introduce un importe válido');
      return;
    }
    if (!title.trim()) {
      setError('Por favor, introduce un concepto para el gasto');
      return;
    }

    if (splitByItems) {
      if (lineItems.length === 0) {
        setError(t('expenses.itemizedItemsRequired') || 'Debes añadir al menos un producto en el desglose.');
        return;
      }
      for (const item of lineItems) {
        if (!item.description.trim()) {
          setError(t('expenses.itemizedDescriptionRequired') || 'Todos los productos deben tener descripción.');
          return;
        }
        if (item.price <= 0) {
          setError(t('expenses.itemizedPricePositive') || 'El precio de todos los productos debe ser mayor que 0.');
          return;
        }
        const itemQty = item.quantity || 1;
        const assignedTotal = (item.assignedShares && Object.keys(item.assignedShares).length > 0)
          ? Object.values(item.assignedShares).reduce((a, b) => a + b, 0)
          : (item.assignedUserIds?.length || 0);
        if (assignedTotal !== itemQty) {
          setError(
            t('expenses.itemizedQuantityUnassignedError', {
              item: item.description,
              assigned: assignedTotal,
              total: itemQty,
            }) || `El producto "${item.description}" tiene ${assignedTotal} de ${itemQty} unidades asignadas. Debe distribuirse al 100%.`
          );
          return;
        }
      }

      const allMemberIds = members.map((m) => m.user_id);
      const splitCheck = calculateItemizedSplits(parsedAmt, lineItems, allMemberIds, currency, {
        taxIncluded,
        taxAmount,
      });
      if (!splitCheck.isBalanced) {
        setError(
          t('expenses.itemizedSumMismatch', {
            itemsTotal: formatMoney(splitCheck.itemsTotal, currency),
            invoiceTotal: formatMoney(parsedAmt, currency),
          }) || `La suma de los productos (${formatMoney(splitCheck.itemsTotal, currency)}) no coincide con el total (${formatMoney(parsedAmt, currency)}).`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError('');

      // Get finalized censored image data from canvas
      const canvas = canvasRef.current;
      const finalReceiptUrl = canvas ? canvas.toDataURL('image/jpeg', 0.85) : pendingScan.original_image;

      const expenseDate = combineEuropeanDateTimeToISO(dateDisplayStr, timeDisplayStr);

      const itemsToSave = splitByItems
        ? lineItems.map((it) => ({
            id: it.id,
            description: it.description,
            description_original: it.description_original || undefined,
            price: it.price,
            net_price: it.net_price,
            quantity: it.quantity || 1,
            unit_price: it.unit_price !== undefined && it.unit_price !== null ? it.unit_price : (it.quantity ? Math.round((it.price / it.quantity) * 100) / 100 : it.price),
            tax_name: it.tax_name || taxName || undefined,
            tax_rate: it.tax_rate !== undefined ? it.tax_rate : taxRate,
            tax_amount: it.tax_amount,
            assigned_user_ids: it.assignedUserIds,
            assigned_shares: it.assignedShares,
          }))
        : undefined;

      await confirmPendingScan(pendingScan.id, {
        groupId,
        title: title.trim(),
        amount: parsedAmt,
        currency,
        tax_name: taxName || undefined,
        tax_amount: taxAmount || 0,
        tax_rate: taxRate,
        subtotal: subtotal || undefined,
        tax_included: taxIncluded,
        invoiceType,
        invoice_type: invoiceType,
        taxLegislation,
        tax_legislation: taxLegislation,
        isEurope,
        is_europe: isEurope,
        category,
        expenseDate,
        receiptUrl: finalReceiptUrl,
        receiptTranslatedUrl: pendingScan.translated_image || pendingScan.scanned_data?.receiptTranslatedUrl || undefined,
        splitType: (splitByItems ? 'ITEMIZED' : 'EQUAL') as SplitType,
        items: itemsToSave,
        payers: [{ userId: payerId, amountPaid: parsedAmt }],
        selectedParticipantIds: splitByItems
          ? members.map((m) => m.user_id)
          : selectedParticipants.length > 0
          ? selectedParticipants
          : [payerId],
        locationName: locationName || undefined,
        latitude,
        longitude,
        ocr_status: 'completed',
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#059669', '#f59e0b'],
      });

      cleanupUrlValidateScanParam();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pendingScan) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('expenses.validateAiScanTitle')}
      description={t('expenses.validateAiScanSubtitle')}
      maxWidth="xl"
    >
      <form onSubmit={handleConfirmAndCreate} className="space-y-5">
        {/* Distintivo de Motor de IA que procesó la factura */}
        {pendingScan?.scanned_data && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Motor de extracción utilizado:</span>
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold shadow-2xs ${
              pendingScan.scanned_data.fallbackUsed
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
            }`}>
              {pendingScan.scanned_data.providerUsed === 'gemini' || pendingScan.scanned_data.source?.includes('gemini')
                ? '✨ Google Gemini Flash'
                : pendingScan.scanned_data.providerUsed === 'ollama' || pendingScan.scanned_data.source?.includes('ollama')
                ? `🦙 Ollama Vision (${pendingScan.scanned_data.modelUsed || '3b'})`
                : '🤖 IA Vision'}
              {pendingScan.scanned_data.fallbackUsed && ' (Fallback)'}
            </span>
          </div>
        )}

        {/* DISCLAIMER DE PRIVACIDAD & RESPONSABILIDAD */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-xs sm:text-sm uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t('expenses.privacyDisclaimerTitle')}</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('expenses.privacyDisclaimerText')}
          </p>
        </div>

        {/* 2-COLUMN LAYOUT: CANCELS/CENSURA A LA IZQUIERDA, CAMPOS A LA DERECHA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Canvas Preview & Extra Censor Tools */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                {t('expenses.censoredReceipt')}
              </span>

              {/* Toolbar Mini */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      setZoomModalUrl(canvas.toDataURL('image/jpeg', 0.95));
                    }
                  }}
                  className={`${isMobile ? 'w-11 h-11 justify-center' : 'px-2 py-1.5 gap-1'} rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 flex items-center transition-all border border-slate-200/60 dark:border-slate-700/60 shadow-2xs active:scale-95`}
                  title={t('expenses.zoomAndEnlarge')}
                  aria-label={t('expenses.zoomAndEnlarge')}
                >
                  <ZoomIn className={`${isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} text-emerald-600 dark:text-emerald-400`} />
                  {!isMobile && <span className="text-[11px]">{t('expenses.zoomAndEnlarge')}</span>}
                </button>

                <div className={`${isMobile ? 'h-6' : 'h-4'} w-px bg-slate-200 dark:bg-slate-700 mx-0.5`} />

                <button
                  type="button"
                  onClick={() => setDrawMode('brush')}
                  className={`${isMobile ? 'w-11 h-11' : 'p-1.5'} flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    drawMode === 'brush' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                  title={t('expenses.blackMarker')}
                  aria-label={t('expenses.blackMarker')}
                >
                  <Paintbrush className={isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawMode('box')}
                  className={`${isMobile ? 'w-11 h-11' : 'p-1.5'} flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    drawMode === 'box' ? 'bg-black text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                  title={t('expenses.redactionBox')}
                  aria-label={t('expenses.redactionBox')}
                >
                  <Square className={isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawMode('eraser')}
                  className={`${isMobile ? 'w-11 h-11' : 'p-1.5'} flex items-center justify-center rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    drawMode === 'eraser' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                  title={t('expenses.redactionEraser')}
                  aria-label={t('expenses.redactionEraser')}
                >
                  <Eraser className={isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className={`${isMobile ? 'w-11 h-11' : 'p-1.5'} flex items-center justify-center rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-all active:scale-95`}
                  title={t('expenses.undoRedaction')}
                  aria-label={t('expenses.undoRedaction')}
                >
                  <Undo2 className={isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
                </button>
              </div>
            </div>

            <div className="relative max-h-[380px] overflow-auto rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 touch-none shadow-inner group">
              <canvas
                ref={canvasRef}
                onMouseDown={handleStartDraw}
                onMouseMove={handleMoveDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleMoveDraw}
                onTouchEnd={handleEndDraw}
                className="max-w-full h-auto cursor-crosshair rounded-lg shadow-sm"
              />

              <button
                type="button"
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (canvas) {
                    setZoomModalUrl(canvas.toDataURL('image/jpeg', 0.95));
                  }
                }}
                className={`absolute bottom-3 right-3 ${isMobile ? 'w-11 h-11 rounded-xl justify-center' : 'px-2.5 py-1 rounded-xl gap-1.5'} bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-bold flex items-center hover:bg-emerald-600 transition-colors shadow-lg border border-white/10 active:scale-95`}
                title={t('expenses.zoomHD')}
                aria-label={t('expenses.zoomHD')}
              >
                <ZoomIn className={`${isMobile ? 'w-5 h-5 text-emerald-400' : 'w-3.5 h-3.5 text-emerald-400'}`} />
                {!isMobile && <span>{t('expenses.zoomHD')}</span>}
              </button>
            </div>
            
            {/* Color Legend */}
            <div className={`flex flex-wrap items-center justify-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 ${isMobile ? 'text-xs' : 'text-[11px]'}`}>
              <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded-xs bg-black border border-slate-600 shrink-0 inline-block shadow-2xs" />
                <span>{t('expenses.legendYourRedaction')}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span className="w-3.5 h-3.5 rounded-xs bg-slate-600 border border-slate-500 shrink-0 inline-block shadow-2xs" />
                <span>{t('expenses.legendAiRedaction')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Extracted Fields Review */}
          <div className="lg:col-span-7 space-y-4">
            {/* Title / Merchant */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('expenses.expenseTitle')}
              </label>
              <input
                type="text"
                placeholder={t('expenses.expenseTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 ${
                  isMobile ? 'py-3 text-base font-bold' : 'py-2 text-sm'
                } text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs`}
              />
            </div>

            {/* Amount & Currency */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-8">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {t('expenses.amount')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={t('expenses.amountPlaceholder')}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  required
                  className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs ${
                    isMobile ? 'text-3xl py-2.5 tracking-tight' : 'text-xl py-2 font-bold'
                  }`}
                />
              </div>

              <div className="col-span-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {t('common.currency')}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs ${
                    isMobile ? 'py-3.5 text-base' : 'py-2 text-sm'
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

            {/* Receipt Mathematical Audit & Tax Consistency Card */}
            {lineItems.length > 0 && (
              <div
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  auditReport.isConsistent
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        auditReport.isConsistent
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {auditReport.isConsistent ? (
                        <CheckCircle2 className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                      ) : (
                        <Calculator className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                      )}
                    </div>
                    <div>
                      <h4 className={`${isMobile ? 'text-sm' : 'text-xs'} font-bold text-slate-900 dark:text-white flex items-center gap-1.5`}>
                        {auditReport.isConsistent
                          ? (taxIncluded ? t('expenses.auditBalancedIncluded') : t('expenses.auditBalancedExcluded'))
                          : t('expenses.auditDiscrepancyTitle')}
                      </h4>
                      <p className={`${isMobile ? 'text-xs' : 'text-[11px]'} text-slate-600 dark:text-slate-400 mt-0.5 leading-snug`}>
                        {auditReport.summaryMessage}
                      </p>
                    </div>
                  </div>

                  {/* Toggle tax included / excluded */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-800 shrink-0 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTaxIncluded(true)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all ${
                        taxIncluded
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t('expenses.taxIncludedShort') || 'IVA inc.'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxIncluded(false)}
                      className={`px-2.5 py-1.5 rounded-lg transition-all ${
                        !taxIncluded
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t('expenses.taxExcludedShort') || '+ IVA'}
                    </button>
                  </div>
                </div>

                {/* Subtotals & Taxes breakdown preview */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                    <span className="block text-[11px] text-slate-500 uppercase font-semibold">
                      {taxIncluded ? (t('expenses.itemsTotal') || 'Total ítems') : (t('expenses.subtotal') || 'Subtotal')}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                      {auditReport.itemsSum.toFixed(2)} {currency}
                    </span>
                  </div>

                  <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                    <span className="block text-[11px] text-slate-500 uppercase font-semibold truncate">
                      {taxName || 'Impuestos'} ({taxIncluded ? 'incl.' : '+ extra'})
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                      {auditReport.taxAmount.toFixed(2)} {currency}
                    </span>
                  </div>

                  <div className="bg-white/60 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                    <span className="block text-[11px] text-slate-500 uppercase font-semibold truncate">
                      {t('expenses.calculatedTotal') || 'Calculado'}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                      {auditReport.calculatedTotal.toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                {/* If discrepancy, offer one-click quick fix button to square receipt */}
                {!auditReport.isConsistent && auditReport.calculatedTotal > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                      {t('expenses.auditDiscrepancyHelp') || '¿Deseas cuadrar el total con la suma calculada?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAmountStr(auditReport.calculatedTotal.toFixed(2).replace('.', ','))}
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors shrink-0 cursor-pointer text-center active:scale-95"
                    >
                      {t('expenses.auditAdjustTotal')
                        ? t('expenses.auditAdjustTotal').replace('{amount}', `${auditReport.calculatedTotal.toFixed(2)} ${currency}`)
                        : `Ajustar a ${auditReport.calculatedTotal.toFixed(2)} ${currency}`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Date & Time (DD/MM/YYYY) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {t('common.date')}
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={dateDisplayStr}
                  onChange={(e) => setDateDisplayStr(e.target.value)}
                  required
                  className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 ${
                    isMobile ? 'py-3 text-base' : 'py-2 text-sm'
                  } text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs font-medium`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  {t('expenses.dateTime')}
                </label>
                <input
                  type="text"
                  placeholder="14:30"
                  value={timeDisplayStr}
                  onChange={(e) => setTimeDisplayStr(e.target.value)}
                  className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 ${
                    isMobile ? 'py-3 text-base' : 'py-2 text-sm'
                  } text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs font-medium`}
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('expenses.category')}
              </label>
              <div className={`grid ${isMobile ? 'grid-cols-3 gap-2.5' : 'grid-cols-3 gap-2'}`}>
                {Object.values(CATEGORIES).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`${
                      isMobile
                        ? 'py-3 px-2 rounded-2xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1.5'
                        : 'p-2 rounded-xl text-xs font-bold flex items-center gap-1.5'
                    } border transition-all active:scale-95 ${
                      category === cat.id
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className={isMobile ? 'text-2xl' : 'text-base'}>{cat.emoji}</span>
                    <span className="truncate">{cat.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payer Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t('expenses.paidBy')}
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className={`w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all shadow-xs ${
                  isMobile ? 'py-3 text-base' : 'py-2 text-sm'
                }`}
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || t('common.friend')} {m.user_id === currentUser?.id ? `(${t('common.you')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Split Mode & Participants / Itemized Split */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {splitByItems ? t('expenses.itemizedSplitTitle') : `${t('expenses.splitBetween')} (${selectedParticipants.length}/${members.length})`}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (splitByItems) {
                        setSplitByItems(false);
                      } else {
                        setSplitByItems(true);
                        if (lineItems.length === 0 && parseEuropeanAmount(amountStr) > 0) {
                          setLineItems([
                            {
                              id: generateUUID(),
                              description: title.trim() || 'Ticket',
                              price: parseEuropeanAmount(amountStr),
                              assignedUserIds: [],
                            },
                          ]);
                        }
                      }
                    }}
                    className={`${isMobile ? 'text-xs' : 'text-[11px]'} font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{splitByItems ? (t('expenses.switchToNormalSplit') || 'Reparto estándar') : t('expenses.splitByItemsToggle')}</span>
                  </button>
                  {!splitByItems && (
                    <button
                      type="button"
                      onClick={() => setSelectedParticipants(members.map((m) => m.user_id))}
                      className={`${isMobile ? 'text-xs' : 'text-[11px]'} font-bold text-emerald-600 hover:underline cursor-pointer`}
                    >
                      {t('expenses.selectAll')}
                    </button>
                  )}
                </div>
              </div>

              {splitByItems ? (
                <ItemizedSplitEditor
                  items={lineItems}
                  onChange={setLineItems}
                  members={members}
                  totalInvoiceAmount={parseEuropeanAmount(amountStr)}
                  currency={currency}
                  defaultTaxName={taxName}
                  taxIncluded={taxIncluded}
                  taxAmount={taxAmount}
                  invoiceType={invoiceType}
                  taxLegislation={taxLegislation}
                  isEurope={isEurope}
                  isTaxReadOnly={true}
                  isMobileView={isMobile}
                  onBalanceChange={setIsItemsBalanced}
                />
              ) : (
                <div className={`flex flex-wrap gap-2 ${isMobile ? 'max-h-36 p-2' : 'max-h-28 p-1.5'} overflow-y-auto bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800`}>
                  {members.map((m) => {
                    const isSelected = selectedParticipants.includes(m.user_id);
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => handleToggleParticipant(m.user_id)}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Avatar profile={m.profile} size="sm" className="w-5 h-5 text-[9px]" />
                        <span className="truncate max-w-[120px]">{m.profile?.full_name?.split(' ')[0] || t('common.friend')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-700 dark:text-rose-300 font-semibold">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          {isMobile ? (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="w-12 h-12 flex items-center justify-center rounded-2xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 active:scale-95 shrink-0 transition-all cursor-pointer"
                title={t('expenses.discardReceipt')}
                aria-label={t('expenses.discardReceipt')}
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 flex-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-12 h-12 flex items-center justify-center rounded-2xl text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 shrink-0 transition-all cursor-pointer"
                  title={t('common.close')}
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (splitByItems && !isItemsBalanced)}
                  title={splitByItems && !isItemsBalanced ? (t('expenses.itemizedBalanceMismatch') || 'El desglose no cuadra con el importe total') : undefined}
                  className="flex-1 py-3.5 px-4 rounded-2xl font-black text-sm sm:text-base text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  <span>{t('expenses.confirmAndCreateExpense')}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('expenses.discardReceipt')}
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                  {t('common.close')}
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || (splitByItems && !isItemsBalanced)}
                  title={splitByItems && !isItemsBalanced ? (t('expenses.itemizedBalanceMismatch') || 'El desglose no cuadra con el importe total') : undefined}
                  className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  {t('expenses.confirmAndCreateExpense')}
                </Button>
              </div>
            </>
          )}
        </div>
      </form>

      <ReceiptModal
        isOpen={Boolean(zoomModalUrl)}
        onClose={() => setZoomModalUrl(null)}
        receiptUrl={zoomModalUrl}
        receiptTranslatedUrl={pendingScan?.translated_image || pendingScan?.scanned_data?.receiptTranslatedUrl || null}
        title={title || t('expenses.censoredReceipt')}
      />
    </Modal>
  );
};
