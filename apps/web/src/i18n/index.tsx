'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import translations, { Locale, TranslationKey, LOCALE_LABELS, LOCALE_FLAGS } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'ht',
  setLocale: () => {},
  t: (key) => translations[key]?.ht || key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ht');

  useEffect(() => {
    const saved = localStorage.getItem('anbyans-lang') as Locale | null;
    if (saved && ['ht', 'en', 'fr'].includes(saved)) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('anbyans-lang', l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[key]?.[locale] || translations[key]?.ht || key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}

export { LOCALE_LABELS, LOCALE_FLAGS };
export type { Locale };
