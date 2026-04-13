import "server-only";

import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import {
  budgetAllocations,
  db,
  disbursementLogs,
  expenditures,
  procurementRequests,
  projects,
  purchaseOrders,
  supplierInvoices,
} from "@/db";

const EXCLUDED_COMMITMENT_STATUSES = ["cancelled", "rejected"] as const;
const ACTIVE_COMMITMENT_STATUSES = [
  "approved",
  "rfq_open",
  "quotes_received",
  "po_issued",
  "partially_received",
  "received",
  "invoiced",
  "paid",
] as const;

function toRoundedNumber(value: unknown): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
}

export type ProcurementBudgetSnapshot = {
  scope: "project" | "budget_allocation";
  projectId: string;
  projectName: string | null;
  budgetAllocationId: string | null;
  budgetAllocationName: string | null;
  totalBudget: number;
  actualSpent: number;
  committedAmount: number;
  availableAmount: number;
};

export async function getProcurementBudgetSnapshot(params: {
  projectId: string;
  budgetAllocationId?: string | null;
  excludeRequestId?: string | null;
}): Promise<ProcurementBudgetSnapshot | null> {
  const { projectId, budgetAllocationId, excludeRequestId } = params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, name: true, totalBudget: true, spentBudget: true },
  });

  if (!project) {
    return null;
  }

  const commitmentFilters = [
    eq(procurementRequests.projectId, projectId),
    notInArray(procurementRequests.status, [...EXCLUDED_COMMITMENT_STATUSES]),
    budgetAllocationId ? eq(procurementRequests.budgetAllocationId, budgetAllocationId) : undefined,
    excludeRequestId ? ne(procurementRequests.id, excludeRequestId) : undefined,
  ].filter(Boolean);

  const [commitmentRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${procurementRequests.committedAmount}), 0)`,
    })
    .from(procurementRequests)
    .where(and(...commitmentFilters));

  if (budgetAllocationId) {
    const budgetAllocation = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, budgetAllocationId),
      columns: { id: true, activityName: true, plannedAmount: true },
    });

    if (!budgetAllocation) {
      return null;
    }

    const [spentRow] = await db
      .select({
        total: sql<number>`coalesce(sum(${expenditures.amount}), 0)`,
      })
      .from(expenditures)
      .where(eq(expenditures.budgetAllocationId, budgetAllocationId));

    const actualSpent = toRoundedNumber(spentRow?.total);
    const committedAmount = toRoundedNumber(commitmentRow?.total);
    const totalBudget = toRoundedNumber(budgetAllocation.plannedAmount);

    return {
      scope: "budget_allocation",
      projectId: project.id,
      projectName: project.name,
      budgetAllocationId: budgetAllocation.id,
      budgetAllocationName: budgetAllocation.activityName,
      totalBudget,
      actualSpent,
      committedAmount,
      availableAmount: totalBudget - actualSpent - committedAmount,
    };
  }

  const totalBudget = toRoundedNumber(project.totalBudget);
  const actualSpent = toRoundedNumber(project.spentBudget);
  const committedAmount = toRoundedNumber(commitmentRow?.total);

  return {
    scope: "project",
    projectId: project.id,
    projectName: project.name,
    budgetAllocationId: null,
    budgetAllocationName: null,
    totalBudget,
    actualSpent,
    committedAmount,
    availableAmount: totalBudget - actualSpent - committedAmount,
  };
}

export async function ensureProcurementBudgetAvailable(params: {
  projectId: string;
  budgetAllocationId?: string | null;
  amount: number;
  excludeRequestId?: string | null;
}) {
  const snapshot = await getProcurementBudgetSnapshot(params);
  if (!snapshot) {
    return {
      snapshot: null,
      isWithinBudget: false,
      remainingAfterAmount: null,
    };
  }

  const remainingAfterAmount = snapshot.availableAmount - Math.round(params.amount);
  return {
    snapshot,
    isWithinBudget: remainingAfterAmount >= 0,
    remainingAfterAmount,
  };
}

export async function syncProcurementRequestFinancials(procurementRequestId: string) {
  const procurementRequest = await db.query.procurementRequests.findFirst({
    where: eq(procurementRequests.id, procurementRequestId),
    with: {
      purchaseOrder: true,
      invoices: true,
    },
  });

  if (!procurementRequest) {
    return null;
  }

  const isCommitmentStage = ACTIVE_COMMITMENT_STATUSES.includes(procurementRequest.status as (typeof ACTIVE_COMMITMENT_STATUSES)[number]);
  const committedAmount = isCommitmentStage
    ? toRoundedNumber(
        procurementRequest.purchaseOrder?.amount
        ?? procurementRequest.approvedAmount
        ?? procurementRequest.estimatedAmount
      )
    : 0;

  const activeInvoices = procurementRequest.invoices.filter((invoice) => invoice.status !== "rejected");
  const invoicedAmount = activeInvoices.reduce((sum, invoice) => sum + toRoundedNumber(invoice.amount), 0);
  const paidAmount = activeInvoices
    .filter((invoice) => invoice.paymentStatus === "paid")
    .reduce((sum, invoice) => sum + toRoundedNumber(invoice.amount), 0);

  const nextStatus =
    paidAmount > 0 && paidAmount >= Math.max(invoicedAmount, committedAmount)
      ? "paid"
      : invoicedAmount > 0
        ? "invoiced"
        : procurementRequest.status;

  const [updatedRequest] = await db
    .update(procurementRequests)
    .set({
      committedAmount,
      invoicedAmount,
      paidAmount,
      status: nextStatus,
      invoicedAt: invoicedAmount > 0 ? procurementRequest.invoicedAt ?? new Date() : procurementRequest.invoicedAt,
      paidAt: nextStatus === "paid" ? procurementRequest.paidAt ?? new Date() : procurementRequest.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(procurementRequests.id, procurementRequestId))
    .returning();

  return updatedRequest ?? null;
}

export async function postSupplierInvoiceToFinancials(params: {
  invoiceId: string;
  actorUserId: string;
  markAsPaid?: boolean;
  paymentReference?: string | null;
  paymentDate?: Date | null;
}) {
  const { invoiceId, actorUserId, markAsPaid = false, paymentReference, paymentDate } = params;

  const invoice = await db.query.supplierInvoices.findFirst({
    where: eq(supplierInvoices.id, invoiceId),
    with: {
      procurementRequest: {
        with: {
          project: {
            columns: { id: true, donorId: true },
          },
        },
      },
    },
  });

  if (!invoice) {
    return null;
  }

  let expenditureId = invoice.linkedExpenditureId;
  let disbursementId = invoice.linkedDisbursementId;

  if (!expenditureId) {
    const [newExpenditure] = await db
      .insert(expenditures)
      .values({
        projectId: invoice.procurementRequest.projectId,
        budgetAllocationId: invoice.procurementRequest.budgetAllocationId,
        taskId: invoice.procurementRequest.taskId,
        donorId: invoice.procurementRequest.project?.donorId ?? null,
        activityName: invoice.procurementRequest.title,
        amount: Math.round(invoice.amount),
        expenditureDate: invoice.invoiceDate,
        description: `Supplier invoice ${invoice.invoiceNumber} for ${invoice.procurementRequest.requestNumber}`,
        createdBy: actorUserId,
      })
      .returning();

    expenditureId = newExpenditure.id;

    await db
      .update(projects)
      .set({
        spentBudget: sql`COALESCE(${projects.spentBudget}, 0) + ${Math.round(invoice.amount)}`,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, invoice.procurementRequest.projectId));
  }

  if (markAsPaid && !disbursementId) {
    const [newDisbursement] = await db
      .insert(disbursementLogs)
      .values({
        projectId: invoice.procurementRequest.projectId,
        donorId: invoice.procurementRequest.project?.donorId ?? null,
        budgetAllocationId: invoice.procurementRequest.budgetAllocationId,
        expenditureId,
        activityName: invoice.procurementRequest.title,
        amount: Math.round(invoice.amount),
        disbursedAt: paymentDate ?? new Date(),
        reference: paymentReference ?? null,
        notes: `Payment recorded for supplier invoice ${invoice.invoiceNumber}`,
        createdBy: actorUserId,
      })
      .returning();

    disbursementId = newDisbursement.id;
  }

  const [updatedInvoice] = await db
    .update(supplierInvoices)
    .set({
      linkedExpenditureId: expenditureId,
      linkedDisbursementId: disbursementId ?? null,
      status: markAsPaid ? "paid" : "approved",
      paymentStatus: markAsPaid ? "paid" : invoice.paymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(supplierInvoices.id, invoiceId))
    .returning();

  await syncProcurementRequestFinancials(invoice.procurementRequestId);

  return updatedInvoice ?? null;
}
