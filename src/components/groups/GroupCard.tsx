'use client';

import React from 'react';
import Link from 'next/link';
import { Group } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney } from '@/lib/currencies';
import { Users, ArrowUpRight, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

export const GroupCard: React.FC<{ group: Group }> = ({ group }) => {
  const { getGroupMembers, getGroupExpenses, getGroupBalances, currentUser } = usePachas();

  const members = getGroupMembers(group.id);
  const expenses = getGroupExpenses(group.id);
  const balances = getGroupBalances(group.id);

  const totalSpent = expenses.reduce(
    (sum, e) => sum + (e.converted_amount || e.amount),
    0
  );

  const userBalance = balances.find((b) => b.user_id === currentUser.id);
  const net = userBalance?.net_balance || 0;

  return (
    <Link href={`/groups/${group.id}`} className="block group">
      <Card hoverEffect className="relative overflow-hidden flex flex-col justify-between h-full">
        {/* Cover / Icon Header */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-3xl shadow-xs group-hover:scale-110 transition-transform">
              {group.icon_emoji}
            </div>

            {/* Status Badge */}
            <div>
              {net > 0.01 ? (
                <Badge variant="emerald">
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                  Te deben {formatMoney(net, group.base_currency)}
                </Badge>
              ) : net < -0.01 ? (
                <Badge variant="rose">
                  <TrendingDown className="w-3 h-3 text-rose-600" />
                  Debes {formatMoney(Math.abs(net), group.base_currency)}
                </Badge>
              ) : (
                <Badge variant="gray">
                  <CheckCircle2 className="w-3 h-3 text-slate-500" />
                  En paz
                </Badge>
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
            {group.name}
            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
          </h3>

          {group.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
              {group.description}
            </p>
          )}
        </div>

        {/* Footer info: Members Avatars & Total Spend */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center -space-x-2 overflow-hidden">
            {members.slice(0, 4).map((m) => (
              <Avatar
                key={m.id}
                profile={m.profile}
                size="sm"
                className="ring-2 ring-white dark:ring-slate-900"
              />
            ))}
            {members.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                +{members.length - 4}
              </div>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
              Gasto total
            </span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {formatMoney(totalSpent, group.base_currency)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
};
