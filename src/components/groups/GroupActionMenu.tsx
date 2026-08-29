'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import {
  Plus,
  QrCode,
  SlidersHorizontal,
  ChevronDown,
  Compass,
  BarChart3,
  Calculator as CalcIcon,
  UploadCloud,
  FileDown,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';

export interface GroupActionMenuProps {
  onOpenNewExpense: () => void;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  onOpenRouteMap: () => void;
  onOpenCharts: () => void;
  onOpenAudit?: () => void;
  onOpenImport: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
  className?: string;
}

export const GroupActionMenu: React.FC<GroupActionMenuProps> = ({
  onOpenNewExpense,
  onOpenInvite,
  onOpenSettings,
  onOpenRouteMap,
  onOpenCharts,
  onOpenAudit,
  onOpenImport,
  onExportPDF,
  onExportCSV,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap ${className}`}>
      {/* 1. PRIMARY HERO ACTION: Añadir Gasto */}
      <button
        type="button"
        onClick={onOpenNewExpense}
        className="order-1 flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer group"
      >
        <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Plus className="w-4 h-4 text-white stroke-[3]" />
        </div>
        <span>{t('expenses.addExpense')}</span>
      </button>

      {/* 2. SECONDARY ACTION: Invitar Amigos */}
      <button
        type="button"
        onClick={onOpenInvite}
        className="order-2 inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/80 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
        title={t('groups.inviteFriends')}
      >
        <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="hidden sm:inline">{t('groups.inviteFriends')}</span>
        <span className="sm:hidden">{t('nav.friends')}</span>
      </button>

      {/* 3. SUBMENU DROPDOWN: Herramientas y Opciones */}
      <div className="order-3 relative z-30" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          className={`inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold px-3 py-2.5 sm:py-3 rounded-2xl shadow-2xs transition-all cursor-pointer ${
            isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''
          }`}
          title={t('groups.moreOptions')}
        >
          <SlidersHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="hidden md:inline">{t('groups.moreOptions')}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-600' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu Panel */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-md">
            {/* Section 1: Rutas y Análisis */}
            <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('groups.sectionViews')}
            </div>

            <button
              type="button"
              onClick={() => handleAction(onOpenRouteMap)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('tripMap.title')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">
                  {t('tripMap.subtitle')}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAction(onOpenCharts)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('charts.title')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">
                  {t('charts.subtitle')}
                </span>
              </div>
            </button>

            {onOpenAudit && (
              <button
                type="button"
                onClick={() => handleAction(onOpenAudit)}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <CalcIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate">{t('audit.title')}</span>
                  <span className="block text-[10px] font-normal text-slate-400 truncate">
                    {t('audit.checkAuditSubtitle')}
                  </span>
                </div>
              </button>
            )}

            {/* Section 2: Importar y Exportar */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('groups.sectionExport')}
            </div>

            <button
              type="button"
              onClick={() => handleAction(onOpenImport)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('groups.importExpenses')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">CSV / Excel</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAction(onExportPDF)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <FileDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('groups.exportPDF')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">PDF con gráficos</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAction(onExportCSV)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('groups.exportCSV')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">Hoja de cálculo</span>
              </div>
            </button>

            {/* Section 3: Gestión del Grupo */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('groups.sectionManage')}
            </div>

            <button
              type="button"
              onClick={() => handleAction(onOpenSettings)}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate">{t('groups.settings')}</span>
                <span className="block text-[10px] font-normal text-slate-400 truncate">
                  {t('groups.changePhoto')} / Nombre
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
