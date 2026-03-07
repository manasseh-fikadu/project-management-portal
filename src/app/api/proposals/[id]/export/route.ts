import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTorExportData, renderTorDocx, renderTorPdf } from "@/lib/proposal-export";

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
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "pdf").toLowerCase();

    if (format !== "pdf" && format !== "docx") {
      return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
    }

    const data = await getTorExportData(id);
    if (!data) {
      return NextResponse.json({ error: "ToR proposal not found" }, { status: 404 });
    }

    const safeName = data.proposal.title.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "docx") {
      const buffer = await renderTorDocx(data);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="tor-${safeName}.docx"`,
        },
      });
    }

    const buffer = await renderTorPdf(data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tor-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error exporting ToR:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
