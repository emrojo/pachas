'use client';

import React from 'react';
import { useDevicePlatform } from '@/hooks/useDevicePlatform';
import { MobileProfileView } from '@/components/mobile/MobileProfileView';
import { WebProfileView } from '@/components/web/WebProfileView';

/**
 * Adaptive Profile Route
 * Dispatches to MobileProfileView (touch-first, large fonts, icon-only buttons, unified header/footer)
 * or WebProfileView (desktop layout, multi-card layout, detailed buttons) based on device & preferences.
 */
export default function ProfilePage() {
  const { isMobile, setViewMode } = useDevicePlatform();

  if (isMobile) {
    return <MobileProfileView onSwitchToWeb={() => setViewMode('web')} />;
  }

  return <WebProfileView onSwitchToMobile={() => setViewMode('mobile')} />;
}
