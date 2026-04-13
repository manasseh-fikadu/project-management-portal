import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, procurementRequests, purchaseOrders, vendors } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { ensureProcurementBudgetAvailable, syncProcurementRequestFinancials } from "@/lib/procurement-finance";
import {
  generatePurchaseOrderNumber,
  isPurchaseOrderStatus,
  normalizeOptionalText,
  toRoundedAmount,
} from "@/lib/procurement";

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

    const purchaseOrder = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.procurementRequestId, id),
      with: {
        vendor: {
          columns: { id: true, name: true, contactPerson: true, email: true, phone: true },
        },
        creator: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
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
        quotations: {
          where: (quotations, { eq }) => eq(quotations.isSelected, true),
          columns: { id: true, vendorId: true, amount: true },
        },
      },
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (["draft", "submitted", "cancelled", "rejected", "paid"].includes(procurementRequest.status)) {
      return NextResponse.json(
        { error: "Purchase orders can only be issued for approved sourcing requests" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const vendorId =
      normalizeOptionalText(body.vendorId)
      ?? procurementRequest.selectedVendorId
      ?? procurementRequest.quotations[0]?.vendorId
      ?? null;
    const amount =
      toRoundedAmount(body.amount ?? procurementRequest.approvedAmount ?? procurementRequest.quotations[0]?.amount ?? procurementRequest.estimatedAmount);
    const status =
      typeof body.status === "string" && isPurchaseOrderStatus(body.status)
        ? body.status
        : "issued";

    if (!vendorId || amount === null || amount <= 0) {
      return NextResponse.json(
        { error: "A vendor and positive amount are required to issue a purchase order" },
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

    const budgetCheck = await ensureProcurementBudgetAvailable({
      projectId: procurementRequest.projectId,
      budgetAllocationId: procurementRequest.budgetAllocationId,
      amount,
      excludeRequestId: id,
    });

    if (!budgetCheck.isWithinBudget) {
      return NextResponse.json(
        {
          error: "The purchase order amount exceeds the available budget for this request",
          budgetSnapshot: budgetCheck.snapshot,
          remainingAfterAmount: budgetCheck.remainingAfterAmount,
        },
        { status: 400 }
      );
    }

    const existingPurchaseOrder = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.procurementRequestId, id),
    });

    let purchaseOrder;
    if (existingPurchaseOrder) {
      const expectedDeliveryDate = Object.prototype.hasOwnProperty.call(body, "expectedDeliveryDate")
        ? (typeof body.expectedDeliveryDate === "string" && body.expectedDeliveryDate.trim()
            ? new Date(body.expectedDeliveryDate)
            : null)
        : existingPurchaseOrder.expectedDeliveryDate;
      const notes = Object.prototype.hasOwnProperty.call(body, "notes")
        ? (typeof body.notes === "string" ? body.notes.trim() || null : null)
        : existingPurchaseOrder.notes;

      [purchaseOrder] = await db
        .update(purchaseOrders)
        .set({
          vendorId,
          status,
          amount,
          currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
          issuedAt: typeof body.issuedAt === "string" && body.issuedAt.trim() ? new Date(body.issuedAt) : existingPurchaseOrder.issuedAt,
          expectedDeliveryDate,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, existingPurchaseOrder.id))
        .returning();
    } else {
      [purchaseOrder] = await db
        .insert(purchaseOrders)
        .values({
          procurementRequestId: id,
          vendorId,
          poNumber: typeof body.poNumber === "string" && body.poNumber.trim() ? body.poNumber.trim() : generatePurchaseOrderNumber(),
          status,
          amount,
          currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
          issuedAt: typeof body.issuedAt === "string" && body.issuedAt.trim() ? new Date(body.issuedAt) : new Date(),
          expectedDeliveryDate: typeof body.expectedDeliveryDate === "string" && body.expectedDeliveryDate.trim()
            ? new Date(body.expectedDeliveryDate)
            : null,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
          createdBy: session.userId,
        })
        .returning();
    }

    await db
      .update(procurementRequests)
      .set({
        selectedVendorId: vendorId,
        approvedAmount: amount,
        status: status === "cancelled" ? procurementRequest.status : "po_issued",
        purchaseOrderIssuedAt: status === "cancelled" ? procurementRequest.purchaseOrderIssuedAt : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(procurementRequests.id, id));

    await logAuditEvent({
      actorUserId: session.userId,
      action: existingPurchaseOrder ? "update" : "create",
      entityType: "purchase_order",
      entityId: purchaseOrder.id,
      changes: {
        before: existingPurchaseOrder,
        after: purchaseOrder,
        procurementRequestId: id,
      },
      request,
    });

    await syncProcurementRequestFinancials(id);
    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail, { status: existingPurchaseOrder ? 200 : 201 });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
