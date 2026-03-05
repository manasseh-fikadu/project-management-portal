"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, Download, Loader2, Leaf } from "lucide-react";

type Project = { id: string; name: string };
type Donor = { id: string; name: string };

type ReportType = "project-summary" | "financial" | "donor";
type Format = "pdf" | "excel";

const reportTypes: { id: ReportType; icon: React.ElementType; tKey: string; descKey: string }[] = [
  { id: "project-summary", icon: FileText, tKey: "reports.project_summary", descKey: "reports.project_summary_desc" },
  { id: "financial", icon: FileSpreadsheet, tKey: "reports.financial_report", descKey: "reports.financial_report_desc" },
  { id: "donor", icon: FileText, tKey: "reports.donor_report", descKey: "reports.donor_report_desc" },
];

export default function ReportsPage() {
  const { t } = useTranslation();
  const [reportType, setReportType] = useState<ReportType>("project-summary");
  const [format, setFormat] = useState<Format>("pdf");
  const [projectId, setProjectId] = useState("");
  const [donorId, setDonorId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/projects"), fetch("/api/donors")])
      .then(([pRes, dRes]) => Promise.all([pRes.json(), dRes.json()]))
      .then(([pData, dData]) => {
        setProjects(pData.projects || []);
        setDonors(dData.donors || []);
      })
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Loading reports…</p>
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
                if (rt.id !== "donor") setDonorId("");
                if (rt.id === "donor") setProjectId("");
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
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="rounded-xl">
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
          <div className="mt-4 rounded-xl bg-rose-pale px-4 py-3">
            <p className="text-sm text-rose-muted">{error}</p>
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
