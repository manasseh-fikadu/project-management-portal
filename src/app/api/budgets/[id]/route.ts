import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, tasks } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { buildBudgetLineTaskDescription, buildBudgetLineTaskTitle } from "@/lib/budget-line-tasks";

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
    const existingBudgetAllocation = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, id),
      with: {
        task: true,
      },
    });

    if (!existingBudgetAllocation) {
      return NextResponse.json({ error: "Budget allocation not found" }, { status: 404 });
    }

    const hasAccess = await canAccessProject(session.user, existingBudgetAllocation.projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Budget allocation not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.activityName === "string" && body.activityName.trim()) {
      updateData.activityName = body.activityName.trim();
    }

    if (body.plannedAmount !== undefined) {
      const plannedAmount = Math.round(Number(body.plannedAmount));
      if (!Number.isFinite(plannedAmount) || plannedAmount <= 0) {
        return NextResponse.json({ error: "plannedAmount must be a positive number" }, { status: 400 });
      }
      updateData.plannedAmount = plannedAmount;
    }

    for (const [key, rawValue] of [
      ["q1Amount", body.q1Amount],
      ["q2Amount", body.q2Amount],
      ["q3Amount", body.q3Amount],
      ["q4Amount", body.q4Amount],
    ] as const) {
      if (rawValue === undefined) continue;
      const value = Math.round(Number(rawValue));
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ error: `${key} must be zero or a positive number` }, { status: 400 });
      }
      updateData[key] = value;
    }

    if (body.assignedTo === null || typeof body.assignedTo === "string") {
      updateData.assignedTo = body.assignedTo || null;
    }

    const plannedAmount = typeof updateData.plannedAmount === "number"
      ? updateData.plannedAmount
      : existingBudgetAllocation.plannedAmount;
    const q1Amount = typeof updateData.q1Amount === "number"
      ? updateData.q1Amount
      : existingBudgetAllocation.q1Amount;
    const q2Amount = typeof updateData.q2Amount === "number"
      ? updateData.q2Amount
      : existingBudgetAllocation.q2Amount;
    const q3Amount = typeof updateData.q3Amount === "number"
      ? updateData.q3Amount
      : existingBudgetAllocation.q3Amount;
    const q4Amount = typeof updateData.q4Amount === "number"
      ? updateData.q4Amount
      : existingBudgetAllocation.q4Amount;

    if (q1Amount + q2Amount + q3Amount + q4Amount > plannedAmount) {
      return NextResponse.json(
        { error: "Rounded quarter amounts cannot exceed the rounded planned amount" },
        { status: 400 }
      );
    }

    const [updatedBudgetAllocation] = await db
      .update(budgetAllocations)
      .set(updateData)
      .where(eq(budgetAllocations.id, id))
      .returning();

    const taskPayload = {
      title: buildBudgetLineTaskTitle(updatedBudgetAllocation.activityName),
      description: buildBudgetLineTaskDescription(updatedBudgetAllocation.notes),
      assignedTo: updatedBudgetAllocation.assignedTo ?? null,
      updatedAt: new Date(),
    };

    if (existingBudgetAllocation.task) {
      await db
        .update(tasks)
        .set(taskPayload)
        .where(eq(tasks.id, existingBudgetAllocation.task.id));
    } else {
      await db.insert(tasks).values({
        projectId: updatedBudgetAllocation.projectId,
        budgetAllocationId: updatedBudgetAllocation.id,
        title: taskPayload.title,
        description: taskPayload.description,
        assignedTo: taskPayload.assignedTo,
        createdBy: session.userId,
      });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "budget_allocation",
      entityId: id,
      changes: { before: existingBudgetAllocation, after: updatedBudgetAllocation },
      request,
    });

    const budgetAllocationWithRelations = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, id),
      with: {
        assignee: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        task: {
          columns: { id: true, title: true, status: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
        project: {
          columns: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ budgetAllocation: budgetAllocationWithRelations });
  } catch (error) {
    console.error("Error updating budget allocation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
