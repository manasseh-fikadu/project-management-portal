"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="w-full">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Image
                src="/motri.png"
                alt="MoTRI Logo"
                width={96}
                height={96}
                className="rounded-full"
                priority
              />
            </div>
            <div>
              <CardTitle className="text-2xl">{t("auth.otpTitle")}</CardTitle>
              <CardDescription className="mt-1">{t("auth.otpDescription")}</CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleVerify}>
            <CardContent className="space-y-4">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
              {info && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">{info}</div>}

              <div className="flex items-center justify-center gap-2">
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
                    className="h-12 w-12 text-center text-lg"
                    maxLength={1}
                    disabled={verifying || resending}
                    aria-label={`${t("auth.otpPlaceholder")} ${index + 1}`}
                  />
                ))}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-4">
              <Button type="submit" className="w-full" disabled={verifying || resending}>
                {verifying ? t("auth.verifying") : t("auth.verifyCode")}
              </Button>

              <div className="text-sm text-gray-600 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
                  disabled={cooldown > 0 || resending || verifying}
                >
                  {resending ? t("auth.resendingCode") : t("auth.resendCode")}
                </button>
                {cooldown > 0 && <p className="mt-1">{`${t("auth.resendIn")} ${cooldown}s`}</p>}
              </div>

              <p className="text-sm text-gray-600">
                <Link href="/login" className="text-primary hover:underline">
                  {t("auth.signIn")}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

function VerifyOtpFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-3">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="w-full">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Image
                src="/motri.png"
                alt="MoTRI Logo"
                width={96}
                height={96}
                className="rounded-full"
                priority
              />
            </div>
            <div>
              <CardTitle className="text-2xl">Loading...</CardTitle>
              <CardDescription className="mt-1">Preparing verification…</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-12 rounded-md bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
