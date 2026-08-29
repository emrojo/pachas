'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Cookie, X } from 'lucide-react';

export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('pachas_cookie_consent');
      if (!consent) {
        // Small timeout for smooth entry
        const timer = setTimeout(() => setIsVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('pachas_cookie_consent', 'true');
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('cookies.bannerText')}
          </div>
          <button
            type="button"
            onClick={handleAccept}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Link
            href="/cookies"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
          >
            {t('cookies.moreInfoBtn')}
          </Link>
          <Button size="sm" variant="brand" onClick={handleAccept} className="text-xs font-bold px-4 shadow-xs">
            {t('cookies.acceptBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
};
