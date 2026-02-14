import { NextRequest, NextResponse } from "next/server";
import { db, milestones } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { milestoneId } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };

    if (body.dueDate) {
      updateData.dueDate = new Date(body.dueDate);
    }

    if (body.status === "completed" && !body.completedAt) {
      updateData.completedAt = new Date();
    }

    const [updatedMilestone] = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, milestoneId))
      .returning();

    if (!updatedMilestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({ milestone: updatedMilestone });
  } catch (error) {
    console.error("Error updating milestone:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { milestoneId } = await params;

    const [deletedMilestone] = await db.delete(milestones).where(eq(milestones.id, milestoneId)).returning();

    if (!deletedMilestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
