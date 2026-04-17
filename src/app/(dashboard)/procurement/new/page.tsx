"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency } from "@/lib/currency";
import { PROCUREMENT_METHODS, PROCUREMENT_REQUEST_TYPES } from "@/lib/procurement";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Leaf,
  ListTodo,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

const EDIT_ROLES = new Set(["admin", "project_manager"]);

type ProjectOption = {
  id: string;
  name: string;
  totalBudget: number;
};

type BudgetAllocationOption = {
  id: string;
  activityName: string;
  plannedAmount: number;
};

type TaskOption = {
  id: string;
  title: string;
  status: string;
};

type VendorOption = {
  id: string;
  name: string;
  contactPerson: string | null;
  category: string | null;
  isActive: boolean;
};

type LineItem = {
  description: string;
  specification: string;
  category: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type NormalizedLineItemPayload = {
  description: string;
  specification: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
};

const STEPS = [
  { id: 0, icon: ClipboardList },
  { id: 1, icon: ListTodo },
  { id: 2, icon: Users },
  { id: 3, icon: Eye },
] as const;

const EMPTY_LINE_ITEM: LineItem = {
  description: "",
  specification: "",
  category: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
};

export default function NewProcurementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [hasCreateAccess, setHasCreateAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocationOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [formData, setFormData] = useState({
    title: "",
    projectId: "",
    requestType: "goods",
    procurementMethod: "request_for_quotation",
    priority: "medium",
    estimatedAmount: "",
    currency: "ETB",
    budgetAllocationId: "",
    taskId: "",
    selectedVendorId: "",
    neededByDate: "",
    description: "",
    justification: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const authRes = await fetch("/api/auth/me", { cache: "no-store" });
        const authData = await authRes.json();
        const allowed = EDIT_ROLES.has(authData.user?.role);

        if (!allowed) {
          router.replace("/procurement");
          return;
        }

        if (cancelled) return;

        setHasCreateAccess(true);

        const [projectsRes, vendorsRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/vendors"),
        ]);

        const [projectsData, vendorsData] = await Promise.all([
          projectsRes.json(),
          vendorsRes.json(),
        ]);

        if (cancelled) return;

        setProjects(
          (projectsData.projects || []).map((project: ProjectOption) => ({
            id: project.id,
            name: project.name,
            totalBudget: project.totalBudget,
          }))
        );
        setVendors((vendorsData.vendors || []).filter((vendor: VendorOption) => vendor.isActive));
      } catch (error) {
        console.error("Failed to initialize procurement creation page:", error);
        if (!cancelled) {
          router.replace("/procurement");
        }
      } finally {
        if (!cancelled) {
          setAccessChecked(true);
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!hasCreateAccess || !formData.projectId) {
      setBudgetAllocations([]);
      setTasks([]);
      return;
    }

    async function loadProjectLinkedData() {
      try {
        const [budgetRes, taskRes] = await Promise.all([
          fetch(`/api/budgets?projectId=${formData.projectId}`),
          fetch(`/api/tasks?projectId=${formData.projectId}`),
        ]);

        const [budgetData, taskData] = await Promise.all([budgetRes.json(), taskRes.json()]);
        setBudgetAllocations(budgetData.budgetAllocations || []);
        setTasks(taskData.tasks || []);
      } catch (error) {
        console.error("Failed to fetch project-linked procurement data:", error);
      }
    }

    void loadProjectLinkedData();
  }, [formData.projectId, hasCreateAccess]);

  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const quantity = Math.max(1, Number(item.quantity || 0));
      const unitPrice = Math.max(0, Number(item.unitPrice || 0));
      return sum + quantity * unitPrice;
    }, 0);
  }, [lineItems]);

  function formatOptionLabel(value: string) {
    return t(`site.${value}`, {
      defaultValue: value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    });
  }

  const selectedProject = projects.find((project) => project.id === formData.projectId) ?? null;
  const selectedBudgetAllocation =
    budgetAllocations.find((allocation) => allocation.id === formData.budgetAllocationId) ?? null;

  function updateLineItem(index: number, field: keyof LineItem, value: string) {
    setLineItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  }

  function addLineItem() {
    setLineItems((current) => [...current, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function formatStepLabel(step: number) {
    if (step === 0) return t("site.request_details", { defaultValue: "Request Details" });
    if (step === 1) return t("site.line_items", { defaultValue: "Line Items" });
    if (step === 2) return t("site.sourcing_setup", { defaultValue: "Sourcing Setup" });
    return t("site.review", { defaultValue: "Review" });
  }

  function goToNextStep() {
    setCurrentStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goToPreviousStep() {
    setCurrentStep((current) => Math.max(current - 1, 0));
  }

  async function handleCreate(submitForApproval: boolean) {
    setError(null);

    const normalizedItems = lineItems
      .map((item) => {
        const description = item.description.trim();
        if (!description) {
          return null;
        }

        const quantity = Math.max(1, Math.round(Number(item.quantity || 1)));
        const unitPrice = Math.max(0, Math.round(Number(item.unitPrice || 0)));
        return {
          description,
          specification: item.specification.trim(),
          category: item.category.trim(),
          quantity,
          unit: item.unit.trim(),
          unitPrice,
          totalPrice: quantity * unitPrice,
        };
      })
      .filter((item): item is NormalizedLineItemPayload => item !== null);

    const estimatedAmount = formData.estimatedAmount || lineItemsTotal.toString();

    if (!formData.title.trim() || !formData.projectId || !estimatedAmount || normalizedItems.length === 0) {
      setError(
        t("site.procurement_form_validation_error", {
          defaultValue: "Add a title, choose a project, set an amount, and include at least one line item before saving.",
        })
      );
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          estimatedAmount,
          budgetAllocationId: formData.budgetAllocationId || null,
          taskId: formData.taskId || null,
          selectedVendorId: formData.selectedVendorId || null,
          lineItems: normalizedItems,
          submitForApproval,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create procurement request");
      }

      router.push(`/procurement/${data.procurementRequest.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("site.an_error_occurred", { defaultValue: "An error occurred" })
      );
    } finally {
      setSaving(false);
    }
  }

  if (!accessChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("site.loading_procurement_form", { defaultValue: "Preparing procurement workspace..." })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/procurement")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("site.back_to_procurement", { defaultValue: "Back to Procurement" })}
        </Button>
        <Badge className="bg-sage-pale text-primary">
          {t("site.step_of_total", {
            defaultValue: `Step ${currentStep + 1} of ${STEPS.length}`,
            step: currentStep + 1,
            total: STEPS.length,
          })}
        </Badge>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-[28px]">
            <CardHeader>
              <div className="flex flex-wrap gap-3">
                {STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const active = index === currentStep;
                  const complete = index < currentStep;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setCurrentStep(index)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-primary/30 bg-sage-pale text-primary"
                          : complete
                            ? "border-border bg-card text-foreground"
                            : "border-border/60 bg-background text-muted-foreground"
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        active ? "bg-primary text-primary-foreground" : complete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        <StepIcon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-medium">{formatStepLabel(index)}</span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>
          </Card>

          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">{formatStepLabel(currentStep)}</CardTitle>
              <CardDescription>
                {currentStep === 0 && t("site.capture_request_scope_and_budget_links", {
                  defaultValue: "Capture the procurement scope, project linkage, and budget references.",
                })}
                {currentStep === 1 && t("site.define_the_items_or_services_to_be_procured", {
                  defaultValue: "Define the goods, services, or works to be procured and estimate their value.",
                })}
                {currentStep === 2 && t("site.configure_sourcing_preferences_before_submission", {
                  defaultValue: "Select the procurement method, preferred vendor, and request timing before submission.",
                })}
                {currentStep === 3 && t("site.review_the_request_before_saving_or_submitting", {
                  defaultValue: "Review the request before saving it as a draft or sending it for approval.",
                })}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {currentStep === 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="title">{t("site.title", { defaultValue: "Title" })}</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                      placeholder={t("site.procurement_request_title", { defaultValue: "Procurement request title" })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.project", { defaultValue: "Project" })}</Label>
                    <Select
                      value={formData.projectId || "none"}
                      onValueChange={(value) => setFormData((current) => ({
                        ...current,
                        projectId: value === "none" ? "" : value,
                        budgetAllocationId: "",
                        taskId: "",
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("site.choose_project", { defaultValue: "Choose project" })} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("site.choose_project", { defaultValue: "Choose project" })}</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.request_type", { defaultValue: "Request Type" })}</Label>
                    <Select
                      value={formData.requestType}
                      onValueChange={(value) => setFormData((current) => ({ ...current, requestType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROCUREMENT_REQUEST_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatOptionLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.budget_line", { defaultValue: "Budget line" })}</Label>
                    <Select
                      value={formData.budgetAllocationId || "none"}
                      onValueChange={(value) => setFormData((current) => ({ ...current, budgetAllocationId: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("site.link_budget_line", { defaultValue: "Link budget line" })} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("site.none", { defaultValue: "None" })}</SelectItem>
                        {budgetAllocations.map((allocation) => (
                          <SelectItem key={allocation.id} value={allocation.id}>
                            {allocation.activityName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.task", { defaultValue: "Task" })}</Label>
                    <Select
                      value={formData.taskId || "none"}
                      onValueChange={(value) => setFormData((current) => ({ ...current, taskId: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("site.link_task_optional", { defaultValue: "Link task (optional)" })} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("site.none", { defaultValue: "None" })}</SelectItem>
                        {tasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">{t("site.description", { defaultValue: "Description" })}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                      placeholder={t("site.describe_the_procurement_need", {
                        defaultValue: "Describe the procurement need, outputs, and delivery expectations.",
                      })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="justification">{t("site.justification", { defaultValue: "Justification" })}</Label>
                    <Textarea
                      id="justification"
                      value={formData.justification}
                      onChange={(event) => setFormData((current) => ({ ...current, justification: event.target.value }))}
                      placeholder={t("site.explain_why_this_procurement_is_needed", {
                        defaultValue: "Explain why this procurement is needed now and how it supports project delivery.",
                      })}
                    />
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-5">
                  {lineItems.map((item, index) => {
                    const quantity = Math.max(1, Number(item.quantity || 0));
                    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
                    const total = quantity * unitPrice;

                    return (
                      <div key={`line-item-${index}`} className="rounded-2xl border border-border/60 p-4">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {t("site.line_item_number", { defaultValue: `Line item ${index + 1}`, number: index + 1 })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {t("site.capture_quantity_unit_price_and_specification", {
                                defaultValue: "Capture quantity, unit price, and specification details.",
                              })}
                            </p>
                          </div>
                          {lineItems.length > 1 && (
                            <Button variant="outline" size="sm" onClick={() => removeLineItem(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label>{t("site.description", { defaultValue: "Description" })}</Label>
                            <Input
                              value={item.description}
                              onChange={(event) => updateLineItem(index, "description", event.target.value)}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>{t("site.specification", { defaultValue: "Specification" })}</Label>
                            <Textarea
                              value={item.specification}
                              onChange={(event) => updateLineItem(index, "specification", event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("site.category", { defaultValue: "Category" })}</Label>
                            <Input
                              value={item.category}
                              onChange={(event) => updateLineItem(index, "category", event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("site.unit", { defaultValue: "Unit" })}</Label>
                            <Input
                              value={item.unit}
                              onChange={(event) => updateLineItem(index, "unit", event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("site.quantity", { defaultValue: "Quantity" })}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>{t("site.unit_price", { defaultValue: "Unit price" })}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={item.unitPrice}
                              onChange={(event) => updateLineItem(index, "unitPrice", event.target.value)}
                            />
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-muted/35 px-4 py-3 text-sm">
                          <span className="text-muted-foreground">
                            {t("site.line_total", { defaultValue: "Line total" })}:
                          </span>{" "}
                          <span className="font-semibold text-foreground">{formatCurrency(total, "ETB")}</span>
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="outline" className="rounded-xl" onClick={addLineItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("site.add_line_item", { defaultValue: "Add Line Item" })}
                  </Button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("site.procurement_method", { defaultValue: "Procurement Method" })}</Label>
                    <Select
                      value={formData.procurementMethod}
                      onValueChange={(value) => setFormData((current) => ({ ...current, procurementMethod: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROCUREMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {formatOptionLabel(method)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.priority", { defaultValue: "Priority" })}</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData((current) => ({ ...current, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t("site.low", { defaultValue: "Low" })}</SelectItem>
                        <SelectItem value="medium">{t("site.medium", { defaultValue: "Medium" })}</SelectItem>
                        <SelectItem value="high">{t("site.high", { defaultValue: "High" })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>{t("site.estimated_amount", { defaultValue: "Estimated Amount" })}</Label>
                    <CurrencyInput
                      value={formData.estimatedAmount}
                      onChange={(value) => setFormData((current) => ({ ...current, estimatedAmount: value }))}
                      currency="ETB"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("site.line_items_currently_total", {
                        defaultValue: `Line items currently total ${formatCurrency(lineItemsTotal, "ETB")}.`,
                      })}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("site.preferred_vendor", { defaultValue: "Preferred Vendor" })}</Label>
                    <Select
                      value={formData.selectedVendorId || "none"}
                      onValueChange={(value) => setFormData((current) => ({ ...current, selectedVendorId: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("site.select_vendor", { defaultValue: "Select vendor" })} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("site.none", { defaultValue: "None" })}</SelectItem>
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="needed-by">{t("site.needed_by", { defaultValue: "Needed by" })}</Label>
                    <Input
                      id="needed-by"
                      type="date"
                      value={formData.neededByDate}
                      onChange={(event) => setFormData((current) => ({ ...current, neededByDate: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">{t("site.notes", { defaultValue: "Notes" })}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                      placeholder={t("site.capture_any_supplier_market_or_delivery_notes", {
                        defaultValue: "Capture any market context, delivery constraints, or approval notes.",
                      })}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-muted/35 p-5">
                    <h3 className="font-semibold text-foreground">
                      {t("site.request_summary", { defaultValue: "Request Summary" })}
                    </h3>
                    <dl className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                          {t("site.title", { defaultValue: "Title" })}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">{formData.title || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                          {t("site.project", { defaultValue: "Project" })}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">{selectedProject?.name || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                          {t("site.budget_line", { defaultValue: "Budget line" })}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">{selectedBudgetAllocation?.activityName || "-"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                          {t("site.estimated_amount", { defaultValue: "Estimated Amount" })}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">
                          {formatCurrency(Number(formData.estimatedAmount || lineItemsTotal), "ETB")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl bg-muted/35 p-5">
                    <h3 className="font-semibold text-foreground">
                      {t("site.line_items", { defaultValue: "Line Items" })}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {lineItems.map((item, index) => {
                        const quantity = Math.max(1, Number(item.quantity || 0));
                        const unitPrice = Math.max(0, Number(item.unitPrice || 0));
                        return (
                          <div key={`review-item-${index}`} className="flex items-start justify-between gap-4 rounded-2xl bg-background p-4">
                            <div>
                              <p className="font-medium text-foreground">{item.description || `${t("site.line_item", { defaultValue: "Line item" })} ${index + 1}`}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {quantity} {item.unit || t("site.units", { defaultValue: "units" })} x {formatCurrency(unitPrice, "ETB")}
                              </p>
                            </div>
                            <p className="font-semibold text-foreground">
                              {formatCurrency(quantity * unitPrice, "ETB")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={saving}
                      onClick={() => void handleCreate(false)}
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t("site.save_as_draft", { defaultValue: "Save as Draft" })}
                    </Button>
                    <Button
                      className="rounded-xl"
                      disabled={saving}
                      onClick={() => void handleCreate(true)}
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t("site.submit_for_approval", { defaultValue: "Submit for Approval" })}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={goToPreviousStep}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("site.previous", { defaultValue: "Previous" })}
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button className="rounded-xl" onClick={goToNextStep}>
                    {t("site.next", { defaultValue: "Next" })}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle>{t("site.procurement_snapshot", { defaultValue: "Procurement Snapshot" })}</CardTitle>
              <CardDescription>
                {t("site.review_budget_and_vendor_context_as_you_build_the_request", {
                  defaultValue: "Review budget and supplier context as you build the request.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  {t("site.project_budget", { defaultValue: "Project Budget" })}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {selectedProject ? formatCurrency(selectedProject.totalBudget || 0, "ETB") : formatCurrency(0, "ETB")}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  {t("site.selected_budget_line", { defaultValue: "Selected Budget Line" })}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {selectedBudgetAllocation
                    ? `${selectedBudgetAllocation.activityName} • ${formatCurrency(selectedBudgetAllocation.plannedAmount, "ETB")}`
                    : t("site.no_budget_line_linked", { defaultValue: "No budget line linked yet." })}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                  {t("site.line_items_total", { defaultValue: "Line Items Total" })}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatCurrency(lineItemsTotal, "ETB")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px]">
            <CardHeader>
              <CardTitle>{t("site.approval_rule", { defaultValue: "Approval Rule" })}</CardTitle>
              <CardDescription>
                {t("site.amount_based_procurement_approvals_are_applied_automatically", {
                  defaultValue: "Amount-based approvals are applied automatically when the request is submitted.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                {t("site.project_manager_approves_lower_value_requests", {
                  defaultValue: "Project managers approve lower-value requests.",
                })}
              </p>
              <p>
                {t("site.administrators_approve_higher_value_requests", {
                  defaultValue: "Administrators approve higher-value requests above the configured threshold.",
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
