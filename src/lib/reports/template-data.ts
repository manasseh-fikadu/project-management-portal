import "server-only";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasReportingTables, isMissingReportingTableError } from "./schema-availability";

type ReportBudgetImportNotes = {
  template?: string;
  sourceSheet?: string;
  sourceRow?: number;
  rowCode?: string | null;
  accountCode?: string | null;
  accountTitle?: string | null;
  categoryCode?: string | null;
  categoryName?: string | null;
  parentActivityCode?: string | null;
  parentActivityName?: string | null;
  description?: string | null;
  unitCost?: number | null;
  unitCount?: number | null;
  quarters?: {
    q1?: number | null;
    q2?: number | null;
    q3?: number | null;
    q4?: number | null;
  };
  rawTotalCost?: number | null;
  unitType?: string | null;
  fundingFacility?: string | null;
  otherFundingSource?: string | null;
  year?: number | null;
  yearlyTotals?: Array<{
    year?: number | null;
    plannedAmount?: number | null;
    quantity?: number | null;
    unitCost?: number | null;
  }>;
  targetGroup?: string | null;
  responsibleEntity?: string | null;
  leadEntity?: string | null;
  procurementCategory?: string | null;
  procurementMethod?: string | null;
  comment?: string | null;
};

export type ReportingTemplateId = "agra-budget-breakdown" | "eif-cpd-annex" | "ppg-boost";
export type ReportingTemplateScope =
  | "full-package"
  | "workplan-only"
  | "budget-only"
  | "working-doc"
  | "cost-build-up";
type ReportingFundingFacilityValue = "ff1" | "ff2" | "eif" | "other" | "unspecified";
export type ReportingTemplateValue = "agra_budget_breakdown" | "eif_cpd_annex" | "ppg_boost";

type CanonicalNodeType = "outcome" | "output" | "activity" | "sub_activity";

export type CanonicalReportingNode = {
  id: string;
  parentId: string | null;
  type: CanonicalNodeType;
  code: string;
  title: string;
  description: string | null;
  indicatorCode: string | null;
  indicatorLabel: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  actualValue: number | null;
  unitType: string | null;
  targetGroup: string | null;
  responsibleEntity: string | null;
  leadEntity: string | null;
  meansOfVerification: string | null;
  assumptions: string | null;
  category: string | null;
  procurementCategory: string | null;
  procurementMethod: string | null;
  comment: string | null;
  executionRate: number | null;
  sortOrder: number;
  taskId?: string | null;
  milestoneId?: string | null;
  sourceBudgetAllocationId?: string | null;
  source: "explicit" | "derived";
};

export type CanonicalBudgetLine = {
  id: string;
  resultId: string | null;
  accountCode: string | null;
  accountTitle: string | null;
  lineDescription: string;
  fundingFacility: ReportingFundingFacilityValue;
  otherFundingSource: string | null;
  unit: string | null;
  quantity: number | null;
  unitCost: number | null;
  plannedAmount: number;
  actualAmount: number;
  currency: string;
  year: number;
  month: number | null;
  quarter: number | null;
  procurementCategory: string | null;
  procurementMethod: string | null;
  comment: string | null;
  sortOrder: number;
  sourceBudgetAllocationId?: string | null;
  metadata?: Record<string, unknown> | null;
  quarterAmounts: [number, number, number, number];
  monthAmounts: number[];
  source: "explicit" | "derived";
};

export type CanonicalTransaction = {
  id: string;
  resultId: string | null;
  budgetLineId: string | null;
  donorId: string | null;
  transactionType: "expenditure" | "disbursement";
  amount: number;
  currency: string;
  occurredAt: Date;
  notes: string | null;
  source: "explicit" | "derived";
};

export type ReportingTemplatePreview = {
  template: ReportingTemplateId;
  scope: ReportingTemplateScope;
  readinessScore: number;
  missingFields: string[];
  warnings: string[];
  explicitCounts: {
    results: number;
    budgetLines: number;
    transactions: number;
  };
  derivedCounts: {
    results: number;
    budgetLines: number;
    transactions: number;
  };
  summary: string[];
};

export type ReportingTemplateData = {
  template: ReportingTemplateId;
  scope: ReportingTemplateScope;
  annualYear: number;
  years: number[];
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    totalBudget: number;
    spentBudget: number;
    startDate: Date | null;
    endDate: Date | null;
    managerName: string;
    donors: { id: string; name: string; type: string }[];
  };
  profile: {
    id: string | null;
    primaryTemplate: ReportingTemplateValue | null;
    country: string | null;
    currency: string;
    reportingStartDate: Date | null;
    reportingEndDate: Date | null;
    annualYear: number | null;
    fundingFacility1Label: string | null;
    fundingFacility2Label: string | null;
    otherFundingLabel: string | null;
    leadAgency: string | null;
    implementingPartner: string | null;
    procurementNotes: string | null;
    metadata: Record<string, unknown> | null;
  };
  nodes: CanonicalReportingNode[];
  budgetLines: CanonicalBudgetLine[];
  transactions: CanonicalTransaction[];
  preview: ReportingTemplatePreview;
};

