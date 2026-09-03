'use client';

import React from 'react';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { PendingReceiptScan } from '@/types/database';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PendingScansBannerProps {
  groupId?: string;
  onSelectScanToValidate: (scan: PendingReceiptScan) => void;
}

export const PendingScansBanner: React.FC<PendingScansBannerProps> = ({
  groupId,
  onSelectScanToValidate,
}) => {
  const { pendingReceiptScans, dismissPendingScan } = usePachas();
  const { t } = useTranslation();

  // Filter scans relevant to this group or all if on dashboard
  const relevantScans = (pendingReceiptScans || []).filter(
    (s) => !groupId || s.group_id === groupId
  );

  if (relevantScans.length === 0) return null;

  const readyScans = relevantScans.filter((s) => s.status === 'ready');
  const processingScans = relevantScans.filter((s) => s.status === 'processing');
  const errorScans = relevantScans.filter((s) => s.status === 'error');

  return (
    <div className="space-y-2.5 my-3">
      {/* Ready to Validate Scans */}
      {readyScans.map((scan) => {
        const title = scan.scanned_data?.title || 'Nuevo ticket';
        const amount = scan.scanned_data?.amountFormatted
          ? `${scan.scanned_data.amountFormatted} €`
          : scan.scanned_data?.amount
          ? `${scan.scanned_data.amount} €`
          : '';

        return (
          <div
            key={scan.id}
            className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                    🧾 {t('expenses.reviewRequired')}:
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {title} {amount && `(${amount})`}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  {t('expenses.pendingValidationNotice')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <Button
                size="sm"
                variant="brand"
                onClick={() => onSelectScanToValidate(scan)}
                className="text-xs font-bold gap-1.5 shadow-xs"
              >
                <span>{t('expenses.reviewAndValidate')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Processing Scans */}
      {processingScans.map((scan) => (
        <div
          key={scan.id}
          className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-bold">{t('expenses.analyzingReceipt')}</span>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 block">
                {t('expenses.backgroundOcrNotice')}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Error Scans */}
      {errorScans.map((scan) => (
        <div
          key={scan.id}
          className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-bold">{t('expenses.ocrFailedTitle')}</span>
              <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80 block">
                {scan.error_message || t('expenses.ocrFailedDesc')}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => dismissPendingScan(scan.id)}
            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-100 dark:border-rose-900 shrink-0"
          >
            {t('common.discard')}
          </Button>
        </div>
      ))}
    </div>
  );
};
