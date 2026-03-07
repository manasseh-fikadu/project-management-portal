import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const allBudgetAllocations = await db.query.budgetAllocations.findMany({
      where: projectId ? eq(budgetAllocations.projectId, projectId) : undefined,
      with: {
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
    const { projectId, activityName, plannedAmount, q1Amount, q2Amount, q3Amount, q4Amount, notes } = body;

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

    const q1 = q1Amount === undefined ? 0 : Number(q1Amount);
    const q2 = q2Amount === undefined ? 0 : Number(q2Amount);
    const q3 = q3Amount === undefined ? 0 : Number(q3Amount);
    const q4 = q4Amount === undefined ? 0 : Number(q4Amount);

    if (![q1, q2, q3, q4].every((value) => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: "Quarter amounts must be zero or positive numbers" }, { status: 400 });
    }

    const [newBudgetAllocation] = await db
      .insert(budgetAllocations)
      .values({
        projectId,
        activityName,
        plannedAmount: Math.round(amount),
        q1Amount: Math.round(q1),
        q2Amount: Math.round(q2),
        q3Amount: Math.round(q3),
        q4Amount: Math.round(q4),
        notes: notes || null,
        createdBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "budget_allocation",
      entityId: newBudgetAllocation.id,
      changes: { after: newBudgetAllocation },
      request,
    });

    return NextResponse.json({ budgetAllocation: newBudgetAllocation }, { status: 201 });
  } catch (error) {
    console.error("Error creating budget allocation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
