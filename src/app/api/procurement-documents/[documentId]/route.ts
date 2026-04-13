import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { db, procurementDocuments } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { r2Client, R2_BUCKET } from "@/lib/storage";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const document = await db.query.procurementDocuments.findFirst({
      where: eq(procurementDocuments.id, documentId),
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const hasAccess = await canAccessProcurementRequest(session.user, document.procurementRequestId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const key = document.url.includes("/uploads/")
      ? document.url.replace(/^\/uploads\//, "")
      : document.url.replace(/^https?:\/\/[^/]+\//, "");

    await db.transaction(async (tx) => {
      await tx.delete(procurementDocuments).where(eq(procurementDocuments.id, documentId));

      await logAuditEvent({
        actorUserId: session.userId,
        action: "delete",
        entityType: "procurement_document",
        entityId: documentId,
        changes: { before: document },
        request,
        executor: tx,
      });
    });

    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
    } catch (error) {
      console.error("Failed to delete procurement file from R2:", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting procurement document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
