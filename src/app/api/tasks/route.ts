import { NextRequest, NextResponse } from "next/server";
import { db, tasks } from "@/db";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const query = db.query.tasks.findMany({
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
      orderBy: [desc(tasks.createdAt)],
    });

    if (projectId) {
      const filteredTasks = await db.query.tasks.findMany({
        where: eq(tasks.projectId, projectId),
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
        orderBy: [desc(tasks.createdAt)],
      });
      return NextResponse.json({ tasks: filteredTasks });
    }

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
    const {
      projectId,
      title,
      description,
      status,
      priority,
      dueDate,
      assignedTo,
      progress,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: "Project ID and title are required" }, { status: 400 });
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        projectId,
        title,
        description: description || null,
        status: status || "pending",
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo: assignedTo || null,
        progress: typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : 0,
        createdBy: session.userId,
      })
      .returning();

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
