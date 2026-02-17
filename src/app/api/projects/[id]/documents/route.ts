import { NextRequest, NextResponse } from "next/server";
import { db, projectDocuments } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/storage";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        let key = doc.url;
        if (R2_PUBLIC_URL && doc.url.startsWith(R2_PUBLIC_URL)) {
          key = doc.url.replace(`${R2_PUBLIC_URL}/`, "");
        } else if (doc.url.startsWith("/uploads/")) {
          key = doc.url.replace("/uploads/", "");
        }
        const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
        const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
        return { ...doc, url: signedUrl };
      })
    );

    return NextResponse.json({ documents: documentsWithUrls });
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
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

    const fileExtension = file.name.split(".").pop() || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const key = `${id}/${fileName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const fileUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/uploads/${key}`;

    const [document] = await db
      .insert(projectDocuments)
      .values({
        projectId: id,
        name: name || file.name,
        type: file.type || "application/octet-stream",
        url: fileUrl,
        size: file.size,
        uploadedBy: session.userId,
      })
      .returning();

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "project_document",
      entityId: document.id,
      changes: { after: document },
      request,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
