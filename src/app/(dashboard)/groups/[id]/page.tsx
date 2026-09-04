'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePachas, safeGetLocalStorage } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ExpenseCard } from '@/components/expenses/ExpenseCard';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ImportExpensesModal } from '@/components/expenses/ImportExpensesModal';
import { TripRouteMapModal } from '@/components/expenses/TripRouteMapModal';
import { ExpenseChartsModal } from '@/components/expenses/ExpenseChartsModal';
import { ExpenseChartsView } from '@/components/expenses/ExpenseChartsView';
import { ReceiptRedactionModal } from '@/components/expenses/ReceiptRedactionModal';
import { ReceiptValidationModal } from '@/components/expenses/ReceiptValidationModal';
import { PendingScansBanner } from '@/components/expenses/PendingScansBanner';
import { InviteModal } from '@/components/groups/InviteModal';
import { EditGroupModal } from '@/components/groups/EditGroupModal';
import { GroupActionMenu } from '@/components/groups/GroupActionMenu';
import { MemberList } from '@/components/groups/MemberList';
import { GroupChatSection } from '@/components/groups/GroupChatSection';
import { BalanceSummary } from '@/components/balances/BalanceSummary';
import { DebtList } from '@/components/balances/DebtList';
import { CATEGORIES } from '@/lib/categories';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { exportGroupToPDF, exportGroupToCSV } from '@/lib/export';
import { validateAndCompressImage } from '@/lib/security/sanitize';
import { ExpenseCategory, Expense, PendingReceiptScan } from '@/types/database';
import {
  ArrowLeft,
  Plus,
  QrCode,
  FileDown,
  Receipt,
  Users,
  HandCoins,
  History,
  Search,
  UploadCloud,
  Undo2,
  Settings,
  Camera,
  MessageSquare,
  Pencil,
  Compass,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Archive,
  ArchiveRestore,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  UserPlus,
} from 'lucide-react';

