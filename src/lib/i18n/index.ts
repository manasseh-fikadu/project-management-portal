"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources, type AppLanguage } from "@/lib/i18n/resources";

declare global {
  var __appI18nLanguageListenerBound__: boolean | undefined;
}

const DEFAULT_LANGUAGE: AppLanguage = "en";
const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ["en", "am"] as const;
const STORAGE_KEY = "app.language";

function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return !!value && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

function getInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isSupportedLanguage(stored)) {
    return stored;
  }

  const browserLanguage = window.navigator.language?.toLowerCase();
  if (browserLanguage?.startsWith("am")) {
    return "am";
  }

  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });
}

if (typeof window !== "undefined") {
  if (!globalThis.__appI18nLanguageListenerBound__) {
    i18n.on("languageChanged", (lng) => {
      if (isSupportedLanguage(lng)) {
        window.localStorage.setItem(STORAGE_KEY, lng);
        document.documentElement.lang = lng;
      }
    });
    globalThis.__appI18nLanguageListenerBound__ = true;
  }
}

export const appLanguages: AppLanguage[] = ["en", "am"];
export { i18n, STORAGE_KEY as languageStorageKey };
