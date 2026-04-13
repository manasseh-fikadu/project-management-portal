import "server-only";
import { db } from "@/db";
import {
  projects,
  milestones,
  tasks,
  projectMembers,
  budgetAllocations,
  expenditures,
  disbursementLogs,
  donors,
  projectDonors,
} from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

function toPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

// ---------- Project Summary ----------

export type ProjectSummaryData = {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    totalBudget: number | null;
    startDate: Date | null;
    endDate: Date | null;
  };
  manager: { firstName: string; lastName: string; email: string } | null;
  milestones: {
    title: string;
    status: string;
    dueDate: Date | null;
    completedAt: Date | null;
  }[];
  tasks: {
    title: string;
    status: string;
    priority: string;
    progress: number;
    dueDate: Date | null;
    assignee: { firstName: string; lastName: string } | null;
  }[];
  members: {
    role: string;
    user: { firstName: string; lastName: string; email: string };
  }[];
  generatedAt: Date;
};

export async function getProjectSummaryData(projectId: string): Promise<ProjectSummaryData | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      manager: {
        columns: { firstName: true, lastName: true, email: true },
      },
      milestones: {
        columns: { title: true, status: true, dueDate: true, completedAt: true },
        orderBy: [desc(milestones.order)],
      },
      tasks: {
        columns: { title: true, status: true, priority: true, progress: true, dueDate: true },
        with: {
          assignee: {
            columns: { firstName: true, lastName: true },
          },
        },
        orderBy: [desc(tasks.createdAt)],
      },
      members: {
        columns: { role: true },
        with: {
          user: {
            columns: { firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  });

  if (!project) return null;

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      totalBudget: project.totalBudget,
      startDate: project.startDate,
      endDate: project.endDate,
    },
    manager: project.manager,
    milestones: project.milestones,
    tasks: project.tasks,
    members: project.members,
    generatedAt: new Date(),
  };
}

// ---------- Financial Report ----------

export type FinancialProjectRow = {
  projectId: string;
  projectName: string;
  plannedBudget: number;
  spentAmount: number;
  disbursedAmount: number;
  totalTasks: number;
  completedTasks: number;
  physicalPerformance: number;
  financialPerformance: number;
  variance: number;
  status: "aligned" | "overspending_risk" | "under_spending";
};

export type FinancialReportData = {
  rows: FinancialProjectRow[];
  totals: {
    plannedBudget: number;
    spentAmount: number;
    disbursedAmount: number;
    totalTasks: number;
    completedTasks: number;
    physicalPerformance: number;
    financialPerformance: number;
  };
  budgetLines: {
    activityName: string;
    plannedAmount: number;
    projectName: string;
  }[];
  recentExpenditures: {
    activityName: string | null;
    amount: number;
    expenditureDate: Date;
    projectName: string;
  }[];
  generatedAt: Date;
};

export async function getFinancialReportData(projectId?: string): Promise<FinancialReportData> {
  const projectRows = await db.query.projects.findMany({
    where: projectId ? eq(projects.id, projectId) : undefined,
    with: {
      tasks: {
        columns: { id: true, status: true, progress: true },
      },
    },
    orderBy: [desc(projects.createdAt)],
  });

  const budgetRows = await db.query.budgetAllocations.findMany({
    where: projectId ? eq(budgetAllocations.projectId, projectId) : undefined,
    columns: { projectId: true, plannedAmount: true, activityName: true },
    with: {
      project: { columns: { name: true } },
    },
  });

  const expenditureRows = await db.query.expenditures.findMany({
    where: projectId ? eq(expenditures.projectId, projectId) : undefined,
    columns: { projectId: true, amount: true, activityName: true, expenditureDate: true },
    with: {
      project: { columns: { name: true } },
    },
    orderBy: [desc(expenditures.expenditureDate)],
  });

  const disbursementRows = await db.query.disbursementLogs.findMany({
    where: projectId
      ? and(eq(disbursementLogs.projectId, projectId), eq(disbursementLogs.direction, "outward"))
      : eq(disbursementLogs.direction, "outward"),
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

  const rows: FinancialProjectRow[] = projectRows.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === "completed").length;
    const totalProgress = project.tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0);
    const physicalPerformance = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;

    const plannedFromAllocations = plannedByProject.get(project.id) ?? 0;
    const plannedBudget = plannedFromAllocations > 0 ? plannedFromAllocations : (project.totalBudget ?? 0);
    const spentAmount = spentByProject.get(project.id) ?? 0;
    const disbursedAmount = disbursedByProject.get(project.id) ?? 0;
    const financialPerformance = toPercent(spentAmount, plannedBudget);
    const variance = financialPerformance - physicalPerformance;

    let status: FinancialProjectRow["status"] = "aligned";
    if (variance >= 15) status = "overspending_risk";
    else if (variance <= -15) status = "under_spending";

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

  const totals = rows.reduce(
    (acc, row) => {
      acc.plannedBudget += row.plannedBudget;
      acc.spentAmount += row.spentAmount;
      acc.disbursedAmount += row.disbursedAmount;
      acc.totalTasks += row.totalTasks;
      acc.completedTasks += row.completedTasks;
      acc.weightedProgress += row.physicalPerformance * row.totalTasks;
      return acc;
    },
    { plannedBudget: 0, spentAmount: 0, disbursedAmount: 0, totalTasks: 0, completedTasks: 0, weightedProgress: 0 },
  );

  return {
    rows,
    totals: {
      ...totals,
      physicalPerformance: totals.totalTasks > 0 ? Math.round(totals.weightedProgress / totals.totalTasks) : 0,
      financialPerformance: toPercent(totals.spentAmount, totals.plannedBudget),
    },
    budgetLines: budgetRows.map((b) => ({
      activityName: b.activityName,
      plannedAmount: b.plannedAmount,
      projectName: b.project?.name ?? "Unknown",
    })),
    recentExpenditures: expenditureRows.slice(0, 50).map((e) => ({
      activityName: e.activityName,
      amount: e.amount,
      expenditureDate: e.expenditureDate,
      projectName: e.project?.name ?? "Unknown",
    })),
    generatedAt: new Date(),
  };
}

