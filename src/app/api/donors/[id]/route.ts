import { NextRequest, NextResponse } from "next/server";
import { db, donors } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

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
    const donor = await db.query.donors.findFirst({
      where: eq(donors.id, id),
      with: {
        proposals: true,
      },
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json({ donor });
  } catch (error) {
    console.error("Error fetching donor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const [updatedDonor] = await db
      .update(donors)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(donors.id, id))
      .returning();

    if (!updatedDonor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json({ donor: updatedDonor });
  } catch (error) {
    console.error("Error updating donor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [deletedDonor] = await db.delete(donors).where(eq(donors.id, id)).returning();

    if (!deletedDonor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting donor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
