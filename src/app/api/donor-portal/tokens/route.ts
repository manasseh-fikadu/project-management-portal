import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { donorAccessTokens, donors, emailOutbox } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { createHash, randomBytes } from "crypto";

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 90;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
    const { donorId, expiryDays } = body;

    if (!donorId || typeof donorId !== "string" || !UUID_RE.test(donorId)) {
      return NextResponse.json({ error: "donorId is required and must be a valid UUID" }, { status: 400 });
    }

    const donor = await db.query.donors.findFirst({
      where: eq(donors.id, donorId),
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    if (!donor.email) {
      return NextResponse.json({ error: "Donor does not have an email address" }, { status: 400 });
    }
    const recipientEmail = donor.email;

    const days = Math.max(1, Math.min(
      typeof expiryDays === "number" && expiryDays > 0 ? expiryDays : DEFAULT_EXPIRY_DAYS,
      MAX_EXPIRY_DAYS,
    ));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const portalUrl = `${baseUrl}/donor-portal/${rawToken}`;

    const accessToken = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(donorAccessTokens)
        .values({
          donorId,
          tokenHash,
          expiresAt,
          createdBy: session.userId,
        })
        .returning();

      await tx.insert(emailOutbox).values({
        kind: "donor_invite",
        recipientEmail,
        payload: {
          donorName: donor.name,
          portalUrl,
          expiresAt: expiresAt.toISOString(),
        },
      });

      return created;
    });

    try {
      await logAuditEvent({
        actorUserId: session.userId,
        action: "create",
        entityType: "donor_access_token",
        entityId: accessToken.id,
        changes: {
          after: {
            donorId,
            donorName: donor.name,
            expiresAt: expiresAt.toISOString(),
          },
        },
        request,
      });
    } catch (auditError) {
      console.error("Non-critical: failed to log audit event for token creation:", auditError);
    }

    return NextResponse.json({
      token: {
        id: accessToken.id,
        donorId: accessToken.donorId,
        expiresAt: accessToken.expiresAt,
        createdAt: accessToken.createdAt,
        portalUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating donor access token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get("donorId");

    if (!donorId || !UUID_RE.test(donorId)) {
      return NextResponse.json({ error: "donorId query parameter is required and must be a valid UUID" }, { status: 400 });
    }

    const tokens = await db.query.donorAccessTokens.findMany({
      columns: {
        id: true,
        donorId: true,
        expiresAt: true,
        isRevoked: true,
        lastAccessedAt: true,
        createdAt: true,
      },
      where: and(
        eq(donorAccessTokens.donorId, donorId),
        eq(donorAccessTokens.isRevoked, false),
      ),
      orderBy: [desc(donorAccessTokens.createdAt)],
      with: {
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Error listing donor access tokens:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("tokenId");

    if (!tokenId || !UUID_RE.test(tokenId)) {
      return NextResponse.json({ error: "tokenId query parameter is required and must be a valid UUID" }, { status: 400 });
    }

    const [revoked] = await db
      .update(donorAccessTokens)
      .set({ isRevoked: true })
      .where(eq(donorAccessTokens.id, tokenId))
      .returning();

    if (!revoked) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "donor_access_token",
      entityId: tokenId,
      changes: { after: { isRevoked: true } },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking donor access token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
