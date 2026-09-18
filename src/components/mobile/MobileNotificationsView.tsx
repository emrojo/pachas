'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas, safeSetLocalStorage, safeGetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import {
  Bell,
  CheckCheck,
  Receipt,
  MessageSquare,
  DollarSign,
  ShieldCheck,
  Users,
  Info,
  Search,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Timer,
  Volume2,
  VolumeX,
  ChevronDown,
  Laptop,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { AppNotification, NotificationType } from '@/types/database';
import { MobileBottomNav, MobileNavTab } from '@/components/mobile/MobileBottomNav';
import { triggerHaptic } from '@/lib/native/haptics';
import { isProduction } from '@/lib/authConfig';

type FilterTab = 'all' | 'unread' | 'payments' | 'comments' | 'groups';

export interface MobileNotificationsViewProps {
  onSwitchToWeb?: () => void;
}

export const MobileNotificationsView: React.FC<MobileNotificationsViewProps> = ({
  onSwitchToWeb,
}) => {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    seedDemoNotifications,
    triggerTestBubble,
    isDemoMode,
  } = usePachas();
  const { t } = useTranslation();
  const showDemoSeeds = isDemoMode && !isProduction();

  const [bubbleDuration, setBubbleDuration] = useState<number>(5);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const savedDur = safeGetLocalStorage('pachas_bubble_duration_seconds');
      if (savedDur !== null) {
        const val = parseInt(savedDur, 10);
        if (!isNaN(val) && [0, 3, 5, 8, 12].includes(val)) setBubbleDuration(val);
      }
      const savedSnd = safeGetLocalStorage('pachas_bubble_sound_enabled');
      if (savedSnd !== null) {
        setSoundEnabled(savedSnd === 'true');
      }
    } catch {}
  }, []);

  const handleUpdateDuration = (secs: number) => {
    triggerHaptic('light');
    setBubbleDuration(secs);
    safeSetLocalStorage('pachas_bubble_duration_seconds', String(secs));
  };

  const handleToggleSound = () => {
    triggerHaptic('light');
    const next = !soundEnabled;
    setSoundEnabled(next);
    safeSetLocalStorage('pachas_bubble_sound_enabled', String(next));
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'receipt_pending':
        return <Receipt className="w-6 h-6 text-amber-500" />;
      case 'expense_created':
        return <DollarSign className="w-6 h-6 text-emerald-500" />;
      case 'expense_updated':
        return <Sparkles className="w-6 h-6 text-blue-500" />;
      case 'expense_deleted':
        return <Trash2 className="w-6 h-6 text-rose-500" />;
      case 'comment_created':
      case 'comment_reaction':
      case 'group_message_created':
      case 'group_message_reaction':
        return <MessageSquare className="w-6 h-6 text-sky-500" />;
      case 'settlement_created':
        return <CheckCheck className="w-6 h-6 text-emerald-600" />;
      case 'group_role_updated':
        return <ShieldCheck className="w-6 h-6 text-amber-600" />;
      case 'member_invited':
      case 'member_joined':
      case 'member_removed':
        return <Users className="w-6 h-6 text-indigo-500" />;
      case 'group_archived':
      case 'group_restored':
      case 'group_deleted':
        return <Info className="w-6 h-6 text-purple-500" />;
      default:
        return <Info className="w-6 h-6 text-slate-400" />;
    }
  };

  const getActionLabel = (type: NotificationType) => {
    switch (type) {
      case 'receipt_pending':
        return t('notifications.validateScan') || 'Validar ticket';
      case 'expense_created':
      case 'expense_updated':
        return t('notifications.viewExpense') || 'Ver gasto';
      case 'comment_created':
      case 'comment_reaction':
        return t('notifications.viewComment') || 'Ver comentario';
      case 'group_message_created':
      case 'group_message_reaction':
        return t('notifications.viewChat') || 'Ver chat';
      case 'settlement_created':
        return t('notifications.viewPayment') || 'Ver pago';
      case 'group_role_updated':
      case 'member_invited':
      case 'member_joined':
      case 'member_removed':
      case 'group_archived':
      case 'group_restored':
        return t('groups.membersTab') || 'Ver grupo';
      case 'expense_deleted':
      case 'group_deleted':
        return t('common.details') || 'Ver aviso';
      default:
        return t('common.details') || 'Abrir';
    }
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'unread' && notif.read) return false;
    if (activeTab === 'payments' && !['receipt_pending', 'settlement_created', 'expense_created'].includes(notif.type)) {
      return false;
    }
    if (activeTab === 'comments' && !['comment_created', 'comment_reaction', 'group_message_created', 'group_message_reaction'].includes(notif.type)) {
      return false;
    }
    if (activeTab === 'groups' && !['group_role_updated', 'member_invited', 'member_joined', 'member_removed', 'group_archived', 'group_restored', 'group_deleted', 'expense_updated', 'expense_deleted'].includes(notif.type)) {
      return false;
    }

    if (normalizedSearch) {
      const matchTitle = notif.title.toLowerCase().includes(normalizedSearch);
      const matchMessage = notif.message.toLowerCase().includes(normalizedSearch);
      const matchGroup = (notif.group_name || '').toLowerCase().includes(normalizedSearch);
      return matchTitle || matchMessage || matchGroup;
    }

    return true;
  });

  const resolveNotificationUrl = (notif: AppNotification): string => {
    if (notif.action_url) return notif.action_url;
    if (!notif.group_id) return '/dashboard';

    switch (notif.type) {
      case 'receipt_pending':
        return `/groups/${notif.group_id}?validateScan=${notif.data?.scanId || ''}`;
      case 'expense_created':
      case 'expense_updated':
        return notif.expense_id
          ? `/groups/${notif.group_id}?tab=expenses&expenseId=${notif.expense_id}`
          : `/groups/${notif.group_id}?tab=expenses`;
      case 'expense_deleted':
        return `/groups/${notif.group_id}?tab=expenses`;
      case 'comment_created':
      case 'comment_reaction':
        return notif.expense_id
          ? `/groups/${notif.group_id}?tab=expenses&expenseId=${notif.expense_id}&comments=true`
          : `/groups/${notif.group_id}?tab=expenses`;
      case 'group_message_created':
      case 'group_message_reaction':
        return `/groups/${notif.group_id}?tab=members&chat=true`;
      case 'member_invited':
      case 'member_joined':
      case 'member_removed':
      case 'group_role_updated':
        return `/groups/${notif.group_id}?tab=members`;
      case 'settlement_created':
        return `/groups/${notif.group_id}?tab=balances`;
      case 'group_archived':
      case 'group_deleted':
        return '/dashboard';
      case 'group_restored':
        return `/groups/${notif.group_id}?tab=expenses`;
      default:
        return `/groups/${notif.group_id}`;
    }
  };

  const handleAction = (notif: AppNotification) => {
    triggerHaptic('light');
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    const targetUrl = resolveNotificationUrl(notif);
    router.push(targetUrl);
  };

  const handleClearRead = () => {
    triggerHaptic('warning');
    if (!confirm(t('notifications.confirmClearRead') || '¿Deseas eliminar todas las notificaciones ya leídas?')) return;
    notifications.forEach((n) => {
      if (n.read) deleteNotification(n.id);
    });
  };

  const handleTabChange = (tab: MobileNavTab) => {
    if (tab === 'expenses') {
      router.push('/dashboard?tab=expenses');
    } else if (tab === 'groups') {
      router.push('/dashboard?tab=groups');
    } else if (tab === 'options') {
      router.push('/profile');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-900 dark:text-white antialiased max-w-md mx-auto">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            title="Volver"
            aria-label="Volver"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {t('notifications.centerTitle') || 'Notificaciones'}
            </h1>
            {unreadNotificationsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-bold shrink-0">
                {unreadNotificationsCount}
              </span>
            )}
          </div>

          {/* ICON-ONLY HEADER ACTIONS */}
          <div className="flex items-center gap-1">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  markAllNotificationsAsRead();
                }}
                title={t('notifications.markAllRead') || 'Marcar todas leídas'}
                aria-label={t('notifications.markAllRead') || 'Marcar todas leídas'}
                className="w-11 h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm active:scale-95 transition-all"
              >
                <CheckCheck className="w-5 h-5" />
              </button>
            )}

            {notifications.some((n) => n.read) && (
              <button
                type="button"
                onClick={handleClearRead}
                title={t('notifications.clearRead') || 'Limpiar leídas'}
                aria-label={t('notifications.clearRead') || 'Limpiar leídas'}
                className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            {onSwitchToWeb && (
              <button
                type="button"
                onClick={onSwitchToWeb}
                title="Versión Web"
                aria-label="Versión Web"
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Laptop className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="px-4 py-4 space-y-4">
        {/* SEARCH BAR - LARGE TOUCH TARGET */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('notifications.searchPlaceholder') || 'Buscar notificaciones...'}
            className="w-full h-14 pl-12 pr-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          <Search className="w-6 h-6 text-slate-400 absolute left-4 top-4" />
        </div>

        {/* HORIZONTAL CATEGORY CHIPS */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('all');
            }}
            className={`h-11 px-4 rounded-2xl text-base font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'all'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            {t('notifications.all') || 'Todas'} ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('unread');
            }}
            className={`h-11 px-4 rounded-2xl text-base font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer active:scale-95 ${
              activeTab === 'unread'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span>{t('notifications.unread') || 'No leídas'}</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white text-rose-600">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('payments');
            }}
            className={`h-11 px-4 rounded-2xl text-base font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'payments'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            💳 Pagos
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('comments');
            }}
            className={`h-11 px-4 rounded-2xl text-base font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'comments'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            💬 Chat
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('groups');
            }}
            className={`h-11 px-4 rounded-2xl text-base font-bold transition-all shrink-0 cursor-pointer active:scale-95 ${
              activeTab === 'groups'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            🌴 Grupos
          </button>
        </div>

        {/* COLLAPSED ACCORDION: BUBBLES & ADVANCED SETTINGS (Collapsed by default) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsSettingsOpen(!isSettingsOpen);
            }}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#128c7e] to-[#25D366] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Burbujas flotantes (WhatsApp)
                </h3>
                <p className="text-sm text-slate-400">
                  Sonido, duración y pruebas
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <ChevronDown
                className={`w-6 h-6 transition-transform duration-200 ${
                  isSettingsOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {isSettingsOpen && (
            <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {/* Sound & Duration */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Sonido de aviso
                </span>

                <button
                  type="button"
                  onClick={handleToggleSound}
                  title="Activar/Desactivar sonido"
                  aria-label="Activar/Desactivar sonido"
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${
                    soundEnabled
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Duración
                  </span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {bubbleDuration === 0 ? 'Manual' : `${bubbleDuration}s`}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: '3s', val: 3 },
                    { label: '5s', val: 5 },
                    { label: '8s', val: 8 },
                    { label: '12s', val: 12 },
                    { label: 'Off', val: 0 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => handleUpdateDuration(item.val)}
                      className={`h-11 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                        bubbleDuration === item.val
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Demo test buttons */}
              {isDemoMode && (
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    Probar burbujas
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerTestBubble('chat')}
                      title="Probar burbuja chat"
                      aria-label="Probar burbuja chat"
                      className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md active:scale-95"
                    >
                      <MessageSquare className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerTestBubble('member')}
                      title="Probar burbuja miembro"
                      aria-label="Probar burbuja miembro"
                      className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-md active:scale-95"
                    >
                      <Users className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* NOTIFICATIONS LIST */}
        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-3xl border transition-all space-y-3 ${
                  notif.read
                    ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                    : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white truncate">
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>

                    {notif.group_name && (
                      <span className="inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        🌴 {notif.group_name}
                      </span>
                    )}

                    <p className="text-base text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    <span className="text-xs text-slate-400 font-mono block mt-1">
                      {formatDate(notif.created_at, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                </div>

                {/* ACTION BUTTONS: ICON-ONLY */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleAction(notif)}
                    title={getActionLabel(notif.type)}
                    aria-label={getActionLabel(notif.type)}
                    className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>

                  {!notif.read && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        markNotificationAsRead(notif.id);
                      }}
                      title="Marcar como leída"
                      aria-label="Marcar como leída"
                      className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      deleteNotification(notif.id);
                    }}
                    title="Eliminar notificación"
                    aria-label="Eliminar notificación"
                    className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('notifications.noNotifications') || 'No hay notificaciones'}
              </h3>
              <p className="text-base text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {activeTab === 'unread'
                  ? 'Estás al día. No tienes notificaciones pendientes.'
                  : 'Aquí aparecerán los avisos y actualizaciones de tus gastos y grupos.'}
              </p>
              {showDemoSeeds && (
                <button
                  type="button"
                  onClick={seedDemoNotifications}
                  title="Cargar ejemplos"
                  aria-label="Cargar ejemplos"
                  className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md mx-auto active:scale-95"
                >
                  <Sparkles className="w-7 h-7" />
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* UNIFIED MOBILE BOTTOM NAV: 3 big icon buttons (Receipt, Users, Settings) */}
      <MobileBottomNav
        activeTab="expenses"
        onTabChange={handleTabChange}
      />
    </div>
  );
};

export default MobileNotificationsView;
