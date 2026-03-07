"use client";

import { useMemo } from "react";
import { Leaf, Flower2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDashboardData, formatCurrency } from "@/lib/dashboard-data";

const PIE_COLORS = ["#7A9B6D", "#C4A63A", "#C4908F", "#8B7EB8", "#B85C5C"];

export default function DashboardPage() {
  const d = useDashboardData();
  const { t } = useTranslation();

  const statusColors = useMemo(() => {
    const map: Record<string, string> = {
      planning: "#C4A63A", active: "#7A9B6D", on_hold: "#C4908F",
      completed: "#8B7EB8", cancelled: "#B85C5C",
    };
    return d.projectStatusData.map((entry, i) => ({
      ...entry,
      localizedName: t(`site.${entry.name.replace(/\s+/g, "_")}`, { defaultValue: entry.name }),
      color: map[entry.name.replace(/\s+/g, "_")] || PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [d.projectStatusData, t]);

  if (d.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.growing_your_dashboard")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-10">
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
          {t("site.dashboard_overview_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("site.dashboard_overview_description")}
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label={t("sidebar.projects")}
          value={String(d.projects.length)}
          sub={t("site.actively_growing_count", { count: d.activeCount })}
          variant="sage"
        />
        <StatCard
          label={t("site.budget")}
          value={formatCurrency(d.totals?.plannedBudget || 0)}
          sub={t("site.utilized_amount", { amount: formatCurrency(d.totals?.spentAmount || 0) })}
          variant="lavender"
        />
        <StatCard
          label={t("site.execution_gap")}
          value={`${d.performanceGap}%`}
          sub={t("site.between_financial_and_physical_pace")}
          variant="cream"
        />
        <StatCard
          label={t("site.attention_needed")}
          value={String(d.delayedMilestones.length + d.overspentProjects.length)}
          sub={t("site.delayed_overspent_summary", {
            delayed: d.delayedMilestones.length,
            overspent: d.overspentProjects.length,
          })}
          variant="rose"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-10">
        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-1">{t("site.budget_performance")}</h2>
          <p className="text-xs text-muted-foreground mb-5">{t("site.planned_vs_actual_spend_top_projects")}</p>
          <div className="h-72">
            {d.budgetChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground/60">{t("site.no_data_to_display_yet")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.budgetChartData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Bar dataKey="planned" fill="var(--primary)" radius={[8, 8, 0, 0]} name={t("site.planned")} />
                  <Bar dataKey="spent" fill="var(--lavender)" radius={[8, 8, 0, 0]} name={t("site.spent")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-1">{t("site.project_status")}</h2>
          <p className="text-xs text-muted-foreground mb-5">{t("site.how_your_portfolio_is_distributed")}</p>
          <div className="h-72">
            {statusColors.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground/60">{t("site.no_projects_yet")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusColors}
                    dataKey="value"
                    nameKey="localizedName"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={55}
                    strokeWidth={0}
                    label={({ name, percent }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusColors.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-10">
        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-5">{t("site.milestones")}</h2>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-serif text-4xl text-primary">
              {d.milestoneCompletionRate}%
            </span>
            <span className="text-sm text-muted-foreground">
              {t("site.completed_milestones_summary", {
                completed: d.completedMilestones,
                total: d.totalMilestones,
              })}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-sage-pale overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${d.milestoneCompletionRate}%`, transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
            />
          </div>
        </div>

        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-5">{t("site.execution_balance")}</h2>
          <ProgressRow
            label={t("site.physical_progress")}
            value={d.totals?.physicalPerformance || 0}
            colorClass="bg-primary"
            bgClass="bg-sage-pale"
          />
          <ProgressRow
            label={t("site.financial_progress")}
            value={Math.min(d.totals?.financialPerformance || 0, 100)}
            colorClass="bg-lavender"
            bgClass="bg-lavender-pale"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-4">{t("site.delayed_milestones")}</h2>
          {d.delayedMilestones.length === 0 ? (
            <div className="py-6 text-center">
              <Leaf className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p className="text-sm text-muted-foreground/60">{t("site.everythings_blooming_on_time")}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {d.delayedMilestones.slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-rose-pale rounded-xl">
                  <div className="h-2 w-2 rounded-full shrink-0 bg-rose-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.projectName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-4">{t("site.overspent_budgets")}</h2>
          {d.overspentProjects.length === 0 ? (
            <div className="py-6 text-center">
              <Flower2 className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p className="text-sm text-muted-foreground/60">{t("site.all_budgets_are_well_tended")}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {d.overspentProjects.slice(0, 8).map((r) => (
                <div key={r.projectId} className="flex items-center gap-3 p-3 bg-amber-pale rounded-xl">
                  <div className="h-2 w-2 rounded-full shrink-0 bg-amber-warm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.projectName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t("site.planned_spent_summary", {
                        planned: formatCurrency(r.plannedBudget),
                        spent: formatCurrency(r.spentAmount),
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, variant }: {
  label: string;
  value: string;
  sub: string;
  variant: "sage" | "lavender" | "cream" | "rose";
}) {
  const bgMap = {
    sage: "bg-sage-pale",
    lavender: "bg-lavender-pale",
    cream: "bg-muted",
    rose: "bg-rose-pale",
  };
  const accentMap = {
    sage: "text-primary",
    lavender: "text-lavender",
    cream: "text-amber-warm",
    rose: "text-rose-muted",
  };

  return (
    <div className={`p-5 rounded-2xl ${bgMap[variant]}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${accentMap[variant]}`}>
        {label}
      </p>
      <p className="font-serif text-2xl lg:text-3xl text-foreground mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function ProgressRow({ label, value, colorClass, bgClass }: {
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}) {
  const displayValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${colorClass.replace("bg-", "text-")}`}>{displayValue}%</span>
      </div>
      <div className={`h-2.5 rounded-full ${bgClass} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-700`}
          style={{ width: `${displayValue}%`, transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
        />
      </div>
    </div>
  );
}
