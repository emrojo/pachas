'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { Expense, SupportMessage } from '@/types/database';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Send,
  Activity,
  Users,
  Compass,
  PieChart,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  DollarSign,
  MessageSquare,
  Bell,
  Check,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';

interface MetricsData {
  systemInfo: {
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
  };
  healthServices: Array<{
    id: string;
    name: string;
    status: 'healthy' | 'warning' | 'error';
    latencyMs: number;
    details: string;
  }>;
  totals: {
    totalUsers: number;
    totalGroups: number;
    activeGroups: number;
    archivedGroups: number;
    totalExpenses: number;
    totalVolumeEur: number;
    totalSettlements: number;
    totalSettledEur: number;
    totalComments: number;
    totalPushSubscriptions: number;
  };
  featureUsage: {
    ocr: {
      ocrScannedExpenses: number;
      manualExpenses: number;
      ocrPercentage: number;
    };
    splitTypes: {
      equal: number;
      exact: number;
      percentage: number;
      shares: number;
    };
    paymentMethods: {
      BIZUM: number;
      CASH: number;
      REVOLUT: number;
      BANK_TRANSFER: number;
      OTHER: number;
    };
    topCurrencies: Array<{ currency: string; count: number }>;
  };
  usersList: Array<{
    id: string;
    full_name: string;
    email: string;
    role: 'admin' | 'member';
    bizum_phone?: string;
    avatar_url?: string;
    is_banned?: boolean;
    banned_at?: string | null;
    ban_reason?: string | null;
    created_at: string;
    groups_count: number;
    expenses_count: number;
    has_push: boolean;
  }>;
  groupsList: Array<{
    id: string;
    name: string;
    description?: string;
    icon_emoji: string;
    base_currency: string;
    is_archived: boolean;
    is_frozen?: boolean;
    frozen_reason?: string | null;
    created_at: string;
    creator_name?: string;
    members_count: number;
    expenses_count: number;
    total_amount: number;
  }>;
  anomalies: Array<{
    id: string;
    level: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
  }>;
}

export interface ContentReport {
  id: string;
  target_type: string;
  target_id: string;
  target_title?: string;
  target_url?: string;
  group_id?: string;
  reason: string;
  details?: string;
  reporter_id?: string;
  reporter_email?: string;
  reporter_name?: string;
  reporter_avatar?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  resolution_notes?: string | null;
  evidence_snapshot?: any;
  created_at: string;
}

