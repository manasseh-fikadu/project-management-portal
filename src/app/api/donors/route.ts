import { NextRequest, NextResponse } from "next/server";
import { db, donors } from "@/db";
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

    const allDonors = await db.query.donors.findMany({
      orderBy: [desc(donors.createdAt)],
    });

    return NextResponse.json({ donors: allDonors });
  } catch (error) {
    console.error("Error fetching donors:", error);
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
      name,
      type,
      contactPerson,
      email,
      phone,
      address,
      website,
      grantTypes,
      focusAreas,
      averageGrantSize,
      notes,
    } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
    }

    const [newDonor] = await db
      .insert(donors)
      .values({
        name,
        type,
        contactPerson: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        grantTypes: grantTypes || null,
        focusAreas: focusAreas || null,
        averageGrantSize: averageGrantSize || null,
        notes: notes || null,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "donor",
      entityId: newDonor.id,
      changes: { after: newDonor },
      request,
    });

    return NextResponse.json({ donor: newDonor }, { status: 201 });
  } catch (error) {
    console.error("Error creating donor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
