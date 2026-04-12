import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, tasks } from "@/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, ensureEditAccess, getAccessibleProjectIds } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { buildBudgetLineTaskDescription, buildBudgetLineTaskTitle } from "@/lib/budget-line-tasks";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const accessibleProjectIds = await getAccessibleProjectIds(session.user);

    if (projectId) {
      const hasAccess = await canAccessProject(session.user, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (accessibleProjectIds?.length === 0) {
      return NextResponse.json({ budgetAllocations: [] });
    }

    const filters = [
      projectId ? eq(budgetAllocations.projectId, projectId) : undefined,
      !projectId && accessibleProjectIds ? inArray(budgetAllocations.projectId, accessibleProjectIds) : undefined,
    ].filter(Boolean);

    const allBudgetAllocations = await db.query.budgetAllocations.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      with: {
        assignee: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        task: {
          columns: { id: true, title: true, status: true },
        },
        project: {
          columns: { id: true, name: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(budgetAllocations.createdAt)],
    });

    return NextResponse.json({ budgetAllocations: allBudgetAllocations });
  } catch (error) {
    console.error("Error fetching budget allocations:", error);
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
    const { projectId, activityName, plannedAmount, q1Amount, q2Amount, q3Amount, q4Amount, assignedTo, notes } = body;

    if (!projectId || !activityName || plannedAmount === undefined) {
      return NextResponse.json(
        { error: "projectId, activityName, and plannedAmount are required" },
        { status: 400 }
      );
    }

    const amount = Number(plannedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "plannedAmount must be a positive number" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(session.user, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const q1 = q1Amount === undefined ? 0 : Number(q1Amount);
    const q2 = q2Amount === undefined ? 0 : Number(q2Amount);
    const q3 = q3Amount === undefined ? 0 : Number(q3Amount);
    const q4 = q4Amount === undefined ? 0 : Number(q4Amount);

    if (![q1, q2, q3, q4].every((value) => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: "Quarter amounts must be zero or positive numbers" }, { status: 400 });
    }

    const roundedPlannedAmount = Math.round(amount);
    const roundedQ1 = Math.round(q1);
    const roundedQ2 = Math.round(q2);
    const roundedQ3 = Math.round(q3);
    const roundedQ4 = Math.round(q4);
    const roundedQuarterSum = roundedQ1 + roundedQ2 + roundedQ3 + roundedQ4;

    if (roundedQuarterSum > roundedPlannedAmount) {
      return NextResponse.json(
        {
          error: "Rounded quarter amounts cannot exceed the rounded planned amount",
        },
        { status: 400 }
      );
    }

    const [newBudgetAllocation] = await db
      .insert(budgetAllocations)
      .values({
        projectId,
        activityName,
        plannedAmount: roundedPlannedAmount,
        q1Amount: roundedQ1,
        q2Amount: roundedQ2,
        q3Amount: roundedQ3,
        q4Amount: roundedQ4,
        assignedTo: assignedTo || null,
        notes: notes || null,
        createdBy: session.userId,
      })
      .returning();

    await db.insert(tasks).values({
      projectId,
      budgetAllocationId: newBudgetAllocation.id,
      title: buildBudgetLineTaskTitle(newBudgetAllocation.activityName),
      description: buildBudgetLineTaskDescription(newBudgetAllocation.notes),
      assignedTo: newBudgetAllocation.assignedTo ?? null,
      createdBy: session.userId,
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "budget_allocation",
      entityId: newBudgetAllocation.id,
      changes: { after: newBudgetAllocation },
      request,
    });

    const budgetAllocationWithRelations = await db.query.budgetAllocations.findFirst({
      where: eq(budgetAllocations.id, newBudgetAllocation.id),
      with: {
        assignee: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        task: {
          columns: { id: true, title: true, status: true },
        },
        project: {
          columns: { id: true, name: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ budgetAllocation: budgetAllocationWithRelations }, { status: 201 });
  } catch (error) {
    console.error("Error creating budget allocation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
