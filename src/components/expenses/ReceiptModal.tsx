'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import {
  ExternalLink,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  Move,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  title: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  title,
}) => {
  const { t } = useTranslation();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const initialTouchDistanceRef = useRef<number | null>(null);

  // Reset transform whenever modal opens or image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setIsFullscreen(false);
    }
  }, [isOpen, receiptUrl]);

  if (!receiptUrl) return null;

  // Zoom helpers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.35, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.35, 0.6);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (zoom > 1.2) {
      handleReset();
    } else {
      setZoom(2.2);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.2, 4));
    } else {
      setZoom((prev) => {
        const next = Math.max(prev - 0.2, 0.6);
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse Drag / Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers (drag + pinch zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && initialTouchDistanceRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialTouchDistanceRef.current;
      setZoom((prev) => Math.min(Math.max(prev * factor, 0.6), 4));
      initialTouchDistanceRef.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    initialTouchDistanceRef.current = null;
  };

  const handleOpenNewTab = () => {
    if (!receiptUrl) return;

    if (receiptUrl.startsWith('data:')) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${title || 'Comprobante de Gasto'} - Pachas</title>
              <style>
                body {
                  margin: 0;
                  background-color: #090d16;
                  color: #f8fafc;
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 16px;
                  box-sizing: border-box;
                }
                .bar {
                  margin-bottom: 16px;
                  font-size: 15px;
                  font-weight: 700;
                  color: #34d399;
                  text-align: center;
                  letter-spacing: 0.02em;
                }
                .container {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #020617;
                  padding: 12px;
                  border-radius: 16px;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                  max-width: 95vw;
                  max-height: 88vh;
                }
                img {
                  max-width: 100%;
                  max-height: 85vh;
                  object-fit: contain;
                  border-radius: 10px;
                }
              </style>
            </head>
            <body>
              <div class="bar">🧾 ${title || 'Ticket / Comprobante'}</div>
              <div class="container">
                <img src="${receiptUrl}" alt="${title || 'Ticket'}" />
              </div>
            </body>
          </html>
        `);
        win.document.close();
        return;
      }
    }

    window.open(receiptUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!receiptUrl) return;
    const a = document.createElement('a');
    a.href = receiptUrl;
    const safeTitle = (title || 'ticket').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `pachas_ticket_${safeTitle}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('expenses.receiptPhoto') || 'Comprobante'}: ${title}`}
      description="Inspecciona la imagen y haz zoom para verificar que no quedan datos sensibles"
      maxWidth={isFullscreen ? 'full' : 'xl'}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Verification banner */}
        <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-medium hidden sm:inline">
              Usa los controles o rueda del ratón para ampliar y arrastrar la imagen
            </span>
            <span className="text-[11px] font-medium sm:hidden">
              Pellizca para zoom y arrastra
            </span>
          </div>

          {/* Interactive Zoom Controls Bar */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Reducir (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono font-bold min-w-[42px] text-center text-slate-700 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Aumentar (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Girar 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Restablecer zoom y posición"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors hidden sm:inline-flex"
              title={isFullscreen ? 'Reducir ventana' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Viewport Canvas / Image Container */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          className={`w-full overflow-hidden rounded-2xl bg-slate-950/95 border border-slate-800 flex items-center justify-center p-3 shadow-inner select-none relative ${
            isFullscreen ? 'h-[75vh]' : 'h-[55vh] sm:h-[62vh]'
          } ${zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              transformOrigin: 'center center',
            }}
            className="flex items-center justify-center max-w-full max-h-full pointer-events-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt={title}
              className="max-h-[50vh] sm:max-h-[58vh] max-w-full object-contain rounded-xl shadow-2xl"
              draggable={false}
            />
          </div>

          {zoom > 1 && (
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-white text-[10px] font-mono flex items-center gap-1 shadow-xs pointer-events-none">
              <Move className="w-3 h-3" />
              <span>Arrastra para moverte</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between w-full gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs font-bold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('expenses.downloadReceipt') || 'Descargar'}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenNewTab}
              className="text-xs font-bold gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('expenses.viewReceipt') || 'Pestaña nueva'}</span>
            </Button>
          </div>

          <Button variant="brand" size="sm" onClick={onClose} className="text-xs font-bold px-4">
            {t('common.close') || 'Cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
