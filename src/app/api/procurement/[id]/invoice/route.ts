import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, procurementRequests, supplierInvoices, vendors } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { postSupplierInvoiceToFinancials, syncProcurementRequestFinancials } from "@/lib/procurement-finance";
import { normalizeOptionalText, toRoundedAmount } from "@/lib/procurement";

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
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
    const hasAccess = await canAccessProcurementRequest(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    const invoices = await db.query.supplierInvoices.findMany({
      where: eq(supplierInvoices.procurementRequestId, id),
      with: {
        vendor: {
          columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
        linkedExpenditure: {
          columns: { id: true, amount: true, expenditureDate: true },
        },
        linkedDisbursement: {
          columns: { id: true, amount: true, disbursedAt: true, reference: true },
        },
      },
      orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching supplier invoices:", error);
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

    const procurementRequest = await db.query.procurementRequests.findFirst({
      where: eq(procurementRequests.id, id),
      with: {
        purchaseOrder: true,
      },
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (["cancelled", "rejected", "paid"].includes(procurementRequest.status)) {
      return NextResponse.json(
        { error: "Invoices cannot be recorded for a closed procurement request" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const invoiceId = normalizeOptionalText(body.invoiceId);

    if (invoiceId) {
      const existingInvoice = await db.query.supplierInvoices.findFirst({
        where: eq(supplierInvoices.id, invoiceId),
      });

      if (!existingInvoice || existingInvoice.procurementRequestId !== id) {
        return NextResponse.json({ error: "Supplier invoice not found" }, { status: 404 });
      }

      if (body.markAsPaid === true || body.postToFinancials === true) {
        await postSupplierInvoiceToFinancials({
          invoiceId,
          actorUserId: session.userId,
          markAsPaid: body.markAsPaid === true,
          paymentReference: typeof body.paymentReference === "string" ? body.paymentReference.trim() || null : null,
          paymentDate: parseOptionalDate(body.paymentDate),
        });

        await logAuditEvent({
          actorUserId: session.userId,
          action: "update",
          entityType: "supplier_invoice_financial_posting",
          entityId: invoiceId,
          changes: { procurementRequestId: id, markAsPaid: body.markAsPaid === true },
          request,
        });
      }

      await syncProcurementRequestFinancials(id);
      const detail = await getProcurementRequestWithRelations(id);
      return NextResponse.json(detail);
    }

    if (!procurementRequest.purchaseOrder) {
      return NextResponse.json(
        { error: "A purchase order must exist before an invoice can be recorded" },
        { status: 400 }
      );
    }

    const vendorId =
      normalizeOptionalText(body.vendorId)
      ?? procurementRequest.selectedVendorId
      ?? procurementRequest.purchaseOrder?.vendorId
      ?? null;
    const amount = toRoundedAmount(body.amount ?? procurementRequest.purchaseOrder?.amount ?? procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount);
    const invoiceNumber = typeof body.invoiceNumber === "string" ? body.invoiceNumber.trim() : "";
    const invoiceDate = parseOptionalDate(body.invoiceDate);

    if (!vendorId || amount === null || amount <= 0 || !invoiceNumber || !invoiceDate) {
      return NextResponse.json(
        { error: "vendorId, invoiceNumber, invoiceDate, and a positive amount are required" },
        { status: 400 }
      );
    }

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, vendorId),
      columns: { id: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const [invoice] = await db
      .insert(supplierInvoices)
      .values({
        procurementRequestId: id,
        purchaseOrderId: procurementRequest.purchaseOrder?.id ?? null,
        vendorId,
        goodsReceiptId: normalizeOptionalText(body.goodsReceiptId),
        invoiceNumber,
        amount,
        currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
        status: body.markAsPaid === true ? "paid" : body.postToFinancials === true ? "approved" : "received",
        paymentStatus: body.markAsPaid === true ? "paid" : "unpaid",
        invoiceDate,
        dueDate: parseOptionalDate(body.dueDate),
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        createdBy: session.userId,
      })
      .returning();

    if (body.postToFinancials === true || body.markAsPaid === true) {
      await postSupplierInvoiceToFinancials({
        invoiceId: invoice.id,
        actorUserId: session.userId,
        markAsPaid: body.markAsPaid === true,
        paymentReference: typeof body.paymentReference === "string" ? body.paymentReference.trim() || null : null,
        paymentDate: parseOptionalDate(body.paymentDate),
      });
    } else {
      await syncProcurementRequestFinancials(id);
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "supplier_invoice",
      entityId: invoice.id,
      changes: { after: invoice, procurementRequestId: id },
      request,
    });

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    console.error("Error saving supplier invoice:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
