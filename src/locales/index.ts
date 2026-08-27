import { es, TranslationDictionary } from './es';
import { en } from './en';

export type LanguageCode = 'es' | 'en';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'es';

export const LOCALES: Record<LanguageCode, TranslationDictionary> = {
  es,
  en,
};

export type { TranslationDictionary };
