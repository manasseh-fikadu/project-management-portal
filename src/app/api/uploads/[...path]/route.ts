import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: pathSegments } = await params;
    const filePath = path.join(process.cwd(), "uploads", ...pathSegments);

    const file = await readFile(filePath);

    const extension = pathSegments[pathSegments.length - 1].split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      txt: "text/plain",
    };

    const contentType = mimeTypes[extension] || "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${pathSegments[pathSegments.length - 1]}"`,
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
