'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { BuyMeACoffeeButton } from '@/components/donations/BuyMeACoffeeButton';
import { DONATION_CONFIG } from '@/lib/constants/donations';
import { useTranslation } from '@/context/LanguageContext';
import { useDonationUrl } from '@/lib/useDonationUrl';
import { Heart, Sparkles, Server } from 'lucide-react';

export interface DonationCardProps {
  className?: string;
  compact?: boolean;
}

export const DonationCard: React.FC<DonationCardProps> = ({
  className = '',
  compact = false,
}) => {
  const donationUrl = useDonationUrl();
  const { t } = useTranslation();

  return (
    <Card className={`p-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-200/80 dark:border-amber-900/40 relative overflow-hidden shadow-xs ${className}`}>
      {/* Decorative background coffee pattern */}
      <div className="absolute -top-6 -right-6 text-amber-500/10 dark:text-amber-400/5 text-9xl select-none pointer-events-none rotate-12">
        ☕
      </div>

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFDD00] text-slate-900 flex items-center justify-center text-xl shadow-xs shrink-0">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {t('donations.title')}
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {t('donations.voluntarySupport')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('donations.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Text Body */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('donations.description')}
        </p>

        {/* Feature Pills */}
        {!compact && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-1">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <Heart className="w-4 h-4 text-rose-500 shrink-0 fill-rose-500/20" />
              <span>{t('donations.freeAndNoAds')}</span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <Server className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t('donations.serverSupport')}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('donations.futureFeatures')}</span>
            </div>
          </div>
        )}

        {/* Preset coffee buttons & Main Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-amber-200/60 dark:border-amber-900/30">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {DONATION_CONFIG.presetOptions.map((opt) => (
              <a
                key={opt.count}
                href={donationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-all shadow-2xs"
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
                <span className="text-amber-600 dark:text-amber-400 font-extrabold">({opt.amount})</span>
              </a>
            ))}
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <BuyMeACoffeeButton size="md" showHeart className="w-full sm:w-auto shadow-md" />
          </div>
        </div>
      </div>
    </Card>
  );

};
