"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, SidebarProvider, MainContent } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { useTranslation } from "react-i18next";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  mustChangePassword: boolean;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCurrentUser = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();

    if (data.user) {
      setUser(data.user);
      return;
    }

    setUser(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    refreshCurrentUser()
      .finally(() => setLoading(false));
  }, [refreshCurrentUser]);

  useEffect(() => {
    function handleSessionUserUpdated() {
      void refreshCurrentUser();
    }

    window.addEventListener("session-user-updated", handleSessionUserUpdated);
    return () => {
      window.removeEventListener("session-user-updated", handleSessionUserUpdated);
    };
  }, [refreshCurrentUser]);

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== "/profile") {
      router.replace("/profile");
    }
  }, [pathname, router, user?.mustChangePassword]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("site.loading_dashboard")}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (user.mustChangePassword && pathname !== "/profile") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t("site.loading_dashboard")}</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar
        onLogout={handleLogout}
        userEmail={user.email}
        userName={`${user.firstName} ${user.lastName}`}
        userRole={user.role}
      />
      <MainContent>
        <div className="flex justify-end px-6 pt-4">
          <NotificationBell />
        </div>
        {user.mustChangePassword && (
          <div className="mx-6 mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm">
              {t("profile.passwordSetByAdminDisclaimer")}{" "}
              <Link href="/profile" className="font-medium underline">
                {t("profile.changePasswordNow")}
              </Link>
            </p>
          </div>
        )}
        {children}
      </MainContent>
    </SidebarProvider>
  );
}
