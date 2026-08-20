'use client';

import React, { useState, useMemo } from 'react';
import { Group, Expense, GroupMember } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/currencies';
import { formatDate } from '@/lib/utils';
import { getCategoryInfo } from '@/lib/categories';
import {
  BarChart3,
  Calendar,
  Clock,
  Layers,
  Users,
  TrendingUp,
  PieChart,
  Filter,
  Check,
  ChevronRight,
  Info,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

export type Granularity = 'hour' | 'day' | 'week' | 'total';
export type ViewMode = 'payers' | 'consumers' | 'totals';

export interface ExpenseChartsViewProps {
  group: Group;
  expenses: Expense[];
  members: GroupMember[];
  onClose?: () => void;
}

const PALETTE = [
  { bg: 'bg-emerald-500', hex: '#10b981', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-sky-500', hex: '#0ea5e9', text: 'text-sky-600 dark:text-sky-400' },
  { bg: 'bg-purple-500', hex: '#a855f7', text: 'text-purple-600 dark:text-purple-400' },
  { bg: 'bg-amber-500', hex: '#f59e0b', text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-rose-500', hex: '#f43f5e', text: 'text-rose-600 dark:text-rose-400' },
  { bg: 'bg-teal-500', hex: '#14b8a6', text: 'text-teal-600 dark:text-teal-400' },
  { bg: 'bg-indigo-500', hex: '#6366f1', text: 'text-indigo-600 dark:text-indigo-400' },
  { bg: 'bg-orange-500', hex: '#f97316', text: 'text-orange-600 dark:text-orange-400' },
  { bg: 'bg-pink-500', hex: '#ec4899', text: 'text-pink-600 dark:text-pink-400' },
  { bg: 'bg-cyan-500', hex: '#06b6d4', text: 'text-cyan-600 dark:text-cyan-400' },
];

const CHART_TRACK_HEIGHT = 180; // px

interface TimeBucket {
  key: string;
  label: string;
  subLabel?: string;
  total: number;
  perMember: Record<string, number>;
  expenses: Expense[];
}

export const ExpenseChartsView: React.FC<ExpenseChartsViewProps> = ({
  group,
  expenses,
  members,
  onClose,
}) => {
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [viewMode, setViewMode] = useState<ViewMode>('payers');
  const [activeBucketIndex, setActiveBucketIndex] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.user_id)
  );

  // Assign consistent color to each member
  const memberColorMap = useMemo(() => {
    const map = new Map<string, typeof PALETTE[0]>();
    members.forEach((m, idx) => {
      map.set(m.user_id, PALETTE[idx % PALETTE.length]);
    });
    return map;
  }, [members]);

  const getExpenseBaseAmount = (e: Expense): number => {
    return e.converted_amount || e.amount;
  };

  const toggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((m) => m !== id));
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const selectAllMembers = () => {
    setSelectedMemberIds(members.map((m) => m.user_id));
  };

  // Compute aggregated buckets based on granularity & selected viewMode
  const buckets: TimeBucket[] = useMemo(() => {
    if (expenses.length === 0) return [];

    // Sort chronologically
    const sorted = [...expenses].sort(
      (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
    );

    if (granularity === 'total') {
      const bucket: TimeBucket = {
        key: 'trip-total',
        label: 'Gasto Total del Viaje',
        subLabel: `${expenses.length} gastos`,
        total: 0,
        perMember: {},
        expenses: sorted,
      };

      sorted.forEach((exp) => {
        const amount = getExpenseBaseAmount(exp);

        if (viewMode === 'payers') {
          if (exp.payers && exp.payers.length > 0) {
            exp.payers.forEach((p) => {
              const payerShare = exp.amount > 0 ? (p.amount_paid / exp.amount) * amount : p.amount_paid;
              if (selectedMemberIds.includes(p.user_id)) {
                bucket.total += payerShare;
                bucket.perMember[p.user_id] = (bucket.perMember[p.user_id] || 0) + payerShare;
              }
            });
          } else {
            const creatorId = exp.created_by;
            if (selectedMemberIds.includes(creatorId)) {
              bucket.total += amount;
              bucket.perMember[creatorId] = (bucket.perMember[creatorId] || 0) + amount;
            }
          }
        } else if (viewMode === 'consumers') {
          if (exp.participants && exp.participants.length > 0) {
            exp.participants.forEach((pt) => {
              if (selectedMemberIds.includes(pt.user_id)) {
                bucket.total += pt.amount_owed;
                bucket.perMember[pt.user_id] = (bucket.perMember[pt.user_id] || 0) + pt.amount_owed;
              }
            });
          } else {
            bucket.total += amount;
          }
        } else {
          bucket.total += amount;
        }
      });

      return [bucket];
    }

    const bucketMap = new Map<string, TimeBucket>();

    sorted.forEach((exp) => {
      const date = new Date(exp.expense_date);
      let key = '';
      let label = '';
      let subLabel = '';

      if (granularity === 'hour') {
        const pad = (n: number) => (n < 10 ? '0' : '') + n;
        const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        const hour = date.getHours();
        key = `${ymd}_${hour}`;
        label = `${pad(hour)}:00 - ${pad(hour + 1)}:00`;
        subLabel = formatDate(exp.expense_date, 'd MMM');
      } else if (granularity === 'day') {
        key = formatDate(exp.expense_date, 'yyyy-MM-dd');
        label = formatDate(exp.expense_date, 'd MMM');
        subLabel = formatDate(exp.expense_date, 'EEEE');
      } else if (granularity === 'week') {
        const temp = new Date(date);
        const dayOfWeek = (temp.getDay() + 6) % 7; // Monday = 0
        temp.setDate(temp.getDate() - dayOfWeek);
        key = formatDate(temp.toISOString(), 'yyyy-MM-dd');
        const endTemp = new Date(temp);
        endTemp.setDate(endTemp.getDate() + 6);
        label = `${formatDate(temp.toISOString(), 'd MMM')} - ${formatDate(endTemp.toISOString(), 'd MMM')}`;
        subLabel = `Semana`;
      }

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          label,
          subLabel,
          total: 0,
          perMember: {},
          expenses: [],
        });
      }

      const b = bucketMap.get(key)!;
      b.expenses.push(exp);
      const amount = getExpenseBaseAmount(exp);

      if (viewMode === 'payers') {
        if (exp.payers && exp.payers.length > 0) {
          exp.payers.forEach((p) => {
            const payerShare = exp.amount > 0 ? (p.amount_paid / exp.amount) * amount : p.amount_paid;
            if (selectedMemberIds.includes(p.user_id)) {
              b.total += payerShare;
              b.perMember[p.user_id] = (b.perMember[p.user_id] || 0) + payerShare;
            }
          });
        } else {
          const creatorId = exp.created_by;
          if (selectedMemberIds.includes(creatorId)) {
            b.total += amount;
            b.perMember[creatorId] = (b.perMember[creatorId] || 0) + amount;
          }
        }
      } else if (viewMode === 'consumers') {
        if (exp.participants && exp.participants.length > 0) {
          exp.participants.forEach((pt) => {
            if (selectedMemberIds.includes(pt.user_id)) {
              b.total += pt.amount_owed;
              b.perMember[pt.user_id] = (b.perMember[pt.user_id] || 0) + pt.amount_owed;
            }
          });
        } else {
          b.total += amount;
        }
      } else {
        b.total += amount;
      }
    });

    return Array.from(bucketMap.values());
  }, [expenses, granularity, viewMode, selectedMemberIds]);

  // Max value in any bucket for scale calculation
  const maxBucketValue = useMemo(() => {
    if (buckets.length === 0) return 100;
    const max = Math.max(...buckets.map((b) => b.total), 0);
    return max > 0 ? max * 1.15 : 100;
  }, [buckets]);

  // Member overall stats
  const memberTotals = useMemo(() => {
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {};

    expenses.forEach((exp) => {
      const amount = getExpenseBaseAmount(exp);
      if (exp.payers && exp.payers.length > 0) {
        exp.payers.forEach((p) => {
          const share = exp.amount > 0 ? (p.amount_paid / exp.amount) * amount : p.amount_paid;
          paid[p.user_id] = (paid[p.user_id] || 0) + share;
        });
      } else {
        paid[exp.created_by] = (paid[exp.created_by] || 0) + amount;
      }

      if (exp.participants && exp.participants.length > 0) {
        exp.participants.forEach((pt) => {
          owed[pt.user_id] = (owed[pt.user_id] || 0) + pt.amount_owed;
        });
      }
    });

    return { paid, owed };
  }, [expenses]);

  const totalTripAmount = expenses.reduce((sum, e) => sum + getExpenseBaseAmount(e), 0);
  const activeBucket = activeBucketIndex !== null ? buckets[activeBucketIndex] : null;

  const peakBucket = useMemo(() => {
    if (buckets.length === 0) return null;
    return buckets.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), buckets[0]);
  }, [buckets]);

  const categoryTotals = useMemo(() => {
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + getExpenseBaseAmount(e);
    });
    return Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-5">
      {/* KPI Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Gasto Total
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalTripAmount, group.base_currency)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {expenses.length} gastos registrados
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Media por amigo
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {formatMoney(
              members.length > 0 ? totalTripAmount / members.length : 0,
              group.base_currency
            )}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {members.length} participantes
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">
            Pico de gasto
          </span>
          <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 truncate block">
            {peakBucket ? formatMoney(peakBucket.total, group.base_currency) : '0 €'}
          </span>
          <span className="text-[10px] text-slate-400 block truncate mt-0.5">
            {peakBucket ? peakBucket.label : '-'}
          </span>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Intervalos
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {buckets.length}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
            {granularity === 'hour'
              ? 'horas con gasto'
              : granularity === 'day'
              ? 'días registrados'
              : granularity === 'week'
              ? 'semanas'
              : 'resumen global'}
          </span>
        </div>
      </div>

      {/* Toolbar: Granularity & Breakdown Switches */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-900/70 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        {/* Granularity Selector */}
        <div className="flex p-0.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setGranularity('hour');
              setActiveBucketIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
              granularity === 'hour'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Por Horas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGranularity('day');
              setActiveBucketIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
              granularity === 'day'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Por Días</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGranularity('week');
              setActiveBucketIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
              granularity === 'week'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Por Semanas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGranularity('total');
              setActiveBucketIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
              granularity === 'total'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>En Total</span>
          </button>
        </div>

        {/* View Mode Selector */}
        <div className="flex p-0.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('payers')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'payers'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Muestra quién pagó y adelantó el dinero"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Por Pagador</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('consumers')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'consumers'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Muestra el consumo / reparto asignado a cada amigo"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Por Consumo</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('totals')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              viewMode === 'totals'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Muestra el importe total del grupo sin desglosar"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Global</span>
          </button>
        </div>
      </div>

      {/* Member Filter Chips / Legend */}
      {viewMode !== 'totals' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filtrar amigos en la gráfica:
            </span>
            {selectedMemberIds.length < members.length && (
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                Seleccionar todos ({members.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => {
              const isSelected = selectedMemberIds.includes(member.user_id);
              const color = memberColorMap.get(member.user_id) || PALETTE[0];
              const memberTotal =
                viewMode === 'payers'
                  ? memberTotals.paid[member.user_id] || 0
                  : memberTotals.owed[member.user_id] || 0;

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.user_id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 shadow-xs border-slate-300 dark:border-slate-700 ring-2 ring-emerald-500/20 text-slate-900 dark:text-white'
                      : 'bg-slate-100/80 dark:bg-slate-800/50 opacity-40 border-transparent text-slate-400'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${color.bg} shrink-0`}
                  />
                  <span className="truncate max-w-[100px]">
                    {member.profile?.full_name?.split(' ')[0] || 'Amigo'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    ({formatMoney(memberTotal, group.base_currency)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {expenses.length === 0 ? (
        <div className="p-12 text-center bg-slate-50 dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
            📊
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            No hay gastos registrados en este viaje
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Añade gastos o importa un archivo CSV para visualizar las gráficas temporales y el reparto entre amigos.
          </p>
        </div>
      ) : (
        /* Main Interactive Chart Canvas */
        <div className="space-y-3">
          <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs overflow-hidden">
            {/* Y-Axis Grid Background */}
            <div className="absolute inset-x-5 top-10 bottom-12 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 flex justify-end">
                <span className="text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-900 px-1 -translate-y-2">
                  {formatMoney(maxBucketValue, group.base_currency)}
                </span>
              </div>
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 flex justify-end">
                <span className="text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-900 px-1 -translate-y-2">
                  {formatMoney(maxBucketValue / 2, group.base_currency)}
                </span>
              </div>
              <div className="border-b border-slate-200 dark:border-slate-800" />
            </div>

            {/* Bars container */}
            <div className="relative z-10 flex items-end gap-2 sm:gap-3 overflow-x-auto pb-2 pt-4 px-1 no-scrollbar">
              {buckets.map((bucket, idx) => {
                const isActive = activeBucketIndex === idx;
                const barHeightPx = maxBucketValue > 0 
                  ? Math.max(Math.round((bucket.total / maxBucketValue) * CHART_TRACK_HEIGHT), 14)
                  : 14;

                return (
                  <div
                    key={bucket.key}
                    onClick={() => setActiveBucketIndex(isActive ? null : idx)}
                    className="flex-1 min-w-[55px] sm:min-w-[75px] max-w-[120px] flex flex-col items-center group cursor-pointer"
                  >
                    {/* Amount pill over bar */}
                    <span
                      className={`text-[10px] font-mono font-bold mb-1.5 transition-all truncate max-w-full px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs scale-105'
                          : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                      }`}
                    >
                      {formatMoney(bucket.total, group.base_currency)}
                    </span>

                    {/* Fixed Height Track Area */}
                    <div
                      style={{ height: `${CHART_TRACK_HEIGHT}px` }}
                      className="w-full flex flex-col justify-end items-center"
                    >
                      {/* Bar Pillar */}
                      <div
                        className={`w-full rounded-2xl overflow-hidden flex flex-col justify-end transition-all relative border ${
                          isActive
                            ? 'ring-3 ring-emerald-500/50 shadow-md border-emerald-500'
                            : 'hover:brightness-105 border-slate-200/80 dark:border-slate-800'
                        }`}
                        style={{
                          height: `${barHeightPx}px`,
                        }}
                      >
                        {viewMode === 'totals' ? (
                          /* Solid Total Group Bar */
                          <div className="w-full h-full bg-gradient-to-t from-emerald-600 to-teal-400" />
                        ) : (
                          /* Stacked Per-Member Segments with flex-grow */
                          Object.entries(bucket.perMember).map(([userId, userAmount]) => {
                            const color = memberColorMap.get(userId) || PALETTE[0];
                            const member = members.find((m) => m.user_id === userId);

                            return (
                              <div
                                key={userId}
                                style={{ flexGrow: userAmount, minHeight: '4px' }}
                                className={`w-full ${color.bg} transition-all relative border-b border-white/20 last:border-b-0`}
                                title={`${member?.profile?.full_name}: ${formatMoney(userAmount, group.base_currency)}`}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* X-Axis Label */}
                    <div className="mt-2 text-center w-full">
                      <span
                        className={`text-xs font-bold block truncate ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400 underline font-black'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {bucket.label}
                      </span>
                      {bucket.subLabel && (
                        <span className="text-[10px] text-slate-400 block truncate">
                          {bucket.subLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drill-down Detail Card when a bar is selected */}
          {activeBucket && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>📌 Detalle del periodo:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                      {activeBucket.label} {activeBucket.subLabel ? `(${activeBucket.subLabel})` : ''}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Total registrado: {formatMoney(activeBucket.total, group.base_currency)} en {activeBucket.expenses.length} gasto{activeBucket.expenses.length > 1 ? 's' : ''}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveBucketIndex(null)}
                  className="text-xs"
                >
                  Cerrar desglose
                </Button>
              </div>

              {/* Per Member Breakdown in active bucket */}
              {viewMode !== 'totals' && Object.keys(activeBucket.perMember).length > 0 && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    {viewMode === 'payers' ? 'Pagado en este tramo:' : 'Consumido en este tramo:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(activeBucket.perMember).map(([userId, amt]) => {
                      const member = members.find((m) => m.user_id === userId);
                      const color = memberColorMap.get(userId) || PALETTE[0];
                      const pct = activeBucket.total > 0 ? Math.round((amt / activeBucket.total) * 100) : 0;

                      return (
                        <div
                          key={userId}
                          className="p-2 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full ${color.bg} shrink-0`} />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {member?.profile?.full_name || 'Amigo'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block font-mono">
                              {formatMoney(amt, group.base_currency)}
                            </span>
                            <span className="text-[9px] text-slate-400 block">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expenses included in this bucket */}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                  Gastos incluidos en este tramo:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {activeBucket.expenses.map((e) => {
                    const cat = getCategoryInfo(e.category);
                    const payerStr =
                      e.payers?.map((p) => p.profile?.full_name?.split(' ')[0]).join(', ') ||
                      e.creator?.full_name?.split(' ')[0] ||
                      'Amigo';

                    return (
                      <div
                        key={e.id}
                        className="p-2.5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/60 dark:border-slate-700/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{cat.emoji}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                              {e.title}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {formatDate(e.expense_date, 'd MMM HH:mm')} • Pagó: {payerStr}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-extrabold text-slate-900 dark:text-white font-mono shrink-0">
                          {formatMoney(e.amount, e.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Total Mode Extra: Category Distribution Breakdown */}
          {granularity === 'total' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Distribución por Categorías
              </span>

              <div className="space-y-2">
                {categoryTotals.map(([catKey, total]) => {
                  const cat = getCategoryInfo(catKey as any);
                  const pct = totalTripAmount > 0 ? (total / totalTripAmount) * 100 : 0;

                  return (
                    <div key={catKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span>{cat.emoji}</span>
                          <span className="text-slate-800 dark:text-slate-200">{cat.label}</span>
                        </span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {formatMoney(total, group.base_currency)}{' '}
                          <span className="text-slate-400 text-[10px]">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {onClose && (
        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cerrar Gráficas
          </Button>
        </div>
      )}
    </div>
  );
};
