export const PROCUREMENT_REQUEST_TYPES = [
  "goods",
  "services",
  "works",
  "consultancy",
] as const;

export const PROCUREMENT_METHODS = [
  "direct_purchase",
  "request_for_quotation",
  "framework_agreement",
  "restricted_bidding",
  "open_tender",
  "single_source",
] as const;

export const PROCUREMENT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rfq_open",
  "quotes_received",
  "po_issued",
  "partially_received",
  "received",
  "invoiced",
  "paid",
  "cancelled",
  "rejected",
] as const;

export const PROCUREMENT_APPROVAL_STATUSES = [
  "not_started",
  "pending",
  "approved",
  "rejected",
] as const;

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "issued",
  "partially_received",
  "received",
  "cancelled",
] as const;

export const GOODS_RECEIPT_STATUSES = [
  "partial",
  "received",
  "rejected",
] as const;

export const SUPPLIER_INVOICE_STATUSES = [
  "received",
  "approved",
  "paid",
  "rejected",
] as const;

export const SUPPLIER_PAYMENT_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
] as const;

export const PROCUREMENT_DOCUMENT_TYPES = [
  "request",
  "quotation",
  "purchase_order",
  "receipt",
  "invoice",
  "evaluation",
  "other",
] as const;

export type ProcurementRequestType = (typeof PROCUREMENT_REQUEST_TYPES)[number];
export type ProcurementMethod = (typeof PROCUREMENT_METHODS)[number];
export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];
export type ProcurementApprovalStatus = (typeof PROCUREMENT_APPROVAL_STATUSES)[number];
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUSES)[number];
export type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number];
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];
export type ProcurementDocumentType = (typeof PROCUREMENT_DOCUMENT_TYPES)[number];

export const PROCUREMENT_ALLOWED_STATUS_TRANSITIONS: Record<ProcurementStatus, ProcurementStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["rfq_open", "po_issued", "cancelled"],
  rfq_open: ["quotes_received", "cancelled"],
  quotes_received: ["po_issued", "cancelled"],
  po_issued: ["partially_received", "received", "cancelled"],
  partially_received: ["received", "invoiced", "cancelled"],
  received: ["invoiced", "cancelled"],
  invoiced: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
  rejected: [],
};

export function isProcurementStatus(value: string): value is ProcurementStatus {
  return PROCUREMENT_STATUSES.includes(value as ProcurementStatus);
}

export function isProcurementMethod(value: string): value is ProcurementMethod {
  return PROCUREMENT_METHODS.includes(value as ProcurementMethod);
}

export function isProcurementRequestType(value: string): value is ProcurementRequestType {
  return PROCUREMENT_REQUEST_TYPES.includes(value as ProcurementRequestType);
}

export function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return PURCHASE_ORDER_STATUSES.includes(value as PurchaseOrderStatus);
}

export function isGoodsReceiptStatus(value: string): value is GoodsReceiptStatus {
  return GOODS_RECEIPT_STATUSES.includes(value as GoodsReceiptStatus);
}

export function isSupplierInvoiceStatus(value: string): value is SupplierInvoiceStatus {
  return SUPPLIER_INVOICE_STATUSES.includes(value as SupplierInvoiceStatus);
}

export function isSupplierPaymentStatus(value: string): value is SupplierPaymentStatus {
  return SUPPLIER_PAYMENT_STATUSES.includes(value as SupplierPaymentStatus);
}

export function isAllowedProcurementTransition(
  currentStatus: ProcurementStatus,
  nextStatus: ProcurementStatus
): boolean {
  return PROCUREMENT_ALLOWED_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function generateProcurementRequestNumber(date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `PR-${year}${month}-${uniqueSuffix}`;
}

export function generatePurchaseOrderNumber(date = new Date()): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `PO-${year}${month}-${uniqueSuffix}`;
}

export function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toRoundedAmount(value: unknown): number | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.round(numericValue);
}

export function buildProcurementLookupText(payload: {
  title?: string | null;
  description?: string | null;
  justification?: string | null;
  notes?: string | null;
  requestNumber?: string | null;
}): string {
  return [
    payload.requestNumber,
    payload.title,
    payload.description,
    payload.justification,
    payload.notes,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();
}
