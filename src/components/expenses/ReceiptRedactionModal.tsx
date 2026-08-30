'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/context/LanguageContext';
import {
  Paintbrush,
  Square,
  Undo2,
  Trash2,
  Sparkles,
  Shield,
  Check,
  X,
  Eye,
  Info,
} from 'lucide-react';

export interface ReceiptRedactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onConfirmRedaction: (censoredDataUrl: string) => void | Promise<void>;
}

type DrawMode = 'brush' | 'box';
type BrushSize = 'sm' | 'md' | 'lg';

export const ReceiptRedactionModal: React.FC<ReceiptRedactionModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onConfirmRedaction,
}) => {
  const { t } = useTranslation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>('brush');
  const [brushSize, setBrushSize] = useState<BrushSize>('md');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapshotBeforeBox, setSnapshotBeforeBox] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const strokeWidths: Record<BrushSize, number> = {
    sm: 10,
    md: 20,
    lg: 36,
  };

  // Load and render original image onto canvas
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

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
        // Save initial clean state to history
        const initialData = ctx.getImageData(0, 0, w, h);
        setHistory([initialData]);
      }
    };
  }, [isOpen, imageSrc]);

  // Coordinate helper relative to canvas scale
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
      ctx.lineWidth = strokeWidths[brushSize];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (drawMode === 'box') {
      // Save state before drawing rectangle preview
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
      // Restore before drawing current box preview
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
      setHistory((prev) => [...prev.slice(-15), current]);
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const previous = newHistory[newHistory.length - 1];

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(newHistory);
    }
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const first = history[0];
    if (canvas && ctx && first) {
      ctx.putImageData(first, 0, 0);
      setHistory([first]);
    }
  };

  const handleConfirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsProcessing(true);
      const censoredDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      await onConfirmRedaction(censoredDataUrl);
      onClose();
    } catch (err) {
      console.warn('Error confirming redaction:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Censurar Factura / Ticket"
      description="Tacha con el rotulador negro cualquier dato privado antes de enviar a la IA"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-bold text-amber-300">
              Privacidad Garantizada: Censura previa con rotulador negro
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Tacha cualquier información privada (nombres, direcciones o datos personales) que <strong>NO</strong> quieras que el servicio de IA procese. Lo que tapes quedará cubierto por píxeles negros reales.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          {/* Tool Modes */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDrawMode('brush')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'brush'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Rotulador Negro</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawMode('box')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'box'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>Rectángulo</span>
            </button>
          </div>

          {/* Stroke Widths */}
          {drawMode === 'brush' && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
              <span className="text-[10px] font-bold text-slate-400 px-1.5">Grosor:</span>
              <button
                type="button"
                onClick={() => setBrushSize('sm')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'sm' ? 'bg-black text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Fino
              </button>
              <button
                type="button"
                onClick={() => setBrushSize('md')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'md' ? 'bg-black text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Medio
              </button>
              <button
                type="button"
                onClick={() => setBrushSize('lg')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'lg' ? 'bg-black text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Grueso
              </button>
            </div>
          )}

          {/* Action Tools: Undo / Clear */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleUndo}
              className="p-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              title="Deshacer último trazo"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleClearAll}
              className="p-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1"
              title="Limpiar todas las censuras"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div
          ref={containerRef}
          className="relative max-h-[55vh] overflow-auto rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 select-none touch-none shadow-inner"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleStartDraw}
            onMouseMove={handleMoveDraw}
            onMouseUp={handleEndDraw}
            onMouseLeave={handleEndDraw}
            onTouchStart={handleStartDraw}
            onTouchMove={handleMoveDraw}
            onTouchEnd={handleEndDraw}
            className="max-w-full h-auto cursor-crosshair rounded-lg shadow-md touch-none"
          />
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
            {t('common.cancel')}
          </Button>

          <Button
            type="button"
            variant="brand"
            isLoading={isProcessing}
            onClick={handleConfirm}
            className="text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Procesar en segundo plano 🚀</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
