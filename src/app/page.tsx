'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePachas } from '@/context/PachasContext';
import { Button } from '@/components/ui/Button';
import { BuyMeACoffeeButton } from '@/components/donations/BuyMeACoffeeButton';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { useTranslation } from '@/context/LanguageContext';
import { Footer } from '@/components/layout/Footer';

import {
  Split,
  HandCoins,
  Sparkles,
  ArrowRight,
  Phone,
} from 'lucide-react';

export default function LandingPage() {
  const { currentUser, isLoading } = usePachas();
  const router = useRouter();
  const { t } = useTranslation();

  // Automatic redirect if already logged in
  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, isLoading, router]);

  // Fast check from local storage before context finishes hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pachas_user');
        if (saved && JSON.parse(saved)?.id) {
          router.replace('/dashboard');
        }
      } catch {}
    }
  }, [router]);

  if (currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl animate-pulse shadow-lg shadow-emerald-500/25 mb-4">
          💸
        </div>
        <span className="text-xs font-semibold text-slate-400">Accediendo a tus grupos...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xl shadow-md shadow-emerald-500/20">
            💸
          </div>
          <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">
            Pachas
          </span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector />

          <Link href="/login">
            <Button variant="ghost" size="sm">
              {t('auth.loginTitle')}
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="brand" size="sm">
              {t('landing.openApp')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 py-12 sm:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-6 shadow-xs animate-fade-in">
          <Sparkles className="w-4 h-4" />
          <span>{t('landing.heroBadge')}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl leading-[1.15]">
          {t('landing.heroTitlePart1')}{' '}
          <span className="text-emerald-600 dark:text-emerald-400 underline decoration-emerald-300 underline-offset-8">
            {t('landing.heroTitleHighlight')}
          </span>{' '}
          {t('landing.heroTitlePart2')}
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl">
          {t('landing.heroSubtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button size="lg" variant="brand" className="w-full sm:w-auto shadow-lg shadow-emerald-600/25">
              {t('landing.startFree')}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              {t('auth.loginTitle')}
            </Button>
          </Link>
        </div>

        {/* Hero Demo Mockup */}
        <div className="mt-14 w-full max-w-3xl rounded-3xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">🏖️</span>
              <div className="text-left">
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {t('landing.mockTripName')}
                </h3>
                <span className="text-xs text-slate-400">{t('landing.mockTripStats')}</span>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
              {t('landing.mockOwed')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚗</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t('landing.mockVan')}
                  </h4>
                  <span className="text-[11px] text-slate-400">{t('landing.mockVanDetail')}</span>
                </div>
              </div>
              <span className="font-black text-sm text-slate-900 dark:text-white">280,00 €</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🍽️</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {t('landing.mockDinner')}
                  </h4>
                  <span className="text-[11px] text-slate-400">{t('landing.mockDinnerDetail')}</span>
                </div>
              </div>
              <span className="font-black text-sm text-slate-900 dark:text-white">175,00 €</span>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-4">
              <Split className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {t('landing.feature1Title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {t('landing.feature1Desc')}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center mb-4">
              <HandCoins className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {t('landing.feature2Title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {t('landing.feature2Desc')}
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mb-4">
              <Phone className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {t('landing.feature3Title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {t('landing.feature3Desc')}
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}


