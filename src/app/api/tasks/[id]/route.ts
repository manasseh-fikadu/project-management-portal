import { NextRequest, NextResponse } from "next/server";
import { db, tasks } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, canAccessTask, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

const ASSIGNEE_MUTABLE_FIELDS = new Set(["status", "progress", "completedAt"]);

function isAssigneeStatusUpdate(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const keys = Object.keys(payload);
  return keys.length > 0 && keys.every((key) => ASSIGNEE_MUTABLE_FIELDS.has(key));
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
    const hasAccess = await canAccessTask(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        assignee: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
        project: {
          columns: { id: true, name: true },
        },
        documents: {
          with: {
            uploader: {
              columns: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const hasAccess = await canAccessTask(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const accessError = ensureEditAccess(session.user);
    const isAssigneeManagingOwnTask =
      existingTask.assignedTo === session.user.id && isAssigneeStatusUpdate(body);

    if (accessError && !isAssigneeManagingOwnTask) {
      return accessError;
    }

    if (typeof body.projectId === "string" && body.projectId) {
      const canUseProject = await canAccessProject(session.user, body.projectId);
      if (!canUseProject) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };

    if (body.dueDate) {
      updateData.dueDate = new Date(body.dueDate);
    }

    if (typeof body.progress === "number" && Number.isFinite(body.progress)) {
      const normalizedProgress = Math.round(body.progress);
      updateData.progress = Math.min(100, Math.max(0, normalizedProgress));
    }

    if (body.status === "completed") {
      updateData.progress = 100;
      if (!body.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "task",
      entityId: id,
      changes: { before: existingTask, after: updatedTask },
      request,
    });

    // Notify new assignee if assignment changed (best-effort)
    if (
      body.assignedTo &&
      body.assignedTo !== existingTask.assignedTo &&
      body.assignedTo !== session.userId
    ) {
      try {
        await createNotification({
          userId: body.assignedTo,
          type: "task_assigned",
          title: "Task reassigned to you",
          message: `You have been assigned "${updatedTask.title}".`,
          entityType: "task",
          entityId: id,
          sendEmail: true,
        });
      } catch (notifError) {
        console.error(`Failed to notify assignee ${body.assignedTo} for task ${updatedTask.id} ("${updatedTask.title}"):`, notifError);
      }
    }

    const taskWithRelations = await db.query.tasks.findFirst({
      where: eq(tasks.id, updatedTask.id),
      with: {
        assignee: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
        project: {
          columns: { id: true, name: true },
        },
        documents: {
          with: {
            uploader: {
              columns: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ task: taskWithRelations });
  } catch (error) {
    console.error("Error updating task:", error);
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
    const hasAccess = await canAccessTask(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const [deletedTask] = await db.delete(tasks).where(eq(tasks.id, id)).returning();

    if (!deletedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "task",
      entityId: id,
      changes: { before: deletedTask },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
