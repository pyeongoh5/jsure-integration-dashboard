import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ADMIN_LANGUAGES,
  translate,
  type AdminLanguage,
  type AdminTranslationKey,
} from "@i18n/admin";

const STORAGE_KEY = "admin-language";

export function getStoredLanguage(): AdminLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && (ADMIN_LANGUAGES as readonly string[]).includes(stored)) {
    return stored as AdminLanguage;
  }
  return "ko";
}

type LanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AdminLanguage>(getStoredLanguage);

  const setLanguage = useCallback((next: AdminLanguage) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function useT() {
  const { language } = useLanguage();
  return useCallback(
    (key: AdminTranslationKey, params?: Record<string, string | number>) =>
      translate(key, language, params),
    [language],
  );
}
