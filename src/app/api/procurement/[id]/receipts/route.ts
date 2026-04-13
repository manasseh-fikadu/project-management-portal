import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, goodsReceipts, procurementRequests, purchaseOrders } from "@/db";
import { getSession } from "@/lib/auth";
import { canAccessProcurementRequest, ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { getProcurementRequestWithRelations } from "@/lib/procurement-data";
import { isGoodsReceiptStatus, toRoundedAmount } from "@/lib/procurement";

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

    const receivedAmount = toRoundedAmount(body.receivedAmount ?? procurementRequest.purchaseOrder.amount);
    if (receivedAmount === null || receivedAmount < 0) {
      return NextResponse.json({ error: "receivedAmount must be zero or a positive number" }, { status: 400 });
    }

    const priorReceivedAmount = procurementRequest.receipts.reduce(
      (sum, receipt) => sum + Math.round(receipt.receivedAmount),
      0
    );
    const cumulativeReceivedAmount = priorReceivedAmount + receivedAmount;
    const isComplete = cumulativeReceivedAmount >= Math.round(procurementRequest.purchaseOrder.amount);
    const status =
      typeof body.status === "string" && isGoodsReceiptStatus(body.status)
        ? body.status
        : isComplete
          ? "received"
          : "partial";

    const receipt = await db.transaction(async (tx) => {
      const [createdReceipt] = await tx
        .insert(goodsReceipts)
        .values({
          procurementRequestId: id,
          purchaseOrderId: procurementRequest.purchaseOrder.id,
          receiptNumber:
            typeof body.receiptNumber === "string" && body.receiptNumber.trim()
              ? body.receiptNumber.trim()
              : generateReceiptNumber(procurementRequest.requestNumber, procurementRequest.receipts.length + 1),
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
          status: isComplete ? "received" : "partially_received",
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, procurementRequest.purchaseOrder.id));

      await tx
        .update(procurementRequests)
        .set({
          status: isComplete ? "received" : "partially_received",
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
    console.error("Error creating goods receipt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
