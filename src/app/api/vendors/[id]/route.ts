import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vendors } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

async function getVendorPayload(id: string) {
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, id),
    with: {
      selectedProcurementRequests: {
        columns: { id: true, requestNumber: true, title: true, status: true },
      },
      quotations: {
        columns: { id: true, amount: true, submittedAt: true, isSelected: true },
      },
      purchaseOrders: {
        columns: { id: true, poNumber: true, amount: true, status: true },
      },
      invoices: {
        columns: { id: true, invoiceNumber: true, amount: true, status: true, paymentStatus: true },
      },
    },
  });

  if (!vendor) {
    return null;
  }

  return {
    ...vendor,
    requestCount: vendor.selectedProcurementRequests.length,
    quotationCount: vendor.quotations.length,
    purchaseOrderCount: vendor.purchaseOrders.length,
    invoiceCount: vendor.invoices.length,
  };
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
    const vendor = await getVendorPayload(id);

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
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
    const existingVendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, id),
    });

    if (!existingVendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : existingVendor.name;

    if (!name) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    const [updatedVendor] = await db
      .update(vendors)
      .set({
        name,
        contactPerson: typeof body.contactPerson === "string" ? body.contactPerson.trim() || null : existingVendor.contactPerson,
        email: typeof body.email === "string" ? body.email.trim() || null : existingVendor.email,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : existingVendor.phone,
        address: typeof body.address === "string" ? body.address.trim() || null : existingVendor.address,
        website: typeof body.website === "string" ? body.website.trim() || null : existingVendor.website,
        taxId: typeof body.taxId === "string" ? body.taxId.trim() || null : existingVendor.taxId,
        bankAccountName: typeof body.bankAccountName === "string" ? body.bankAccountName.trim() || null : existingVendor.bankAccountName,
        bankAccountNumber: typeof body.bankAccountNumber === "string" ? body.bankAccountNumber.trim() || null : existingVendor.bankAccountNumber,
        bankName: typeof body.bankName === "string" ? body.bankName.trim() || null : existingVendor.bankName,
        category: typeof body.category === "string" ? body.category.trim() || null : existingVendor.category,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : existingVendor.notes,
        isActive: typeof body.isActive === "boolean" ? body.isActive : existingVendor.isActive,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, id))
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "update",
      entityType: "vendor",
      entityId: id,
      changes: { before: existingVendor, after: updatedVendor },
      request,
    });

    const vendor = await getVendorPayload(id);
    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const existingVendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, id),
    });

    if (!existingVendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    try {
      await db.delete(vendors).where(eq(vendors.id, id));
    } catch (error) {
      console.error("Error deleting vendor:", error);
      return NextResponse.json(
        { error: "Vendor cannot be deleted while linked procurement records still exist" },
        { status: 409 }
      );
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "delete",
      entityType: "vendor",
      entityId: id,
      changes: { before: existingVendor },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
