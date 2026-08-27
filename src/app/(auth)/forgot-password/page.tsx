'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { ArrowLeft, KeyRound, CheckCircle2, Mail, ArrowRight } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetInfo, setResetInfo] = useState<{ message: string; resetUrl?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError(t('auth.invalidCredentials'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setResetInfo(null);

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('auth.invalidCredentials'));
        return;
      }

      setResetInfo({
        message: data.message,
        resetUrl: data.resetUrl,
      });
    } catch (err: any) {
      setError(err.message || t('auth.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 relative">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/login" className="inline-flex items-center gap-2 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/25">
              💸
            </div>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {t('auth.forgotPasswordSubtitle')}
          </p>
        </div>

        <Card className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6">
          {resetInfo ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('auth.requestReceived')}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {resetInfo.message}
              </p>

              {resetInfo.resetUrl && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-2">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                    {t('auth.resetLink')}:
                  </span>
                  <Link href={resetInfo.resetUrl} className="block">
                    <Button variant="brand" size="sm" className="w-full justify-between shadow-xs">
                      <span>{t('auth.resetPasswordNow')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link href="/login" className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-500">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.email')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full shadow-md"
                isLoading={isLoading}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                {t('auth.sendResetLink')}
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