async function getReportingProjectRecord(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      manager: {
        columns: { firstName: true, lastName: true },
      },
      donor: {
        columns: { id: true, name: true, type: true },
      },
      projectDonors: {
        with: {
          donor: {
            columns: { id: true, name: true, type: true },
          },
        },
      },
      tasks: {
        with: {
          assignee: {
            columns: { firstName: true, lastName: true },
          },
        },
        orderBy: (tasksTable, { asc: orderAsc }) => [orderAsc(tasksTable.createdAt)],
      },
      milestones: {
        orderBy: (milestonesTable, { asc: orderAsc }) => [orderAsc(milestonesTable.order)],
      },
      documents: true,
      budgetAllocations: {
        orderBy: (budgetAllocationsTable, { asc: orderAsc }) => [orderAsc(budgetAllocationsTable.createdAt)],
      },
      expenditures: {
        orderBy: (expendituresTable, { desc: orderDesc }) => [orderDesc(expendituresTable.expenditureDate)],
      },
      disbursementLogs: {
        orderBy: (disbursementLogsTable, { desc: orderDesc }) => [orderDesc(disbursementLogsTable.disbursedAt)],
      },
      reportingProfile: true,
      reportingResults: {
        orderBy: (reportingResultsTable, { asc: orderAsc }) => [orderAsc(reportingResultsTable.sortOrder), orderAsc(reportingResultsTable.createdAt)],
      },
      reportingBudgetLines: {
        orderBy: (reportingBudgetLinesTable, { asc: orderAsc }) => [orderAsc(reportingBudgetLinesTable.sortOrder), orderAsc(reportingBudgetLinesTable.createdAt)],
      },
      reportingTransactions: {
        orderBy: (reportingTransactionsTable, { desc: orderDesc }) => [orderDesc(reportingTransactionsTable.occurredAt)],
      },
    },
  });
}

async function getLegacyProjectRecord(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      manager: {
        columns: { firstName: true, lastName: true },
      },
      donor: {
        columns: { id: true, name: true, type: true },
      },
      projectDonors: {
        with: {
          donor: {
            columns: { id: true, name: true, type: true },
          },
        },
      },
      tasks: {
        with: {
          assignee: {
            columns: { firstName: true, lastName: true },
          },
        },
        orderBy: (tasksTable, { asc: orderAsc }) => [orderAsc(tasksTable.createdAt)],
      },
      milestones: {
        orderBy: (milestonesTable, { asc: orderAsc }) => [orderAsc(milestonesTable.order)],
      },
      documents: true,
      budgetAllocations: {
        orderBy: (budgetAllocationsTable, { asc: orderAsc }) => [orderAsc(budgetAllocationsTable.createdAt)],
      },
      expenditures: {
        orderBy: (expendituresTable, { desc: orderDesc }) => [orderDesc(expendituresTable.expenditureDate)],
      },
      disbursementLogs: {
        orderBy: (disbursementLogsTable, { desc: orderDesc }) => [orderDesc(disbursementLogsTable.disbursedAt)],
      },
    },
  });
}

type FullProjectRecord = NonNullable<Awaited<ReturnType<typeof getReportingProjectRecord>>>;
type LegacyProjectRecord = NonNullable<Awaited<ReturnType<typeof getLegacyProjectRecord>>>;
type ProjectRecord = LegacyProjectRecord & {
  reportingProfile: FullProjectRecord["reportingProfile"] | null;
  reportingResults: FullProjectRecord["reportingResults"];
  reportingBudgetLines: FullProjectRecord["reportingBudgetLines"];
  reportingTransactions: FullProjectRecord["reportingTransactions"];
};

async function getProjectRecordWithFallback(projectId: string): Promise<{ projectRecord: ProjectRecord | null; reportingTablesAvailable: boolean }> {
  const reportingTablesAvailable = await hasReportingTables();

  if (!reportingTablesAvailable) {
    const legacyProject = await getLegacyProjectRecord(projectId);
    return {
      projectRecord: legacyProject
        ? {
            ...legacyProject,
            reportingProfile: null,
            reportingResults: [],
            reportingBudgetLines: [],
            reportingTransactions: [],
          }
        : null,
      reportingTablesAvailable: false,
    };
  }

  try {
    const richProject = await getReportingProjectRecord(projectId);
    return {
      projectRecord: richProject as ProjectRecord | null,
      reportingTablesAvailable: true,
    };
  } catch (error) {
    if (!isMissingReportingTableError(error)) throw error;

    const legacyProject = await getLegacyProjectRecord(projectId);
    return {
      projectRecord: legacyProject
        ? {
            ...legacyProject,
            reportingProfile: null,
            reportingResults: [],
            reportingBudgetLines: [],
            reportingTransactions: [],
          }
        : null,
      reportingTablesAvailable: false,
    };
  }
}

function parseNotes(notes: string | null): ReportBudgetImportNotes | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" ? (parsed as ReportBudgetImportNotes) : null;
  } catch {
    return null;
  }
}

function stripEmpty(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized : null;
}

function toYear(date: Date | null | undefined, fallback: number): number {
  return date ? date.getFullYear() : fallback;
}

function buildTimelineYears(startDate: Date | null, endDate: Date | null, annualYear: number): number[] {
  const startYear = Math.min(toYear(startDate, annualYear), annualYear);
  const naturalEndYear = Math.max(toYear(endDate, annualYear), annualYear);
  const endYear = Math.max(naturalEndYear, startYear + 5);
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years.slice(0, 6);
}

function splitAmountEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  let remainder = total - base * parts;
  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return base + extra;
  });
}

