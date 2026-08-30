'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { ShareReceiveModal } from '@/components/share/ShareReceiveModal';
import { Loader2 } from 'lucide-react';

/**
 * /share-receive
 *
 * Acts as the landing page for two share flows:
 *
 * A. PWA Web Share Target (Chrome Android)
 *    The browser POSTs multipart/form-data to /share-receive (as declared in
 *    manifest.json share_target). Next.js does NOT run route handlers for the
 *    root page method, so we intercept it client-side: the page mounts, reads
 *    the POST body via a fetch to /api/share-receive (forwarded in useEffect),
 *    and stores the result in sessionStorage for the modal.
 *
 *    In practice Chrome Android POSTs and then loads the page GET, so we use
 *    a small service worker trick: the SW intercepts the POST, stores the file
 *    data in the Cache API, responds with a redirect to GET /share-receive, and
 *    this page reads from that cache via /api/share-receive.
 *
 *    For simplicity (no custom SW needed) we use the sessionStorage approach:
 *    the API route at /api/share-receive receives the POST, serialises the file
 *    to JSON, and redirects to /share-receive?from=api. This page reads from
 *    sessionStorage key "pachas-shared-file" written by the SW redirect.
 *
 * B. Capacitor Native (Android intent / iOS Share Extension)
 *    The Capacitor plugin @capacitor-community/receive-sharing-intent fires
 *    the receivedFiles event, which is consumed by the PachasContext and stored
 *    in a global state. This page reads it and shows the modal.
 *
 * Implementation note for the PWA case:
 *   We use the simplest pattern that does NOT require a custom service worker:
 *   the manifest share_target points to /share-receive with method POST.
 *   Chrome Android will load /share-receive and attach the file data. Since
 *   Next.js page routes do not handle POST, Chrome will actually GET the page
 *   after the post (it follows the redirect). We therefore intercept via a
 *   minimal service-worker registration already present in PwaRegistrar
 *   (or we add a dedicated one below). Until then, a simpler approach:
 *
 *   We register a one-time fetch handler in the existing SW (or via a small
 *   inline script) that:
 *     1. Intercepts POST /share-receive
 *     2. Reads FormData
 *     3. POSTs the file to /api/share-receive
 *     4. Stores the JSON response in sessionStorage
 *     5. Redirects to GET /share-receive
 *   This page then reads sessionStorage on mount.
 */

interface SharedFileInfo {
  dataUrl: string;
  fileName: string;
  isPdf: boolean;
}

export default function ShareReceivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isLoading } = usePachas();

  const [sharedFile, setSharedFile] = useState<SharedFileInfo | null>(null);
  const [pageStatus, setPageStatus] = useState<'loading' | 'ready' | 'no-file' | 'no-auth'>(
    'loading'
  );

  // ── Redirect unauthenticated users ──────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !currentUser) {
      // Save the fact that we have a pending share so we can resume after login
      sessionStorage.setItem('pachas-share-pending', 'true');
      router.replace('/login?redirectTo=/share-receive');
    }
  }, [currentUser, isLoading, router]);

  // ── Read shared file data ────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !currentUser) return;

    const loadSharedFile = async () => {
      // 1. Try Cache API (written by the SW share_target handler)
      try {
        if ('caches' in window) {
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

      // 3. Try Capacitor native intent (receive-sharing-intent plugin)
      try {
        if (
          typeof window !== 'undefined' &&
          (window as any).Capacitor?.isNativePlatform?.()
        ) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error — package only present in native Android/iOS builds
          const { ReceiveSharingIntent } = await import('@capacitor-community/receive-sharing-intent');
          const result = await ReceiveSharingIntent.getReceivedFiles();
          const items = result?.sharedFiles ?? result?.files ?? [];
          if (items.length > 0) {
            const item = items[0];
            const mimeType: string = item.type ?? item.mimeType ?? 'image/jpeg';
            const isPdf = mimeType.includes('pdf');
            let dataUrl: string = item.contentUri ?? item.url ?? '';
            if (!dataUrl.startsWith('data:')) {
              // Convert file URI to base64 via Capacitor Filesystem
              const { Filesystem } = await import('@capacitor/filesystem');
              const read = await Filesystem.readFile({ path: dataUrl });
              dataUrl = `data:${mimeType};base64,${read.data}`;
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
