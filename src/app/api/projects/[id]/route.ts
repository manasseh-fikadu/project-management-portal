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
    const existingProject = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };
    if (body.startDate !== undefined) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    }
    if (body.endDate !== undefined) {
      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (body.managerId && body.managerId !== existingProject.managerId) {
      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, id),
            eq(projectMembers.role, "manager")
          )
        );
      await db.insert(projectMembers).values({
        projectId: id,
        userId: body.managerId,
        role: "manager",
      });
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
