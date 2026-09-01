'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { Footer } from '@/components/layout/Footer';
import { ThirdPartyLicenses } from '@/components/legal/ThirdPartyLicenses';
import { Code2, ArrowLeft, Shield } from 'lucide-react';

export default function LicensesPage() {
  const { t, language } = useTranslation();
  const isEn = language === 'en';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-300 hover:text-emerald-600">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back')}</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm">💸</span>
              <span className="hidden sm:inline">Pachas</span>
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-8">
        <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
            <Code2 className="w-3.5 h-3.5" />
            <span>{isEn ? 'Open Source Compliance' : 'Cumplimiento de Licencias Open Source'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {isEn ? 'Third-Party Software & Licenses' : 'Librerías de Terceros y Licencias'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {t('legal.lastUpdated')}
          </p>
        </div>

        {/* Third Party Licenses Component */}
        <ThirdPartyLicenses />
      </main>

      <Footer />
    </div>
  );
}
