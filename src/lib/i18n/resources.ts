import en from "@/lib/i18n/locales/en.json";
import am from "@/lib/i18n/locales/am.json";

export const resources = {
  en: {
    translation: en,
  },
  am: {
    translation: am,
  },
} as const;

export type AppLanguage = keyof typeof resources;
