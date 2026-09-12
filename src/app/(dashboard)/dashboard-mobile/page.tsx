'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas, safeGetLocalStorage, safeSetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { useDonationUrl } from '@/lib/useDonationUrl';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ReceiptRedactionModal } from '@/components/expenses/ReceiptRedactionModal';
import { ReceiptValidationModal } from '@/components/expenses/ReceiptValidationModal';
import { PendingScansBanner } from '@/components/expenses/PendingScansBanner';
import { CreateGroupModal } from '@/components/groups/CreateGroupModal';
import { JoinGroupModal } from '@/components/groups/JoinGroupModal';
import { InviteModal } from '@/components/groups/InviteModal';
import { EditGroupModal } from '@/components/groups/EditGroupModal';
import { SettleModal } from '@/components/balances/SettleModal';

import { validateAndCompressImage } from '@/lib/security/sanitize';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/categories';
import { exportGroupToPDF, exportGroupToCSV } from '@/lib/export';
import { getExpensePaymentStatus } from '@/lib/algorithms/simplifyDebts';
import { Expense, PendingReceiptScan, SimplifiedDebt, Profile } from '@/types/database';

import {
  Camera,
  Upload,
  Plus,
  Receipt,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Check,
  LogOut,
  Coffee,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  User,
  ArrowUpRight,
  Sparkles,
  QrCode,
  HandCoins,
  FileDown,
  Lock,
  Globe,
} from 'lucide-react';

type MobileViewTab = 'expenses' | 'groups' | 'options';

