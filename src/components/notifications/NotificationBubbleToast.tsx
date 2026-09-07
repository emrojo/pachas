'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas, safeSetLocalStorage, safeGetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { AppNotification } from '@/types/database';
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  X,
  Volume2,
  VolumeX,
  CheckCheck,
  Settings,
  Sparkles,
  ExternalLink,
  Users,
  ChevronRight,
  ArrowLeft,
  Bell,
  Receipt,
  ShieldCheck,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { isDemoModeAllowed } from '@/lib/authConfig';

const STORAGE_KEY_DURATION = 'pachas_bubble_duration_seconds';
const STORAGE_KEY_SOUND = 'pachas_bubble_sound_enabled';

export interface ActiveBubbleItem {
  notif: AppNotification;
  totalMs: number;
  remainingMs: number;
  isPaused: boolean;
  createdAt: number;
}

// Generate a gentle WhatsApp-style audio chime via Web Audio API
function playWhatsAppChimeSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dual-tone pop/chime: 880Hz (A5) then 1318Hz (E6)
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Second harmonic chirp
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18);

    gain2.gain.setValueAtTime(0.15, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.22);
  } catch {
    // AudioContext blocked or not supported, ignore gracefully
  }
}

export const NotificationBubbleToast: React.FC = () => {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationsCount,
    activeChatGroupId,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    triggerTestBubble,
  } = usePachas();
  const { t } = useTranslation();
  const isDev = isDemoModeAllowed();

  // Settings
  const [durationSeconds, setDurationSeconds] = useState<number>(5);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isDockOpen, setIsDockOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Active floating bubbles on screen (up to 3)
  const [activeBubbles, setActiveBubbles] = useState<ActiveBubbleItem[]>([]);

  // Track already seen notification IDs to only pop newly arrived notifications
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialMountRef = useRef<boolean>(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedDuration = safeGetLocalStorage(STORAGE_KEY_DURATION);
      if (savedDuration !== null) {
        const parsed = parseInt(savedDuration, 10);
        if (!isNaN(parsed) && [0, 3, 5, 8, 12].includes(parsed)) {
          setDurationSeconds(parsed);
        }
      }

      const savedSound = safeGetLocalStorage(STORAGE_KEY_SOUND);
      if (savedSound !== null) {
        setSoundEnabled(savedSound === 'true');
      }
    } catch {}
  }, []);

  const changeDuration = (secs: number) => {
    setDurationSeconds(secs);
    safeSetLocalStorage(STORAGE_KEY_DURATION, String(secs));
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    safeSetLocalStorage(STORAGE_KEY_SOUND, String(next));
    if (next) {
      playWhatsAppChimeSound();
    }
  };

  // Push incoming unread notifications into the active bubbles stack
  useEffect(() => {
    if (notifications.length === 0) return;

    // First mount: mark all current notifications as seen so we don't blast historical ones
    if (isInitialMountRef.current) {
      notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
      isInitialMountRef.current = false;
      return;
    }

    // Identify brand new unread notifications (ignoring chat notifications if user is currently in that chat)
    const newItems = notifications.filter((n) => {
      if (n.read || seenNotifIdsRef.current.has(n.id)) return false;

      if (activeChatGroupId) {
        const targetGid = n.group_id || (n.data as any)?.groupId;
        const isChatType = n.type === 'group_message_created' || (n.data as any)?.type === 'group_message';
        if (isChatType && targetGid === activeChatGroupId) {
          seenNotifIdsRef.current.add(n.id);
          return false;
        }
      }
      return true;
    });

    if (newItems.length === 0) return;

    // Register them as seen
    newItems.forEach((n) => seenNotifIdsRef.current.add(n.id));

    // Play chime sound if enabled
    if (soundEnabled) {
      playWhatsAppChimeSound();
    }

    const totalMs = durationSeconds === 0 ? 0 : durationSeconds * 1000;

    setActiveBubbles((prev) => {
      const freshItems: ActiveBubbleItem[] = newItems.map((n) => ({
        notif: n,
        totalMs,
        remainingMs: totalMs,
        isPaused: false,
        createdAt: Date.now(),
      }));

      // Keep max 3 bubbles, newest on top
      const combined = [...freshItems, ...prev].slice(0, 3);
      return combined;
    });
  }, [notifications, durationSeconds, soundEnabled]);

  // Timer loop: decrement remaining time for each non-paused bubble
  useEffect(() => {
    if (activeBubbles.length === 0) return;

    const interval = setInterval(() => {
      setActiveBubbles((prev) => {
        let changed = false;
        const updated = prev
          .map((item) => {
            // Manual mode (0) never expires
            if (item.totalMs === 0) return item;
            if (item.isPaused) return item;

            const nextRemaining = item.remainingMs - 100;
            changed = true;
            return {
              ...item,
              remainingMs: nextRemaining,
            };
          })
          .filter((item) => item.totalMs === 0 || item.remainingMs > 0);

        return changed ? updated : prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeBubbles.length]);

  const removeBubble = useCallback((notifId: string) => {
    setActiveBubbles((prev) => prev.filter((b) => b.notif.id !== notifId));
  }, []);

  const handleBubbleClick = (item: ActiveBubbleItem) => {
    const { notif } = item;
    markNotificationAsRead(notif.id);
    removeBubble(notif.id);

    if (notif.action_url) {
      router.push(notif.action_url);
    } else if (notif.group_id) {
      if (notif.type === 'group_message_created') {
        router.push(`/groups/${notif.group_id}?tab=chat`);
      } else if (notif.type === 'member_joined' || notif.type === 'member_invited') {
        router.push(`/groups/${notif.group_id}?tab=members`);
      } else {
        router.push(`/groups/${notif.group_id}`);
      }
    } else {
      router.push('/dashboard');
    }
  };

  const setBubblePaused = (notifId: string, isPaused: boolean) => {
    setActiveBubbles((prev) =>
      prev.map((b) => (b.notif.id === notifId ? { ...b, isPaused } : b))
    );
  };

  const getBubbleIcon = (notif: AppNotification) => {
    switch (notif.type) {
      case 'group_message_created':
      case 'group_message_reaction':
        return <MessageSquare className="w-3.5 h-3.5 text-white" />;
      case 'member_joined':
      case 'member_invited':
        return <UserPlus className="w-3.5 h-3.5 text-white" />;
      case 'expense_created':
      case 'expense_updated':
        return <DollarSign className="w-3.5 h-3.5 text-white" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-white" />;
    }
  };

  const getNotificationItemIcon = (type: string) => {
    switch (type) {
      case 'group_message_created':
      case 'group_message_reaction':
        return <MessageSquare className="w-3.5 h-3.5 text-sky-500" />;
      case 'member_joined':
      case 'member_invited':
      case 'member_removed':
        return <Users className="w-3.5 h-3.5 text-indigo-500" />;
      case 'expense_created':
      case 'expense_updated':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-500" />;
      case 'receipt_pending':
        return <Receipt className="w-3.5 h-3.5 text-amber-500" />;
      case 'settlement_created':
        return <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />;
      case 'group_role_updated':
        return <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <>
      {/* Floating Bubble Stack Container */}
      <div
        className="fixed z-50 flex flex-col gap-2.5 pointer-events-none transition-all duration-300
                   bottom-20 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96"
        aria-live="polite"
      >
        {activeBubbles.map((item) => {
          const { notif, remainingMs, totalMs, isPaused } = item;
          const pct = totalMs > 0 ? Math.max(0, (remainingMs / totalMs) * 100) : 100;
          const authorName =
            notif.data?.authorName ||
            notif.data?.memberName ||
            (notif.title.startsWith('Mensaje de ')
              ? notif.title.replace('Mensaje de ', '')
              : notif.title);

          const avatarUrl = notif.data?.authorAvatar || notif.data?.memberAvatar;
          const groupName = notif.group_name || notif.data?.groupName;

          return (
            <div
              key={notif.id}
              onMouseEnter={() => setBubblePaused(notif.id, true)}
              onMouseLeave={() => setBubblePaused(notif.id, false)}
              onClick={() => handleBubbleClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBubbleClick(item);
                }
              }}
              className="pointer-events-auto relative overflow-hidden bg-white/95 dark:bg-[#111b21]/95 backdrop-blur-md
                         border border-emerald-500/30 dark:border-emerald-500/40 rounded-2xl shadow-2xl shadow-emerald-950/20
                         hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
                         cursor-pointer p-3.5 group select-none text-left"
            >
              {/* WhatsApp Green Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-[#25D366]" />

              <div className="flex items-start gap-3 pt-0.5">
                {/* Avatar with WhatsApp Mini Badge */}
                <div className="relative shrink-0 mt-0.5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={authorName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-500/40 bg-slate-100 dark:bg-slate-800"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-sm ring-2 ring-emerald-500/40">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#25D366] ring-2 ring-white dark:ring-[#111b21] flex items-center justify-center shadow">
                    {getBubbleIcon(notif)}
                  </span>
                </div>

                {/* Content Details */}
                <div className="flex-1 min-w-0 pr-6">
                  {/* Group Tag & Time */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {groupName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50 truncate max-w-[170px]">
                        <Users className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{groupName}</span>
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-0.5 ml-auto">
                      <CheckCheck className="w-3 h-3 text-[#53bdeb]" />
                      <span>{t('notifications.now') || 'Ahora'}</span>
                    </span>
                  </div>

                  {/* Sender Name in WhatsApp Bold style */}
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                    <span className="text-[#075e54] dark:text-[#25D366]">
                      {authorName}
                    </span>
                  </h4>

                  {/* Message body snippet */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                    {notif.message}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBubble(notif.id);
                  }}
                  className="absolute top-2.5 right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={t('notifications.close') || 'Cerrar notificación'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress Bar (Auto-Dismiss) */}
              {totalMs > 0 && (
                <div className="mt-2.5 pt-1">
                  <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-100 ease-linear rounded-full',
                        isPaused
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-[#25D366] dark:bg-emerald-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isPaused && (
                    <span className="block text-[9px] text-amber-500 dark:text-amber-400 text-right mt-0.5 font-medium">
                      {t('notifications.paused') || 'Pausado'}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* WhatsApp Floating Launcher / Quick Dock */}
      <div className={cn("fixed z-40 transition-all", activeChatGroupId ? "bottom-24 right-3 sm:bottom-6 sm:right-6" : "bottom-20 right-3 sm:bottom-6 sm:right-6")}>
        {/* Floating Bubble Button */}
        <button
          onClick={() => setIsDockOpen(!isDockOpen)}
          type="button"
          className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-[#128c7e] to-[#25D366] text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-105 active:scale-95 transition-transform focus:outline-none border-2 border-white dark:border-slate-900"
          title="Notificaciones WhatsApp"
          aria-label="Notificaciones WhatsApp"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow border-2 border-white dark:border-slate-900 animate-pulse">
              {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Quick Dock / Notifications Popover */}
        {isDockOpen && (
          <div
            className="absolute bottom-14 right-0 w-80 sm:w-96 max-w-[92vw] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-slate-950/20 p-3.5 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {showSettings ? (
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Volver a notificaciones"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#128c7e] to-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bell className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {showSettings
                      ? (t('nav.settings') || 'Ajustes')
                      : (t('notifications.centerTitle') || 'Notificaciones')}
                  </h3>
                  {!showSettings && unreadNotificationsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!showSettings && unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsAsRead()}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 cursor-pointer"
                    title={t('notifications.markAllRead') || 'Marcar todas leídas'}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">{t('notifications.markAllRead') || 'Leídas'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSettings((prev) => !prev)}
                  className={cn(
                    "p-1.5 rounded-xl transition-colors cursor-pointer",
                    showSettings
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  title={showSettings ? 'Ver notificaciones' : 'Configurar alertas'}
                  aria-label="Configurar alertas"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDockOpen(false);
                    setShowSettings(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t('common.close') || 'Cerrar'}
                  aria-label={t('common.close') || 'Cerrar'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* View Mode: Settings Panel */}
            {showSettings ? (
              <div className="space-y-3 py-1 animate-in fade-in duration-150">
                {/* Duration Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <span>{t('notifications.bubbleDuration') || 'Duración de la burbuja'}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {durationSeconds === 0 ? (t('notifications.durationManual') || 'Manual') : `${durationSeconds}s`}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { label: '3s', val: 3 },
                      { label: '5s ⭐', val: 5 },
                      { label: '8s', val: 8 },
                      { label: '12s', val: 12 },
                      { label: t('notifications.durationManual') || 'Manual', val: 0 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => changeDuration(item.val)}
                        className={cn(
                          'py-1 text-[10px] font-bold rounded-lg border transition-all text-center cursor-pointer',
                          durationSeconds === item.val
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sound Toggle */}
                <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{t('notifications.soundEnabled') || 'Sonido de aviso'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={toggleSound}
                    className={cn(
                      'px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer',
                      soundEnabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {soundEnabled ? (t('notifications.receiving') || 'Activado') : (t('notifications.muted') || 'Silenciado')}
                  </button>
                </div>

                {/* Test simulation ONLY in development */}
                {isDev && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t('notifications.simulateAlerts') || 'Simular alertas (Solo Dev)'}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerTestBubble('chat')}
                        className="w-full py-1.5 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{t('notifications.testChatBubble') || 'Probar Chat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerTestBubble('member')}
                        className="w-full py-1.5 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>{t('notifications.testMemberBubble') || 'Probar Miembro'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* View Mode: Latest Notifications List */
              <div className="space-y-1 py-0.5 animate-in fade-in duration-150">
                {notifications.length === 0 ? (
                  <div className="py-7 text-center space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Bell className="w-5 h-5 opacity-60" />
                    </div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t('notifications.noNotifications') || 'Sin notificaciones recientes'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-72 overflow-y-auto custom-scrollbar -mx-1 px-1">
                    {notifications.slice(0, 5).map((notif) => (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          markNotificationAsRead(notif.id);
                          removeBubble(notif.id);
                          setIsDockOpen(false);
                          if (notif.action_url) {
                            router.push(notif.action_url);
                          } else if (notif.group_id) {
                            if (notif.type === 'group_message_created' || notif.type === 'group_message_reaction') {
                              router.push(`/groups/${notif.group_id}?tab=members&chat=true`);
                            } else if (notif.type === 'member_joined' || notif.type === 'member_invited') {
                              router.push(`/groups/${notif.group_id}?tab=members`);
                            } else {
                              router.push(`/groups/${notif.group_id}`);
                            }
                          } else {
                            router.push('/notifications');
                          }
                        }}
                        className={cn(
                          "w-full text-left p-2 rounded-2xl transition-all flex items-start gap-2.5 group my-0.5 cursor-pointer",
                          notif.read
                            ? "hover:bg-slate-100/70 dark:hover:bg-slate-800/60 opacity-80 hover:opacity-100"
                            : "bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/50"
                        )}
                      >
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          {getNotificationItemIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-xs truncate font-bold",
                              notif.read ? "text-slate-700 dark:text-slate-300" : "text-emerald-900 dark:text-emerald-100"
                            )}>
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              {formatDate(notif.created_at, 'HH:mm')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
                            {notif.message}
                          </p>
                          {notif.group_name && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                              <Users className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[150px]">{notif.group_name}</span>
                            </span>
                          )}
                        </div>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer Link */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setIsDockOpen(false)}
                    className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors py-0.5 w-full cursor-pointer"
                  >
                    <span>{t('notifications.viewAll') || 'Ver todas las notificaciones'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
