import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { messages } from './messages';
import type { Locale, TranslationParams } from './types';

const STORAGE_LOCALE_KEY = 'rfid.locale';
const FALLBACK_LOCALE: Locale = 'fr';

interface I18nContextValue {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function formatMessage(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, rawKey: string) => {
    const value = params[rawKey];
    return value === undefined ? `{${rawKey}}` : String(value);
  });
}

function resolveInitialLocale(): Locale {
  const storedLocale = window.localStorage.getItem(STORAGE_LOCALE_KEY);
  if (storedLocale === 'fr' || storedLocale === 'en') {
    return storedLocale;
  }

  const browserLocale = window.navigator.language?.toLowerCase() ?? '';
  return browserLocale.startsWith('en') ? 'en' : FALLBACK_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(FALLBACK_LOCALE);

  useEffect(() => {
    const initialLocale = resolveInitialLocale();
    setLocaleState(initialLocale);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_LOCALE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((currentLocale) => (currentLocale === 'fr' ? 'en' : 'fr'));
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      const localeMessages = messages[locale];
      const fallbackMessages = messages[FALLBACK_LOCALE];
      const template = localeMessages[key] ?? fallbackMessages[key] ?? key;
      return formatMessage(template, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
    }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider.');
  }

  return context;
}
