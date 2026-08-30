'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { isDemoModeAllowed } from '@/lib/authConfig';
import { User, Mail, Phone, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get('redirectTo') || '/dashboard';
  const redirectTo =
    !rawRedirect || rawRedirect.startsWith('/login') || rawRedirect.startsWith('/register')
      ? '/dashboard'
      : rawRedirect;

  const { currentUser, setCurrentUser, createLocalUser } = usePachas();
  const { t } = useTranslation();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isDemoAllowed = isDemoModeAllowed();

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (currentUser) {
      router.replace(redirectTo);
    }
  }, [currentUser, redirectTo, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError(t('auth.nameRequired'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('auth.termsRequired'));
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // 1. Try unified PostgreSQL auth API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
          acceptedTerms: true,
        }),
      });

      const resData = await res.json();

      if (res.ok && resData.user) {
        setCurrentUser(resData.user);
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // If database is not configured but demo mode is allowed
      if (isDemoAllowed) {
        const newLocal = await createLocalUser({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          bizum_phone: phone.trim() || undefined,
        });
        setCurrentUser(newLocal);
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setError(resData.error || t('auth.registerError'));
    } catch (err: any) {
      if (isDemoAllowed) {
        try {
          const newLocal = await createLocalUser({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            bizum_phone: phone.trim() || undefined,
          });
          setCurrentUser(newLocal);
          router.replace(redirectTo);
          router.refresh();
          return;
        } catch {}
      }
      setError(err.message || t('auth.registerError'));
    } finally {
      setIsLoading(false);
    }
  };

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

      {/* Centered Main Form */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {t('auth.registerTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('auth.registerSubtitle')}
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label={`${t('auth.fullName')} *`}
              placeholder="Laura Sánchez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label={`${t('auth.email')} *`}
              type="email"
              placeholder="laura@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label={t('auth.phoneForBizum')}
              type="tel"
              placeholder="+34 600 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <Input
              label={`${t('auth.password')} *`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              minLength={6}
            />

            {/* Legal Terms Acceptance Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <span className="leading-snug">
                  {t('auth.acceptTerms')}{' '}
                  <Link href="/terms" target="_blank" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    {t('auth.termsLink')}
                  </Link>{' '}
                  {t('auth.andThe')}{' '}
                  <Link href="/privacy" target="_blank" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    {t('auth.privacyLink')}
                  </Link>
                  .
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}

            <Button type="submit" variant="brand" className="w-full py-3 shadow-md" isLoading={isLoading}>
              {t('auth.registerButton')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            {t('auth.haveAccount')}{' '}
            <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              {t('auth.loginButton')}
            </Link>
          </p>
        </div>
      </main>

      <Footer showDonations={false} />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
