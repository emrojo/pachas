'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
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
  ChevronRight,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { NotificationType } from '@/types/database';

export const NotificationBellDropdown: React.FC = () => {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    seedDemoNotifications,
  } = usePachas();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'receipt_pending':
        return <Receipt className="w-4 h-4 text-amber-500" />;
      case 'expense_created':
        return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'expense_updated':
        return <Sparkles className="w-4 h-4 text-blue-500" />;
      case 'expense_deleted':
        return <Trash2 className="w-4 h-4 text-rose-500" />;
      case 'comment_created':
      case 'comment_reaction':
        return <MessageSquare className="w-4 h-4 text-sky-500" />;
      case 'settlement_created':
        return <CheckCheck className="w-4 h-4 text-emerald-600" />;
      case 'group_role_updated':
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      case 'member_invited':
      case 'member_joined':
      case 'member_removed':
        return <Users className="w-4 h-4 text-indigo-500" />;
      case 'group_archived':
      case 'group_restored':
      case 'group_deleted':
        return <Info className="w-4 h-4 text-purple-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleNotificationClick = (notif: (typeof notifications)[0]) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.action_url) {
      router.push(notif.action_url);
    } else if (notif.group_id) {
      router.push(`/groups/${notif.group_id}`);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all focus:outline-none"
        title="Centro de Notificaciones"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />

        {unreadNotificationsCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 animate-in zoom-in shadow-xs">
            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[500px]">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Notificaciones
              </span>
              {unreadNotificationsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                  {unreadNotificationsCount} sin leer
                </span>
              )}
            </div>

            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline transition-all flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filter === 'unread'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              No leídas ({unreadNotificationsCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.slice(0, 10).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-2.5 rounded-2xl cursor-pointer transition-all border flex items-start gap-2.5 ${
                    notif.read
                      ? 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 opacity-80'
                      : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shadow-2xs'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs shrink-0 mt-0.5">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatDate(notif.created_at, 'dd/MM/yyyy HH:mm')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    {notif.type === 'receipt_pending' && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        🧾 Requiere validación
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity rounded-lg"
                    title="Eliminar notificación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center space-y-2">
                <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {filter === 'unread'
                    ? 'No tienes notificaciones pendientes sin leer'
                    : 'No tienes notificaciones todavía'}
                </p>
                <button
                  type="button"
                  onClick={() => seedDemoNotifications()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cargar ejemplos</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Link */}
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors w-full py-1"
            >
              <span>Ver todas las notificaciones</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
