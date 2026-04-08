import { NextRequest, NextResponse } from "next/server";
import { db, reportingProfiles } from "@/db";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { ensureEditAccess } from "@/lib/rbac";
import { logAuditEvent } from "@/lib/audit";
import { hasReportingTables, isMissingReportingTableError } from "@/lib/reports/schema-availability";

const TEMPLATE_VALUES = new Set(["agra_budget_breakdown", "eif_cpd_annex", "ppg_boost"]);
const CURRENCY_VALUES = new Set(["ETB", "USD", "EUR"]);

function asNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNullableDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function asNullableYear(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 2000 && rounded <= 2100 ? rounded : undefined;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await hasReportingTables())) {
      return NextResponse.json({ profile: null, available: false });
    }

    const profile = await db.query.reportingProfiles.findFirst({
      where: eq(reportingProfiles.projectId, id),
    });

    return NextResponse.json({ profile: profile ?? null, available: true });
  } catch (error) {
    if (isMissingReportingTableError(error)) {
      return NextResponse.json({ profile: null, available: false });
    }
    console.error("Error fetching reporting profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accessError = ensureEditAccess(session?.user);
    if (accessError) return accessError;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!(await hasReportingTables())) {
      return NextResponse.json(
        { error: "Reporting tables are not available yet. Apply the reporting schema update before saving reporting settings." },
        { status: 503 }
      );
    }

    const payload = await request.json() as Record<string, unknown>;
    const existing = await db.query.reportingProfiles.findFirst({
      where: eq(reportingProfiles.projectId, id),
    });

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    const primaryTemplate = asNullableString(payload.primaryTemplate);
    if (primaryTemplate !== undefined) {
      if (primaryTemplate !== null && !TEMPLATE_VALUES.has(primaryTemplate)) {
        return NextResponse.json({ error: "Invalid primaryTemplate" }, { status: 400 });
      }
      updateData.primaryTemplate = primaryTemplate ?? "eif_cpd_annex";
    }

    const currency = asNullableString(payload.currency);
    if (currency !== undefined) {
      if (currency !== null && !CURRENCY_VALUES.has(currency)) {
        return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
      }
      updateData.currency = currency ?? "ETB";
    }

    const stringFields = [
      "country",
      "fundingFacility1Label",
      "fundingFacility2Label",
      "otherFundingLabel",
      "leadAgency",
      "implementingPartner",
      "procurementNotes",
    ] as const;

    for (const field of stringFields) {
      const value = asNullableString(payload[field]);
      if (value !== undefined) {
        updateData[field] = value;
      }
    }

    const reportingStartDate = asNullableDate(payload.reportingStartDate);
    if (reportingStartDate !== undefined) updateData.reportingStartDate = reportingStartDate;

    const reportingEndDate = asNullableDate(payload.reportingEndDate);
    if (reportingEndDate !== undefined) updateData.reportingEndDate = reportingEndDate;

    const annualYear = asNullableYear(payload.annualYear);
    if (annualYear !== undefined) updateData.annualYear = annualYear;

    if (payload.metadata !== undefined) {
      if (payload.metadata !== null && (typeof payload.metadata !== "object" || Array.isArray(payload.metadata))) {
        return NextResponse.json({ error: "metadata must be an object or null" }, { status: 400 });
      }
      updateData.metadata = payload.metadata;
    }

    let profile;
    if (existing) {
      [profile] = await db
        .update(reportingProfiles)
        .set(updateData)
        .where(eq(reportingProfiles.projectId, id))
        .returning();
    } else {
      [profile] = await db
        .insert(reportingProfiles)
        .values({
          projectId: id,
          primaryTemplate: (updateData.primaryTemplate as "agra_budget_breakdown" | "eif_cpd_annex" | "ppg_boost" | undefined) ?? "eif_cpd_annex",
          currency: (updateData.currency as string | undefined) ?? "ETB",
          country: (updateData.country as string | null | undefined) ?? null,
          reportingStartDate: (updateData.reportingStartDate as Date | null | undefined) ?? null,
          reportingEndDate: (updateData.reportingEndDate as Date | null | undefined) ?? null,
          annualYear: (updateData.annualYear as number | null | undefined) ?? null,
          fundingFacility1Label: (updateData.fundingFacility1Label as string | null | undefined) ?? null,
          fundingFacility2Label: (updateData.fundingFacility2Label as string | null | undefined) ?? null,
          otherFundingLabel: (updateData.otherFundingLabel as string | null | undefined) ?? null,
          leadAgency: (updateData.leadAgency as string | null | undefined) ?? null,
          implementingPartner: (updateData.implementingPartner as string | null | undefined) ?? null,
          procurementNotes: (updateData.procurementNotes as string | null | undefined) ?? null,
          metadata: (updateData.metadata as Record<string, unknown> | null | undefined) ?? null,
        })
        .returning();
    }

    await logAuditEvent({
      actorUserId: session.userId,
      action: existing ? "update" : "create",
      entityType: "reporting_profile",
      entityId: profile.id,
      changes: { before: existing, after: profile },
      request,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    if (isMissingReportingTableError(error)) {
      return NextResponse.json(
        { error: "Reporting tables are not available yet. Apply the reporting schema update before saving reporting settings." },
        { status: 503 }
      );
    }
    console.error("Error updating reporting profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
