'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/context/LanguageContext';
import { usePachas } from '@/context/PachasContext';
import { ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'expense' | 'receipt' | 'user' | 'group';
  targetId: string;
  targetTitle?: string;
}

export const ReportContentModal: React.FC<ReportContentModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}) => {
  const { t } = useTranslation();
  const { currentUser } = usePachas();

  const [reason, setReason] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const REASONS = [
    { id: 'inappropriate', label: t('safety.reasons.inappropriate') },
    { id: 'privacy', label: t('safety.reasons.privacy') },
    { id: 'fraud', label: t('safety.reasons.fraud') },
    { id: 'spam', label: t('safety.reasons.spam') },
    { id: 'other', label: t('safety.reasons.other') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          targetTitle,
          reason,
          details: details.trim() || undefined,
          reporterEmail: currentUser?.email || 'anon',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('safety.reportError'));
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setDetails('');
        setReason('inappropriate');
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || t('safety.reportError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('safety.reportTitle')}
      description={targetTitle ? `${t('expenses.title')}: ${targetTitle}` : t('safety.reportSubtitle')}
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="py-6 text-center space-y-3 animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('safety.reportSuccess')}
          </h4>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              {t('safety.reportReason')} *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              {t('safety.details')}
            </label>
            <textarea
              rows={3}
              placeholder={t('safety.detailsPlaceholder')}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-xs"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="sm"
              isLoading={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              <ShieldAlert className="w-4 h-4 mr-1" />
              {t('safety.submitReport')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
