'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Navbar } from '@/components/layout/Navbar';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { VirtualCalculator } from '@/components/calculator/VirtualCalculator';
import { generateUserAuditTrail, AuditStep } from '@/lib/algorithms/auditCalculator';
import { formatMoney } from '@/lib/currencies';
import { getCategoryInfo } from '@/lib/categories';
import {
  ArrowLeft,
  Calculator as CalcIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Receipt,
  Users,
  HandCoins,
  Send,
  HelpCircle,
  Zap,
  Plus,
} from 'lucide-react';

export default function GroupAuditPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;

  const {
    getGroup,
    getGroupMembers,
    getGroupExpenses,
    getGroupSettlements,
    currentUser,
    isLoading,
  } = usePachas();
  const { t } = useTranslation();

  const group = getGroup(groupId);
  const members = getGroupMembers(groupId);
  const expenses = getGroupExpenses(groupId);
  const settlements = getGroupSettlements(groupId);

  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [calculatorExpr, setCalculatorExpr] = useState<string>('');

  // Fallback to first member if currentUser not in group
  const activeUserId = useMemo(() => {
    if (selectedUserId && members.some((m) => m.user_id === selectedUserId)) {
      return selectedUserId;
    }
    if (currentUser && members.some((m) => m.user_id === currentUser.id)) {
      return currentUser.id;
    }
    return members[0]?.user_id || '';
  }, [selectedUserId, members, currentUser]);

  const targetMember = useMemo(() => {
    return members.find((m) => m.user_id === activeUserId);
  }, [members, activeUserId]);

  const auditSteps: AuditStep[] = useMemo(() => {
    if (!group || !activeUserId) return [];
    return generateUserAuditTrail(
      activeUserId,
      group.base_currency,
      members,
      expenses,
      settlements
    );
  }, [group, activeUserId, members, expenses, settlements]);

  const currentStep = auditSteps[currentStepIndex] || auditSteps[0];
  const totalSteps = auditSteps.length;
  const progressPercent = totalSteps > 1 ? (currentStepIndex / (totalSteps - 1)) * 100 : 100;

  const handleSelectMember = (newUserId: string) => {
    setSelectedUserId(newUserId);
    setCurrentStepIndex(0);
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleJumpToEnd = () => {
    setCurrentStepIndex(totalSteps - 1);
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
  };

  const handleLoadInCalculator = (expr: string) => {
    setCalculatorExpr(expr);
  };

  if (isLoading && !group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('groups.groupNotFound')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href={`/groups/${group.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('audit.backToGroup')} ({group.name})
            </Link>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <CalcIcon className="w-5 h-5" />
              </div>
              <span>{t('audit.title')}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('audit.subtitle')}
            </p>
          </div>

          {/* Member Selector Dropdown */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs">
            <span className="text-xs font-bold text-slate-400 pl-2 hidden sm:inline">
              {t('audit.selectMember')}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {members.map((m) => {
                const isSelected = m.user_id === activeUserId;
                const profile = m.profile || {
                  id: m.user_id,
                  email: '',
                  full_name: `Usuario ${m.user_id.substring(0, 4)}`,
                  created_at: '',
                };

                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => handleSelectMember(m.user_id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Avatar profile={profile} size="sm" />
                    <span>{profile.full_name?.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Step-by-Step Mathematical Wizard (7 Cols on desktop) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Progress Bar & Phase Title */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {currentStep ? t(currentStep.phaseTitleKey as any) : ''}
                </span>

                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                  {t('audit.step', {
                    current: currentStepIndex + 1,
                    total: totalSteps,
                  })}
                </span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300 shadow-xs"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Stepper Phase Pills */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {[1, 2, 3, 4, 5, 6].map((p) => {
                  const isCurrentPhase = currentStep?.phase === p;
                  const isPassed = (currentStep?.phase || 1) > p;

                  return (
                    <div
                      key={p}
                      className={`h-1.5 rounded-full transition-all ${
                        isCurrentPhase
                          ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                          : isPassed
                          ? 'bg-emerald-600/40'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                      title={`Fase ${p}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Active Step Card */}
            {currentStep && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Step Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {/* Explicit Type Badge */}
                    {currentStep.type === 'payment' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black tracking-wider border border-emerald-300/60 dark:border-emerald-800">
                        <TrendingUp className="w-3 h-3" />
                        <span>{t('audit.typePaymentBadge')}</span>
                      </div>
                    ) : currentStep.type === 'payments_summary' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black tracking-wider border border-emerald-300/60 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('audit.totalPaymentsSummary')}</span>
                      </div>
                    ) : currentStep.type === 'consumption' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-black tracking-wider border border-rose-300/60 dark:border-rose-800">
                        <TrendingDown className="w-3 h-3" />
                        <span>{t('audit.typeConsumptionBadge')}</span>
                      </div>
                    ) : currentStep.type === 'consumptions_summary' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-black tracking-wider border border-rose-300/60 dark:border-rose-800">
                        <Receipt className="w-3 h-3" />
                        <span>{t('audit.totalConsumptionsSummary')}</span>
                      </div>
                    ) : currentStep.type === 'gross_balance' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[10px] font-black tracking-wider border border-blue-300/60 dark:border-blue-800">
                        <CalcIcon className="w-3 h-3" />
                        <span>BALANCE BRUTO (PAGADO - CONSUMIDO)</span>
                      </div>
                    ) : currentStep.type === 'settlement' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[10px] font-black tracking-wider border border-purple-300/60 dark:border-purple-800">
                        <Send className="w-3 h-3" />
                        <span>LIQUIDACIÓN DIRECTA / BIZUM</span>
                      </div>
                    ) : null}

                    {currentStep.stepAmount !== 0 && (
                      <Badge
                        variant={
                          currentStep.type === 'payment' || currentStep.type === 'payments_summary'
                            ? 'emerald'
                            : currentStep.type === 'consumption' || currentStep.type === 'consumptions_summary'
                            ? 'rose'
                            : 'blue'
                        }
                        size="md"
                      >
                        {formatMoney(Math.abs(currentStep.stepAmount), group.base_currency)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5">
                    {currentStep.relatedExpense ? (
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                          getCategoryInfo(currentStep.relatedExpense.category).bgColor
                        } border ${
                          getCategoryInfo(currentStep.relatedExpense.category).borderColor
                        }`}
                      >
                        {getCategoryInfo(currentStep.relatedExpense.category).emoji}
                      </div>
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          currentStep.type === 'payment' || currentStep.type === 'payments_summary'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                            : currentStep.type === 'consumption' || currentStep.type === 'consumptions_summary'
                            ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400'
                            : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {currentStep.type === 'final_net' ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : currentStep.type === 'settlement' ? (
                          <Send className="w-6 h-6" />
                        ) : currentStep.type === 'payments_summary' || currentStep.type === 'consumptions_summary' ? (
                          <Receipt className="w-6 h-6" />
                        ) : (
                          <CalcIcon className="w-6 h-6" />
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {currentStep.title}
                      </h3>
                      {currentStep.subtitle && (
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          {currentStep.subtitle}
                        </p>
                      )}
                      {currentStep.date && (
                        <span className="text-[11px] text-slate-400 mt-1 block">
                          📅 {currentStep.date}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {currentStep.explanation}
                </div>

                {/* Math Formulas Area: Dual formulas for consumptions, single formula for other steps */}
                {currentStep.type === 'consumption' && currentStep.secondaryFormulaDisplay ? (
                  <div className="space-y-3">
                    {/* Operation A: Split / Division */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-rose-400" />
                          {t('audit.calcSplitOperation')}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleLoadInCalculator(currentStep.calculatorExpression)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title={t('audit.loadSplitInCalc')}
                        >
                          <CalcIcon className="w-3.5 h-3.5" />
                          <span>{t('audit.loadSplitInCalc')}</span>
                        </button>
                      </div>

                      <div className="font-mono text-sm sm:text-base font-black text-rose-400 tracking-wide bg-black/40 p-3 rounded-xl border border-slate-800 break-words">
                        {currentStep.formulaDisplay}
                      </div>
                    </div>

                    {/* Operation B: Running Addition to Total Consumed */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          {t('audit.calcSumOperation')}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleLoadInCalculator(currentStep.secondaryCalculatorExpression!)}
                          className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title={t('audit.loadSumInCalc')}
                        >
                          <CalcIcon className="w-3.5 h-3.5" />
                          <span>{t('audit.loadSumInCalc')}</span>
                        </button>
                      </div>

                      <div className="font-mono text-sm sm:text-base font-black text-amber-400 tracking-wide bg-black/40 p-3 rounded-xl border border-slate-800 break-words">
                        {currentStep.secondaryFormulaDisplay}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Single Formula Box (Payments, Summaries, Gross Balance, Settlements) */
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-md space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        {t('audit.mathOperation')}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleLoadInCalculator(currentStep.calculatorExpression)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title={t('audit.loadInCalculator')}
                      >
                        <CalcIcon className="w-3.5 h-3.5" />
                        <span>{t('audit.loadInCalculator')}</span>
                      </button>
                    </div>

                    <div className="font-mono text-base sm:text-lg font-black text-emerald-400 tracking-wide bg-black/40 p-3.5 rounded-xl border border-slate-800 break-words">
                      {currentStep.formulaDisplay}
                    </div>
                  </div>
                )}

                {/* Running Tally / Subtotal tracker */}
                <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                      {t('audit.youPaid')}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {formatMoney(currentStep.runningPaid, group.base_currency)}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                    <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block">
                      {t('audit.youConsumed')}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
                      {formatMoney(currentStep.runningConsumed, group.base_currency)}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {t('audit.netBalance')}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-black mt-0.5 block ${
                        currentStep.runningNet > 0.009
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : currentStep.runningNet < -0.009
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {currentStep.runningNet > 0 ? '+' : ''}
                      {formatMoney(currentStep.runningNet, group.base_currency)}
                    </span>
                  </div>
                </div>

                {/* Final Step Debt Plan Table */}
                {currentStep.type === 'final_net' && currentStep.debtPlan && (
                  <div className="pt-3 space-y-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Liquidaciones pendientes para saldar tu cuenta:
                    </h4>

                    {currentStep.debtPlan.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>¡Todas tus deudas y cobros están completamente liquidados!</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentStep.debtPlan.map((d, i) => {
                          const isYouPaying = d.from_user_id === activeUserId;
                          return (
                            <div
                              key={i}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                isYouPaying
                                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                                  : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                                    isYouPaying
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-emerald-500 text-white'
                                  }`}
                                >
                                  {isYouPaying ? '↓' : '↑'}
                                </div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {isYouPaying
                                    ? `Debes pagar a ${d.to_profile?.full_name}`
                                    : `${d.from_profile?.full_name} debe pagarte`}
                                </span>
                              </div>

                              <span
                                className={`text-xs font-black ${
                                  isYouPaying
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {formatMoney(d.amount, group.base_currency)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Wizard Navigation Buttons */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap sm:flex-nowrap">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    className="gap-1.5 flex-1 sm:flex-initial"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{t('audit.prevStep')}</span>
                  </Button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    {currentStepIndex === totalSteps - 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRestart}
                        className="gap-1.5 flex-1 sm:flex-initial"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('audit.restart')}</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleJumpToEnd}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hidden sm:inline-flex"
                      >
                        {t('audit.jumpToEnd')}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="brand"
                      onClick={handleNextStep}
                      disabled={currentStepIndex === totalSteps - 1}
                      className="gap-1.5 flex-1 sm:flex-initial shadow-md shadow-emerald-600/20"
                    >
                      <span>{t('audit.nextStep')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Interactive Virtual Calculator & Summary Card (5 Cols on desktop) */}
          <div className="lg:col-span-5 space-y-5 sticky top-20">
            <VirtualCalculator initialExpression={calculatorExpr} />

            {/* Live Financial Summary */}
            <Card className="space-y-3.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <HandCoins className="w-4 h-4 text-emerald-600" />
                <span>Resumen Financiero del Viaje</span>
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total gastado en el viaje:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMoney(
                      expenses.reduce((s, e) => s + (e.converted_amount || e.amount), 0),
                      group.base_currency
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total adelantado por ti:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(currentStep?.runningPaid || 0, group.base_currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total de tu consumo:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatMoney(currentStep?.runningConsumed || 0, group.base_currency)}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    Saldo verificado:
                  </span>
                  <span
                    className={`font-black text-sm ${
                      (currentStep?.runningNet || 0) > 0.009
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (currentStep?.runningNet || 0) < -0.009
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {(currentStep?.runningNet || 0) > 0 ? '+' : ''}
                    {formatMoney(currentStep?.runningNet || 0, group.base_currency)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
