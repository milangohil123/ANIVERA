export type SupportedLanguage = 'gu' | 'en' | 'hi';

export interface LanguageMeta {
  code: SupportedLanguage;
  name: string;        // Name in English
  nativeName: string;  // Name in its own script
  flag?: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    shortLabel: 'ગુ',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    shortLabel: 'EN',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    shortLabel: 'हि',
  },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'gu';
export const LANGUAGE_STORAGE_KEY = 'pashurakshak_language';

export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary;
};

