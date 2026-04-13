import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, procurementApprovals, procurementRequests, projects } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import {
  canUserApproveProcurement,
  getRequiredProcurementApprovalRole,
  getRequiredProcurementApprovalThreshold,
} from "@/lib/procurement-approval";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { ensureProcurementBudgetAvailable, syncProcurementRequestFinancials } from "@/lib/procurement-finance";
import { toRoundedAmount } from "@/lib/procurement";

class ProcurementApprovalError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Procurement approval failed");
    this.status = status;
    this.body = body;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const hasAccess = await canAccessProcurementRequest(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const body = await request.json();
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    const comments = typeof body.comments === "string" ? body.comments.trim() || null : null;
    const rawApprovedAmount = body.approvedAmount;

    const approvalResult = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${procurementRequests.id} FROM ${procurementRequests} WHERE ${procurementRequests.id} = ${id} FOR UPDATE`
      );

      const [procurementRequest] = await tx
        .select({
          id: procurementRequests.id,
          requestNumber: procurementRequests.requestNumber,
          estimatedAmount: procurementRequests.estimatedAmount,
          approvedAmount: procurementRequests.approvedAmount,
          approvedAt: procurementRequests.approvedAt,
          status: procurementRequests.status,
          approvalStatus: procurementRequests.approvalStatus,
          projectId: procurementRequests.projectId,
          budgetAllocationId: procurementRequests.budgetAllocationId,
          requesterId: procurementRequests.requesterId,
          projectName: projects.name,
        })
        .from(procurementRequests)
        .leftJoin(projects, eq(procurementRequests.projectId, projects.id))
        .where(eq(procurementRequests.id, id))
        .limit(1);

      if (!procurementRequest) {
        throw new ProcurementApprovalError(404, { error: "Procurement request not found" });
      }

      if (procurementRequest.status !== "submitted" || procurementRequest.approvalStatus !== "pending") {
        throw new ProcurementApprovalError(400, {
          error: "Only submitted requests awaiting approval can be approved or rejected",
        });
      }

      const approvedAmount = toRoundedAmount(
        rawApprovedAmount ?? procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount
      );

      if (decision === "approved" && (approvedAmount === null || approvedAmount <= 0)) {
        throw new ProcurementApprovalError(400, { error: "approvedAmount must be a positive number" });
      }

      const approvalCheckAmount = approvedAmount ?? procurementRequest.estimatedAmount;

      if (!canUserApproveProcurement(session.user.role, approvalCheckAmount)) {
        throw new ProcurementApprovalError(403, {
          error: `This request requires ${getRequiredProcurementApprovalRole(approvalCheckAmount)} approval`,
        });
      }

      const approvalMetadataAmount =
        decision === "approved" ? approvalCheckAmount : procurementRequest.estimatedAmount;

      if (decision === "approved") {
        const approvedDecisionAmount = approvedAmount;
        if (approvedDecisionAmount === null) {
          throw new ProcurementApprovalError(400, { error: "approvedAmount must be a positive number" });
        }

        const budgetCheck = await ensureProcurementBudgetAvailable({
          projectId: procurementRequest.projectId,
          budgetAllocationId: procurementRequest.budgetAllocationId,
          amount: approvedDecisionAmount,
          excludeRequestId: id,
          executor: tx,
          lockBudgetScope: true,
        });

        if (!budgetCheck.isWithinBudget) {
          throw new ProcurementApprovalError(400, {
            error: "The approved amount exceeds the available budget for this request",
            budgetSnapshot: budgetCheck.snapshot,
            remainingAfterAmount: budgetCheck.remainingAfterAmount,
          });
        }
      }

      const [approvalRecord] = await tx
        .insert(procurementApprovals)
        .values({
          procurementRequestId: id,
          approverId: session.userId,
          requiredRole: getRequiredProcurementApprovalRole(approvalMetadataAmount),
          decision,
          thresholdAmount: getRequiredProcurementApprovalThreshold(approvalMetadataAmount),
          comments,
        })
        .returning();

      const [updatedRequest] = await tx
        .update(procurementRequests)
        .set({
          approvalStatus: decision === "approved" ? "approved" : "rejected",
          status: decision === "approved" ? "approved" : "rejected",
          approvedAmount: decision === "approved" ? approvedAmount : procurementRequest.approvedAmount,
          approvedAt: decision === "approved" ? new Date() : procurementRequest.approvedAt,
          rejectionReason: decision === "rejected" ? comments : null,
          updatedAt: new Date(),
        })
        .where(eq(procurementRequests.id, id))
        .returning();

      await syncProcurementRequestFinancials(id, { executor: tx });

      await logAuditEvent({
        actorUserId: session.userId,
        action: "update",
        entityType: "procurement_request_approval",
        entityId: approvalRecord.id,
        changes: { after: approvalRecord, procurementRequestId: id, decision, updatedRequest },
        request,
        executor: tx,
      });

      return {
        requesterId: procurementRequest.requesterId,
        requestNumber: procurementRequest.requestNumber,
        projectName: procurementRequest.projectName,
      };
    });

    await createNotification({
      userId: approvalResult.requesterId,
      type: "approval_decision",
      title: decision === "approved" ? "Procurement request approved" : "Procurement request rejected",
      message:
        decision === "approved"
          ? `${approvalResult.requestNumber} has been approved for ${approvalResult.projectName ?? "the selected project"}.`
          : `${approvalResult.requestNumber} has been rejected.${comments ? ` Reason: ${comments}` : ""}`,
      entityType: "procurement_request",
      entityId: id,
      sendEmail: true,
    });

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof ProcurementApprovalError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error processing procurement approval:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
