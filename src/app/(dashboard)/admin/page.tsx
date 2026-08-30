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
import {
  ShieldCheck,
  ShieldAlert,
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

export default function AdminBackofficePage() {
  const router = useRouter();
  const { currentUser, isAppAdmin } = usePachas();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'health' | 'users' | 'groups' | 'analytics' | 'anomalies'>('health');
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any[] | null>(null);

  // Filter & search states
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [updatingUserRole, setUpdatingUserRole] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.warn('Error fetching admin metrics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

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
    const q = userSearch.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.bizum_phone?.toLowerCase().includes(q)
    );
  });

  const filteredGroups = (metrics?.groupsList || []).filter((g) => {
    const q = groupSearch.toLowerCase();
    const matchesQuery = g.name.toLowerCase().includes(q) || (g.creator_name && g.creator_name.toLowerCase().includes(q));
    if (groupFilter === 'active') return matchesQuery && !g.is_archived;
    if (groupFilter === 'archived') return matchesQuery && g.is_archived;
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

              <span className="text-xs font-semibold text-slate-500 self-center">
                Mostrando {filteredUsers.length} de {metrics?.usersList?.length || 0} usuarios
              </span>
            </div>

            <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Rol</th>
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
                          No se encontraron usuarios que coincidan con la búsqueda.
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
                                  <span className="font-bold text-slate-900 dark:text-white block truncate">
                                    {u.full_name || 'Sin nombre'}
                                    {isSelf && <span className="text-[10px] text-emerald-600 font-bold ml-1">(Tú)</span>}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block truncate">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={isAdmin ? 'purple' : 'gray'} size="sm">
                                {isAdmin ? 'Administrador' : 'Miembro'}
                              </Badge>
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
                      <th className="py-3 px-4 text-right">Estado</th>
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
                            <Badge variant={g.is_archived ? 'gray' : 'emerald'} size="sm">
                              {g.is_archived ? 'Archivado' : 'Activo'}
                            </Badge>
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
      </main>

      <Footer />
    </div>
  );
}
