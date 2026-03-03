import { NextRequest, NextResponse } from "next/server";
import { db, proposals } from "@/db";
import { and, desc, ilike, or, eq, sql, type SQL } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createNotification, getAdminUserIds } from "@/lib/notifications";

type ProposalStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";
type ProposalType = "grant" | "tor";
const proposalStatuses = new Set<ProposalStatus>(["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"]);
const proposalTypes = new Set<ProposalType>(["grant", "tor"]);

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildLookupText(payload: {
  title: string;
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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const status = url.searchParams.get("status");
    const donorId = url.searchParams.get("donorId");
    const projectId = url.searchParams.get("projectId");
    const proposalType = url.searchParams.get("proposalType");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "25", 10) || 25));
    const offset = (page - 1) * limit;

    const conditions: SQL<unknown>[] = [];
    if (status && status !== "all" && proposalStatuses.has(status as ProposalStatus)) {
      conditions.push(eq(proposals.status, status as ProposalStatus));
    }
    if (donorId) {
      conditions.push(eq(proposals.donorId, donorId));
    }
    if (projectId) {
      conditions.push(eq(proposals.projectId, projectId));
    }
    if (proposalType && proposalType !== "all" && proposalTypes.has(proposalType as ProposalType)) {
      conditions.push(eq(proposals.proposalType, proposalType as ProposalType));
    }
    if (q.length > 0) {
      conditions.push(
        or(
          ilike(proposals.title, `%${q}%`),
          ilike(proposals.description, `%${q}%`),
          ilike(proposals.notes, `%${q}%`),
          ilike(proposals.torCode, `%${q}%`),
          ilike(proposals.torSubmissionRef, `%${q}%`),
          ilike(proposals.lookupText, `%${q}%`)
        )!
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allProposals = await db.query.proposals.findMany({
      where: whereClause,
      with: {
        donor: true,
        project: {
          columns: { id: true, name: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
        template: {
          columns: { id: true, name: true, category: true },
        },
      },
      orderBy: [desc(proposals.createdAt)],
      limit,
      offset,
    });

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(proposals)
      .where(whereClause);

    return NextResponse.json({
      proposals: allProposals,
      pagination: {
        total: countResult[0]?.count ?? 0,
        page,
        limit,
      },
    });
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
      proposalType,
      donorId,
      projectId,
      templateId,
      status,
      amountRequested,
      amountApproved,
      currency,
      torCode,
      torSubmissionRef,
      templateData,
      submissionDate,
      decisionDate,
      startDate,
      endDate,
      description,
      notes,
    } = body;

    const parsedAmountRequested = parseNumber(amountRequested);
    const parsedAmountApproved = parseNumber(amountApproved);
    if (!title || parsedAmountRequested === null) {
      return NextResponse.json({ error: "Title and amount requested are required" }, { status: 400 });
    }
    const safeStatus: ProposalStatus = proposalStatuses.has(status as ProposalStatus) ? (status as ProposalStatus) : "draft";

    const [newProposal] = await db
      .insert(proposals)
      .values({
        title,
        proposalType: proposalType === "tor" ? "tor" : "grant",
        donorId: donorId || null,
        projectId: projectId || null,
        templateId: templateId || null,
        status: safeStatus,
        amountRequested: parsedAmountRequested,
        amountApproved: parsedAmountApproved,
        currency: currency || "USD",
        torCode: torCode || null,
        torSubmissionRef: torSubmissionRef || null,
        templateData: templateData || null,
        lookupText: buildLookupText({
          title,
          description: description || null,
          notes: notes || null,
          torCode: torCode || null,
          torSubmissionRef: torSubmissionRef || null,
        }),
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

    // Notify admins when a proposal is submitted (best-effort — never fail the request)
    if (safeStatus === "submitted") {
      const adminIds = await getAdminUserIds();
      for (const adminId of adminIds) {
        try {
          await createNotification({
            userId: adminId,
            type: "approval_pending",
            title: "New proposal submitted for review",
            message: `"${title}" has been submitted and requires review.`,
            entityType: "proposal",
            entityId: newProposal.id,
            sendEmail: true,
          });
        } catch (notifError) {
          console.error(`Failed to notify admin ${adminId} for proposal ${newProposal.id}:`, notifError);
        }
      }
    }

    return NextResponse.json({ proposal: newProposal }, { status: 201 });
  } catch (error) {
    console.error("Error creating proposal:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
