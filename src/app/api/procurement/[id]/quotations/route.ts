import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, procurementRequests, vendorQuotations, vendors } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { ensureProcurementBudgetAvailable, syncProcurementRequestFinancials } from "@/lib/procurement-finance";
import { toRoundedAmount } from "@/lib/procurement";

const PROCUREMENT_LOCKED_STATUSES = new Set([
  "po_issued",
  "partially_received",
  "received",
  "invoiced",
  "paid",
  "cancelled",
  "rejected",
]);

class ProcurementQuotationError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Quotation request failed");
    this.status = status;
    this.body = body;
  }
}

function parseOptionalQuotationDate(value: unknown, fieldName: string): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (Number.isNaN(Date.parse(trimmedValue))) {
    throw new ProcurementQuotationError(400, {
      error: `${fieldName} must be a valid date`,
    });
  }

  return new Date(trimmedValue);
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

    const quotations = await db.query.vendorQuotations.findMany({
      where: eq(vendorQuotations.procurementRequestId, id),
      with: {
        vendor: {
          columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: (quotations, { desc }) => [desc(quotations.createdAt)],
    });

    return NextResponse.json({ quotations });
  } catch (error) {
    console.error("Error fetching vendor quotations:", error);
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
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (PROCUREMENT_LOCKED_STATUSES.has(procurementRequest.status)) {
      return NextResponse.json({ error: "This request can no longer accept quotations" }, { status: 400 });
    }

    const body = await request.json();
    const submittedAt = parseOptionalQuotationDate(body.submittedAt, "submittedAt");
    const validUntil = parseOptionalQuotationDate(body.validUntil, "validUntil");
    const quotationId = typeof body.quotationId === "string" ? body.quotationId : null;

    if (quotationId) {
      const existingQuotation = await db.query.vendorQuotations.findFirst({
        where: eq(vendorQuotations.id, quotationId),
      });

      if (!existingQuotation || existingQuotation.procurementRequestId !== id) {
        return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
      }

      await db.transaction(async (tx) => {
        const budgetCheck = await ensureProcurementBudgetAvailable({
          projectId: procurementRequest.projectId,
          budgetAllocationId: procurementRequest.budgetAllocationId,
          amount: existingQuotation.amount,
          excludeRequestId: id,
          executor: tx,
          lockBudgetScope: true,
        });

        if (!budgetCheck.isWithinBudget) {
          throw new ProcurementQuotationError(400, {
            error: "The selected quotation exceeds the available budget for this request",
            budgetSnapshot: budgetCheck.snapshot,
            remainingAfterAmount: budgetCheck.remainingAfterAmount,
          });
        }

        await tx
          .update(vendorQuotations)
          .set({ isSelected: false, updatedAt: new Date() })
          .where(eq(vendorQuotations.procurementRequestId, id));

        await tx
          .update(vendorQuotations)
          .set({ isSelected: true, updatedAt: new Date() })
          .where(eq(vendorQuotations.id, quotationId));

        await tx
          .update(procurementRequests)
          .set({
            selectedVendorId: existingQuotation.vendorId,
            approvedAmount: existingQuotation.amount,
            status: ["po_issued", "partially_received", "received", "invoiced", "paid"].includes(procurementRequest.status)
              ? procurementRequest.status
              : "quotes_received",
            updatedAt: new Date(),
          })
          .where(eq(procurementRequests.id, id));

        await syncProcurementRequestFinancials(id, { executor: tx });
      });

      await logAuditEvent({
        actorUserId: session.userId,
        action: "update",
        entityType: "vendor_quotation_selection",
        entityId: quotationId,
        changes: { procurementRequestId: id, selectedQuotationId: quotationId },
        request,
      });

      const detail = await getProcurementRequestWithRelations(id);
      return NextResponse.json(detail);
    }

    const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
    const amount = toRoundedAmount(body.amount);
    if (!vendorId || amount === null || amount <= 0) {
      return NextResponse.json(
        { error: "vendorId and a positive amount are required to add a quotation" },
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

    if (body.isSelected === true) {
      const budgetCheck = await ensureProcurementBudgetAvailable({
        projectId: procurementRequest.projectId,
        budgetAllocationId: procurementRequest.budgetAllocationId,
        amount,
        excludeRequestId: id,
      });

      if (!budgetCheck.isWithinBudget) {
        return NextResponse.json(
          {
            error: "The selected quotation exceeds the available budget for this request",
            budgetSnapshot: budgetCheck.snapshot,
            remainingAfterAmount: budgetCheck.remainingAfterAmount,
          },
          { status: 400 }
        );
      }
    }

    let quotation;
    if (body.isSelected === true) {
      quotation = await db.transaction(async (tx) => {
        const [createdQuotation] = await tx
          .insert(vendorQuotations)
          .values({
            procurementRequestId: id,
            vendorId,
            referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber.trim() || null : null,
            amount,
            currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
            submittedAt,
            validUntil,
            isSelected: false,
            notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
            comparisonNotes: typeof body.comparisonNotes === "string" ? body.comparisonNotes.trim() || null : null,
            createdBy: session.userId,
          })
          .returning();

        await tx
          .update(vendorQuotations)
          .set({ isSelected: false, updatedAt: new Date() })
          .where(eq(vendorQuotations.procurementRequestId, id));

        await tx
          .update(vendorQuotations)
          .set({ isSelected: true, updatedAt: new Date() })
          .where(eq(vendorQuotations.id, createdQuotation.id));

        await tx
          .update(procurementRequests)
          .set({
            selectedVendorId: vendorId,
            approvedAmount: amount,
            status: "quotes_received",
            updatedAt: new Date(),
          })
          .where(eq(procurementRequests.id, id));

        return createdQuotation;
      });
    } else if (procurementRequest.status === "approved" || procurementRequest.status === "rfq_open") {
      quotation = await db.transaction(async (tx) => {
        const [createdQuotation] = await tx
          .insert(vendorQuotations)
          .values({
            procurementRequestId: id,
            vendorId,
            referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber.trim() || null : null,
            amount,
            currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
            submittedAt,
            validUntil,
            isSelected: false,
            notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
            comparisonNotes: typeof body.comparisonNotes === "string" ? body.comparisonNotes.trim() || null : null,
            createdBy: session.userId,
          })
          .returning();

        await tx
          .update(procurementRequests)
          .set({
            status: "quotes_received",
            updatedAt: new Date(),
          })
          .where(eq(procurementRequests.id, id));

        return createdQuotation;
      });
    } else {
      [quotation] = await db
        .insert(vendorQuotations)
        .values({
          procurementRequestId: id,
          vendorId,
          referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber.trim() || null : null,
          amount,
          currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
          submittedAt,
          validUntil,
          isSelected: false,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
          comparisonNotes: typeof body.comparisonNotes === "string" ? body.comparisonNotes.trim() || null : null,
          createdBy: session.userId,
        })
        .returning();
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "vendor_quotation",
      entityId: quotation.id,
      changes: { after: quotation },
      request,
    });

    await syncProcurementRequestFinancials(id);
    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    if (error instanceof ProcurementQuotationError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error saving vendor quotation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
