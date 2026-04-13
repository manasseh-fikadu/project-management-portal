import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, tasks } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { buildBudgetLineTaskDescription, buildBudgetLineTaskTitle } from "@/lib/budget-line-tasks";
import { getActiveUserById } from "@/lib/users";

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
    const assignedToProvided = Object.prototype.hasOwnProperty.call(body, "assignedTo");

    if (typeof body.activityName === "string" && body.activityName.trim()) {
      updateData.activityName = body.activityName.trim();
    }

    if (typeof body.notes === "string") {
      updateData.notes = body.notes.trim();
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

    if (assignedToProvided) {
      if (body.assignedTo !== null && typeof body.assignedTo !== "string") {
        return NextResponse.json({ error: "assignedTo must be a valid user ID or null" }, { status: 400 });
      }

      const normalizedAssignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() || null : null;

      if (normalizedAssignedTo) {
        const assignedUser = await getActiveUserById(normalizedAssignedTo);
        if (!assignedUser) {
          return NextResponse.json({ error: "assignedTo must reference an active user" }, { status: 400 });
        }
      }

      updateData.assignedTo = normalizedAssignedTo;
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

    const [updatedBudgetAllocation] = await db.transaction(async (tx) => {
      const [nextBudgetAllocation] = await tx
        .update(budgetAllocations)
        .set(updateData)
        .where(eq(budgetAllocations.id, id))
        .returning();

      const taskValues = {
        projectId: nextBudgetAllocation.projectId,
        budgetAllocationId: nextBudgetAllocation.id,
        title: buildBudgetLineTaskTitle(nextBudgetAllocation.activityName),
        description: buildBudgetLineTaskDescription(nextBudgetAllocation.notes),
        assignedTo: nextBudgetAllocation.assignedTo ?? null,
        createdBy: session.userId,
      };

      await tx
        .insert(tasks)
        .values(taskValues)
        .onConflictDoUpdate({
          target: tasks.budgetAllocationId,
          set: {
            projectId: taskValues.projectId,
            title: taskValues.title,
            description: taskValues.description,
            assignedTo: taskValues.assignedTo,
            updatedAt: new Date(),
          },
        });

      return [nextBudgetAllocation] as const;
    });

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
