'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/context/LanguageContext';
import { BuyMeACoffeeButton } from '@/components/donations/BuyMeACoffeeButton';
import { Shield, FileText, Cookie, Scale, Lock, HeartHandshake, Code2 } from 'lucide-react';

export interface FooterProps {
  className?: string;
  showDonations?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ className = '', showDonations = true }) => {
  const { t } = useTranslation();

  return (
    <footer className={`w-full border-t border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md py-8 px-4 mt-auto text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Main Footer Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Slogan */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-2 font-black text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-sm shadow-xs shadow-emerald-500/20">💸</span>
              <span className="text-base tracking-tight">Pachas</span>
            </Link>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('landing.footerText') || 'Divide gastos, multiplica planes.'}
            </p>
          </div>

          {/* Legal Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-semibold text-slate-600 dark:text-slate-300">
            <Link
              href="/terms"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('nav.terms')}</span>
            </Link>

            <Link
              href="/privacy"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('nav.privacy')}</span>
            </Link>

            <Link
              href="/cookies"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Cookie className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('nav.cookies')}</span>
            </Link>

            <Link
              href="/legal"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('nav.legalNotice')}</span>
            </Link>

            <Link
              href="/licenses"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5 text-purple-500" />
              <span>{t('nav.licenses')}</span>
            </Link>
          </div>

          {/* Donations Button */}
          {showDonations && (
            <div className="shrink-0">
              <BuyMeACoffeeButton size="sm" showHeart customText={t('donations.buttonText')} />
            </div>
          )}
        </div>

        {/* Legal & Regulatory Compliance Notice */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-left">
          <div className="flex items-center gap-2 max-w-2xl">
            <Lock className="w-3.5 h-3.5 text-emerald-600/80 shrink-0 hidden sm:inline" />
            <span>
              Herramienta de cálculo y reparto financiero entre particulares. Conforme con RGPD (UE 2016/679), LOPDGDD y LSSI-CE. Sin custodia ni intermediación bancaria.
            </span>
          </div>
          <p className="shrink-0 font-medium">
            © {new Date().getFullYear()} Pachas. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