type TabType = 'expenses' | 'balances' | 'charts' | 'members' | 'history';
type SortOrder = 'desc' | 'asc';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = params?.id as string;

  const {
    getGroup,
    fetchGroup,
    getGroupMembers,
    getGroupExpenses,
    getGroupSettlements,
    getGroupBalances,
    getGroupDebts,
    currentUser,
    isLoading,
    queueReceiptScan,
    pendingReceiptScans,
    lastImportBatch,
    undoLastImport,
    restoreGroup,
    freezeGroup,
    unfreezeGroup,
    isGroupAdmin,
    isAppAdmin,
    getGroupMessages,
  } = usePachas();
  const { t } = useTranslation();

  const [isFetchingGroup, setIsFetchingGroup] = useState(false);
  const lastFetchedGroupIdRef = useRef<string | null>(null);

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);
  const expenses = getGroupExpenses(groupId);
  const settlements = getGroupSettlements(groupId);
  const balances = getGroupBalances(groupId);
  const debts = getGroupDebts(groupId);

  // Fetch and reconcile group data (including all members and latest changes) from server
  useEffect(() => {
    if (!groupId) return;
    if (lastFetchedGroupIdRef.current === groupId) return;
    lastFetchedGroupIdRef.current = groupId;

    if (!group) {
      setIsFetchingGroup(true);
    }
    fetchGroup(groupId)
      .catch(() => {})
      .finally(() => setIsFetchingGroup(false));
  }, [groupId, fetchGroup, group]);

  // Immediate redirect for banned users
  useEffect(() => {
    if (currentUser?.is_banned) {
      router.replace('/suspended');
    }
  }, [currentUser?.is_banned, router]);

  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [friendsSubTab, setFriendsSubTab] = useState<'list' | 'chat'>('list');

  // Re-fetch fresh members list from server when entering members tab
  useEffect(() => {
    if (activeTab === 'members' && groupId) {
      fetchGroup(groupId).catch(() => {});
    }
  }, [activeTab, groupId, fetchGroup]);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [isChartsModalOpen, setIsChartsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Redaction and Validation states
  const [redactionImage, setRedactionImage] = useState<string | null>(null);
  const [validatingScan, setValidatingScan] = useState<PendingReceiptScan | null>(null);

  // Deep-link handling: Check URL search params for tab, chat, expenseId, and validateScan
  useEffect(() => {
    if (!searchParams) return;

    const requestedTab = searchParams.get('tab');
    if (requestedTab) {
      if (requestedTab === 'friends' || requestedTab === 'members') {
        setActiveTab('members');
      } else if (requestedTab === 'balances' || requestedTab === 'settlements' || requestedTab === 'debts') {
        setActiveTab('balances');
      } else if (requestedTab === 'charts' || requestedTab === 'analytics') {
        setActiveTab('charts');
      } else if (requestedTab === 'history') {
        setActiveTab('history');
      } else if (requestedTab === 'expenses') {
        setActiveTab('expenses');
      }
    }

    const isChat = requestedTab === 'chat' || searchParams.get('chat') === 'true';
    if (isChat) {
      setActiveTab('members');
      setFriendsSubTab('chat');
    }

    const expenseId = searchParams.get('expenseId');
    if (expenseId && expenses.length > 0) {
      const match = expenses.find((e) => e.id === expenseId);
      if (match) {
        setActiveTab('expenses');
        setEditingExpense(match);
        setIsExpenseFormOpen(true);
      }
    }

    const validateScanId = searchParams.get('validateScan');
    if (validateScanId) {
      let match = pendingReceiptScans.find((s) => s.id === validateScanId);
      if (!match && typeof window !== 'undefined') {
        try {
          const raw = safeGetLocalStorage('pachas_pending_scans_v1') || sessionStorage.getItem('pachas_pending_scans_v1');
          if (raw) {
            const list = JSON.parse(raw);
            match = list.find((s: any) => s.id === validateScanId);
          }
        } catch {}
      }
      if (match) {
        setValidatingScan(match);
      }
    }
  }, [searchParams, expenses, pendingReceiptScans]);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const TABS = [
    { id: 'expenses' as TabType, label: `${t('groups.expensesTab')} (${expenses.length})`, shortLabel: `${t('groups.expensesTab')} (${expenses.length})`, icon: Receipt },
    { id: 'balances' as TabType, label: t('groups.balancesTab'), shortLabel: t('balances.balancesTab'), icon: HandCoins, badgeDot: debts.length > 0 },
    { id: 'charts' as TabType, label: t('groups.chartsTab'), shortLabel: t('groups.chartsTab'), icon: BarChart3 },
    { id: 'members' as TabType, label: `${t('groups.membersTab')} (${members.length})`, shortLabel: `${t('groups.membersTab')} (${members.length})`, icon: Users },
    { id: 'history' as TabType, label: `${t('groups.historyTab')} (${settlements.length})`, shortLabel: `${t('groups.historyTab')} (${settlements.length})`, icon: History },
  ];


  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);

  const handlePrevTab = () => {
    if (currentTabIndex > 0) {
      setActiveTab(TABS[currentTabIndex - 1].id);
    }
  };

  const handleNextTab = () => {
    if (currentTabIndex < TABS.length - 1) {
      setActiveTab(TABS[currentTabIndex + 1].id);
    }
  };

  useEffect(() => {
    const currentEl = tabRefs.current[activeTab];
    if (currentEl && tabsContainerRef.current) {
      currentEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  const isAdmin = isGroupAdmin(groupId);

  if ((isLoading || isFetchingGroup) && !group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t('common.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            🏖️
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('groups.groupNotFound')}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {t('groups.groupNotFoundSubtitle')}
          </p>
          <Link href="/dashboard">
            <Button variant="brand" className="w-full">
              {t('groups.backToTrips')}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (group.is_frozen && !isAppAdmin && group.freeze_type !== 'read_only') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="text-center p-8 max-w-lg w-full bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-900/60 shadow-xl rounded-3xl space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center mx-auto text-3xl shadow-xs">
              ❄️
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 font-bold px-3 py-1 rounded-full text-xs">
                {t('groups.frozenBadge') || '❄️ Grupo Congelado por Investigación'}
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white pt-2">
                {t('groups.frozenTitle') || 'Grupo congelado por el administrador'}
              </h2>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {group.name}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto pt-1">
                {group.frozen_reason || t('groups.frozenSubtitle') || 'Este grupo se encuentra bajo investigación de moderación y sus operaciones y contenidos están temporalmente suspendidos en espera de decisión.'}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs text-left space-y-1">
              <span className="font-bold block text-slate-700 dark:text-slate-300">
                🔒 {t('groups.frozenNoticeTitle') || 'Estado de Protección Activo'}
              </span>
              <span>
                {t('groups.frozenNotice') || 'Ningún usuario puede consultar gastos, saldos ni realizar modificaciones en este grupo mientras permanezca congelado.'}
              </span>
            </div>
            <div className="pt-2">
              <Link href="/dashboard">
                <Button variant="brand" className="w-full shadow-md">
                  {t('groups.backToTrips')}
                </Button>
              </Link>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (group.is_archived && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto mb-3 text-3xl">
            📦
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('groups.groupArchived')}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {t('groups.groupArchivedSubtitle')}
          </p>
          <Link href="/dashboard">
            <Button variant="brand" className="w-full">
              {t('groups.backToTrips')}
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const totalSpent = expenses.reduce(
    (sum, e) => sum + (e.converted_amount || e.amount),
    0
  );

  const sortedExpenses = [...expenses].sort((a, b) => {
    const timeA = new Date(a.expense_date || a.created_at).getTime();
    const timeB = new Date(b.expense_date || b.created_at).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const filteredExpenses = sortedExpenses.filter((e) => {
    const matchesCategory =
      selectedCategory === 'all' || e.category === selectedCategory;
    const matchesQuery =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleOpenNewExpense = () => {
    setEditingExpense(null);
    setIsExpenseFormOpen(true);
  };

  const handleFastScanReceipt = async (file: File) => {
    try {
      const compressedDataUrl = await validateAndCompressImage(file, 1200, 0.85);
      setRedactionImage(compressedDataUrl);
    } catch (err: any) {
      console.warn('Error during fast receipt scan:', err);
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28 md:pb-12">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-4 sm:py-6 space-y-5">
        {/* Global Superadmin Inspection Banner */}
        {isAppAdmin && !members.some((m) => m.user_id === currentUser?.id) && (
          <div className="p-4 bg-indigo-500/10 border-2 border-indigo-500/30 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs text-lg">
                🛡️
              </div>
              <div>
                <span className="text-xs font-black text-indigo-900 dark:text-indigo-200 block">
                  Modo Auditoría / Superadministrador
                </span>
                <span className="text-[11px] text-indigo-800/80 dark:text-indigo-300/90 block">
                  Inspeccionando este grupo con privilegios globales de plataforma. Puedes auditar gastos, saldos, chat o moderar el grupo.
                </span>
              </div>
            </div>

            <Link href="/admin">
              <Button size="sm" variant="outline" className="text-xs font-bold shrink-0">
                Volver a Backoffice
              </Button>
            </Link>
          </div>
        )}

        {/* Archived Banner for Admin */}
        {group.is_archived && isAdmin && (
          <div className="p-4 bg-amber-500/15 border-2 border-amber-500/30 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                  {t('groups.groupArchived')}
                </span>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/90 block">
                  {t('groups.groupArchivedSubtitle')}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="brand"
              onClick={async () => {
                await restoreGroup(group.id);
              }}
              className="text-xs font-bold gap-1.5 shrink-0"
            >
              <ArchiveRestore className="w-4 h-4" />
              <span>{t('groups.restoreGroup')}</span>
            </Button>
          </div>
        )}

        {/* Admin Investigation Banner for Frozen Groups */}
        {group.is_frozen && isAppAdmin && (
          <div className="mb-4 p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xl shrink-0">
                ❄️
              </div>
              <div>
                <span className="text-xs font-black text-sky-900 dark:text-sky-200 block">
                  {t('groups.frozenAdminInvestigation') || 'Modo Investigación / Grupo Congelado'}
                </span>
                <span className="text-[11px] text-sky-800/80 dark:text-sky-300/90 block">
                  {group.frozen_reason || t('groups.frozenSubtitle') || 'Grupo congelado bajo investigación. Los miembros regulares no tienen acceso.'}
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="brand"
              onClick={async () => {
                await unfreezeGroup(group.id);
              }}
              className="text-xs font-bold gap-1.5 shrink-0 bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
            >
              <span>🔥 {t('groups.unfreezeAction') || 'Descongelar Grupo'}</span>
            </Button>
          </div>
        )}

        {/* Read-Only Investigation Banner for Members */}
        {group.is_frozen && !isAppAdmin && group.freeze_type === 'read_only' && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
              👁️
            </div>
            <div>
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                {t('groups.frozenReadOnlyTitle') || 'Modo Solo Lectura por Investigación'}
              </span>
              <span className="text-[11px] text-amber-800/80 dark:text-amber-300/90 block">
                {group.frozen_reason || t('groups.frozenSubtitle') || 'Este grupo se encuentra en modo solo lectura en espera de decisión de moderación. Las modificaciones y el chat están suspendidos.'}
              </span>
            </div>
          </div>
        )}

        {/* Back Link & Header Card */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('groups.backToTrips')}
          </Link>

          <div className="relative z-20 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xs">
            {/* Optional Cover Banner */}
            {group.cover_image_url && (
              <div className="relative h-36 sm:h-44 w-full overflow-hidden rounded-t-3xl bg-slate-100 dark:bg-slate-800 group">
                <img
                  src={group.cover_image_url}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <button
                  type="button"
                  onClick={() => setIsEditGroupOpen(true)}
                  className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t('groups.changePhoto')}</span>
                </button>

                {/* Discreet Pexels / Unsplash Attribution Badge */}
                {group.cover_image_url.includes('pexels.com') ? (
                  <a
                    href="https://www.pexels.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2.5 right-3 text-[10px] font-medium text-white/75 hover:text-white bg-black/45 hover:bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1 transition-all z-10 shadow-xs"
                    title="Foto proporcionada por Pexels"
                  >
                    <span>Foto: Pexels</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                  </a>
                ) : group.cover_image_url.includes('unsplash.com') ? (
                  <a
                    href="https://unsplash.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2.5 right-3 text-[10px] font-medium text-white/75 hover:text-white bg-black/45 hover:bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1 transition-all z-10 shadow-xs"
                    title="Foto de Unsplash"
                  >
                    <span>Foto: Unsplash</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                  </a>
                ) : null}
              </div>
            )}

            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Trip Identity */}
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {group.name}
                      </h1>
                      <button
                        type="button"
                        onClick={() => setIsEditGroupOpen(true)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title={t('groups.settings')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <Badge variant="emerald" size="sm">
                        {group.base_currency}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                      <span>{members.length} {t('nav.friends').toLowerCase()}</span>
                      <span>•</span>
                      <span>{expenses.length} {t('nav.expenses').toLowerCase()}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Total: {formatMoney(totalSpent, group.base_currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Primary Add Expense, Secondary Invite, and Submenu */}
                <GroupActionMenu
                  groupId={group.id}
                  onOpenNewExpense={handleOpenNewExpense}
                  onFastScanReceipt={handleFastScanReceipt}
                  onOpenInvite={() => setIsInviteOpen(true)}
                  onOpenSettings={() => setIsEditGroupOpen(true)}
                  onOpenRouteMap={() => setIsRouteMapOpen(true)}
                  onOpenCharts={() => setActiveTab('charts')}
                  onOpenAudit={() => router.push(`/groups/${group.id}/audit`)}
                  onOpenImport={() => setIsImportModalOpen(true)}
                  onDownloadPDF={() => exportGroupToPDF(group, expenses, balances, debts, 'download')}
                  onSharePDF={() => exportGroupToPDF(group, expenses, balances, debts, 'share')}
                  onExportPDF={(mode = 'download') => exportGroupToPDF(group, expenses, balances, debts, mode)}
                  onExportCSV={() => exportGroupToCSV(group, expenses, balances)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pending Scans in Queue Banner */}
        <PendingScansBanner
          groupId={group.id}
          onSelectScanToValidate={(scan) => setValidatingScan(scan)}
        />

        {/* Tab Navigation with Mobile Arrow Controls */}
        <div className="relative flex items-center gap-1.5 sm:gap-2">
          {/* Left Arrow (Prev Tab) */}
          <button
            type="button"
            onClick={handlePrevTab}
            disabled={currentTabIndex === 0}
            aria-label="Pestaña anterior"
            title="Pestaña anterior"
            className={`p-2 rounded-xl border transition-all shrink-0 flex items-center justify-center ${
              currentTabIndex === 0
                ? 'opacity-25 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900/40'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs active:scale-95'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Tabs Track */}
          <div
            ref={tabsContainerRef}
            className="flex-1 flex border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 overflow-x-auto scroll-smooth no-scrollbar py-0.5"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2.5 pt-1.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-t-xl ${
                    isActive
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.badgeDot && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Arrow (Next Tab) */}
          <button
            type="button"
            onClick={handleNextTab}
            disabled={currentTabIndex === TABS.length - 1}
            aria-label="Pestaña siguiente"
            title="Pestaña siguiente"
            className={`p-2 rounded-xl border transition-all shrink-0 flex items-center justify-center ${
              currentTabIndex === TABS.length - 1
                ? 'opacity-25 cursor-not-allowed border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900/40'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs active:scale-95'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tab 1: Gastos */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {/* Banner de Deshacer Importación */}
            {lastImportBatch && lastImportBatch.groupId === group.id && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                      {t('groups.importExpenses')}: {lastImportBatch.count}
                    </span>
                    <span className="text-[11px] text-amber-700/80 dark:text-amber-400 block truncate">
                      {t('groups.importExpensesSubtitle')}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (confirm(`¿Deseas deshacer la importación y eliminar los ${lastImportBatch.count} gastos importados?`)) {
                      const removed = await undoLastImport(group.id);
                      alert(`Se ha deshecho la importación. Se eliminaron ${removed} gastos.`);
                    }
                  }}
                  className="text-xs font-bold bg-white dark:bg-slate-900 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 shrink-0 gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {t('common.cancel')}
                </Button>
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {t('expenses.filterCategory')}
              </button>
              {Object.values(CATEGORIES).map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{t(`categories.${cat.id}` as any) || cat.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input & Sort Order Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder={t('dashboard.searchGroups')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>

              {/* Sort Order Selector */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 pl-2 pr-1 hidden sm:inline-flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  {t('dashboard.sort')}:
                </span>
                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sortOrder === 'desc'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={t('dashboard.newestFirst')}
                >
                  <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                  <span>{t('dashboard.newestFirst')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('asc')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    sortOrder === 'asc'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={t('dashboard.oldestFirst')}
                >
                  <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                  <span>{t('dashboard.oldestFirst')}</span>
                </button>
              </div>
            </div>

            {/* Expenses List */}
            {filteredExpenses.length === 0 ? (
              <Card className="text-center py-12 border-dashed">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
                  🧾
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('expenses.noExpensesTitle')}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  {t('expenses.noExpensesSubtitle')}
                </p>
                <Button variant="brand" onClick={handleOpenNewExpense}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t('expenses.addExpense')}
                </Button>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {/* Column Headers for aligned presentation */}
                <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-100/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-center">{t('expenses.category') || 'Categoría'}</span>
                    <span>{t('common.details') || 'Detalles'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="min-w-[130px] text-right">{t('expenses.amount') || 'Importe'}</span>
                    <span className="w-14 text-right">{t('common.actions') || 'Acciones'}</span>
                  </div>
                </div>

                {filteredExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    baseCurrency={group.base_currency}
                    onEdit={handleEditExpense}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Saldos & Liquidación */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            <BalanceSummary
              group={group}
              balances={balances}
              totalSpent={totalSpent}
            />

            <DebtList group={group} debts={debts} />
          </div>
        )}

        {/* Tab 3: Gráficas & Análisis de Gastos */}
        {activeTab === 'charts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  {t('charts.title')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('charts.subtitle')}
                </p>
              </div>
            </div>

            <Card className="p-4 sm:p-6">
              <ExpenseChartsView
                group={group}
                expenses={expenses}
                members={members}
              />
            </Card>
          </div>
        )}

        {/* Tab 4: Amigos y Chat */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Sub-tab Switcher: Lista de Amigos vs Chat de Grupo */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFriendsSubTab('list')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    friendsSubTab === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('chat.tabMembers') || 'Amigos'} ({members.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFriendsSubTab('chat')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    friendsSubTab === 'chat'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('chat.tabChat') || 'Chat de Grupo'}</span>
                  {getGroupMessages(group.id).length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {getGroupMessages(group.id).length}
                    </span>
                  )}
                </button>
              </div>

              {friendsSubTab === 'list' && (
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => setIsInviteOpen(true)}
                  className="shrink-0 text-xs font-bold gap-1.5"
                >
                  {isAdmin ? <UserPlus className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                  <span>{isAdmin ? (t('groups.addMember') || 'Añadir Amigos') : t('groups.inviteFriends')}</span>
                </Button>
              )}
            </div>

            {friendsSubTab === 'list' ? (
              <Card>
                <MemberList groupId={group.id} members={members} isAdmin={isAdmin} />
              </Card>
            ) : (
              <GroupChatSection
                groupId={group.id}
                groupName={group.name}
                members={members}
                isAdmin={isAdmin}
                targetMessageId={searchParams?.get('messageId') || undefined}
              />
            )}
          </div>
        )}

        {/* Tab 5: Historial de Liquidaciones */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t('balances.historyTitle')}
            </h3>

            {settlements.length === 0 ? (
              <Card className="text-center py-10 border-dashed">
                <p className="text-xs text-slate-500">
                  {t('balances.noHistory')}
                </p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {settlements.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        ✓
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {s.from_profile?.full_name || t('common.friend')} ➔ {s.to_profile?.full_name || t('common.friend')}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{formatDate(s.settled_at, 'dd/MM/yyyy HH:mm')}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-600">
                            {s.payment_method}
                          </span>
                          {s.notes && (
                            <>
                              <span>•</span>
                              <span>{s.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatMoney(s.amount, s.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <Footer />
      <BottomNav onAddClick={handleOpenNewExpense} groupId={group.id} />

      <ExpenseForm
        groupId={group.id}
        isOpen={isExpenseFormOpen}
        onClose={() => {
          setIsExpenseFormOpen(false);
          setEditingExpense(null);
        }}
        expenseToEdit={editingExpense}
      />

      <InviteModal
        group={group}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <ImportExpensesModal
        groupId={group.id}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      <EditGroupModal
        group={group}
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
      />

      <TripRouteMapModal
        group={group}
        expenses={expenses}
        isOpen={isRouteMapOpen}
        onClose={() => setIsRouteMapOpen(false)}
      />

      <ExpenseChartsModal
        group={group}
        expenses={expenses}
        members={members}
        isOpen={isChartsModalOpen}
        onClose={() => setIsChartsModalOpen(false)}
      />

      {/* Pre-OCR Manual Redaction Canvas Modal */}
      {redactionImage && (
        <ReceiptRedactionModal
          isOpen={!!redactionImage}
          onClose={() => setRedactionImage(null)}
          imageSrc={redactionImage}
          onConfirmRedaction={async (censoredDataUrl) => {
            await queueReceiptScan(group.id, censoredDataUrl);
            setRedactionImage(null);
          }}
        />
      )}

      {/* Post-OCR Validation & Approval Modal */}
      {validatingScan && (
        <ReceiptValidationModal
          isOpen={!!validatingScan}
          onClose={() => setValidatingScan(null)}
          pendingScan={validatingScan}
          groupId={group.id}
        />
      )}
    </div>
  );
}
