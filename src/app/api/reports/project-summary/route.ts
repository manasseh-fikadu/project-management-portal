import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getProjectSummaryData } from "@/lib/reports/data";
import { renderProjectSummaryPdf } from "@/lib/reports/pdf";
import { renderProjectSummaryExcel } from "@/lib/reports/excel";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format") ?? "pdf";

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const data = await getProjectSummaryData(projectId);
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const safeName = data.project.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "excel") {
      const buffer = await renderProjectSummaryExcel(data);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="project-summary-${safeName}.xlsx"`,
        },
      });
    }

    const buffer = await renderProjectSummaryPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="project-summary-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating project summary report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
