'use client';

import React, { useState } from 'react';
import { Group, SimplifiedDebt } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { SettleModal } from '@/components/balances/SettleModal';
import { formatMoney } from '@/lib/currencies';
import { ArrowRight, CheckCircle2, HandCoins } from 'lucide-react';

export const DebtList: React.FC<{
  group: Group;
  debts: SimplifiedDebt[];
}> = ({ group, debts }) => {
  const { currentUser } = usePachas();
  const { t } = useTranslation();
  const [selectedDebt, setSelectedDebt] = useState<SimplifiedDebt | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-emerald-600" />
            {t('balances.suggestedSettlement')}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('balances.suggestedSettlementSubtitle')}
          </p>
        </div>
      </div>

      {debts.length === 0 ? (
        <Card className="text-center py-8 bg-emerald-50/40 dark:bg-emerald-950/20 border-dashed border-emerald-300 dark:border-emerald-800">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('balances.allSettled')}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {t('balances.noDebts')}
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {debts.map((debt, idx) => {
            const isMeDebtor = currentUser ? debt.from_user_id === currentUser.id : false;
            const isMeCreditor = currentUser ? debt.to_user_id === currentUser.id : false;
            const isInvolved = isMeDebtor || isMeCreditor;

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isInvolved
                    ? 'bg-white dark:bg-slate-900 border-emerald-500/40 dark:border-emerald-700/50 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Left: From -> To */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center -space-x-1 shrink-0">
                    <Avatar profile={debt.from_profile} size="sm" />
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center z-10">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                    <Avatar profile={debt.to_profile} size="sm" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1 flex-wrap">
                      <span className={isMeDebtor ? 'text-rose-600 font-extrabold' : ''}>
                        {debt.from_profile.full_name}
                      </span>
                      <span className="text-slate-400 font-normal">{t('balances.mustPayTo')}</span>
                      <span className={isMeCreditor ? 'text-emerald-600 font-extrabold' : ''}>
                        {debt.to_profile.full_name}
                      </span>
                    </div>

                    {debt.to_profile.bizum_phone && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Bizum: {debt.to_profile.bizum_phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Settle Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {formatMoney(debt.amount, debt.currency)}
                  </span>

                  <Button
                    size="sm"
                    variant={isMeDebtor ? 'brand' : 'secondary'}
                    onClick={() => setSelectedDebt(debt)}
                    className="text-xs py-1.5 px-3"
                  >
                    {t('balances.settleDebtBtn')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle Modal */}
      <SettleModal
        groupId={group.id}
        debt={selectedDebt}
        isOpen={!!selectedDebt}
        onClose={() => setSelectedDebt(null)}
      />
    </div>
  );
};

