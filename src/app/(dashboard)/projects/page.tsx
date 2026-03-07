"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, User, DollarSign, Search, Leaf, FolderKanban } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

type Milestone = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type ProjectDonorLink = {
  donorId: string;
  status: string;
  donor: { id: string; name: string; type: string };
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  donorId: string | null;
  donor: { id: string; name: string; type: string } | null;
  projectDonors?: ProjectDonorLink[];
  totalBudget: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  manager: {
    id: string;
    firstName: string;
    lastName: string;
  };
  milestones: Milestone[];
};

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  planning: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "site.planning" },
  active: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "site.active" },
  on_hold: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "site.on_hold" },
  completed: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "site.completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "site.cancelled" },
};

export default function ProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function formatDate(date: string | null) {
    if (!date) return t("site.not_set");
    return new Date(date).toLocaleDateString();
  }

  function getMilestoneProgress(milestones: Milestone[]) {
    if (milestones.length === 0) return 0;
    const completed = milestones.filter((m) => m.status === "completed").length;
    return Math.round((completed / milestones.length) * 100);
  }

  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const managerName = `${project.manager.firstName} ${project.manager.lastName}`.toLowerCase();
    const donorNames = project.projectDonors?.map((pd) => pd.donor.name.toLowerCase()).join(" ") ?? "";
    const primaryDonor = project.donor?.name.toLowerCase() ?? "";
    return (
      project.name.toLowerCase().includes(q) ||
      (project.description?.toLowerCase().includes(q) ?? false) ||
      project.status.toLowerCase().includes(q) ||
      managerName.includes(q) ||
      donorNames.includes(q) ||
      primaryDonor.includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_projects")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              {t("sidebar.projects")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("site.manage_your_projects_and_track_progress")}
            </p>
          </div>
          <Button onClick={() => router.push("/projects/new")} className="rounded-xl shrink-0">
            <Plus className="h-4 w-4 mr-2" /> {t("site.new_project")}
          </Button>
        </div>
      </header>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("site.search_projects")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-2xl border-border bg-card pl-10 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-sage-pale px-3 py-1 font-medium text-primary">
            {filteredProjects.length}
          </span>
          <span>
            {t(
              filteredProjects.length === 1
                ? "site.project_in_view_one"
                : "site.project_in_view_other",
              { count: filteredProjects.length }
            )}
          </span>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-20 text-center">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 text-primary/25" />
          <p className="text-sm text-muted-foreground mb-5">
            {searchQuery.trim() ? t("site.no_projects_match_your_search") : t("site.no_projects_yet_start_by_creating_one")}
          </p>
          {searchQuery.trim() ? (
            <Button variant="outline" onClick={() => setSearchQuery("")} className="rounded-xl">
              {t("site.clear_search")}
            </Button>
          ) : (
            <Button onClick={() => router.push("/projects/new")} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> {t("site.create_your_first_project")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.planning;
            const progress = getMilestoneProgress(project.milestones);
            const donorList =
              project.projectDonors && project.projectDonors.length > 0
                ? project.projectDonors.map((pd) => pd.donor.name).join(", ")
                : project.donor?.name || t("site.no_donor_linked");
            const budgetLabel = project.totalBudget > 0 ? formatCurrency(project.totalBudget, "ETB") : t("site.budget_not_set");
            const milestoneLabel =
              project.milestones.length > 0
                ? t("site.completed_count_total", {
                    completed: project.milestones.filter((m) => m.status === "completed").length,
                    total: project.milestones.length,
                  })
                : t("site.no_milestones_yet");

            return (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="group flex min-h-[320px] flex-col rounded-[28px] border border-border/60 bg-card p-6 text-left shadow-[0_12px_30px_rgba(34,48,24,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_38px_rgba(34,48,24,0.09)]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="font-serif text-[clamp(1.2rem,1rem+0.7vw,1.7rem)] leading-tight text-foreground transition-colors group-hover:text-primary">
                      {project.name}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                      {t("site.managed_by_name", {
                        firstName: project.manager.firstName,
                        lastName: project.manager.lastName,
                      })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${status.bg} ${status.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {t(status.label)}
                  </span>
                </div>

                <p className="mb-5 min-h-[3rem] text-sm leading-relaxed text-muted-foreground">
                  {project.description || t("site.no_project_summary_added_yet_open_the_project_to_define_its_scope_and_delivery_notes")}
                </p>

                <div className="mb-5 grid gap-3 rounded-2xl bg-muted/35 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {project.manager.firstName} {project.manager.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{donorList}</span>
                  </div>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{budgetLabel}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(project.startDate)}
                    </span>
                  </div>

                  <div>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">{milestoneLabel}</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sage-pale">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span>{t("site.open_project_workspace")}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
