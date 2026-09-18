'use client';

import { useState, useEffect, useCallback } from 'react';
import { safeGetLocalStorage, safeSetLocalStorage } from '@/context/PachasContext';

export type PlatformType = 'ios' | 'android' | 'web';
export type ViewMode = 'auto' | 'mobile' | 'web';

const VIEW_MODE_STORAGE_KEY = 'pachas_preferred_view_mode';

export function useDevicePlatform() {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isNative, setIsNative] = useState<boolean>(false);
  const [platform, setPlatform] = useState<PlatformType>('web');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(false);
  const [preferredMode, setPreferredMode] = useState<ViewMode>('auto');

  // Detect Capacitor native platform and device specs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Detect Capacitor native bridge
    const cap = (window as any).Capacitor;
    const native = Boolean(cap?.isNativePlatform?.());
    setIsNative(native);

    if (native) {
      const capPlatform = cap?.getPlatform?.();
      if (capPlatform === 'ios') setPlatform('ios');
      else if (capPlatform === 'android') setPlatform('android');
      else setPlatform('web');
    } else {
      // Check user agent for mobile OS in browser
      const ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod/.test(ua)) setPlatform('ios');
      else if (/android/i.test(ua)) setPlatform('android');
      else setPlatform('web');
    }

    // 2. Read user override from localStorage
    const saved = safeGetLocalStorage(VIEW_MODE_STORAGE_KEY) as ViewMode | null;
    if (saved && (saved === 'auto' || saved === 'mobile' || saved === 'web')) {
      setPreferredMode(saved);
    }

    // 3. Detect viewport width (mobile breakpoint < 768px - md)
    const checkViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    setIsReady(true);

    return () => {
      window.removeEventListener('resize', checkViewport);
    };
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setPreferredMode(mode);
    if (mode === 'auto') {
      try {
        if (typeof window !== 'undefined') {
          (window as any).localStorage?.removeItem?.(VIEW_MODE_STORAGE_KEY);
        }
      } catch {}
    } else {
      safeSetLocalStorage(VIEW_MODE_STORAGE_KEY, mode);
    }
  }, []);

  // Determine effective mobile mode:
  // - If manually set to 'mobile', always true
  // - If manually set to 'web', always false (unless in native app, where mobile UX is preferred)
  // - If 'auto', true when native app OR mobile viewport
  const isMobile = preferredMode === 'mobile'
    ? true
    : preferredMode === 'web'
    ? (isNative ? true : false)
    : (isNative || isMobileViewport);

  return {
    isReady,
    isNative,
    platform,
    isMobileViewport,
    preferredMode,
    isMobile,
    isDesktop: !isMobile,
    setViewMode,
  };
}
