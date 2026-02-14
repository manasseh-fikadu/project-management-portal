import { NextRequest, NextResponse } from "next/server";
import { db, projects, milestones, projectMembers } from "@/db";
import { eq, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allProjects = await db.query.projects.findMany({
      with: {
        manager: {
          columns: { id: true, firstName: true, lastName: true, email: true },
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, donorId, totalBudget, startDate, endDate, milestones: inputMilestones } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        name,
        description: description || null,
        donorId: donorId || null,
        totalBudget: totalBudget || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        managerId: session.userId,
      })
      .returning();

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
      userId: session.userId,
      role: "manager",
    });

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
