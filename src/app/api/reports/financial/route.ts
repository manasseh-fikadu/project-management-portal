import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFinancialReportData } from "@/lib/reports/data";
import { renderFinancialReportPdf } from "@/lib/reports/pdf";
import { renderFinancialReportExcel } from "@/lib/reports/excel";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const format = searchParams.get("format") ?? "pdf";

    const data = await getFinancialReportData(projectId);

    const fileName = projectId ? `financial-report-project` : `financial-report-portfolio`;

    if (format === "excel") {
      const buffer = await renderFinancialReportExcel(data);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
        },
      });
    }

    const buffer = await renderFinancialReportPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating financial report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
