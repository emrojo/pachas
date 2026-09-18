'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { triggerHaptic } from '@/lib/native/haptics';
import { Receipt, Users, Settings, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileNavTab = 'expenses' | 'groups' | 'options';

export interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onTabChange: (tab: MobileNavTab) => void;
  onAddExpenseClick?: () => void;
  hasActiveGroup?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onAddExpenseClick,
  hasActiveGroup = true,
}) => {
  const { t } = useTranslation();

  const handleTabClick = (tab: MobileNavTab) => {
    triggerHaptic('light');
    onTabChange(tab);
  };

  const handleAddClick = () => {
    triggerHaptic('medium');
    if (onAddExpenseClick) {
      onAddExpenseClick();
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
        {/* Tab: Expenses */}
        <button
          type="button"
          onClick={() => handleTabClick('expenses')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 touch-manipulation',
            activeTab === 'expenses'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
          )}
        >
          <Receipt className={cn('w-5 h-5 mb-0.5', activeTab === 'expenses' && 'stroke-[2.5]')} />
          <span className="text-[11px] leading-tight">
            {t('dashboard.tabExpenses') || 'Gastos'}
          </span>
        </button>

        {/* Central Action Button: Add Expense */}
        {hasActiveGroup && onAddExpenseClick && (
          <button
            type="button"
            onClick={handleAddClick}
            className="flex flex-col items-center justify-center -mt-5 px-2 active:scale-90 transition-transform touch-manipulation group"
            aria-label={t('expenses.addExpense')}
          >
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/35 border-2 border-white dark:border-slate-900">
              <PlusCircle className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              {t('expenses.addExpense') || 'Añadir'}
            </span>
          </button>
        )}

        {/* Tab: Groups */}
        <button
          type="button"
          onClick={() => handleTabClick('groups')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 touch-manipulation',
            activeTab === 'groups'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
          )}
        >
          <Users className={cn('w-5 h-5 mb-0.5', activeTab === 'groups' && 'stroke-[2.5]')} />
          <span className="text-[11px] leading-tight">
            {t('dashboard.tabGroups') || 'Grupos'}
          </span>
        </button>

        {/* Tab: Options / Settings */}
        <button
          type="button"
          onClick={() => handleTabClick('options')}
          className={cn(
            'flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all active:scale-95 touch-manipulation',
            activeTab === 'options'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
          )}
        >
          <Settings className={cn('w-5 h-5 mb-0.5', activeTab === 'options' && 'stroke-[2.5]')} />
          <span className="text-[11px] leading-tight">
            {t('dashboard.tabOptions') || 'Opciones'}
          </span>
        </button>
      </div>
    </nav>
  );
};
