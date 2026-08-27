import { es, TranslationDictionary } from './es';
import { en } from './en';
import { gl } from './gl';
import { ca } from './ca';
import { eu } from './eu';
import { va } from './va';
import { fr } from './fr';
import { pt } from './pt';
import { it } from './it';
import { de } from './de';
import { zh } from './zh';
import { ja } from './ja';
import { hi } from './hi';
import { ru } from './ru';
import { ar } from './ar';
import { el } from './el';
import { tr } from './tr';
import { nl } from './nl';
import { af } from './af';

export type LanguageCode =
  | 'es'
  | 'en'
  | 'gl'
  | 'ca'
  | 'eu'
  | 'va'
  | 'fr'
  | 'pt'
  | 'it'
  | 'de'
  | 'zh'
  | 'ja'
  | 'hi'
  | 'ru'
  | 'ar'
  | 'el'
  | 'tr'
  | 'nl'
  | 'af';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego', flag: '🏴󠁥󠁳󠁧󠁡󠁿' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català', flag: '🏴󠁥󠁳󠁣󠁴󠁿' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara', flag: '🏴󠁥󠁳󠁰󠁶󠁿' },
  { code: 'va', name: 'Valencian', nativeName: 'Valencià', flag: '🏴󠁥󠁳󠁶󠁣󠁿' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
];

export const DEFAULT_LANGUAGE: LanguageCode = 'es';

export const LOCALES: Record<LanguageCode, TranslationDictionary> = {
  es,
  en,
  gl,
  ca,
  eu,
  va,
  fr,
  pt,
  it,
  de,
  zh,
  ja,
  hi,
  ru,
  ar,
  el,
  tr,
  nl,
  af,
};

export type { TranslationDictionary };

