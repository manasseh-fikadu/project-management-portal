import { NextRequest, NextResponse } from "next/server";
import { db, tasks } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

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
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const existingTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
