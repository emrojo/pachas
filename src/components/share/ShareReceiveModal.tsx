'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImageIcon, Upload, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { usePachas } from '@/context/PachasContext';
import { Button } from '@/components/ui/Button';
import { Group } from '@/types/database';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'idle' | 'converting' | 'scanning' | 'done' | 'error';

interface SharedFileInfo {
  dataUrl: string;   // base64 data URL (image or first page of PDF rendered to canvas)
  fileName: string;
  isPdf: boolean;
}

interface Props {
  /** Raw shared file from the OS/browser. */
  file: SharedFileInfo;
  /** Dismiss the modal (e.g. user pressed X). */
  onClose: () => void;
}

// ─── PDF → image conversion via pdfjs-dist ────────────────────────────────────

async function renderFirstPdfPageAsDataUrl(pdfDataUrl: string): Promise<string> {
  // Lazy-load pdfjs-dist to keep main bundle light
  const pdfjsLib = await import('pdfjs-dist');
  // Point the worker at the CDN version that matches the installed package
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

  // Strip the data URL header to get raw base64, then decode
  const base64 = pdfDataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);

  // Scale 1.5× to improve OCR accuracy
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return canvas.toDataURL('image/jpeg', 0.9);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShareReceiveModal({ file, onClose }: Props) {
  const router = useRouter();
  const { groups, scanAndCreateExpenseAsync } = usePachas();

  // Only show non-archived groups
  const activeGroups = groups.filter((g) => !g.is_archived);

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    activeGroups[0]?.id ?? ''
  );
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleScan = useCallback(async () => {
    if (!selectedGroupId) return;

    setStatus('converting');
    setErrorMsg('');

    try {
      // 1. If PDF, render first page to image for OCR
      let imageDataUrl = file.dataUrl;
      if (file.isPdf) {
        imageDataUrl = await renderFirstPdfPageAsDataUrl(file.dataUrl);
      }

      // 2. Scan + create expense
      setStatus('scanning');
      await scanAndCreateExpenseAsync(selectedGroupId, imageDataUrl);

      setStatus('done');

      // 3. Navigate to the group after a brief success moment
      setTimeout(() => {
        router.push(`/groups/${selectedGroupId}`);
      }, 1400);
    } catch (err: any) {
      console.error('[ShareReceiveModal] scan error:', err);
      setErrorMsg(err?.message ?? 'Error al procesar el archivo.');
      setStatus('error');
    }
  }, [file, selectedGroupId, scanAndCreateExpenseAsync, router]);

  // ── UI ──────────────────────────────────────────────────────────────────────

  const isProcessing = status === 'converting' || status === 'scanning';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              {file.isPdf ? (
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ImageIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Factura recibida
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{file.fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status: done */}
          {status === 'done' && (
            <div className="flex flex-col items-center gap-2 py-4 text-emerald-600">
              <CheckCircle2 className="w-12 h-12" />
              <p className="text-sm font-semibold">¡Gasto añadido! Redirigiendo…</p>
            </div>
          )}

          {/* Status: error */}
          {status === 'error' && (
            <div className="flex items-start gap-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs">{errorMsg}</p>
            </div>
          )}

          {/* Status: processing */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-3 py-4 text-slate-500">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
              <p className="text-sm font-medium">
                {status === 'converting'
                  ? 'Convirtiendo PDF a imagen…'
                  : 'Analizando con IA…'}
              </p>
            </div>
          )}

          {/* Status: idle or error (show controls) */}
          {(status === 'idle' || status === 'error') && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Escaneamos el archivo con IA y añadimos el gasto automáticamente. Elige el grupo destino:
              </p>

              {activeGroups.length === 0 ? (
                <p className="text-sm text-slate-500 italic">
                  No tienes grupos activos. Crea uno primero.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {activeGroups.map((g: Group) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroupId(g.id)}
                      className={[
                        'w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all',
                        selectedGroupId === g.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                      ].join(' ')}
                    >
                      <span className="text-xl leading-none">{g.icon_emoji}</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {g.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {(status === 'idle' || status === 'error') && activeGroups.length > 0 && (
          <div className="p-5 pt-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              className="flex-1 gap-2"
              onClick={handleScan}
              disabled={!selectedGroupId}
            >
              <Upload className="w-4 h-4" />
              Escanear y añadir gasto
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
