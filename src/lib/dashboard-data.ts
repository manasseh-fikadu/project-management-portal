import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency";

export type Milestone = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  milestones: Milestone[];
};

export type FinancialRow = {
  projectId: string;
  projectName: string;
  plannedBudget: number;
  spentAmount: number;
  physicalPerformance: number;
  financialPerformance: number;
  variance: number;
  status: "aligned" | "overspending_risk" | "under_spending";
};

export type FinancialTotals = {
  plannedBudget: number;
  spentAmount: number;
  physicalPerformance: number;
  financialPerformance: number;
};

export type DelayedMilestone = Milestone & { projectName: string };

export function formatCurrency(amount: number) {
  return formatCurrencyUtil(amount, "ETB");
}

export function useDashboardData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [comparison, setComparison] = useState<FinancialRow[]>([]);
  const [totals, setTotals] = useState<FinancialTotals | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, fRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/financials"),
      ]);
      const [pData, fData] = await Promise.all([pRes.json(), fRes.json()]);
      setProjects(pData.projects || []);
      setComparison(fData.comparison || []);
      setTotals(fData.totals || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const delayedMilestones = useMemo<DelayedMilestone[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return projects.flatMap((project) =>
      project.milestones
        .filter((m) => {
          if (!m.dueDate || m.status === "completed" || m.status === "cancelled") return false;
          return new Date(m.dueDate) < today;
        })
        .map((m) => ({ ...m, projectName: project.name }))
    );
  }, [projects]);

  const overspentProjects = useMemo(
    () => comparison.filter((r) => r.plannedBudget > 0 && r.spentAmount > r.plannedBudget),
    [comparison]
  );

  const activeCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects]
  );

  const totalMilestones = useMemo(
    () => projects.reduce((s, p) => s + p.milestones.length, 0),
    [projects]
  );

  const completedMilestones = useMemo(
    () =>
      projects.reduce(
        (s, p) => s + p.milestones.filter((m) => m.status === "completed").length,
        0
      ),
    [projects]
  );

  const milestoneCompletionRate =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const budgetChartData = useMemo(
    () =>
      [...comparison]
        .sort((a, b) => b.spentAmount - a.spentAmount)
        .slice(0, 6)
        .map((r) => ({
          name: r.projectName.length > 18 ? `${r.projectName.slice(0, 18)}…` : r.projectName,
          planned: r.plannedBudget,
          spent: r.spentAmount,
        })),
    [comparison]
  );

  const projectStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, value]) => ({
      name: status.replace("_", " "),
      value,
    }));
  }, [projects]);

  const performanceGap = Math.max(
    0,
    (totals?.financialPerformance || 0) - (totals?.physicalPerformance || 0)
  );

  return {
    projects,
    comparison,
    totals,
    loading,
    delayedMilestones,
    overspentProjects,
    activeCount,
    totalMilestones,
    completedMilestones,
    milestoneCompletionRate,
    budgetChartData,
    projectStatusData,
    performanceGap,
  };
}
