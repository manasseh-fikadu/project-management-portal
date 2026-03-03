import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDonorReportData } from "@/lib/reports/data";
import { renderDonorReportPdf } from "@/lib/reports/pdf";
import { renderDonorReportExcel } from "@/lib/reports/excel";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get("donorId");
    const format = searchParams.get("format") ?? "pdf";

    if (!donorId) {
      return NextResponse.json({ error: "donorId is required" }, { status: 400 });
    }

    const data = await getDonorReportData(donorId);
    if (!data) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    const safeName = data.donor.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "excel") {
      const buffer = await renderDonorReportExcel(data);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="donor-report-${safeName}.xlsx"`,
        },
      });
    }

    const buffer = await renderDonorReportPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="donor-report-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating donor report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
