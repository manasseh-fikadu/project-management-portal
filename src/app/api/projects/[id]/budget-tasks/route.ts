import { NextRequest, NextResponse } from "next/server";
import { db, budgetAllocations, tasks } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessProject, ensureEditAccess } from "@/lib/rbac";
import { buildBudgetLineTaskDescription, buildBudgetLineTaskTitle } from "@/lib/budget-line-tasks";

export async function POST(
  _request: NextRequest,
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
    const hasAccess = await canAccessProject(session.user, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectBudgetLines = await db.query.budgetAllocations.findMany({
      where: eq(budgetAllocations.projectId, id),
      with: {
        task: true,
      },
    });

    const missingTaskBudgetLines = projectBudgetLines.filter((line) => !line.task);

    if (missingTaskBudgetLines.length === 0) {
      return NextResponse.json({ createdCount: 0 });
    }

    const insertedTasks = await db.insert(tasks).values(
      missingTaskBudgetLines.map((line) => ({
        projectId: id,
        budgetAllocationId: line.id,
        title: buildBudgetLineTaskTitle(line.activityName),
        description: buildBudgetLineTaskDescription(line.notes),
        assignedTo: line.assignedTo ?? null,
        createdBy: session.userId,
      }))
    )
      .onConflictDoNothing({ target: tasks.budgetAllocationId })
      .returning({ id: tasks.id });

    return NextResponse.json({ createdCount: insertedTasks.length });
  } catch (error) {
    console.error("Error creating tasks from budget lines:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
