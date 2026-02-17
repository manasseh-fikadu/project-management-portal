import { NextRequest, NextResponse } from "next/server";
import { db, proposals } from "@/db";
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
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, id),
      with: {
        donor: true,
        project: true,
        creator: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error("Error fetching proposal:", error);
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
    const existingProposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, id),
    });

    if (!existingProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const [updatedProposal] = await db
      .update(proposals)
      .set({
        ...body,
        submissionDate: body.submissionDate ? new Date(body.submissionDate) : undefined,
        decisionDate: body.decisionDate ? new Date(body.decisionDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    if (!updatedProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "proposal",
      entityId: id,
      changes: { before: existingProposal, after: updatedProposal },
      request,
    });

    return NextResponse.json({ proposal: updatedProposal });
  } catch (error) {
    console.error("Error updating proposal:", error);
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
    const [deletedProposal] = await db.delete(proposals).where(eq(proposals.id, id)).returning();

    if (!deletedProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "proposal",
      entityId: id,
      changes: { before: deletedProposal },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
