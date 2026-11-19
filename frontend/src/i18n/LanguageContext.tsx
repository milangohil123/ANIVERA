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

const dictionaries: Record<SupportedLanguage, any> = {
  gu,
  en,
  hi,
};

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
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

// Global reference for standalone calls
let globalCurrentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

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

  if (!text) return key;

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
      setLanguageState(lang);
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

      if (!text) return key;

      if (params) {
        return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
          return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }, text);
      }

      return text;
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
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageMeta,
    }),
    [language, setLanguage, t, currentLanguageMeta]
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
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageMeta: SUPPORTED_LANGUAGES[0],
    };
  }
  return context;
};

