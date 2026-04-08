"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, Download, Loader2, Leaf } from "lucide-react";

type Project = { id: string; name: string };
type Donor = { id: string; name: string };

type ReportType = "project-summary" | "financial" | "donor" | "agra-budget-breakdown" | "eif-cpd-annex" | "ppg-boost";
type Format = "pdf" | "excel";
type TemplateScope = "full-package" | "workplan-only" | "budget-only" | "working-doc" | "cost-build-up";

type TemplatePreview = {
  readinessScore: number;
  missingFields: string[];
  warnings: string[];
  summary: string[];
  explicitCounts: {
    results: number;
    budgetLines: number;
    transactions: number;
  };
  derivedCounts: {
    results: number;
    budgetLines: number;
    transactions: number;
  };
};

const reportTypes: { id: ReportType; icon: React.ElementType; tKey: string; descKey: string }[] = [
  { id: "project-summary", icon: FileText, tKey: "reports.project_summary", descKey: "reports.project_summary_desc" },
  { id: "financial", icon: FileSpreadsheet, tKey: "reports.financial_report", descKey: "reports.financial_report_desc" },
  { id: "donor", icon: FileText, tKey: "reports.donor_report", descKey: "reports.donor_report_desc" },
  { id: "agra-budget-breakdown", icon: FileSpreadsheet, tKey: "reports.agra_budget_breakdown", descKey: "reports.agra_budget_breakdown_desc" },
  { id: "eif-cpd-annex", icon: FileSpreadsheet, tKey: "reports.eif_annex", descKey: "reports.eif_annex_desc" },
  { id: "ppg-boost", icon: FileSpreadsheet, tKey: "reports.ppg_boost", descKey: "reports.ppg_boost_desc" },
];

