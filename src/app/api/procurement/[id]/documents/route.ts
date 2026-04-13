import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db, procurementDocuments } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/storage";
import { PROCUREMENT_DOCUMENT_TYPES, type ProcurementDocumentType } from "@/lib/procurement";

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
    const hasAccess = await canAccessProcurementRequest(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const documents = await db.query.procurementDocuments.findMany({
      where: eq(procurementDocuments.procurementRequestId, id),
      with: {
        uploader: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    const documentsWithUrls = await Promise.all(
      documents.map(async (document) => {
        let key = document.url;
        if (R2_PUBLIC_URL && document.url.startsWith(R2_PUBLIC_URL)) {
          key = document.url.replace(`${R2_PUBLIC_URL}/`, "");
        } else if (document.url.startsWith("/uploads/")) {
          key = document.url.replace("/uploads/", "");
        }

        const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
        return { ...document, url: signedUrl };
      })
    );

    return NextResponse.json({ documents: documentsWithUrls });
  } catch (error) {
    console.error("Error fetching procurement documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    const hasAccess = await canAccessProcurementRequest(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExtension = file.name.split(".").pop() || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExtension}`;
    const key = `procurement/${id}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const rawDocumentType = (formData.get("documentType") as string) || "other";
    const documentType: ProcurementDocumentType = PROCUREMENT_DOCUMENT_TYPES.includes(rawDocumentType as ProcurementDocumentType)
      ? (rawDocumentType as ProcurementDocumentType)
      : "other";

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const fileUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/uploads/${key}`;
    const [document] = await db
      .insert(procurementDocuments)
      .values({
        procurementRequestId: id,
        quotationId: (formData.get("quotationId") as string) || null,
        purchaseOrderId: (formData.get("purchaseOrderId") as string) || null,
        goodsReceiptId: (formData.get("goodsReceiptId") as string) || null,
        supplierInvoiceId: (formData.get("supplierInvoiceId") as string) || null,
        documentType,
        name: name || file.name,
        type: file.type || "application/octet-stream",
        url: fileUrl,
        size: file.size,
        uploadedBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "procurement_document",
      entityId: document.id,
      changes: { after: document },
      request,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Error uploading procurement document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
