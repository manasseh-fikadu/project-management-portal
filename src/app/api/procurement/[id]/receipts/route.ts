import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, goodsReceipts, procurementRequests, purchaseOrders } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { isGoodsReceiptStatus, toRoundedAmount } from "@/lib/procurement";

class GoodsReceiptError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "Goods receipt failed");
    this.status = status;
    this.body = body;
  }
}

function generateReceiptNumber(requestNumber: string, sequence: number): string {
  return `${requestNumber}-GR-${String(sequence).padStart(2, "0")}`;
}

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

    const receipts = await db.query.goodsReceipts.findMany({
      where: eq(goodsReceipts.procurementRequestId, id),
      with: {
        receiver: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: (receipts, { desc }) => [desc(receipts.receivedAt), desc(receipts.createdAt)],
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("Error fetching goods receipts:", error);
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
        receipts: {
          columns: { id: true, receivedAmount: true },
        },
      },
    });

    if (!procurementRequest) {
      return NextResponse.json({ error: "Procurement request not found" }, { status: 404 });
    }

    if (["cancelled", "rejected", "paid"].includes(procurementRequest.status)) {
      return NextResponse.json(
        { error: "Receipts cannot be recorded for a closed procurement request" },
        { status: 400 }
      );
    }

    if (!procurementRequest.purchaseOrder) {
      return NextResponse.json(
        { error: "A purchase order must be issued before receipts can be recorded" },
        { status: 400 }
      );
    }

    if (procurementRequest.purchaseOrder.status === "cancelled") {
      return NextResponse.json({ error: "Receipts cannot be recorded for a cancelled purchase order" }, { status: 400 });
    }

    const body = await request.json();
    const parsedReceivedAt = parseOptionalDate(body.receivedAt);
    if (typeof body.receivedAt === "string" && body.receivedAt.trim() && parsedReceivedAt === null) {
      return NextResponse.json({ error: "receivedAt must be a valid date" }, { status: 400 });
    }

    const requestedStatus =
      typeof body.status === "string" && isGoodsReceiptStatus(body.status)
        ? body.status
        : null;
    const receivedAmount = toRoundedAmount(
      body.receivedAmount ?? (requestedStatus === "rejected" ? 0 : procurementRequest.purchaseOrder.amount)
    );
    if (receivedAmount === null || receivedAmount < 0) {
      return NextResponse.json({ error: "receivedAmount must be zero or a positive number" }, { status: 400 });
    }
    if (requestedStatus === "rejected" && receivedAmount > 0) {
      return NextResponse.json(
        { error: "Rejected receipts must use a receivedAmount of 0" },
        { status: 400 }
      );
    }

    const receipt = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT ${procurementRequests.id} FROM ${procurementRequests} WHERE ${procurementRequests.id} = ${id} FOR UPDATE`
      );
      await tx.execute(
        sql`SELECT ${purchaseOrders.id} FROM ${purchaseOrders} WHERE ${purchaseOrders.procurementRequestId} = ${id} FOR UPDATE`
      );

      const [lockedProcurementRequest] = await tx
        .select({
          id: procurementRequests.id,
          status: procurementRequests.status,
          requestNumber: procurementRequests.requestNumber,
          purchaseOrderId: purchaseOrders.id,
          purchaseOrderAmount: purchaseOrders.amount,
          purchaseOrderStatus: purchaseOrders.status,
        })
        .from(procurementRequests)
        .leftJoin(purchaseOrders, eq(purchaseOrders.procurementRequestId, procurementRequests.id))
        .where(eq(procurementRequests.id, id))
        .limit(1);

      if (!lockedProcurementRequest) {
        throw new GoodsReceiptError(404, { error: "Procurement request not found" });
      }

      if (["cancelled", "rejected", "paid"].includes(lockedProcurementRequest.status)) {
        throw new GoodsReceiptError(400, {
          error: "Receipts cannot be recorded for a closed procurement request",
        });
      }

      if (!lockedProcurementRequest.purchaseOrderId) {
        throw new GoodsReceiptError(400, {
          error: "A purchase order must be issued before receipts can be recorded",
        });
      }

      const purchaseOrderAmount = lockedProcurementRequest.purchaseOrderAmount;
      if (purchaseOrderAmount === null) {
        throw new GoodsReceiptError(400, {
          error: "A purchase order must be issued before receipts can be recorded",
        });
      }

      if (lockedProcurementRequest.purchaseOrderStatus === "cancelled") {
        throw new GoodsReceiptError(400, {
          error: "Receipts cannot be recorded for a cancelled purchase order",
        });
      }

      const existingReceipts = await tx
        .select({
          receivedAmount: goodsReceipts.receivedAmount,
          status: goodsReceipts.status,
        })
        .from(goodsReceipts)
        .where(eq(goodsReceipts.procurementRequestId, id));

      const priorReceivedAmount = existingReceipts.reduce(
        (sum, receiptRow) => sum + (receiptRow.status === "rejected" ? 0 : Math.round(receiptRow.receivedAmount)),
        0
      );
      const progressReceivedAmount = requestedStatus === "rejected" ? 0 : receivedAmount;
      const cumulativeReceivedAmount = priorReceivedAmount + progressReceivedAmount;
      const isComplete = cumulativeReceivedAmount >= Math.round(purchaseOrderAmount);
      const status = requestedStatus ?? (isComplete ? "received" : "partial");
      const receiptNumber =
        typeof body.receiptNumber === "string" && body.receiptNumber.trim()
          ? body.receiptNumber.trim()
          : generateReceiptNumber(lockedProcurementRequest.requestNumber, existingReceipts.length + 1);
      const nextPurchaseOrderStatus = isComplete
        ? "received"
        : cumulativeReceivedAmount > 0
          ? "partially_received"
          : "issued";
      const nextProcurementStatus = isComplete
        ? "received"
        : cumulativeReceivedAmount > 0
          ? "partially_received"
          : "po_issued";

      const [createdReceipt] = await tx
        .insert(goodsReceipts)
        .values({
          procurementRequestId: id,
          purchaseOrderId: lockedProcurementRequest.purchaseOrderId,
          receiptNumber,
          status,
          receivedAmount,
          conditionNotes: typeof body.conditionNotes === "string" ? body.conditionNotes.trim() || null : null,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
          receivedBy: session.userId,
          receivedAt: parsedReceivedAt ?? new Date(),
        })
        .returning();

      await tx
        .update(purchaseOrders)
        .set({
          status: nextPurchaseOrderStatus,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, procurementRequest.purchaseOrder.id));

      await tx
        .update(procurementRequests)
        .set({
          status: nextProcurementStatus,
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(procurementRequests.id, id));

      return createdReceipt;
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "goods_receipt",
      entityId: receipt.id,
      changes: { after: receipt, procurementRequestId: id },
      request,
    });

    const detail = await getProcurementRequestWithRelations(id);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    if (error instanceof GoodsReceiptError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error creating goods receipt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
