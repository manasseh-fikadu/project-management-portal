import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, procurementRequests, purchaseOrders, vendorQuotations, vendors } from "@/db";
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

class PurchaseOrderError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Purchase order failed");
    this.status = status;
    this.body = body;
  }
}

const PURCHASE_ORDER_NUMBER_MAX_ATTEMPTS = 3;

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isUniqueConstraintError(error: unknown, constraintName: string): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "23505"
    && "constraint" in error
    && error.constraint === constraintName
  );
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

    const body = await request.json();
    const customPoNumber = normalizeOptionalText(body.poNumber);
    const parsedIssuedAt = parseOptionalDate(body.issuedAt);
    const parsedExpectedDeliveryDate = parseOptionalDate(body.expectedDeliveryDate);

    if (typeof body.issuedAt === "string" && body.issuedAt.trim() && parsedIssuedAt === null) {
      return NextResponse.json({ error: "issuedAt must be a valid date" }, { status: 400 });
    }

    if (
      typeof body.expectedDeliveryDate === "string"
      && body.expectedDeliveryDate.trim()
      && parsedExpectedDeliveryDate === null
    ) {
      return NextResponse.json({ error: "expectedDeliveryDate must be a valid date" }, { status: 400 });
    }

    const status =
      typeof body.status === "string" && isPurchaseOrderStatus(body.status)
        ? body.status
        : "issued";

    const attemptCount = customPoNumber ? 1 : PURCHASE_ORDER_NUMBER_MAX_ATTEMPTS;
    let responseMeta: { statusCode: number } | null = null;

    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      try {
        responseMeta = await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT ${procurementRequests.id} FROM ${procurementRequests} WHERE ${procurementRequests.id} = ${id} FOR UPDATE`
          );

          const [procurementRequest] = await tx
            .select({
              id: procurementRequests.id,
              status: procurementRequests.status,
              projectId: procurementRequests.projectId,
              budgetAllocationId: procurementRequests.budgetAllocationId,
              selectedVendorId: procurementRequests.selectedVendorId,
              approvedAmount: procurementRequests.approvedAmount,
              estimatedAmount: procurementRequests.estimatedAmount,
              currency: procurementRequests.currency,
              purchaseOrderIssuedAt: procurementRequests.purchaseOrderIssuedAt,
            })
            .from(procurementRequests)
            .where(eq(procurementRequests.id, id))
            .limit(1);

          if (!procurementRequest) {
            throw new PurchaseOrderError(404, { error: "Procurement request not found" });
          }

          if (["draft", "submitted", "cancelled", "rejected", "paid"].includes(procurementRequest.status)) {
            throw new PurchaseOrderError(400, {
              error: "Purchase orders can only be issued for approved sourcing requests",
            });
          }

          const [selectedQuotation] = await tx
            .select({
              vendorId: vendorQuotations.vendorId,
              amount: vendorQuotations.amount,
            })
            .from(vendorQuotations)
            .where(and(eq(vendorQuotations.procurementRequestId, id), eq(vendorQuotations.isSelected, true)))
            .limit(1);

          const vendorId =
            normalizeOptionalText(body.vendorId)
            ?? procurementRequest.selectedVendorId
            ?? selectedQuotation?.vendorId
            ?? null;
          const amount =
            toRoundedAmount(body.amount ?? procurementRequest.approvedAmount ?? selectedQuotation?.amount ?? procurementRequest.estimatedAmount);

          if (!vendorId || amount === null || amount <= 0) {
            throw new PurchaseOrderError(400, {
              error: "A vendor and positive amount are required to issue a purchase order",
            });
          }

          const [vendor] = await tx
            .select({ id: vendors.id })
            .from(vendors)
            .where(eq(vendors.id, vendorId))
            .limit(1);

          if (!vendor) {
            throw new PurchaseOrderError(404, { error: "Vendor not found" });
          }

          const budgetCheck = await ensureProcurementBudgetAvailable({
            projectId: procurementRequest.projectId,
            budgetAllocationId: procurementRequest.budgetAllocationId,
            amount,
            excludeRequestId: id,
            executor: tx,
            lockBudgetScope: true,
          });

          if (!budgetCheck.isWithinBudget) {
            throw new PurchaseOrderError(400, {
              error: "The purchase order amount exceeds the available budget for this request",
              budgetSnapshot: budgetCheck.snapshot,
              remainingAfterAmount: budgetCheck.remainingAfterAmount,
            });
          }

          const [existingPurchaseOrder] = await tx
            .select({
              id: purchaseOrders.id,
              expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
              notes: purchaseOrders.notes,
              issuedAt: purchaseOrders.issuedAt,
            })
            .from(purchaseOrders)
            .where(eq(purchaseOrders.procurementRequestId, id))
            .limit(1);

          let purchaseOrder;
          if (existingPurchaseOrder) {
            const expectedDeliveryDate = Object.prototype.hasOwnProperty.call(body, "expectedDeliveryDate")
              ? parsedExpectedDeliveryDate
              : existingPurchaseOrder.expectedDeliveryDate;
            const notes = Object.prototype.hasOwnProperty.call(body, "notes")
              ? (typeof body.notes === "string" ? body.notes.trim() || null : null)
              : existingPurchaseOrder.notes;

            [purchaseOrder] = await tx
              .update(purchaseOrders)
              .set({
                vendorId,
                status,
                amount,
                currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
                issuedAt: parsedIssuedAt ?? existingPurchaseOrder.issuedAt,
                expectedDeliveryDate,
                notes,
                updatedAt: new Date(),
              })
              .where(eq(purchaseOrders.id, existingPurchaseOrder.id))
              .returning();
          } else {
            [purchaseOrder] = await tx
              .insert(purchaseOrders)
              .values({
                procurementRequestId: id,
                vendorId,
                poNumber: customPoNumber ?? generatePurchaseOrderNumber(),
                status,
                amount,
                currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : procurementRequest.currency,
                issuedAt: parsedIssuedAt ?? new Date(),
                expectedDeliveryDate: parsedExpectedDeliveryDate,
                notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
                createdBy: session.userId,
              })
              .returning();
          }

          await tx
            .update(procurementRequests)
            .set({
              selectedVendorId: vendorId,
              approvedAmount: amount,
              status: status === "cancelled" ? procurementRequest.status : "po_issued",
              purchaseOrderIssuedAt: status === "cancelled" ? procurementRequest.purchaseOrderIssuedAt : new Date(),
              updatedAt: new Date(),
            })
            .where(eq(procurementRequests.id, id));

          await syncProcurementRequestFinancials(id, { executor: tx });

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
            executor: tx,
          });

          return { statusCode: existingPurchaseOrder ? 200 : 201 };
        });
        break;
      } catch (error) {
        if (!isUniqueConstraintError(error, "purchase_orders_po_number_key")) {
          throw error;
        }

        if (customPoNumber) {
          return NextResponse.json({ error: "Purchase order number already exists" }, { status: 409 });
        }

        if (attempt === attemptCount - 1) {
          console.error("Failed to generate a unique purchase order number:", error);
          return NextResponse.json(
            { error: "Unable to generate a unique purchase order number. Please try again." },
            { status: 500 }
          );
        }
      }
    }

    if (!responseMeta) {
      return NextResponse.json(
        { error: "Unable to generate a unique purchase order number. Please try again." },
        { status: 500 }
      );
    }

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail, { status: responseMeta.statusCode });
  } catch (error) {
    if (error instanceof PurchaseOrderError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error creating purchase order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
