import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { parseAgraBudgetWorkbook } from "@/lib/project-budget-import";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An .xlsx file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseAgraBudgetWorkbook(buffer);

    return NextResponse.json({
      preview: {
        name: parsed.name,
        description: parsed.description,
        totalBudget: parsed.totalBudget,
        budgetYear: parsed.budgetYear,
        sourceSheet: parsed.sourceSheet,
        allocationCount: parsed.allocations.length,
        sampleAllocations: parsed.allocations.slice(0, 8).map((allocation) => ({
          activityName: allocation.activityName,
          plannedAmount: allocation.plannedAmount,
        })),
      },
    });
  } catch (error) {
    console.error("Error previewing project import:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unsupported workbook format") || message.includes("required") || message.includes("supported")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
