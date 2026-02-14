import { NextRequest, NextResponse } from "next/server";
import { db, projectDocuments } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const documents = await db.query.projectDocuments.findMany({
      where: eq(projectDocuments.projectId, id),
      with: {
        uploader: {
          columns: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: (docs, { desc }) => [desc(docs.createdAt)],
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), "uploads", id);
    await mkdir(uploadsDir, { recursive: true });

    const fileExtension = file.name.split(".").pop() || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const [document] = await db
      .insert(projectDocuments)
      .values({
        projectId: id,
        name: name || file.name,
        type: file.type || "application/octet-stream",
        url: `/uploads/${id}/${fileName}`,
        size: file.size,
        uploadedBy: session.userId,
      })
      .returning();

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
