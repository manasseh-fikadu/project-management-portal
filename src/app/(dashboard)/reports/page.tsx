"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, Download, Loader2 } from "lucide-react";

type Project = { id: string; name: string };
type Donor = { id: string; name: string };

type ReportType = "project-summary" | "financial" | "donor";
type Format = "pdf" | "excel";

export default function ReportsPage() {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<ReportType>("project-summary");
  const [format, setFormat] = useState<Format>("pdf");
  const [projectId, setProjectId] = useState("");
  const [donorId, setDonorId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/projects"), fetch("/api/donors")])
      .then(([pRes, dRes]) => Promise.all([pRes.json(), dRes.json()]))
      .then(([pData, dData]) => {
        setProjects(pData.projects || []);
        setDonors(dData.donors || []);
      });
  }, []);

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

  const needsProject = reportType === "project-summary";
  const optionalProject = reportType === "financial";
  const needsDonor = reportType === "donor";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("reports.title")}</h1>
        <p className="text-muted-foreground">
          {t("reports.description")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report Type Cards */}
        <Card
          className={`cursor-pointer transition-all ${reportType === "project-summary" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => { setReportType("project-summary"); setDonorId(""); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {t("reports.project_summary")}
            </CardTitle>
            <CardDescription>
              {t("reports.project_summary_desc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${reportType === "financial" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => { setReportType("financial"); setDonorId(""); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5" />
              {t("reports.financial_report")}
            </CardTitle>
            <CardDescription>
              {t("reports.financial_report_desc")}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${reportType === "donor" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => { setReportType("donor"); setProjectId(""); }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {t("reports.donor_report")}
            </CardTitle>
            <CardDescription>
              {t("reports.donor_report_desc")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.configure")}</CardTitle>
          <CardDescription>{t("reports.configure_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Project selector */}
            {(needsProject || optionalProject) && (
              <div className="space-y-2">
                <Label>{needsProject ? t("reports.project_required") : t("reports.project_optional")}</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
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

            {/* Donor selector */}
            {needsDonor && (
              <div className="space-y-2">
                <Label>{t("reports.donor_label")}</Label>
                <Select value={donorId} onValueChange={setDonorId}>
                  <SelectTrigger>
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

            {/* Format selector */}
            <div className="space-y-2">
              <Label>{t("reports.format_label")}</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">{t("reports.format_pdf")}</SelectItem>
                  <SelectItem value="excel">{t("reports.format_excel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-6">
            <Button onClick={handleGenerate} disabled={generating}>
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
        </CardContent>
      </Card>
    </div>
  );
}
