import { NextRequest, NextResponse } from "next/server";
import { db, projectDonors, projects, donors } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";

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

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      columns: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const links = await db.query.projectDonors.findMany({
      where: eq(projectDonors.projectId, id),
      with: {
        donor: {
          columns: { id: true, name: true, type: true, email: true, contactPerson: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ projectDonors: links });
  } catch (error) {
    console.error("Error fetching project donors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const { donorId, status, notes } = body;

    if (!donorId) {
      return NextResponse.json({ error: "Donor ID is required" }, { status: 400 });
    }

    const existing = await db.query.projectDonors.findFirst({
      where: and(
        eq(projectDonors.projectId, id),
        eq(projectDonors.donorId, donorId)
      ),
    });

    if (existing) {
      return NextResponse.json({ error: "Donor is already linked to this project" }, { status: 409 });
    }

    const [link] = await db
      .insert(projectDonors)
      .values({
        projectId: id,
        donorId,
        status: status || "active",
        notes: notes || null,
      })
      .returning();

    const fullLink = await db.query.projectDonors.findFirst({
      where: eq(projectDonors.id, link.id),
      with: {
        donor: {
          columns: { id: true, name: true, type: true, email: true, contactPerson: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ projectDonor: fullLink }, { status: 201 });
  } catch (error) {
    console.error("Error linking donor to project:", error);
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
    const { donorId, status, notes } = body;

    if (!donorId) {
      return NextResponse.json({ error: "Donor ID is required" }, { status: 400 });
    }

    const existing = await db.query.projectDonors.findFirst({
      where: and(
        eq(projectDonors.projectId, id),
        eq(projectDonors.donorId, donorId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Donor link not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await db
      .update(projectDonors)
      .set(updateData)
      .where(eq(projectDonors.id, existing.id))
      .returning();

    return NextResponse.json({ projectDonor: updated });
  } catch (error) {
    console.error("Error updating project donor:", error);
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
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get("donorId");

    if (!donorId) {
      return NextResponse.json({ error: "Donor ID is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(projectDonors)
      .where(
        and(
          eq(projectDonors.projectId, id),
          eq(projectDonors.donorId, donorId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Donor link not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing donor from project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
