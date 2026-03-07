"use client";

import Image from "next/image";
import { Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

function BrandedPanel() {
  const { t } = useTranslation();

  return (
    <div
      className="relative hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #1E271E 0%, #2A3328 30%, #3D5335 65%, #5C7A50 100%)",
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 600 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="-30" cy="60" r="220" fill="rgba(143,184,131,0.06)" />
        <circle cx="560" cy="180" r="180" fill="rgba(143,184,131,0.04)" />
        <circle cx="280" cy="480" r="300" fill="rgba(143,184,131,0.03)" />
        <circle cx="80" cy="820" r="220" fill="rgba(143,184,131,0.05)" />
        <circle cx="520" cy="720" r="130" fill="rgba(139,126,184,0.03)" />

        <ellipse
          cx="460"
          cy="110"
          rx="38"
          ry="14"
          transform="rotate(-35 460 110)"
          fill="rgba(143,184,131,0.08)"
        />
        <ellipse
          cx="100"
          cy="380"
          rx="50"
          ry="18"
          transform="rotate(25 100 380)"
          fill="rgba(143,184,131,0.06)"
        />
        <ellipse
          cx="400"
          cy="660"
          rx="34"
          ry="13"
          transform="rotate(-20 400 660)"
          fill="rgba(143,184,131,0.07)"
        />
        <ellipse
          cx="200"
          cy="720"
          rx="42"
          ry="16"
          transform="rotate(15 200 720)"
          fill="rgba(143,184,131,0.05)"
        />

        <circle cx="180" cy="140" r="2.5" fill="rgba(143,184,131,0.14)" />
        <circle cx="420" cy="320" r="2" fill="rgba(143,184,131,0.12)" />
        <circle cx="130" cy="580" r="3" fill="rgba(143,184,131,0.10)" />
        <circle cx="490" cy="480" r="2" fill="rgba(143,184,131,0.13)" />
        <circle cx="320" cy="230" r="2.5" fill="rgba(143,184,131,0.11)" />
        <circle cx="380" cy="820" r="2" fill="rgba(143,184,131,0.09)" />
        <circle cx="250" cy="350" r="1.5" fill="rgba(143,184,131,0.12)" />
      </svg>

      <div className="relative z-10 flex flex-col items-center text-center px-10">
        <div className="w-[88px] h-[88px] rounded-full bg-white/8 backdrop-blur-sm flex items-center justify-center mb-10 ring-1 ring-white/12 shadow-lg shadow-black/20">
          <Image
            src="/motri.png"
            alt={t("site.motri_logo")}
            width={52}
            height={52}
            className="rounded-full"
            priority
          />
        </div>

        <h1 className="font-serif text-[32px] text-white/90 leading-tight">
          MoTRI
        </h1>

        <div className="mt-5 w-10 h-px bg-white/15" />

        <p className="mt-5 text-white/45 text-[13px] leading-relaxed max-w-[260px] tracking-wide">
          {t("site.ministry_of_trade_and_regional_integration")}
        </p>
        <p className="mt-1.5 text-white/30 text-[12px] tracking-wider uppercase">
          {t("auth.portalTitle")}
        </p>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2">
        <Leaf className="h-3.5 w-3.5 text-white/20" />
        <span className="text-[11px] text-white/20 tracking-[0.08em]">
          {t("site.grow_with_purpose")}
        </span>
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <BrandedPanel />

      <div className="flex-1 flex flex-col min-h-screen bg-background">
        <div className="lg:hidden flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-sage-pale flex items-center justify-center">
              <Image
                src="/motri.png"
                alt={t("site.motri_logo")}
                width={22}
                height={22}
                className="rounded-full"
              />
            </div>
            <span className="font-serif text-lg text-foreground">MoTRI</span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="hidden lg:flex justify-end px-8 pt-6">
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-0">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
