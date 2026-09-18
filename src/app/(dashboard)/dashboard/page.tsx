'use client';

import React from 'react';
import { useDevicePlatform } from '@/hooks/useDevicePlatform';
import { MobileDashboardView } from '@/components/mobile/MobileDashboardView';
import { WebDashboardView } from '@/components/web/WebDashboardView';

/**
 * Adaptive Dashboard Route
 * Seamlessly dispatches to the Mobile Application view (touch-first, bottom bar, safe-areas)
 * or Web Desktop view (multi-column grid, navbar, dense tools) based on device & preferences,
 * keeping both architectures completely decoupled.
 */
export default function DashboardPage() {
  const { isMobile, setViewMode } = useDevicePlatform();

  if (isMobile) {
    return <MobileDashboardView onSwitchToWeb={() => setViewMode('web')} />;
  }

  return <WebDashboardView onSwitchToMobile={() => setViewMode('mobile')} />;
}
