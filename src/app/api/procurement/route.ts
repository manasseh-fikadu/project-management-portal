import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import { canAccessProject, ensureEditAccess, getAccessibleProjectIds } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getAdminUserIds, notifyUsers } from "@/lib/notifications";
import {
  type ProcurementApprovalStatus,
  type ProcurementStatus,
  buildProcurementLookupText,
  generateProcurementRequestNumber,
  isProcurementMethod,
  isProcurementRequestType,
  normalizeOptionalText,
  toRoundedAmount,
} from "@/lib/procurement";
import { getRequiredProcurementApprovalRole } from "@/lib/procurement-approval";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";

type NormalizedLineItem = {
  description: string;
  specification: string | null;
  category: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  totalPrice: number;
};

const PROCUREMENT_REQUEST_NUMBER_MAX_ATTEMPTS = 3;

function isValidProcurementStatus(value: string): value is ProcurementStatus {
  return [
    "draft",
    "submitted",
    "approved",
    "rfq_open",
    "quotes_received",
    "po_issued",
    "partially_received",
    "received",
    "invoiced",
    "paid",
    "cancelled",
    "rejected",
  ].includes(value);
}

function isValidProcurementApprovalStatus(value: string): value is ProcurementApprovalStatus {
  return ["not_started", "pending", "approved", "rejected"].includes(value);
}

