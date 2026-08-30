'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { CATEGORIES } from '@/lib/categories';
import { SUPPORTED_CURRENCIES, formatMoney, parseEuropeanAmount } from '@/lib/currencies';
import { ExpenseCategory, PendingReceiptScan, SplitType } from '@/types/database';
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
  Undo2,
  AlertTriangle,
  CreditCard,
  Building,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface ReceiptValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingScan: PendingReceiptScan | null;
  groupId: string;
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
    const h = isoMatch[4] || pad(now.getHours());
    const min = isoMatch[5] || pad(now.getMinutes());
    return { dateStr: `${d}/${m}/${y}`, timeStr: `${h}:${min}` };
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
  const parts = (dateStr || '').trim().split(/[\/\.-]/);
  let d = 1, m = 1, y = new Date().getFullYear();
  if (parts.length >= 3) {
    d = parseInt(parts[0], 10) || 1;
    m = parseInt(parts[1], 10) || 1;
    y = parseInt(parts[2], 10) || y;
    if (y < 100) y += 2000;
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
}) => {
  const { getGroup, getGroupMembers, currentUser, confirmPendingScan, dismissPendingScan } = usePachas();
  const { t } = useTranslation();

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Canvas extra redaction states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'brush' | 'box'>('brush');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapshotBeforeBox, setSnapshotBeforeBox] = useState<ImageData | null>(null);

  // Initialize form fields and canvas when pendingScan changes
  useEffect(() => {
    if (!isOpen || !pendingScan) return;

    const data = pendingScan.scanned_data || {};
    setTitle(data.title || 'Ticket escaneado');
    setAmountStr(data.amountFormatted || (typeof data.amount === 'number' ? String(data.amount) : ''));
    setCurrency(data.currency || group?.base_currency || 'EUR');
    setCategory(data.category || 'food');

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

    // Render image on canvas and apply sensitiveBoxes auto-censoring
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pendingScan.original_image;

    img.onload = () => {
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

        // Apply auto-detected sensitive bounding boxes from AI
        const sensitiveBoxes = data.sensitiveBoxes || [];
        if (sensitiveBoxes.length > 0) {
          ctx.fillStyle = '#000000';
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

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(coords);

    if (drawMode === 'brush') {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      setSnapshotBeforeBox(ctx.getImageData(0, 0, canvas.width, canvas.height));
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
    }
  };

  const handleEndDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPoint(null);
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

  const handleDismiss = () => {
    if (!pendingScan) return;
    if (confirm('¿Descartar este ticket escaneado? No se creará ningún gasto en el grupo.')) {
      dismissPendingScan(pendingScan.id);
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

    try {
      setIsSubmitting(true);
      setError('');

      // Get finalized censored image data from canvas
      const canvas = canvasRef.current;
      const finalReceiptUrl = canvas ? canvas.toDataURL('image/jpeg', 0.85) : pendingScan.original_image;

      const expenseDate = combineEuropeanDateTimeToISO(dateDisplayStr, timeDisplayStr);

      await confirmPendingScan(pendingScan.id, {
        groupId,
        title: title.trim(),
        amount: parsedAmt,
        currency,
        category,
        expenseDate,
        receiptUrl: finalReceiptUrl,
        splitType: 'EQUAL' as SplitType,
        payers: [{ userId: payerId, amountPaid: parsedAmt }],
        selectedParticipantIds: selectedParticipants.length > 0 ? selectedParticipants : [payerId],
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
      onClose={onClose}
      title="Validar Gasto Escaneado con IA"
      description="Revisa los datos extraídos y las censuras automáticas de seguridad antes de crear el gasto"
      maxWidth="xl"
    >
      <form onSubmit={handleConfirmAndCreate} className="space-y-5">
        {/* DISCLAIMER DE PRIVACIDAD & RESPONSABILIDAD */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Aviso de Privacidad y Responsabilidad</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            Revisa con atención la información visible en la factura. Recuerda que <strong>todos los miembros del grupo podrán ver este recibo</strong>. Pachas no se hace responsable de los datos personales o bancarios compartidos dentro del grupo. Asegúrate de que las tarjetas o datos privados queden censurados.
          </p>
        </div>

        {/* 2-COLUMN LAYOUT: CANCELS/CENSURA A LA IZQUIERDA, CAMPOS A LA DERECHA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Canvas Preview & Extra Censor Tools */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                Ticket Censurado
              </span>

              {/* Toolbar Mini */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDrawMode('brush')}
                  className={`p-1.5 rounded-lg text-xs font-bold ${
                    drawMode === 'brush' ? 'bg-black text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                  title="Rotulador negro"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDrawMode('box')}
                  className={`p-1.5 rounded-lg text-xs font-bold ${
                    drawMode === 'box' ? 'bg-black text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                  title="Caja de censura"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={history.length <= 1}
                  className="p-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 disabled:opacity-40"
                  title="Deshacer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative max-h-[380px] overflow-auto rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 touch-none shadow-inner">
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
            </div>
            <span className="text-[10px] text-slate-400 block text-center">
              Trazos negros aplicados sobre datos de tarjeta y cuentas detectados
            </span>
          </div>

          {/* Right Column: Extracted Fields Review */}
          <div className="lg:col-span-7 space-y-4">
            {/* Title / Merchant */}
            <Input
              label="Concepto / Establecimiento *"
              placeholder="Ej. Mercadona, Restaurante El Faro..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {/* Amount & Currency */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Importe Total *"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Moneda
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Time (DD/MM/YYYY) */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha (DD/MM/AAAA) *"
                placeholder="DD/MM/AAAA"
                value={dateDisplayStr}
                onChange={(e) => setDateDisplayStr(e.target.value)}
                required
              />
              <Input
                label="Hora (HH:mm)"
                placeholder="14:30"
                value={timeDisplayStr}
                onChange={(e) => setTimeDisplayStr(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Categoría
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(CATEGORIES).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                      category === cat.id
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500 ring-1 ring-emerald-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payer Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Pagado por
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.full_name || 'Amigo'} {m.user_id === currentUser?.id ? '(Tú)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Participants */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Dividir entre ({selectedParticipants.length}/{members.length})
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedParticipants(members.map((m) => m.user_id))}
                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                >
                  Seleccionar todos
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                {members.map((m) => {
                  const isSelected = selectedParticipants.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => handleToggleParticipant(m.user_id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Avatar profile={m.profile} size="sm" className="w-4 h-4 text-[8px]" />
                      <span className="truncate max-w-[100px]">{m.profile?.full_name?.split(' ')[0] || 'Amigo'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Descartar ticket
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cerrar
            </Button>
            <Button
              type="submit"
              variant="brand"
              isLoading={isSubmitting}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              Confirmar y Crear Gasto
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
