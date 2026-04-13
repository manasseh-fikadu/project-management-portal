import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db, goodsReceipts, procurementDocuments, purchaseOrders, supplierInvoices, vendorQuotations } from "@/db";
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
        } else {
          key = document.url.replace(/^https?:\/\/[^/]+\//, "");
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
    const quotationId = (formData.get("quotationId") as string) || null;
    const purchaseOrderId = (formData.get("purchaseOrderId") as string) || null;
    const goodsReceiptId = (formData.get("goodsReceiptId") as string) || null;
    const supplierInvoiceId = (formData.get("supplierInvoiceId") as string) || null;

    const [
      quotationRecord,
      purchaseOrderRecord,
      goodsReceiptRecord,
      supplierInvoiceRecord,
    ] = await Promise.all([
      quotationId
        ? db
            .select({
              id: vendorQuotations.id,
              procurementRequestId: vendorQuotations.procurementRequestId,
            })
            .from(vendorQuotations)
            .where(eq(vendorQuotations.id, quotationId))
            .limit(1)
        : Promise.resolve([]),
      purchaseOrderId
        ? db
            .select({
              id: purchaseOrders.id,
              procurementRequestId: purchaseOrders.procurementRequestId,
            })
            .from(purchaseOrders)
            .where(eq(purchaseOrders.id, purchaseOrderId))
            .limit(1)
        : Promise.resolve([]),
      goodsReceiptId
        ? db
            .select({
              id: goodsReceipts.id,
              procurementRequestId: goodsReceipts.procurementRequestId,
            })
            .from(goodsReceipts)
            .where(eq(goodsReceipts.id, goodsReceiptId))
            .limit(1)
        : Promise.resolve([]),
      supplierInvoiceId
        ? db
            .select({
              id: supplierInvoices.id,
              procurementRequestId: supplierInvoices.procurementRequestId,
            })
            .from(supplierInvoices)
            .where(eq(supplierInvoices.id, supplierInvoiceId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    if (quotationId) {
      if (!quotationRecord[0]) {
        return NextResponse.json({ error: "Invalid quotationId" }, { status: 400 });
      }
      if (quotationRecord[0].procurementRequestId !== id) {
        return NextResponse.json({ error: "quotationId does not belong to this procurement request" }, { status: 403 });
      }
    }

    if (purchaseOrderId) {
      if (!purchaseOrderRecord[0]) {
        return NextResponse.json({ error: "Invalid purchaseOrderId" }, { status: 400 });
      }
      if (purchaseOrderRecord[0].procurementRequestId !== id) {
        return NextResponse.json({ error: "purchaseOrderId does not belong to this procurement request" }, { status: 403 });
      }
    }

    if (goodsReceiptId) {
      if (!goodsReceiptRecord[0]) {
        return NextResponse.json({ error: "Invalid goodsReceiptId" }, { status: 400 });
      }
      if (goodsReceiptRecord[0].procurementRequestId !== id) {
        return NextResponse.json({ error: "goodsReceiptId does not belong to this procurement request" }, { status: 403 });
      }
    }

    if (supplierInvoiceId) {
      if (!supplierInvoiceRecord[0]) {
        return NextResponse.json({ error: "Invalid supplierInvoiceId" }, { status: 400 });
      }
      if (supplierInvoiceRecord[0].procurementRequestId !== id) {
        return NextResponse.json({ error: "supplierInvoiceId does not belong to this procurement request" }, { status: 403 });
      }
    }

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
        quotationId,
        purchaseOrderId,
        goodsReceiptId,
        supplierInvoiceId,
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
