'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, CloudOff } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

export const ServiceWorkerRegister: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // 1. Register Service Worker reliably
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Check for updates
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('PWA: Nueva versión disponible en caché.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('PWA: No se pudo registrar el Service Worker:', err);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 2. Offline / Online network listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  if (!isOffline) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-amber-500/95 text-slate-950 font-medium text-xs shadow-lg shadow-amber-500/25 backdrop-blur-xs border border-amber-400 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none select-none"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-slate-950 animate-pulse" />
      <span>{t('offline.banner') || 'Modo sin conexión: guardando cambios localmente'}</span>
      <CloudOff className="w-3.5 h-3.5 shrink-0 opacity-75" />
    </aside>
  );
};
