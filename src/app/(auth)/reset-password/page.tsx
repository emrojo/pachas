'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { Lock, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { t } = useTranslation();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError(t('auth.error'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('auth.passwordLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('common.error'));
        return;
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-6">
      {isSuccess ? (
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('auth.passwordResetSuccess')}
          </h2>
          <div className="pt-2">
            <Link href="/login" className="block">
              <Button variant="brand" size="lg" className="w-full shadow-md">
                {t('auth.loginTitle')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
              {error}
            </div>
          )}

          {!token ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-xs text-rose-500 font-medium">
                {t('auth.forgotPasswordSubtitle')}
              </p>
              <Link href="/forgot-password" className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-500">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                {t('auth.sendResetLink')}
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.confirmPassword')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
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
                {t('auth.setNewPassword')}
              </Button>

              <div className="text-center pt-2">
                <Link href="/login" className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  {t('auth.backToLogin')}
                </Link>
              </div>
            </>
          )}
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto p-4 sm:p-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
            💸
          </div>
          <span className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">
            Pachas
          </span>
        </Link>
        <LanguageSelector />
      </header>

      {/* Main Centered Form */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {t('auth.resetPasswordTitle')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('auth.resetPasswordSubtitle')}
            </p>
          </div>

          <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">{t('common.loading')}</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </main>

      <Footer showDonations={false} />
    </div>
  );
}
