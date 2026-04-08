import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { db, budgetAllocations, projectDocuments, projectDonors, projectMembers, projects, reportingProfiles } from "@/db";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { parseProjectBudgetWorkbook } from "@/lib/project-budget-import";
import { hasReportingTables } from "@/lib/reports/schema-availability";
import { R2_BUCKET, R2_PUBLIC_URL, r2Client } from "@/lib/storage";

const PROJECT_STATUSES = new Set(["planning", "active", "on_hold", "completed", "cancelled"]);

function normalizeActivityNameForStorage(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 255) return normalized;
  return `${normalized.slice(0, 252).trimEnd()}...`;
}

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
    const parsed = await parseProjectBudgetWorkbook(buffer, file.name);
    const reportingTablesAvailable = await hasReportingTables();
    const assignedManagerId = typeof managerIdValue === "string" && managerIdValue ? managerIdValue : session.userId;
    let projectStatus = "planning";
    if (statusValue !== null) {
      if (typeof statusValue !== "string" || !statusValue) {
        return NextResponse.json({ error: "status must be a non-empty string when provided" }, { status: 400 });
      }

      if (!PROJECT_STATUSES.has(statusValue)) {
        return NextResponse.json(
          { error: "status must be one of planning, active, on_hold, completed, or cancelled" },
          { status: 400 }
        );
      }

      projectStatus = statusValue;
    }

    let donorIds: string[] = [];
    if (donorIdsRaw !== null) {
      if (typeof donorIdsRaw !== "string") {
        return NextResponse.json({ error: "donorIds must be a JSON array of donor id strings" }, { status: 400 });
      }

      let parsedDonorIds: unknown;
      try {
        parsedDonorIds = JSON.parse(donorIdsRaw);
      } catch {
        return NextResponse.json({ error: "donorIds must be valid JSON" }, { status: 400 });
      }

      if (!Array.isArray(parsedDonorIds) || !parsedDonorIds.every((value) => typeof value === "string" && value.length > 0)) {
        return NextResponse.json(
          { error: "donorIds must be a JSON array of non-empty strings" },
          { status: 400 }
        );
      }

      donorIds = parsedDonorIds;
    }

    const normalizedAllocations = parsed.allocations.map((allocation) => ({
      ...allocation,
      activityName: normalizeActivityNameForStorage(allocation.activityName),
    }));

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
        normalizedAllocations.map((allocation) => ({
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

      if (reportingTablesAvailable) {
        await tx.insert(reportingProfiles).values({
          projectId: project.id,
          primaryTemplate: parsed.reportingDefaults.primaryTemplate,
          currency: parsed.reportingDefaults.currency,
          country: parsed.reportingDefaults.country,
          reportingStartDate: parsed.reportingDefaults.reportingStartDate,
          reportingEndDate: parsed.reportingDefaults.reportingEndDate,
          annualYear: parsed.reportingDefaults.annualYear,
          fundingFacility1Label: parsed.reportingDefaults.fundingFacility1Label,
          fundingFacility2Label: parsed.reportingDefaults.fundingFacility2Label,
          otherFundingLabel: parsed.reportingDefaults.otherFundingLabel,
          leadAgency: parsed.reportingDefaults.leadAgency,
          implementingPartner: parsed.reportingDefaults.implementingPartner,
          procurementNotes: parsed.reportingDefaults.procurementNotes,
        });
      }

      if (donorIds.length > 0) {
        await tx.insert(projectDonors).values(
          donorIds.map((donorId) => ({
            projectId: project.id,
            donorId,
            status: "active" as const,
          }))
        );
      }

      return {
        project,
        importSummary: {
          templateId: parsed.templateId,
          templateLabel: parsed.templateLabel,
          sourceSheet: parsed.sourceSheet,
          budgetYear: parsed.budgetYear,
          allocationCount: parsed.allocations.length,
          donorCount: donorIds.length,
        },
      };
    });

    const fileExtension = file.name.split(".").pop() || "xlsx";
    const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExtension}`;
    const objectKey = `${result.project.id}/${storedFileName}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );

    const fileUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${objectKey}` : `/uploads/${objectKey}`;

    let document;
    try {
      [document] = await db
        .insert(projectDocuments)
        .values({
          projectId: result.project.id,
          name: file.name,
          type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          url: fileUrl,
          size: file.size,
          uploadedBy: session.userId,
        })
        .returning();
    } catch (documentError) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: objectKey,
          })
        );
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded import workbook after document insert failure:", cleanupError);
      }

      throw documentError;
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: "create",
      entityType: "project",
      entityId: result.project.id,
      changes: {
        after: result.project,
        importSummary: result.importSummary,
        sourceFileName: file.name,
        sourceDocumentId: document.id,
      },
      request,
    });

    return NextResponse.json({ ...result, document }, { status: 201 });
  } catch (error) {
    console.error("Error importing project from workbook:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("Unsupported workbook format") || message.includes("required") || message.includes("supported")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
