'use client';

import { useEffect } from 'react';
import { usePachas } from '@/context/PachasContext';

export function PwaRegistrar() {
  const { syncPendingQueue, isOnline } = usePachas();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('PWA Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  // When regaining internet connection, automatically process the sync queue
  useEffect(() => {
    if (isOnline) {
      syncPendingQueue();
    }
  }, [isOnline, syncPendingQueue]);

  return null;
}
