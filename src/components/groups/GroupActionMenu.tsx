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
  Bell,
  BellOff,
  Camera,
  Download,
  Share2,
} from 'lucide-react';
import {
  getGroupNotificationPreference,
  setGroupNotificationPreference,
} from '@/lib/notifications/pushNotificationService';

export interface GroupActionMenuProps {
  groupId?: string;
  onOpenNewExpense: () => void;
  onFastScanReceipt?: (file: File) => void;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  onOpenRouteMap: () => void;
  onOpenCharts: () => void;
  onOpenAudit?: () => void;
  onOpenImport: () => void;
  onExportPDF?: (mode?: 'download' | 'share') => void;
  onDownloadPDF?: () => void;
  onSharePDF?: () => void;
  onExportCSV: () => void;
  className?: string;
}

export const GroupActionMenu: React.FC<GroupActionMenuProps> = ({
  groupId,
  onOpenNewExpense,
  onFastScanReceipt,
  onOpenInvite,
  onOpenSettings,
  onOpenRouteMap,
  onOpenCharts,
  onOpenAudit,
  onOpenImport,
  onExportPDF,
  onDownloadPDF,
  onSharePDF,
  onExportCSV,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isPdfSubmenuOpen, setIsPdfSubmenuOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch notification preference on mount / dropdown open
  useEffect(() => {
    if (groupId) {
      getGroupNotificationPreference(groupId).then((enabled) => {
        setNotificationsEnabled(enabled);
      });
    }
  }, [groupId, isOpen]);

  const handleToggleNotifications = async () => {
    if (!groupId || isUpdatingNotifications) return;
    try {
      setIsUpdatingNotifications(true);
      const nextState = !notificationsEnabled;
      const success = await setGroupNotificationPreference(groupId, nextState);
      if (success) {
        setNotificationsEnabled(nextState);
      }
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

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

  const fastCameraInputRef = useRef<HTMLInputElement>(null);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const handleFastFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFastScanReceipt) {
      onFastScanReceipt(file);
    }
    e.target.value = '';
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

      {/* 1.5 FAST RECEIPT SCAN CAMERA ACTION */}
      {onFastScanReceipt && (
        <>
          <input
            ref={fastCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFastFileChange}
          />
          <button
            type="button"
            onClick={() => fastCameraInputRef.current?.click()}
            className="order-2 inline-flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer group"
            title={t('expenses.scanReceiptQuick')}
          >
            <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">{t('expenses.scanReceiptQuick')}</span>
          </button>
        </>
      )}

      {/* 2. SECONDARY ACTION: Invitar Amigos */}
      <button
        type="button"
        onClick={onOpenInvite}
        className="order-3 inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/80 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
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

            {/* Contextual PDF Menu Item with Download & Share Options */}
            <div className="rounded-xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setIsPdfSubmenuOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate">
                      {t('groups.pdfReport') || t('groups.exportPDF') || 'Informe de Gastos (PDF)'}
                    </span>
                    <span className="block text-[10px] font-normal text-rose-600/80 dark:text-rose-400/80 truncate">
                      {t('groups.download') || 'Descargar'} / {t('groups.share') || 'Compartir'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-rose-400 transition-transform duration-200 shrink-0 ${
                    isPdfSubmenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isPdfSubmenuOpen && (
                <div className="px-2 pb-2 pt-1 space-y-1 border-t border-rose-100/80 dark:border-rose-900/40 bg-white/70 dark:bg-slate-900/70">
                  <button
                    type="button"
                    onClick={() =>
                      handleAction(() =>
                        onDownloadPDF ? onDownloadPDF() : onExportPDF?.('download')
                      )
                    }
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 rounded-lg transition-colors text-left group"
                  >
                    <div className="w-6 h-6 rounded-md bg-rose-100/80 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold truncate">
                        {t('groups.downloadPDF') || 'Descargar PDF'}
                      </span>
                      <span className="block text-[9.5px] font-normal text-slate-400 truncate">
                        {t('groups.downloadPDFDesc') || 'Guardar archivo en este dispositivo'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAction(() =>
                        onSharePDF ? onSharePDF() : onExportPDF?.('share')
                      )
                    }
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg transition-colors text-left group"
                  >
                    <div className="w-6 h-6 rounded-md bg-emerald-100/80 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Share2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold truncate">
                        {t('groups.sharePDF') || 'Compartir PDF'}
                      </span>
                      <span className="block text-[9.5px] font-normal text-slate-400 truncate">
                        {t('groups.sharePDFDesc') || 'Enviar por WhatsApp, email o apps'}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

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

            {/* Section 3: Gestión del Grupo & Notificaciones */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('groups.sectionManage')}
            </div>

            {groupId && (
              <button
                type="button"
                onClick={handleToggleNotifications}
                disabled={isUpdatingNotifications}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    notificationsEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {notificationsEnabled ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate">
                      {notificationsEnabled
                        ? (t('notifications.enabled') || 'Notificaciones: Sí')
                        : (t('notifications.disabled') || 'Notificaciones: No')}
                    </span>
                    <span className="block text-[10px] font-normal text-slate-400 truncate">
                      {notificationsEnabled
                        ? (t('notifications.receiving') || 'Recibiendo avisos')
                        : (t('notifications.muted') || 'Silenciadas')}
                    </span>
                  </div>
                </div>

                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors shrink-0 ${
                  notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                    notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            )}

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
