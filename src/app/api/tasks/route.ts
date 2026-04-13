import { NextRequest, NextResponse } from "next/server";
import { db, milestones, taskMilestones, tasks } from "@/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, ensureEditAccess, getAccessibleProjectIds } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { buildDerivedTaskFields, normalizeMilestoneIds } from "@/lib/task-automation";

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
} as const;

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
      return NextResponse.json({ tasks: [] });
    }

    const whereClause = projectId
      ? eq(tasks.projectId, projectId)
      : accessibleProjectIds
        ? inArray(tasks.projectId, accessibleProjectIds)
        : undefined;

    const query = db.query.tasks.findMany({
      where: whereClause,
      with: TASK_WITH_RELATIONS,
      orderBy: [desc(tasks.createdAt)],
    });

    const allTasks = await query;
    return NextResponse.json({ tasks: allTasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
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
    const payload =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const projectId = typeof payload.projectId === "string" ? payload.projectId : "";
    const title = typeof payload.title === "string" ? payload.title : "";
    const description = typeof payload.description === "string" ? payload.description : null;
    const priority = typeof payload.priority === "string" ? payload.priority : null;
    const dueDate = typeof payload.dueDate === "string" ? payload.dueDate : null;
    const assignedTo =
      typeof payload.assignedTo === "string" && payload.assignedTo
        ? payload.assignedTo
        : null;
    const progress = typeof payload.progress === "number" ? payload.progress : 0;
    const milestoneIds = normalizeMilestoneIds(payload.milestoneIds);

    if (!projectId || !title) {
      return NextResponse.json({ error: "Project ID and title are required" }, { status: 400 });
    }

    if (milestoneIds === null || milestoneIds.length === 0) {
      return NextResponse.json({ error: "At least one milestone must be linked" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(session.user, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const linkedMilestones = await db.query.milestones.findMany({
      where: and(
        eq(milestones.projectId, projectId),
        inArray(milestones.id, milestoneIds),
      ),
      columns: { id: true, status: true },
    });

    if (linkedMilestones.length !== milestoneIds.length) {
      return NextResponse.json({ error: "Milestones must belong to the selected project" }, { status: 400 });
    }

    const derivedFields = buildDerivedTaskFields(
      { progress },
      linkedMilestones.map((milestone) => milestone.status),
    );

    const newTask = await db.transaction(async (tx) => {
      const [insertedTask] = await tx
        .insert(tasks)
        .values({
          projectId,
          title,
          description,
          status: derivedFields.status,
          priority: priority || "medium",
          dueDate: dueDate ? new Date(dueDate) : null,
          assignedTo,
          progress: derivedFields.progress,
          completedAt: derivedFields.completedAt,
          createdBy: session.userId,
        })
        .returning();

      await tx.insert(taskMilestones).values(
        milestoneIds.map((milestoneId) => ({
          taskId: insertedTask.id,
          milestoneId,
        })),
      );

      return insertedTask;
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "task",
      entityId: newTask.id,
      changes: { after: newTask },
      request,
    });

    const taskWithRelations = await db.query.tasks.findFirst({
      where: eq(tasks.id, newTask.id),
      with: TASK_WITH_RELATIONS,
    });

    // Notify assignee when task is assigned to someone other than the creator (best-effort)
    if (assignedTo && assignedTo !== session.userId) {
      try {
        const projectName = taskWithRelations?.project?.name ?? projectId;
        await createNotification({
          userId: assignedTo,
          type: "task_assigned",
          title: "New task assigned to you",
          message: `You have been assigned "${title}" in project "${projectName}".`,
          entityType: "task",
          entityId: newTask.id,
          sendEmail: true,
        });
      } catch (notifError) {
        console.error(`Failed to notify assignee ${assignedTo} for task ${newTask.id}:`, notifError);
      }
    }

    return NextResponse.json({ task: taskWithRelations }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
