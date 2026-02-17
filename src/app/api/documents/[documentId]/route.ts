import { NextRequest, NextResponse } from "next/server";
import { db, projectDocuments } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { r2Client, R2_BUCKET } from "@/lib/storage";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;

    const document = await db.query.projectDocuments.findFirst({
      where: eq(projectDocuments.id, documentId),
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const key = document.url.includes("/uploads/")
      ? document.url.replace(/^\/uploads\//, "")
      : document.url.replace(/^https?:\/\/[^\/]+\//, "");

    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        })
      );
    } catch {
      console.error("Failed to delete file from R2");
    }

    await db.delete(projectDocuments).where(eq(projectDocuments.id, documentId));

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "project_document",
      entityId: documentId,
      changes: { before: document },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
