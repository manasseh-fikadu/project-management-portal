"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ReceiptText, Scale, Leaf, TrendingUp } from "lucide-react";
import { CurrencyInput } from "@/components/currency-input";
import { formatCurrency as formatCurrencyUtil } from "@/lib/currency";

type Project = { id: string; name: string; totalBudget: number | null };
type Donor = { id: string; name: string; type: string };
type BudgetAllocation = {
  id: string;
  projectId: string;
  activityName: string;
  plannedAmount: number;
  createdAt: string;
  project?: { id: string; name: string };
};
type Expenditure = {
  id: string;
  projectId: string;
  budgetAllocationId: string | null;
  taskId: string | null;
  donorId: string | null;
  activityName: string | null;
  amount: number;
  expenditureDate: string;
  description: string | null;
  project?: { id: string; name: string };
  budgetAllocation?: { id: string; activityName: string; plannedAmount: number } | null;
};
type Disbursement = {
  id: string;
  projectId: string;
  donorId: string | null;
  budgetAllocationId: string | null;
  activityName: string;
  amount: number;
  disbursedAt: string;
  reference: string | null;
  notes: string | null;
  project?: { id: string; name: string };
  donor?: { id: string; name: string; type: string } | null;
};
type PerformanceRow = {
  projectId: string;
  projectName: string;
  plannedBudget: number;
  spentAmount: number;
  disbursedAmount: number;
  totalTasks: number;
  completedTasks: number;
  physicalPerformance: number;
  financialPerformance: number;
  variance: number;
  status: "aligned" | "overspending_risk" | "under_spending";
};

type Totals = {
  plannedBudget: number;
  spentAmount: number;
  disbursedAmount: number;
  totalTasks: number;
  completedTasks: number;
  physicalPerformance: number;
  financialPerformance: number;
};

const performanceStatusConfig: Record<PerformanceRow["status"], { bg: string; text: string; label: string }> = {
  aligned: { bg: "bg-sage-pale", text: "text-primary", label: "site.aligned" },
  overspending_risk: { bg: "bg-rose-pale", text: "text-rose-muted", label: "site.overspending_risk" },
  under_spending: { bg: "bg-amber-pale", text: "text-amber-warm", label: "site.under_spending" },
};

type TabId = "disbursement-log" | "budget-control" | "performance";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "disbursement-log", label: "site.disbursements", icon: ReceiptText },
  { id: "budget-control", label: "site.budget_and_spend", icon: DollarSign },
  { id: "performance", label: "site.performance", icon: Scale },
];

