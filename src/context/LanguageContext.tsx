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

export function detectRegionLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  const validCodes = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

  // 1. Direct and regional dialect matching from navigator.languages
  const rawList = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const raw of rawList) {
    if (!raw) continue;
    const lower = raw.toLowerCase().trim();

    // Check specific regional dialect codes
    if (lower.startsWith('ca-valencia') || lower.startsWith('es-valencia') || lower === 'va') {
      if (validCodes.has('va')) return 'va';
    }
    if (lower.startsWith('ca') || lower === 'cat') {
      if (validCodes.has('ca')) return 'ca';
    }
    if (lower.startsWith('gl') || lower === 'glg') {
      if (validCodes.has('gl')) return 'gl';
    }
    if (lower.startsWith('eu') || lower === 'eus' || lower === 'baq') {
      if (validCodes.has('eu')) return 'eu';
    }

    // Standard 2-letter ISO prefix
    const twoLetter = lower.slice(0, 2) as LanguageCode;
    if (validCodes.has(twoLetter)) {
      return twoLetter;
    }
  }

  // 2. Timezone geographic region matching
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const tzLower = tz.toLowerCase();
      if (
        tzLower.includes('madrid') ||
        tzLower.includes('canary') ||
        tzLower.includes('mexico') ||
        tzLower.includes('bogota') ||
        tzLower.includes('buenos_aires') ||
        tzLower.includes('santiago') ||
        tzLower.includes('lima')
      ) {
        return 'es';
      }
      if (tzLower.includes('paris')) return 'fr';
      if (tzLower.includes('rome')) return 'it';
      if (tzLower.includes('berlin') || tzLower.includes('vienna') || tzLower.includes('zurich')) return 'de';
      if (tzLower.includes('lisbon') || tzLower.includes('sao_paulo')) return 'pt';
      if (tzLower.includes('amsterdam') || tzLower.includes('brussels')) return 'nl';
      if (tzLower.includes('athens')) return 'el';
      if (tzLower.includes('istanbul')) return 'tr';
      if (tzLower.includes('tokyo')) return 'ja';
      if (tzLower.includes('shanghai') || tzLower.includes('hong_kong') || tzLower.includes('taipei')) return 'zh';
      if (tzLower.includes('kolkata') || tzLower.includes('calcutta')) return 'hi';
      if (tzLower.includes('moscow')) return 'ru';
      if (
        tzLower.includes('cairo') ||
        tzLower.includes('riyadh') ||
        tzLower.includes('dubai') ||
        tzLower.includes('casablanca')
      ) {
        return 'ar';
      }
      if (tzLower.includes('johannesburg')) return 'af';
      if (
        tzLower.includes('london') ||
        tzLower.includes('new_york') ||
        tzLower.includes('chicago') ||
        tzLower.includes('los_angeles') ||
        tzLower.includes('sydney')
      ) {
        return 'en';
      }
    }
  } catch {}

  return DEFAULT_LANGUAGE;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize language from localStorage or regional connection detection
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

        // Detect regional language automatically for unauthenticated or first-time sessions
        const detected = detectRegionLanguage();
        setLanguageState(detected);
        applyLanguageAttributes(detected);
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
