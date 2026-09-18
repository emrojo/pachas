'use client';

import React, { useEffect } from 'react';
import { initNativeMobileApp } from '@/lib/native/nativeApp';
import { MobileBottomNav, MobileNavTab } from './MobileBottomNav';

export interface MobileShellProps {
  children: React.ReactNode;
  activeTab?: MobileNavTab;
  onTabChange?: (tab: MobileNavTab) => void;
  showBottomNav?: boolean;
  className?: string;
}

export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  onTabChange,
  showBottomNav = true,
  className = '',
}) => {
  useEffect(() => {
    initNativeMobileApp();
  }, []);

  return (
    <div
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col ${className}`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className={`flex-1 flex flex-col ${showBottomNav ? 'pb-20' : ''}`}>
        {children}
      </div>

      {showBottomNav && activeTab && onTabChange && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </div>
  );
};
