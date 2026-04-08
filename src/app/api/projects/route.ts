import { NextRequest, NextResponse } from "next/server";
import { db, projects, milestones, projectMembers, projectDonors } from "@/db";
import { desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess, getAccessibleProjectIds } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessibleProjectIds = await getAccessibleProjectIds(session.user);
    if (accessibleProjectIds?.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const allProjects = await db.query.projects.findMany({
      where: accessibleProjectIds ? inArray(projects.id, accessibleProjectIds) : undefined,
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
              columns: { id: true, name: true, type: true },
            },
          },
        },
        milestones: {
          columns: { id: true, title: true, status: true, dueDate: true },
        },
      },
      orderBy: [desc(projects.createdAt)],
    });

    return NextResponse.json({ projects: allProjects });
  } catch (error) {
    console.error("Error fetching projects:", error);
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
    const { name, description, donorId, donorIds, totalBudget, startDate, endDate, managerId, milestones: inputMilestones } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const assignedManagerId = managerId || session.userId;

    const [newProject] = await db
      .insert(projects)
      .values({
        name,
        description: description || null,
        donorId: donorId || null,
        totalBudget: totalBudget || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        managerId: assignedManagerId,
      })
      .returning();

    const resolvedDonorIds: string[] = donorIds && donorIds.length > 0
      ? donorIds
      : donorId ? [donorId] : [];

    if (resolvedDonorIds.length > 0) {
      await db.insert(projectDonors).values(
        resolvedDonorIds.map((id: string) => ({
          projectId: newProject.id,
          donorId: id,
          status: "active" as const,
        }))
      );
    }

    if (inputMilestones && inputMilestones.length > 0) {
      await db.insert(milestones).values(
        inputMilestones.map((m: { title: string; description?: string; dueDate?: string }, index: number) => ({
          projectId: newProject.id,
          title: m.title,
          description: m.description || null,
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          order: index,
        }))
      );
    }

    await db.insert(projectMembers).values({
      projectId: newProject.id,
      userId: assignedManagerId,
      role: "manager",
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "project",
      entityId: newProject.id,
      changes: { after: newProject },
      request,
    });

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
