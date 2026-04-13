import "server-only";

import { eq } from "drizzle-orm";
import { db, procurementRequests } from "@/db";
import {
  getProcurementApprovalLabel,
  getRequiredProcurementApprovalRole,
  getRequiredProcurementApprovalThreshold,
} from "@/lib/procurement-approval";
import { getProcurementBudgetSnapshot } from "@/lib/procurement-finance";

export async function getProcurementRequestWithRelations(procurementRequestId: string) {
  const procurementRequest = await db.query.procurementRequests.findFirst({
    where: eq(procurementRequests.id, procurementRequestId),
    with: {
      project: {
        columns: { id: true, name: true, donorId: true, totalBudget: true, spentBudget: true },
      },
      budgetAllocation: {
        columns: { id: true, activityName: true, plannedAmount: true },
      },
      task: {
        columns: { id: true, title: true, status: true },
      },
      requester: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      procurementOfficer: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      selectedVendor: {
        columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
      },
      lineItems: {
        orderBy: (items, { asc }) => [asc(items.createdAt)],
      },
      quotations: {
        with: {
          vendor: {
            columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
          },
          creator: {
            columns: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: (quotations, { desc }) => [desc(quotations.createdAt)],
      },
      purchaseOrder: {
        with: {
          vendor: {
            columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
          },
          creator: {
            columns: { id: true, firstName: true, lastName: true },
          },
        },
      },
      receipts: {
        with: {
          receiver: {
            columns: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: (receipts, { desc }) => [desc(receipts.receivedAt), desc(receipts.createdAt)],
      },
      invoices: {
        with: {
          vendor: {
            columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
          },
          creator: {
            columns: { id: true, firstName: true, lastName: true },
          },
          linkedExpenditure: {
            columns: { id: true, amount: true, expenditureDate: true },
          },
          linkedDisbursement: {
            columns: { id: true, amount: true, disbursedAt: true, reference: true },
          },
        },
        orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
      },
      documents: {
        with: {
          uploader: {
            columns: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: (documents, { desc }) => [desc(documents.createdAt)],
      },
      approvals: {
        with: {
          approver: {
            columns: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: (approvals, { desc }) => [desc(approvals.decidedAt)],
      },
    },
  });

  if (!procurementRequest) {
    return null;
  }

  const budgetSnapshot = await getProcurementBudgetSnapshot({
    projectId: procurementRequest.projectId,
    budgetAllocationId: procurementRequest.budgetAllocationId,
    excludeRequestId: procurementRequest.id,
  });
  const approvalRole = getRequiredProcurementApprovalRole(procurementRequest.estimatedAmount);
  const approvalThreshold = getRequiredProcurementApprovalThreshold(procurementRequest.estimatedAmount);

  return {
    procurementRequest,
    budgetSnapshot,
    approvalRule: {
      requiredRole: approvalRole,
      thresholdAmount: approvalThreshold,
      label: getProcurementApprovalLabel(procurementRequest.estimatedAmount),
    },
  };
}
