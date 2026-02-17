import { NextRequest, NextResponse } from "next/server";
import { db, proposals } from "@/db";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allProposals = await db.query.proposals.findMany({
      with: {
        donor: true,
        project: {
          columns: { id: true, name: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(proposals.createdAt)],
    });

    return NextResponse.json({ proposals: allProposals });
  } catch (error) {
    console.error("Error fetching proposals:", error);
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
    const {
      title,
      donorId,
      projectId,
      status,
      amountRequested,
      amountApproved,
      currency,
      submissionDate,
      decisionDate,
      startDate,
      endDate,
      description,
      notes,
    } = body;

    if (!title || !amountRequested) {
      return NextResponse.json({ error: "Title and amount requested are required" }, { status: 400 });
    }

    const [newProposal] = await db
      .insert(proposals)
      .values({
        title,
        donorId: donorId || null,
        projectId: projectId || null,
        status: status || "draft",
        amountRequested,
        amountApproved: amountApproved || null,
        currency: currency || "USD",
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        decisionDate: decisionDate ? new Date(decisionDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        description: description || null,
        notes: notes || null,
        createdBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "proposal",
      entityId: newProposal.id,
      changes: { after: newProposal },
      request,
    });

    return NextResponse.json({ proposal: newProposal }, { status: 201 });
  } catch (error) {
    console.error("Error creating proposal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