export default function MobileDashboardPage() {
  const router = useRouter();
  const {
    groups,
    currentUser,
    getGroup,
    fetchGroup,
    getGroupMembers,
    getGroupExpenses,
    getGroupBalances,
    getGroupDebts,
    queueReceiptScan,
    pendingReceiptScans,
    availableUsers,
    setCurrentUser,
    logout,
    isDemoMode,
    addNotification,
  } = usePachas();
  const { t } = useTranslation();
  const donationUrl = useDonationUrl();

  const activeGroups = useMemo(() => groups.filter((g) => !g.is_archived), [groups]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    if (activeGroups.length > 0) {
      const saved = safeGetLocalStorage('pachas_mobile_active_group');
      const validSaved = activeGroups.find((g) => g.id === saved);
      if (validSaved) {
        setSelectedGroupId(validSaved.id);
      } else if (!selectedGroupId || !activeGroups.find((g) => g.id === selectedGroupId)) {
        setSelectedGroupId(activeGroups[0].id);
      }
    }
  }, [activeGroups, selectedGroupId]);

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    safeSetLocalStorage('pachas_mobile_active_group', id);
    fetchGroup(id).catch(() => {});
  };

  const activeGroup = activeGroups.find((g) => g.id === selectedGroupId) || activeGroups[0] || null;

  const members = activeGroup ? getGroupMembers(activeGroup.id) : [];
  const expenses = activeGroup ? getGroupExpenses(activeGroup.id) : [];
  const balances = activeGroup ? getGroupBalances(activeGroup.id) : [];
  const debts = activeGroup ? getGroupDebts(activeGroup.id) : [];

  const totalGroupSpent = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [expenses]);

  const myNetBalance = useMemo(() => {
    if (!currentUser || !activeGroup) return 0;
    const myBalance = balances.find((b) => b.user_id === currentUser.id);
    return myBalance?.net_balance || 0;
  }, [balances, currentUser, activeGroup]);

  const [activeTab, setActiveTab] = useState<MobileViewTab>('expenses');

  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [redactionImage, setRedactionImage] = useState<string | null>(null);
  const [validatingScan, setValidatingScan] = useState<PendingReceiptScan | null>(null);
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [settlingDebt, setSettlingDebt] = useState<SimplifiedDebt | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const handleProcessFile = async (file: File) => {
    if (!activeGroup) return;
    try {
      const compressedDataUrl = await validateAndCompressImage(file, 1200, 0.85);
      setRedactionImage(compressedDataUrl);
    } catch (err: any) {
      console.warn('Error processing receipt image:', err);
      alert(err.message || 'Error al procesar la imagen.');
    }
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
    e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
    e.target.value = '';
  };

  const handleOpenManualExpense = () => {
    setEditingExpense(null);
    setIsExpenseFormOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseFormOpen(true);
  };

  const handleSelectUser = (user: Profile) => {
    setCurrentUser(user);
    setIsUserMenuOpen(false);
  };

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-between antialiased selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 shadow-2xl min-h-screen flex flex-col relative pb-20">

        {/* HEADER */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 pt-3 pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setIsGroupSwitcherOpen(!isGroupSwitcherOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all text-left max-w-full"
                title={t('dashboard.switchGroup') || 'Cambiar de grupo'}
              >
                {activeGroup?.cover_image_url ? (
                  <img
                    src={activeGroup.cover_image_url}
                    alt=""
                    className="w-8 h-8 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <span className="text-xl shrink-0">{activeGroup?.icon_emoji || '🏖️'}</span>
                )}
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  {activeGroup ? activeGroup.name : t('dashboard.noGroupsTitle') || 'Sin grupos'}
                </span>
                {activeGroup && (
                  activeGroup.is_closed ? (
                    <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                  )
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
              </button>

              {isGroupSwitcherOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-2.5 py-1.5 text-sm font-black uppercase text-slate-400">
                    {t('dashboard.yourGroups') || 'Tus Grupos'}
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {activeGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          handleSelectGroup(g.id);
                          setIsGroupSwitcherOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left text-base transition-colors ${
                          g.id === activeGroup?.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                        }`}
                      >
                        <span className="text-lg shrink-0">{g.icon_emoji || '🏖️'}</span>
                        <span className="truncate flex-1">{g.name}</span>
                        {g.is_closed ? (
                          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        {g.id === activeGroup?.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupSwitcherOpen(false);
                        setIsCreateGroupOpen(true);
                      }}
                      className="flex-1 py-2.5 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                    >
                      + {t('nav.newGroup') || 'Nuevo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsGroupSwitcherOpen(false);
                        setIsJoinGroupOpen(true);
                      }}
                      className="flex-1 py-2.5 text-center text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                    >
                      {t('nav.joinGroup') || 'Unirse'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={donationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center transition-transform active:scale-95 shadow-2xs"
                title={t('dashboard.supportProject') || 'Apoyar el proyecto'}
              >
                <Coffee className="w-4.5 h-4.5" />
              </a>

              <LanguageSelector variant="compact" />

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="rounded-full ring-2 ring-transparent hover:ring-emerald-500 transition-all cursor-pointer"
                >
                  <Avatar profile={currentUser} size="sm" className="w-9 h-9 text-xs shadow-2xs" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 text-base">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1.5">
                      <div className="font-bold text-slate-900 dark:text-white truncate text-base">
                        {currentUser.full_name || 'Usuario'}
                      </div>
                      <div className="text-sm text-slate-400 truncate mt-0.5">{currentUser.email}</div>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-base"
                    >
                      <User className="w-4.5 h-4.5 text-slate-400" />
                      <span>{t('nav.profile') || 'Mi Perfil'}</span>
                    </Link>

                    <Link
                      href="/dashboard"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-base"
                    >
                      <ArrowUpRight className="w-4.5 h-4.5 text-slate-400" />
                      <span>Dashboard Estándar</span>
                    </Link>

                    {isDemoMode && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                        <div className="px-2 py-1 text-sm font-bold text-slate-400 uppercase flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Simular:
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {availableUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleSelectUser(u)}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-base font-medium"
                            >
                              <Avatar profile={u} size="sm" className="w-6 h-6 text-xs" />
                              <span className="truncate flex-1">{u.full_name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium text-base"
                      >
                        <LogOut className="w-4.5 h-4.5" />
                        <span>{t('nav.logout') || 'Cerrar sesión'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeGroup ? (
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-7 text-white shadow-md shadow-emerald-600/15 relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm uppercase font-extrabold tracking-wider text-emerald-100 block">
                    {t('dashboard.totalGroupSpent') || 'Gasto Total del Grupo'}
                  </span>
                  <div className="text-3xl font-black tracking-tight mt-1">
                    {formatMoney(totalGroupSpent, activeGroup.base_currency)}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm uppercase font-extrabold tracking-wider text-emerald-100 block">
                    Tu Estado
                  </span>
                  <div className="mt-1.5">
                    {myNetBalance < 0 ? (
                      <span className="inline-flex items-center gap-1.5 bg-rose-500/90 text-white font-black text-base px-3.5 py-1.5 rounded-xl shadow-xs">
                        <TrendingDown className="w-4 h-4" />
                        {t('dashboard.youOweGroup') || 'Debes'} {formatMoney(Math.abs(myNetBalance), activeGroup.base_currency)}
                      </span>
                    ) : myNetBalance > 0 ? (
                      <span className="inline-flex items-center gap-1.5 bg-white/20 text-white font-black text-base px-3.5 py-1.5 rounded-xl">
                        <TrendingUp className="w-4 h-4" />
                        {t('dashboard.groupOwesYou') || 'Te deben'} {formatMoney(myNetBalance, activeGroup.base_currency)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-white/15 text-emerald-50 font-bold text-base px-3.5 py-1.5 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        {t('dashboard.userSettled') || 'Al día'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center text-base text-slate-500 font-medium">
              {t('dashboard.noGroupsTitle') || 'Crea o únete a un grupo para empezar.'}
            </div>
          )}
        </header>

        {/* BODY */}
        <main className="p-4 space-y-4 flex-1">
          {activeGroup && (
            <PendingScansBanner
              groupId={activeGroup.id}
              onSelectScanToValidate={(scan) => setValidatingScan(scan)}
            />
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleGalleryChange}
          />

          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                Registrar Gasto
              </span>
              <span className="text-sm text-slate-400 font-medium">Elige una opción</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={!activeGroup}
                onClick={() => cameraInputRef.current?.click()}
                title={t('dashboard.scanReceiptCamera') || 'Escanear factura con la cámara'}
                aria-label={t('dashboard.scanReceiptCamera') || 'Escanear factura con la cámara'}
                className="h-20 sm:h-24 flex items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-b from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white shadow-md shadow-emerald-500/25 active:scale-95 transition-all hover:brightness-105 group cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-10 h-10 sm:w-11 sm:h-11 group-hover:scale-110 transition-transform stroke-[2.2]" />
              </button>

              <button
                type="button"
                disabled={!activeGroup}
                onClick={() => galleryInputRef.current?.click()}
                title={t('dashboard.uploadReceiptImage') || 'Subir foto o factura'}
                aria-label={t('dashboard.uploadReceiptImage') || 'Subir foto o factura'}
                className="h-20 sm:h-24 flex items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-b from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 text-white shadow-md shadow-teal-500/25 active:scale-95 transition-all hover:brightness-105 group cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-10 h-10 sm:w-11 sm:h-11 group-hover:scale-110 transition-transform stroke-[2.2]" />
              </button>

              <button
                type="button"
                disabled={!activeGroup}
                onClick={handleOpenManualExpense}
                title={t('dashboard.addExpenseManual') || 'Añadir gasto manualmente'}
                aria-label={t('dashboard.addExpenseManual') || 'Añadir gasto manualmente'}
                className="h-20 sm:h-24 flex items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-b from-slate-700 to-slate-800 dark:from-slate-700 dark:to-slate-800 text-white shadow-md shadow-slate-700/25 active:scale-95 transition-all hover:brightness-105 group cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-10 h-10 sm:w-11 sm:h-11 group-hover:scale-110 transition-transform stroke-[2.5]" />
              </button>
            </div>
          </div>

          {activeTab === 'expenses' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {t('dashboard.tabExpenses') || 'Gastos del Grupo'} ({expenses.length})
                </span>
                {activeGroup && (
                  <Link
                    href={`/groups/${activeGroup.id}?tab=expenses`}
                    className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-0.5"
                  >
                    Ver todos <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>

              {expenses.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-base font-medium">
                  {t('dashboard.noExpensesInGroup') || 'Aún no hay gastos registrados en este grupo.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {expenses.slice(0, 10).map((exp) => {
                    const payerUserId = exp.payers?.[0]?.user_id || exp.created_by;
                    const payerMember = members.find((m) => m.user_id === payerUserId);
                    const payerName = payerMember?.provisional_name || payerMember?.profile?.full_name || exp.creator?.full_name || 'Alguien';
                    const categoryInfo = getCategoryInfo(exp.category);
                    const paymentInfo = getExpensePaymentStatus(exp);
                    return (
                      <div
                        key={exp.id}
                        onClick={() => handleEditExpense(exp)}
                        className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 hover:border-emerald-400 rounded-2xl flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shrink-0">
                            {categoryInfo?.emoji || '🧾'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-base text-slate-900 dark:text-white truncate">
                                {exp.title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                                  paymentInfo.status === 'PAID'
                                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80'
                                    : paymentInfo.status === 'PARTIAL'
                                    ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80'
                                }`}
                              >
                                <span>{paymentInfo.status === 'PAID' ? '✅' : paymentInfo.status === 'PARTIAL' ? '🔄' : '⏳'}</span>
                                <span>
                                  {paymentInfo.status === 'PAID'
                                    ? t('expenses.statusCompleted')
                                    : paymentInfo.status === 'PARTIAL'
                                    ? `${t('expenses.statusPartial')} (${paymentInfo.paidCount}/${paymentInfo.totalDebtors})`
                                    : t('expenses.statusPending')}
                                </span>
                              </span>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400 truncate block mt-0.5">
                              {formatDate(exp.expense_date || exp.created_at)} • Pagó <strong className="text-slate-700 dark:text-slate-200 font-bold">{payerName}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                            {formatMoney(exp.amount, activeGroup?.base_currency || 'EUR')}
                          </div>
                          {exp.split_type === 'ITEMIZED' && (
                            <span className="text-xs uppercase font-bold text-emerald-600 block mt-0.5">Por ítems</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {t('dashboard.tabGroups') || 'Mis Grupos'} ({activeGroups.length})
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="text-sm font-bold text-emerald-600 hover:underline"
                  >
                    + Nuevo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsJoinGroupOpen(true)}
                    className="text-sm font-bold text-slate-500 hover:underline"
                  >
                    Unirse
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {activeGroups.map((g) => {
                  const isSelected = g.id === activeGroup?.id;
                  const gMembers = getGroupMembers(g.id);
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        handleSelectGroup(g.id);
                        setActiveTab('expenses');
                      }}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500 shadow-xs'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {g.cover_image_url ? (
                          <img src={g.cover_image_url} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shrink-0">
                            {g.icon_emoji || '🏖️'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-base text-slate-900 dark:text-white truncate block">
                            {g.name}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 block mt-0.5">
                            {gMembers.length} miembros • {g.base_currency}
                          </span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="px-3 py-1 rounded-full text-sm font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Activo
                        </span>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="space-y-3.5">
              <div className="px-1 text-base font-bold text-slate-800 dark:text-slate-200">
                {t('dashboard.tabOptions') || 'Opciones del Grupo'}
              </div>

              {activeGroup ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(true)}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">Invitar Amigos</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Enlace o código QR de acceso</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                  </button>

                  {debts.length > 0 ? (
                    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-3">
                      <div className="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                        <HandCoins className="w-5 h-5 text-amber-600" />
                        Deudas Pendientes ({debts.length})
                      </div>
                      <div className="space-y-2">
                        {debts.map((d, i) => (
                          <div
                            key={i}
                            onClick={() => setSettlingDebt(d)}
                            className="p-3 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-between text-base cursor-pointer hover:shadow-xs border border-amber-100 dark:border-amber-900/40"
                          >
                            <span className="text-sm font-medium truncate">
                              <strong className="font-bold">{d.from_profile.full_name}</strong> ➔ {d.to_profile.full_name}
                            </span>
                            <span className="font-black text-emerald-600 text-base shrink-0 ml-2">
                              {formatMoney(d.amount, activeGroup.base_currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsEditGroupOpen(true)}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                        <Settings className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">Ajustes del Grupo</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Nombre, foto de portada y moneda</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => exportGroupToPDF(activeGroup, expenses, balances, debts, 'download')}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                        <FileDown className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">Descargar Informe PDF</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Balance y resumen de gastos</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center text-base text-slate-400 font-medium">
                  Selecciona un grupo para ver sus opciones.
                </div>
              )}
            </div>
          )}
        </main>

        {/* FOOTER: 3 Concise Views Navigation Bar (Icon-only) */}
        <footer className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
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
              onClick={() => setActiveTab('groups')}
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
              onClick={() => setActiveTab('options')}
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

      </div>

      {/* MODALS */}
      {isExpenseFormOpen && activeGroup && (
        <ExpenseForm
          groupId={activeGroup.id}
          isOpen={isExpenseFormOpen}
          isMobileView={true}
          onClose={() => {
            setIsExpenseFormOpen(false);
            setEditingExpense(null);
          }}
          expenseToEdit={editingExpense || undefined}
        />
      )}

      {redactionImage && activeGroup && (
        <ReceiptRedactionModal
          isOpen={!!redactionImage}
          onClose={() => setRedactionImage(null)}
          imageSrc={redactionImage}
          onConfirmRedaction={async (censoredDataUrl) => {
            await queueReceiptScan(activeGroup.id, censoredDataUrl);
            setRedactionImage(null);
            addNotification({
              user_id: currentUser.id,
              type: 'receipt_pending',
              title: '⏳ Procesando factura con IA...',
              message: 'Analizando conceptos e importes en segundo plano.',
              group_id: activeGroup.id,
            });
          }}
        />
      )}

      {validatingScan && activeGroup && (
        <ReceiptValidationModal
          isOpen={!!validatingScan}
          onClose={() => setValidatingScan(null)}
          pendingScan={validatingScan}
          groupId={activeGroup.id}
        />
      )}

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={(newGroupId) => {
          handleSelectGroup(newGroupId);
          setIsCreateGroupOpen(false);
        }}
      />

      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
      />

      {activeGroup && (
        <InviteModal
          group={activeGroup}
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
        />
      )}

      {activeGroup && (
        <EditGroupModal
          group={activeGroup}
          isOpen={isEditGroupOpen}
          onClose={() => setIsEditGroupOpen(false)}
        />
      )}

      {settlingDebt && activeGroup && (
        <SettleModal
          groupId={activeGroup.id}
          debt={settlingDebt}
          isOpen={!!settlingDebt}
          onClose={() => setSettlingDebt(null)}
        />
      )}
    </div>
  );
}
