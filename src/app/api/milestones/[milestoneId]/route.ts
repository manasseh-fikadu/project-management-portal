import { NextRequest, NextResponse } from "next/server";
import { db, milestones, taskMilestones, tasks } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { buildDerivedTaskFields } from "@/lib/task-automation";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { milestoneId } = await params;
    const body = await request.json();
    const existingMilestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, milestoneId),
    });

    if (!existingMilestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };

    if (body.dueDate) {
      updateData.dueDate = new Date(body.dueDate);
    }

    if (body.status === "completed" && !body.completedAt) {
      updateData.completedAt = new Date();
    }

    const updatedMilestone = await db.transaction(async (tx) => {
      const [milestone] = await tx
        .update(milestones)
        .set(updateData)
        .where(eq(milestones.id, milestoneId))
        .returning();

      if (!milestone) {
        return null;
      }

      const linkedTaskRows = await tx.query.taskMilestones.findMany({
        where: eq(taskMilestones.milestoneId, milestoneId),
        columns: { taskId: true },
      });
      const linkedTaskIds = [...new Set(linkedTaskRows.map((row) => row.taskId))];

      if (linkedTaskIds.length > 0) {
        const linkedTasks = await tx.query.tasks.findMany({
          where: inArray(tasks.id, linkedTaskIds),
          columns: { id: true, progress: true, completedAt: true },
          with: {
            taskMilestones: {
              with: {
                milestone: {
                  columns: { status: true },
                },
              },
            },
          },
        });

        for (const task of linkedTasks) {
          await tx
            .update(tasks)
            .set({
              ...buildDerivedTaskFields(
                task,
                task.taskMilestones.map((link) => link.milestone.status),
              ),
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, task.id));
        }
      }

      return milestone;
    });

    if (!updatedMilestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "milestone",
      entityId: milestoneId,
      changes: { before: existingMilestone, after: updatedMilestone },
      request,
    });

    return NextResponse.json({ milestone: updatedMilestone });
  } catch (error) {
    console.error("Error updating milestone:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { milestoneId } = await params;

    const deletedMilestone = await db.transaction(async (tx) => {
      const linkedTaskRows = await tx.query.taskMilestones.findMany({
        where: eq(taskMilestones.milestoneId, milestoneId),
        columns: { taskId: true },
      });
      const linkedTaskIds = [...new Set(linkedTaskRows.map((row) => row.taskId))];

      const [milestone] = await tx.delete(milestones).where(eq(milestones.id, milestoneId)).returning();

      if (!milestone) {
        return null;
      }

      if (linkedTaskIds.length > 0) {
        const linkedTasks = await tx.query.tasks.findMany({
          where: inArray(tasks.id, linkedTaskIds),
          columns: { id: true, progress: true, completedAt: true },
          with: {
            taskMilestones: {
              with: {
                milestone: {
                  columns: { status: true },
                },
              },
            },
          },
        });

        for (const task of linkedTasks) {
          await tx
            .update(tasks)
            .set({
              ...buildDerivedTaskFields(
                task,
                task.taskMilestones.map((link) => link.milestone.status),
              ),
              updatedAt: new Date(),
            })
            .where(eq(tasks.id, task.id));
        }
      }

      return milestone;
    });

    if (!deletedMilestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "milestone",
      entityId: milestoneId,
      changes: { before: deletedMilestone },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
