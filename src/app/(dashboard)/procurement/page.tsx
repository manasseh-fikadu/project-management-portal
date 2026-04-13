"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowRight,
  Building2,
  Calendar,
  ClipboardList,
  DollarSign,
  FileText,
  Leaf,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";

const EDIT_ROLES = new Set(["admin", "project_manager"]);
const FINAL_STATUSES = new Set(["paid", "cancelled", "rejected"]);

type ProcurementRequest = {
  id: string;
  requestNumber: string;
  title: string;
  description: string | null;
  justification: string | null;
  requestType: string;
  procurementMethod: string;
  status: string;
  approvalStatus: string;
  priority: string;
  currency: string;
  estimatedAmount: number;
  approvedAmount: number | null;
  committedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  neededByDate: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    totalBudget: number | null;
    spentBudget: number | null;
  } | null;
  budgetAllocation: {
    id: string;
    activityName: string;
    plannedAmount: number;
  } | null;
  task: {
    id: string;
    title: string;
    status: string;
  } | null;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  selectedVendor: {
    id: string;
    name: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

const statusConfig: Record<string, { className: string }> = {
  draft: { className: "bg-muted text-muted-foreground" },
  submitted: { className: "bg-amber-pale text-amber-warm" },
  approved: { className: "bg-sage-pale text-primary" },
  rfq_open: { className: "bg-lavender-pale text-lavender" },
  quotes_received: { className: "bg-lavender-pale text-lavender" },
  po_issued: { className: "bg-sage-pale text-primary" },
  partially_received: { className: "bg-amber-pale text-amber-warm" },
  received: { className: "bg-sage-pale text-primary" },
  invoiced: { className: "bg-amber-pale text-amber-warm" },
  paid: { className: "bg-sage-pale text-primary" },
  cancelled: { className: "bg-muted text-muted-foreground" },
  rejected: { className: "bg-destructive/10 text-destructive" },
};

export default function ProcurementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  useEffect(() => {
    async function loadPage() {
      await Promise.allSettled([
        (async () => {
          try {
            const res = await fetch("/api/procurement");
            const data = await res.json();
            setRequests(data.procurementRequests || []);
          } catch (error) {
            console.error("Failed to fetch procurement requests:", error);
          }
        })(),
        (async () => {
          try {
            const res = await fetch("/api/auth/me", { cache: "no-store" });
            const data = await res.json();
            setCurrentUserRole(data.user?.role ?? null);
          } catch (error) {
            console.error("Failed to fetch current user role:", error);
          }
        })(),
      ]);

      setLoading(false);
    }

    void loadPage();
  }, []);

  const canEdit = currentUserRole !== null && EDIT_ROLES.has(currentUserRole);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const request of requests) {
      if (request.project) {
        seen.set(request.project.id, request.project.name);
      }
    }

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query
        || [
          request.requestNumber,
          request.title,
          request.description || "",
          request.project?.name || "",
          request.selectedVendor?.name || "",
          request.budgetAllocation?.activityName || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesProject = projectFilter === "all" || request.project?.id === projectFilter;

      return matchesQuery && matchesStatus && matchesProject;
    });
  }, [projectFilter, requests, searchQuery, statusFilter]);

  const summary = useMemo(() => {
    return {
      totalRequests: filteredRequests.length,
      awaitingApproval: filteredRequests.filter((request) => request.approvalStatus === "pending").length,
      openPurchaseOrders: filteredRequests.filter((request) => ["po_issued", "partially_received", "received"].includes(request.status)).length,
      unpaidInvoices: filteredRequests.filter((request) => request.invoicedAmount > request.paidAmount).length,
      commitments: filteredRequests.reduce((sum, request) => sum + request.committedAmount, 0),
      paid: filteredRequests.reduce((sum, request) => sum + request.paidAmount, 0),
    };
  }, [filteredRequests]);

  const spendByProject = useMemo(() => {
    const grouped = new Map<string, { projectName: string; commitments: number; paid: number; count: number }>();

    for (const request of filteredRequests) {
      const key = request.project?.id ?? "unassigned";
      const current = grouped.get(key) ?? {
        projectName: request.project?.name ?? t("site.unassigned", { defaultValue: "Unassigned" }),
        commitments: 0,
        paid: 0,
        count: 0,
      };

      current.commitments += request.committedAmount;
      current.paid += request.paidAmount;
      current.count += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.commitments - left.commitments)
      .slice(0, 5);
  }, [filteredRequests, t]);

  const topVendors = useMemo(() => {
    const grouped = new Map<string, { vendorName: string; count: number; value: number }>();

    for (const request of filteredRequests) {
      if (!request.selectedVendor) continue;
      const current = grouped.get(request.selectedVendor.id) ?? {
        vendorName: request.selectedVendor.name,
        count: 0,
        value: 0,
      };
      current.count += 1;
      current.value += request.approvedAmount ?? request.estimatedAmount;
      grouped.set(request.selectedVendor.id, current);
    }

    return Array.from(grouped.values())
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }, [filteredRequests]);

  const agingQueue = useMemo(() => {
    const now = Date.now();

    return filteredRequests
      .filter((request) => !FINAL_STATUSES.has(request.status))
      .map((request) => {
        const ageInDays = Math.floor((now - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return { request, ageInDays };
      })
      .filter(({ ageInDays }) => ageInDays >= 7)
      .sort((left, right) => right.ageInDays - left.ageInDays)
      .slice(0, 6);
  }, [filteredRequests]);

  function formatDate(value: string | null) {
    if (!value) {
      return t("site.not_set", { defaultValue: "Not set" });
    }

    return new Date(value).toLocaleDateString();
  }

  function getStatusLabel(status: string) {
    return t(`site.${status}`, {
      defaultValue: status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("site.loading_procurement_requests", { defaultValue: "Loading procurement requests..." })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10">
      <header className="mb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-2">
              {t("sidebar.procurement", { defaultValue: "Procurement" })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("site.procurement_management_workspace", {
                defaultValue: "Track requisitions, quotations, purchase orders, receipts, invoices, and budget exposure in one place.",
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/procurement/vendors">
                <Building2 className="mr-2 h-4 w-4" />
                {t("site.vendor_directory", { defaultValue: "Vendor Directory" })}
              </Link>
            </Button>
            {canEdit && (
              <Button onClick={() => router.push("/procurement/new")} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                {t("site.new_procurement_request", { defaultValue: "New Procurement Request" })}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("site.search_procurement_requests", { defaultValue: "Search procurement requests" })}
            className="h-12 rounded-2xl border-border bg-card pl-10 shadow-sm"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 min-w-[180px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("site.all_status", { defaultValue: "All status" })}</SelectItem>
              {Object.keys(statusConfig).map((status) => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-11 min-w-[200px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("site.all_projects", { defaultValue: "All Projects" })}</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.total_requests", { defaultValue: "Total Requests" })}</CardDescription>
            <CardTitle className="text-3xl">{summary.totalRequests}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.awaiting_approval", { defaultValue: "Awaiting Approval" })}</CardDescription>
            <CardTitle className="text-3xl">{summary.awaitingApproval}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.open_purchase_orders", { defaultValue: "Open Purchase Orders" })}</CardDescription>
            <CardTitle className="text-3xl">{summary.openPurchaseOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.unpaid_invoices", { defaultValue: "Unpaid Invoices" })}</CardDescription>
            <CardTitle className="text-3xl">{summary.unpaidInvoices}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.commitments", { defaultValue: "Commitments" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(summary.commitments, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.paid", { defaultValue: "Paid" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(summary.paid, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="py-20 text-center">
          <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-primary/25" />
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim()
              ? t("site.no_procurement_requests_match_your_filters", {
                  defaultValue: "No procurement requests match your filters.",
                })
              : t("site.no_procurement_requests_yet", {
                  defaultValue: "No procurement requests have been created yet.",
                })}
          </p>
        </div>
      ) : (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            {filteredRequests.map((request) => {
              const status = statusConfig[request.status] || statusConfig.draft;

              return (
                <button
                  key={request.id}
                  onClick={() => router.push(`/procurement/${request.id}`)}
                  className="group w-full rounded-[28px] border border-border/60 bg-card p-6 text-left shadow-[0_12px_30px_rgba(34,48,24,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_38px_rgba(34,48,24,0.09)]"
                >
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                        {request.requestNumber}
                      </p>
                      <h2 className="mt-2 font-serif text-2xl leading-tight text-foreground group-hover:text-primary">
                        {request.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {request.project?.name || t("site.unassigned", { defaultValue: "Unassigned" })}
                        {request.budgetAllocation ? ` • ${request.budgetAllocation.activityName}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={status.className}>
                        {getStatusLabel(request.status)}
                      </Badge>
                      {request.approvalStatus === "pending" && (
                        <Badge className="bg-amber-pale text-amber-warm">
                          {t("site.awaiting_approval", { defaultValue: "Awaiting Approval" })}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl bg-muted/35 p-4 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      <span>{request.requestType.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{request.selectedVendor?.name || t("site.vendor_pending", { defaultValue: "Vendor pending" })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {t("site.needed_by", { defaultValue: "Needed by" })}: {formatDate(request.neededByDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span>{request.procurementMethod.replace(/_/g, " ")}</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                        {t("site.estimated_amount", { defaultValue: "Estimated Amount" })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatCurrency(request.estimatedAmount, "ETB")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                        {t("site.commitments", { defaultValue: "Commitments" })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatCurrency(request.committedAmount, "ETB")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                        {t("site.paid", { defaultValue: "Paid" })}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatCurrency(request.paidAmount, "ETB")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {t("site.created", { defaultValue: "Created" })}: {formatDate(request.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-2 font-medium text-primary">
                      {t("site.open_request", { defaultValue: "Open request" })}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("site.spend_by_project", { defaultValue: "Spend by Project" })}</CardTitle>
                <CardDescription>
                  {t("site.commitments_and_paid_value_by_project", {
                    defaultValue: "Commitments and paid value by project in the current view.",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {spendByProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("site.no_project_spend_available", { defaultValue: "No project spend available." })}
                  </p>
                ) : (
                  spendByProject.map((entry) => (
                    <div key={entry.projectName} className="rounded-2xl bg-muted/35 p-4">
                      <p className="font-medium text-foreground">{entry.projectName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.count} {t("site.requests", { defaultValue: "requests" })}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                            {t("site.commitments", { defaultValue: "Commitments" })}
                          </p>
                          <p className="mt-1 font-semibold text-foreground">{formatCurrency(entry.commitments, "ETB")}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                            {t("site.paid", { defaultValue: "Paid" })}
                          </p>
                          <p className="mt-1 font-semibold text-foreground">{formatCurrency(entry.paid, "ETB")}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("site.top_vendors", { defaultValue: "Top Vendors" })}</CardTitle>
                <CardDescription>
                  {t("site.selected_vendors_by_request_value", {
                    defaultValue: "Selected suppliers ranked by approved or requested value.",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topVendors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("site.no_vendors_selected_yet", { defaultValue: "No vendors have been selected yet." })}
                  </p>
                ) : (
                  topVendors.map((vendor) => (
                    <div key={vendor.vendorName} className="flex items-start justify-between gap-4 rounded-2xl bg-muted/35 p-4">
                      <div>
                        <p className="font-medium text-foreground">{vendor.vendorName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {vendor.count} {t("site.requests", { defaultValue: "requests" })}
                        </p>
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(vendor.value, "ETB")}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("site.aging_queue", { defaultValue: "Aging Queue" })}</CardTitle>
                <CardDescription>
                  {t("site.requests_open_for_more_than_seven_days", {
                    defaultValue: "Requests that have remained open for more than seven days.",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agingQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("site.no_aging_requests_in_view", { defaultValue: "No aging requests in the current view." })}
                  </p>
                ) : (
                  agingQueue.map(({ request, ageInDays }) => (
                    <div key={request.id} className="rounded-2xl bg-muted/35 p-4">
                      <p className="font-medium text-foreground">{request.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {request.project?.name || t("site.unassigned", { defaultValue: "Unassigned" })}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <Badge className={statusConfig[request.status]?.className || statusConfig.draft.className}>
                          {getStatusLabel(request.status)}
                        </Badge>
                        <p className="text-sm font-medium text-foreground">
                          {ageInDays} {t("site.days_open", { defaultValue: "days open" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
