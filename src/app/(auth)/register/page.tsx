"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

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
        body: JSON.stringify({ email, password, firstName, lastName, role: "beneficiary", department }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.registrationFailed"));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md space-y-3">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.createAccount")}</CardTitle>
          <CardDescription>{t("auth.registerDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("auth.firstName")}</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("auth.lastName")}</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">{t("auth.department")}</Label>
              <Input
                id="department"
                name="department"
                type="text"
                placeholder={t("auth.departmentPlaceholder")}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                disabled={loading}
              />
              <p className="text-xs text-gray-500">{t("auth.minimumPassword")}</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
            </Button>
            <p className="text-sm text-gray-600">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
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
