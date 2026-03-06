"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<VerifyOtpFallback />}>
      <VerifyOtpPageContent />
    </Suspense>
  );
}

function VerifyOtpPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!userId) {
      router.replace("/login");
    }
  }, [router, userId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const code = useMemo(() => digits.join(""), [digits]);

  function updateDigit(index: number, value: string) {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = sanitized;
    setDigits(next);

    if (sanitized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? "");
    setDigits(next);

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!userId) {
      setError(t("auth.genericError"));
      return;
    }

    if (code.length !== OTP_LENGTH) {
      setError(t("auth.invalidOtp"));
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.code === "expired_code") {
          setError(t("auth.otpExpired"));
        } else {
          setError(data.error || t("auth.invalidOtp"));
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (!userId || cooldown > 0) return;

    setResending(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (typeof data.retryAfter === "number") {
          setCooldown(data.retryAfter);
          setError(`${t("auth.resendIn")} ${data.retryAfter}s`);
          return;
        }

        setError(data.error || t("auth.genericError"));
        return;
      }

      setInfo(t("auth.otpResent"));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      inputRefs.current[0]?.focus();
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-serif text-[26px] text-foreground tracking-tight leading-tight">
          {t("auth.otpTitle")}
        </h2>
        <p className="mt-2.5 text-[15px] text-muted-foreground leading-relaxed">
          {t("auth.otpDescription")}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        {error && (
          <div className="bg-rose-pale text-destructive px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-sage-pale text-secondary-foreground px-4 py-3 rounded-xl text-sm">
            {info}
          </div>
        )}

        <div className="flex items-center justify-center gap-2.5">
          {digits.map((digit, index) => (
            <Input
              key={`otp-${index}`}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="h-12 w-12 text-center text-lg rounded-xl"
              maxLength={1}
              disabled={verifying || resending}
              aria-label={`${t("auth.otpPlaceholder")} ${index + 1}`}
            />
          ))}
        </div>

        <Button
          type="submit"
          className="w-full h-11 rounded-xl text-[14px] font-medium"
          disabled={verifying || resending}
        >
          {verifying ? t("auth.verifying") : t("auth.verifyCode")}
        </Button>
      </form>

      <div className="mt-6 text-center space-y-3">
        <div className="text-sm text-muted-foreground">
          <button
            type="button"
            onClick={handleResend}
            className="text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline"
            disabled={cooldown > 0 || resending || verifying}
          >
            {resending ? t("auth.resendingCode") : t("auth.resendCode")}
          </button>
          {cooldown > 0 && (
            <p className="mt-1 text-xs">{`${t("auth.resendIn")} ${cooldown}s`}</p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function VerifyOtpFallback() {
  return (
    <div>
      <div className="mb-8">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="mt-3 h-5 w-64 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="flex items-center justify-center gap-2.5">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <div key={i} className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="mt-6 h-11 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}
