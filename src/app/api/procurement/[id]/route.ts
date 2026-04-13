import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  budgetAllocations,
  db,
  procurementRequestItems,
  procurementRequests,
  projects,
  tasks,
  vendors,
} from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, canAccessProject, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getAdminUserIds, notifyUsers } from "@/lib/notifications";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { ensureProcurementBudgetAvailable, syncProcurementRequestFinancials } from "@/lib/procurement-finance";
import { getRequiredProcurementApprovalRole } from "@/lib/procurement-approval";
import {
  buildProcurementLookupText,
  isAllowedProcurementTransition,
  isProcurementMethod,
  isProcurementRequestType,
  isProcurementStatus,
  normalizeOptionalText,
  toRoundedAmount,
} from "@/lib/procurement";

type NormalizedLineItem = {
  description: string;
  specification: string | null;
  category: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
};

function normalizeLineItems(value: unknown): NormalizedLineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const description = typeof item.description === "string" ? item.description.trim() : "";
      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)));
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice ?? 0)));
      const totalPrice = Math.max(
        0,
        Math.round(Number(item.totalPrice ?? quantity * unitPrice))
      );

      if (!description) {
        return null;
      }

      return {
        description,
        specification: typeof item.specification === "string" ? item.specification.trim() || null : null,
        category: typeof item.category === "string" ? item.category.trim() || null : null,
        quantity,
        unit: typeof item.unit === "string" ? item.unit.trim() || null : null,
        unitPrice,
        totalPrice,
      };
    })
    .filter((item): item is NormalizedLineItem => item !== null);
}

