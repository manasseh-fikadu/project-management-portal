"use client";

import { useTranslation } from "react-i18next";
import { appLanguages } from "@/lib/i18n";
import { type AppLanguage } from "@/lib/i18n/resources";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "sidebar" }) {
  const { t, i18n } = useTranslation();

  const currentLanguage = (appLanguages.includes(i18n.language as AppLanguage)
    ? i18n.language
    : "en") as AppLanguage;

  const isSidebar = variant === "sidebar";

  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-xs", isSidebar ? "text-sidebar-foreground/55" : "text-muted-foreground")}>
        {t("common.language")}
      </span>
      <Select value={currentLanguage} onValueChange={(value) => i18n.changeLanguage(value)}>
        <SelectTrigger
          className={cn(
            "h-8 w-[140px]",
            isSidebar && "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/80 [&_svg]:text-sidebar-foreground/40"
          )}
        >
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
