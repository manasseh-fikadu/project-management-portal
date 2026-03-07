import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db, budgetAllocations, projectDocuments, projectDonors, projectMembers, projects } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { parseAgraBudgetWorkbook } from "@/lib/project-budget-import";
import { R2_BUCKET, R2_PUBLIC_URL, r2Client } from "@/lib/storage";

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
    const managerIdValue = formData.get("managerId");
    const statusValue = formData.get("status");
    const donorIdsRaw = formData.get("donorIds");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "An .xlsx file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseAgraBudgetWorkbook(buffer);
    const assignedManagerId = typeof managerIdValue === "string" && managerIdValue ? managerIdValue : session.userId;
    const projectStatus = typeof statusValue === "string" && statusValue ? statusValue : "planning";
    const donorIds = typeof donorIdsRaw === "string"
      ? (() => {
          try {
            const parsedValue = JSON.parse(donorIdsRaw);
            return Array.isArray(parsedValue)
              ? parsedValue.filter((value): value is string => typeof value === "string" && value.length > 0)
              : [];
          } catch {
            return [];
          }
        })()
      : [];

    const result = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          name: parsed.name,
          description: parsed.description,
          donorId: donorIds[0] ?? null,
          totalBudget: parsed.totalBudget,
          managerId: assignedManagerId,
          status: projectStatus as "planning" | "active" | "on_hold" | "completed" | "cancelled",
        })
        .returning();

      await tx.insert(projectMembers).values({
        projectId: project.id,
        userId: assignedManagerId,
        role: "manager",
      });

      await tx.insert(budgetAllocations).values(
        parsed.allocations.map((allocation) => ({
          projectId: project.id,
          activityName: allocation.activityName,
          plannedAmount: allocation.plannedAmount,
          q1Amount: allocation.q1,
          q2Amount: allocation.q2,
          q3Amount: allocation.q3,
          q4Amount: allocation.q4,
          notes: allocation.notes,
          createdBy: session.userId,
        }))
      );

      if (donorIds.length > 0) {
        await tx.insert(projectDonors).values(
          donorIds.map((donorId) => ({
            projectId: project.id,
            donorId,
            status: "active" as const,
          }))
        );
      }

      const fileExtension = file.name.split(".").pop() || "xlsx";
      const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExtension}`;
      const objectKey = `${project.id}/${storedFileName}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: objectKey,
          Body: buffer,
          ContentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const fileUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${objectKey}` : `/uploads/${objectKey}`;

      const [document] = await tx
        .insert(projectDocuments)
        .values({
          projectId: project.id,
          name: file.name,
          type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          url: fileUrl,
          size: file.size,
          uploadedBy: session.userId,
        })
        .returning();

      return {
        project,
        document,
        importSummary: {
          sourceSheet: parsed.sourceSheet,
          budgetYear: parsed.budgetYear,
          allocationCount: parsed.allocations.length,
          donorCount: donorIds.length,
        },
      };
    });

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "project",
      entityId: result.project.id,
      changes: {
        after: result.project,
        importSummary: result.importSummary,
        sourceFileName: file.name,
        sourceDocumentId: result.document.id,
      },
      request,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error importing project from workbook:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unsupported workbook format") || message.includes("required") || message.includes("supported")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
