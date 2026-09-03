'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/context/LanguageContext';
import {
  Paintbrush,
  Square,
  Eraser,
  Undo2,
  Trash2,
  Sparkles,
  Shield,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Move,
  Hand,
} from 'lucide-react';

export interface ReceiptRedactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onConfirmRedaction: (censoredDataUrl: string) => void | Promise<void>;
}

type DrawMode = 'brush' | 'box' | 'eraser' | 'pan';
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
  const baseImageRef = useRef<HTMLImageElement | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>('brush');
  const [brushSize, setBrushSize] = useState<BrushSize>('md');
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [snapshotBeforeBox, setSnapshotBeforeBox] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const strokeWidths: Record<BrushSize, number> = {
    sm: 12,
    md: 24,
    lg: 42,
  };

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDrawMode('brush');
    }
  }, [isOpen]);

  // Load and render original image onto canvas
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      baseImageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxDim = 1400;
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

  // Erase function that restores base image pixels cleanly
  const erasePoint = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!baseImageRef.current) return;
    const radius = strokeWidths[brushSize] / 2;
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
    const radius = strokeWidths[brushSize] / 2;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (radius / 2)));
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
    if (drawMode === 'pan') {
      setIsPanning(true);
      let clientX = 0, clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }

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
      ctx.lineWidth = strokeWidths[brushSize];
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
    if (drawMode === 'pan' && isPanning) {
      let clientX = 0, clientY = 0;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      setPan({ x: clientX - panStart.x, y: clientY - panStart.y });
      return;
    }

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
    if (isPanning) {
      setIsPanning(false);
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    setStartPoint(null);
    setLastPoint(null);
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
    newHistory.pop();
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

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 3.5));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.35, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
      title={t('expenses.redactReceiptTitle')}
      description={t('expenses.redactReceiptSubtitle')}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 flex items-start gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-bold text-amber-300">
              {t('expenses.privacyGuaranteed')}
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {t('expenses.redactionInstructions')}
            </p>
          </div>
        </div>

        {/* Toolbar Complete */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          {/* Drawing Tool Modes */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setDrawMode('brush')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'brush'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={t('expenses.blackMarker')}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>{t('expenses.toolBrush')}</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawMode('box')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'box'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={t('expenses.redactionBox')}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t('expenses.toolBox')}</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawMode('eraser')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'eraser'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={t('expenses.redactionEraser')}
            >
              <Eraser className="w-3.5 h-3.5 text-rose-300" />
              <span>{t('expenses.toolEraser')}</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawMode('pan')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                drawMode === 'pan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title={t('expenses.toolPan')}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>{t('expenses.toolPan')}</span>
            </button>
          </div>

          {/* Stroke Widths */}
          {(drawMode === 'brush' || drawMode === 'eraser') && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
              <span className="text-[10px] font-bold text-slate-400 px-1">{t('expenses.brushSizeLabel')}</span>
              <button
                type="button"
                onClick={() => setBrushSize('sm')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'sm' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('expenses.brushSizeFine')}
              </button>
              <button
                type="button"
                onClick={() => setBrushSize('md')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'md' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('expenses.brushSizeMedium')}
              </button>
              <button
                type="button"
                onClick={() => setBrushSize('lg')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  brushSize === 'lg' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t('expenses.brushSizeThick')}
              </button>
            </div>
          )}

          {/* Zoom Controls & Undo/Clear */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-700 dark:text-slate-300"
                title="Reducir zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="text-[10px] font-mono font-bold min-w-[36px] text-center text-slate-700 dark:text-slate-300">
                {Math.round(zoom * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-700 dark:text-slate-300"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {zoom > 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                  title="Restablecer zoom al 100%"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleUndo}
              className="p-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Deshacer último trazo"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={history.length <= 1}
              onClick={handleClearAll}
              className="p-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 disabled:pointer-events-none transition-all"
              title="Limpiar todas las censuras"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Workspace with Zoom & Pan */}
        <div
          ref={containerRef}
          className="relative max-h-[55vh] h-[50vh] sm:h-[55vh] overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2 select-none touch-none shadow-inner"
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
            className="flex items-center justify-center max-w-full max-h-full"
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
              className={`max-w-full max-h-[48vh] h-auto rounded-lg shadow-md touch-none ${
                drawMode === 'pan'
                  ? isPanning
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
                  : drawMode === 'eraser'
                  ? 'cursor-cell'
                  : 'cursor-crosshair'
              }`}
            />
          </div>

          {zoom > 1 && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono flex items-center gap-1 shadow-xs pointer-events-none">
              <Move className="w-3 h-3 text-emerald-400" />
              <span>Zoom {Math.round(zoom * 100)}% activo</span>
            </div>
          )}
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
            <span>{t('expenses.processInBackground')} 🚀</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
