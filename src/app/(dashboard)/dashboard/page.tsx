"use client";

import { useMemo } from "react";
import { Leaf, Flower2 } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDashboardData, formatCurrency } from "@/lib/dashboard-data";

const PIE_COLORS = ["#7A9B6D", "#C4A63A", "#C4908F", "#8B7EB8", "#B85C5C"];

export default function DashboardPage() {
  const d = useDashboardData();

  const statusColors = useMemo(() => {
    const map: Record<string, string> = {
      planning: "#C4A63A", active: "#7A9B6D", on_hold: "#C4908F",
      completed: "#8B7EB8", cancelled: "#B85C5C",
    };
    return d.projectStatusData.map((entry, i) => ({
      ...entry,
      color: map[entry.name.replace(" ", "_")] || PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [d.projectStatusData]);

  if (d.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Growing your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-10">
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
          Good day, here&apos;s your overview
        </h1>
        <p className="text-sm text-muted-foreground">
          A gentle summary of your portfolio health
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Projects"
          value={String(d.projects.length)}
          sub={`${d.activeCount} actively growing`}
          variant="sage"
        />
        <StatCard
          label="Budget"
          value={formatCurrency(d.totals?.plannedBudget || 0)}
          sub={`${formatCurrency(d.totals?.spentAmount || 0)} utilized`}
          variant="lavender"
        />
        <StatCard
          label="Execution Gap"
          value={`${d.performanceGap}%`}
          sub="Between financial and physical pace"
          variant="cream"
        />
        <StatCard
          label="Attention Needed"
          value={String(d.delayedMilestones.length + d.overspentProjects.length)}
          sub={`${d.delayedMilestones.length} delayed · ${d.overspentProjects.length} overspent`}
          variant="rose"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-10">
        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-1">Budget Performance</h2>
          <p className="text-xs text-muted-foreground mb-5">Planned vs actual spend, top projects</p>
          <div className="h-72">
            {d.budgetChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground/60">No data to display yet</p>
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
                  <Bar dataKey="planned" fill="var(--primary)" radius={[8, 8, 0, 0]} name="Planned" />
                  <Bar dataKey="spent" fill="var(--lavender)" radius={[8, 8, 0, 0]} name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-1">Project Status</h2>
          <p className="text-xs text-muted-foreground mb-5">How your portfolio is distributed</p>
          <div className="h-72">
            {statusColors.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground/60">No projects yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusColors}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={55}
                    strokeWidth={0}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
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
          <h2 className="font-serif text-lg text-foreground mb-5">Milestones</h2>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-serif text-4xl text-primary">
              {d.milestoneCompletionRate}%
            </span>
            <span className="text-sm text-muted-foreground">
              completed ({d.completedMilestones}/{d.totalMilestones})
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
          <h2 className="font-serif text-lg text-foreground mb-5">Execution Balance</h2>
          <ProgressRow
            label="Physical progress"
            value={d.totals?.physicalPerformance || 0}
            colorClass="bg-primary"
            bgClass="bg-sage-pale"
          />
          <ProgressRow
            label="Financial progress"
            value={Math.min(d.totals?.financialPerformance || 0, 100)}
            colorClass="bg-lavender"
            bgClass="bg-lavender-pale"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="p-6 bg-card rounded-2xl">
          <h2 className="font-serif text-lg text-foreground mb-4">Delayed Milestones</h2>
          {d.delayedMilestones.length === 0 ? (
            <div className="py-6 text-center">
              <Leaf className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p className="text-sm text-muted-foreground/60">Everything&apos;s blooming on time</p>
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
          <h2 className="font-serif text-lg text-foreground mb-4">Overspent Budgets</h2>
          {d.overspentProjects.length === 0 ? (
            <div className="py-6 text-center">
              <Flower2 className="h-8 w-8 mx-auto mb-2 text-primary/30" />
              <p className="text-sm text-muted-foreground/60">All budgets are well-tended</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {d.overspentProjects.slice(0, 8).map((r) => (
                <div key={r.projectId} className="flex items-center gap-3 p-3 bg-amber-pale rounded-xl">
                  <div className="h-2 w-2 rounded-full shrink-0 bg-amber-warm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.projectName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatCurrency(r.plannedBudget)} planned · {formatCurrency(r.spentAmount)} spent
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
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-semibold ${colorClass.replace("bg-", "text-")}`}>{value}%</span>
      </div>
      <div className={`h-2.5 rounded-full ${bgClass} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${colorClass} transition-all duration-700`}
          style={{ width: `${value}%`, transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
        />
      </div>
    </div>
  );
}
