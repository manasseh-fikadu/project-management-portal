"use client";

import { useTranslation } from "react-i18next";
import { appLanguages } from "@/lib/i18n";
import { type AppLanguage } from "@/lib/i18n/resources";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  const currentLanguage = (appLanguages.includes(i18n.language as AppLanguage)
    ? i18n.language
    : "en") as AppLanguage;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("common.language")}</span>
      <Select value={currentLanguage} onValueChange={(value) => i18n.changeLanguage(value)}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t("common.english")}</SelectItem>
          <SelectItem value="am">{t("common.amharic")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
