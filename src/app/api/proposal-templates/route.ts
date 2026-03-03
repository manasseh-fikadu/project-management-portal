import { NextRequest, NextResponse } from "next/server";
import { db, proposalTemplates } from "@/db";
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

    const templates = await db.query.proposalTemplates.findMany({
      with: {
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [desc(proposalTemplates.updatedAt)],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching proposal templates:", error);
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
    const { name, description, category, sections, isActive } = body;

    if (!name || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "Name and at least one section are required" }, { status: 400 });
    }

    const [template] = await db
      .insert(proposalTemplates)
      .values({
        name,
        description: description || null,
        category: category || null,
        sections,
        isActive: typeof isActive === "boolean" ? isActive : true,
        createdBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "proposal_template",
      entityId: template.id,
      changes: { after: template },
      request,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating proposal template:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
