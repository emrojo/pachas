'use client';

import React, { useState } from 'react';
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
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { AppNotification, NotificationType } from '@/types/database';
import { Button } from '@/components/ui/Button';

type FilterTab = 'all' | 'unread' | 'payments' | 'comments' | 'groups';

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
  } = usePachas();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'receipt_pending':
        return <Receipt className="w-5 h-5 text-amber-500" />;
      case 'expense_created':
      case 'expense_updated':
      case 'expense_deleted':
        return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'comment_created':
      case 'comment_reaction':
        return <MessageSquare className="w-5 h-5 text-sky-500" />;
      case 'settlement_created':
        return <CheckCheck className="w-5 h-5 text-emerald-600" />;
      case 'group_role_updated':
        return <ShieldCheck className="w-5 h-5 text-amber-600" />;
      case 'member_joined':
        return <Users className="w-5 h-5 text-indigo-500" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getActionLabel = (type: NotificationType) => {
    switch (type) {
      case 'receipt_pending':
        return '🔍 Validar ticket';
      case 'expense_created':
      case 'expense_updated':
        return '💰 Ver gasto';
      case 'comment_created':
      case 'comment_reaction':
        return '💬 Ver comentario';
      case 'settlement_created':
        return '🤝 Ver pago';
      case 'group_role_updated':
      case 'member_joined':
        return '👥 Ver grupo';
      default:
        return 'Abrir';
    }
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredNotifications = notifications.filter((notif) => {
    // 1. Tab filter
    if (activeTab === 'unread' && notif.read) return false;
    if (activeTab === 'payments' && !['receipt_pending', 'settlement_created', 'expense_created'].includes(notif.type)) {
      return false;
    }
    if (activeTab === 'comments' && !['comment_created', 'comment_reaction'].includes(notif.type)) {
      return false;
    }
    if (activeTab === 'groups' && !['group_role_updated', 'member_joined', 'expense_updated', 'expense_deleted'].includes(notif.type)) {
      return false;
    }

    // 2. Search filter
    if (normalizedSearch) {
      const matchTitle = notif.title.toLowerCase().includes(normalizedSearch);
      const matchMessage = notif.message.toLowerCase().includes(normalizedSearch);
      const matchGroup = (notif.group_name || '').toLowerCase().includes(normalizedSearch);
      return matchTitle || matchMessage || matchGroup;
    }

    return true;
  });

  const handleAction = (notif: AppNotification) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (notif.action_url) {
      router.push(notif.action_url);
    } else if (notif.group_id) {
      router.push(`/groups/${notif.group_id}`);
    }
  };

  const handleClearRead = () => {
    if (!confirm('¿Deseas eliminar todas las notificaciones ya leídas?')) return;
    const unread = notifications.filter((n) => !n.read);
    // Delete read ones
    notifications.forEach((n) => {
      if (n.read) deleteNotification(n.id);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Centro de Notificaciones
              </h1>
              {unreadNotificationsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {unreadNotificationsCount} sin leer
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Consulta pagos por validar, cambios en grupos, comentarios y avisos
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 shrink-0">
          {unreadNotificationsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllNotificationsAsRead}
              className="text-xs font-bold gap-1.5 shadow-2xs"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span>Marcar todas leídas</span>
            </Button>
          )}

          {notifications.some((n) => n.read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearRead}
              className="text-xs text-slate-500 hover:text-rose-600 gap-1.5"
              title="Limpiar notificaciones leídas"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpiar leídas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, texto o grupo..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            Todas ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>No leídas</span>
            {unreadNotificationsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'unread' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
              }`}>
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'payments'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>💳 Pagos y Validaciones</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'comments'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>💬 Comentarios</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'groups'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <span>🌴 Grupos y Roles</span>
          </button>
        </div>
      </div>

      {/* Notification Cards List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                notif.read
                  ? 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800/80 shadow-2xs opacity-85 hover:opacity-100'
                  : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {/* Icon Badge */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-2xs shrink-0 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {notif.title}
                    </span>

                    {notif.group_name && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                        🌴 {notif.group_name}
                      </span>
                    )}

                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="No leída" />
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-2 pt-0.5 text-[11px] text-slate-400 font-mono">
                    <span>{formatDate(notif.created_at, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                <Button
                  size="sm"
                  variant={notif.type === 'receipt_pending' ? 'brand' : 'outline'}
                  onClick={() => handleAction(notif)}
                  className="text-xs font-bold gap-1.5 px-3 py-1.5 shadow-2xs"
                >
                  <span>{getActionLabel(notif.type)}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>

                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => markNotificationAsRead(notif.id)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-colors"
                    title="Marcar como leída"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => deleteNotification(notif.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                  title="Eliminar notificación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No hay notificaciones
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {activeTab === 'unread'
                  ? 'Estás al día. No tienes ninguna notificación pendiente sin leer.'
                  : 'Cuando haya tickets pendientes de validación, nuevos comentarios o pagos, aparecerán aquí.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
