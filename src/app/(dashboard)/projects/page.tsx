"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  planning: { bg: "bg-amber-pale", text: "text-amber-warm", dot: "bg-amber-warm", label: "Planning" },
  active: { bg: "bg-sage-pale", text: "text-primary", dot: "bg-primary", label: "Active" },
  on_hold: { bg: "bg-rose-pale", text: "text-rose-muted", dot: "bg-rose-muted", label: "On Hold" },
  completed: { bg: "bg-lavender-pale", text: "text-lavender", dot: "bg-lavender", label: "Completed" },
  cancelled: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "Cancelled" },
};

export default function ProjectsPage() {
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
    if (!date) return "Not set";
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
          <p className="text-sm text-muted-foreground">Loading projects…</p>
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
              Projects
            </h1>
            <p className="text-sm text-muted-foreground">
              Track progress and manage your active initiatives
            </p>
          </div>
          <Button onClick={() => router.push("/projects/new")} className="rounded-xl shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </header>

      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, manager, donor…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl bg-card border-border"
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-20 text-center">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 text-primary/25" />
          <p className="text-sm text-muted-foreground mb-5">
            {searchQuery.trim() ? "No projects match your search" : "No projects yet — start by creating one"}
          </p>
          {searchQuery.trim() ? (
            <Button variant="outline" onClick={() => setSearchQuery("")} className="rounded-xl">
              Clear search
            </Button>
          ) : (
            <Button onClick={() => router.push("/projects/new")} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project, i) => {
            const status = statusConfig[project.status] || statusConfig.planning;
            const progress = getMilestoneProgress(project.milestones);

            return (
              <button
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="text-left bg-card rounded-2xl p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors leading-snug">
                    {project.name}
                  </h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${status.bg} ${status.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {project.manager.firstName} {project.manager.lastName}
                    </span>
                  </div>

                  {project.projectDonors && project.projectDonors.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {project.projectDonors.map((pd) => pd.donor.name).join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  {project.totalBudget > 0 && (
                    <span>{formatCurrency(project.totalBudget, "ETB")}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(project.startDate)}
                  </span>
                </div>

                {project.milestones.length > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Milestones</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-sage-pale overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
