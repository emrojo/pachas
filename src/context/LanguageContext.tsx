'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  LanguageCode,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LOCALES,
  TranslationDictionary,
} from '@/locales';

export interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  languages: LanguageInfo[];
  currentLanguageInfo: LanguageInfo;
  t: (path: string, params?: Record<string, string | number>) => string;
  dictionary: TranslationDictionary;
}

const STORAGE_KEY = 'pachas_language_v1';

const LanguageContext = createContext<LanguageContextType | null>(null);

function getNestedValue(obj: any, path: string): string | undefined {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize language from localStorage or navigator
  useEffect(() => {
    setIsMounted(true);
    const validCodes = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

    const applyLanguageAttributes = (code: LanguageCode) => {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = code;
        const info = SUPPORTED_LANGUAGES.find((l) => l.code === code);
        if (info?.dir === 'rtl') {
          document.documentElement.dir = 'rtl';
        } else {
          document.documentElement.dir = 'ltr';
        }
      }
    };

    const readInitialLanguage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
        if (saved && validCodes.has(saved)) {
          setLanguageState(saved);
          applyLanguageAttributes(saved);
          return;
        }

        // Detect browser language
        if (typeof navigator !== 'undefined') {
          const rawLanguages = navigator.languages || [navigator.language || ''];
          for (const raw of rawLanguages) {
            const code = raw.slice(0, 2).toLowerCase() as LanguageCode;
            if (validCodes.has(code)) {
              setLanguageState(code);
              applyLanguageAttributes(code);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Could not read language preference:', e);
      }
    };

    readInitialLanguage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && validCodes.has(e.newValue as LanguageCode)) {
        const newCode = e.newValue as LanguageCode;
        setLanguageState(newCode);
        applyLanguageAttributes(newCode);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = code;
        const info = SUPPORTED_LANGUAGES.find((l) => l.code === code);
        if (info?.dir === 'rtl') {
          document.documentElement.dir = 'rtl';
        } else {
          document.documentElement.dir = 'ltr';
        }
      }
    } catch (e) {
      console.warn('Could not save language preference:', e);
    }
  }, []);



  const dictionary = LOCALES[language] || LOCALES[DEFAULT_LANGUAGE];
  const fallbackDictionary = LOCALES[DEFAULT_LANGUAGE];

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      // Look up in selected language dictionary
      let val = getNestedValue(dictionary, path);
      // Fallback to default language dictionary if missing
      if (val === undefined) {
        val = getNestedValue(fallbackDictionary, path);
      }
      if (val === undefined) {
        return path;
      }
      return interpolate(val, params);
    },
    [dictionary, fallbackDictionary]
  );

  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        languages: SUPPORTED_LANGUAGES,
        currentLanguageInfo,
        t,
        dictionary,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return a safe fallback if used outside LanguageProvider (e.g. in standalone tests)
    const fallbackDictionary = LOCALES[DEFAULT_LANGUAGE];
    const fallbackT = (path: string, params?: Record<string, string | number>) => {
      const val = getNestedValue(fallbackDictionary, path) || path;
      return interpolate(val, params);
    };
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      languages: SUPPORTED_LANGUAGES,
      currentLanguageInfo: SUPPORTED_LANGUAGES[0],
      t: fallbackT,
      dictionary: fallbackDictionary,
    };
  }
  return context;
}
