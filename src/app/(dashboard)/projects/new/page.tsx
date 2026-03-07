"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Upload,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  ClipboardList,
  ListTodo,
  Users,
  Eye,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/currency";

type MilestoneInput = {
  title: string;
  description: string;
  dueDate: string;
};

type TaskInput = {
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  assignedTo: string;
};

type Donor = {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type ImportPreview = {
  name: string;
  description: string | null;
  totalBudget: number;
  budgetYear: number | null;
  sourceSheet: string;
  allocationCount: number;
  sampleAllocations: Array<{
    activityName: string;
    plannedAmount: number;
  }>;
};

const STEPS = [
  { id: 0, label: "site.details", fullLabel: "site.project_details", icon: ClipboardList },
  { id: 1, label: "site.tasks", fullLabel: "site.tasks_and_activities", icon: ListTodo },
  { id: 2, label: "site.donors", fullLabel: "site.donors_and_documents", icon: Users },
  { id: 3, label: "site.review", fullLabel: "site.review_and_submit", icon: Eye },
];

const priorityLabels: Record<string, string> = {
  low: "site.low",
  medium: "site.medium",
  high: "site.high",
};

const priorityConfig: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-muted", text: "text-muted-foreground" },
  medium: { bg: "bg-amber-pale", text: "text-amber-warm" },
  high: { bg: "bg-rose-pale", text: "text-rose-muted" },
};

const statusLabels: Record<string, string> = {
  planning: "site.planning",
  active: "site.active",
  on_hold: "site.on_hold",
  completed: "site.completed",
  cancelled: "site.cancelled",
};

function formatLocalDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export default function NewProjectPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [taskInputs, setTaskInputs] = useState<TaskInput[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedDonorIds, setSelectedDonorIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    managerId: "",
    totalBudget: "",
    status: "planning",
    startDate: "",
    endDate: "",
  });

  const fetchDonors = useCallback(async () => {
    try {
      const res = await fetch("/api/donors");
      const data = await res.json();
      if (data.donors) setDonors(data.donors);
    } catch (err) {
      console.error(t("site.error_fetching_donors"), err);
    }
  }, [t]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error(t("site.error_fetching_users"), err);
    }
  }, [t]);

  useEffect(() => {
    fetchDonors();
    fetchUsers();
  }, [fetchDonors, fetchUsers]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setPreviewingImport(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const res = await fetch("/api/projects/import/preview", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("site.failed_to_preview_import"));

      setImportFile(file);
      setImportPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("site.an_error_occurred"));
    } finally {
      setPreviewingImport(false);
      if (importFileInputRef.current) importFileInputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (!importFile) return;

    setError(null);
    setImporting(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", importFile);
      if (formData.managerId) uploadFormData.append("managerId", formData.managerId);
      if (formData.status) uploadFormData.append("status", formData.status);
      uploadFormData.append("donorIds", JSON.stringify(selectedDonorIds));

      const res = await fetch("/api/projects/import", {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("site.failed_to_import_project"));

      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("site.an_error_occurred"));
    } finally {
      setImporting(false);
    }
  }

  function clearImportPreview() {
    setImportFile(null);
    setImportPreview(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addMilestone() {
    setMilestones((prev) => [
      ...prev,
      { title: "", description: "", dueDate: "" },
    ]);
  }
  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }
  function updateMilestone(
    index: number,
    field: keyof MilestoneInput,
    value: string
  ) {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  function addTask() {
    setTaskInputs((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        assignedTo: "",
      },
    ]);
  }
  function removeTask(index: number) {
    setTaskInputs((prev) => prev.filter((_, i) => i !== index));
  }
  function updateTask(index: number, field: keyof TaskInput, value: string) {
    setTaskInputs((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function canProceed(): boolean {
    if (currentStep === 0) {
      return formData.name.trim().length > 0;
    }
    return true;
  }

  function nextStep() {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep((s) => s + 1);
      setError(null);
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setError(null);
    }
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          donorIds: selectedDonorIds,
          managerId: formData.managerId || null,
          totalBudget: formData.totalBudget ? parseInt(formData.totalBudget) : 0,
          milestones: milestones.filter((m) => m.title.trim()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("site.failed_to_create_project"));

      const projectId = data.project.id;

      const validTasks = taskInputs.filter((t) => t.title.trim());
      for (const task of validTasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            dueDate: task.dueDate || null,
            assignedTo: task.assignedTo || null,
          }),
        });
      }

      if (files.length > 0) {
        for (const file of files) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          await fetch(`/api/projects/${projectId}/documents`, {
            method: "POST",
            body: uploadFormData,
          });
        }
      }

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("site.an_error_occurred"));
    } finally {
      setLoading(false);
    }
  }

  function getSelectedDonors(): Donor[] {
    return donors.filter((d) => selectedDonorIds.includes(d.id));
  }

  function toggleDonor(donorId: string) {
    setSelectedDonorIds((prev) =>
      prev.includes(donorId) ? prev.filter((id) => id !== donorId) : [...prev, donorId]
    );
  }

  function getSelectedManager(): UserOption | undefined {
    return users.find((u) => u.id === formData.managerId);
  }

  function getUserName(userId: string): string {
    const u = users.find((user) => user.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : t("site.unassigned");
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground -ml-3 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("site.back")}
        </Button>
        <h1 className="font-serif text-3xl text-foreground">{t("site.new_project")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("site.set_up_your_project_in_a_few_steps")}
        </p>
      </div>

      {/* Stepper */}
      <nav className="mb-10">
        <ol className="flex items-center">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <li
                key={step.id}
                className={`flex items-center ${idx < STEPS.length - 1 ? "flex-1" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) setCurrentStep(idx);
                  }}
                  disabled={!isCompleted && !isActive}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-sage-pale text-primary cursor-pointer hover:bg-primary/15"
                        : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0 ${
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : isCompleted
                          ? "bg-primary text-primary-foreground"
                          : "bg-border text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="hidden md:inline">{t(step.label)}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 transition-colors duration-200 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <div className="mb-6 p-4 text-sm text-destructive bg-rose-pale border border-rose-muted/20 rounded-xl">
          {error}
        </div>
      )}

      {/* Step 1: Project Details */}
      {currentStep === 0 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">{t("site.project_information")}</h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t("site.enter_the_basic_details_for_your_new_project")}
          </p>

          <div className="mb-8 rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(132,158,112,0.12),rgba(132,158,112,0.04))] p-6 lg:p-7">
            <div className="flex flex-col gap-4 border-b border-primary/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                  {t("site.quick_import")}
                </p>
                <h3 className="mt-2 font-serif text-[1.45rem] leading-tight text-foreground">{t("site.import_from_spreadsheet_template")}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("site.upload_a_supported_project_budget_workbook_to_review_the_parsed_structure_then_confirm_the_import_when_it_looks_right")}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                disabled={loading || importing || previewingImport}
                className="rounded-full px-5 shrink-0"
              >
                {previewingImport ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {previewingImport ? t("site.reading_template") : t("site.upload_template")}
              </Button>
            </div>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleImportFileChange}
              className="hidden"
            />
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("site.donor_links")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDonorIds.length > 0 ? (
                    getSelectedDonors().map((donor) => (
                      <Badge
                        key={donor.id}
                        variant="secondary"
                        className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10"
                      >
                        {donor.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("site.no_donors_selected_you_can_still_import_and_link_donors_later")}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full lg:w-80">
                <Select value="" onValueChange={toggleDonor}>
                  <SelectTrigger className="rounded-xl bg-card/80">
                    <SelectValue placeholder={t("site.link_donors_during_import")} />
                  </SelectTrigger>
                  <SelectContent>
                    {donors
                      .filter((donor) => donor.isActive)
                      .map((donor) => (
                        <SelectItem key={donor.id} value={donor.id}>
                          {donor.name} ({donor.type})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {importPreview && importFile && (
              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(19rem,0.9fr)]">
                <div className="rounded-[24px] bg-card/90 p-5 ring-1 ring-black/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
                      {t("site.import_preview")}
                    </p>
                    <Badge variant="secondary" className="rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary hover:bg-primary/10">
                      {t("site.ready_to_import")}
                    </Badge>
                  </div>
                  <h4 className="mt-3 max-w-3xl font-serif text-[1.9rem] leading-[1.2] text-foreground">
                    {importPreview.name}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {t("site.source_file")}: <span className="font-medium text-foreground">{importFile.name}</span>
                  </p>

                  {importPreview.description && (
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{importPreview.description}</p>
                  )}

                  <div className="mt-6">
                    <p className="mb-3 text-sm font-medium text-foreground">{t("site.sample_budget_lines")}</p>
                    <div className="space-y-2">
                      {importPreview.sampleAllocations.map((allocation) => (
                        <div
                          key={`${allocation.activityName}-${allocation.plannedAmount}`}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-sm"
                        >
                          <span className="min-w-0 text-foreground">{allocation.activityName}</span>
                          <span className="shrink-0 rounded-full bg-background px-3 py-1 font-medium text-foreground shadow-sm">
                            {formatCurrency(allocation.plannedAmount, "ETB")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] bg-card/90 p-4 ring-1 ring-black/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("site.year")}</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">{importPreview.budgetYear ?? t("site.n_a")}</div>
                    </div>
                    <div className="rounded-[22px] bg-card/90 p-4 ring-1 ring-black/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("site.sheet")}</div>
                      <div className="mt-2 text-base font-semibold leading-snug text-foreground">{importPreview.sourceSheet}</div>
                    </div>
                    <div className="rounded-[22px] bg-card/90 p-4 ring-1 ring-black/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("site.budget_lines")}</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">{importPreview.allocationCount}</div>
                    </div>
                    <div className="rounded-[22px] bg-card/90 p-4 ring-1 ring-black/5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("site.total_budget")}</div>
                      <div className="mt-2 text-base font-semibold leading-snug text-foreground">
                        {formatCurrency(importPreview.totalBudget, "ETB")}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-card/90 p-5 ring-1 ring-black/5">
                    <p className="text-sm font-medium text-foreground">{t("site.next_step")}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t("site.confirm_to_create_the_project_import_the_budget_lines_and_attach_the_uploaded_workbook_as_the_source_document")}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={loading || importing}
                        className="rounded-full px-5"
                      >
                        {importing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {importing ? t("site.creating_project") : t("site.confirm_import")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearImportPreview}
                        disabled={loading || importing}
                        className="rounded-full px-5"
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t("site.discard_preview")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t("site.project_name")}</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={t("site.enter_project_name")}
                required
                disabled={loading}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("site.description")}</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder={t("site.describe_the_project_objectives_and_scope")}
                disabled={loading}
                className="rounded-xl"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="managerId">{t("site.project_manager")}</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, managerId: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("site.select_project_manager_defaults_to_you")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalBudget">{t("site.total_budget")}</Label>
                <CurrencyInput
                  id="totalBudget"
                  value={formData.totalBudget}
                  onChange={(val) => setFormData((prev) => ({ ...prev, totalBudget: val }))}
                  currency="ETB"
                  min={0}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">{t("site.status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">{t("site.planning")}</SelectItem>
                    <SelectItem value="active">{t("site.active")}</SelectItem>
                    <SelectItem value="on_hold">{t("site.on_hold")}</SelectItem>
                    <SelectItem value="completed">{t("site.completed")}</SelectItem>
                    <SelectItem value="cancelled">{t("site.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">{t("site.start_date")}</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">{t("site.end_date")}</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg text-foreground">
                  {t("site.work_plan_milestones")}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  disabled={loading}
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-1" /> {t("site.add_milestone")}
                </Button>
              </div>

              {milestones.length > 0 ? (
                <div className="space-y-3">
                  {milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted/40 rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder={t("site.milestone_title")}
                            value={milestone.title}
                            onChange={(e) =>
                              updateMilestone(index, "title", e.target.value)
                            }
                            disabled={loading}
                            className="rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMilestone(index)}
                          disabled={loading}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder={t("site.description")}
                        value={milestone.description}
                        onChange={(e) =>
                          updateMilestone(index, "description", e.target.value)
                        }
                        rows={2}
                        disabled={loading}
                        className="rounded-xl"
                      />
                      <Input
                        type="date"
                        value={milestone.dueDate}
                        onChange={(e) =>
                          updateMilestone(index, "dueDate", e.target.value)
                        }
                        disabled={loading}
                        className="w-full md:w-auto rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_milestones_added_yet_click_add_milestone_to_create_your_work_plan")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Tasks & Activities */}
      {currentStep === 1 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h2 className="font-serif text-xl text-foreground mb-1">{t("site.tasks_and_activities")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("site.define_the_work_items_you_can_always_add_more_later")}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTask}
              disabled={loading}
              className="rounded-xl shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" /> {t("site.add_task")}
            </Button>
          </div>

          {taskInputs.length > 0 ? (
            <div className="space-y-4">
              {taskInputs.map((task, index) => (
                <div
                  key={index}
                  className="p-5 bg-muted/30 rounded-xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("site.task_number", { number: index + 1 })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTask(index)}
                      disabled={loading}
                      className="text-destructive hover:text-destructive h-7 w-7"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.title")}</Label>
                    <Input
                      placeholder={t("site.task_title")}
                      value={task.title}
                      onChange={(e) =>
                        updateTask(index, "title", e.target.value)
                      }
                      disabled={loading}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.description")}</Label>
                    <Textarea
                      placeholder={t("site.what_needs_to_be_done")}
                      value={task.description}
                      onChange={(e) =>
                        updateTask(index, "description", e.target.value)
                      }
                      rows={2}
                      disabled={loading}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t("site.priority")}</Label>
                      <Select
                        value={task.priority}
                        onValueChange={(value) =>
                          updateTask(index, "priority", value)
                        }
                        disabled={loading}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{t("site.low")}</SelectItem>
                          <SelectItem value="medium">{t("site.medium")}</SelectItem>
                          <SelectItem value="high">{t("site.high")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("site.due_date")}</Label>
                      <Input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) =>
                          updateTask(index, "dueDate", e.target.value)
                        }
                        disabled={loading}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("site.assign_to")}</Label>
                      <Select
                        value={task.assignedTo}
                        onValueChange={(value) =>
                          updateTask(
                            index,
                            "assignedTo",
                            value === "_none" ? "" : value
                          )
                        }
                        disabled={loading}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={t("site.select_assignee")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">{t("site.unassigned")}</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl">
              <ListTodo className="h-10 w-10 mx-auto text-primary/20 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                {t("site.no_tasks_yet_define_the_work_items_for_this_project")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={addTask}
                disabled={loading}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4 mr-1" /> {t("site.add_your_first_task")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Donor & Documents */}
      {currentStep === 2 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">{t("site.donors_and_documents")}</h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t("site.link_funding_partners_and_upload_relevant_files")}
          </p>

          <div className="space-y-8">
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">{t("site.donors")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("site.select_one_or_more_donors_for_this_project")}
              </p>

              {donors.filter((d) => d.isActive).length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto border border-border rounded-xl p-2">
                  {donors.filter((d) => d.isActive).map((donor) => {
                    const isSelected = selectedDonorIds.includes(donor.id);
                    return (
                      <button
                        key={donor.id}
                        type="button"
                        onClick={() => toggleDonor(donor.id)}
                        disabled={loading}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150 ${
                          isSelected
                            ? "bg-sage-pale"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{donor.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {donor.type}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_donors_available_create_donors_first_from_the_donors_page")}
                </p>
              )}

              {selectedDonorIds.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {t("site.selected_count", { count: selectedDonorIds.length })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getSelectedDonors().map((donor) => (
                      <span
                        key={donor.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-pale text-primary rounded-full text-xs font-medium"
                      >
                        {donor.name}
                        <button
                          type="button"
                          onClick={() => toggleDonor(donor.id)}
                          className="rounded-full hover:bg-primary/10 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-8">
              <h3 className="font-serif text-lg text-foreground mb-4">{t("site.project_documents")}</h3>
              <div className="border border-dashed border-border rounded-2xl p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />
                <Upload className="h-8 w-8 mx-auto text-primary/25 mb-3" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="rounded-xl"
                >
                  {t("site.select_files")}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("site.proposals_contracts_budgets_or_any_relevant_documents")}
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted/40 rounded-xl"
                    >
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={loading}
                        className="h-7 w-7 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {currentStep === 3 && (
        <div className="bg-card rounded-2xl p-6 lg:p-8">
          <h2 className="font-serif text-xl text-foreground mb-1">{t("site.review_and_submit")}</h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t("site.confirm_everything_looks_right_before_creating_your_project")}
          </p>

          <div className="space-y-8">
            {/* Project Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <ClipboardList className="h-4 w-4" /> {t("site.project_details")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2 p-5 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("site.name")}</p>
                  <p className="font-medium text-foreground">{formData.name}</p>
                </div>
                {formData.description && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground mb-0.5">{t("site.description")}</p>
                    <p className="text-sm text-foreground">{formData.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("site.status")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {t(statusLabels[formData.status] || formData.status)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t("site.project_manager")}</p>
                  <p className="text-sm text-foreground">
                    {getSelectedManager()
                      ? `${getSelectedManager()!.firstName} ${getSelectedManager()!.lastName}`
                      : t("site.you_default")}
                  </p>
                </div>
                {formData.totalBudget && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t("site.budget")}</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(parseInt(formData.totalBudget), "ETB")}
                    </p>
                  </div>
                )}
                {formData.startDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t("site.start_date")}</p>
                    <p className="text-sm text-foreground">
                      {formatLocalDate(formData.startDate)}
                    </p>
                  </div>
                )}
                {formData.endDate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t("site.end_date")}</p>
                    <p className="text-sm text-foreground">
                      {formatLocalDate(formData.endDate)}
                    </p>
                  </div>
                )}
              </div>

              {milestones.filter((m) => m.title.trim()).length > 0 && (
                <div className="mt-4 pl-1">
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("site.milestones_count", { count: milestones.filter((m) => m.title.trim()).length })}
                  </p>
                  <div className="space-y-1.5">
                    {milestones
                      .filter((m) => m.title.trim())
                      .map((m, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="text-foreground">{m.title}</span>
                          {m.dueDate && (
                            <span className="text-muted-foreground text-xs">
                              — {formatLocalDate(m.dueDate)}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className="border-t border-border pt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <ListTodo className="h-4 w-4" /> {t("site.tasks_and_activities")}
              </h3>
              {taskInputs.filter((t) => t.title.trim()).length > 0 ? (
                <div className="space-y-2">
                  {taskInputs
                    .filter((t) => t.title.trim())
                    .map((task, i) => (
                      <div
                        key={i}
                        className="p-4 bg-muted/30 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <p className="font-medium text-sm text-foreground">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {(() => {
                              const pc = priorityConfig[task.priority] || priorityConfig.medium;
                              return (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pc.bg} ${pc.text}`}>
                                  {t(priorityLabels[task.priority] || task.priority)}
                                </span>
                              );
                            })()}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                {t("site.due")} {formatLocalDate(task.dueDate)}
                              </span>
                            )}
                            {task.assignedTo && (
                              <span className="text-xs text-muted-foreground">
                                → {getUserName(task.assignedTo)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_tasks_added_you_can_add_tasks_later_from_the_project_page")}
                </p>
              )}
            </div>

            {/* Donors & Documents */}
            <div className="border-t border-border pt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
                <Users className="h-4 w-4" /> {t("site.donors_and_documents")}
              </h3>
              <div className="p-5 bg-muted/30 rounded-xl space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t("site.donors")}</p>
                  {getSelectedDonors().length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {getSelectedDonors().map((donor) => (
                        <Badge key={donor.id} variant="secondary" className="text-xs rounded-full">
                          {donor.name} ({donor.type})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("site.no_donors_selected")}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t("site.documents")}</p>
                  {files.length > 0 ? (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="text-foreground">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("site.no_documents_uploaded")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          type="button"
          variant="ghost"
          onClick={currentStep === 0 ? () => router.back() : prevStep}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {currentStep === 0 ? t("site.cancel") : t("site.previous")}
        </Button>

        <div className="flex gap-3">
          {currentStep < STEPS.length - 1 && currentStep > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentStep(STEPS.length - 1)}
              disabled={loading || !canProceed()}
              className="text-muted-foreground"
            >
              {t("site.skip_to_review")}
            </Button>
          )}

          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={loading || !canProceed()}
              className="rounded-xl"
            >
              {t("site.next")}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("site.creating")}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {t("site.create_project")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
