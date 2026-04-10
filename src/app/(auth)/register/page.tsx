"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const department = formData.get("department") as string;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName, lastName, department }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.registrationFailed"));
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-serif text-[26px] text-foreground tracking-tight leading-tight">
          {t("auth.createAccount")}
        </h2>
        <p className="mt-2.5 text-[15px] text-muted-foreground leading-relaxed">
          {t("auth.registerDescription")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-rose-pale text-destructive px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-[13px] font-medium text-foreground">
              {t("auth.firstName")}
            </Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              required
              disabled={loading}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-[13px] font-medium text-foreground">
              {t("auth.lastName")}
            </Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              required
              disabled={loading}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium text-foreground">
            {t("auth.email")}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            required
            disabled={loading}
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="department" className="text-[13px] font-medium text-foreground">
            {t("auth.department")}
          </Label>
          <Input
            id="department"
            name="department"
            type="text"
            placeholder={t("auth.departmentPlaceholder")}
            disabled={loading}
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
            {t("auth.password")}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            disabled={loading}
            className="h-11 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">{t("auth.minimumPassword")}</p>
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full h-11 rounded-xl text-[14px] font-medium"
            disabled={loading}
          >
            {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-sm text-muted-foreground text-center">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="text-primary font-medium hover:underline"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