export default function AdminBackofficePage() {
  const router = useRouter();
  const {
    currentUser,
    isAppAdmin,
    groups,
    getGroupMembers,
    getGroupExpenses,
    getGroupSettlements,
    availableUsers,
    freezeGroup,
    unfreezeGroup,
    deleteExpense,
    isGroupFrozen,
    banUser,
    unbanUser,
    sendSupportMessage,
  } = usePachas();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'health' | 'users' | 'groups' | 'analytics' | 'anomalies' | 'reports' | 'support'>('health');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'dismissed'>('all');
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [inspectingExpense, setInspectingExpense] = useState<{ expense: Expense; groupId: string } | null>(null);
  const [isInspectingExpenseId, setIsInspectingExpenseId] = useState<string | null>(null);
  const [freezingGroupId, setFreezingGroupId] = useState<string | null>(null);
  const [freezeReason, setFreezeReason] = useState('Bajo investigación por disputa de gastos / moderación');
  const [freezeType, setFreezeType] = useState<'full' | 'read_only'>('full');
  const [isFreezingSubmitting, setIsFreezingSubmitting] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [resolvingReport, setResolvingReport] = useState<{ report: ContentReport; targetStatus: 'reviewed' | 'action_taken' | 'dismissed' } | null>(null);
  const [resolutionNotesInput, setResolutionNotesInput] = useState('');

  // Support Chat States
  const [supportConversations, setSupportConversations] = useState<any[]>([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState<string | null>(null);
  const [supportThreadMessages, setSupportThreadMessages] = useState<SupportMessage[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isSendingAdminReply, setIsSendingAdminReply] = useState(false);

  // User Ban States
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [banReasonInput, setBanReasonInput] = useState('Infracción de las normas de convivencia / conducta inapropiada');
  const [isBanSubmitting, setIsBanSubmitting] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any[] | null>(null);

  const handleFreezeGroup = async (groupId: string, reason?: string, type?: 'full' | 'read_only') => {
    setIsFreezingSubmitting(true);
    try {
      await freezeGroup(groupId, reason || freezeReason, type || freezeType);
      setFreezingGroupId(null);
      setFreezeReason('Bajo investigación por disputa de gastos / moderación');
      setFreezeType('full');
      fetchMetrics();
      fetchReports();
    } catch (e: any) {
      alert(e.message || 'Error al congelar grupo');
    } finally {
      setIsFreezingSubmitting(false);
    }
  };

  const handleUnfreezeGroup = async (groupId: string) => {
    try {
      await unfreezeGroup(groupId);
      fetchMetrics();
      fetchReports();
    } catch (e: any) {
      alert(e.message || 'Error al descongelar grupo');
    }
  };

  const handleDeleteReportedExpense = async (reportId: string, expenseId: string, groupId?: string | null) => {
    if (!confirm('¿Seguro que deseas eliminar este gasto denunciado? Esta acción guardará una copia de seguridad como evidencia y no se puede deshacer.')) {
      return;
    }
    setDeletingExpenseId(expenseId);
    try {
      let expenseSnapshot: any = null;
      if (groupId) {
        const localExpenses = getGroupExpenses(groupId) || [];
        expenseSnapshot = localExpenses.find((e) => e.id === expenseId);
      }

      if (groupId) {
        await deleteExpense(groupId, expenseId);
      } else {
        await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      }

      await handleUpdateReportStatus(
        reportId,
        'action_taken',
        'Gasto eliminado por moderación tras confirmarse infracción de normas.',
        expenseSnapshot ? { expense: expenseSnapshot, deleted_at: new Date().toISOString(), deleted_by: currentUser?.full_name || 'Admin' } : undefined
      );
      fetchReports();
      fetchMetrics();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar gasto');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleInspectExpense = async (targetId: string, groupId?: string | null) => {
    setIsInspectingExpenseId(targetId);
    try {
      if (groupId) {
        const localExpenses = getGroupExpenses(groupId) || [];
        const found = localExpenses.find((e) => e.id === targetId);
        if (found) {
          setInspectingExpense({ expense: found, groupId });
          setIsInspectingExpenseId(null);
          return;
        }
      } else {
        for (const g of groups || []) {
          const found = (getGroupExpenses(g.id) || []).find((e) => e.id === targetId);
          if (found) {
            setInspectingExpense({ expense: found, groupId: g.id });
            setIsInspectingExpenseId(null);
            return;
          }
        }
      }

      const res = await fetch(`/api/expenses/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.expense) {
          setInspectingExpense({ expense: data.expense, groupId: data.expense.group_id });
          setIsInspectingExpenseId(null);
          return;
        }
      }
    } catch (e) {
      console.error('Error fetching expense for inspection in admin:', e);
    } finally {
      setIsInspectingExpenseId(null);
    }
  };

  // Filter & search states
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'active' | 'archived' | 'frozen'>('all');
  const [updatingUserRole, setUpdatingUserRole] = useState<string | null>(null);

  // Enrich server metrics with local state if DB is running in local/demo mode or tables are partially empty
  const enrichMetrics = (serverData: MetricsData): MetricsData => {
    const hasServerUsers = Boolean(serverData.usersList && serverData.usersList.length > 0);
    const hasServerGroups = Boolean(serverData.groupsList && serverData.groupsList.length > 0);

    // If server has both real users and groups in PostgreSQL, return server data
    if (hasServerUsers && hasServerGroups) {
      return serverData;
    }

    // Otherwise, build from client-side state
    const allExpensesList = (groups || []).flatMap((g) => getGroupExpenses(g.id) || []);
    const allSettlementsList = (groups || []).flatMap((g) => getGroupSettlements(g.id) || []);

    const userMap = new Map<string, any>();
    (availableUsers || []).forEach((u) => {
      userMap.set(u.id, {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: (u.role || 'member') as 'admin' | 'member',
        bizum_phone: u.bizum_phone,
        avatar_url: u.avatar_url,
        created_at: u.created_at || '2026-06-01T10:00:00Z',
        groups_count: 0,
        expenses_count: 0,
        has_push: false,
      });
    });

    if (currentUser && !userMap.has(currentUser.id)) {
      userMap.set(currentUser.id, {
        id: currentUser.id,
        full_name: currentUser.full_name,
        email: currentUser.email,
        role: (currentUser.role || 'admin') as 'admin' | 'member',
        bizum_phone: currentUser.bizum_phone,
        avatar_url: currentUser.avatar_url,
        created_at: currentUser.created_at || new Date().toISOString(),
        groups_count: 0,
        expenses_count: 0,
        has_push: true,
      });
    }

    const clientGroupsList = (groups || []).map((g) => {
      const grpMembers = getGroupMembers(g.id) || [];
      const grpExpenses = getGroupExpenses(g.id) || [];
      const totalAmount = grpExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const creator = userMap.get(g.created_by);

      grpMembers.forEach((m: any) => {
        if (m.profile && !userMap.has(m.user_id)) {
          userMap.set(m.user_id, {
            id: m.user_id,
            full_name: m.profile.full_name,
            email: m.profile.email,
            role: (m.profile.role || 'member') as 'admin' | 'member',
            bizum_phone: m.profile.bizum_phone,
            avatar_url: m.profile.avatar_url,
            created_at: m.joined_at,
            groups_count: 1,
            expenses_count: 0,
            has_push: false,
          });
        } else if (userMap.has(m.user_id)) {
          const existing = userMap.get(m.user_id);
          existing.groups_count = (existing.groups_count || 0) + 1;
        }
      });

      grpExpenses.forEach((e: any) => {
        if (e.created_by && userMap.has(e.created_by)) {
          const existing = userMap.get(e.created_by);
          existing.expenses_count = (existing.expenses_count || 0) + 1;
        }
      });

      return {
        id: g.id,
        name: g.name,
        description: g.description || undefined,
        icon_emoji: g.icon_emoji,
        base_currency: g.base_currency || 'EUR',
        is_archived: Boolean(g.is_archived),
        is_frozen: Boolean(g.is_frozen),
        frozen_reason: g.frozen_reason || null,
        created_at: g.created_at,
        creator_name: creator?.full_name || 'Admin',
        members_count: grpMembers.length,
        expenses_count: grpExpenses.length,
        total_amount: Math.round(totalAmount * 100) / 100,
      };
    });

    const clientUsersList = Array.from(userMap.values());

    const totalExp = allExpensesList.length;
    const ocrExp = allExpensesList.filter((e: any) => e.receipt_url && e.receipt_url.length > 0).length;
    const totalVolEur = allExpensesList.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const totalSettleEur = allSettlementsList.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);

    const splitTypes = {
      equal: allExpensesList.filter((e: any) => !e.split_type || e.split_type === 'EQUAL').length,
      exact: allExpensesList.filter((e: any) => e.split_type === 'EXACT').length,
      percentage: allExpensesList.filter((e: any) => e.split_type === 'PERCENTAGE').length,
      shares: allExpensesList.filter((e: any) => e.split_type === 'SHARES').length,
    };

    const paymentMethods = {
      BIZUM: allSettlementsList.filter((s: any) => s.payment_method === 'BIZUM').length,
      CASH: allSettlementsList.filter((s: any) => s.payment_method === 'CASH').length,
      REVOLUT: allSettlementsList.filter((s: any) => s.payment_method === 'REVOLUT').length,
      BANK_TRANSFER: allSettlementsList.filter((s: any) => s.payment_method === 'BANK_TRANSFER').length,
      OTHER: allSettlementsList.filter((s: any) => s.payment_method === 'OTHER').length,
    };

    const currencyCounts: Record<string, number> = {};
    allExpensesList.forEach((e: any) => {
      const c = e.currency || 'EUR';
      currencyCounts[c] = (currencyCounts[c] || 0) + 1;
    });
    const topCurrencies = Object.entries(currencyCounts).map(([currency, count]) => ({ currency, count }));

    return {
      ...serverData,
      totals: {
        totalUsers: clientUsersList.length,
        totalGroups: clientGroupsList.length,
        activeGroups: clientGroupsList.filter((g) => !g.is_archived).length,
        archivedGroups: clientGroupsList.filter((g) => g.is_archived).length,
        totalExpenses: totalExp,
        totalVolumeEur: Math.round(totalVolEur * 100) / 100,
        totalSettlements: allSettlementsList.length,
        totalSettledEur: Math.round(totalSettleEur * 100) / 100,
        totalComments: 0,
        totalPushSubscriptions: serverData.totals?.totalPushSubscriptions || 1,
      },
      featureUsage: {
        ocr: {
          ocrScannedExpenses: ocrExp,
          manualExpenses: totalExp - ocrExp,
          ocrPercentage: totalExp > 0 ? Math.round((ocrExp / totalExp) * 100) : 0,
        },
        splitTypes,
        paymentMethods,
        topCurrencies: topCurrencies.length > 0 ? topCurrencies : [{ currency: 'EUR', count: totalExp }],
      },
      usersList: clientUsersList.length > 0 ? clientUsersList : serverData.usersList,
      groupsList: clientGroupsList,
    };
  };

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(enrichMetrics(data));
      }
    } catch (err) {
      console.warn('Error fetching admin metrics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchReports = async () => {
    try {
      setIsLoadingReports(true);
      const res = await fetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        if (data?.reports && Array.isArray(data.reports)) {
          setReports(data.reports);
        }
      }
    } catch (err) {
      console.warn('Error fetching reports:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleUpdateReportStatus = async (
    reportId: string,
    newStatus: string,
    resolutionNotes?: string,
    evidenceSnapshot?: any
  ) => {
    try {
      setUpdatingReportId(reportId);
      const res = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status: newStatus,
          resolutionNotes,
          evidenceSnapshot,
        }),
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: newStatus as any,
                  resolution_notes: resolutionNotes !== undefined ? resolutionNotes : r.resolution_notes,
                  evidence_snapshot: evidenceSnapshot !== undefined ? evidenceSnapshot : r.evidence_snapshot,
                }
              : r
          )
        );
      }
    } catch (err) {
      console.warn('Error updating report status:', err);
    } finally {
      setUpdatingReportId(null);
      setResolvingReport(null);
      setResolutionNotesInput('');
    }
  };

  const fetchSupportConversations = async () => {
    try {
      setIsLoadingSupport(true);
      const res = await fetch('/api/support/messages?conversations=true');
      if (res.ok) {
        const data = await res.json();
        setSupportConversations(data.conversations || []);
        if (data.conversations?.length > 0 && !selectedSupportUserId) {
          fetchUserSupportThread(data.conversations[0].user_id);
        }
      }
    } catch (err) {
      console.warn('Error fetching support conversations:', err);
    } finally {
      setIsLoadingSupport(false);
    }
  };

  const fetchUserSupportThread = async (userId: string) => {
    try {
      setSelectedSupportUserId(userId);
      const res = await fetch(`/api/support/messages?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSupportThreadMessages(data.messages || []);
        // Mark as read by admin
        fetch('/api/support/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Error fetching support thread:', err);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !selectedSupportUserId || isSendingAdminReply) return;

    setIsSendingAdminReply(true);
    try {
      await sendSupportMessage(adminReplyText.trim(), 'general', selectedSupportUserId);
      setAdminReplyText('');
      await fetchUserSupportThread(selectedSupportUserId);
      fetchSupportConversations();
    } catch (err) {
      console.error('Error sending admin reply:', err);
    } finally {
      setIsSendingAdminReply(false);
    }
  };

  const handleBanUserAction = async (userId: string, reason?: string) => {
    setIsBanSubmitting(true);
    try {
      const success = await banUser(userId, reason || banReasonInput);
      if (success) {
        setBanningUserId(null);
        setBanReasonInput('Infracción de las normas de convivencia / conducta inapropiada');
        fetchMetrics();
        fetchReports();
        if (selectedSupportUserId === userId) {
          fetchUserSupportThread(userId);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error al banear usuario');
    } finally {
      setIsBanSubmitting(false);
    }
  };

  const handleUnbanUserAction = async (userId: string) => {
    try {
      const success = await unbanUser(userId);
      if (success) {
        fetchMetrics();
        fetchReports();
        if (selectedSupportUserId === userId) {
          fetchUserSupportThread(userId);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error al desbanear usuario');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const userParam = params.get('userId');
      if (tabParam && ['health', 'users', 'groups', 'analytics', 'anomalies', 'reports', 'support'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
      if (userParam) {
        fetchUserSupportThread(userParam);
      }
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchReports();
    if (activeTab === 'support') {
      fetchSupportConversations();
    }
  }, [groups, availableUsers, activeTab]);

  const handleRunDiagnostics = async () => {
    if (isRunningDiagnostics) return;
    try {
      setIsRunningDiagnostics(true);
      const res = await fetch('/api/admin/health-check', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsResult(data.results);
        // Refresh metrics too
        await fetchMetrics();
      }
    } catch (err) {
      console.warn('Error running diagnostics:', err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: 'admin' | 'member') => {
    const nextRole = currentRole === 'admin' ? 'member' : 'admin';
    if (!confirm(`¿Seguro que deseas cambiar el rol de este usuario a "${nextRole}"?`)) return;

    try {
      setUpdatingUserRole(userId);
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });

      if (res.ok) {
        // Optimistically update in state
        if (metrics) {
          setMetrics({
            ...metrics,
            usersList: metrics.usersList.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)),
          });
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Error al actualizar el rol del usuario.');
      }
    } catch (err: any) {
      alert(err.message || 'Error de conexión');
    } finally {
      setUpdatingUserRole(null);
    }
  };

  // Helper formatting
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  // Access check guard
  const hasAdminAccess = isAppAdmin || currentUser?.role === 'admin';

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('admin.accessDeniedTitle') || 'Acceso Denegado'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('admin.accessDeniedDesc') || 'Esta sección es exclusiva para el Administrador del sistema de Pachas.'}
            </p>
            <Button
              variant="brand"
              onClick={() => router.push('/dashboard')}
              className="w-full justify-center mt-2"
            >
              {t('admin.backToDashboard') || 'Volver a Mis Grupos'}
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Filtered users & groups
  const filteredUsers = (metrics?.usersList || []).filter((u) => {
    const q = (userSearch || '').trim().toLowerCase();
    const matchesQuery =
      !q ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.bizum_phone && u.bizum_phone.toLowerCase().includes(q));

    if (userStatusFilter === 'active') return matchesQuery && !u.is_banned;
    if (userStatusFilter === 'banned') return matchesQuery && Boolean(u.is_banned);
    return Boolean(matchesQuery);
  });

  const filteredGroups = (metrics?.groupsList || []).filter((g) => {
    const q = groupSearch.toLowerCase();
    const matchesQuery = g.name.toLowerCase().includes(q) || (g.creator_name && g.creator_name.toLowerCase().includes(q));
    if (groupFilter === 'active') return matchesQuery && !g.is_archived && !g.is_frozen;
    if (groupFilter === 'archived') return matchesQuery && g.is_archived;
    if (groupFilter === 'frozen') return matchesQuery && g.is_frozen;
    return matchesQuery;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-1 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {t('admin.backofficeTitle') || 'Panel de Administración'}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Superadmin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {t('admin.backofficeSubtitle') || 'Supervisión en vivo de salud del servicio, usuarios, grupos y analítica de uso.'}
            </p>
          </div>

          <div className="flex items-center gap-2 z-10 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              isLoading={isRefreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-1.5 flex-1 sm:flex-initial"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar</span>
            </Button>

            <Button
              variant="brand"
              size="sm"
              onClick={handleRunDiagnostics}
              isLoading={isRunningDiagnostics}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs gap-1.5 shadow-lg shadow-emerald-500/20 flex-1 sm:flex-initial"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isRunningDiagnostics ? t('admin.runningDiagnostics') : t('admin.runDiagnostics')}</span>
            </Button>
          </div>
        </div>

        {/* Top KPIs Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold">{t('admin.totalUsers') || 'Usuarios Totales'}</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {metrics?.totals.totalUsers ?? '...'}
              </span>
              <Badge variant="blue" size="sm">
                Registrados
              </Badge>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold">{t('admin.totalGroups') || 'Grupos Creados'}</span>
              <Compass className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {metrics?.totals.totalGroups ?? '...'}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {metrics?.totals.activeGroups ?? 0} activos
              </span>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold">{t('admin.totalVolume') || 'Volumen Total'}</span>
              <DollarSign className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {formatCurrency(metrics?.totals.totalVolumeEur ?? 0)}
              </span>
              <Badge variant="emerald" size="sm">
                € Total
              </Badge>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-semibold">{t('admin.totalExpenses') || 'Gastos Totales'}</span>
              <Sparkles className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {metrics?.totals.totalExpenses ?? '...'}
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold">
                {metrics?.featureUsage.ocr.ocrPercentage ?? 0}% con IA
              </span>
            </div>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'health'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>{t('admin.tabHealth') || 'Estado del Servicio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-500" />
            <span>{t('admin.tabUsers') || 'Usuarios'} ({metrics?.totals.totalUsers ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'groups'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-500" />
            <span>{t('admin.tabGroups') || 'Grupos y Viajes'} ({metrics?.totals.totalGroups ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-4 h-4 text-purple-500" />
            <span>{t('admin.tabAnalytics') || 'Analítica de Uso'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anomalies')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'anomalies'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>{t('admin.tabAnomalies') || 'Incidencias'}</span>
            {(metrics?.anomalies?.length ?? 0) > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                {metrics?.anomalies.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'reports'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>{t('admin.tabReports') || 'Reportes y Moderación'}</span>
            {reports.filter((r) => r.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center animate-pulse">
                {reports.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              activeTab === 'support'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>{t('admin.tabSupport') || '💬 Soporte y Chats'}</span>
            {supportConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0) > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center">
                {supportConversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: SERVICE HEALTH & DIAGNOSTICS */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            {/* Live Diagnostics Result Banner (if run) */}
            {diagnosticsResult && (
              <Card className="p-5 bg-slate-900 text-white border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Resultado del Diagnóstico en Vivo
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {diagnosticsResult.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3"
                    >
                      {res.status === 'healthy' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : res.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{res.name}</span>
                          {res.latencyMs > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-700 text-slate-300 font-mono">
                              {res.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300">{res.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Subsystems Health Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(metrics?.healthServices || []).map((srv) => (
                <Card key={srv.id} className="p-5 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        {srv.id === 'postgres' ? (
                          <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : srv.id === 'gemini_ocr' ? (
                          <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        ) : srv.id === 'webpush' ? (
                          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {srv.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {srv.details}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={srv.status === 'healthy' ? 'emerald' : srv.status === 'warning' ? 'amber' : 'rose'}
                      size="sm"
                    >
                      {srv.status === 'healthy' ? 'Operativo' : srv.status === 'warning' ? 'Aviso' : 'Error'}
                    </Badge>
                  </div>

                  {srv.latencyMs > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>Latencia de respuesta</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {srv.latencyMs} ms
                      </span>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Server Process & Resource Consumption */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Servidor y Rendimiento del Proceso Node.js
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estadísticas del runtime, memoria heap y tiempo de ejecución ininterrumpido.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t('admin.serverUptime') || 'Tiempo en línea'}</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 block mt-1">
                    {metrics ? formatUptime(metrics.systemInfo.uptimeSeconds) : '...'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t('admin.heapUsed') || 'RAM Heap en uso'}</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 block mt-1">
                    {metrics?.systemInfo.memory.heapUsedMb ?? 0} MB
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t('admin.nodeVersion') || 'Versión Node'}</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-200 block mt-1">
                    {metrics?.systemInfo.nodeVersion ?? '...'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 block">{t('admin.environment') || 'Entorno'}</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 block mt-1 uppercase">
                    {metrics?.systemInfo.environment ?? '...'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 2: USERS EXPLORER & ROLE MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('admin.searchUsersPlaceholder') || 'Buscar por nombre, email o Bizum...'}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    userStatusFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Todos ({metrics?.usersList?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    userStatusFilter === 'active'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Activos ({(metrics?.usersList || []).filter((u) => !u.is_banned).length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('banned')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    userStatusFilter === 'banned'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                  }`}
                >
                  🚫 Baneados ({(metrics?.usersList || []).filter((u) => u.is_banned).length})
                </button>
              </div>
            </div>

            <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Rol / Estado</th>
                      <th className="py-3 px-4">Bizum</th>
                      <th className="py-3 px-4 text-center">Grupos</th>
                      <th className="py-3 px-4 text-center">Gastos</th>
                      <th className="py-3 px-4 text-center">Push</th>
                      <th className="py-3 px-4">Registro</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          No se encontraron usuarios que coincidan con la búsqueda o filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isAdmin = u.role === 'admin';
                        const isSelf = currentUser?.id === u.id;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar profile={u as any} size="sm" className="w-7 h-7 text-xs" />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate">
                                    {u.full_name || 'Sin nombre'}
                                    {isSelf && <span className="text-[10px] text-emerald-600 font-bold ml-1">(Tú)</span>}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block truncate">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant={isAdmin ? 'purple' : 'gray'} size="sm">
                                  {isAdmin ? 'Administrador' : 'Miembro'}
                                </Badge>
                                {u.is_banned && (
                                  <span
                                    className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                                    title={u.ban_reason || 'Baneado por moderación'}
                                  >
                                    🚫 Baneado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                              {u.bizum_phone || '—'}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                              {u.groups_count}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                              {u.expenses_count}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {u.has_push ? (
                                <span className="inline-flex items-center text-emerald-600 text-xs" title="Dispositivo suscrito">
                                  <Bell className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString('es-ES')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSelf || updatingUserRole === u.id}
                                  onClick={() => handleToggleUserRole(u.id, u.role)}
                                  className="text-[11px] font-bold px-2 py-1 h-auto"
                                >
                                  {updatingUserRole === u.id
                                    ? 'Guardando...'
                                    : isAdmin
                                    ? 'Quitar Admin'
                                    : 'Hacer Admin'}
                                </Button>

                                {u.is_banned ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isSelf}
                                    onClick={() => handleUnbanUserAction(u.id)}
                                    className="text-[11px] font-bold px-2 py-1 h-auto text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  >
                                    🟢 Desbanear
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isSelf}
                                    onClick={() => {
                                      setBanningUserId(u.id);
                                      setBanReasonInput('Infracción de las normas de convivencia / conducta inapropiada');
                                    }}
                                    className="text-[11px] font-bold px-2 py-1 h-auto text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  >
                                    🚫 Banear
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: GROUPS EXPLORER */}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('admin.searchGroupsPlaceholder') || 'Buscar grupos por nombre...'}
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setGroupFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    groupFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Todos ({metrics?.groupsList?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setGroupFilter('active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    groupFilter === 'active'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Activos ({metrics?.totals?.activeGroups || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setGroupFilter('archived')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    groupFilter === 'archived'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Archivados ({metrics?.totals?.archivedGroups || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setGroupFilter('frozen')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    groupFilter === 'frozen'
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  ❄️ Congelados ({metrics?.groupsList?.filter((g: any) => g.is_frozen).length || 0})
                </button>
              </div>
            </div>

            <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Grupo / Viaje</th>
                      <th className="py-3 px-4">Creado por</th>
                      <th className="py-3 px-4 text-center">Divisa</th>
                      <th className="py-3 px-4 text-center">Miembros</th>
                      <th className="py-3 px-4 text-center">Gastos</th>
                      <th className="py-3 px-4 text-right">Volumen</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4 text-right">Estado y Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredGroups.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          No se encontraron grupos que coincidan con los filtros.
                        </td>
                      </tr>
                    ) : (
                      filteredGroups.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl shrink-0">{g.icon_emoji || '🏖️'}</span>
                              <div className="min-w-0">
                                <Link
                                  href={`/groups/${g.id}`}
                                  className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 block truncate"
                                >
                                  {g.name}
                                </Link>
                                {g.description && (
                                  <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                                    {g.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {g.creator_name || 'Desconocido'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {g.base_currency}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                            {g.members_count}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300">
                            {g.expenses_count}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(g.total_amount, g.base_currency)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {new Date(g.created_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {g.is_frozen ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                                  ❄️ Congelado
                                </span>
                              ) : g.is_archived ? (
                                <Badge variant="gray" size="sm">
                                  Archivado
                                </Badge>
                              ) : (
                                <Badge variant="emerald" size="sm">
                                  Activo
                                </Badge>
                              )}

                              {g.is_frozen ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnfreezeGroup(g.id)}
                                  className="text-[11px] font-bold py-0.5 px-2 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                >
                                  🔥 Descongelar
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setFreezingGroupId(g.id);
                                    setFreezeReason('Bajo investigación por disputa de gastos / moderación');
                                  }}
                                  className="text-[11px] font-bold py-0.5 px-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                                >
                                  ❄️ Congelar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: FEATURE USAGE ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OCR vs Manual */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t('admin.ocrVsManual') || 'Escaneo OCR con IA vs Entrada Manual'}
                    </h3>
                    <p className="text-[11px] text-slate-400">Gastos procesados automáticamente mediante visión artificial</p>
                  </div>
                </div>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                  {metrics?.featureUsage.ocr.ocrPercentage ?? 0}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${metrics?.featureUsage.ocr.ocrPercentage ?? 0}%` }}
                />
                <div
                  className="h-full bg-slate-300 dark:bg-slate-700 transition-all duration-500"
                  style={{ width: `${100 - (metrics?.featureUsage.ocr.ocrPercentage ?? 0)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  {metrics?.featureUsage.ocr.ocrScannedExpenses ?? 0} con IA / OCR
                </span>
                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  {metrics?.featureUsage.ocr.manualExpenses ?? 0} Manuales
                </span>
              </div>
            </Card>

            {/* Split Distribution */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('admin.splitTypesDistribution') || 'Distribución de Reparto de Gastos'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Modalidades de división elegidas por los usuarios</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    <span>Partes Iguales (Equitativo)</span>
                    <span>{metrics?.featureUsage.splitTypes.equal ?? 0}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${
                          metrics?.totals.totalExpenses
                            ? Math.round(((metrics.featureUsage.splitTypes.equal || 0) / metrics.totals.totalExpenses) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    <span>Importes Exactos</span>
                    <span>{metrics?.featureUsage.splitTypes.exact ?? 0}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${
                          metrics?.totals.totalExpenses
                            ? Math.round(((metrics.featureUsage.splitTypes.exact || 0) / metrics.totals.totalExpenses) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    <span>Porcentajes / Participaciones</span>
                    <span>{(metrics?.featureUsage.splitTypes.percentage ?? 0) + (metrics?.featureUsage.splitTypes.shares ?? 0)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${
                          metrics?.totals.totalExpenses
                            ? Math.round(
                                (((metrics.featureUsage.splitTypes.percentage || 0) +
                                  (metrics.featureUsage.splitTypes.shares || 0)) /
                                  metrics.totals.totalExpenses) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('admin.paymentMethodsDistribution') || 'Métodos de Liquidación Registrados'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Canales utilizados para saldar deudas</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bizum</span>
                  <Badge variant="emerald" size="sm">
                    {metrics?.featureUsage.paymentMethods.BIZUM ?? 0}
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Efectivo</span>
                  <Badge variant="gray" size="sm">
                    {metrics?.featureUsage.paymentMethods.CASH ?? 0}
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Revolut</span>
                  <Badge variant="blue" size="sm">
                    {metrics?.featureUsage.paymentMethods.REVOLUT ?? 0}
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Transferencia</span>
                  <Badge variant="purple" size="sm">
                    {metrics?.featureUsage.paymentMethods.BANK_TRANSFER ?? 0}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Social & Notifications Volume */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Interacción Social & Notificaciones
                  </h3>
                  <p className="text-[11px] text-slate-400">Comentarios y dispositivos conectados</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 text-center">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block">
                    {metrics?.totals.totalComments ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 block">
                    Comentarios en Gastos
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-center">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block">
                    {metrics?.totals.totalPushSubscriptions ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 block">
                    Dispositivos Push Activos
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: ANOMALIES & AUDIT ISSUES */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t('admin.anomaliesTitle') || 'Detección de Problemas y Avisos'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Monitor proactivo de advertencias de configuración y registros inconsistentes.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunDiagnostics}
                  isLoading={isRunningDiagnostics}
                  className="text-xs font-bold gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Diagnosticar</span>
                </Button>
              </div>

              <div className="space-y-3 pt-2">
                {(metrics?.anomalies || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t('admin.noAnomalies') || '¡Todo en orden! No se han detectado anomalías en el sistema.'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Todos los subsistemas y bases de datos están funcionando en parámetros óptimos.
                    </p>
                  </div>
                ) : (
                  metrics?.anomalies.map((a) => (
                    <div
                      key={a.id}
                      className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                        a.level === 'critical'
                          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
                          : a.level === 'warning'
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                          : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-200'
                      }`}
                    >
                      {a.level === 'critical' ? (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      ) : a.level === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{a.title}</span>
                          <span
                            className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded-md ${
                              a.level === 'critical'
                                ? 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200'
                                : a.level === 'warning'
                                ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                          >
                            {a.level}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90">{a.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 6: CONTENT REPORTS & MODERATION */}
        {activeTab === 'reports' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <Card className="p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{t('admin.reportsTitle') || 'Moderación y Reportes de Contenido'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold">
                        {reports.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bandeja centralizada de denuncias de usuarios sobre gastos, tickets, comentarios o perfiles.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchReports}
                  isLoading={isLoadingReports}
                  className="text-xs font-bold gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizar</span>
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
                  {(['all', 'pending', 'reviewed', 'dismissed'] as const).map((status) => {
                    const count = status === 'all' ? reports.length : reports.filter((r) => r.status === status).length;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setReportStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                          reportStatusFilter === status
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="capitalize">
                          {status === 'all'
                            ? 'Todos'
                            : status === 'pending'
                            ? 'Pendientes'
                            : status === 'reviewed'
                            ? 'Revisados'
                            : 'Desestimados'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          status === 'pending' && count > 0
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por motivo, título o email..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Reports List */}
              <div className="space-y-3 pt-2">
                {(() => {
                  const filtered = reports.filter((r) => {
                    if (reportStatusFilter !== 'all' && r.status !== reportStatusFilter) {
                      return false;
                    }
                    if (!reportSearch.trim()) return true;
                    const query = reportSearch.toLowerCase();
                    return (
                      r.target_type?.toLowerCase().includes(query) ||
                      r.target_title?.toLowerCase().includes(query) ||
                      r.reason?.toLowerCase().includes(query) ||
                      r.details?.toLowerCase().includes(query) ||
                      r.reporter_email?.toLowerCase().includes(query)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          No hay reportes que coincidan con los filtros seleccionados
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Los nuevos reportes enviados por los usuarios aparecerán en esta bandeja automáticamente.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((report) => {
                    const isPending = report.status === 'pending';
                    const isUpdating = updatingReportId === report.id;

                    const typeEmoji =
                      report.target_type === 'expense'
                        ? '💸'
                        : report.target_type === 'receipt'
                        ? '🧾'
                        : report.target_type === 'group'
                        ? '🏖️'
                        : report.target_type === 'user'
                        ? '👤'
                        : report.target_type === 'comment'
                        ? '💬'
                        : '🛡️';

                    return (
                      <div
                        key={report.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                          isPending
                            ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/60 shadow-xs'
                            : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          {/* Left: Info */}
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Target Type Badge */}
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                <span>{typeEmoji}</span>
                                <span className="capitalize">{report.target_type}</span>
                              </span>

                              {/* Reason Badge */}
                              <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900/60">
                                Motivo: {report.reason}
                              </span>

                              {/* Status Badge */}
                              <span
                                className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md ${
                                  report.status === 'pending'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                    : report.status === 'reviewed'
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                    : report.status === 'action_taken'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                                }`}
                              >
                                {report.status === 'pending'
                                  ? '🟡 Pendiente'
                                  : report.status === 'reviewed'
                                  ? '🔵 Revisado'
                                  : report.status === 'action_taken'
                                  ? '🟢 Medida Tomada'
                                  : '⚪ Desestimado'}
                              </span>

                              {/* Date */}
                              <span className="text-[11px] text-slate-400">
                                {formatDate(report.created_at, 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>

                            {/* Title / Target Content */}
                            <div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {report.target_title || `Elemento ID: ${report.target_id}`}
                              </h4>
                              {report.details && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 leading-relaxed italic">
                                  "{report.details}"
                                </p>
                              )}
                            </div>

                            {/* Resolution Notes & Evidence Snapshot if available */}
                            {report.resolution_notes && (
                              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200 space-y-0.5">
                                <span className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                  📝 Nota de Resolución del Administrador:
                                </span>
                                <p className="leading-relaxed">{report.resolution_notes}</p>
                              </div>
                            )}

                            {report.evidence_snapshot && (
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg w-fit">
                                <span>🔒 Copia de seguridad de evidencia guardada</span>
                              </div>
                            )}

                            {/* Reporter Info */}
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span>Reportado por:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {report.reporter_name || report.reporter_email || 'Usuario anónimo'}
                              </span>
                              {report.reporter_email && (
                                <span className="text-slate-400">({report.reporter_email})</span>
                              )}
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start flex-wrap">
                            {/* Deep link & Quick Inspect */}
                            {(() => {
                              const resolvedGroupId =
                                report.group_id ||
                                (groups || []).find((g) =>
                                  (getGroupExpenses(g.id) || []).some((e) => e.id === report.target_id)
                                )?.id;

                              const deepLinkUrl =
                                report.target_url ||
                                (resolvedGroupId && (report.target_type === 'expense' || report.target_type === 'receipt')
                                  ? `/groups/${resolvedGroupId}?tab=expenses&expenseId=${report.target_id}`
                                  : resolvedGroupId && report.target_type === 'group'
                                  ? `/groups/${resolvedGroupId}`
                                  : report.target_type === 'group'
                                  ? `/groups/${report.target_id}`
                                  : null);

                              const isExpense = report.target_type === 'expense' || report.target_type === 'receipt';
                              const targetGroup = (groups || []).find((g) => g.id === resolvedGroupId) || (metrics?.groupsList || []).find((g: any) => g.id === resolvedGroupId);
                              const isGroupCurrentlyFrozen = Boolean(targetGroup?.is_frozen);

                              return (
                                <>
                                  {/* Quick In-Modal Inspect */}
                                  {isExpense && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleInspectExpense(report.target_id, resolvedGroupId)}
                                      isLoading={isInspectingExpenseId === report.target_id}
                                      className="text-xs font-bold border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 shadow-2xs"
                                    >
                                      <Search className="w-3.5 h-3.5 mr-1" />
                                      <span>Inspeccionar</span>
                                    </Button>
                                  )}

                                  {/* Direct Link to the Group/Expense View in a New Tab */}
                                  {deepLinkUrl && (
                                    <a
                                      href={deepLinkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1 shadow-2xs"
                                    >
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                      <span>{isExpense ? 'Ver gasto' : report.target_type === 'group' ? 'Ver grupo' : 'Ver'}</span>
                                    </a>
                                  )}

                                  {/* Freeze / Unfreeze Group directly from report */}
                                  {resolvedGroupId && (
                                    isGroupCurrentlyFrozen ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUnfreezeGroup(resolvedGroupId)}
                                        className="text-xs font-bold border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                      >
                                        🔥 Descongelar
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setFreezingGroupId(resolvedGroupId);
                                          setFreezeReason(`Bajo investigación por reporte de ${report.target_type}: ${report.reason}`);
                                        }}
                                        className="text-xs font-bold border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                      >
                                        ❄️ Congelar viaje
                                      </Button>
                                    )
                                  )}

                                  {/* Delete Reported Expense */}
                                  {isExpense && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteReportedExpense(report.id, report.target_id, resolvedGroupId)}
                                      isLoading={deletingExpenseId === report.target_id}
                                      className="text-xs font-bold border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                                      <span>Eliminar gasto</span>
                                    </Button>
                                  )}

                                  {/* Ban User if target_type is user */}
                                  {report.target_type === 'user' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setBanningUserId(report.target_id);
                                        setBanReasonInput(`Reportado por: ${report.reason}`);
                                      }}
                                      className="text-xs font-bold border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    >
                                      🚫 Banear usuario
                                    </Button>
                                  )}
                                </>
                              );
                            })()}

                            {/* Mark Reviewed */}
                            {report.status !== 'reviewed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setResolvingReport({ report, targetStatus: 'reviewed' });
                                  setResolutionNotesInput('');
                                }}
                                isLoading={updatingReportId === report.id}
                                className="text-xs font-bold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Revisado</span>
                              </Button>
                            )}

                            {/* Mark Action Taken */}
                            {report.status !== 'action_taken' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setResolvingReport({ report, targetStatus: 'action_taken' });
                                  setResolutionNotesInput('Medidas aplicadas tras revisión de moderación.');
                                }}
                                isLoading={updatingReportId === report.id}
                                className="text-xs font-bold border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resuelto</span>
                              </Button>
                            )}

                            {/* Dismiss */}
                            {report.status !== 'dismissed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setResolvingReport({ report, targetStatus: 'dismissed' });
                                  setResolutionNotesInput('Revisado. No se aprecian infracciones de las normas.');
                                }}
                                isLoading={updatingReportId === report.id}
                                className="text-xs font-bold text-slate-500 hover:text-rose-600"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Desestimar</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 7: SUPPORT & USER CHATS */}
        {activeTab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[75vh] min-h-[560px]">
            {/* Left: Conversations List (4 cols) */}
            <Card className="lg:col-span-4 p-4 flex flex-col h-full border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💬 Mensajes de Soporte</span>
                  {supportConversations.length > 0 && (
                    <span className="text-xs text-slate-400 font-normal">({supportConversations.length})</span>
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchSupportConversations}
                  isLoading={isLoadingSupport}
                  className="text-xs text-slate-500 hover:text-slate-900 h-auto p-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 space-y-1.5 no-scrollbar">
                {supportConversations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-semibold">No hay conversaciones de soporte aún.</p>
                  </div>
                ) : (
                  supportConversations.map((conv) => {
                    const isSelected = selectedSupportUserId === conv.user_id;
                    const hasUnread = (conv.unread_count || 0) > 0;

                    return (
                      <button
                        key={conv.user_id}
                        type="button"
                        onClick={() => fetchUserSupportThread(conv.user_id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <Avatar
                            profile={{
                              id: conv.user_id,
                              full_name: conv.user_name || 'Usuario',
                              email: conv.user_email,
                              avatar_url: conv.user_avatar,
                              created_at: '',
                            }}
                            size="sm"
                            className="w-8 h-8 text-xs shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {conv.user_name || conv.user_email || 'Usuario'}
                              </span>
                              {hasUnread && (
                                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {conv.user_email}
                            </span>
                            {conv.last_message && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1">
                                {conv.last_message}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {conv.last_category && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {conv.last_category === 'bug'
                                    ? '🐛 Bug'
                                    : conv.last_category === 'report_clarification'
                                    ? '⚖️ Aclaración'
                                    : conv.last_category === 'appeal'
                                    ? '🛡️ Apelación'
                                    : conv.last_category}
                                </span>
                              )}
                              {conv.is_banned && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                                  🚫 Baneado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Right: Active Chat View (8 cols) */}
            <Card className="lg:col-span-8 p-4 sm:p-5 flex flex-col h-full border-slate-200/80 dark:border-slate-800">
              {selectedSupportUserId ? (
                <>
                  {/* Chat Header */}
                  {(() => {
                    const currentConv = supportConversations.find((c) => c.user_id === selectedSupportUserId);
                    const isBanned = Boolean(currentConv?.is_banned);

                    return (
                      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            profile={{
                              id: selectedSupportUserId,
                              full_name: currentConv?.user_name || 'Usuario',
                              email: currentConv?.user_email,
                              avatar_url: currentConv?.user_avatar,
                              created_at: '',
                            }}
                            size="md"
                            className="w-10 h-10 text-xs shrink-0"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{currentConv?.user_name || 'Usuario'}</span>
                              {isBanned && (
                                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                  🚫 Baneado
                                </span>
                              )}
                            </h4>
                            <span className="text-xs text-slate-400">{currentConv?.user_email}</span>
                          </div>
                        </div>

                        {/* Ban / Unban Shortcuts */}
                        <div className="flex items-center gap-2">
                          {isBanned ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnbanUserAction(selectedSupportUserId)}
                              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              🟢 Desbanear
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBanningUserId(selectedSupportUserId);
                                setBanReasonInput('Infracción de las normas de convivencia / conducta inapropiada');
                              }}
                              className="text-xs font-bold text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              🚫 Banear
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Messages Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 my-3 bg-slate-50/60 dark:bg-slate-950/40 rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
                    {supportThreadMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                        <p className="text-xs">No hay mensajes en este canal.</p>
                      </div>
                    ) : (
                      supportThreadMessages.map((msg) => {
                        const isAdmin = msg.sender_role === 'admin';

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                                  <Shield className="w-3 h-3" />
                                  <span>Tú (Administrador)</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  {msg.sender_name || 'Usuario'}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {formatDate(msg.created_at, 'dd/MM/yyyy HH:mm')}
                              </span>
                            </div>

                            <div
                              className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-2xs break-words ${
                                isAdmin
                                  ? 'bg-sky-600 text-white rounded-tr-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-tl-xs'
                              }`}
                            >
                              {msg.category && msg.category !== 'general' && (
                                <div className="mb-1.5">
                                  <span
                                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                      isAdmin
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {msg.category === 'bug'
                                      ? '🐛 Bug'
                                      : msg.category === 'report_clarification'
                                      ? '⚖️ Aclaración'
                                      : msg.category === 'appeal'
                                      ? '🛡️ Apelación'
                                      : msg.category}
                                  </span>
                                </div>
                              )}
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Admin Reply Form */}
                  <form onSubmit={handleSendAdminReply} className="flex items-center gap-2 pt-1">
                    <Input
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      placeholder="Escribe una respuesta como Administrador oficial..."
                      className="flex-1 text-xs"
                      disabled={isSendingAdminReply}
                    />
                    <Button
                      type="submit"
                      variant="brand"
                      disabled={!adminReplyText.trim() || isSendingAdminReply}
                      isLoading={isSendingAdminReply}
                      className="bg-sky-600 hover:bg-sky-700 text-white px-4 font-bold shrink-0"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      <span>Responder</span>
                    </Button>
                  </form>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                  <MessageSquare className="w-10 h-10 opacity-30 text-emerald-500" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Selecciona una conversación
                  </h4>
                  <p className="text-xs max-w-xs">
                    Haz clic en cualquier usuario de la izquierda para ver su historial y responderle en tiempo real.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* In-Admin Read-Only Expense Detail Modal */}
      {inspectingExpense && (
        <ExpenseForm
          isOpen={Boolean(inspectingExpense)}
          groupId={inspectingExpense.groupId}
          expenseToEdit={inspectingExpense.expense}
          isReadOnly={true}
          onClose={() => setInspectingExpense(null)}
        />
      )}

      {/* Freeze Group Confirmation Modal with Dual Mode */}
      {freezingGroupId && (
        <Modal
          isOpen={Boolean(freezingGroupId)}
          onClose={() => setFreezingGroupId(null)}
          title="❄️ Congelar Grupo bajo Investigación"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/60 rounded-2xl border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 space-y-1.5">
              <p className="font-bold">
                Efectos de la medida cautelar:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                <li>Los miembros no podrán realizar modificaciones, crear gastos, chatear ni registrar pagos.</li>
                <li>Tú como administrador conservarás acceso para inspeccionar y eliminar gastos denunciados.</li>
                <li>Podrás descongelar el grupo en cualquier momento una vez resuelta la incidencia.</li>
              </ul>
            </div>

            {/* Freeze Mode Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Modalidad de congelación:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFreezeType('full')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    freezeType === 'full'
                      ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/60 ring-2 ring-sky-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🔒 Bloqueo Total</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Oculta todo el grupo a los miembros (recomendado para sospechas de fraude o acoso).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFreezeType('read_only')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    freezeType === 'read_only'
                      ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/60 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>👁️ Solo Lectura</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Los miembros pueden consultar balances y tickets, pero no modificar nada.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo de la congelación / investigación:
              </label>
              <Input
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="Ej: Bajo investigación por disputa de gastos / moderación"
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFreezingGroupId(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() => handleFreezeGroup(freezingGroupId, freezeReason, freezeType)}
                isLoading={isFreezingSubmitting}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                ❄️ Confirmar Congelación
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Ban User Confirmation Modal */}
      {banningUserId && (
        <Modal
          isOpen={Boolean(banningUserId)}
          onClose={() => setBanningUserId(null)}
          title="🚫 Suspender / Banear Usuario"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-2xl border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
              <p className="font-bold">
                Efectos de la suspensión de cuenta:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                <li>El usuario será bloqueado de inmediato en todas las vistas de la aplicación.</li>
                <li>Verá una pantalla de aviso con el motivo formal de la sanción.</li>
                <li>Podrá comunicarse contigo a través del Chat de Soporte para formular alegaciones.</li>
                <li>Podrás desbanear al usuario en cualquier momento para restaurar su acceso.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo de la suspensión / baneo:
              </label>
              <Input
                value={banReasonInput}
                onChange={(e) => setBanReasonInput(e.target.value)}
                placeholder="Ej: Infracción de las normas de convivencia / reporte de fraude"
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBanningUserId(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() => handleBanUserAction(banningUserId, banReasonInput)}
                isLoading={isBanSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                🚫 Confirmar Baneo
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Resolution Notes Modal */}
      {resolvingReport && (
        <Modal
          isOpen={Boolean(resolvingReport)}
          onClose={() => setResolvingReport(null)}
          title={`📝 Actualizar Estado: ${
            resolvingReport.targetStatus === 'action_taken'
              ? 'Medida Tomada (Resuelto)'
              : resolvingReport.targetStatus === 'reviewed'
              ? 'Revisado'
              : 'Desestimar Reporte'
          }`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Puedes añadir una nota explicativa. Se notificará al usuario denunciante con el resultado de la revisión:
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nota de Resolución / Explicación:
              </label>
              <textarea
                value={resolutionNotesInput}
                onChange={(e) => setResolutionNotesInput(e.target.value)}
                placeholder="Ej: Se ha verificado el comprobante y corregido la discrepancia..."
                rows={3}
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResolvingReport(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() =>
                  handleUpdateReportStatus(
                    resolvingReport.report.id,
                    resolvingReport.targetStatus,
                    resolutionNotesInput.trim() || undefined
                  )
                }
                isLoading={updatingReportId === resolvingReport.report.id}
                className="font-bold"
              >
                Guardar y Notificar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
}
