"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Milestone = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type Project = {
  id: string;
  name: string;
  status: string;
  milestones: Milestone[];
};

type FinancialRow = {
  projectId: string;
  projectName: string;
  plannedBudget: number;
  spentAmount: number;
  physicalPerformance: number;
  financialPerformance: number;
  variance: number;
  status: "aligned" | "overspending_risk" | "under_spending";
};

type FinancialTotals = {
  plannedBudget: number;
  spentAmount: number;
  physicalPerformance: number;
  financialPerformance: number;
};

type DelayedMilestone = Milestone & { projectName: string };

const STATUS_COLORS: Record<string, string> = {
  planning: "#f59e0b",
  active: "#16a34a",
  on_hold: "#f97316",
  completed: "#0284c7",
  cancelled: "#dc2626",
};

const PIE_COLORS = ["#16a34a", "#f59e0b", "#f97316", "#0284c7", "#dc2626"];

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [comparison, setComparison] = useState<FinancialRow[]>([]);
  const [totals, setTotals] = useState<FinancialTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [projectsRes, financialsRes] = await Promise.all([fetch("/api/projects"), fetch("/api/financials")]);
      const [projectsData, financialsData] = await Promise.all([projectsRes.json(), financialsRes.json()]);
      setProjects(projectsData.projects || []);
      setComparison(financialsData.comparison || []);
      setTotals(financialsData.totals || null);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const intervalId = window.setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [fetchDashboardData]);

  const delayedMilestones = useMemo<DelayedMilestone[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return projects.flatMap((project) =>
      project.milestones
        .filter((milestone) => {
          if (!milestone.dueDate || milestone.status === "completed" || milestone.status === "cancelled") {
            return false;
          }
          return new Date(milestone.dueDate) < today;
        })
        .map((milestone) => ({ ...milestone, projectName: project.name }))
    );
  }, [projects]);

  const overspentProjects = useMemo(() => {
    return comparison.filter((row) => row.plannedBudget > 0 && row.spentAmount > row.plannedBudget);
  }, [comparison]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active").length, [projects]);

  const totalMilestones = useMemo(() => {
    return projects.reduce((sum, project) => sum + project.milestones.length, 0);
  }, [projects]);

  const completedMilestones = useMemo(() => {
    return projects.reduce(
      (sum, project) => sum + project.milestones.filter((milestone) => milestone.status === "completed").length,
      0
    );
  }, [projects]);

  const milestoneCompletionRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const budgetChartData = useMemo(() => {
    return [...comparison]
      .sort((a, b) => b.spentAmount - a.spentAmount)
      .slice(0, 6)
      .map((row) => ({
        name: row.projectName.length > 18 ? `${row.projectName.slice(0, 18)}...` : row.projectName,
        planned: row.plannedBudget,
        spent: row.spentAmount,
      }));
  }, [comparison]);

  const projectStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([status, value]) => ({
      name: status.replace("_", " "),
      value,
      color: STATUS_COLORS[status] ?? "#64748b",
    }));
  }, [projects]);

  const performanceGap = Math.max(0, (totals?.financialPerformance || 0) - (totals?.physicalPerformance || 0));

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(
      amount || 0
    );
  }

  function formatDateTime(value: Date | null) {
    if (!value) return "Not yet synced";
    return value.toLocaleString();
  }

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">General Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Last updated: {formatDateTime(lastUpdated)}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setRefreshing(true);
            fetchDashboardData();
          }}
          disabled={refreshing}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh now"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Projects</CardDescription>
            <CardTitle className="text-2xl">{projects.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{activeProjects} active projects</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Planned Budget</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totals?.plannedBudget || 0)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Spent: {formatCurrency(totals?.spentAmount || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Execution Gap</CardDescription>
            <CardTitle className="text-2xl">{performanceGap}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Financial pace above physical pace
          </CardContent>
        </Card>
        <Card className={delayedMilestones.length > 0 || overspentProjects.length > 0 ? "border-red-300" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Status Alerts</CardDescription>
            <CardTitle className="text-2xl">{delayedMilestones.length + overspentProjects.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {delayedMilestones.length} delayed milestones, {overspentProjects.length} overspent projects
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budget Performance By Project</CardTitle>
            <CardDescription>Top projects by spending, planned vs actual.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {budgetChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenditure data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="planned" fill="#0f766e" radius={[4, 4, 0, 0]} name="Planned" />
                  <Bar dataKey="spent" fill="#b91c1c" radius={[4, 4, 0, 0]} name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Status Distribution</CardTitle>
            <CardDescription>Current status mix across the ministry portfolio.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {projectStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {projectStatusData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milestone Completion</CardTitle>
            <CardDescription>{completedMilestones} of {totalMilestones} milestones completed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex justify-between text-sm">
              <span>Completion Rate</span>
              <span>{milestoneCompletionRate}%</span>
            </div>
            <Progress value={milestoneCompletionRate} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Execution</CardTitle>
            <CardDescription>Physical vs financial performance snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Physical</span>
              <span>{totals?.physicalPerformance || 0}%</span>
            </div>
            <Progress value={totals?.physicalPerformance || 0} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span>Financial</span>
              <span>{totals?.financialPerformance || 0}%</span>
            </div>
            <Progress value={Math.min(totals?.financialPerformance || 0, 100)} className="h-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Status Alerts: Delayed Milestones
            </CardTitle>
            <CardDescription>Visual cues for milestones that are overdue and not completed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {delayedMilestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delayed milestones.</p>
            ) : (
              delayedMilestones.slice(0, 8).map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">{milestone.projectName}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-700">Delayed</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Status Alerts: Overspent Budgets
            </CardTitle>
            <CardDescription>Projects where expenditure has exceeded planned budget.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overspentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overspent projects.</p>
            ) : (
              overspentProjects.slice(0, 8).map((row) => (
                <div
                  key={row.projectId}
                  className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{row.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      Planned {formatCurrency(row.plannedBudget)} | Spent {formatCurrency(row.spentAmount)}
                    </p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Overspent</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
