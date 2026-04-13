import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db, vendors } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendorRows = await db.query.vendors.findMany({
      with: {
        selectedProcurementRequests: {
          columns: { id: true },
        },
        quotations: {
          columns: { id: true },
        },
        purchaseOrders: {
          columns: { id: true },
        },
        invoices: {
          columns: { id: true },
        },
      },
      orderBy: [asc(vendors.name)],
    });

    const vendorList = vendorRows.map((vendor) => ({
      ...vendor,
      requestCount: vendor.selectedProcurementRequests.length,
      quotationCount: vendor.quotations.length,
      purchaseOrderCount: vendor.purchaseOrders.length,
      invoiceCount: vendor.invoices.length,
    }));

    return NextResponse.json({ vendors: vendorList });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }

    const [vendor] = await db
      .insert(vendors)
      .values({
        name,
        contactPerson: typeof body.contactPerson === "string" ? body.contactPerson.trim() || null : null,
        email: typeof body.email === "string" ? body.email.trim() || null : null,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
        address: typeof body.address === "string" ? body.address.trim() || null : null,
        website: typeof body.website === "string" ? body.website.trim() || null : null,
        taxId: typeof body.taxId === "string" ? body.taxId.trim() || null : null,
        bankAccountName: typeof body.bankAccountName === "string" ? body.bankAccountName.trim() || null : null,
        bankAccountNumber: typeof body.bankAccountNumber === "string" ? body.bankAccountNumber.trim() || null : null,
        bankName: typeof body.bankName === "string" ? body.bankName.trim() || null : null,
        category: typeof body.category === "string" ? body.category.trim() || null : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "vendor",
      entityId: vendor.id,
      changes: { after: vendor },
      request,
    });

    return NextResponse.json({ vendor: { ...vendor, requestCount: 0, quotationCount: 0, purchaseOrderCount: 0, invoiceCount: 0 } }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
