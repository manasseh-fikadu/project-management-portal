import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, disbursementLogs, expenditures, projects } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, getAccessibleProjectIds } from "@/lib/rbac";

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const accessibleProjectIds = await getAccessibleProjectIds(session.user);

    if (projectId) {
      const hasAccess = await canAccessProject(session.user, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (accessibleProjectIds?.length === 0) {
      return NextResponse.json({
        comparison: [],
        totals: {
          plannedBudget: 0,
          spentAmount: 0,
          disbursedAmount: 0,
          totalTasks: 0,
          completedTasks: 0,
          physicalPerformance: 0,
          financialPerformance: 0,
        },
      });
    }

    const projectScope = projectId
      ? eq(projects.id, projectId)
      : accessibleProjectIds
        ? inArray(projects.id, accessibleProjectIds)
        : undefined;

    const budgetScope = projectId
      ? eq(budgetAllocations.projectId, projectId)
      : accessibleProjectIds
        ? inArray(budgetAllocations.projectId, accessibleProjectIds)
        : undefined;

    const expenditureScope = projectId
      ? eq(expenditures.projectId, projectId)
      : accessibleProjectIds
        ? inArray(expenditures.projectId, accessibleProjectIds)
        : undefined;

    const disbursementScope = projectId
      ? eq(disbursementLogs.projectId, projectId)
      : accessibleProjectIds
        ? inArray(disbursementLogs.projectId, accessibleProjectIds)
        : undefined;

    const projectRows = await db.query.projects.findMany({
      where: projectScope,
      with: {
        tasks: {
          columns: { id: true, status: true, progress: true },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });

    const budgetRows = await db.query.budgetAllocations.findMany({
      where: budgetScope,
      columns: { projectId: true, plannedAmount: true },
    });

    const expenditureRows = await db.query.expenditures.findMany({
      where: expenditureScope,
      columns: { projectId: true, amount: true },
    });

    const disbursementRows = await db.query.disbursementLogs.findMany({
      where: disbursementScope,
      columns: { projectId: true, amount: true },
    });

    const plannedByProject = new Map<string, number>();
    const spentByProject = new Map<string, number>();
    const disbursedByProject = new Map<string, number>();

    for (const row of budgetRows) {
      plannedByProject.set(row.projectId, (plannedByProject.get(row.projectId) ?? 0) + row.plannedAmount);
    }

    for (const row of expenditureRows) {
      spentByProject.set(row.projectId, (spentByProject.get(row.projectId) ?? 0) + row.amount);
    }

    for (const row of disbursementRows) {
      disbursedByProject.set(row.projectId, (disbursedByProject.get(row.projectId) ?? 0) + row.amount);
    }

    const comparison = projectRows.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task) => task.status === "completed").length;
      const totalProgress = project.tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0);
      const physicalPerformance = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;

      const plannedFromAllocations = plannedByProject.get(project.id) ?? 0;
      const plannedBudget = plannedFromAllocations > 0 ? plannedFromAllocations : (project.totalBudget ?? 0);
      const spentAmount = spentByProject.get(project.id) ?? 0;
      const disbursedAmount = disbursedByProject.get(project.id) ?? 0;
      const financialPerformance = toPercent(spentAmount, plannedBudget);
      const variance = financialPerformance - physicalPerformance;

      let status = "aligned";
      if (variance >= 15) {
        status = "overspending_risk";
      } else if (variance <= -15) {
        status = "under_spending";
      }

      return {
        projectId: project.id,
        projectName: project.name,
        plannedBudget,
        spentAmount,
        disbursedAmount,
        totalTasks,
        completedTasks,
        physicalPerformance,
        financialPerformance,
        variance,
        status,
      };
    });

    const totals = comparison.reduce(
      (acc, row) => {
        acc.plannedBudget += row.plannedBudget;
        acc.spentAmount += row.spentAmount;
        acc.disbursedAmount += row.disbursedAmount;
        acc.totalTasks += row.totalTasks;
        acc.completedTasks += row.completedTasks;
        acc.weightedProgress += row.physicalPerformance * row.totalTasks;
        return acc;
      },
      {
        plannedBudget: 0,
        spentAmount: 0,
        disbursedAmount: 0,
        totalTasks: 0,
        completedTasks: 0,
        weightedProgress: 0,
      }
    );

    const totalsWithPerformance = {
      ...totals,
      physicalPerformance: totals.totalTasks > 0 ? Math.round(totals.weightedProgress / totals.totalTasks) : 0,
      financialPerformance: toPercent(totals.spentAmount, totals.plannedBudget),
    };

    return NextResponse.json({ comparison, totals: totalsWithPerformance });
  } catch (error) {
    console.error("Error generating financial overview:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
