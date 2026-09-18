'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas, safeGetLocalStorage, safeSetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { useDonationUrl } from '@/lib/useDonationUrl';
import { triggerHaptic } from '@/lib/native/haptics';

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

import { MobileShell } from './MobileShell';
import { MobileNavTab } from './MobileBottomNav';

export interface MobileDashboardViewProps {
  onSwitchToWeb?: () => void;
}

export const MobileDashboardView: React.FC<MobileDashboardViewProps> = ({ onSwitchToWeb }) => {
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
    triggerHaptic('light');
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

  const [activeTab, setActiveTab] = useState<MobileNavTab>('expenses');

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
      triggerHaptic('medium');
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
    triggerHaptic('light');
    setEditingExpense(null);
    setIsExpenseFormOpen(true);
  };

  return (
    <MobileShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onAddExpenseClick={activeGroup ? handleOpenManualExpense : undefined}
      hasActiveGroup={Boolean(activeGroup)}
    >
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Active Group Selector / Switcher */}
          {activeGroups.length > 0 ? (
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsGroupSwitcherOpen(!isGroupSwitcherOpen);
                }}
                className="flex items-center gap-2 max-w-full text-left py-1 px-2 -ml-2 rounded-xl active:bg-slate-100 dark:active:bg-slate-800/60 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                  {activeGroup?.name ? activeGroup.name.slice(0, 2).toUpperCase() : 'PA'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {activeGroup?.name || 'Selecciona un grupo'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block -mt-0.5 truncate">
                    {members.length} {t('dashboard.tabGroups') || 'miembros'}
                  </span>
                </div>
              </button>

              {/* Group Dropdown Modal / Popover */}
              {isGroupSwitcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                    onClick={() => setIsGroupSwitcherOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-72 max-h-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {t('dashboard.switchGroup')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsGroupSwitcherOpen(false);
                          setIsCreateGroupOpen(true);
                        }}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('nav.newGroup')}</span>
                      </button>
                    </div>

                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-60">
                      {activeGroups.map((g) => {
                        const isSelected = g.id === activeGroup?.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              handleSelectGroup(g.id);
                              setIsGroupSwitcherOpen(false);
                            }}
                            className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                                {g.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span
                                className={`text-sm truncate ${
                                  isSelected
                                    ? 'font-bold text-emerald-700 dark:text-emerald-400'
                                    : 'font-medium text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {g.name}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsGroupSwitcherOpen(false);
                          setIsJoinGroupOpen(true);
                        }}
                        className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{t('nav.joinGroup')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-slate-900 dark:text-white">Pachas</span>
            </div>
          )}

          {/* Right Action: User Avatar Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsUserMenuOpen(!isUserMenuOpen);
              }}
              className="relative p-0.5 rounded-full hover:ring-2 hover:ring-emerald-500 transition-all active:scale-95"
            >
              <Avatar profile={currentUser} size="sm" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 p-2 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser.full_name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                </div>

                {onSwitchToWeb && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onSwitchToWeb();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                    <span>Ver versión escritorio</span>
                  </button>
                )}

                <Link
                  href="/profile"
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{t('nav.profile')}</span>
                </Link>

                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Pending Scans Banner */}
        <PendingScansBanner
          onSelectScanToValidate={(scan: PendingReceiptScan) => setValidatingScan(scan)}
        />

        {/* TAB 1: EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {/* Quick Action Capture Buttons */}
            {activeGroup && !activeGroup.is_frozen && (
              <div className="grid grid-cols-3 gap-2.5">
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
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleGalleryChange}
                />

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    cameraInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 active:scale-95 transition-all text-emerald-800 dark:text-emerald-300"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-center leading-tight">
                    {t('dashboard.scanReceiptCamera')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    galleryInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 active:scale-95 transition-all text-teal-800 dark:text-teal-300"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-center leading-tight">
                    {t('dashboard.uploadReceiptImage')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenManualExpense}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 active:scale-95 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center shadow-xs">
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-center leading-tight">
                    {t('dashboard.addExpenseManual')}
                  </span>
                </button>
              </div>
            )}

            {/* Balances Card */}
            {activeGroup && (
              <Card className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-900/10 border-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                    {t('dashboard.totalGroupSpent')}
                  </span>
                  <Badge variant="gray" className="border-slate-700 text-slate-300 text-[11px] py-0.5">
                    {activeGroup.base_currency || 'EUR'}
                  </Badge>
                </div>

                <div className="text-3xl font-black tracking-tight mb-4">
                  {formatMoney(totalGroupSpent, activeGroup.base_currency || 'EUR')}
                </div>

                <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {myNetBalance > 0 ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    ) : myNetBalance < 0 ? (
                      <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        {myNetBalance > 0
                          ? t('dashboard.groupOwesYou')
                          : myNetBalance < 0
                          ? t('dashboard.youOweGroup')
                          : t('dashboard.userSettled')}
                      </span>
                      <span
                        className={`text-sm font-black ${
                          myNetBalance > 0
                            ? 'text-emerald-400'
                            : myNetBalance < 0
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatMoney(Math.abs(myNetBalance), activeGroup.base_currency || 'EUR')}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/groups/${activeGroup.id}?tab=balances`}
                    className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95 transition-all"
                  >
                    <span>{t('groups.balancesTab')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            )}

            {/* Expenses List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  {t('expenses.title')} ({expenses.length})
                </h2>
                {activeGroup && (
                  <Link
                    href={`/groups/${activeGroup.id}`}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Ver detalle</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {expenses.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                    🧾
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {t('dashboard.noExpensesInGroup')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {t('dashboard.welcomeSubtitle')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.slice(0, 15).map((expense) => {
                    const cat = getCategoryInfo(expense.category);
                    const payer = members.find((m) => m.user_id === expense.created_by)?.profile || expense.creator;

                    return (
                      <div
                        key={expense.id}
                        onClick={() => {
                          triggerHaptic('light');
                          setEditingExpense(expense);
                          setIsExpenseFormOpen(true);
                        }}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-lg flex items-center justify-center shrink-0">
                            {cat.emoji}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {expense.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span>{formatDate(expense.expense_date)}</span>
                              <span>•</span>
                              <span className="truncate">
                                {payer?.full_name ? payer.full_name.split(' ')[0] : 'Alguien'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-sm text-slate-900 dark:text-slate-100 block">
                            {formatMoney(expense.amount, expense.currency || activeGroup?.base_currency || 'EUR')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GROUPS */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {t('dashboard.myGroups')} ({activeGroups.length})
              </h2>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsJoinGroupOpen(true)}
                  className="rounded-xl text-xs"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1" />
                  {t('nav.joinGroup')}
                </Button>
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="rounded-xl text-xs font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t('nav.newGroup')}
                </Button>
              </div>
            </div>

            <div className="space-y-2.5">
              {activeGroups.map((g) => {
                const isSelected = g.id === activeGroup?.id;
                const grpMembers = getGroupMembers(g.id);

                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      handleSelectGroup(g.id);
                      setActiveTab('expenses');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {g.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {g.name}
                          </h3>
                          <p className="text-xs text-slate-400 truncate">
                            {grpMembers.length} {t('dashboard.tabGroups') || 'miembros'} • {g.base_currency}
                          </p>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: OPTIONS / SETTINGS */}
        {activeTab === 'options' && (
          <div className="space-y-4">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {t('dashboard.tabOptions')}
            </h2>

            {/* Group-specific actions if active group exists */}
            {activeGroup && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {activeGroup.name}
                </span>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(true)}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {t('groups.inviteFriends')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditGroupOpen(true)}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {t('groups.editGroup')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeGroup) exportGroupToPDF(activeGroup, expenses, balances, debts);
                    }}
                    className="w-full p-3.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileDown className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {t('groups.exportPDF')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            )}

            {/* General App Settings */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t('nav.settings') || 'Ajustes de la aplicación'}
              </span>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {t('auth.preferredLanguage') || 'Idioma'}
                    </span>
                  </div>
                  <LanguageSelector />
                </div>

                {onSwitchToWeb && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ArrowUpRight className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Modo escritorio
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={onSwitchToWeb} className="text-xs rounded-xl">
                      Cambiar a web
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Support / Coffee */}
            {donationUrl && (
              <a
                href={donationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between active:scale-98 transition-all block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-300 block">
                      {t('dashboard.supportProject')}
                    </span>
                    <span className="text-xs text-amber-700/80 dark:text-amber-400/80">
                      Ayúdanos a mantener Pachas activo y sin anuncios
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </a>
            )}
          </div>
        )}
      </main>

      {/* MODALS */}
      {activeGroup && (
        <>
          <ExpenseForm
            groupId={activeGroup.id}
            isOpen={isExpenseFormOpen}
            onClose={() => {
              setIsExpenseFormOpen(false);
              setEditingExpense(null);
            }}
            expenseToEdit={editingExpense}
            isMobileView={true}
          />

          <ReceiptRedactionModal
            isOpen={Boolean(redactionImage)}
            imageSrc={redactionImage || ''}
            onClose={() => setRedactionImage(null)}
            onConfirmRedaction={async (cleanedDataUrl: string) => {
              setRedactionImage(null);
              await queueReceiptScan(activeGroup.id, cleanedDataUrl);
            }}
            isMobileView={true}
          />

          <ReceiptValidationModal
            isOpen={Boolean(validatingScan)}
            pendingScan={validatingScan}
            groupId={activeGroup.id}
            onClose={() => setValidatingScan(null)}
            isMobileView={true}
          />

          <InviteModal
            isOpen={isInviteOpen}
            onClose={() => setIsInviteOpen(false)}
            group={activeGroup}
          />

          <EditGroupModal
            isOpen={isEditGroupOpen}
            onClose={() => setIsEditGroupOpen(false)}
            group={activeGroup}
          />

          <SettleModal
            isOpen={Boolean(settlingDebt)}
            onClose={() => setSettlingDebt(null)}
            debt={settlingDebt}
            groupId={activeGroup.id}
          />
        </>
      )}

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />

      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
      />
    </MobileShell>
  );
};
