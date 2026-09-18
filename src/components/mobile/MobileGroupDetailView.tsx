'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { triggerHaptic } from '@/lib/native/haptics';
import { initNativeMobileApp } from '@/lib/native/nativeApp';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav, MobileNavTab } from './MobileBottomNav';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ReceiptRedactionModal } from '@/components/expenses/ReceiptRedactionModal';
import { ReceiptValidationModal } from '@/components/expenses/ReceiptValidationModal';
import { PendingScansBanner } from '@/components/expenses/PendingScansBanner';
import { InviteModal } from '@/components/groups/InviteModal';
import { EditGroupModal } from '@/components/groups/EditGroupModal';
import { SettleModal } from '@/components/balances/SettleModal';
import { TripRouteMapModal } from '@/components/expenses/TripRouteMapModal';
import { GroupChatSection } from '@/components/groups/GroupChatSection';

import { validateAndCompressImage } from '@/lib/security/sanitize';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/categories';
import { exportGroupToPDF, exportGroupToCSV } from '@/lib/export';
import { Expense, PendingReceiptScan, SimplifiedDebt, Group, GroupMember } from '@/types/database';

import {
  Camera,
  Upload,
  Plus,
  Search,
  ArrowUpDown,
  UserPlus,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileDown,
  Compass,
  History,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  HandCoins,
  MessageSquare,
  Users,
  Archive,
  ArchiveRestore,
  Snowflake,
  Flame,
  Share2,
} from 'lucide-react';

export interface MobileGroupDetailViewProps {
  group: Group;
  onSwitchToWeb?: () => void;
}

