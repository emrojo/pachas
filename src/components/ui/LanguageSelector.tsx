'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { ChevronDown, Check, Search, X, Globe } from 'lucide-react';
import { LanguageCode } from '@/locales';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full' | 'buttons' | 'grid';
  className?: string;
  onSelectLanguage?: (code: LanguageCode) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'compact',
  className = '',
  onSelectLanguage,
}) => {
  const { language, setLanguage, languages, currentLanguageInfo } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return languages;
    const query = searchQuery.trim().toLowerCase();
    return languages.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.nativeName.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query)
    );
  }, [languages, searchQuery]);

  // 1. GRID / PROFILE VARIANT: Searchable, responsive grid capped with scrolling
  if (variant === 'grid' || variant === 'buttons') {
    return (
      <div className={`space-y-3 w-full ${className}`}>
        {/* Search input if more than 6 languages */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar idioma / Search language..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable Language Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto overscroll-contain pr-1 -mr-1">
          {filteredLanguages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  if (onSelectLanguage) onSelectLanguage(l.code);
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all group ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 dark:text-emerald-100 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FlagIcon code={l.code} className="w-5 h-3.5 shrink-0 shadow-xs rounded-[2px]" />
                  <div className="min-w-0">
                    <span className="block text-xs font-bold truncate leading-tight">
                      {l.nativeName}
                    </span>
                    <span className="block text-[10px] text-slate-400 truncate leading-tight">
                      {l.name}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                ) : (
                  <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0 ml-1 opacity-60 group-hover:opacity-100">
                    {l.code}
                  </span>
                )}
              </button>
            );
          })}

          {filteredLanguages.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-slate-400">
              No se encontraron idiomas con &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. DROPDOWN COMPACT / FULL VARIANT (Navbar, Headers, etc.)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200/80 dark:border-slate-800 shadow-2xs"
        title="Cambiar idioma / Change language"
      >
        <FlagIcon code={language} className="w-4 h-3 shadow-xs rounded-[2px]" />
        <span className="uppercase text-[11px] font-extrabold tracking-wide text-slate-800 dark:text-slate-200">
          {language}
        </span>
        {variant === 'full' && <span className="hidden sm:inline">{currentLanguageInfo.nativeName}</span>}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl shadow-black/10 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md">
          {/* Quick Search */}
          <div className="relative mb-1 px-1 pt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar / Search..."
              className="w-full pl-8 pr-6 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Scrollable Items */}
          <div className="max-h-64 overflow-y-auto overscroll-contain space-y-0.5 pr-0.5">
            {filteredLanguages.map((l) => {
              const isSelected = l.code === language;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLanguage(l.code);
                    if (onSelectLanguage) onSelectLanguage(l.code);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FlagIcon code={l.code} className="w-4 h-3 shrink-0 shadow-xs rounded-[2px]" />
                    <div className="min-w-0">
                      <span className="block font-bold truncate leading-tight">{l.nativeName}</span>
                      <span className="block text-[10px] text-slate-400 truncate leading-tight">{l.name}</span>
                    </div>
                  </div>

                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                  ) : (
                    <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0 ml-1">
                      {l.code}
                    </span>
                  )}
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-400">
                Sin resultados
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
