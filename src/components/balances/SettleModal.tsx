'use client';

import React, { useState } from 'react';
import { SimplifiedDebt, PaymentMethod } from '@/types/database';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatMoney, parseEuropeanAmount, formatNumber } from '@/lib/currencies';
import confetti from 'canvas-confetti';
import { ArrowRight, Phone, CheckCircle2, Copy, Check } from 'lucide-react';

export interface SettleModalProps {
  groupId: string;
  debt: SimplifiedDebt | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SettleModal: React.FC<SettleModalProps> = ({
  groupId,
  debt,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { recordSettlement } = usePachas();
  const { t } = useTranslation();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BIZUM');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Set initial debt amount when opened with European formatting
  React.useEffect(() => {
    if (debt) {
      setAmountStr(Number(debt.amount || 0).toFixed(2).replace('.', ','));
      setNotes(`Liquidación - ${debt.from_profile.full_name} ➔ ${debt.to_profile.full_name}`);
    }
  }, [debt]);

  if (!debt) return null;

  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#f59e0b'],
    });
  };

  const handleCopyPhone = () => {
    if (debt.to_profile.bizum_phone) {
      navigator.clipboard.writeText(debt.to_profile.bizum_phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const currentParsedAmount = parseEuropeanAmount(amountStr) || debt.amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseEuropeanAmount(amountStr) || debt.amount;

    try {
      setIsLoading(true);
      await recordSettlement(
        groupId,
        debt.from_user_id,
        debt.to_user_id,
        amount,
        paymentMethod,
        notes
      );
      triggerCelebration();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error settling debt:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'BIZUM', label: t('balances.paymentMethods.bizum'), icon: '📱' },
    { id: 'REVOLUT', label: t('balances.paymentMethods.revolut'), icon: '🟣' },
    { id: 'CASH', label: t('balances.paymentMethods.cash'), icon: '💵' },
    { id: 'BANK_TRANSFER', label: t('balances.paymentMethods.transfer'), icon: '🏦' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('balances.settleDebt')}
      description={t('balances.settleModalSubtitle')}
    >
      <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-4 sm:hidden" />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* From -> To Visual Flow Card */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-50/80 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center text-center gap-1.5 min-w-[72px]">
              <div className="ring-2 ring-emerald-500/30 rounded-full p-0.5">
                <Avatar profile={debt.from_profile} size="md" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[85px]">
                {debt.from_profile.full_name.split(' ')[0]}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t('balances.pays')}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center gap-1 px-2 text-center flex-1">
              <span className="text-xl sm:text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {formatMoney(currentParsedAmount, debt.currency)}
              </span>
              <ArrowRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            </div>

            <div className="flex flex-col items-center text-center gap-1.5 min-w-[72px]">
              <div className="ring-2 ring-teal-500/30 rounded-full p-0.5">
                <Avatar profile={debt.to_profile} size="md" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[85px]">
                {debt.to_profile.full_name.split(' ')[0]}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {t('balances.receives')}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Tap Bizum Quick Action & Copy Phone Badge */}
        {paymentMethod === 'BIZUM' && debt.to_profile.bizum_phone && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <a
              href={`bizum://send?phone=${debt.to_profile.bizum_phone.replace(/\s+/g, '')}&amount=${currentParsedAmount}`}
              onClick={() => handleCopyPhone()}
              className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-600 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <span className="text-base">📱</span>
              <span>Pagar con Bizum</span>
            </a>

            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-teal-50 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800/40">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-xs text-teal-900 dark:text-teal-200 truncate">
                  Bizum: <strong className="font-mono">{debt.to_profile.bizum_phone}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="min-h-[36px] px-3 py-1 text-xs text-teal-700 dark:text-teal-300 bg-teal-100/80 dark:bg-teal-900/60 rounded-xl font-bold flex items-center gap-1.5 hover:bg-teal-200 transition-colors shrink-0"
              >
                {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPhone ? t('common.copied') : t('common.copy')}
              </button>
            </div>
          </div>
        )}

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            {t('balances.paymentMethod')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`min-h-[58px] p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 ${
                  paymentMethod === m.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 text-center">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <Input
          label={`${t('expenses.amount')} *`}
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          required
          className="text-base"
        />

        {/* Notes */}
        <Input
          label={t('common.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('common.notes')}
          className="text-base"
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 min-h-[48px] text-sm font-semibold rounded-2xl"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="brand"
            isLoading={isLoading}
            className="flex-1 min-h-[48px] text-sm sm:text-base font-bold rounded-2xl shadow-md shadow-emerald-600/25"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5 shrink-0" />
            <span>{t('balances.confirmSettlement')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};

