"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  CheckSquare,
  HandCoins,
  Circle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  title: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Donors",
    href: "/donors",
    icon: Users,
  },
  {
    title: "Proposals",
    href: "/proposals",
    icon: FileText,
  },
  {
    title: "Financials",
    href: "/financials",
    icon: HandCoins,
  },
  {
    title: "Users",
    href: "/users",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

type RecentProject = {
  id: string;
  name: string;
  status: string;
};

const projectStatusDot: Record<string, string> = {
  planning: "text-yellow-500",
  active: "text-green-500",
  on_hold: "text-orange-500",
  completed: "text-blue-500",
  cancelled: "text-red-500",
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
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/motri.png"
              alt="MoTRI Logo"
              width={32}
              height={32}
              className="rounded-full shrink-0"
            />
            {!isCollapsed && (
              <span className="font-semibold text-sidebar-foreground">
                MoTRI
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto h-8 w-8"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 p-2">
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
                        "flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">Projects</span>
                    </Link>
                    {recentProjects.length > 0 && (
                      <button
                        onClick={() => setProjectsExpanded(!projectsExpanded)}
                        className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                      {recentProjects.map((project) => {
                        const isProjectActive = pathname === `/projects/${project.id}`;
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                              isProjectActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                            title={project.name}
                          >
                            <Circle
                              className={cn(
                                "h-2 w-2 shrink-0 fill-current",
                                projectStatusDot[project.status] || "text-gray-400"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          {!isCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {userRole}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size={isCollapsed ? "icon" : "default"}
            onClick={onLogout}
            className={cn(
              "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isCollapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Sign Out</span>}
          </Button>
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
        "min-h-screen bg-background transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}
    >
      {children}
    </main>
  );
}