export const MobileGroupDetailView: React.FC<MobileGroupDetailViewProps> = ({
  group,
  onSwitchToWeb,
}) => {
  const router = useRouter();
  const {
    getGroupMembers,
    getGroupExpenses,
    getGroupBalances,
    getGroupDebts,
    currentUser,
    queueReceiptScan,
    fetchGroup,
    isGroupAdmin,
    isAppAdmin,
    restoreGroup,
    archiveGroup,
    freezeGroup,
    unfreezeGroup,
    addNotification,
    ocrConfig,
  } = usePachas();
  const { t } = useTranslation();

  const members = getGroupMembers(group.id);
  const expenses = getGroupExpenses(group.id);
  const balances = getGroupBalances(group.id);
  const debts = getGroupDebts(group.id);

  const isAdmin = currentUser ? isGroupAdmin(group.id) : false;

  // Bottom Nav Tab state: expenses | groups (friends & chat) | options (debts & tools)
  const [activeTab, setActiveTab] = useState<MobileNavTab>('expenses');

  // Subtab for Members tab: 'list' or 'chat'
  const [membersSubTab, setMembersSubTab] = useState<'list' | 'chat'>('list');

  // Search & Filter
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Collapsible sections
  const [isAdvancedToolsOpen, setIsAdvancedToolsOpen] = useState(false);

  // Modals state
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [redactionImage, setRedactionImage] = useState<string | null>(null);
  const [validatingScan, setValidatingScan] = useState<PendingReceiptScan | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [settlingDebt, setSettlingDebt] = useState<SimplifiedDebt | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initNativeMobileApp();
  }, []);

  const totalGroupSpent = useMemo(() => {
    return expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [expenses]);

  const myBalance = useMemo(() => {
    if (!currentUser) return null;
    return balances.find((b) => b.user_id === currentUser.id) || null;
  }, [balances, currentUser]);

  const myNetBalance = myBalance?.net_balance || 0;

  // Filter & Sort expenses
  const sortedAndFilteredExpenses = useMemo(() => {
    const list = expenses.filter((e) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.notes || '').toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.expense_date || a.created_at).getTime();
      const timeB = new Date(b.expense_date || b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [expenses, searchQuery, sortOrder]);

  const handleProcessFile = async (file: File) => {
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

  const handleToggleSort = () => {
    triggerHaptic('light');
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Hidden file inputs for Camera and Gallery */}
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

      {/* UNIFIED MOBILE HEADER */}
      <MobileHeader
        activeGroup={group}
        onSelectGroup={(id) => router.push(`/groups/${id}`)}
        onSwitchToWeb={onSwitchToWeb}
      />

      {/* MAIN VIEW CONTENT */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 pt-3 pb-24 space-y-4">
        {/* Pending Scans in Queue Banner */}
        <PendingScansBanner
          groupId={group.id}
          onSelectScanToValidate={(scan) => setValidatingScan(scan)}
        />

        {/* ========================================================================= */}
        {/* TAB 1: GASTOS (EXPENSES) */}
        {/* ========================================================================= */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {/* Balance Card: Large, Clear, High-Contrast */}
            <Card className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-900/10 border-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm uppercase tracking-wider font-bold text-slate-400">
                  {t('dashboard.totalGroupSpent') || 'Gasto total del grupo'}
                </span>
                <Badge variant="gray" className="border-slate-700 text-slate-200 text-sm font-bold px-2.5 py-0.5">
                  {group.base_currency || 'EUR'}
                </Badge>
              </div>

              <div className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white">
                {formatMoney(totalGroupSpent, group.base_currency || 'EUR')}
              </div>

              <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {myNetBalance > 0 ? (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  ) : myNetBalance < 0 ? (
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-slate-300 block leading-tight font-medium">
                      {myNetBalance > 0
                        ? t('dashboard.groupOwesYou') || 'Te deben'
                        : myNetBalance < 0
                        ? t('dashboard.youOweGroup') || 'Debes al grupo'
                        : t('dashboard.userSettled') || 'Estás al día'}
                    </span>
                    <span
                      className={`text-base sm:text-lg font-black ${
                        myNetBalance > 0
                          ? 'text-emerald-400'
                          : myNetBalance < 0
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {formatMoney(Math.abs(myNetBalance), group.base_currency || 'EUR')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('options');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold border border-slate-700 flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  <span>{t('groups.balancesTab') || 'Balances'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </Card>

            {/* ACTION BUTTONS ROW: EXCLUSIVELY ICON-ONLY BUTTONS (min 44px) */}
            {!group.is_frozen && (
              <div className="flex items-center justify-between gap-2.5">
                {/* 1. Camera scan */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    cameraInputRef.current?.click();
                  }}
                  className="flex-1 h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 active:scale-90 transition-transform cursor-pointer"
                  title={t('dashboard.scanReceiptCamera') || 'Escanear factura con cámara'}
                  aria-label={t('dashboard.scanReceiptCamera') || 'Escanear factura con cámara'}
                >
                  <Camera className="w-6 h-6 stroke-[2.2]" />
                </button>

                {/* 2. Gallery Upload */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    galleryInputRef.current?.click();
                  }}
                  className="flex-1 h-13 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/25 active:scale-90 transition-transform cursor-pointer"
                  title={t('dashboard.uploadReceiptImage') || 'Subir imagen de ticket'}
                  aria-label={t('dashboard.uploadReceiptImage') || 'Subir imagen de ticket'}
                >
                  <Upload className="w-6 h-6 stroke-[2.2]" />
                </button>

                {/* 3. Manual Add Expense */}
                <button
                  type="button"
                  onClick={handleOpenManualExpense}
                  className="flex-1 h-13 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center shadow-md shadow-slate-900/20 active:scale-90 transition-transform cursor-pointer"
                  title={t('dashboard.addExpenseManual') || 'Añadir gasto manual'}
                  aria-label={t('dashboard.addExpenseManual') || 'Añadir gasto manual'}
                >
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </button>

                {/* 4. Search Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setIsSearchOpen(!isSearchOpen);
                  }}
                  className={`flex-1 h-13 rounded-2xl flex items-center justify-center border transition-all active:scale-90 cursor-pointer shadow-2xs ${
                    isSearchOpen || searchQuery
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                  title={t('dashboard.searchGroups') || 'Buscar gastos'}
                  aria-label={t('dashboard.searchGroups') || 'Buscar gastos'}
                >
                  <Search className="w-6 h-6 stroke-[2.2]" />
                </button>

                {/* 5. Sort Order Toggle */}
                <button
                  type="button"
                  onClick={handleToggleSort}
                  className="flex-1 h-13 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-2xs active:scale-90 transition-transform cursor-pointer"
                  title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
                  aria-label="Alternar orden"
                >
                  <ArrowUpDown className="w-6 h-6 stroke-[2.2]" />
                </button>
              </div>
            )}

            {/* Collapsible Search Input */}
            {isSearchOpen && (
              <div className="p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('dashboard.searchGroups') || 'Buscar gastos por concepto o notas...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            )}

            {/* EXPENSES LIST: Large legible cards */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm uppercase font-black tracking-wider text-slate-400">
                  {t('expenses.title') || 'Gastos del Grupo'} ({sortedAndFilteredExpenses.length})
                </h2>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>

              {sortedAndFilteredExpenses.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-xs">
                    🧾
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                    {t('dashboard.noExpensesInGroup') || 'Aún no hay gastos registrados en este grupo.'}
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Pulsa el botón de cámara o el botón + para registrar el primer gasto.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedAndFilteredExpenses.map((expense) => {
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
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform cursor-pointer shadow-xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-2xl flex items-center justify-center shrink-0 shadow-2xs">
                            {cat.emoji}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                              {expense.title}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{formatDate(expense.expense_date)}</span>
                              <span>•</span>
                              <span className="truncate">
                                {payer?.full_name ? payer.full_name.split(' ')[0] : 'Alguien'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-lg text-slate-900 dark:text-slate-100 block">
                            {formatMoney(expense.amount, expense.currency || group.base_currency || 'EUR')}
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

        {/* ========================================================================= */}
        {/* TAB 2: AMIGOS Y CHAT (GROUPS / MEMBERS) */}
        {/* ========================================================================= */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            {/* Subtab Segmented Switcher: Amigos vs Chat */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMembersSubTab('list');
                }}
                className={`py-2.5 rounded-xl text-base font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  membersSubTab === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>{t('nav.friends') || 'Amigos'} ({members.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMembersSubTab('chat');
                }}
                className={`py-2.5 rounded-xl text-base font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  membersSubTab === 'chat'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat</span>
              </button>
            </div>

            {/* Subtab Content: Friends List */}
            {membersSubTab === 'list' && (
              <div className="space-y-3">
                {/* Invite Friends Big Action Card */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    setIsInviteOpen(true);
                  }}
                  className="w-full p-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-between text-left shadow-md shadow-emerald-500/25 active:scale-98 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0">
                      <UserPlus className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-base font-black">
                        {t('groups.inviteFriends') || 'Invitar Amigos al Grupo'}
                      </div>
                      <div className="text-xs text-emerald-100 mt-0.5">
                        Comparte el código o enlace personal de reclamo
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0" />
                </button>

                {/* Members list */}
                <div className="space-y-2">
                  {members.map((member) => {
                    const isCurrentUser = member.user_id === currentUser?.id;
                    const memberBal = balances.find((b) => b.user_id === member.user_id);
                    const net = memberBal?.net_balance || 0;

                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Avatar profile={member.profile} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-slate-900 dark:text-white truncate">
                                {member.profile?.full_name || 'Amigo'}
                              </span>
                              {isCurrentUser && (
                                <Badge variant="gray" size="sm" className="text-xs font-bold px-2 py-0.5">
                                  Tú
                                </Badge>
                              )}
                              {member.role === 'admin' && (
                                <Badge variant="emerald" size="sm" className="text-xs font-bold px-2 py-0.5">
                                  Admin
                                </Badge>
                              )}
                              {member.is_unclaimed && (
                                <Badge variant="amber" size="sm" className="text-xs font-bold px-2 py-0.5">
                                  Provisional
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400 truncate block mt-0.5">
                              {member.profile?.email || 'Sin correo asociado'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-black text-base ${
                              net > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : net < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {net > 0 ? '+' : ''}
                            {formatMoney(net, group.base_currency || 'EUR')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subtab Content: Group Chat */}
            {membersSubTab === 'chat' && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <GroupChatSection groupId={group.id} members={members} />
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: OPCIONES Y BALANCES (OPTIONS & DEBTS) */}
        {/* ========================================================================= */}
        {activeTab === 'options' && (
          <div className="space-y-4">
            {/* 1. DEBTS & SETTLEMENTS (WHO OWES WHOM) */}
            <div className="space-y-2.5">
              <span className="text-sm font-black uppercase tracking-wider text-slate-400 px-1 block">
                Balances y Liquidación de Deudas
              </span>

              {debts.length === 0 ? (
                <Card className="p-5 text-center rounded-2xl bg-white dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="text-2xl mb-1">🎉</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    ¡Todos los pagos están al día!
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    No existen deudas pendientes entre los miembros del viaje.
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {debts.map((debt, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-medium text-slate-800 dark:text-slate-200 truncate">
                          <strong className="font-extrabold text-slate-900 dark:text-white">
                            {debt.from_profile?.full_name?.split(' ')[0] || 'Deudor'}
                          </strong>{' '}
                          ➔ {debt.to_profile?.full_name?.split(' ')[0] || 'Acreedor'}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          Saldo simplificado de cuentas
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                          {formatMoney(debt.amount, group.base_currency || 'EUR')}
                        </span>

                        {/* Icon-only settle debt button (44px) */}
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('medium');
                            setSettlingDebt(debt);
                          }}
                          className="w-11 h-11 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-2xs"
                          title="Liquidar deuda"
                          aria-label="Liquidar deuda"
                        >
                          <HandCoins className="w-5 h-5 stroke-[2.2]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. GROUP ACTIONS: Invite & Settings (Visible by default) */}
            <div className="space-y-2.5 pt-1">
              <span className="text-sm font-black uppercase tracking-wider text-slate-400 px-1 block">
                {t('dashboard.tabOptions') || 'Opciones del Grupo'}
              </span>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsInviteOpen(true);
                }}
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {t('groups.inviteFriends') || 'Invitar amigos'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Código QR, enlace o contactos
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsEditGroupOpen(true);
                }}
                className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {t('groups.editGroup') || 'Ajustes del Grupo'}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Nombre, foto de portada y moneda base
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              </button>
            </div>

            {/* 3. COLLAPSED ACCORDION: ADVANCED TOOLS (PDF, CSV, Map, Audit, Administration) */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAdvancedToolsOpen(!isAdvancedToolsOpen);
                }}
                className="w-full p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="text-base font-black text-slate-800 dark:text-slate-200">
                  {t('groups.advancedTools')}
                </span>
                {isAdvancedToolsOpen ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {isAdvancedToolsOpen && (
                <div className="mt-2.5 space-y-2 animate-in fade-in slide-in-from-top-2">
                  {/* Export PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      exportGroupToPDF(group, expenses, balances, debts, 'download');
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center shrink-0">
                        <FileDown className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {t('groups.exportPdf')}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Balance, gráficos y resumen</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Share PDF */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      exportGroupToPDF(group, expenses, balances, debts, 'share');
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          Compartir PDF por apps
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Enviar por WhatsApp o email</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Export CSV */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      exportGroupToCSV(group, expenses, balances);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileDown className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {t('groups.exportCsv')}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Hoja de cálculo completa</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Trip Route Map */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setIsRouteMapOpen(true);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {t('groups.gpsRoute')}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Ver gastos geolocalizados</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Audit History */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      router.push(`/groups/${group.id}/audit`);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <History className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {t('groups.historyTab')}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Registro de cambios y ediciones</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>

                  {/* Admin Zone: Archive / Freeze */}
                  {isAdmin && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <button
                        type="button"
                        onClick={async () => {
                          triggerHaptic('medium');
                          if (group.is_archived) {
                            await restoreGroup(group.id);
                          } else {
                            if (confirm(t('groups.archiveConfirm') || '¿Seguro que deseas archivar este grupo?')) {
                              await archiveGroup(group.id);
                            }
                          }
                        }}
                        className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-sm font-bold flex items-center gap-2 hover:bg-slate-200 cursor-pointer"
                      >
                        {group.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        <span>{group.is_archived ? 'Restaurar grupo' : 'Archivar grupo'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* UNIFIED MOBILE BOTTOM NAV: 3 big icon buttons (Receipt, Users, Settings) */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* MODALS */}
      {isExpenseFormOpen && (
        <ExpenseForm
          groupId={group.id}
          isOpen={isExpenseFormOpen}
          isMobileView={true}
          onClose={() => {
            setIsExpenseFormOpen(false);
            setEditingExpense(null);
          }}
          expenseToEdit={editingExpense || undefined}
        />
      )}

      {redactionImage && (
        <ReceiptRedactionModal
          isOpen={!!redactionImage}
          onClose={() => setRedactionImage(null)}
          imageSrc={redactionImage}
          isMobileView={true}
          onConfirmRedaction={async (censoredDataUrl) => {
            await queueReceiptScan(group.id, censoredDataUrl);
            setRedactionImage(null);
            const engineName = ocrConfig?.provider === 'gemini' ? 'Google Gemini' : 'Ollama Vision';
            addNotification({
              user_id: currentUser?.id || '',
              type: 'receipt_pending',
              title: `⏳ Procesando factura con ${engineName}...`,
              message: 'Analizando conceptos e importes en segundo plano.',
              group_id: group.id,
            });
          }}
        />
      )}

      {validatingScan && (
        <ReceiptValidationModal
          isOpen={!!validatingScan}
          onClose={() => setValidatingScan(null)}
          pendingScan={validatingScan}
          groupId={group.id}
          isMobileView={true}
        />
      )}

      <InviteModal
        group={group}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <EditGroupModal
        group={group}
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
      />

      {isRouteMapOpen && (
        <TripRouteMapModal
          isOpen={isRouteMapOpen}
          onClose={() => setIsRouteMapOpen(false)}
          expenses={expenses}
          group={group}
        />
      )}

      {settlingDebt && (
        <SettleModal
          groupId={group.id}
          debt={settlingDebt}
          isOpen={!!settlingDebt}
          onClose={() => setSettlingDebt(null)}
        />
      )}
    </div>
  );
};
