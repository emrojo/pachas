'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { triggerHaptic } from '@/lib/native/haptics';
import { Receipt, Users, Settings } from 'lucide-react';

export type MobileNavTab = 'expenses' | 'groups' | 'options';

export interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onTabChange: (tab: MobileNavTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();

  const handleTabClick = (tab: MobileNavTab) => {
    triggerHaptic('light');
    onTabChange(tab);
  };

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-3 py-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleTabClick('expenses')}
          title={t('dashboard.tabExpenses') || 'Gastos'}
          aria-label={t('dashboard.tabExpenses') || 'Gastos'}
          className={`h-14 flex items-center justify-center rounded-2xl transition-all cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <Receipt className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('groups')}
          title={t('dashboard.tabGroups') || 'Grupos'}
          aria-label={t('dashboard.tabGroups') || 'Grupos'}
          className={`h-14 flex items-center justify-center rounded-2xl transition-all cursor-pointer ${
            activeTab === 'groups'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('options')}
          title={t('dashboard.tabOptions') || 'Opciones'}
          aria-label={t('dashboard.tabOptions') || 'Opciones'}
          className={`h-14 flex items-center justify-center rounded-2xl transition-all cursor-pointer ${
            activeTab === 'options'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
        </button>
      </div>
    </footer>
  );
};