function getDefaultTemplateScope(reportType: ReportType): TemplateScope {
  if (reportType === "agra-budget-breakdown") return "budget-only";
  if (reportType === "ppg-boost") return "full-package";
  return "full-package";
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [reportType, setReportType] = useState<ReportType>("project-summary");
  const [format, setFormat] = useState<Format>("pdf");
  const [projectId, setProjectId] = useState("");
  const [donorId, setDonorId] = useState("");
  const [scope, setScope] = useState<TemplateScope>("full-package");
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
  const [projects, setProjects] = useState<Project[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isTemplateReport = reportType === "agra-budget-breakdown" || reportType === "eif-cpd-annex" || reportType === "ppg-boost";
  const templateScopeOptions = useMemo(
    () => (
      reportType === "agra-budget-breakdown"
        ? [
            { value: "budget-only", label: t("reports.scope_budget_only") },
          ]
        : reportType === "eif-cpd-annex"
        ? [
            { value: "full-package", label: t("reports.scope_full_package") },
            { value: "workplan-only", label: t("reports.scope_workplan_only") },
            { value: "budget-only", label: t("reports.scope_budget_only") },
          ]
        : [
            { value: "full-package", label: t("reports.scope_full_package") },
            { value: "working-doc", label: t("reports.scope_working_doc") },
            { value: "cost-build-up", label: t("reports.scope_cost_build_up") },
          ]
    ),
    [reportType, t]
  );

  useEffect(() => {
    Promise.all([fetch("/api/projects"), fetch("/api/donors")])
      .then(([pRes, dRes]) => Promise.all([pRes.json(), dRes.json()]))
      .then(([pData, dData]) => {
        setProjects(pData.projects || []);
        setDonors(dData.donors || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const projectParam = searchParams.get("projectId");
    const templateParam = searchParams.get("template");

    if (projectParam) setProjectId(projectParam);
    if (templateParam === "agra-budget-breakdown" || templateParam === "eif-cpd-annex" || templateParam === "ppg-boost") {
      setReportType(templateParam);
      setScope(getDefaultTemplateScope(templateParam));
      setFormat("excel");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isTemplateReport) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    setFormat("excel");
    if (!projectId) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const annualYearNumber = Number(annualYear);
    if (!Number.isFinite(annualYearNumber)) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    fetch(`/api/reports/template/preview?projectId=${projectId}&template=${reportType}&scope=${scope}&annualYear=${annualYearNumber}`)
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? t("reports.error_generate_failed"));
        }
        return res.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setPreview(payload.preview ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : t("reports.error_generic"));
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [annualYear, isTemplateReport, projectId, reportType, scope, t]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);

    try {
      let url: string;
      if (reportType === "project-summary") {
        if (!projectId) {
          setError(t("reports.error_select_project"));
          return;
        }
        url = `/api/reports/project-summary?projectId=${projectId}&format=${format}`;
      } else if (reportType === "financial") {
        url = `/api/reports/financial?format=${format}${projectId && projectId !== "all" ? `&projectId=${projectId}` : ""}`;
      } else if (reportType === "agra-budget-breakdown" || reportType === "eif-cpd-annex" || reportType === "ppg-boost") {
        if (!projectId) {
          setError(t("reports.error_select_project"));
          return;
        }
        url = `/api/reports/template?projectId=${projectId}&template=${reportType}&scope=${scope}&annualYear=${annualYear}&format=excel`;
      } else {
        if (!donorId) {
          setError(t("reports.error_select_donor"));
          return;
        }
        url = `/api/reports/donor?donorId=${donorId}&format=${format}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("reports.error_generate_failed"));
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] ?? `report.${format === "excel" ? "xlsx" : "pdf"}`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reports.error_generic"));
    } finally {
      setGenerating(false);
    }
  }

  const needsProject = reportType === "project-summary" || isTemplateReport;
  const optionalProject = reportType === "financial";
  const needsDonor = reportType === "donor";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("reports.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">{t("reports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("reports.description")}</p>
      </header>

      {/* Report type selector */}
      <div className="grid gap-4 lg:grid-cols-3 mb-8">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          const isActive = reportType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => {
                setReportType(rt.id);
                if (rt.id === "agra-budget-breakdown" || rt.id === "eif-cpd-annex" || rt.id === "ppg-boost") {
                  setScope(getDefaultTemplateScope(rt.id));
                }
                if (rt.id !== "donor") setDonorId("");
                if (rt.id === "donor") setProjectId("");
                if (rt.id === "agra-budget-breakdown" || rt.id === "eif-cpd-annex" || rt.id === "ppg-boost") setFormat("excel");
              }}
              className={`text-left rounded-2xl p-5 transition-all duration-200 ${
                isActive
                  ? "bg-card ring-2 ring-primary shadow-md"
                  : "bg-card hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-xl ${isActive ? "bg-sage-pale" : "bg-muted"}`}>
                  <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <h3 className="font-serif text-lg text-foreground">{t(rt.tKey)}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(rt.descKey)}</p>
            </button>
          );
        })}
      </div>

      {/* Configuration */}
      <div className="bg-card rounded-2xl p-6">
        <div className="mb-5">
          <h2 className="font-serif text-xl text-foreground">{t("reports.configure")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("reports.configure_desc")}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(needsProject || optionalProject) && (
            <div className="space-y-2">
              <Label>{needsProject ? t("reports.project_required") : t("reports.project_optional")}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("reports.select_project")} />
                </SelectTrigger>
                <SelectContent>
                  {optionalProject && <SelectItem value="all">{t("reports.all_projects_portfolio")}</SelectItem>}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsDonor && (
            <div className="space-y-2">
              <Label>{t("reports.donor_label")}</Label>
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("reports.select_donor")} />
                </SelectTrigger>
                <SelectContent>
                  {donors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("reports.format_label")}</Label>
            <Select value={isTemplateReport ? "excel" : format} onValueChange={(v) => setFormat(v as Format)} disabled={isTemplateReport}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">{t("reports.format_pdf")}</SelectItem>
                <SelectItem value="excel">{t("reports.format_excel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isTemplateReport && (
            <>
              <div className="space-y-2">
                <Label>{t("reports.scope_label")}</Label>
                <Select value={scope} onValueChange={(value) => setScope(value as TemplateScope)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateScopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("reports.annual_year_label")}</Label>
                <Input
                  className="rounded-xl"
                  inputMode="numeric"
                  value={annualYear}
                  onChange={(event) => setAnnualYear(event.target.value)}
                  placeholder="2026"
                />
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-pale px-4 py-3">
            <p className="text-sm text-rose-muted">{error}</p>
          </div>
        )}

        {isTemplateReport && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-serif text-lg text-foreground">{t("reports.readiness_title")}</h3>
                <p className="text-sm text-muted-foreground">{t("reports.readiness_desc")}</p>
              </div>
              {preview && (
                <div className="rounded-full bg-card px-3 py-1 text-sm font-semibold text-foreground">
                  {t("reports.readiness_score", { score: preview.readinessScore })}
                </div>
              )}
            </div>

            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("reports.loading_preview")}
              </div>
            )}

            {!previewLoading && previewError && (
              <p className="text-sm text-rose-muted">{previewError}</p>
            )}

            {!previewLoading && !previewError && !projectId && (
              <p className="text-sm text-muted-foreground">{t("reports.preview_select_project")}</p>
            )}

            {!previewLoading && preview && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-card px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("reports.preview_explicit_rows")}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {preview.explicitCounts.results + preview.explicitCounts.budgetLines + preview.explicitCounts.transactions}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("reports.preview_backfilled_rows")}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {preview.derivedCounts.results + preview.derivedCounts.budgetLines + preview.derivedCounts.transactions}
                    </p>
                  </div>
                  <div className="rounded-xl bg-card px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("reports.preview_missing_count")}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{preview.missingFields.length}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">{t("reports.missing_fields_title")}</p>
                    {preview.missingFields.length > 0 ? (
                      <ul className="space-y-1 text-sm text-rose-muted">
                        {preview.missingFields.map((field) => (
                          <li key={field}>- {field}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-primary">{t("reports.no_missing_fields")}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">{t("reports.warnings_title")}</p>
                    {preview.warnings.length > 0 ? (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {preview.warnings.map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-primary">{t("reports.no_warnings")}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">{t("reports.preview_summary")}</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {preview.summary.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <Button onClick={handleGenerate} disabled={generating} className="rounded-xl">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("reports.generating")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.generate_download")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
