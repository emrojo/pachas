'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { CreateUserModal } from '@/components/profile/CreateUserModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { DonationCard } from '@/components/donations/DonationCard';
import { DiceBearAvatarPicker } from '@/components/profile/DiceBearAvatarPicker';
import { MobileBottomNav, MobileNavTab } from '@/components/mobile/MobileBottomNav';
import { triggerHaptic } from '@/lib/native/haptics';
import { Profile } from '@/types/database';
import { validateAndCompressImage, sanitizeText } from '@/lib/security/sanitize';
import { sendTestPushNotification } from '@/lib/notifications/pushNotificationService';
import {
  User,
  Mail,
  Phone,
  LogOut,
  Save,
  Check,
  Sparkles,
  ShieldCheck,
  UserPlus,
  Trash2,
  Camera,
  Globe,
  Download,
  Shield,
  Bell,
  Send,
  AlertCircle,
  ChevronDown,
  ArrowLeft,
  X,
  Laptop,
} from 'lucide-react';

export interface MobileProfileViewProps {
  onSwitchToWeb?: () => void;
}

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({ onSwitchToWeb }) => {
  const router = useRouter();
  const {
    currentUser,
    updateProfile,
    setCurrentUser,
    availableUsers,
    deleteLocalUser,
    isCurrentUserAdmin,
    isDemoMode,
    logout,
  } = usePachas();
  const { t } = useTranslation();

  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [bizumPhone, setBizumPhone] = useState(currentUser?.bizum_phone || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.avatar_url || null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [testNotifFeedback, setTestNotifFeedback] = useState<{ success?: boolean; text?: string } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name);
      setBizumPhone(currentUser.bizum_phone || '');
      setAvatarUrl(currentUser.avatar_url || null);
    }
  }, [currentUser]);

  const handleSendTestNotification = async () => {
    if (isSendingTestNotif) return;
    try {
      triggerHaptic('light');
      setIsSendingTestNotif(true);
      setTestNotifFeedback(null);
      const result = await sendTestPushNotification(currentUser?.id);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
      if (result.permissionDenied) {
        setTestNotifFeedback({
          success: false,
          text: result.error || t('notifications.permissionDenied'),
        });
      } else if (result.success) {
        setTestNotifFeedback({
          success: true,
          text: t('notifications.testSuccess'),
        });
      } else {
        setTestNotifFeedback({
          success: false,
          text: result.error || 'Error al enviar notificación de prueba.',
        });
      }
    } catch (err: any) {
      setTestNotifFeedback({
        success: false,
        text: err.message || 'Error al enviar notificación de prueba.',
      });
    } finally {
      setIsSendingTestNotif(false);
    }
  };

  const handleExportData = async () => {
    try {
      triggerHaptic('light');
      setIsExporting(true);
      const res = await fetch('/api/user/export-data');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pachas-mis-datos-${currentUser?.id.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const localData = {
          export_date: new Date().toISOString(),
          user: currentUser,
          local_groups: JSON.parse(sessionStorage.getItem('pachas_groups_v2') || '[]'),
          local_expenses: JSON.parse(sessionStorage.getItem('pachas_expenses_v2') || '{}'),
        };
        const blob = new Blob([JSON.stringify(localData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pachas-mis-datos-${currentUser?.id.slice(0, 8)}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      alert('Error al exportar datos personales.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      triggerHaptic('light');
      const secureCompressed = await validateAndCompressImage(file, 300, 0.85);
      setAvatarUrl(secureCompressed);
    } catch (err: any) {
      alert(err.message || 'Error al procesar la imagen seleccionada.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      triggerHaptic('medium');
      setIsLoading(true);
      await updateProfile({
        full_name: sanitizeText(fullName, 100),
        bizum_phone: sanitizeText(bizumPhone, 25) || null,
        avatar_url: avatarUrl || null,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      alert(err.message || 'Error al guardar el perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchUser = (user: Profile) => {
    if (!isDemoMode) return;
    triggerHaptic('light');
    setCurrentUser(user);
    setFullName(user.full_name);
    setBizumPhone(user.bizum_phone || '');
    setAvatarUrl(user.avatar_url || null);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDeleteUser = async (e: React.MouseEvent, user: Profile) => {
    e.stopPropagation();
    triggerHaptic('warning');
    if (!isCurrentUserAdmin) {
      alert('Solo los administradores pueden eliminar usuarios.');
      return;
    }
    if (confirm(`¿Eliminar el usuario "${user.full_name}"?`)) {
      await deleteLocalUser(user.id);
    }
  };

  const handleLogout = async () => {
    triggerHaptic('medium');
    await logout();
    router.replace('/');
  };

  const handleTabChange = (tab: MobileNavTab) => {
    if (tab === 'expenses') {
      router.push('/dashboard?tab=expenses');
    } else if (tab === 'groups') {
      router.push('/dashboard?tab=groups');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 text-slate-900 dark:text-white antialiased max-w-md mx-auto">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            title="Volver"
            aria-label="Volver"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight text-center truncate">
            {t('profile.title')}
          </h1>

          <div className="flex items-center gap-1.5">
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
            <div className="scale-90">
              <LanguageSelector />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="px-4 py-5 space-y-5">
        {/* AVATAR & QUICK ACTIONS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <Avatar
              profile={{ ...currentUser, full_name: fullName, avatar_url: avatarUrl }}
              size="xl"
              className="w-24 h-24 text-3xl ring-4 ring-emerald-500/20 shadow-md"
            />
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                aria-label="Eliminar foto"
                title="Eliminar foto"
                className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {fullName || currentUser.full_name}
            </h2>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">
              {currentUser.email}
            </p>
            {isCurrentUserAdmin && (
              <span className="inline-block mt-2 text-xs uppercase font-extrabold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                {t('common.admin')}
              </span>
            )}
          </div>

          {/* ICON-ONLY BUTTONS FOR AVATAR ACTIONS */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Tomar o subir foto"
              aria-label="Tomar o subir foto"
              className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Camera className="w-7 h-7" />
            </button>

            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
              title="Generar avatar con IA"
              aria-label="Generar avatar con IA"
              className="w-14 h-14 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-7 h-7" />
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                title="Quitar foto"
                aria-label="Quitar foto"
                className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center active:scale-95 transition-all"
              >
                <Trash2 className="w-6 h-6" />
              </button>
            )}
          </div>

          {isAvatarPickerOpen && (
            <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800">
              <DiceBearAvatarPicker
                currentAvatarUrl={avatarUrl}
                onSelectAvatar={(url) => {
                  setAvatarUrl(url);
                  setIsAvatarPickerOpen(false);
                }}
                userName={fullName || currentUser.full_name}
              />
            </div>
          )}
        </div>

        {/* PROFILE EDIT FORM - LARGE TYPOGRAPHY & ICON-ONLY SAVE */}
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4"
        >
          <div>
            <label className="block text-base font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {t('profile.name')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full h-14 px-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-lg font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <User className="w-6 h-6 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <div>
            <label className="block text-base font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {t('profile.email')}
            </label>
            <div className="relative">
              <input
                type="email"
                value={currentUser.email}
                disabled
                className="w-full h-14 px-4 pl-12 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-lg font-medium text-slate-500 dark:text-slate-400"
              />
              <Mail className="w-6 h-6 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          <div>
            <label className="block text-base font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              {t('profile.bizumPhone')}
            </label>
            <div className="relative">
              <input
                type="tel"
                value={bizumPhone}
                onChange={(e) => setBizumPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full h-14 px-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-lg font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Phone className="w-6 h-6 text-slate-400 absolute left-4 top-4" />
            </div>
            <p className="text-sm text-slate-400 mt-1.5">
              {t('profile.bizumHelp')}
            </p>
          </div>

          {/* ACTION BUTTONS: ICON ONLY */}
          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={isLoading}
              title={t('profile.saveChanges')}
              aria-label={t('profile.saveChanges')}
              className={`flex-1 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all active:scale-95 cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 shadow-emerald-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
              }`}
            >
              {isSaved ? (
                <Check className="w-8 h-8 stroke-[3]" />
              ) : (
                <Save className="w-7 h-7" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={t('nav.logout')}
              aria-label={t('nav.logout')}
              className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-900/50 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="w-7 h-7" />
            </button>
          </div>
        </form>

        {/* DEMO FAST USER SWITCHER */}
        {isDemoMode && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Cambiar Usuario ({availableUsers.length})
                </h3>
              </div>

              {isCurrentUserAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(true)}
                  title="Nuevo Usuario"
                  aria-label="Nuevo Usuario"
                  className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <UserPlus className="w-6 h-6" />
                </button>
              )}
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Toca para cambiar de perspectiva inmediatamente:
            </p>

            <div className="space-y-2">
              {availableUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const isCustom = u.id.startsWith('user-custom-');

                return (
                  <div
                    key={u.id}
                    onClick={() => handleSwitchUser(u)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar profile={u} size="md" className="w-12 h-12 text-lg shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-bold text-slate-900 dark:text-white truncate">
                            {u.full_name}
                          </span>
                          {isCustom && (
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              Creado
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 truncate block">
                          {u.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent ? (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-5 h-5 stroke-[3]" />
                        </div>
                      ) : null}

                      {isCurrentUserAdmin && isCustom && !isCurrent && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(e, u)}
                          title="Eliminar usuario"
                          aria-label="Eliminar usuario"
                          className="w-9 h-9 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COLLAPSIBLE ACCORDION: ADVANCED OPTIONS & SECURITY (Collapsed by default) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsAdvancedOpen(!isAdvancedOpen);
            }}
            className="w-full p-5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Opciones avanzadas y seguridad
                </h3>
                <p className="text-sm text-slate-400">
                  Notificaciones, exportación y privacidad
                </p>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <ChevronDown
                className={`w-6 h-6 transition-transform duration-200 ${
                  isAdvancedOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {isAdvancedOpen && (
            <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {/* Push Notifications Test */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-amber-500 shrink-0" />
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200 truncate">
                      {t('notifications.deviceTitle')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('common.status')}: {notificationPermission}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={isSendingTestNotif}
                  title={t('notifications.testButton')}
                  aria-label={t('notifications.testButton')}
                  className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {testNotifFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-sm flex items-start gap-2 ${
                    testNotifFeedback.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50'
                  }`}
                >
                  {testNotifFeedback.success ? (
                    <Check className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <span className="leading-snug">{testNotifFeedback.text}</span>
                </div>
              )}

              {/* Export Data */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200 truncate">
                      {t('profile.exportDataBtn')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Descargar en archivo JSON
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  title={t('profile.exportDataBtn')}
                  aria-label={t('profile.exportDataBtn')}
                  className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center active:scale-95 transition-all shrink-0"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>

              {/* Delete Account */}
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
                    <span className="text-base font-bold text-rose-800 dark:text-rose-300 truncate">
                      {t('profile.deleteAccountBtn')}
                    </span>
                  </div>
                  <p className="text-xs text-rose-500/80 mt-0.5">
                    Acción irreversible
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeleteAccountOpen(true)}
                  title={t('profile.deleteAccountBtn')}
                  aria-label={t('profile.deleteAccountBtn')}
                  className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Terms & Policies Links */}
              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>{t('profile.gdprTitle')}</span>
                <div className="flex items-center gap-3">
                  <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {t('nav.terms')}
                  </Link>
                  <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {t('nav.privacy')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DONATION CARD */}
        <DonationCard />
      </main>

      {/* UNIFIED MOBILE BOTTOM NAV: 3 big icon buttons (Receipt, Users, Settings) */}
      <MobileBottomNav
        activeTab="options"
        onTabChange={handleTabChange}
      />

      {/* MODALS */}
      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={(newUser) => {
          handleSwitchUser(newUser);
        }}
      />

      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
      />
    </div>
  );
};

export default MobileProfileView;
