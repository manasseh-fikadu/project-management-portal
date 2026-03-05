"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  ChevronDown,
  LogOut,
  CheckSquare,
  HandCoins,
  Circle,
  ShieldCheck,
  UserCog,
  FileBarChart,
  Leaf,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

type NavItem = {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { titleKey: "sidebar.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { titleKey: "sidebar.projects", href: "/projects", icon: FolderKanban },
  { titleKey: "sidebar.tasks", href: "/tasks", icon: CheckSquare },
  { titleKey: "sidebar.donors", href: "/donors", icon: Users },
  { titleKey: "sidebar.proposals", href: "/proposals", icon: FileText },
  { titleKey: "sidebar.financials", href: "/financials", icon: HandCoins },
  { titleKey: "sidebar.reports", href: "/reports", icon: FileBarChart },
  { titleKey: "sidebar.profile", href: "/profile", icon: UserCog },
  { titleKey: "sidebar.users", href: "/users", icon: ShieldCheck, adminOnly: true },
];

type RecentProject = {
  id: string;
  name: string;
  status: string;
};

const projectStatusDot: Record<string, string> = {
  planning: "text-amber-warm",
  active: "text-primary",
  on_hold: "text-rose-muted",
  completed: "text-lavender",
  cancelled: "text-destructive",
};

interface SidebarProps {
  onLogout: () => void;
  userEmail?: string;
  userName?: string;
  userRole?: string;
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({ onLogout, userEmail, userName, userRole }: SidebarProps) {
  const { t } = useTranslation();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const pathname = usePathname();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [projectsExpanded, setProjectsExpanded] = useState(() =>
    pathname.startsWith("/projects")
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (!cancelled && data.projects) {
          setRecentProjects(
            data.projects.slice(0, 10).map((p: RecentProject) => ({
              id: p.id,
              name: p.name,
              status: p.status,
            }))
          );
        }
      } catch {
        // silently fail — sidebar is non-critical
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pathname]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-350",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-sage-pale flex items-center justify-center shrink-0">
              <Image
                src="/motri.png"
                alt="MoTRI Logo"
                width={20}
                height={20}
                className="rounded-full"
              />
            </div>
            {!isCollapsed && (
              <span className="font-serif text-lg text-sidebar-foreground">
                MoTRI
              </span>
            )}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-full text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-0.5 py-4 px-3">
          {navItems.filter((item) => !item.adminOnly || userRole === "admin").map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const isProjectsItem = item.href === "/projects";

            if (isProjectsItem && !isCollapsed) {
              return (
                <div key={item.href}>
                  <div className="flex items-center">
                    <Link
                      href={item.href}
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-[20px] px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1">{t("sidebar.projects")}</span>
                    </Link>
                    {recentProjects.length > 0 && (
                      <button
                        onClick={() => setProjectsExpanded(!projectsExpanded)}
                        className="p-1.5 rounded-full text-muted-foreground hover:bg-sidebar-accent transition-colors"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            projectsExpanded && "rotate-180"
                          )}
                        />
                      </button>
                    )}
                  </div>
                  {projectsExpanded && recentProjects.length > 0 && (
                    <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                      {recentProjects.map((project) => {
                        const isProjectActive = pathname === `/projects/${project.id}`;
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-all duration-200",
                              isProjectActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                            )}
                            title={project.name}
                          >
                            <Circle
                              className={cn(
                                "h-2 w-2 shrink-0 fill-current",
                                projectStatusDot[project.status] || "text-muted-foreground"
                              )}
                            />
                            <span className="truncate">{project.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-[20px] px-3.5 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!isCollapsed && <span>{t(item.titleKey)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-4">
          {!isCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {userRole ? t(`roles.${userRole}`, { defaultValue: userRole }) : userRole}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <div className="mb-3">
              <LanguageSwitcher />
            </div>
          )}
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "default"}
            onClick={onLogout}
            className={cn(
              "w-full justify-start rounded-[20px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isCollapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">{t("sidebar.signOut")}</span>}
          </Button>
          {!isCollapsed && (
            <div className="mt-4 flex items-center gap-2 px-1">
              <Leaf className="h-3.5 w-3.5 text-primary/40" />
              <span className="text-[11px] text-muted-foreground/60">
                Grow with purpose
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      className={cn(
        "min-h-screen bg-background transition-all duration-350",
        isCollapsed ? "ml-[72px]" : "ml-64"
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
    >
      {children}
    </main>
  );
}
