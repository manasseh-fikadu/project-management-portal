import { NextRequest, NextResponse } from "next/server";
import { db, projects } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

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
        milestones: {
          orderBy: (milestones, { asc }) => [asc(milestones.order)],
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const [updatedProject] = await db
      .update(projects)
      .set({
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [deletedProject] = await db.delete(projects).where(eq(projects.id, id)).returning();

    if (!deletedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
