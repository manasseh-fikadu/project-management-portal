"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(t("profile.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("profile.passwordUpdateFailed"));
        return;
      }

      setSuccess(t("profile.passwordUpdated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.dispatchEvent(new Event("session-user-updated"));
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.description")}</p>
      </header>

      <div className="bg-card rounded-2xl p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-sage-pale">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-xl text-foreground">{t("profile.changePassword")}</h2>
            <p className="text-sm text-muted-foreground">{t("profile.changePasswordDescription")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl bg-rose-pale px-4 py-3">
              <p className="text-sm text-rose-muted">{error}</p>
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-sage-pale px-4 py-3">
              <p className="text-sm text-primary">{success}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t("profile.currentPassword")}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              disabled={loading}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={loading}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("profile.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={loading}
              className="rounded-xl"
            />
          </div>

          <Button type="submit" disabled={loading} className="rounded-xl">
            {loading ? t("profile.updatingPassword") : t("profile.updatePassword")}
          </Button>
        </form>
      </div>
    </div>
  );
}
