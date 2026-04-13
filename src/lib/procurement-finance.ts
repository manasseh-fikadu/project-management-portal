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

type ProcurementFinanceExecutor = Pick<typeof db, "select" | "update" | "execute">;

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

async function lockProcurementBudgetScope(
  executor: ProcurementFinanceExecutor,
  params: { projectId: string; budgetAllocationId?: string | null }
) {
  await executor.execute(
    sql`SELECT ${projects.id} FROM ${projects} WHERE ${projects.id} = ${params.projectId} FOR UPDATE`
  );

  if (params.budgetAllocationId) {
    await executor.execute(
      sql`SELECT ${budgetAllocations.id} FROM ${budgetAllocations} WHERE ${budgetAllocations.id} = ${params.budgetAllocationId} FOR UPDATE`
    );
  }
}

export async function getProcurementBudgetSnapshot(params: {
  projectId: string;
  budgetAllocationId?: string | null;
  excludeRequestId?: string | null;
  executor?: ProcurementFinanceExecutor;
  lockBudgetScope?: boolean;
}): Promise<ProcurementBudgetSnapshot | null> {
  const {
    projectId,
    budgetAllocationId,
    excludeRequestId,
    executor = db,
    lockBudgetScope = false,
  } = params;

  if (lockBudgetScope) {
    await lockProcurementBudgetScope(executor, { projectId, budgetAllocationId });
  }

  const [project] = await executor
    .select({
      id: projects.id,
      name: projects.name,
      totalBudget: projects.totalBudget,
      spentBudget: projects.spentBudget,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return null;
  }

  const commitmentFilters = [
    eq(procurementRequests.projectId, projectId),
    notInArray(procurementRequests.status, [...EXCLUDED_COMMITMENT_STATUSES]),
    budgetAllocationId ? eq(procurementRequests.budgetAllocationId, budgetAllocationId) : undefined,
    excludeRequestId ? ne(procurementRequests.id, excludeRequestId) : undefined,
  ].filter(Boolean);

  const [commitmentRow] = await executor
    .select({
      total: sql<number>`coalesce(sum(${procurementRequests.committedAmount}), 0)`,
    })
    .from(procurementRequests)
    .where(and(...commitmentFilters));

  if (budgetAllocationId) {
    const [budgetAllocation] = await executor
      .select({
        id: budgetAllocations.id,
        activityName: budgetAllocations.activityName,
        plannedAmount: budgetAllocations.plannedAmount,
      })
      .from(budgetAllocations)
      .where(eq(budgetAllocations.id, budgetAllocationId))
      .limit(1);

    if (!budgetAllocation) {
      return null;
    }

    const [spentRow] = await executor
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
  executor?: ProcurementFinanceExecutor;
  lockBudgetScope?: boolean;
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

export async function syncProcurementRequestFinancials(
  procurementRequestId: string,
  options: { executor?: ProcurementFinanceExecutor } = {}
) {
  const executor = options.executor ?? db;
  const [procurementRequest] = await executor
    .select({
      id: procurementRequests.id,
      status: procurementRequests.status,
      approvedAmount: procurementRequests.approvedAmount,
      estimatedAmount: procurementRequests.estimatedAmount,
      invoicedAt: procurementRequests.invoicedAt,
      paidAt: procurementRequests.paidAt,
    })
    .from(procurementRequests)
    .where(eq(procurementRequests.id, procurementRequestId))
    .limit(1);

  if (!procurementRequest) {
    return null;
  }

  const [purchaseOrder] = await executor
    .select({
      amount: purchaseOrders.amount,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.procurementRequestId, procurementRequestId))
    .limit(1);

  const invoiceRows = await executor
    .select({
      amount: supplierInvoices.amount,
      status: supplierInvoices.status,
      paymentStatus: supplierInvoices.paymentStatus,
    })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.procurementRequestId, procurementRequestId));

  const isCommitmentStage = ACTIVE_COMMITMENT_STATUSES.includes(procurementRequest.status as (typeof ACTIVE_COMMITMENT_STATUSES)[number]);
  const committedAmount = isCommitmentStage
    ? toRoundedNumber(
        purchaseOrder?.amount
        ?? procurementRequest.approvedAmount
        ?? procurementRequest.estimatedAmount
      )
    : 0;

  const activeInvoices = invoiceRows.filter((invoice) => invoice.status !== "rejected");
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

  const [updatedRequest] = await executor
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

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT ${supplierInvoices.id} FROM ${supplierInvoices} WHERE ${supplierInvoices.id} = ${invoiceId} FOR UPDATE`
    );

    const [invoice] = await tx
      .select({
        id: supplierInvoices.id,
        procurementRequestId: supplierInvoices.procurementRequestId,
        linkedExpenditureId: supplierInvoices.linkedExpenditureId,
        linkedDisbursementId: supplierInvoices.linkedDisbursementId,
        invoiceNumber: supplierInvoices.invoiceNumber,
        amount: supplierInvoices.amount,
        invoiceDate: supplierInvoices.invoiceDate,
        paymentStatus: supplierInvoices.paymentStatus,
        projectId: procurementRequests.projectId,
        budgetAllocationId: procurementRequests.budgetAllocationId,
        taskId: procurementRequests.taskId,
        requestTitle: procurementRequests.title,
        requestNumber: procurementRequests.requestNumber,
        donorId: projects.donorId,
      })
      .from(supplierInvoices)
      .innerJoin(procurementRequests, eq(procurementRequests.id, supplierInvoices.procurementRequestId))
      .leftJoin(projects, eq(projects.id, procurementRequests.projectId))
      .where(eq(supplierInvoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return null;
    }

    let expenditureId = invoice.linkedExpenditureId;
    let disbursementId = invoice.linkedDisbursementId;

    if (!expenditureId) {
      const [newExpenditure] = await tx
        .insert(expenditures)
        .values({
          projectId: invoice.projectId,
          budgetAllocationId: invoice.budgetAllocationId,
          taskId: invoice.taskId,
          donorId: invoice.donorId ?? null,
          activityName: invoice.requestTitle,
          amount: Math.round(invoice.amount),
          expenditureDate: invoice.invoiceDate,
          description: `Supplier invoice ${invoice.invoiceNumber} for ${invoice.requestNumber}`,
          createdBy: actorUserId,
        })
        .returning();

      expenditureId = newExpenditure.id;

      await tx
        .update(projects)
        .set({
          spentBudget: sql`COALESCE(${projects.spentBudget}, 0) + ${Math.round(invoice.amount)}`,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, invoice.projectId));
    }

    if (markAsPaid && !disbursementId) {
      const [newDisbursement] = await tx
        .insert(disbursementLogs)
        .values({
          projectId: invoice.projectId,
          donorId: invoice.donorId ?? null,
          budgetAllocationId: invoice.budgetAllocationId,
          expenditureId,
          activityName: invoice.requestTitle,
          amount: Math.round(invoice.amount),
          disbursedAt: paymentDate ?? new Date(),
          reference: paymentReference ?? null,
          notes: `Payment recorded for supplier invoice ${invoice.invoiceNumber}`,
          createdBy: actorUserId,
        })
        .returning();

      disbursementId = newDisbursement.id;
    }

    const [updatedInvoice] = await tx
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

    await syncProcurementRequestFinancials(invoice.procurementRequestId, { executor: tx });

    return updatedInvoice ?? null;
  });
}