function buildQuarterAmounts(total: number, notes: ReportBudgetImportNotes | null): [number, number, number, number] {
  const raw = [
    Math.round(notes?.quarters?.q1 ?? 0),
    Math.round(notes?.quarters?.q2 ?? 0),
    Math.round(notes?.quarters?.q3 ?? 0),
    Math.round(notes?.quarters?.q4 ?? 0),
  ];
  const rawSum = raw.reduce((sum, value) => sum + value, 0);

  if (rawSum <= 0) {
    const equal = splitAmountEvenly(total, 4);
    return [equal[0] ?? 0, equal[1] ?? 0, equal[2] ?? 0, equal[3] ?? 0];
  }

  const ratioBased = raw.map((value, index) => {
    if (index === raw.length - 1) return 0;
    return Math.round((value / rawSum) * total);
  });
  const assigned = ratioBased.reduce((sum, value) => sum + value, 0);

  return [
    ratioBased[0] ?? 0,
    ratioBased[1] ?? 0,
    ratioBased[2] ?? 0,
    Math.max(0, total - assigned),
  ];
}

function expandQuarterAmountsToMonths(quarterAmounts: [number, number, number, number]): number[] {
  const months = Array.from({ length: 12 }, () => 0);

  quarterAmounts.forEach((quarterAmount, quarterIndex) => {
    const monthly = splitAmountEvenly(quarterAmount, 3);
    const startMonth = quarterIndex * 3;
    monthly.forEach((value, valueIndex) => {
      months[startMonth + valueIndex] = value;
    });
  });

  return months;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeFundingFacility(value: string | null | undefined): ReportingFundingFacilityValue {
  const normalized = stripEmpty(value)?.toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized) return "unspecified";
  if (normalized === "ff1" || normalized === "fundingfacility1") return "ff1";
  if (normalized === "ff2" || normalized === "fundingfacility2") return "ff2";
  if (normalized === "eif" || normalized === "eiffunding") return "eif";
  if (normalized === "other" || normalized === "othersources" || normalized === "otherfunding") return "other";
  return "unspecified";
}

function getYearlyTotals(notes: ReportBudgetImportNotes | null, annualYear: number, fallbackAmount: number) {
  const entries = Array.isArray(notes?.yearlyTotals) ? notes.yearlyTotals : [];
  const normalized = entries
    .map((entry) => ({
      year: entry?.year && Number.isFinite(entry.year) ? Math.round(entry.year) : null,
      plannedAmount: entry?.plannedAmount && Number.isFinite(entry.plannedAmount) ? Math.round(entry.plannedAmount) : null,
      quantity: entry?.quantity && Number.isFinite(entry.quantity) ? Math.round(entry.quantity) : null,
      unitCost: entry?.unitCost && Number.isFinite(entry.unitCost) ? Math.round(entry.unitCost) : null,
    }))
    .filter((entry) => entry.year && entry.plannedAmount && entry.plannedAmount > 0);

  if (normalized.length > 0) {
    return normalized.map((entry) => ({
      year: entry.year!,
      plannedAmount: entry.plannedAmount!,
      quantity: entry.quantity,
      unitCost: entry.unitCost,
    }));
  }

  return [{
    year: notes?.year && Number.isFinite(notes.year) ? Math.round(notes.year) : annualYear,
    plannedAmount: fallbackAmount,
    quantity: notes?.unitCount && Number.isFinite(notes.unitCount) ? Math.round(notes.unitCount) : null,
    unitCost: notes?.unitCost && Number.isFinite(notes.unitCost) ? Math.round(notes.unitCost) : null,
  }];
}

