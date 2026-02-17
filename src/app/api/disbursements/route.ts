import { NextRequest, NextResponse } from "next/server";
import { db, disbursementLogs } from "@/db";
import { and, desc, eq } from "drizzle-orm";
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
    const donorId = searchParams.get("donorId");

    const filters = [
      projectId ? eq(disbursementLogs.projectId, projectId) : undefined,
      donorId ? eq(disbursementLogs.donorId, donorId) : undefined,
    ].filter(Boolean);

    const logs = await db.query.disbursementLogs.findMany({
      where: filters.length > 0 ? and(...filters) : undefined,
      with: {
        project: {
          columns: { id: true, name: true },
        },
        donor: {
          columns: { id: true, name: true, type: true },
        },
        budgetAllocation: {
          columns: { id: true, activityName: true, plannedAmount: true },
        },
        expenditure: {
          columns: { id: true, amount: true, expenditureDate: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(disbursementLogs.disbursedAt), desc(disbursementLogs.createdAt)],
    });

    return NextResponse.json({ disbursements: logs });
  } catch (error) {
    console.error("Error fetching disbursement logs:", error);
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
      donorId,
      budgetAllocationId,
      expenditureId,
      activityName,
      amount,
      disbursedAt,
      reference,
      notes,
    } = body;

    if (!projectId || !activityName || amount === undefined || !disbursedAt) {
      return NextResponse.json(
        { error: "projectId, activityName, amount, and disbursedAt are required" },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const [newDisbursement] = await db
      .insert(disbursementLogs)
      .values({
        projectId,
        donorId: donorId || null,
        budgetAllocationId: budgetAllocationId || null,
        expenditureId: expenditureId || null,
        activityName,
        amount: Math.round(numericAmount),
        disbursedAt: new Date(disbursedAt),
        reference: reference || null,
        notes: notes || null,
        createdBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "disbursement_log",
      entityId: newDisbursement.id,
      changes: { after: newDisbursement },
      request,
    });

    const disbursementWithRelations = await db.query.disbursementLogs.findFirst({
      where: eq(disbursementLogs.id, newDisbursement.id),
      with: {
        project: {
          columns: { id: true, name: true },
        },
        donor: {
          columns: { id: true, name: true, type: true },
        },
        budgetAllocation: {
          columns: { id: true, activityName: true, plannedAmount: true },
        },
        expenditure: {
          columns: { id: true, amount: true, expenditureDate: true },
        },
      },
    });

    return NextResponse.json({ disbursement: disbursementWithRelations }, { status: 201 });
  } catch (error) {
    console.error("Error creating disbursement log:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
