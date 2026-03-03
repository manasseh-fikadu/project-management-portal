import { NextRequest, NextResponse } from "next/server";
import { db, proposalTemplates } from "@/db";
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
    const template = await db.query.proposalTemplates.findFirst({
      where: eq(proposalTemplates.id, id),
      with: {
        creator: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching proposal template:", error);
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
    const existingTemplate = await db.query.proposalTemplates.findFirst({
      where: eq(proposalTemplates.id, id),
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const { name, description, category, sections, isActive } = body;

    const [template] = await db
      .update(proposalTemplates)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(sections !== undefined && { sections }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(proposalTemplates.id, id))
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "proposal_template",
      entityId: id,
      changes: { before: existingTemplate, after: template },
      request,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error updating proposal template:", error);
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
    const [deletedTemplate] = await db
      .delete(proposalTemplates)
      .where(eq(proposalTemplates.id, id))
      .returning();

    if (!deletedTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "proposal_template",
      entityId: id,
      changes: { before: deletedTemplate },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proposal template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
