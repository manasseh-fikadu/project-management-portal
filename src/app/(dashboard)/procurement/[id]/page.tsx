"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ClipboardList,
  DollarSign,
  FileText,
  Leaf,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react";

const EDIT_ROLES = new Set(["admin", "project_manager"]);
const FINAL_STATUSES = new Set(["paid", "cancelled", "rejected"]);
const QUOTATION_LOCKED_STATUSES = new Set([
  "po_issued",
  "partially_received",
  "received",
  "invoiced",
  "paid",
  "cancelled",
  "rejected",
]);

type VendorOption = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  category?: string | null;
  isActive?: boolean;
};

type ProcurementDetail = {
  procurementRequest: {
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
    submittedAt: string | null;
    approvedAt: string | null;
    purchaseOrderIssuedAt: string | null;
    receivedAt: string | null;
    invoicedAt: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
    rejectionReason: string | null;
    notes: string | null;
    projectId: string;
    budgetAllocationId: string | null;
    taskId: string | null;
    requesterId: string;
    selectedVendorId: string | null;
    project: {
      id: string;
      name: string;
      donorId: string | null;
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
    procurementOfficer: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    selectedVendor: VendorOption | null;
    lineItems: Array<{
      id: string;
      description: string;
      specification: string | null;
      category: string | null;
      quantity: number;
      unit: string | null;
      unitPrice: number;
      totalPrice: number;
    }>;
    quotations: Array<{
      id: string;
      vendorId: string;
      referenceNumber: string | null;
      amount: number;
      currency: string;
      submittedAt: string | null;
      validUntil: string | null;
      isSelected: boolean;
      notes: string | null;
      comparisonNotes: string | null;
      vendor: VendorOption | null;
      creator: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    }>;
    purchaseOrder: {
      id: string;
      vendorId: string;
      poNumber: string;
      status: string;
      amount: number;
      currency: string;
      issuedAt: string;
      expectedDeliveryDate: string | null;
      notes: string | null;
      vendor: VendorOption | null;
      creator: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    } | null;
    receipts: Array<{
      id: string;
      receiptNumber: string;
      status: string;
      receivedAmount: number;
      receivedAt: string;
      conditionNotes: string | null;
      notes: string | null;
      receiver: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    }>;
    invoices: Array<{
      id: string;
      vendorId: string;
      goodsReceiptId: string | null;
      invoiceNumber: string;
      amount: number;
      currency: string;
      status: string;
      paymentStatus: string;
      invoiceDate: string;
      dueDate: string | null;
      notes: string | null;
      linkedExpenditureId: string | null;
      linkedDisbursementId: string | null;
      vendor: VendorOption | null;
      creator: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
      linkedExpenditure: {
        id: string;
        amount: number;
        expenditureDate: string;
      } | null;
      linkedDisbursement: {
        id: string;
        amount: number;
        disbursedAt: string;
        reference: string | null;
      } | null;
    }>;
    documents: Array<{
      id: string;
      documentType: string;
      name: string;
      type: string;
      size: number;
      url: string;
      createdAt: string;
      uploader: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
    }>;
    approvals: Array<{
      id: string;
      requiredRole: string;
      decision: string;
      thresholdAmount: number;
      comments: string | null;
      decidedAt: string;
      approver: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    }>;
  };
  budgetSnapshot: {
    scope: string;
    projectName: string | null;
    budgetAllocationName: string | null;
    totalBudget: number;
    actualSpent: number;
    committedAmount: number;
    availableAmount: number;
  } | null;
  approvalRule: {
    requiredRole: string;
    thresholdAmount: number;
    label: string;
  };
};

const statusConfig: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-pale text-amber-warm",
  approved: "bg-sage-pale text-primary",
  rfq_open: "bg-lavender-pale text-lavender",
  quotes_received: "bg-lavender-pale text-lavender",
  po_issued: "bg-sage-pale text-primary",
  partially_received: "bg-amber-pale text-amber-warm",
  received: "bg-sage-pale text-primary",
  invoiced: "bg-amber-pale text-amber-warm",
  paid: "bg-sage-pale text-primary",
  cancelled: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/10 text-destructive",
};

