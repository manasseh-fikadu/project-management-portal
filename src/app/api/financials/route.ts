import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, disbursementLogs, expenditures, projects } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

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

    const projectRows = await db.query.projects.findMany({
      where: projectId ? eq(projects.id, projectId) : undefined,
      with: {
        tasks: {
          columns: { id: true, status: true },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });

    const budgetRows = await db.query.budgetAllocations.findMany({
      where: projectId ? eq(budgetAllocations.projectId, projectId) : undefined,
      columns: { projectId: true, plannedAmount: true },
    });

    const expenditureRows = await db.query.expenditures.findMany({
      where: projectId ? eq(expenditures.projectId, projectId) : undefined,
      columns: { projectId: true, amount: true },
    });

    const disbursementRows = await db.query.disbursementLogs.findMany({
      where: projectId ? eq(disbursementLogs.projectId, projectId) : undefined,
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
      const physicalPerformance = toPercent(completedTasks, totalTasks);

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
        return acc;
      },
      {
        plannedBudget: 0,
        spentAmount: 0,
        disbursedAmount: 0,
        totalTasks: 0,
        completedTasks: 0,
      }
    );

    const totalsWithPerformance = {
      ...totals,
      physicalPerformance: toPercent(totals.completedTasks, totals.totalTasks),
      financialPerformance: toPercent(totals.spentAmount, totals.plannedBudget),
    };

    return NextResponse.json({ comparison, totals: totalsWithPerformance });
  } catch (error) {
    console.error("Error generating financial overview:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
