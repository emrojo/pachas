'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { useTranslation } from '@/context/LanguageContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { CreateUserModal } from '@/components/profile/CreateUserModal';
import { Profile } from '@/types/database';
import { Mail, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { isDemoModeAllowed } from '@/lib/authConfig';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams?.get('redirectTo') || '/dashboard';
  const redirectTo =
    !rawRedirect || rawRedirect.startsWith('/login') || rawRedirect.startsWith('/register')
      ? '/dashboard'
      : rawRedirect;

  const { currentUser, setCurrentUser, availableUsers, isCurrentUserAdmin } = usePachas();
  const { t } = useTranslation();

  const [email, setEmail] = useState(searchParams?.get('email') || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  const isDemoAllowed = isDemoModeAllowed();

  // If already authenticated, forward to destination
  useEffect(() => {
    if (currentUser) {
      router.replace(redirectTo);
    }
  }, [currentUser, redirectTo, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Try unified PostgreSQL / Server auth API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const resData = await res.json();

      if (res.ok && resData.user) {
        setCurrentUser(resData.user);
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      // 2. If API returned error and demo mode is permitted, check local availableUsers
      if (isDemoAllowed) {
        const found = availableUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (found) {
          setCurrentUser(found);
          router.replace(redirectTo);
          router.refresh();
          return;
        }
      }

      setError(resData.error || t('auth.invalidCredentials'));
    } catch (err: any) {
      if (isDemoAllowed) {
        const found = availableUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (found) {
          setCurrentUser(found);
          router.replace(redirectTo);
          router.refresh();
          return;
        }
      }
      setError(err.message || t('auth.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSelect = async (user: Profile) => {
    if (!isDemoAllowed) {
      setError('Demo mode is disabled');
      return;
    }
    setIsLoading(true);
    setCurrentUser(user);
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          isDemo: true,
        }),
      });
    } catch {}
    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950">
      {/* Top Header with Brand and Language Selector */}
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

      {/* Main Centered Hero / Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          {/* Title Header */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {t('auth.loginTitle')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <div>
              <Input
                label={t('auth.password')}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
              <div className="flex justify-end mt-1.5">
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
                >
                  {t('auth.forgotPasswordLink')}
                </Link>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 font-medium">
                {error}
              </div>
            )}

            <Button type="submit" variant="brand" className="w-full py-3 shadow-md" isLoading={isLoading}>
              {t('auth.loginButton')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Local Fast Access & User Creation (Visible only in Development/Demo Mode) */}
          {isDemoAllowed && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  Demo ({availableUsers.length}):
                </span>
                {isCurrentUserAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsCreateUserOpen(true)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + Crear usuario
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoSelect(u)}
                    disabled={isLoading}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2 text-left transition-all text-xs cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Avatar profile={u} size="sm" />
                    <div className="truncate min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {u.full_name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block">{u.email}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer link */}
          <p className="text-center text-xs text-slate-500 mt-6">
            {t('auth.noAccount')}{' '}
            <Link href="/register" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              {t('auth.registerHere')}
            </Link>
          </p>
        </div>
      </main>

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onSuccess={(created) => {
          handleQuickDemoSelect(created);
        }}
      />

      <Footer showDonations={false} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
