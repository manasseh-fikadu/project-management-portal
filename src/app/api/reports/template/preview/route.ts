import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReportingTemplateData, type ReportingTemplateId, type ReportingTemplateScope } from "@/lib/reports/template-data";
import { canAccessProject } from "@/lib/rbac";

const TEMPLATE_IDS = new Set<ReportingTemplateId>(["agra-budget-breakdown", "eif-cpd-annex", "ppg-boost"]);
const SCOPES = new Set<ReportingTemplateScope>(["full-package", "workplan-only", "budget-only", "working-doc", "cost-build-up"]);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const template = searchParams.get("template");
    const scope = searchParams.get("scope") ?? "full-package";
    const annualYearParam = searchParams.get("annualYear");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const hasAccess = await canAccessProject(session.user, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!template || !TEMPLATE_IDS.has(template as ReportingTemplateId)) {
      return NextResponse.json({ error: "template must be one of agra-budget-breakdown, eif-cpd-annex, or ppg-boost" }, { status: 400 });
    }

    if (!SCOPES.has(scope as ReportingTemplateScope)) {
      return NextResponse.json({ error: "Invalid reporting scope" }, { status: 400 });
    }

    const annualYear = annualYearParam ? Number(annualYearParam) : undefined;
    if (annualYearParam && (!Number.isFinite(annualYear) || annualYear! < 2000 || annualYear! > 2100)) {
      return NextResponse.json({ error: "annualYear must be a valid year" }, { status: 400 });
    }

    const data = await getReportingTemplateData(projectId, template as ReportingTemplateId, scope as ReportingTemplateScope, annualYear);
    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      preview: data.preview,
      project: data.project,
      profile: data.profile,
      annualYear: data.annualYear,
      years: data.years,
    });
  } catch (error) {
    console.error("Error previewing reporting template workbook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