export default function FinancialsPage() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [comparison, setComparison] = useState<PerformanceRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("disbursement-log");
  const [selectedDisbursementProjectId, setSelectedDisbursementProjectId] = useState("");
  const [selectedBudgetProjectId, setSelectedBudgetProjectId] = useState("");

  const [budgetForm, setBudgetForm] = useState({
    projectId: "",
    activityName: "",
    plannedAmount: "",
    notes: "",
  });

  const [expenditureForm, setExpenditureForm] = useState({
    projectId: "",
    donorId: "none",
    budgetAllocationId: "none",
    activityName: "",
    amount: "",
    expenditureDate: new Date().toISOString().split("T")[0],
    description: "",
  });

  const [disbursementForm, setDisbursementForm] = useState({
    projectId: "",
    donorId: "none",
    budgetAllocationId: "none",
    activityName: "",
    amount: "",
    disbursedAt: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState<"budget" | "expenditure" | "disbursement" | null>(null);

  async function fetchReferenceData() {
    const [projectsRes, donorsRes] = await Promise.all([fetch("/api/projects"), fetch("/api/donors")]);
    const [projectsData, donorsData] = await Promise.all([projectsRes.json(), donorsRes.json()]);
    setProjects(projectsData.projects || []);
    setDonors(donorsData.donors || []);
  }

  async function fetchFinancialData() {
    const [budgetsRes, expendituresRes, disbursementsRes, financialsRes] = await Promise.all([
      fetch("/api/budgets"),
      fetch("/api/expenditures"),
      fetch("/api/disbursements"),
      fetch("/api/financials"),
    ]);

    const [budgetsData, expendituresData, disbursementsData, financialsData] = await Promise.all([
      budgetsRes.json(),
      expendituresRes.json(),
      disbursementsRes.json(),
      financialsRes.json(),
    ]);

    setBudgetAllocations(budgetsData.budgetAllocations || []);
    setExpenditures(expendituresData.expenditures || []);
    setDisbursements(disbursementsData.disbursements || []);
    setComparison(financialsData.comparison || []);
    setTotals(financialsData.totals || null);
  }

  useEffect(() => {
    Promise.all([fetchReferenceData(), fetchFinancialData()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }

    setSelectedDisbursementProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : projects[0].id
    );
    setSelectedBudgetProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : projects[0].id
    );
  }, [projects]);

  const projectBudgetsForDisbursement = useMemo(() => {
    return budgetAllocations.filter((budget) => budget.projectId === disbursementForm.projectId);
  }, [budgetAllocations, disbursementForm.projectId]);

  const projectBudgetsForExpenditure = useMemo(() => {
    return budgetAllocations.filter((budget) => budget.projectId === expenditureForm.projectId);
  }, [budgetAllocations, expenditureForm.projectId]);

  const filteredDisbursements = useMemo(() => {
    return selectedDisbursementProjectId
      ? disbursements.filter((entry) => entry.projectId === selectedDisbursementProjectId)
      : [];
  }, [disbursements, selectedDisbursementProjectId]);

  const filteredBudgetAllocations = useMemo(() => {
    return selectedBudgetProjectId
      ? budgetAllocations.filter((budget) => budget.projectId === selectedBudgetProjectId)
      : [];
  }, [budgetAllocations, selectedBudgetProjectId]);

  const filteredExpenditures = useMemo(() => {
    return selectedBudgetProjectId
      ? expenditures.filter((expense) => expense.projectId === selectedBudgetProjectId)
      : [];
  }, [expenditures, selectedBudgetProjectId]);

  function formatCurrency(amount: number) {
    return formatCurrencyUtil(amount, "ETB");
  }

  async function submitBudget(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting("budget");

    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: budgetForm.projectId,
          activityName: budgetForm.activityName,
          plannedAmount: Number(budgetForm.plannedAmount),
          notes: budgetForm.notes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create budget allocation");

      setBudgetForm({ projectId: "", activityName: "", plannedAmount: "", notes: "" });
      await fetchFinancialData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(null);
    }
  }

  async function submitExpenditure(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting("expenditure");

    try {
      const res = await fetch("/api/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: expenditureForm.projectId,
          donorId: expenditureForm.donorId === "none" ? null : expenditureForm.donorId,
          budgetAllocationId: expenditureForm.budgetAllocationId === "none" ? null : expenditureForm.budgetAllocationId,
          activityName: expenditureForm.activityName || null,
          amount: Number(expenditureForm.amount),
          expenditureDate: expenditureForm.expenditureDate,
          description: expenditureForm.description || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create expenditure");

      setExpenditureForm({
        projectId: "",
        donorId: "none",
        budgetAllocationId: "none",
        activityName: "",
        amount: "",
        expenditureDate: new Date().toISOString().split("T")[0],
        description: "",
      });
      await fetchFinancialData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(null);
    }
  }

  async function submitDisbursement(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting("disbursement");

    try {
      const res = await fetch("/api/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: disbursementForm.projectId,
          donorId: disbursementForm.donorId === "none" ? null : disbursementForm.donorId,
          budgetAllocationId: disbursementForm.budgetAllocationId === "none" ? null : disbursementForm.budgetAllocationId,
          activityName: disbursementForm.activityName,
          amount: Number(disbursementForm.amount),
          disbursedAt: disbursementForm.disbursedAt,
          reference: disbursementForm.reference || null,
          notes: disbursementForm.notes || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create disbursement log");

      setDisbursementForm({
        projectId: "",
        donorId: "none",
        budgetAllocationId: "none",
        activityName: "",
        amount: "",
        disbursedAt: new Date().toISOString().split("T")[0],
        reference: "",
        notes: "",
      });
      await fetchFinancialData();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">{t("site.loading_financials")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
          {t("site.financial_tracking")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("site.track_budget_plans_expenditures_and_donor_disbursements_by_activity")}
        </p>
      </header>

      {/* Summary strip */}
      {totals && (
        <div className="flex gap-3 mb-8 flex-wrap">
          <div className="px-4 py-2.5 bg-card rounded-xl">
            <span className="text-xs text-muted-foreground">{t("site.planned_budget")}</span>
            <p className="font-serif text-lg text-foreground">{formatCurrency(totals.plannedBudget)}</p>
          </div>
          <div className="px-4 py-2.5 bg-rose-pale rounded-xl">
            <span className="text-xs text-muted-foreground">{t("site.spent")}</span>
            <p className="font-serif text-lg text-rose-muted">{formatCurrency(totals.spentAmount)}</p>
          </div>
          <div className="px-4 py-2.5 bg-sage-pale rounded-xl">
            <span className="text-xs text-muted-foreground">{t("site.disbursed_label")}</span>
            <p className="font-serif text-lg text-primary">{formatCurrency(totals.disbursedAmount)}</p>
          </div>
          <div className="px-4 py-2.5 bg-lavender-pale rounded-xl">
            <span className="text-xs text-muted-foreground">{t("site.portfolio_progress")}</span>
            <p className="font-serif text-lg text-lavender">
              {totals.physicalPerformance}% <span className="text-xs font-sans text-muted-foreground">{t("site.phys")}</span> / {totals.financialPerformance}% <span className="text-xs font-sans text-muted-foreground">{t("site.fin")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-border overflow-hidden mb-8 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      {/* Disbursement Log Tab */}
      {activeTab === "disbursement-log" && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl p-6">
            <div className="mb-5">
              <h2 className="font-serif text-xl text-foreground">{t("site.record_disbursement")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("site.capture_donor_fund_flows_to_specific_project_activities")}
              </p>
            </div>
            <form onSubmit={submitDisbursement} className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.project_required")}</Label>
                <Select
                  value={disbursementForm.projectId}
                  onValueChange={(value) =>
                    setDisbursementForm((prev) => ({ ...prev, projectId: value, budgetAllocationId: "none" }))
                  }
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_project")} /></SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("site.donor")}</Label>
                <Select value={disbursementForm.donorId} onValueChange={(value) => setDisbursementForm((prev) => ({ ...prev, donorId: value }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_donor")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("site.not_specified")}</SelectItem>
                    {donors.map((donor) => (
                      <SelectItem key={donor.id} value={donor.id}>{donor.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("site.linked_budget_activity")}</Label>
                <Select
                  value={disbursementForm.budgetAllocationId}
                  onValueChange={(value) => setDisbursementForm((prev) => ({ ...prev, budgetAllocationId: value }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_budget_line")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("site.not_linked")}</SelectItem>
                    {projectBudgetsForDisbursement.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.activityName} ({formatCurrency(budget.plannedAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disbursement-activity">{t("site.activity_name_2")}</Label>
                <Input
                  id="disbursement-activity"
                  value={disbursementForm.activityName}
                  onChange={(e) => setDisbursementForm((prev) => ({ ...prev, activityName: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disbursement-amount">{t("site.amount")}</Label>
                <CurrencyInput
                  id="disbursement-amount"
                  value={disbursementForm.amount}
                  onChange={(val) => setDisbursementForm((prev) => ({ ...prev, amount: val }))}
                  currency="ETB"
                  min={1}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disbursed-at">{t("site.disbursement_date")}</Label>
                <Input
                  id="disbursed-at"
                  type="date"
                  value={disbursementForm.disbursedAt}
                  onChange={(e) => setDisbursementForm((prev) => ({ ...prev, disbursedAt: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">{t("site.reference")}</Label>
                <Input
                  id="reference"
                  value={disbursementForm.reference}
                  onChange={(e) => setDisbursementForm((prev) => ({ ...prev, reference: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="disbursement-notes">{t("site.notes")}</Label>
                <Textarea
                  id="disbursement-notes"
                  value={disbursementForm.notes}
                  onChange={(e) => setDisbursementForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting === "disbursement"} className="rounded-xl">
                  {submitting === "disbursement" ? t("site.saving") : t("site.save_disbursement_log")}
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-2xl p-6">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-serif text-xl text-foreground">{t("site.disbursement_log")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("site.show_entries_for_one_project_at_a_time")}</p>
              </div>
              <div className="w-full md:w-72 space-y-2">
                <Label>{t("site.view_project")}</Label>
                <Select value={selectedDisbursementProjectId} onValueChange={setSelectedDisbursementProjectId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("site.select_project")} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredDisbursements.length === 0 ? (
              <div className="py-10 text-center">
                <ReceiptText className="h-8 w-8 mx-auto mb-2 text-primary/15" />
                <p className="text-sm text-muted-foreground">{t("site.no_disbursement_logs_for_this_project_yet")}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredDisbursements.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{entry.activityName}</p>
                      <p className="font-serif text-lg text-primary">{formatCurrency(entry.amount)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {entry.project?.name || t("site.unknown_project")} · {entry.donor?.name || t("site.donor_not_specified")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.disbursedAt).toLocaleDateString()} {entry.reference ? `· Ref: ${entry.reference}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget & Expenditure Tab */}
      {activeTab === "budget-control" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Budget form */}
            <div className="bg-card rounded-2xl p-6">
              <h2 className="font-serif text-xl text-foreground mb-5">{t("site.define_budget_by_activity")}</h2>
              <form onSubmit={submitBudget} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("site.project_required")}</Label>
                  <Select value={budgetForm.projectId} onValueChange={(value) => setBudgetForm((prev) => ({ ...prev, projectId: value }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_project")} /></SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-activity">{t("site.activity")}</Label>
                  <Input
                    id="budget-activity"
                    value={budgetForm.activityName}
                    onChange={(e) => setBudgetForm((prev) => ({ ...prev, activityName: e.target.value }))}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-amount">{t("site.planned_amount")}</Label>
                  <CurrencyInput
                    id="budget-amount"
                    value={budgetForm.plannedAmount}
                    onChange={(val) => setBudgetForm((prev) => ({ ...prev, plannedAmount: val }))}
                    currency="ETB"
                    min={1}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget-notes">{t("site.notes")}</Label>
                  <Textarea
                    id="budget-notes"
                    value={budgetForm.notes}
                    onChange={(e) => setBudgetForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <Button type="submit" disabled={submitting === "budget"} className="rounded-xl">
                  {submitting === "budget" ? t("site.saving") : t("site.save_budget_line")}
                </Button>
              </form>
            </div>

            {/* Expenditure form */}
            <div className="bg-card rounded-2xl p-6">
              <h2 className="font-serif text-xl text-foreground mb-5">{t("site.log_expenditure")}</h2>
              <form onSubmit={submitExpenditure} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("site.project_required")}</Label>
                  <Select
                    value={expenditureForm.projectId}
                    onValueChange={(value) =>
                      setExpenditureForm((prev) => ({ ...prev, projectId: value, budgetAllocationId: "none" }))
                    }
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_project")} /></SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("site.donor")}</Label>
                  <Select value={expenditureForm.donorId} onValueChange={(value) => setExpenditureForm((prev) => ({ ...prev, donorId: value }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_donor")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("site.not_specified")}</SelectItem>
                      {donors.map((donor) => (
                        <SelectItem key={donor.id} value={donor.id}>{donor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("site.budget_line")}</Label>
                  <Select
                    value={expenditureForm.budgetAllocationId}
                    onValueChange={(value) => setExpenditureForm((prev) => ({ ...prev, budgetAllocationId: value }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("site.select_budget_line")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("site.not_linked")}</SelectItem>
                      {projectBudgetsForExpenditure.map((budget) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.activityName} ({formatCurrency(budget.plannedAmount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenditure-activity">{t("site.activity_name")}</Label>
                  <Input
                    id="expenditure-activity"
                    value={expenditureForm.activityName}
                    onChange={(e) => setExpenditureForm((prev) => ({ ...prev, activityName: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenditure-amount">{t("site.amount")}</Label>
                  <CurrencyInput
                    id="expenditure-amount"
                    value={expenditureForm.amount}
                    onChange={(val) => setExpenditureForm((prev) => ({ ...prev, amount: val }))}
                    currency="ETB"
                    min={1}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenditure-date">{t("site.date")}</Label>
                  <Input
                    id="expenditure-date"
                    type="date"
                    value={expenditureForm.expenditureDate}
                    onChange={(e) => setExpenditureForm((prev) => ({ ...prev, expenditureDate: e.target.value }))}
                    required
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenditure-description">{t("site.description")}</Label>
                  <Textarea
                    id="expenditure-description"
                    value={expenditureForm.description}
                    onChange={(e) => setExpenditureForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>

                <Button type="submit" disabled={submitting === "expenditure"} className="rounded-xl">
                  {submitting === "expenditure" ? t("site.saving") : t("site.save_expenditure")}
                </Button>
              </form>
            </div>
          </div>

          {/* Budget & Expenditure lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-card rounded-2xl p-6">
              <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-xl text-foreground">{t("site.budget_lines")}</h2>
                  <p className="text-sm text-muted-foreground">{t("site.filter_both_panels_by_project_to_reduce_noise")}</p>
                </div>
                <div className="w-full md:w-72 space-y-2">
                  <Label>{t("site.view_project")}</Label>
                  <Select value={selectedBudgetProjectId} onValueChange={setSelectedBudgetProjectId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={t("site.select_project")} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {filteredBudgetAllocations.length === 0 ? (
                <div className="py-10 text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-primary/15" />
                  <p className="text-sm text-muted-foreground">{t("site.no_budget_lines_for_this_project_yet")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredBudgetAllocations.map((budget) => (
                    <div key={budget.id} className="rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{budget.activityName}</p>
                        <p className="font-serif text-lg text-primary">{formatCurrency(budget.plannedAmount)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{budget.project?.name || t("site.unknown_project")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl p-6">
              <h2 className="font-serif text-xl text-foreground mb-4">{t("site.recent_expenditures")}</h2>
              {filteredExpenditures.length === 0 ? (
                <div className="py-10 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary/15" />
                  <p className="text-sm text-muted-foreground">{t("site.no_expenditures_for_this_project_yet")}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredExpenditures.map((expense) => (
                    <div key={expense.id} className="rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{expense.activityName || expense.budgetAllocation?.activityName || t("site.general")}</p>
                        <p className="font-serif text-lg text-rose-muted">{formatCurrency(expense.amount)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {expense.project?.name || t("site.unknown_project")} · {new Date(expense.expenditureDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === "performance" && (
        <div className="bg-card rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="font-serif text-xl text-foreground">{t("site.physical_vs_financial_performance")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("site.physical_completed_tasks_ratio_financial_spent_budget_ratio")}
            </p>
          </div>
          {comparison.length === 0 ? (
            <div className="py-10 text-center">
              <Scale className="h-8 w-8 mx-auto mb-2 text-primary/15" />
              <p className="text-sm text-muted-foreground">{t("site.no_project_performance_data_available_yet")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comparison.map((row) => {
                const ps = performanceStatusConfig[row.status];
                return (
                  <div key={row.projectId} className="rounded-xl border border-border p-5 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <h3 className="font-serif text-lg text-foreground">{row.projectName}</h3>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${ps.bg} ${ps.text}`}>
                        {t(ps.label)}
                      </span>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{t("site.physical")}</span>
                          <span className="font-medium text-foreground">{row.physicalPerformance}% ({row.completedTasks}/{row.totalTasks} tasks)</span>
                        </div>
                        <div className="h-2 rounded-full bg-sage-pale overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${row.physicalPerformance}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">{t("site.financial")}</span>
                          <span className="font-medium text-foreground">{row.financialPerformance}% ({formatCurrency(row.spentAmount)} spent)</span>
                        </div>
                        <div className="h-2 rounded-full bg-lavender-pale overflow-hidden">
                          <div
                            className="h-full rounded-full bg-lavender transition-all duration-500"
                            style={{ width: `${Math.min(100, row.financialPerformance)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm md:grid-cols-3 p-3 bg-muted/30 rounded-xl">
                      <p className="text-muted-foreground">{t("site.planned")}: <span className="font-medium text-foreground">{formatCurrency(row.plannedBudget)}</span></p>
                      <p className="text-muted-foreground">{t("site.disbursed_label")}: <span className="font-medium text-foreground">{formatCurrency(row.disbursedAmount)}</span></p>
                      <p className="text-muted-foreground">{t("site.variance_label")}: <span className="font-medium text-foreground">{row.variance > 0 ? `+${row.variance}` : row.variance}%</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