function buildNodeCode(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

function hasMeaningfulValue(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && value !== "";
}

function buildIndicatorLabel(title: string, unitType: string | null): string {
  return unitType ? `${title} (${unitType})` : title;
}

function mapStoredNode(node: ProjectRecord["reportingResults"][number]): CanonicalReportingNode {
  return {
    id: node.id,
    parentId: node.parentId,
    type: node.nodeType,
    code: node.code,
    title: node.title,
    description: node.description,
    indicatorCode: node.indicatorCode,
    indicatorLabel: node.indicatorLabel,
    baselineValue: node.baselineValue,
    targetValue: node.targetValue,
    actualValue: node.actualValue,
    unitType: node.unitType,
    targetGroup: node.targetGroup,
    responsibleEntity: node.responsibleEntity,
    leadEntity: node.leadEntity,
    meansOfVerification: node.meansOfVerification,
    assumptions: node.assumptions,
    category: node.category,
    procurementCategory: node.procurementCategory,
    procurementMethod: node.procurementMethod,
    comment: node.comment,
    executionRate: node.executionRate,
    sortOrder: node.sortOrder,
    taskId: node.taskId,
    milestoneId: node.milestoneId,
    sourceBudgetAllocationId: node.sourceBudgetAllocationId,
    source: "explicit",
  };
}

function buildDerivedNodes(
  projectRecord: ProjectRecord,
  annualYear: number
): CanonicalReportingNode[] {
  const nodes: CanonicalReportingNode[] = [];
  const nodeIndex = new Map<string, string>();
  const fallbackLead = stripEmpty(projectRecord.reportingProfile?.leadAgency) ?? projectRecord.manager.firstName + " " + projectRecord.manager.lastName;
  const fallbackPartner = stripEmpty(projectRecord.reportingProfile?.implementingPartner);

  const rootId = `derived-outcome-${projectRecord.id}`;
  nodes.push({
    id: rootId,
    parentId: null,
    type: "outcome",
    code: "OP1",
    title: projectRecord.name,
    description: projectRecord.description,
    indicatorCode: "OP1",
    indicatorLabel: buildIndicatorLabel(projectRecord.name, "programme"),
    baselineValue: 0,
    targetValue: 100,
    actualValue: projectRecord.tasks.length > 0
      ? Math.round(projectRecord.tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / projectRecord.tasks.length)
      : null,
    unitType: "percent",
    targetGroup: fallbackPartner,
    responsibleEntity: fallbackLead,
    leadEntity: fallbackLead,
    meansOfVerification: projectRecord.documents.length > 0 ? "Project documents and implementation evidence" : null,
    assumptions: null,
    category: "Project Outcome",
    procurementCategory: null,
    procurementMethod: null,
    comment: null,
    executionRate: null,
    sortOrder: 0,
    source: "derived",
  });

  projectRecord.budgetAllocations.forEach((allocation, allocationIndex) => {
    const notes = parseNotes(allocation.notes);
    const categoryCode = stripEmpty(notes?.categoryCode);
    const categoryName = stripEmpty(notes?.categoryName);
    const activityCode = stripEmpty(notes?.parentActivityCode) ?? stripEmpty(notes?.rowCode) ?? buildNodeCode("ACT", allocationIndex);
    const activityName = stripEmpty(notes?.parentActivityName) ?? allocation.activityName;
    const noteTargetGroup = stripEmpty(notes?.targetGroup);
    const noteResponsibleEntity = stripEmpty(notes?.responsibleEntity);
    const noteLeadEntity = stripEmpty(notes?.leadEntity);
    const noteProcurementCategory = stripEmpty(notes?.procurementCategory);
    const noteProcurementMethod = stripEmpty(notes?.procurementMethod);
    const noteComment = stripEmpty(notes?.comment);

    let parentId = rootId;

    if (categoryCode && categoryName) {
      const categoryKey = `category:${categoryCode}`;
      if (!nodeIndex.has(categoryKey)) {
        const categoryId = `derived-output-${categoryCode}`;
        nodeIndex.set(categoryKey, categoryId);
        nodes.push({
          id: categoryId,
          parentId: rootId,
          type: "output",
          code: categoryCode,
          title: categoryName,
          description: null,
          indicatorCode: categoryCode,
          indicatorLabel: buildIndicatorLabel(categoryName, "output"),
          baselineValue: 0,
          targetValue: null,
          actualValue: null,
          unitType: null,
          targetGroup: noteTargetGroup ?? stripEmpty(notes?.description),
          responsibleEntity: noteResponsibleEntity ?? fallbackLead,
          leadEntity: noteLeadEntity ?? noteResponsibleEntity ?? fallbackLead,
          meansOfVerification: null,
          assumptions: null,
          category: categoryName,
          procurementCategory: noteProcurementCategory,
          procurementMethod: noteProcurementMethod,
          comment: noteComment,
          executionRate: null,
          sortOrder: nodes.length,
          sourceBudgetAllocationId: null,
          source: "derived",
        });
      }
      parentId = nodeIndex.get(categoryKey) ?? rootId;
    }

    const activityKey = `activity:${activityCode}:${parentId}`;
    if (!nodeIndex.has(activityKey)) {
      const activityId = `derived-activity-${allocation.id}`;
      nodeIndex.set(activityKey, activityId);
      nodes.push({
        id: activityId,
        parentId,
        type: categoryCode ? "activity" : "output",
        code: activityCode,
        title: activityName,
        description: stripEmpty(notes?.description),
        indicatorCode: null,
        indicatorLabel: buildIndicatorLabel(activityName, stripEmpty(notes?.unitType) ?? "activity"),
        baselineValue: 0,
        targetValue: notes?.unitCount ? Math.round(notes.unitCount) : null,
        actualValue: null,
        unitType: stripEmpty(notes?.unitType),
        targetGroup: noteTargetGroup ?? stripEmpty(notes?.description),
        responsibleEntity: noteResponsibleEntity ?? fallbackLead,
        leadEntity: noteLeadEntity ?? noteResponsibleEntity ?? fallbackLead,
        meansOfVerification: null,
        assumptions: null,
        category: categoryName,
        procurementCategory: noteProcurementCategory,
        procurementMethod: noteProcurementMethod,
        comment: noteComment,
        executionRate: null,
        sortOrder: nodes.length,
        sourceBudgetAllocationId: allocation.id,
        source: "derived",
      });
    }

    const leafCode = stripEmpty(notes?.rowCode) && stripEmpty(notes?.rowCode) !== activityCode
      ? stripEmpty(notes?.rowCode)!
      : `${activityCode}.${allocationIndex + 1}`;

    nodes.push({
      id: `derived-sub-activity-${allocation.id}`,
      parentId: nodeIndex.get(activityKey) ?? parentId,
      type: categoryCode ? "sub_activity" : "activity",
      code: leafCode,
      title: allocation.activityName,
      description: stripEmpty(notes?.description),
      indicatorCode: null,
      indicatorLabel: buildIndicatorLabel(allocation.activityName, stripEmpty(notes?.unitType)),
      baselineValue: 0,
      targetValue: notes?.unitCount ? Math.round(notes.unitCount) : null,
      actualValue: null,
      unitType: stripEmpty(notes?.unitType),
      targetGroup: noteTargetGroup ?? stripEmpty(notes?.description),
      responsibleEntity: noteResponsibleEntity ?? fallbackLead,
      leadEntity: noteLeadEntity ?? noteResponsibleEntity ?? fallbackLead,
      meansOfVerification: null,
      assumptions: null,
      category: categoryName,
      procurementCategory: noteProcurementCategory,
      procurementMethod: noteProcurementMethod,
      comment: noteComment ?? (notes?.template === "AGRA_WRF_BUDGET_DETAIL" ? `Derived from ${notes.sourceSheet ?? "imported budget"} row ${notes.sourceRow ?? "?"}` : null),
      executionRate: null,
      sortOrder: nodes.length,
      sourceBudgetAllocationId: allocation.id,
      source: "derived",
    });
  });

  const representedTaskIds = new Set(nodes.map((node) => node.taskId).filter(Boolean));
  projectRecord.tasks.forEach((task, taskIndex) => {
    if (representedTaskIds.has(task.id)) return;

    nodes.push({
      id: `derived-task-${task.id}`,
      parentId: rootId,
      type: "activity",
      code: buildNodeCode("TSK", taskIndex),
      title: task.title,
      description: task.description,
      indicatorCode: null,
      indicatorLabel: buildIndicatorLabel(task.title, "task"),
      baselineValue: 0,
      targetValue: 100,
      actualValue: task.progress,
      unitType: "percent",
      targetGroup: null,
      responsibleEntity: task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : fallbackLead,
      leadEntity: fallbackLead,
      meansOfVerification: task.completedAt ? "Task completion record" : null,
      assumptions: null,
      category: `Annual ${annualYear} task plan`,
      procurementCategory: null,
      procurementMethod: null,
      comment: null,
      executionRate: task.progress,
      sortOrder: nodes.length,
      taskId: task.id,
      source: "derived",
    });
  });

  return nodes;
}

function mergeNodes(
  explicitNodes: CanonicalReportingNode[],
  derivedNodes: CanonicalReportingNode[]
): CanonicalReportingNode[] {
  if (explicitNodes.length === 0) return derivedNodes;

  const seenBudgetAllocationIds = new Set(explicitNodes.map((node) => node.sourceBudgetAllocationId).filter(Boolean));
  const seenTaskIds = new Set(explicitNodes.map((node) => node.taskId).filter(Boolean));
  const extras = derivedNodes.filter((node) => {
    const isSyntheticAncestor = !node.sourceBudgetAllocationId && !node.taskId;
    if (isSyntheticAncestor) return false;
    if (node.sourceBudgetAllocationId && seenBudgetAllocationIds.has(node.sourceBudgetAllocationId)) return false;
    if (node.taskId && seenTaskIds.has(node.taskId)) return false;
    return true;
  });

  return [...explicitNodes, ...extras];
}

function findResultIdForAllocation(nodes: CanonicalReportingNode[], allocationId: string | null | undefined): string | null {
  if (!allocationId) return null;
  const direct = nodes.find((node) => node.sourceBudgetAllocationId === allocationId && (node.type === "activity" || node.type === "sub_activity"));
  return direct?.id ?? null;
}

function buildDerivedBudgetLines(
  projectRecord: ProjectRecord,
  nodes: CanonicalReportingNode[],
  annualYear: number
): CanonicalBudgetLine[] {
  return projectRecord.budgetAllocations.flatMap((allocation, allocationIndex) => {
    const notes = parseNotes(allocation.notes);
    const yearlyTotals = getYearlyTotals(notes, annualYear, allocation.plannedAmount);
    const resultId = findResultIdForAllocation(nodes, allocation.id);
    const accountCode = stripEmpty(notes?.accountCode) ?? stripEmpty(notes?.rowCode) ?? stripEmpty(notes?.categoryCode);
    const accountTitle = stripEmpty(notes?.accountTitle) ?? stripEmpty(notes?.categoryName) ?? stripEmpty(notes?.parentActivityName);
    const lineDescription = stripEmpty(notes?.description) ?? allocation.activityName;
    const fundingFacility = normalizeFundingFacility(notes?.fundingFacility);
    const procurementCategory = stripEmpty(notes?.procurementCategory);
    const procurementMethod = stripEmpty(notes?.procurementMethod);
    const baseComment = stripEmpty(notes?.comment)
      ?? (notes?.template === "AGRA_WRF_BUDGET_DETAIL"
        ? `Derived from ${notes.sourceSheet ?? "imported budget"} row ${notes.sourceRow ?? "?"}`
        : notes?.template
          ? `Backfilled from ${notes.template}`
          : null);

    return yearlyTotals.map((entry, yearIndex) => {
      const quarterAmounts = yearlyTotals.length === 1
        ? buildQuarterAmounts(entry.plannedAmount, notes)
        : buildQuarterAmounts(entry.plannedAmount, null);
      const monthAmounts = expandQuarterAmountsToMonths(quarterAmounts);
      const quantity = entry.quantity ?? (notes?.unitCount ? Math.round(notes.unitCount) : null);
      const unitCost = entry.unitCost
        ?? (notes?.unitCost ? Math.round(notes.unitCost) : quantity && quantity > 0 ? Math.round(entry.plannedAmount / quantity) : entry.plannedAmount);

      return {
        id: `derived-budget-${allocation.id}-${entry.year}-${yearIndex}`,
        resultId,
        accountCode,
        accountTitle,
        lineDescription,
        fundingFacility,
        otherFundingSource: stripEmpty(notes?.otherFundingSource),
        unit: stripEmpty(notes?.unitType) ?? (quantity ? "unit" : null),
        quantity,
        unitCost,
        plannedAmount: entry.plannedAmount,
        actualAmount: 0,
        currency: stripEmpty(projectRecord.reportingProfile?.currency) ?? "ETB",
        year: entry.year,
        month: null,
        quarter: null,
        procurementCategory,
        procurementMethod,
        comment: baseComment,
        sortOrder: allocationIndex * 100 + yearIndex,
        sourceBudgetAllocationId: allocation.id,
        metadata: notes ? asRecord(notes) : null,
        quarterAmounts,
        monthAmounts,
        source: "derived",
      };
    });
  });
}

function mergeBudgetLines(
  explicitLines: CanonicalBudgetLine[],
  derivedLines: CanonicalBudgetLine[]
): CanonicalBudgetLine[] {
  if (explicitLines.length === 0) return derivedLines;

  const structuredSourceIds = new Set(
    explicitLines
      .filter((line) => line.sourceBudgetAllocationId && line.resultId)
      .map((line) => line.sourceBudgetAllocationId!)
  );
  const replaceWithDerivedIds = new Set(
    explicitLines
      .filter((line) => line.sourceBudgetAllocationId && !line.resultId && !structuredSourceIds.has(line.sourceBudgetAllocationId))
      .map((line) => line.sourceBudgetAllocationId!)
  );
  const preservedExplicit = explicitLines.filter((line) => !(line.sourceBudgetAllocationId && replaceWithDerivedIds.has(line.sourceBudgetAllocationId)));
  const seenPreservedSourceIds = new Set(preservedExplicit.map((line) => line.sourceBudgetAllocationId).filter(Boolean));
  const extras = derivedLines.filter((line) => !(line.sourceBudgetAllocationId && seenPreservedSourceIds.has(line.sourceBudgetAllocationId)));
  return [...preservedExplicit, ...extras];
}

function buildDerivedTransactions(
  projectRecord: ProjectRecord,
  budgetLines: CanonicalBudgetLine[],
  nodes: CanonicalReportingNode[]
): CanonicalTransaction[] {
  const budgetLineBySource = budgetLines.reduce((acc, line) => {
    if (!line.sourceBudgetAllocationId) {
      return acc;
    }

    const existing = acc.get(line.sourceBudgetAllocationId) ?? [];
    existing.push(line);
    acc.set(line.sourceBudgetAllocationId, existing);
    return acc;
  }, new Map<string, CanonicalBudgetLine[]>());

  const resultBySourceAllocationId = new Map(
    nodes
      .filter((node) => node.sourceBudgetAllocationId)
      .map((node) => [node.sourceBudgetAllocationId!, node.id])
  );

  function getBudgetLineForTransaction(sourceBudgetAllocationId: string | null | undefined, occurredAt: Date) {
    if (!sourceBudgetAllocationId) {
      return null;
    }

    const matchingLines = budgetLineBySource.get(sourceBudgetAllocationId);
    if (!matchingLines || matchingLines.length === 0) {
      return null;
    }

    const transactionYear = occurredAt.getUTCFullYear();
    return matchingLines.find((line) => line.year === transactionYear) ?? matchingLines[0] ?? null;
  }

  const expenditureTransactions = projectRecord.expenditures.map((expenditure) => {
    const budgetLine = getBudgetLineForTransaction(expenditure.budgetAllocationId, expenditure.expenditureDate);
    return {
      id: `derived-expenditure-${expenditure.id}`,
      resultId: budgetLine?.resultId ?? resultBySourceAllocationId.get(expenditure.budgetAllocationId ?? "") ?? null,
      budgetLineId: budgetLine?.id ?? null,
      donorId: expenditure.donorId,
      transactionType: "expenditure" as const,
      amount: expenditure.amount,
      currency: stripEmpty(projectRecord.reportingProfile?.currency) ?? "ETB",
      occurredAt: expenditure.expenditureDate,
      notes: expenditure.description,
      source: "derived" as const,
    };
  });

  const disbursementTransactions = projectRecord.disbursementLogs.map((disbursement) => {
    const budgetLine = getBudgetLineForTransaction(disbursement.budgetAllocationId, disbursement.disbursedAt);
    return {
      id: `derived-disbursement-${disbursement.id}`,
      resultId: budgetLine?.resultId ?? resultBySourceAllocationId.get(disbursement.budgetAllocationId ?? "") ?? null,
      budgetLineId: budgetLine?.id ?? null,
      donorId: disbursement.donorId,
      transactionType: "disbursement" as const,
      amount: disbursement.amount,
      currency: stripEmpty(projectRecord.reportingProfile?.currency) ?? "ETB",
      occurredAt: disbursement.disbursedAt,
      notes: disbursement.notes,
      source: "derived" as const,
    };
  });

  return [...expenditureTransactions, ...disbursementTransactions];
}

function mergeTransactions(
  explicitTransactions: CanonicalTransaction[],
  derivedTransactions: CanonicalTransaction[]
): CanonicalTransaction[] {
  if (explicitTransactions.length === 0) return derivedTransactions;

  const buildTransactionMergeKey = (transaction: CanonicalTransaction) =>
    [
      transaction.transactionType,
      transaction.amount,
      transaction.occurredAt.toISOString(),
      transaction.donorId ?? "",
      transaction.budgetLineId ?? "",
      transaction.resultId ?? "",
    ].join(":");

  const seenKeys = new Set(
    explicitTransactions.map(buildTransactionMergeKey)
  );

  return [
    ...explicitTransactions,
    ...derivedTransactions.filter((transaction) => !seenKeys.has(buildTransactionMergeKey(transaction))),
  ];
}

function buildPreview(
  template: ReportingTemplateId,
  scope: ReportingTemplateScope,
  nodes: CanonicalReportingNode[],
  budgetLines: CanonicalBudgetLine[],
  transactions: CanonicalTransaction[],
  data: Pick<ReportingTemplateData, "project" | "profile">
): ReportingTemplatePreview {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!stripEmpty(data.profile.country)) missingFields.push("Country");
  if (!data.profile.reportingStartDate) missingFields.push("Reporting start date");
  if (!data.profile.reportingEndDate) warnings.push("Reporting end date is missing, so the timeline uses a default six-year window.");

  if (template === "eif-cpd-annex") {
    if (!nodes.some((node) => node.type === "output")) missingFields.push("At least one output/result row");
    if (!nodes.some((node) => hasMeaningfulValue(node.indicatorCode) || hasMeaningfulValue(node.indicatorLabel))) {
      missingFields.push("Indicator code or indicator label");
    }
    if (!nodes.some((node) => hasMeaningfulValue(node.meansOfVerification))) {
      warnings.push("Means of verification are still blank for all reporting rows.");
    }
    if (!budgetLines.some((line) => hasMeaningfulValue(line.accountCode) && hasMeaningfulValue(line.accountTitle))) {
      missingFields.push("Budget account code and title");
    }
  }

  if (template === "ppg-boost") {
    if (!nodes.some((node) => node.type === "activity" || node.type === "sub_activity")) {
      missingFields.push("At least one activity row");
    }
    if (!nodes.some((node) => hasMeaningfulValue(node.targetGroup))) {
      warnings.push("Target group values are not populated yet.");
    }
    if (!nodes.some((node) => hasMeaningfulValue(node.responsibleEntity) || hasMeaningfulValue(node.leadEntity))) {
      missingFields.push("Responsible implementation owner");
    }
    if (!budgetLines.some((line) => hasMeaningfulValue(line.procurementMethod))) {
      warnings.push("Procurement methods are missing, so the Ethiopia cost-build sheet will be only partially filled.");
    }
  }

  if (template === "agra-budget-breakdown") {
    if (!budgetLines.some((line) => hasMeaningfulValue(line.accountCode) || hasMeaningfulValue(line.accountTitle))) {
      missingFields.push("Budget account code or title");
    }
    if (!budgetLines.some((line) => hasMeaningfulValue(line.lineDescription))) {
      missingFields.push("Budget line description");
    }
    if (!budgetLines.some((line) => hasMeaningfulValue(line.quantity) || hasMeaningfulValue(line.unitCost))) {
      warnings.push("Unit quantities and unit costs are mostly blank, so AGRA rows will use generated fallbacks.");
    }
  }

  if (scope === "budget-only" || scope === "cost-build-up") {
    if (budgetLines.length === 0) missingFields.push("Budget lines");
  }

  if (transactions.length === 0) {
    warnings.push("No normalized reporting transactions are stored yet; actuals are being backfilled from expenditures and disbursements only.");
  }

  const score = Math.max(0, Math.min(100, 100 - missingFields.length * 18 - warnings.length * 5));

  return {
    template,
    scope,
    readinessScore: score,
    missingFields,
    warnings,
    explicitCounts: {
      results: nodes.filter((node) => node.source === "explicit").length,
      budgetLines: budgetLines.filter((line) => line.source === "explicit").length,
      transactions: transactions.filter((transaction) => transaction.source === "explicit").length,
    },
    derivedCounts: {
      results: nodes.filter((node) => node.source === "derived").length,
      budgetLines: budgetLines.filter((line) => line.source === "derived").length,
      transactions: transactions.filter((transaction) => transaction.source === "derived").length,
    },
    summary: [
      `${nodes.length} reporting rows available for workbook generation`,
      `${budgetLines.length} normalized budget lines available`,
      `${transactions.length} reporting transactions available`,
    ],
  };
}