function isUniqueConstraintError(error: unknown, constraintName: string): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "23505"
    && "constraint" in error
    && error.constraint === constraintName
  );
}

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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const approvalStatus = searchParams.get("approvalStatus");
    const accessibleProjectIds = await getAccessibleProjectIds(session.user);

    if (projectId) {
      const hasAccess = await canAccessProject(session.user, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (accessibleProjectIds?.length === 0) {
      return NextResponse.json({ procurementRequests: [] });
    }

    if (status && !isValidProcurementStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (approvalStatus && !isValidProcurementApprovalStatus(approvalStatus)) {
      return NextResponse.json({ error: "Invalid approvalStatus" }, { status: 400 });
    }

    const validatedStatus: ProcurementStatus | null =
      status && isValidProcurementStatus(status) ? status : null;
    const validatedApprovalStatus: ProcurementApprovalStatus | null =
      approvalStatus && isValidProcurementApprovalStatus(approvalStatus) ? approvalStatus : null;

    const filters = [
      projectId ? eq(procurementRequests.projectId, projectId) : undefined,
      !projectId && accessibleProjectIds ? inArray(procurementRequests.projectId, accessibleProjectIds) : undefined,
      validatedStatus ? eq(procurementRequests.status, validatedStatus) : undefined,
      validatedApprovalStatus ? eq(procurementRequests.approvalStatus, validatedApprovalStatus) : undefined,
    ].filter(Boolean);

    const requestRows = await db.query.procurementRequests.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      with: {
        project: {
          columns: { id: true, name: true, totalBudget: true, spentBudget: true },
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
        selectedVendor: {
          columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
        },
      },
      orderBy: [desc(procurementRequests.createdAt)],
    });

    return NextResponse.json({ procurementRequests: requestRows });
  } catch (error) {
    console.error("Error fetching procurement requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const estimatedAmount = toRoundedAmount(body.estimatedAmount);

    if (!projectId || !title || estimatedAmount === null || estimatedAmount <= 0) {
      return NextResponse.json(
        { error: "projectId, title, and a positive estimatedAmount are required" },
        { status: 400 }
      );
    }

    const hasProjectAccess = await canAccessProject(session.user, projectId);
    if (!hasProjectAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const budgetAllocationId = normalizeOptionalText(body.budgetAllocationId);
    if (budgetAllocationId) {
      const budgetAllocation = await db.query.budgetAllocations.findFirst({
        where: eq(budgetAllocations.id, budgetAllocationId),
        columns: { id: true, projectId: true },
      });

      if (!budgetAllocation || budgetAllocation.projectId !== projectId) {
        return NextResponse.json({ error: "Budget allocation not found for the selected project" }, { status: 404 });
      }
    }

    const taskId = normalizeOptionalText(body.taskId);
    if (taskId) {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        columns: { id: true, projectId: true },
      });

      if (!task || task.projectId !== projectId) {
        return NextResponse.json({ error: "Task not found for the selected project" }, { status: 404 });
      }
    }

    const selectedVendorId = normalizeOptionalText(body.selectedVendorId);
    if (selectedVendorId) {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.id, selectedVendorId),
        columns: { id: true },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
    }

    const requestType = typeof body.requestType === "string" && isProcurementRequestType(body.requestType)
      ? body.requestType
      : "goods";
    const procurementMethod = typeof body.procurementMethod === "string" && isProcurementMethod(body.procurementMethod)
      ? body.procurementMethod
      : "request_for_quotation";
    const submitForApproval = body.submitForApproval === true;
    const lineItems = normalizeLineItems(body.lineItems);
    const description = normalizeOptionalText(body.description);
    const justification = normalizeOptionalText(body.justification);
    const notes = normalizeOptionalText(body.notes);
    const procurementOfficerId = normalizeOptionalText(body.procurementOfficerId);
    const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : "ETB";
    const neededByDate = normalizeOptionalText(body.neededByDate);
    const priority = typeof body.priority === "string" && body.priority.trim() ? body.priority.trim() : "medium";

    let createdRequest: typeof procurementRequests.$inferSelect | null = null;

    for (let attempt = 0; attempt < PROCUREMENT_REQUEST_NUMBER_MAX_ATTEMPTS; attempt += 1) {
      const requestNumber = generateProcurementRequestNumber();

      try {
        [createdRequest] = await db.transaction(async (tx) => {
          const [newRequest] = await tx
            .insert(procurementRequests)
            .values({
              requestNumber,
              title,
              description,
              justification,
              requestType,
              procurementMethod,
              status: submitForApproval ? "submitted" : "draft",
              approvalStatus: submitForApproval ? "pending" : "not_started",
              priority,
              currency,
              estimatedAmount,
              projectId,
              budgetAllocationId,
              taskId,
              requesterId: session.userId,
              procurementOfficerId,
              selectedVendorId,
              neededByDate: neededByDate ? new Date(neededByDate) : null,
              submittedAt: submitForApproval ? new Date() : null,
              notes,
              lookupText: buildProcurementLookupText({
                requestNumber,
                title,
                description,
                justification,
                notes,
              }),
            })
            .returning();

          if (lineItems.length > 0) {
            await tx.insert(procurementRequestItems).values(
              lineItems.map((item) => ({
                procurementRequestId: newRequest.id,
                ...item,
              }))
            );
          }

          await logAuditEvent({
            actorUserId: session.userId,
            action: "create",
            entityType: "procurement_request",
            entityId: newRequest.id,
            changes: { after: newRequest },
            request,
            executor: tx,
          });

          return [newRequest];
        });
        break;
      } catch (error) {
        if (
          isUniqueConstraintError(error, "procurement_requests_request_number_key")
          && attempt < PROCUREMENT_REQUEST_NUMBER_MAX_ATTEMPTS - 1
        ) {
          continue;
        }

        if (isUniqueConstraintError(error, "procurement_requests_request_number_key")) {
          console.error("Failed to generate a unique procurement request number:", error);
          return NextResponse.json(
            { error: "Unable to generate a unique procurement request number. Please try again." },
            { status: 500 }
          );
        }

        throw error;
      }
    }

    if (!createdRequest) {
      return NextResponse.json(
        { error: "Unable to generate a unique procurement request number. Please try again." },
        { status: 500 }
      );
    }

    if (submitForApproval) {
      try {
        const { project, recipientIds } = await getApprovalRecipients(projectId, estimatedAmount, session.userId);
        if (project && recipientIds.length > 0) {
          await notifyUsers(recipientIds, {
            type: "approval_pending",
            title: "Procurement approval pending",
            message: `${createdRequest.requestNumber} for ${project.name} is awaiting approval.`,
            entityType: "procurement_request",
            entityId: createdRequest.id,
            sendEmail: true,
          });
        }
      } catch (notificationError) {
        console.error("Error sending procurement approval notifications:", notificationError);
      }
    }

    const detail = await getProcurementRequestWithRelations(createdRequest.id);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    console.error("Error creating procurement request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
