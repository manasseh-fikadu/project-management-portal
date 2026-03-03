import { NextRequest, NextResponse } from "next/server";
import { db, projects, projectMembers } from "@/db";
import { eq, and } from "drizzle-orm";
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

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        manager: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        donor: {
          columns: { id: true, name: true, type: true },
        },
        projectDonors: {
          with: {
            donor: {
              columns: { id: true, name: true, type: true, email: true, contactPerson: true, isActive: true },
            },
          },
        },
        milestones: {
          orderBy: (milestones, { asc }) => [asc(milestones.order)],
        },
        tasks: {
          with: {
            assignee: {
              columns: { id: true, firstName: true, lastName: true, email: true },
            },
            creator: {
              columns: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
        },
        documents: {
          with: {
            uploader: {
              columns: { id: true, firstName: true, lastName: true },
            },
          },
        },
        members: {
          with: {
            user: {
              columns: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const payload =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const existingProject = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof payload.name === "string") {
      updateData.name = payload.name;
    }
    if (typeof payload.description === "string" || payload.description === null) {
      updateData.description = payload.description;
    }
    if (typeof payload.status === "string") {
      updateData.status = payload.status;
    }
    if (typeof payload.donorId === "string" || payload.donorId === null) {
      updateData.donorId = payload.donorId;
    }
    if (typeof payload.managerId === "string") {
      updateData.managerId = payload.managerId;
    }
    if (typeof payload.totalBudget === "number") {
      updateData.totalBudget = payload.totalBudget;
    }
    if (typeof payload.spentBudget === "number") {
      updateData.spentBudget = payload.spentBudget;
    }
    if (payload.startDate !== undefined) {
      updateData.startDate =
        typeof payload.startDate === "string" && payload.startDate
          ? new Date(payload.startDate)
          : null;
    }
    if (payload.endDate !== undefined) {
      updateData.endDate =
        typeof payload.endDate === "string" && payload.endDate
          ? new Date(payload.endDate)
          : null;
    }

    const managerId = typeof payload.managerId === "string" ? payload.managerId : null;
    const updatedProject = await db.transaction(async (tx) => {
      const [project] = await tx
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!project) {
        return null;
      }

      if (managerId && managerId !== existingProject.managerId) {
        await tx
          .delete(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, id),
              eq(projectMembers.role, "manager")
            )
          );
        await tx.insert(projectMembers).values({
          projectId: id,
          userId: managerId,
          role: "manager",
        });
      }

      return project;
    });

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "project",
      entityId: id,
      changes: { before: existingProject, after: updatedProject },
      request,
    });

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [deletedProject] = await db.delete(projects).where(eq(projects.id, id)).returning();

    if (!deletedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "project",
      entityId: id,
      changes: { before: deletedProject },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
