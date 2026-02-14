"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, DollarSign } from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  donorId: string | null;
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

const statusColors: Record<string, string> = {
  planning: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  function formatBudget(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }

  function getMilestoneProgress(milestones: Milestone[]) {
    if (milestones.length === 0) return 0;
    const completed = milestones.filter((m) => m.status === "completed").length;
    return Math.round((completed / milestones.length) * 100);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              ← Dashboard
            </Button>
            <h1 className="text-xl font-semibold">Projects</h1>
          </div>
          <Button onClick={() => router.push("/projects/new")}>
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">No projects found</p>
              <Button onClick={() => router.push("/projects/new")}>
                <Plus className="h-4 w-4 mr-2" /> Create your first project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge className={statusColors[project.status]}>{project.status.replace("_", " ")}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>
                      {project.manager.firstName} {project.manager.lastName}
                    </span>
                  </div>

                  {project.donorId && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Donor ID:</span> {project.donorId}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    {project.totalBudget > 0 && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <DollarSign className="h-4 w-4" />
                        <span>{formatBudget(project.totalBudget)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(project.startDate)}</span>
                    </div>
                  </div>

                  {project.milestones.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Milestones</span>
                        <span>{getMilestoneProgress(project.milestones)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${getMilestoneProgress(project.milestones)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
