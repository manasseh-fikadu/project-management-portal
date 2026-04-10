import { NextRequest, NextResponse } from "next/server";
import { db, proposals } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessDonor, canAccessProject, canAccessProposal, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification, getAdminUserIds } from "@/lib/notifications";

const allowedStatusTransitions: Record<string, string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["approved", "rejected", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: [],
};

function buildLookupText(payload: {
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  torCode?: string | null;
  torSubmissionRef?: string | null;
}) {
  return [payload.title, payload.description, payload.notes, payload.torCode, payload.torSubmissionRef]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ")
    .trim();
}

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
    const hasAccess = await canAccessProposal(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, id),
      with: {
        donor: true,
        project: true,
        template: true,
        documents: {
          with: {
            uploader: {
              columns: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: (docs, { desc }) => [desc(docs.createdAt)],
        },
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
    const hasAccess = await canAccessProposal(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const body = await request.json();
    if (body.projectId === "") {
      body.projectId = null;
    }
    if (body.donorId === "") {
      body.donorId = null;
    }
    const existingProposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, id),
    });

    if (!existingProposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (typeof body.projectId === "string" && body.projectId !== null) {
      const canUseProject = await canAccessProject(session.user, body.projectId);
      if (!canUseProject) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    if (typeof body.donorId === "string" && body.donorId !== null) {
      const canUseDonor = await canAccessDonor(session.user, body.donorId);
      if (!canUseDonor) {
        return NextResponse.json({ error: "Donor not found" }, { status: 404 });
      }
    }

    if (body.status && body.status !== existingProposal.status) {
      const nextStates = allowedStatusTransitions[existingProposal.status] || [];
      if (!nextStates.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${existingProposal.status} to ${body.status}` },
          { status: 400 }
        );
      }
    }

    const nextTitle = typeof body.title === "string" ? body.title : existingProposal.title;
    const nextDescription = typeof body.description === "string" ? body.description : existingProposal.description;
    const nextNotes = typeof body.notes === "string" ? body.notes : existingProposal.notes;
    const nextTorCode = typeof body.torCode === "string" ? body.torCode : existingProposal.torCode;
    const nextTorSubmissionRef =
      typeof body.torSubmissionRef === "string" ? body.torSubmissionRef : existingProposal.torSubmissionRef;

    const [updatedProposal] = await db
      .update(proposals)
      .set({
        ...body,
        submissionDate: body.submissionDate ? new Date(body.submissionDate) : undefined,
        decisionDate: body.decisionDate ? new Date(body.decisionDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        lookupText: buildLookupText({
          title: nextTitle,
          description: nextDescription,
          notes: nextNotes,
          torCode: nextTorCode,
          torSubmissionRef: nextTorSubmissionRef,
        }),
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

    // Notify on status changes
    if (body.status && body.status !== existingProposal.status) {
      const newStatus = body.status as string;

      // Notify creator on approval/rejection
      if (newStatus === "approved" || newStatus === "rejected") {
        await createNotification({
          userId: existingProposal.createdBy,
          type: "approval_decision",
          title: `Proposal ${newStatus}`,
          message: `Your proposal "${updatedProposal.title}" has been ${newStatus}.`,
          entityType: "proposal",
          entityId: id,
          sendEmail: true,
        });
      }

      // Notify admins when submitted
      if (newStatus === "submitted") {
        const adminIds = await getAdminUserIds();
        for (const adminId of adminIds) {
          await createNotification({
            userId: adminId,
            type: "approval_pending",
            title: "Proposal submitted for review",
            message: `"${updatedProposal.title}" has been submitted and requires review.`,
            entityType: "proposal",
            entityId: id,
            sendEmail: true,
          });
        }
      }
    }

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
    const hasAccess = await canAccessProposal(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

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