async function getApprovalRecipients(projectId: string, amount: number, requesterId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, name: true, managerId: true },
  });

  if (!project) {
    return { project: null, recipientIds: [] as string[] };
  }

  const requiredRole = getRequiredProcurementApprovalRole(amount);
  if (requiredRole === "project_manager" && project.managerId && project.managerId !== requesterId) {
    return {
      project,
      recipientIds: [project.managerId],
    };
  }

  const adminIds = await getAdminUserIds();
  return {
    project,
    recipientIds: adminIds.filter((userId) => userId !== requesterId),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const hasAccess = await canAccessProcurementRequest(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const detail = await getProcurementRequestWithRelations(id);
    if (!detail) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("Error fetching procurement request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
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

    const existingRequest = await db.query.procurementRequests.findFirst({
      where: eq(procurementRequests.id, id),
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const body = await request.json();
    const nextProjectId = normalizeOptionalText(body.projectId) ?? existingRequest.projectId;

    if (nextProjectId !== existingRequest.projectId && existingRequest.status !== "draft") {
      return NextResponse.json({ error: "Project can only be changed while the request is in draft" }, { status: 400 });
    }

    if (nextProjectId !== existingRequest.projectId) {
      const canUseProject = await canAccessProject(session.user, nextProjectId);
      if (!canUseProject) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const budgetAllocationId = normalizeOptionalText(body.budgetAllocationId)
      ?? (Object.prototype.hasOwnProperty.call(body, "budgetAllocationId") ? null : existingRequest.budgetAllocationId);
    if (budgetAllocationId) {
      const budgetAllocation = await db.query.budgetAllocations.findFirst({
        where: eq(budgetAllocations.id, budgetAllocationId),
        columns: { id: true, projectId: true },
      });

      if (!budgetAllocation || budgetAllocation.projectId !== nextProjectId) {
        return NextResponse.json({ error: "Budget allocation not found for the selected project" }, { status: 404 });
      }
    }

    const taskId = normalizeOptionalText(body.taskId)
      ?? (Object.prototype.hasOwnProperty.call(body, "taskId") ? null : existingRequest.taskId);
    if (taskId) {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        columns: { id: true, projectId: true },
      });

      if (!task || task.projectId !== nextProjectId) {
        return NextResponse.json({ error: "Task not found for the selected project" }, { status: 404 });
      }
    }

    const selectedVendorId = normalizeOptionalText(body.selectedVendorId)
      ?? (Object.prototype.hasOwnProperty.call(body, "selectedVendorId") ? null : existingRequest.selectedVendorId);
    if (selectedVendorId) {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, selectedVendorId),
        columns: { id: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
    }

    const estimatedAmount = Object.prototype.hasOwnProperty.call(body, "estimatedAmount")
      ? toRoundedAmount(body.estimatedAmount)
      : existingRequest.estimatedAmount;
    if (estimatedAmount === null || estimatedAmount <= 0) {
      return NextResponse.json({ error: "estimatedAmount must be a positive number" }, { status: 400 });
    }

    if (existingRequest.status !== "draft" && existingRequest.status !== "submitted") {
      const budgetCheck = await ensureProcurementBudgetAvailable({
        projectId: nextProjectId,
        budgetAllocationId,
        amount: estimatedAmount,
        excludeRequestId: id,
      });

      if (!budgetCheck.isWithinBudget) {
        return NextResponse.json(
          {
            error: "The updated amount exceeds the available budget for this request",
            budgetSnapshot: budgetCheck.snapshot,
            remainingAfterAmount: budgetCheck.remainingAfterAmount,
          },
          { status: 400 }
        );
      }
    }

    const statusInput = typeof body.status === "string" ? body.status : null;
    let nextStatus = existingRequest.status;
    let nextApprovalStatus = existingRequest.approvalStatus;
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (statusInput && statusInput !== existingRequest.status) {
      if (!isProcurementStatus(statusInput)) {
        return NextResponse.json({ error: "Invalid procurement status" }, { status: 400 });
      }

      if (statusInput === "approved" || statusInput === "rejected") {
        return NextResponse.json(
          { error: "Approval decisions must be made via the approval endpoint" },
          { status: 400 }
        );
      }

      if (!isAllowedProcurementTransition(existingRequest.status, statusInput)) {
        return NextResponse.json(
          { error: `Cannot move request from ${existingRequest.status} to ${statusInput}` },
          { status: 400 }
        );
      }

      if (statusInput === "rfq_open" && existingRequest.approvalStatus !== "approved") {
        return NextResponse.json(
          { error: "Request must be approved before opening the quotation stage" },
          { status: 400 }
        );
      }

      nextStatus = statusInput;
      updateData.status = statusInput;

      if (statusInput === "submitted") {
        nextApprovalStatus = "pending";
        updateData.approvalStatus = "pending";
        updateData.submittedAt = new Date();
        updateData.rejectionReason = null;
      }

      if (statusInput === "cancelled") {
        updateData.cancelledAt = new Date();
      }
    }

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      updateData.title = title;
    }

    if (typeof body.description === "string" || body.description === null) {
      updateData.description = normalizeOptionalText(body.description);
    }

    if (typeof body.justification === "string" || body.justification === null) {
      updateData.justification = normalizeOptionalText(body.justification);
    }

    if (typeof body.notes === "string" || body.notes === null) {
      updateData.notes = normalizeOptionalText(body.notes);
    }

    if (typeof body.priority === "string" && body.priority.trim()) {
      updateData.priority = body.priority.trim();
    }

    if (typeof body.requestType === "string") {
      if (!isProcurementRequestType(body.requestType)) {
        return NextResponse.json({ error: "Invalid procurement request type" }, { status: 400 });
      }
      updateData.requestType = body.requestType;
    }

    if (typeof body.procurementMethod === "string") {
      if (!isProcurementMethod(body.procurementMethod)) {
        return NextResponse.json({ error: "Invalid procurement method" }, { status: 400 });
      }
      updateData.procurementMethod = body.procurementMethod;
    }

    if (typeof body.currency === "string" && body.currency.trim()) {
      updateData.currency = body.currency.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "neededByDate")) {
      const neededByDate = normalizeOptionalText(body.neededByDate);
      if (!neededByDate) {
        updateData.neededByDate = null;
      } else {
        const parsedNeededByDate = new Date(neededByDate);
        if (Number.isNaN(parsedNeededByDate.getTime())) {
          return NextResponse.json({ error: "neededByDate must be a valid date" }, { status: 400 });
        }
        updateData.neededByDate = parsedNeededByDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "procurementOfficerId")) {
      updateData.procurementOfficerId = normalizeOptionalText(body.procurementOfficerId);
    }

    updateData.projectId = nextProjectId;
    updateData.budgetAllocationId = budgetAllocationId;
    updateData.taskId = taskId;
    updateData.selectedVendorId = selectedVendorId;
    updateData.estimatedAmount = estimatedAmount;

    const titleForLookup = typeof updateData.title === "string" ? updateData.title : existingRequest.title;
    const descriptionForLookup =
      Object.prototype.hasOwnProperty.call(updateData, "description")
        ? (updateData.description as string | null)
        : existingRequest.description;
    const justificationForLookup =
      Object.prototype.hasOwnProperty.call(updateData, "justification")
        ? (updateData.justification as string | null)
        : existingRequest.justification;
    const notesForLookup =
      Object.prototype.hasOwnProperty.call(updateData, "notes")
        ? (updateData.notes as string | null)
        : existingRequest.notes;

    updateData.lookupText = buildProcurementLookupText({
      requestNumber: existingRequest.requestNumber,
      title: titleForLookup,
      description: descriptionForLookup,
      justification: justificationForLookup,
      notes: notesForLookup,
    });

    const lineItems = Object.prototype.hasOwnProperty.call(body, "lineItems")
      ? normalizeLineItems(body.lineItems)
      : null;

    const updatedRequest = await db.transaction(async (tx) => {
      if (lineItems !== null) {
        await tx
          .delete(procurementRequestItems)
          .where(eq(procurementRequestItems.procurementRequestId, id));

        if (lineItems.length > 0) {
          await tx.insert(procurementRequestItems).values(
            lineItems.map((item) => ({
              procurementRequestId: id,
              ...item,
            }))
          );
        }
      }

      const [updatedRow] = await tx
        .update(procurementRequests)
        .set(updateData)
        .where(eq(procurementRequests.id, id))
        .returning();

      return updatedRow;
    });

    if (!updatedRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "procurement_request",
      entityId: id,
      changes: { before: existingRequest, after: updatedRequest },
      request,
    });

    if (nextStatus === "submitted" && nextApprovalStatus === "pending") {
      const { project, recipientIds } = await getApprovalRecipients(nextProjectId, estimatedAmount, session.userId);
      if (project && recipientIds.length > 0) {
        await notifyUsers(recipientIds, {
          type: "approval_pending",
          title: "Procurement approval pending",
          message: `${existingRequest.requestNumber} for ${project.name} is awaiting approval.`,
          entityType: "procurement_request",
          entityId: id,
          sendEmail: true,
        });
      }
    }

    await syncProcurementRequestFinancials(id);

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail);
  } catch (error) {
    console.error("Error updating procurement request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existingRequest = await db.query.procurementRequests.findFirst({
      where: eq(procurementRequests.id, id),
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (!["draft", "cancelled", "rejected"].includes(existingRequest.status)) {
      return NextResponse.json(
        { error: "Only draft, cancelled, or rejected requests can be deleted" },
        { status: 400 }
      );
    }

    await db.delete(procurementRequests).where(eq(procurementRequests.id, id));

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "procurement_request",
      entityId: id,
      changes: { before: existingRequest },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting procurement request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
