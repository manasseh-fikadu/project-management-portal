import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, procurementApprovals, procurementRequests } from "@/db";
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

    const procurementRequest = await db.query.procurementRequests.findFirst({
      where: eq(procurementRequests.id, id),
      with: {
        project: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (procurementRequest.status !== "submitted" || procurementRequest.approvalStatus !== "pending") {
      return NextResponse.json(
        { error: "Only submitted requests awaiting approval can be approved or rejected" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    const comments = typeof body.comments === "string" ? body.comments.trim() || null : null;
    const approvedAmount = toRoundedAmount(
      body.approvedAmount ?? procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount
    );

    if (!canUserApproveProcurement(session.user.role, procurementRequest.estimatedAmount)) {
      return NextResponse.json(
        {
          error: `This request requires ${getRequiredProcurementApprovalRole(procurementRequest.estimatedAmount)} approval`,
        },
        { status: 403 }
      );
    }

    if (decision === "approved") {
      if (approvedAmount === null || approvedAmount <= 0) {
        return NextResponse.json({ error: "approvedAmount must be a positive number" }, { status: 400 });
      }

      const budgetCheck = await ensureProcurementBudgetAvailable({
        projectId: procurementRequest.projectId,
        budgetAllocationId: procurementRequest.budgetAllocationId,
        amount: approvedAmount,
        excludeRequestId: id,
      });

      if (!budgetCheck.isWithinBudget) {
        return NextResponse.json(
          {
            error: "The approved amount exceeds the available budget for this request",
            budgetSnapshot: budgetCheck.snapshot,
            remainingAfterAmount: budgetCheck.remainingAfterAmount,
          },
          { status: 400 }
        );
      }
    }

    const [approvalRecord] = await db
      .insert(procurementApprovals)
      .values({
        procurementRequestId: id,
        approverId: session.userId,
        requiredRole: getRequiredProcurementApprovalRole(procurementRequest.estimatedAmount),
        decision,
        thresholdAmount: getRequiredProcurementApprovalThreshold(procurementRequest.estimatedAmount),
        comments,
      })
      .returning();

    const [updatedRequest] = await db
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

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "procurement_request_approval",
      entityId: approvalRecord.id,
      changes: { after: approvalRecord, procurementRequestId: id, decision, updatedRequest },
      request,
    });

    await createNotification({
      userId: procurementRequest.requesterId,
      type: "approval_decision",
      title: decision === "approved" ? "Procurement request approved" : "Procurement request rejected",
      message:
        decision === "approved"
          ? `${procurementRequest.requestNumber} has been approved for ${procurementRequest.project?.name ?? "the selected project"}.`
          : `${procurementRequest.requestNumber} has been rejected.${comments ? ` Reason: ${comments}` : ""}`,
      entityType: "procurement_request",
      entityId: id,
      sendEmail: true,
    });

    await syncProcurementRequestFinancials(id);

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Error processing procurement approval:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
