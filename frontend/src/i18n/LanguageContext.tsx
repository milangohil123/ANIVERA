import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  type SupportedLanguage,
  type LanguageMeta,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from './types';
import { gu } from './locales/gu';
import { en } from './locales/en';
import { hi } from './locales/hi';
import {
  getLocalizedDistrictName,
  formatLocalizedDate,
  formatLocalizedNumber,
} from './localize';

const dictionaries: Record<SupportedLanguage, any> = {
  gu,
  en,
  hi,
};

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  localizeDistrict: (districtInput: any) => string;
  formatDate: (dateInput: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number | null | undefined) => string;
  supportedLanguages: LanguageMeta[];
  currentLanguageMeta: LanguageMeta;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// Helper to resolve dot-notated string path inside nested object
function resolvePath(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

// Global reference for standalone calls initialized from storage
const getInitialStoredLang = (): SupportedLanguage => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'gu' || stored === 'en' || stored === 'hi') {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANGUAGE;
};

let globalCurrentLanguage: SupportedLanguage = getInitialStoredLang();

const formatMissingKeyFallback = (key: string, lang: string): string => {
  if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && (window as any).__DEV__)) {
    console.warn(`[i18n] Missing translation key: "${key}" for language "${lang}"`);
  }
  if (key.includes('.')) {
    const lastPart = key.split('.').pop() || key;
    return lastPart
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || key;
  }
  return key;
};

export const tStandalone = (key: string, params?: Record<string, string | number>): string => {
  const dict = dictionaries[globalCurrentLanguage] || dictionaries[DEFAULT_LANGUAGE];
  let text = resolvePath(dict, key);

  // Fallback to Gujarati if missing
  if (!text && globalCurrentLanguage !== 'gu') {
    text = resolvePath(dictionaries.gu, key);
  }
  // Fallback to English if still missing
  if (!text && globalCurrentLanguage !== 'en') {
    text = resolvePath(dictionaries.en, key);
  }

  if (!text) {
    return formatMissingKeyFallback(key, globalCurrentLanguage);
  }

  if (params) {
    return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
      return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
    }, text);
  }

  return text;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'gu' || stored === 'en' || stored === 'hi') {
        return stored;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    globalCurrentLanguage = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore
    }
    // Update HTML root element lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (lang === 'gu' || lang === 'en' || lang === 'hi') {
      globalCurrentLanguage = lang;
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch {
        // ignore
      }
      document.documentElement.lang = lang;
      setLanguageState(lang);
      try {
        window.dispatchEvent(new CustomEvent('pashurakshak:languagechange', { detail: { language: lang } }));
      } catch {
        // ignore
      }
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = dictionaries[language] || dictionaries[DEFAULT_LANGUAGE];
      let text = resolvePath(dict, key);

      // Fallback to Gujarati
      if (!text && language !== 'gu') {
        text = resolvePath(dictionaries.gu, key);
      }
      // Fallback to English
      if (!text && language !== 'en') {
        text = resolvePath(dictionaries.en, key);
      }

      if (!text) {
        return formatMissingKeyFallback(key, language);
      }

      if (params) {
        return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
          return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }, text);
      }

      return text;
    },
    [language]
  );

  const localizeDistrict = useCallback(
    (districtInput: any): string => {
      return getLocalizedDistrictName(districtInput, language);
    },
    [language]
  );

  const formatDate = useCallback(
    (dateInput: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
      return formatLocalizedDate(dateInput, language, options);
    },
    [language]
  );

  const formatNumber = useCallback(
    (num: number | null | undefined): string => {
      return formatLocalizedNumber(num, language);
    },
    [language]
  );

  const currentLanguageMeta = useMemo(() => {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0]
    );
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      localizeDistrict,
      formatDate,
      formatNumber,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageMeta,
    }),
    [language, setLanguage, t, localizeDistrict, formatDate, formatNumber, currentLanguageMeta]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useTranslation = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return a fallback implementation if used outside provider (safety guarantee)
    return {
      language: globalCurrentLanguage,
      setLanguage: () => {},
      t: tStandalone,
      localizeDistrict: (districtInput: any) => getLocalizedDistrictName(districtInput, globalCurrentLanguage),
      formatDate: (dateInput: any, options?: any) => formatLocalizedDate(dateInput, globalCurrentLanguage, options),
      formatNumber: (num: any) => formatLocalizedNumber(num, globalCurrentLanguage),
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageMeta: SUPPORTED_LANGUAGES[0],
    };
  }
  return context;
};

