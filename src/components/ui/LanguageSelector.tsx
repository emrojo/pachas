'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { ChevronDown, Check } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full' | 'buttons';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { language, setLanguage, languages, currentLanguageInfo } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 ${className}`}>
        {languages.map((l) => {
          const isSelected = l.code === language;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FlagIcon code={l.code} className="w-5 h-3.5 shadow-xs" />
              <span>{l.nativeName}</span>
              <span className="text-[10px] uppercase font-mono opacity-60">({l.code})</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-800 shadow-2xs"
        title="Cambiar idioma / Change language"
      >
        <FlagIcon code={language} className="w-5 h-3.5 shadow-xs" />
        <span className="uppercase text-[11px] font-extrabold tracking-wide text-slate-800 dark:text-slate-200">
          {language}
        </span>
        {variant === 'full' && <span>{currentLanguageInfo.nativeName}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-black/10 p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          {languages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FlagIcon code={l.code} className="w-5 h-3.5 shadow-xs" />
                  <span className="font-bold">{l.nativeName}</span>
                  <span className="text-[10px] uppercase font-mono text-slate-400">({l.code})</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