// ---------- Donor Report ----------

export type DonorReportProject = {
  projectId: string;
  projectName: string;
  status: string;
  plannedBudget: number;
  spentAmount: number;
  disbursedAmount: number;
  physicalPerformance: number;
  financialPerformance: number;
};

export type DonorReportData = {
  donor: {
    id: string;
    name: string;
    type: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
  };
  projects: DonorReportProject[];
  totals: {
    plannedBudget: number;
    spentAmount: number;
    disbursedAmount: number;
  };
  generatedAt: Date;
};

export async function getDonorReportData(donorId: string): Promise<DonorReportData | null> {
  const donor = await db.query.donors.findFirst({
    where: eq(donors.id, donorId),
    columns: { id: true, name: true, type: true, contactPerson: true, email: true, phone: true },
  });

  if (!donor) return null;

  const linkedProjects = await db.query.projectDonors.findMany({
    where: eq(projectDonors.donorId, donorId),
    with: {
      project: {
        with: {
          tasks: { columns: { id: true, status: true, progress: true } },
        },
      },
    },
  });

  const projectIds = linkedProjects.map((lp) => lp.project.id);

  const allBudgets = projectIds.length > 0
    ? await db.query.budgetAllocations.findMany({
        where: inArray(budgetAllocations.projectId, projectIds),
        columns: { projectId: true, plannedAmount: true },
      })
    : [];
  const allExpenses = projectIds.length > 0
    ? await db.query.expenditures.findMany({
        where: inArray(expenditures.projectId, projectIds),
        columns: { projectId: true, amount: true },
      })
    : [];
  const allDisbursements = projectIds.length > 0
    ? await db.query.disbursementLogs.findMany({
        where: and(
          eq(disbursementLogs.donorId, donorId),
          inArray(disbursementLogs.projectId, projectIds),
          eq(disbursementLogs.direction, "outward"),
        ),
        columns: { projectId: true, amount: true },
      })
    : [];

  const plannedMap = new Map<string, number>();
  const spentMap = new Map<string, number>();
  const disbursedMap = new Map<string, number>();

  for (const b of allBudgets) {
    plannedMap.set(b.projectId, (plannedMap.get(b.projectId) ?? 0) + b.plannedAmount);
  }
  for (const e of allExpenses) {
    spentMap.set(e.projectId, (spentMap.get(e.projectId) ?? 0) + e.amount);
  }
  for (const d of allDisbursements) {
    disbursedMap.set(d.projectId, (disbursedMap.get(d.projectId) ?? 0) + d.amount);
  }

  const donorProjects: DonorReportProject[] = linkedProjects.map((lp) => {
    const project = lp.project;
    const totalTasks = project.tasks.length;
    const totalProgress = project.tasks.reduce((sum, t) => sum + (t.progress ?? 0), 0);
    const physicalPerformance = totalTasks > 0 ? Math.round(totalProgress / totalTasks) : 0;
    const plannedFromAlloc = plannedMap.get(project.id) ?? 0;
    const plannedBudget = plannedFromAlloc > 0 ? plannedFromAlloc : (project.totalBudget ?? 0);
    const spentAmount = spentMap.get(project.id) ?? 0;
    const disbursedAmount = disbursedMap.get(project.id) ?? 0;

    return {
      projectId: project.id,
      projectName: project.name,
      status: project.status,
      plannedBudget,
      spentAmount,
      disbursedAmount,
      physicalPerformance,
      financialPerformance: toPercent(spentAmount, plannedBudget),
    };
  });

  const totals = donorProjects.reduce(
    (acc, p) => {
      acc.plannedBudget += p.plannedBudget;
      acc.spentAmount += p.spentAmount;
      acc.disbursedAmount += p.disbursedAmount;
      return acc;
    },
    { plannedBudget: 0, spentAmount: 0, disbursedAmount: 0 },
  );

  return { donor, projects: donorProjects, totals, generatedAt: new Date() };
}
