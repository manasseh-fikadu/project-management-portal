import { NextRequest, NextResponse } from "next/server";
import { db, milestones } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const projectMilestones = await db.query.milestones.findMany({
      where: eq(milestones.projectId, id),
      orderBy: (m, { asc }) => [asc(m.order)],
    });

    return NextResponse.json({ milestones: projectMilestones });
  } catch (error) {
    console.error("Error fetching milestones:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, dueDate, order } = body;

    if (!title) {
      return NextResponse.json({ error: "Milestone title is required" }, { status: 400 });
    }

    const existingMilestones = await db.query.milestones.findMany({
      where: eq(milestones.projectId, id),
    });

    const [milestone] = await db
      .insert(milestones)
      .values({
        projectId: id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        order: order ?? existingMilestones.length,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "milestone",
      entityId: milestone.id,
      changes: { after: milestone },
      request,
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    console.error("Error creating milestone:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