export async function getReportingTemplateData(
  projectId: string,
  template: ReportingTemplateId,
  scope: ReportingTemplateScope,
  requestedAnnualYear?: number
): Promise<ReportingTemplateData | null> {
  const { projectRecord, reportingTablesAvailable } = await getProjectRecordWithFallback(projectId);

  if (!projectRecord) return null;

  const annualYear = requestedAnnualYear
    ?? projectRecord.reportingProfile?.annualYear
    ?? projectRecord.startDate?.getFullYear()
    ?? new Date().getFullYear();

  const years = buildTimelineYears(
    projectRecord.reportingProfile?.reportingStartDate ?? projectRecord.startDate,
    projectRecord.reportingProfile?.reportingEndDate ?? projectRecord.endDate,
    annualYear
  );

  const explicitNodes = projectRecord.reportingResults.map(mapStoredNode);
  const derivedNodes = buildDerivedNodes(projectRecord, annualYear);
  const nodes = mergeNodes(explicitNodes, derivedNodes);

  const explicitBudgetLines: CanonicalBudgetLine[] = projectRecord.reportingBudgetLines.map((line) => {
    const metadata = asRecord(line.metadata);
    const storedQuarterAmounts = Array.isArray(metadata?.quarterAmounts) ? metadata.quarterAmounts as unknown[] : null;
    const quarterAmounts = storedQuarterAmounts
      ? [
          Number(storedQuarterAmounts[0] ?? 0),
          Number(storedQuarterAmounts[1] ?? 0),
          Number(storedQuarterAmounts[2] ?? 0),
          Number(storedQuarterAmounts[3] ?? 0),
        ] as [number, number, number, number]
      : buildQuarterAmounts(line.plannedAmount, null);
    const storedMonthAmounts = Array.isArray(metadata?.monthAmounts) ? metadata.monthAmounts as unknown[] : null;
    const monthAmounts = storedMonthAmounts
      ? Array.from({ length: 12 }, (_, index) => Number(storedMonthAmounts[index] ?? 0))
      : expandQuarterAmountsToMonths(quarterAmounts);

    return {
      id: line.id,
      resultId: line.reportingResultId,
      accountCode: line.accountCode,
      accountTitle: line.accountTitle,
      lineDescription: line.lineDescription ?? line.accountTitle ?? "Budget line",
      fundingFacility: line.fundingFacility,
      otherFundingSource: line.otherFundingSource,
      unit: line.unit,
      quantity: line.quantity,
      unitCost: line.unitCost,
      plannedAmount: line.plannedAmount,
      actualAmount: line.actualAmount,
      currency: line.currency,
      year: line.year ?? annualYear,
      month: line.month,
      quarter: line.quarter,
      procurementCategory: line.procurementCategory,
      procurementMethod: line.procurementMethod,
      comment: line.comment,
      sortOrder: line.sortOrder,
      sourceBudgetAllocationId: line.sourceBudgetAllocationId,
      metadata,
      quarterAmounts,
      monthAmounts,
      source: "explicit",
    };
  });
  const derivedBudgetLines = buildDerivedBudgetLines(projectRecord, nodes, annualYear);
  const budgetLines = mergeBudgetLines(explicitBudgetLines, derivedBudgetLines);

  const explicitTransactions: CanonicalTransaction[] = projectRecord.reportingTransactions.map((transaction) => ({
    id: transaction.id,
    resultId: transaction.reportingResultId,
    budgetLineId: transaction.reportingBudgetLineId,
    donorId: transaction.donorId,
    transactionType: transaction.transactionType,
    amount: transaction.amount,
    currency: transaction.currency,
    occurredAt: transaction.occurredAt,
    notes: transaction.notes,
    source: "explicit",
  }));
  const derivedTransactions = buildDerivedTransactions(projectRecord, budgetLines, nodes);
  const transactions = mergeTransactions(explicitTransactions, derivedTransactions);

  const donors = projectRecord.projectDonors.length > 0
    ? projectRecord.projectDonors.map((link) => ({
        id: link.donor.id,
        name: link.donor.name,
        type: link.donor.type,
      }))
    : projectRecord.donor
      ? [{ id: projectRecord.donor.id, name: projectRecord.donor.name, type: projectRecord.donor.type }]
      : [];

  const profile = {
    id: projectRecord.reportingProfile?.id ?? null,
    primaryTemplate: projectRecord.reportingProfile?.primaryTemplate ?? null,
    country: stripEmpty(projectRecord.reportingProfile?.country),
    currency: stripEmpty(projectRecord.reportingProfile?.currency) ?? "ETB",
    reportingStartDate: projectRecord.reportingProfile?.reportingStartDate ?? projectRecord.startDate,
    reportingEndDate: projectRecord.reportingProfile?.reportingEndDate ?? projectRecord.endDate,
    annualYear: projectRecord.reportingProfile?.annualYear ?? null,
    fundingFacility1Label: stripEmpty(projectRecord.reportingProfile?.fundingFacility1Label),
    fundingFacility2Label: stripEmpty(projectRecord.reportingProfile?.fundingFacility2Label),
    otherFundingLabel: stripEmpty(projectRecord.reportingProfile?.otherFundingLabel),
    leadAgency: stripEmpty(projectRecord.reportingProfile?.leadAgency),
    implementingPartner: stripEmpty(projectRecord.reportingProfile?.implementingPartner),
    procurementNotes: stripEmpty(projectRecord.reportingProfile?.procurementNotes),
    metadata: asRecord(projectRecord.reportingProfile?.metadata),
  };

  const data: ReportingTemplateData = {
    template,
    scope,
    annualYear,
    years,
    project: {
      id: projectRecord.id,
      name: projectRecord.name,
      description: projectRecord.description,
      status: projectRecord.status,
      totalBudget: projectRecord.totalBudget ?? 0,
      spentBudget: projectRecord.spentBudget ?? 0,
      startDate: projectRecord.startDate,
      endDate: projectRecord.endDate,
      managerName: `${projectRecord.manager.firstName} ${projectRecord.manager.lastName}`,
      donors,
    },
    profile,
    nodes,
    budgetLines,
    transactions,
    preview: {
      template,
      scope,
      readinessScore: 0,
      missingFields: [],
      warnings: [],
      explicitCounts: { results: 0, budgetLines: 0, transactions: 0 },
      derivedCounts: { results: 0, budgetLines: 0, transactions: 0 },
      summary: [],
    },
  };

  data.preview = buildPreview(template, scope, nodes, budgetLines, transactions, data);
  if (!reportingTablesAvailable) {
    data.preview.warnings.unshift("Reporting database tables are not available yet, so this workbook is being generated from backfilled legacy project data.");
  }
  return data;
}
