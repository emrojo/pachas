'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { ShareReceiveModal } from '@/components/share/ShareReceiveModal';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface SharedFileInfo {
  dataUrl: string;
  fileName: string;
  isPdf: boolean;
}

function ShareReceiveContent() {
  const router = useRouter();
  const { currentUser, isLoading } = usePachas();

  const [sharedFile, setSharedFile] = useState<SharedFileInfo | null>(null);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'no-file' | 'no-auth'>(
    'loading'
  );

  // ── Redirect unauthenticated users ──────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !currentUser) {
      // Save the fact that we have a pending share so we can resume after login
      try {
        sessionStorage.setItem('pachas-share-pending', 'true');
      } catch {}
      router.replace('/login?redirectTo=/share-receive');
    }
  }, [currentUser, isLoading, router]);

  // ── Read shared file data ────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !currentUser) return;

    const loadSharedFile = async () => {
      // 1. Try Cache API (written by the SW share_target handler)
      try {
        if (typeof window !== 'undefined' && 'caches' in window) {
          const cache = await caches.open('pachas-offline-v2');
          const cached = await cache.match('/share-receive-data');
          if (cached) {
            const json = await cached.json();
            await cache.delete('/share-receive-data'); // consume once
            if (json?.success && json?.dataUrl) {
              setSharedFile({
                dataUrl: json.dataUrl,
                fileName: json.fileName ?? 'archivo',
                isPdf: json.isPdf ?? false,
              });
              setPageStatus('ready');
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[share-receive] Cache read error:', err);
      }

      // 2. Try sessionStorage (legacy fallback)
      try {
        if (typeof window !== 'undefined') {
          const stored = sessionStorage.getItem('pachas-shared-file');
          if (stored) {
            try {
              const parsed: SharedFileInfo = JSON.parse(stored);
              sessionStorage.removeItem('pachas-shared-file');
              setSharedFile(parsed);
              setPageStatus('ready');
              return;
            } catch {
              sessionStorage.removeItem('pachas-shared-file');
            }
          }
        }
      } catch {}

      // 3. Try Capacitor native intent (receive-sharing-intent plugin)
      try {
        if (
          typeof window !== 'undefined' &&
          (window as any).Capacitor?.isNativePlatform?.()
        ) {
          const ReceiveSharingIntent = (window as any).Capacitor?.Plugins?.ReceiveSharingIntent;
          if (ReceiveSharingIntent) {
            const result = await ReceiveSharingIntent.getReceivedFiles();
            const items = result?.sharedFiles ?? result?.files ?? [];
            if (items.length > 0) {
              const item = items[0];
              const mimeType: string = item.type ?? item.mimeType ?? 'image/jpeg';
              const isPdf = mimeType.includes('pdf');
              let dataUrl: string = item.contentUri ?? item.url ?? '';
              if (!dataUrl.startsWith('data:')) {
                // Convert file URI to base64 via Capacitor Filesystem
                const Filesystem = (window as any).Capacitor?.Plugins?.Filesystem;
                if (Filesystem) {
                  const read = await Filesystem.readFile({ path: dataUrl });
                  dataUrl = `data:${mimeType};base64,${read.data}`;
                }
              }
              setSharedFile({
                dataUrl,
                fileName: item.fileName ?? item.subject ?? 'archivo compartido',
                isPdf,
              });
              setPageStatus('ready');
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[share-receive] Capacitor intent error:', err);
      }

      // Nothing found
      setPageStatus('no-file');
    };

    loadSharedFile();
  }, [currentUser, isLoading]);


  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading || pageStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-sm">Procesando archivo compartido…</p>
        </div>
      </div>
    );
  }

  if (pageStatus === 'no-file') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="text-center space-y-3">
          <p className="text-2xl">🗂️</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No se encontró ningún archivo compartido.
          </p>
          <p className="text-xs text-slate-500">
            Comparte un PDF o imagen desde otra app y elige Pachas como destino.
          </p>
          <button
            onClick={() => router.replace('/dashboard')}
            className="mt-4 text-sm font-medium text-emerald-600 hover:underline"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {sharedFile && (
        <ShareReceiveModal
          file={sharedFile}
          onClose={() => router.replace('/dashboard')}
        />
      )}
    </div>
  );
}

export default function ShareReceivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            <p className="text-sm">Cargando...</p>
          </div>
        </div>
      }
    >
      <ShareReceiveContent />
    </Suspense>
  );
}
