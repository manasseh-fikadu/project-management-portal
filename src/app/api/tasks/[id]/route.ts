import { NextRequest, NextResponse } from "next/server";
import { db, milestones, taskMilestones, tasks } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, canAccessTask, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { buildDerivedTaskFields, normalizeMilestoneIds } from "@/lib/task-automation";

const ASSIGNEE_MUTABLE_FIELDS = new Set(["progress"]);
const TASK_WITH_RELATIONS = {
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
  taskMilestones: {
    with: {
      milestone: {
        columns: { id: true, title: true, status: true },
      },
    },
  },
};

function isAssigneeStatusUpdate(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const keys = Object.keys(payload);
  return keys.length > 0 && keys.every((key) => ASSIGNEE_MUTABLE_FIELDS.has(key));
}

function buildAssigneeUpdate(payload: unknown): Record<string, unknown> | null {
  if (!isAssigneeStatusUpdate(payload)) {
    return null;
  }

  const assigneeUpdate: Record<string, unknown> = {};

  if (typeof payload.progress === "number" && Number.isFinite(payload.progress)) {
    const normalizedProgress = Math.round(payload.progress);
    assigneeUpdate.progress = Math.min(100, Math.max(0, normalizedProgress));
  }

  return Object.keys(assigneeUpdate).length > 0 ? assigneeUpdate : null;
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
      with: TASK_WITH_RELATIONS,
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
    const payload =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const assigneeUpdate = buildAssigneeUpdate(payload);
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: {
        taskMilestones: {
          with: {
            milestone: {
              columns: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const accessError = ensureEditAccess(session.user);
    const isAssigneeManagingOwnTask =
      existingTask.assignedTo === session.user.id && assigneeUpdate !== null;

    if (accessError && !isAssigneeManagingOwnTask) {
      return accessError;
    }

    if (
      Object.prototype.hasOwnProperty.call(payload, "status")
      || Object.prototype.hasOwnProperty.call(payload, "completedAt")
    ) {
      return NextResponse.json({ error: "Task status is derived from linked milestones" }, { status: 400 });
    }

    if (typeof payload.projectId === "string" && payload.projectId) {
      const canUseProject = await canAccessProject(session.user, payload.projectId);
      if (!canUseProject) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const milestoneIdsProvided = Object.prototype.hasOwnProperty.call(payload, "milestoneIds");
    const milestoneIds = milestoneIdsProvided ? normalizeMilestoneIds(payload.milestoneIds) : null;

    if (milestoneIdsProvided && (milestoneIds === null || milestoneIds.length === 0)) {
      return NextResponse.json({ error: "At least one milestone must be linked" }, { status: 400 });
    }

    const nextProjectId =
      typeof payload.projectId === "string" && payload.projectId
        ? payload.projectId
        : existingTask.projectId;

    if (nextProjectId !== existingTask.projectId && !milestoneIdsProvided) {
      return NextResponse.json(
        { error: "Select milestones from the new project before moving this task" },
        { status: 400 },
      );
    }

    let linkedMilestones = existingTask.taskMilestones.map((link) => link.milestone);

    if (milestoneIdsProvided && milestoneIds) {
      linkedMilestones = await db.query.milestones.findMany({
        where: and(
          eq(milestones.projectId, nextProjectId),
          inArray(milestones.id, milestoneIds),
        ),
        columns: { id: true, status: true },
      });

      if (linkedMilestones.length !== milestoneIds.length) {
        return NextResponse.json({ error: "Milestones must belong to the selected project" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (isAssigneeManagingOwnTask) {
      Object.assign(updateData, assigneeUpdate);
    } else {
      if (typeof payload.title === "string") {
        updateData.title = payload.title;
      }
      if (typeof payload.description === "string" || payload.description === null) {
        updateData.description = payload.description;
      }
      if (typeof payload.projectId === "string" && payload.projectId) {
        updateData.projectId = payload.projectId;
      }
      if (typeof payload.priority === "string") {
        updateData.priority = payload.priority;
      }
      if (typeof payload.progress === "number" && Number.isFinite(payload.progress)) {
        updateData.progress = Math.min(100, Math.max(0, Math.round(payload.progress)));
      }
      if (payload.dueDate === null || payload.dueDate === "") {
        updateData.dueDate = null;
      } else if (typeof payload.dueDate === "string") {
        updateData.dueDate = new Date(payload.dueDate);
      }
      if (payload.assignedTo === null || payload.assignedTo === "") {
        updateData.assignedTo = null;
      } else if (typeof payload.assignedTo === "string") {
        updateData.assignedTo = payload.assignedTo;
      }
    }

    const shouldDeriveStatus = milestoneIdsProvided || existingTask.taskMilestones.length > 0;
    const progressSnapshot = {
      progress:
        typeof updateData.progress === "number"
          ? updateData.progress
          : existingTask.progress,
      completedAt: existingTask.completedAt,
    };

    if (shouldDeriveStatus) {
      Object.assign(
        updateData,
        buildDerivedTaskFields(
          progressSnapshot,
          linkedMilestones.map((milestone) => milestone.status),
        ),
      );
    }

    const updatedTask = await db.transaction(async (tx) => {
      if (milestoneIdsProvided) {
        await tx.delete(taskMilestones).where(eq(taskMilestones.taskId, id));
      }

      const [task] = await tx
        .update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning();

      if (!task) {
        return null;
      }

      if (milestoneIdsProvided && milestoneIds) {
        await tx.insert(taskMilestones).values(
          milestoneIds.map((milestoneId) => ({
            taskId: id,
            milestoneId,
          })),
        );
      }

      return task;
    });

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const taskWithRelations = await db.query.tasks.findFirst({
      where: eq(tasks.id, updatedTask.id),
      with: TASK_WITH_RELATIONS,
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "task",
      entityId: id,
      changes: { before: existingTask, after: taskWithRelations ?? updatedTask },
      request,
    });

    // Notify new assignee if assignment changed (best-effort)
    if (
      typeof updateData.assignedTo === "string"
      && updateData.assignedTo
      && updateData.assignedTo !== existingTask.assignedTo
      && updateData.assignedTo !== session.userId
    ) {
      try {
        await createNotification({
          userId: updateData.assignedTo,
          type: "task_assigned",
          title: "Task reassigned to you",
          message: `You have been assigned "${updatedTask.title}".`,
          entityType: "task",
          entityId: id,
          sendEmail: true,
        });
      } catch (notifError) {
        console.error(
          `Failed to notify assignee ${updateData.assignedTo} for task ${updatedTask.id} ("${updatedTask.title}"):`,
          notifError,
        );
      }
    }

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
