import { NextRequest, NextResponse } from "next/server";
import { db, expenditures, projects } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessDonor, canAccessProject, ensureEditAccess, getAccessibleProjectIds } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const budgetAllocationId = searchParams.get("budgetAllocationId");
    const accessibleProjectIds = await getAccessibleProjectIds(session.user);

    if (projectId) {
      const hasAccess = await canAccessProject(session.user, projectId);
      if (!hasAccess) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (accessibleProjectIds?.length === 0) {
      return NextResponse.json({ expenditures: [] });
    }

    const filters = [
      projectId ? eq(expenditures.projectId, projectId) : undefined,
      !projectId && accessibleProjectIds ? inArray(expenditures.projectId, accessibleProjectIds) : undefined,
      budgetAllocationId ? eq(expenditures.budgetAllocationId, budgetAllocationId) : undefined,
    ].filter(Boolean);

    const allExpenditures = await db.query.expenditures.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      with: {
        project: {
          columns: { id: true, name: true },
        },
        donor: {
          columns: { id: true, name: true },
        },
        budgetAllocation: {
          columns: { id: true, activityName: true, plannedAmount: true },
        },
        task: {
          columns: { id: true, title: true, status: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(expenditures.expenditureDate)],
    });

    return NextResponse.json({ expenditures: allExpenditures });
  } catch (error) {
    console.error("Error fetching expenditures:", error);
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
    const {
      projectId,
      budgetAllocationId,
      taskId,
      donorId,
      activityName,
      amount,
      expenditureDate,
      description,
    } = body;

    if (!projectId || amount === undefined || !expenditureDate) {
      return NextResponse.json(
        { error: "projectId, amount, and expenditureDate are required" },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const hasProjectAccess = await canAccessProject(session.user, projectId);
    if (!hasProjectAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (typeof donorId === "string" && donorId) {
      const hasDonorAccess = await canAccessDonor(session.user, donorId);
      if (!hasDonorAccess) {
        return NextResponse.json({ error: "Donor not found" }, { status: 404 });
      }
    }

    const [newExpenditure] = await db
      .insert(expenditures)
      .values({
        projectId,
        budgetAllocationId: budgetAllocationId || null,
        taskId: taskId || null,
        donorId: donorId || null,
        activityName: activityName || null,
        amount: Math.round(numericAmount),
        expenditureDate: new Date(expenditureDate),
        description: description || null,
        createdBy: session.userId,
      })
      .returning();

    await db
      .update(projects)
      .set({
        spentBudget: sql`COALESCE(${projects.spentBudget}, 0) + ${Math.round(numericAmount)}`,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "expenditure",
      entityId: newExpenditure.id,
      changes: { after: newExpenditure },
      request,
    });

    const expenditureWithRelations = await db.query.expenditures.findFirst({
      where: eq(expenditures.id, newExpenditure.id),
      with: {
        project: {
          columns: { id: true, name: true },
        },
        donor: {
          columns: { id: true, name: true },
        },
        budgetAllocation: {
          columns: { id: true, activityName: true, plannedAmount: true },
        },
        task: {
          columns: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json({ expenditure: expenditureWithRelations }, { status: 201 });
  } catch (error) {
    console.error("Error creating expenditure:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
