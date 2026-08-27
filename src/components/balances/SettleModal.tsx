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
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* From -> To Visual Flow */}
        <div className="flex items-center justify-between p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
          <div className="flex flex-col items-center gap-1">
            <Avatar profile={debt.from_profile} size="md" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {debt.from_profile.full_name.split(' ')[0]}
            </span>
            <span className="text-[10px] text-slate-500">{t('balances.pays')}</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-6 h-6 text-emerald-600 animate-pulse" />
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatMoney(currentParsedAmount, debt.currency)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Avatar profile={debt.to_profile} size="md" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {debt.to_profile.full_name.split(' ')[0]}
            </span>
            <span className="text-[10px] text-slate-500">{t('balances.receives')}</span>
          </div>
        </div>

        {/* Bizum phone quick info if available */}
        {paymentMethod === 'BIZUM' && debt.to_profile.bizum_phone && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/40">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-900 dark:text-blue-200">
                Bizum: <strong className="font-mono">{debt.to_profile.bizum_phone}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline"
            >
              {copiedPhone ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedPhone ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        )}

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            {t('balances.paymentMethod')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                  paymentMethod === m.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/50 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
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
        />

        {/* Notes */}
        <Input
          label={t('common.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('common.notes')}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="brand" isLoading={isLoading} className="flex-1">
            <CheckCircle2 className="w-4 h-4" />
            {t('balances.confirmSettlement')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

