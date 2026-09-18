'use client';

import React from 'react';
import { useDevicePlatform } from '@/hooks/useDevicePlatform';
import { MobileNotificationsView } from '@/components/mobile/MobileNotificationsView';
import { WebNotificationsView } from '@/components/web/WebNotificationsView';

/**
 * Adaptive Notifications Route
 * Dispatches to MobileNotificationsView (touch-friendly, large typography, icon-only buttons, 3-icon bottom nav)
 * or WebNotificationsView (desktop layout, multi-card banner, detailed action buttons) based on device platform.
 */
export default function NotificationsPage() {
  const { isMobile, setViewMode } = useDevicePlatform();

  if (isMobile) {
    return <MobileNotificationsView onSwitchToWeb={() => setViewMode('web')} />;
  }

  return <WebNotificationsView onSwitchToMobile={() => setViewMode('mobile')} />;
}
