'use client';

import React from 'react';
import { Group, MemberBalance } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney } from '@/lib/currencies';
import { TrendingUp, TrendingDown, CheckCircle2, Users } from 'lucide-react';

export const BalanceSummary: React.FC<{
  group: Group;
  balances: MemberBalance[];
  totalSpent: number;
}> = ({ group, balances, totalSpent }) => {
  const { currentUser } = usePachas();
  const { t } = useTranslation();

  const userBalance = currentUser ? balances.find((b) => b.user_id === currentUser.id) : undefined;
  const net = userBalance?.net_balance || 0;
  const userPaid = userBalance?.total_paid || 0;
  const userOwed = userBalance?.total_owed || 0;

  return (
    <div className="space-y-4">
      {/* Primary User Balance Card */}
      <div
        className={`p-5 rounded-3xl border shadow-sm transition-all ${
          net > 0.01
            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-500/30 dark:bg-emerald-950/30 dark:border-emerald-800/40'
            : net < -0.01
            ? 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-orange-500/10 border-rose-500/30 dark:bg-rose-950/30 dark:border-rose-800/40'
            : 'bg-gradient-to-br from-slate-100/80 via-slate-50 to-slate-100/60 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
              {t('balances.yourStatus')}
            </span>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              {net > 0.01 ? (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t('balances.youAreOwed', { amount: formatMoney(net, group.base_currency) })}
                  </span>
                  <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </>
              ) : net < -0.01 ? (
                <>
                  <span className="text-rose-600 dark:text-rose-400">
                    {t('balances.youOwe', { amount: formatMoney(Math.abs(net), group.base_currency) })}
                  </span>
                  <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </>
              ) : (
                <>
                  <span className="text-slate-700 dark:text-slate-200">{t('balances.allSettled')}</span>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </>
              )}
            </h2>
          </div>

          {currentUser && <Avatar profile={currentUser} size="lg" className="ring-2 ring-emerald-500/30" />}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 text-center">
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">{t('balances.totalTrip')}</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {formatMoney(totalSpent, group.base_currency)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">{t('balances.youPaid')}</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(userPaid, group.base_currency)}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">{t('balances.yourShare')}</span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {formatMoney(userOwed, group.base_currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Friends Balances Breakdown */}
      <Card className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {t('balances.individualBalances')}
        </h4>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {balances.map((b) => {
            const isMe = currentUser ? b.user_id === currentUser.id : false;
            return (
              <div key={b.user_id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar profile={b.profile} size="sm" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {b.profile.full_name} {isMe && `(${t('common.you')})`}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {t('balances.paidAndOwed', { paid: formatMoney(b.total_paid, group.base_currency), owed: formatMoney(b.total_owed, group.base_currency) })}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-extrabold ${
                      b.net_balance > 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : b.net_balance < -0.01
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {b.net_balance > 0.01 ? '+' : ''}
                    {formatMoney(b.net_balance, group.base_currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

