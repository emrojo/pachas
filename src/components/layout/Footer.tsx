'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { BuyMeACoffeeButton } from '@/components/donations/BuyMeACoffeeButton';
import { Shield, FileText, Cookie, Scale } from 'lucide-react';

export interface FooterProps {
  className?: string;
  showDonations?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', showDonations = true }) => {
  const { t } = useTranslation();

  return (
    <footer className={`w-full border-t border-slate-200/70 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs py-8 px-4 mt-auto text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
          <Link href="/" className="inline-flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 hover:text-emerald-600 transition-colors">
            <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">💸</span>
            <span>Pachas</span>
          </Link>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
          <p>© {new Date().getFullYear()} Pachas — {t('landing.footerText')}</p>
        </div>

        {/* Legal Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-medium">
          <Link
            href="/terms"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('nav.terms')}</span>
          </Link>

          <Link
            href="/privacy"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{t('nav.privacy')}</span>
          </Link>

          <Link
            href="/cookies"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>{t('nav.cookies')}</span>
          </Link>

          <Link
            href="/legal"
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{t('nav.legalNotice')}</span>
          </Link>
        </div>

        {/* Donations */}
        {showDonations && (
          <div className="shrink-0">
            <BuyMeACoffeeButton size="sm" showHeart customText={t('donations.buttonText')} />
          </div>
        )}
      </div>
    </footer>
  );
};