export default function ProcurementDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = params.id;

  const [detail, setDetail] = useState<ProcurementDetail | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState("other");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);
  const [purchaseOrderDialogOpen, setPurchaseOrderDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    decision: "approved",
    approvedAmount: "",
    comments: "",
  });
  const [quotationForm, setQuotationForm] = useState({
    vendorId: "",
    referenceNumber: "",
    amount: "",
    submittedAt: "",
    validUntil: "",
    notes: "",
    isSelected: false,
  });
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({
    vendorId: "",
    amount: "",
    issuedAt: "",
    expectedDeliveryDate: "",
    notes: "",
  });
  const [receiptForm, setReceiptForm] = useState({
    receivedAmount: "",
    receivedAt: "",
    status: "received",
    conditionNotes: "",
    notes: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    vendorId: "",
    invoiceNumber: "",
    amount: "",
    invoiceDate: "",
    dueDate: "",
    goodsReceiptId: "",
    notes: "",
    postToFinancials: true,
    markAsPaid: false,
    paymentReference: "",
    paymentDate: "",
  });

  const procurementRequest = detail?.procurementRequest ?? null;
  const canEdit = currentUserRole !== null && EDIT_ROLES.has(currentUserRole);
  const canManageQuotations = canEdit && procurementRequest !== null && !QUOTATION_LOCKED_STATUSES.has(procurementRequest.status);
  const canManagePurchaseOrder =
    canEdit
    && procurementRequest !== null
    && ["approved", "rfq_open", "quotes_received", "po_issued", "partially_received", "received", "invoiced"].includes(procurementRequest.status);
  const canManageInvoices = canEdit && procurementRequest !== null && procurementRequest.purchaseOrder !== null && !FINAL_STATUSES.has(procurementRequest.status);
  const canApprove =
    procurementRequest?.approvalStatus === "pending"
    && (
      currentUserRole === "admin"
      || (currentUserRole === "project_manager" && detail?.approvalRule.requiredRole === "project_manager")
    );

  useEffect(() => {
    async function loadPage() {
      setLoading(true);

      try {
        const [detailRes, authRes, vendorsRes] = await Promise.all([
          fetch(`/api/procurement/${requestId}`),
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/vendors"),
        ]);

        const [detailData, authData, vendorsData] = await Promise.all([
          detailRes.json(),
          authRes.json(),
          vendorsRes.json(),
        ]);

        if (!detailRes.ok) {
          throw new Error(detailData.error || "Failed to load procurement request");
        }

        setDetail(detailData);
        setCurrentUserRole(authData.user?.role ?? null);
        setVendors((vendorsData.vendors || []).filter((vendor: VendorOption) => vendor.isActive !== false));
      } catch (error) {
        console.error("Failed to load procurement detail page:", error);
        router.replace("/procurement");
      } finally {
        setLoading(false);
      }
    }

    void loadPage();
  }, [requestId, router]);

  useEffect(() => {
    if (!procurementRequest) {
      return;
    }

    setApprovalForm({
      decision: "approved",
      approvedAmount: String(procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount),
      comments: "",
    });

    setQuotationForm((current) => ({
      ...current,
      vendorId: procurementRequest.selectedVendorId || procurementRequest.quotations[0]?.vendorId || current.vendorId,
      amount: String(procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount),
    }));

    setPurchaseOrderForm({
      vendorId: procurementRequest.selectedVendorId || procurementRequest.purchaseOrder?.vendorId || "",
      amount: String(
        procurementRequest.purchaseOrder?.amount
        ?? procurementRequest.approvedAmount
        ?? procurementRequest.estimatedAmount
      ),
      issuedAt: procurementRequest.purchaseOrder?.issuedAt?.split("T")[0] || "",
      expectedDeliveryDate: procurementRequest.purchaseOrder?.expectedDeliveryDate?.split("T")[0] || "",
      notes: procurementRequest.purchaseOrder?.notes || "",
    });

    setReceiptForm((current) => ({
      ...current,
      receivedAmount: String(procurementRequest.purchaseOrder?.amount ?? procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount),
    }));

    setInvoiceForm((current) => ({
      ...current,
      vendorId: procurementRequest.selectedVendorId || procurementRequest.purchaseOrder?.vendorId || current.vendorId,
      amount: String(
        procurementRequest.purchaseOrder?.amount
        ?? procurementRequest.approvedAmount
        ?? procurementRequest.estimatedAmount
      ),
    }));
  }, [procurementRequest]);

  async function refreshDetail() {
    const res = await fetch(`/api/procurement/${requestId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to refresh procurement request");
    }

    setDetail(data);
  }

  async function runAction(action: string, fn: () => Promise<void>) {
    try {
      setWorkingAction(action);
      await fn();
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    } finally {
      setWorkingAction(null);
    }
  }

  async function handleStatusChange(nextStatus: string) {
    await runAction(nextStatus, async () => {
      const res = await fetch(`/api/procurement/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update request status");
      }
      setDetail(data);
    });
  }

  async function handleApproveSubmit() {
    await runAction("approve-request", async () => {
      const res = await fetch(`/api/procurement/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: approvalForm.decision,
          approvedAmount: approvalForm.decision === "approved" ? approvalForm.approvedAmount : null,
          comments: approvalForm.comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process approval");
      }
      setDetail(data);
      setApprovalDialogOpen(false);
    });
  }

  async function handleCreateQuotation() {
    await runAction("create-quotation", async () => {
      const res = await fetch(`/api/procurement/${requestId}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quotationForm,
          vendorId: quotationForm.vendorId,
          amount: quotationForm.amount,
          isSelected: quotationForm.isSelected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save quotation");
      }
      setDetail(data);
      setQuotationDialogOpen(false);
      setQuotationForm({
        vendorId: procurementRequest?.selectedVendorId || "",
        referenceNumber: "",
        amount: "",
        submittedAt: "",
        validUntil: "",
        notes: "",
        isSelected: false,
      });
    });
  }

  async function handleSelectQuotation(quotationId: string) {
    await runAction("select-quotation", async () => {
      const res = await fetch(`/api/procurement/${requestId}/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to select quotation");
      }
      setDetail(data);
    });
  }

  async function handleIssuePurchaseOrder() {
    await runAction("purchase-order", async () => {
      const res = await fetch(`/api/procurement/${requestId}/purchase-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseOrderForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to issue purchase order");
      }
      setDetail(data);
      setPurchaseOrderDialogOpen(false);
    });
  }

  async function handleRecordReceipt() {
    await runAction("record-receipt", async () => {
      const res = await fetch(`/api/procurement/${requestId}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receiptForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record receipt");
      }
      setDetail(data);
      setReceiptDialogOpen(false);
      setReceiptForm({
        receivedAmount: "",
        receivedAt: "",
        status: "received",
        conditionNotes: "",
        notes: "",
      });
    });
  }

  async function handleCreateInvoice() {
    await runAction("create-invoice", async () => {
      const res = await fetch(`/api/procurement/${requestId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invoice");
      }
      setDetail(data);
      setInvoiceDialogOpen(false);
      setInvoiceForm((current) => ({
        ...current,
        invoiceNumber: "",
        dueDate: "",
        notes: "",
        paymentReference: "",
        paymentDate: "",
      }));
    });
  }

  async function handleMarkInvoicePaid(invoiceId: string) {
    await runAction("mark-invoice-paid", async () => {
      const res = await fetch(`/api/procurement/${requestId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          markAsPaid: true,
          paymentDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record invoice payment");
      }
      setDetail(data);
    });
  }

  async function handleUploadDocument(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);

      const res = await fetch(`/api/procurement/${requestId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload document");
      }

      await refreshDetail();
    } catch (error) {
      console.error("Failed to upload procurement document:", error);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_document", { defaultValue: "Are you sure you want to delete this document?" }))) {
      return;
    }

    await runAction("delete-document", async () => {
      const res = await fetch(`/api/procurement-documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete document");
      }
      await refreshDetail();
    });
  }

  async function handleDeleteRequest() {
    if (!confirm(t("site.are_you_sure_you_want_to_delete_this_procurement_request", { defaultValue: "Are you sure you want to delete this procurement request?" }))) {
      return;
    }

    await runAction("delete-request", async () => {
      const res = await fetch(`/api/procurement/${requestId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete procurement request");
      }
      router.push("/procurement");
    });
  }

  function formatDate(value: string | null) {
    if (!value) {
      return t("site.not_set", { defaultValue: "Not set" });
    }
    return new Date(value).toLocaleDateString();
  }

  function formatLabel(value: string) {
    return t(`site.${value}`, {
      defaultValue: value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    });
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading || !procurementRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Leaf className="h-6 w-6 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("site.loading_procurement_request", { defaultValue: "Loading procurement request..." })}
          </p>
        </div>
      </div>
    );
  }

  const statusClassName = statusConfig[procurementRequest.status] || statusConfig.draft;

  return (
    <div className="p-6 lg:p-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/procurement")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("site.back_to_procurement", { defaultValue: "Back to Procurement" })}
        </Button>

        <div className="flex flex-wrap gap-3">
          {canEdit && procurementRequest.status === "draft" && (
            <Button className="rounded-xl" disabled={workingAction !== null} onClick={() => void handleStatusChange("submitted")}>
              {workingAction === "submitted" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("site.submit_for_approval", { defaultValue: "Submit for Approval" })}
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                className="rounded-xl"
                disabled={workingAction !== null}
                onClick={() => {
                  setApprovalForm({
                    decision: "approved",
                    approvedAmount: String(procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount),
                    comments: "",
                  });
                  setApprovalDialogOpen(true);
                }}
              >
                {t("site.approve", { defaultValue: "Approve" })}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={workingAction !== null}
                onClick={() => {
                  setApprovalForm({
                    decision: "rejected",
                    approvedAmount: String(procurementRequest.approvedAmount ?? procurementRequest.estimatedAmount),
                    comments: "",
                  });
                  setApprovalDialogOpen(true);
                }}
              >
                {t("site.reject", { defaultValue: "Reject" })}
              </Button>
            </>
          )}
          {canEdit && procurementRequest.status === "approved" && (
            <Button variant="outline" className="rounded-xl" disabled={workingAction !== null} onClick={() => void handleStatusChange("rfq_open")}>
              {t("site.open_rfq", { defaultValue: "Open RFQ" })}
            </Button>
          )}
          {canEdit && !FINAL_STATUSES.has(procurementRequest.status) && (
            <Button variant="outline" className="rounded-xl" disabled={workingAction !== null} onClick={() => void handleStatusChange("cancelled")}>
              {t("site.cancel_request", { defaultValue: "Cancel Request" })}
            </Button>
          )}
          {canEdit && ["draft", "cancelled", "rejected"].includes(procurementRequest.status) && (
            <Button variant="outline" className="rounded-xl text-destructive" disabled={workingAction !== null} onClick={() => void handleDeleteRequest()}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("site.delete", { defaultValue: "Delete" })}
            </Button>
          )}
        </div>
      </div>

      <header className="mb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
              {procurementRequest.requestNumber}
            </p>
            <h1 className="mt-2 font-serif text-3xl lg:text-4xl text-foreground">
              {procurementRequest.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {procurementRequest.project?.name || t("site.unassigned", { defaultValue: "Unassigned" })}
              {procurementRequest.budgetAllocation ? ` • ${procurementRequest.budgetAllocation.activityName}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className={statusClassName}>
              {formatLabel(procurementRequest.status)}
            </Badge>
            {procurementRequest.approvalStatus === "pending" && (
              <Badge className="bg-amber-pale text-amber-warm">
                {t("site.awaiting_approval", { defaultValue: "Awaiting Approval" })}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.estimated_amount", { defaultValue: "Estimated Amount" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(procurementRequest.estimatedAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.commitments", { defaultValue: "Commitments" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(procurementRequest.committedAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.invoiced", { defaultValue: "Invoiced" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(procurementRequest.invoicedAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="gap-1">
            <CardDescription>{t("site.paid", { defaultValue: "Paid" })}</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(procurementRequest.paidAmount, "ETB")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList variant="line">
          <TabsTrigger value="overview">{t("site.overview", { defaultValue: "Overview" })}</TabsTrigger>
          <TabsTrigger value="sourcing">{t("site.sourcing", { defaultValue: "Sourcing" })}</TabsTrigger>
          <TabsTrigger value="fulfillment">{t("site.fulfillment", { defaultValue: "Fulfillment" })}</TabsTrigger>
          <TabsTrigger value="finance">{t("site.finance", { defaultValue: "Finance" })}</TabsTrigger>
          <TabsTrigger value="documents">{t("site.documents", { defaultValue: "Documents" })}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_380px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("site.request_details", { defaultValue: "Request Details" })}</CardTitle>
                  <CardDescription>
                    {t("site.core_request_metadata_and_delivery_context", {
                      defaultValue: "Core request metadata, delivery context, and project linkage.",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.request_type", { defaultValue: "Request type" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{formatLabel(procurementRequest.requestType)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.procurement_method", { defaultValue: "Procurement method" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{formatLabel(procurementRequest.procurementMethod)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.priority", { defaultValue: "Priority" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{formatLabel(procurementRequest.priority)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.needed_by", { defaultValue: "Needed by" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{formatDate(procurementRequest.neededByDate)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.description", { defaultValue: "Description" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {procurementRequest.description || t("site.not_set", { defaultValue: "Not set" })}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.justification", { defaultValue: "Justification" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {procurementRequest.justification || t("site.not_set", { defaultValue: "Not set" })}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {t("site.notes", { defaultValue: "Notes" })}
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {procurementRequest.notes || t("site.not_set", { defaultValue: "Not set" })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("site.line_items", { defaultValue: "Line Items" })}</CardTitle>
                  <CardDescription>
                    {t("site.items_or_services_requested_under_this_requisition", {
                      defaultValue: "Items or services requested under this requisition.",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {procurementRequest.lineItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("site.no_line_items_were_recorded", { defaultValue: "No line items were recorded." })}
                    </p>
                  ) : (
                    procurementRequest.lineItems.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-muted/35 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">{item.description}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.quantity} {item.unit || t("site.units", { defaultValue: "units" })} x {formatCurrency(item.unitPrice, "ETB")}
                            </p>
                            {item.specification && (
                              <p className="mt-2 text-sm text-muted-foreground">{item.specification}</p>
                            )}
                          </div>
                          <p className="font-semibold text-foreground">{formatCurrency(item.totalPrice, "ETB")}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("site.approval_history", { defaultValue: "Approval History" })}</CardTitle>
                  <CardDescription>
                    {t("site.audit_of_approval_decisions_and_thresholds", {
                      defaultValue: "Audit trail of approval decisions and applied thresholds.",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {procurementRequest.approvals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("site.no_approval_decisions_recorded_yet", { defaultValue: "No approval decisions recorded yet." })}
                    </p>
                  ) : (
                    procurementRequest.approvals.map((approval) => (
                      <div key={approval.id} className="rounded-2xl bg-muted/35 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {approval.approver
                                ? `${approval.approver.firstName} ${approval.approver.lastName}`
                                : t("site.unknown_user", { defaultValue: "Unknown user" })}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {formatLabel(approval.requiredRole)} • {formatCurrency(approval.thresholdAmount, "ETB")}
                            </p>
                            {approval.comments && (
                              <p className="mt-2 text-sm text-muted-foreground">{approval.comments}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge className={approval.decision === "approved" ? "bg-sage-pale text-primary" : "bg-destructive/10 text-destructive"}>
                              {approval.decision}
                            </Badge>
                            <p className="mt-2 text-xs text-muted-foreground">{formatDate(approval.decidedAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("site.budget_position", { defaultValue: "Budget Position" })}</CardTitle>
                  <CardDescription>
                    {t("site.remaining_budget_after_current_commitments", {
                      defaultValue: "Remaining budget after actual spend and open commitments.",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                      {detail?.budgetSnapshot?.scope === "budget_allocation"
                        ? t("site.budget_line", { defaultValue: "Budget line" })
                        : t("site.project_budget", { defaultValue: "Project budget" })}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatCurrency(detail?.budgetSnapshot?.totalBudget || 0, "ETB")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {detail?.budgetSnapshot?.budgetAllocationName || detail?.budgetSnapshot?.projectName || t("site.not_set", { defaultValue: "Not set" })}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                        {t("site.actual_spend", { defaultValue: "Actual spend" })}
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatCurrency(detail?.budgetSnapshot?.actualSpent || 0, "ETB")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
                        {t("site.remaining_budget", { defaultValue: "Remaining budget" })}
                      </p>
                      <p className="mt-1 font-semibold text-foreground">
                        {formatCurrency(detail?.budgetSnapshot?.availableAmount || 0, "ETB")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("site.workflow_dates", { defaultValue: "Workflow Dates" })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.created", { defaultValue: "Created" })}</span>
                    <span>{formatDate(procurementRequest.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.submitted", { defaultValue: "Submitted" })}</span>
                    <span>{formatDate(procurementRequest.submittedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.approved", { defaultValue: "Approved" })}</span>
                    <span>{formatDate(procurementRequest.approvedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.purchase_order", { defaultValue: "Purchase order" })}</span>
                    <span>{formatDate(procurementRequest.purchaseOrderIssuedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.received", { defaultValue: "Received" })}</span>
                    <span>{formatDate(procurementRequest.receivedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.invoiced", { defaultValue: "Invoiced" })}</span>
                    <span>{formatDate(procurementRequest.invoicedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{t("site.paid", { defaultValue: "Paid" })}</span>
                    <span>{formatDate(procurementRequest.paidAt)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("site.approval_rule", { defaultValue: "Approval Rule" })}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{detail?.approvalRule.label}</p>
                  <p>
                    {t("site.current_requester", { defaultValue: "Current requester" })}:{" "}
                    {procurementRequest.requester
                      ? `${procurementRequest.requester.firstName} ${procurementRequest.requester.lastName}`
                      : t("site.not_set", { defaultValue: "Not set" })}
                  </p>
                  <p>
                    {t("site.preferred_vendor", { defaultValue: "Preferred vendor" })}:{" "}
                    {procurementRequest.selectedVendor?.name || t("site.vendor_pending", { defaultValue: "Vendor pending" })}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sourcing">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{t("site.quotations", { defaultValue: "Quotations" })}</CardTitle>
                  <CardDescription>
                    {t("site.capture_supplier_quotes_and_select_the_preferred_offer", {
                      defaultValue: "Capture supplier quotes and select the preferred offer.",
                    })}
                  </CardDescription>
                </div>
                {canManageQuotations && (
                  <Button className="rounded-xl" onClick={() => setQuotationDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("site.add_quotation", { defaultValue: "Add Quotation" })}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {procurementRequest.quotations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("site.no_quotations_recorded_yet", { defaultValue: "No quotations recorded yet." })}
                  </p>
                ) : (
                  procurementRequest.quotations.map((quotation) => (
                    <div key={quotation.id} className="rounded-2xl bg-muted/35 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-foreground">{quotation.vendor?.name || t("site.vendor", { defaultValue: "Vendor" })}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {quotation.referenceNumber || t("site.no_reference", { defaultValue: "No reference" })}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t("site.valid_until", { defaultValue: "Valid until" })}: {formatDate(quotation.validUntil)}
                          </p>
                          {quotation.notes && (
                            <p className="mt-2 text-sm text-muted-foreground">{quotation.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-foreground">{formatCurrency(quotation.amount, "ETB")}</p>
                          {quotation.isSelected ? (
                            <Badge className="mt-2 bg-sage-pale text-primary">
                              {t("site.selected", { defaultValue: "Selected" })}
                            </Badge>
                          ) : canManageQuotations ? (
                            <Button variant="outline" className="mt-2 rounded-xl" onClick={() => void handleSelectQuotation(quotation.id)}>
                              {t("site.select_quote", { defaultValue: "Select Quote" })}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{t("site.purchase_order", { defaultValue: "Purchase Order" })}</CardTitle>
                  <CardDescription>
                    {t("site.issue_or_update_the_purchase_order_for_the_selected_vendor", {
                      defaultValue: "Issue or update the purchase order for the selected vendor.",
                    })}
                  </CardDescription>
                </div>
                {canManagePurchaseOrder && (
                  <Button className="rounded-xl" onClick={() => setPurchaseOrderDialogOpen(true)}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {procurementRequest.purchaseOrder
                      ? t("site.update_purchase_order", { defaultValue: "Update Purchase Order" })
                      : t("site.issue_purchase_order", { defaultValue: "Issue Purchase Order" })}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!procurementRequest.purchaseOrder ? (
                  <p className="text-sm text-muted-foreground">
                    {t("site.no_purchase_order_has_been_issued_yet", {
                      defaultValue: "No purchase order has been issued yet.",
                    })}
                  </p>
                ) : (
                  <div className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{procurementRequest.purchaseOrder.poNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {procurementRequest.purchaseOrder.vendor?.name || t("site.vendor", { defaultValue: "Vendor" })}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {t("site.expected_delivery_date", { defaultValue: "Expected delivery" })}: {formatDate(procurementRequest.purchaseOrder.expectedDeliveryDate)}
                        </p>
                        {procurementRequest.purchaseOrder.notes && (
                          <p className="mt-2 text-sm text-muted-foreground">{procurementRequest.purchaseOrder.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(procurementRequest.purchaseOrder.amount, "ETB")}</p>
                        <Badge className={`mt-2 ${statusConfig[procurementRequest.purchaseOrder.status] || statusConfig.po_issued}`}>
                          {formatLabel(procurementRequest.purchaseOrder.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fulfillment">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{t("site.receipts", { defaultValue: "Receipts" })}</CardTitle>
                <CardDescription>
                  {t("site.record_goods_or_service_receipts_against_the_purchase_order", {
                    defaultValue: "Record goods or service receipts against the purchase order.",
                  })}
                </CardDescription>
              </div>
              {canEdit && procurementRequest.purchaseOrder && !FINAL_STATUSES.has(procurementRequest.status) && (
                <Button className="rounded-xl" onClick={() => setReceiptDialogOpen(true)}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {t("site.record_receipt", { defaultValue: "Record Receipt" })}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {procurementRequest.receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_receipts_have_been_recorded_yet", { defaultValue: "No receipts have been recorded yet." })}
                </p>
              ) : (
                procurementRequest.receipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{receipt.receiptNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(receipt.receivedAt)} • {receipt.receiver ? `${receipt.receiver.firstName} ${receipt.receiver.lastName}` : t("site.not_set", { defaultValue: "Not set" })}
                        </p>
                        {receipt.conditionNotes && (
                          <p className="mt-2 text-sm text-muted-foreground">{receipt.conditionNotes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(receipt.receivedAmount, "ETB")}</p>
                        <Badge className={`mt-2 ${statusConfig[receipt.status] || statusConfig.received}`}>
                          {formatLabel(receipt.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{t("site.invoices", { defaultValue: "Invoices" })}</CardTitle>
                <CardDescription>
                  {t("site.capture_supplier_invoices_and_post_them_to_financials_when_ready", {
                    defaultValue: "Capture supplier invoices and post them to financials when they are ready.",
                  })}
                </CardDescription>
              </div>
              {canManageInvoices && (
                <Button className="rounded-xl" onClick={() => setInvoiceDialogOpen(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t("site.add_invoice", { defaultValue: "Add Invoice" })}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {procurementRequest.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_invoices_have_been_recorded_yet", { defaultValue: "No invoices have been recorded yet." })}
                </p>
              ) : (
                procurementRequest.invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-2xl bg-muted/35 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {invoice.vendor?.name || t("site.vendor", { defaultValue: "Vendor" })} • {formatDate(invoice.invoiceDate)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {t("site.due_date", { defaultValue: "Due date" })}: {formatDate(invoice.dueDate)}
                        </p>
                        {invoice.notes && (
                          <p className="mt-2 text-sm text-muted-foreground">{invoice.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">{formatCurrency(invoice.amount, "ETB")}</p>
                        <Badge className={`mt-2 ${statusConfig[invoice.status] || statusConfig.invoiced}`}>
                          {formatLabel(invoice.status)}
                        </Badge>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {formatLabel(invoice.paymentStatus)}
                        </p>
                        {canManageInvoices && invoice.paymentStatus !== "paid" && (
                          <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void handleMarkInvoicePaid(invoice.id)}>
                            {t("site.mark_as_paid", { defaultValue: "Mark as Paid" })}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>{t("site.procurement_documents", { defaultValue: "Procurement Documents" })}</CardTitle>
              <CardDescription>
                {t("site.attach_supporting_files_like_quotes_purchase_orders_and_invoices", {
                  defaultValue: "Attach supporting files like quotations, purchase orders, receipts, and invoices.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="sm:w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="request">{t("site.request", { defaultValue: "Request" })}</SelectItem>
                    <SelectItem value="quotation">{t("site.quotation", { defaultValue: "Quotation" })}</SelectItem>
                    <SelectItem value="purchase_order">{t("site.purchase_order", { defaultValue: "Purchase order" })}</SelectItem>
                    <SelectItem value="receipt">{t("site.receipt", { defaultValue: "Receipt" })}</SelectItem>
                    <SelectItem value="invoice">{t("site.invoice", { defaultValue: "Invoice" })}</SelectItem>
                    <SelectItem value="evaluation">{t("site.evaluation", { defaultValue: "Evaluation" })}</SelectItem>
                    <SelectItem value="other">{t("site.other", { defaultValue: "Other" })}</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="rounded-xl" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t("site.upload_document", { defaultValue: "Upload Document" })}
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadDocument} />
              </div>

              {procurementRequest.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("site.no_documents_uploaded_for_this_entry", { defaultValue: "No documents uploaded for this entry." })}
                </p>
              ) : (
                <div className="space-y-3">
                  {procurementRequest.documents.map((document) => (
                    <div key={document.id} className="flex flex-col gap-4 rounded-2xl bg-muted/35 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">{document.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatLabel(document.documentType)} • {formatFileSize(document.size)} • {formatDate(document.createdAt)}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {document.uploader
                            ? `${document.uploader.firstName} ${document.uploader.lastName}`
                            : t("site.not_set", { defaultValue: "Not set" })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" className="rounded-xl">
                          <a href={document.url} target="_blank" rel="noreferrer">
                            {t("site.view", { defaultValue: "View" })}
                          </a>
                        </Button>
                        {canEdit && (
                          <Button variant="outline" className="rounded-xl text-destructive" onClick={() => void handleDeleteDocument(document.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("site.delete", { defaultValue: "Delete" })}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalForm.decision === "approved"
                ? t("site.approve_request", { defaultValue: "Approve Request" })
                : t("site.reject_request", { defaultValue: "Reject Request" })}
            </DialogTitle>
            <DialogDescription>
              {t("site.record_your_decision_and_any_supporting_notes", {
                defaultValue: "Record your decision and any supporting notes.",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approvalForm.decision === "approved" && (
              <div className="space-y-2">
                <Label>{t("site.approved_amount", { defaultValue: "Approved amount" })}</Label>
                <Input
                  type="number"
                  min={0}
                  value={approvalForm.approvedAmount}
                  onChange={(event) => setApprovalForm((current) => ({ ...current, approvedAmount: event.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("site.comments", { defaultValue: "Comments" })}</Label>
              <Textarea
                value={approvalForm.comments}
                onChange={(event) => setApprovalForm((current) => ({ ...current, comments: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              {t("site.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={() => void handleApproveSubmit()} disabled={workingAction !== null}>
              {workingAction === "approve-request" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {approvalForm.decision === "approved"
                ? t("site.approve", { defaultValue: "Approve" })
                : t("site.reject", { defaultValue: "Reject" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quotationDialogOpen} onOpenChange={setQuotationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("site.add_quotation", { defaultValue: "Add Quotation" })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("site.vendor", { defaultValue: "Vendor" })}</Label>
              <Select
                value={quotationForm.vendorId || "none"}
                onValueChange={(value) => setQuotationForm((current) => ({ ...current, vendorId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("site.select_vendor", { defaultValue: "Select vendor" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("site.select_vendor", { defaultValue: "Select vendor" })}</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("site.reference_number", { defaultValue: "Reference number" })}</Label>
              <Input
                value={quotationForm.referenceNumber}
                onChange={(event) => setQuotationForm((current) => ({ ...current, referenceNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("site.amount", { defaultValue: "Amount" })}</Label>
              <Input
                type="number"
                min={0}
                value={quotationForm.amount}
                onChange={(event) => setQuotationForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.submitted", { defaultValue: "Submitted" })}</Label>
                <Input
                  type="date"
                  value={quotationForm.submittedAt}
                  onChange={(event) => setQuotationForm((current) => ({ ...current, submittedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.valid_until", { defaultValue: "Valid until" })}</Label>
                <Input
                  type="date"
                  value={quotationForm.validUntil}
                  onChange={(event) => setQuotationForm((current) => ({ ...current, validUntil: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("site.notes", { defaultValue: "Notes" })}</Label>
              <Textarea
                value={quotationForm.notes}
                onChange={(event) => setQuotationForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={quotationForm.isSelected}
                onChange={(event) => setQuotationForm((current) => ({ ...current, isSelected: event.target.checked }))}
              />
              {t("site.select_this_quote_as_preferred", { defaultValue: "Select this quote as the preferred offer" })}
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotationDialogOpen(false)}>
              {t("site.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={() => void handleCreateQuotation()} disabled={workingAction !== null}>
              {workingAction === "create-quotation" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("site.save", { defaultValue: "Save" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseOrderDialogOpen} onOpenChange={setPurchaseOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {procurementRequest.purchaseOrder
                ? t("site.update_purchase_order", { defaultValue: "Update Purchase Order" })
                : t("site.issue_purchase_order", { defaultValue: "Issue Purchase Order" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("site.vendor", { defaultValue: "Vendor" })}</Label>
              <Select
                value={purchaseOrderForm.vendorId || "none"}
                onValueChange={(value) => setPurchaseOrderForm((current) => ({ ...current, vendorId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("site.select_vendor", { defaultValue: "Select vendor" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("site.select_vendor", { defaultValue: "Select vendor" })}</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("site.amount", { defaultValue: "Amount" })}</Label>
              <Input
                type="number"
                min={0}
                value={purchaseOrderForm.amount}
                onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.issue_date", { defaultValue: "Issue date" })}</Label>
                <Input
                  type="date"
                  value={purchaseOrderForm.issuedAt}
                  onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, issuedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.expected_delivery_date", { defaultValue: "Expected delivery date" })}</Label>
                <Input
                  type="date"
                  value={purchaseOrderForm.expectedDeliveryDate}
                  onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, expectedDeliveryDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("site.notes", { defaultValue: "Notes" })}</Label>
              <Textarea
                value={purchaseOrderForm.notes}
                onChange={(event) => setPurchaseOrderForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseOrderDialogOpen(false)}>
              {t("site.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={() => void handleIssuePurchaseOrder()} disabled={workingAction !== null}>
              {workingAction === "purchase-order" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("site.save", { defaultValue: "Save" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("site.record_receipt", { defaultValue: "Record Receipt" })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("site.received_amount", { defaultValue: "Received amount" })}</Label>
              <Input
                type="number"
                min={0}
                value={receiptForm.receivedAmount}
                onChange={(event) => setReceiptForm((current) => ({ ...current, receivedAmount: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.received", { defaultValue: "Received" })}</Label>
                <Input
                  type="date"
                  value={receiptForm.receivedAt}
                  onChange={(event) => setReceiptForm((current) => ({ ...current, receivedAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.status", { defaultValue: "Status" })}</Label>
                <Select
                  value={receiptForm.status}
                  onValueChange={(value) => setReceiptForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partial">{t("site.partially_received", { defaultValue: "Partially received" })}</SelectItem>
                    <SelectItem value="received">{t("site.received", { defaultValue: "Received" })}</SelectItem>
                    <SelectItem value="rejected">{t("site.rejected", { defaultValue: "Rejected" })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("site.condition_notes", { defaultValue: "Condition notes" })}</Label>
              <Textarea
                value={receiptForm.conditionNotes}
                onChange={(event) => setReceiptForm((current) => ({ ...current, conditionNotes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("site.notes", { defaultValue: "Notes" })}</Label>
              <Textarea
                value={receiptForm.notes}
                onChange={(event) => setReceiptForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              {t("site.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={() => void handleRecordReceipt()} disabled={workingAction !== null}>
              {workingAction === "record-receipt" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("site.save", { defaultValue: "Save" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("site.add_invoice", { defaultValue: "Add Invoice" })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("site.vendor", { defaultValue: "Vendor" })}</Label>
              <Select
                value={invoiceForm.vendorId || "none"}
                onValueChange={(value) => setInvoiceForm((current) => ({ ...current, vendorId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("site.select_vendor", { defaultValue: "Select vendor" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("site.select_vendor", { defaultValue: "Select vendor" })}</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.invoice_number", { defaultValue: "Invoice number" })}</Label>
                <Input
                  value={invoiceForm.invoiceNumber}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.amount", { defaultValue: "Amount" })}</Label>
                <Input
                  type="number"
                  min={0}
                  value={invoiceForm.amount}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.invoice_date", { defaultValue: "Invoice date" })}</Label>
                <Input
                  type="date"
                  value={invoiceForm.invoiceDate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.due_date", { defaultValue: "Due date" })}</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("site.related_receipt", { defaultValue: "Related receipt" })}</Label>
              <Select
                value={invoiceForm.goodsReceiptId || "none"}
                onValueChange={(value) => setInvoiceForm((current) => ({ ...current, goodsReceiptId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("site.select_receipt_optional", { defaultValue: "Select receipt (optional)" })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("site.none", { defaultValue: "None" })}</SelectItem>
                  {procurementRequest.receipts.map((receipt) => (
                    <SelectItem key={receipt.id} value={receipt.id}>
                      {receipt.receiptNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("site.notes", { defaultValue: "Notes" })}</Label>
              <Textarea
                value={invoiceForm.notes}
                onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={invoiceForm.postToFinancials}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, postToFinancials: event.target.checked }))}
                />
                {t("site.post_to_financials", { defaultValue: "Post to financials" })}
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={invoiceForm.markAsPaid}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, markAsPaid: event.target.checked }))}
                />
                {t("site.mark_as_paid", { defaultValue: "Mark as paid" })}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("site.payment_reference", { defaultValue: "Payment reference" })}</Label>
                <Input
                  value={invoiceForm.paymentReference}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, paymentReference: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("site.payment_date", { defaultValue: "Payment date" })}</Label>
                <Input
                  type="date"
                  value={invoiceForm.paymentDate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, paymentDate: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              {t("site.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button onClick={() => void handleCreateInvoice()} disabled={workingAction !== null}>
              {workingAction === "create-invoice" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("site.save", { defaultValue: "Save" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
