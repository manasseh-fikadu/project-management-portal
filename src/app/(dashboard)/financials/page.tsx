"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, ReceiptText, Scale } from "lucide-react";

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

const performanceStatusColor: Record<PerformanceRow["status"], string> = {
  aligned: "bg-green-100 text-green-700",
  overspending_risk: "bg-red-100 text-red-700",
  under_spending: "bg-yellow-100 text-yellow-800",
};

export default function FinancialsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [comparison, setComparison] = useState<PerformanceRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);

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
    fetchReferenceData();
    fetchFinancialData();
  }, []);

  const projectBudgetsForDisbursement = useMemo(() => {
    return budgetAllocations.filter((budget) => budget.projectId === disbursementForm.projectId);
  }, [budgetAllocations, disbursementForm.projectId]);

  const projectBudgetsForExpenditure = useMemo(() => {
    return budgetAllocations.filter((budget) => budget.projectId === expenditureForm.projectId);
  }, [budgetAllocations, expenditureForm.projectId]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(
      amount || 0
    );
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financial Tracking & Disbursement Logs</h1>
        <p className="text-muted-foreground">Track budget plans, expenditures, and donor disbursements by activity.</p>
      </div>

      {totals && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Planned Budget</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(totals.plannedBudget)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Money Spent</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(totals.spentAmount)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Funds Disbursed</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(totals.disbursedAmount)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Portfolio Progress</CardDescription>
              <CardTitle className="text-xl">{totals.physicalPerformance}% physical / {totals.financialPerformance}% financial</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="disbursement-log">
        <TabsList>
          <TabsTrigger value="disbursement-log"><ReceiptText className="h-4 w-4" /> Disbursement Log</TabsTrigger>
          <TabsTrigger value="budget-control"><DollarSign className="h-4 w-4" /> Budget & Expenditure</TabsTrigger>
          <TabsTrigger value="performance"><Scale className="h-4 w-4" /> Physical vs Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="disbursement-log" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Record Disbursement</CardTitle>
              <CardDescription>Capture donor fund flows to specific project activities.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitDisbursement} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={disbursementForm.projectId}
                    onValueChange={(value) =>
                      setDisbursementForm((prev) => ({ ...prev, projectId: value, budgetAllocationId: "none" }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Donor</Label>
                  <Select value={disbursementForm.donorId} onValueChange={(value) => setDisbursementForm((prev) => ({ ...prev, donorId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {donors.map((donor) => (
                        <SelectItem key={donor.id} value={donor.id}>{donor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Linked Budget Activity</Label>
                  <Select
                    value={disbursementForm.budgetAllocationId}
                    onValueChange={(value) => setDisbursementForm((prev) => ({ ...prev, budgetAllocationId: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select budget line" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {projectBudgetsForDisbursement.map((budget) => (
                        <SelectItem key={budget.id} value={budget.id}>
                          {budget.activityName} ({formatCurrency(budget.plannedAmount)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disbursement-activity">Activity Name *</Label>
                  <Input
                    id="disbursement-activity"
                    value={disbursementForm.activityName}
                    onChange={(e) => setDisbursementForm((prev) => ({ ...prev, activityName: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disbursement-amount">Amount *</Label>
                  <Input
                    id="disbursement-amount"
                    type="number"
                    min={1}
                    value={disbursementForm.amount}
                    onChange={(e) => setDisbursementForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disbursed-at">Disbursement Date *</Label>
                  <Input
                    id="disbursed-at"
                    type="date"
                    value={disbursementForm.disbursedAt}
                    onChange={(e) => setDisbursementForm((prev) => ({ ...prev, disbursedAt: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference">Reference</Label>
                  <Input
                    id="reference"
                    value={disbursementForm.reference}
                    onChange={(e) => setDisbursementForm((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="disbursement-notes">Notes</Label>
                  <Textarea
                    id="disbursement-notes"
                    value={disbursementForm.notes}
                    onChange={(e) => setDisbursementForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" disabled={submitting === "disbursement"}>
                    {submitting === "disbursement" ? "Saving..." : "Save Disbursement Log"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disbursement Log Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {disbursements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No disbursement logs yet.</p>
              ) : (
                <div className="space-y-3">
                  {disbursements.map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{entry.activityName}</p>
                        <p className="font-semibold">{formatCurrency(entry.amount)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {entry.project?.name || "Unknown project"} • {entry.donor?.name || "Donor not specified"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.disbursedAt).toLocaleDateString()} {entry.reference ? `• Ref: ${entry.reference}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget-control" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Define Budget by Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitBudget} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Project *</Label>
                    <Select value={budgetForm.projectId} onValueChange={(value) => setBudgetForm((prev) => ({ ...prev, projectId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-activity">Activity *</Label>
                    <Input
                      id="budget-activity"
                      value={budgetForm.activityName}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, activityName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-amount">Planned Amount *</Label>
                    <Input
                      id="budget-amount"
                      type="number"
                      min={1}
                      value={budgetForm.plannedAmount}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, plannedAmount: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-notes">Notes</Label>
                    <Textarea
                      id="budget-notes"
                      value={budgetForm.notes}
                      onChange={(e) => setBudgetForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={submitting === "budget"}>{submitting === "budget" ? "Saving..." : "Save Budget Line"}</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Log Expenditure</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitExpenditure} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Project *</Label>
                    <Select
                      value={expenditureForm.projectId}
                      onValueChange={(value) =>
                        setExpenditureForm((prev) => ({ ...prev, projectId: value, budgetAllocationId: "none" }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Donor</Label>
                    <Select value={expenditureForm.donorId} onValueChange={(value) => setExpenditureForm((prev) => ({ ...prev, donorId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select donor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {donors.map((donor) => (
                          <SelectItem key={donor.id} value={donor.id}>{donor.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Budget Line</Label>
                    <Select
                      value={expenditureForm.budgetAllocationId}
                      onValueChange={(value) => setExpenditureForm((prev) => ({ ...prev, budgetAllocationId: value }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select budget line" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {projectBudgetsForExpenditure.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            {budget.activityName} ({formatCurrency(budget.plannedAmount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenditure-activity">Activity Name</Label>
                    <Input
                      id="expenditure-activity"
                      value={expenditureForm.activityName}
                      onChange={(e) => setExpenditureForm((prev) => ({ ...prev, activityName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenditure-amount">Amount *</Label>
                    <Input
                      id="expenditure-amount"
                      type="number"
                      min={1}
                      value={expenditureForm.amount}
                      onChange={(e) => setExpenditureForm((prev) => ({ ...prev, amount: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenditure-date">Date *</Label>
                    <Input
                      id="expenditure-date"
                      type="date"
                      value={expenditureForm.expenditureDate}
                      onChange={(e) => setExpenditureForm((prev) => ({ ...prev, expenditureDate: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenditure-description">Description</Label>
                    <Textarea
                      id="expenditure-description"
                      value={expenditureForm.description}
                      onChange={(e) => setExpenditureForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <Button type="submit" disabled={submitting === "expenditure"}>{submitting === "expenditure" ? "Saving..." : "Save Expenditure"}</Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Budget Lines</CardTitle>
              </CardHeader>
              <CardContent>
                {budgetAllocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No budget allocations yet.</p>
                ) : (
                  <div className="space-y-3">
                    {budgetAllocations.map((budget) => (
                      <div key={budget.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{budget.activityName}</p>
                          <p className="font-semibold">{formatCurrency(budget.plannedAmount)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{budget.project?.name || "Unknown project"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Expenditures</CardTitle>
              </CardHeader>
              <CardContent>
                {expenditures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenditures yet.</p>
                ) : (
                  <div className="space-y-3">
                    {expenditures.map((expense) => (
                      <div key={expense.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{expense.activityName || expense.budgetAllocation?.activityName || "General"}</p>
                          <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {expense.project?.name || "Unknown project"} • {new Date(expense.expenditureDate).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Physical vs Financial Performance</CardTitle>
              <CardDescription>Physical performance = completed tasks ratio. Financial performance = spent budget ratio.</CardDescription>
            </CardHeader>
            <CardContent>
              {comparison.length === 0 ? (
                <p className="text-sm text-muted-foreground">No project performance data available yet.</p>
              ) : (
                <div className="space-y-4">
                  {comparison.map((row) => (
                    <div key={row.projectId} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">{row.projectName}</h3>
                        <Badge className={performanceStatusColor[row.status]}>{row.status.replace(/_/g, " ")}</Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 mt-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Physical Performance</span>
                            <span>{row.physicalPerformance}% ({row.completedTasks}/{row.totalTasks} tasks)</span>
                          </div>
                          <Progress value={row.physicalPerformance} />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Financial Performance</span>
                            <span>{row.financialPerformance}% ({formatCurrency(row.spentAmount)} spent)</span>
                          </div>
                          <Progress value={Math.min(100, row.financialPerformance)} />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                        <p>Planned: <span className="font-medium">{formatCurrency(row.plannedBudget)}</span></p>
                        <p>Disbursed: <span className="font-medium">{formatCurrency(row.disbursedAmount)}</span></p>
                        <p>Variance: <span className="font-medium">{row.variance > 0 ? `+${row.variance}` : row.variance}%</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
