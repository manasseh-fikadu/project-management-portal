import { pgTable, text, timestamp, uuid, varchar, integer, boolean, pgEnum, jsonb, uniqueIndex, check, index, AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "manager", "user"]);
export const profileRoleEnum = pgEnum("profile_role", ["admin", "project_manager", "team_member", "donor"]);
export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);
export const emailOutboxStatusEnum = pgEnum("email_outbox_status", ["pending", "processing", "sent", "failed"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "deadline_approaching", "deadline_overdue",
  "approval_pending", "approval_decision",
  "task_assigned", "milestone_updated"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: roleEnum("role").default("user").notNull(),
  department: varchar("department", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  passwordChangedAt: timestamp("password_changed_at"),
  firstLoginAt: timestamp("first_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  role: profileRoleEnum("role").default("team_member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  otpHash: varchar("otp_hash", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 50 }).notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: emailOutboxStatusEnum("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  processorId: varchar("processor_id", { length: 100 }),
  processingStartedAt: timestamp("processing_started_at"),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: auditActionEnum("action").notNull(),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  changes: jsonb("changes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectStatusEnum = pgEnum("project_status", ["planning", "active", "on_hold", "completed", "cancelled"]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("planning").notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  totalBudget: integer("total_budget").default(0),
  spentBudget: integer("spent_budget").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  managerId: uuid("manager_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDocuments = pgTable("project_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const milestoneStatusEnum = pgEnum("milestone_status", ["pending", "in_progress", "completed", "cancelled"]);

export const milestones = pgTable("milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: milestoneStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const donorStatusEnum = pgEnum("donor_status", ["active", "pending", "completed", "withdrawn"]);

export const donorTypeEnum = pgEnum("donor_type", ["government", "foundation", "corporate", "individual", "multilateral", "ngo"]);
export const reportingTemplateEnum = pgEnum("reporting_template", ["agra_budget_breakdown", "eif_cpd_annex", "ppg_boost"]);
export const reportingNodeTypeEnum = pgEnum("reporting_node_type", ["outcome", "output", "activity", "sub_activity"]);
export const reportingFundingFacilityEnum = pgEnum("reporting_funding_facility", ["ff1", "ff2", "eif", "other", "unspecified"]);
export const reportingTransactionTypeEnum = pgEnum("reporting_transaction_type", ["expenditure", "disbursement"]);
export const disbursementDirectionValues = ["outward", "inward"] as const;
export type DisbursementDirection = typeof disbursementDirectionValues[number];
export const disbursementDirectionEnum = pgEnum("disbursement_direction", disbursementDirectionValues);

export const donors = pgTable("donors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: donorTypeEnum("type").notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  website: varchar("website", { length: 500 }),
  grantTypes: text("grant_types"),
  focusAreas: text("focus_areas"),
  averageGrantSize: integer("average_grant_size"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectDonors = pgTable("project_donors", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  status: donorStatusEnum("status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectDonorUnique: uniqueIndex("project_donors_project_id_donor_id_key").on(table.projectId, table.donorId),
}));

export const procurementRequestTypeEnum = pgEnum("procurement_request_type", [
  "goods",
  "services",
  "works",
  "consultancy",
]);
export const procurementMethodEnum = pgEnum("procurement_method", [
  "direct_purchase",
  "request_for_quotation",
  "framework_agreement",
  "restricted_bidding",
  "open_tender",
  "single_source",
]);
export const procurementStatusEnum = pgEnum("procurement_status", [
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
]);
export const procurementApprovalStatusEnum = pgEnum("procurement_approval_status", [
  "not_started",
  "pending",
  "approved",
  "rejected",
]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "issued",
  "partially_received",
  "received",
  "cancelled",
]);
export const goodsReceiptStatusEnum = pgEnum("goods_receipt_status", [
  "partial",
  "received",
  "rejected",
]);
export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "received",
  "approved",
  "paid",
  "rejected",
]);
export const supplierPaymentStatusEnum = pgEnum("supplier_payment_status", [
  "unpaid",
  "partially_paid",
  "paid",
]);
export const procurementApprovalRoleEnum = pgEnum("procurement_approval_role", [
  "project_manager",
  "admin",
]);
export const procurementApprovalDecisionEnum = pgEnum("procurement_approval_decision", [
  "approved",
  "rejected",
]);
export const procurementDocumentTypeEnum = pgEnum("procurement_document_type", [
  "request",
  "quotation",
  "purchase_order",
  "receipt",
  "invoice",
  "evaluation",
  "other",
]);

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  website: varchar("website", { length: 500 }),
  taxId: varchar("tax_id", { length: 120 }),
  bankAccountName: varchar("bank_account_name", { length: 255 }),
  bankAccountNumber: varchar("bank_account_number", { length: 120 }),
  bankName: varchar("bank_name", { length: 255 }),
  category: varchar("category", { length: 120 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vendorNameIdx: index("vendors_name_idx").on(table.name),
  vendorActiveIdx: index("vendors_is_active_idx").on(table.isActive),
}));

export const procurementRequests = pgTable("procurement_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestNumber: varchar("request_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  justification: text("justification"),
  requestType: procurementRequestTypeEnum("request_type").default("goods").notNull(),
  procurementMethod: procurementMethodEnum("procurement_method").default("request_for_quotation").notNull(),
  status: procurementStatusEnum("status").default("draft").notNull(),
  approvalStatus: procurementApprovalStatusEnum("approval_status").default("not_started").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  estimatedAmount: integer("estimated_amount").notNull(),
  approvedAmount: integer("approved_amount"),
  committedAmount: integer("committed_amount").default(0).notNull(),
  invoicedAmount: integer("invoiced_amount").default(0).notNull(),
  paidAmount: integer("paid_amount").default(0).notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  requesterId: uuid("requester_id").references(() => users.id).notNull(),
  procurementOfficerId: uuid("procurement_officer_id").references(() => users.id, { onDelete: "set null" }),
  selectedVendorId: uuid("selected_vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  lookupText: text("lookup_text"),
  neededByDate: timestamp("needed_by_date"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  purchaseOrderIssuedAt: timestamp("purchase_order_issued_at"),
  receivedAt: timestamp("received_at"),
  invoicedAt: timestamp("invoiced_at"),
  paidAt: timestamp("paid_at"),
  cancelledAt: timestamp("cancelled_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  requestNumberUnique: uniqueIndex("procurement_requests_request_number_key").on(table.requestNumber),
  procurementRequestsProjectIdx: index("procurement_requests_project_id_idx").on(table.projectId),
  procurementRequestsBudgetIdx: index("procurement_requests_budget_allocation_id_idx").on(table.budgetAllocationId),
  procurementRequestsTaskIdx: index("procurement_requests_task_id_idx").on(table.taskId),
  procurementRequestsStatusIdx: index("procurement_requests_status_idx").on(table.status),
  procurementRequestsApprovalStatusIdx: index("procurement_requests_approval_status_idx").on(table.approvalStatus),
  procurementRequestsSelectedVendorIdx: index("procurement_requests_selected_vendor_id_idx").on(table.selectedVendorId),
  procurementRequestsEstimatedAmountCheck: check(
    "procurement_requests_estimated_amount_check",
    sql`${table.estimatedAmount} > 0`
  ),
  procurementRequestsApprovedAmountCheck: check(
    "procurement_requests_approved_amount_check",
    sql`${table.approvedAmount} IS NULL OR ${table.approvedAmount} >= 0`
  ),
}));

export const procurementRequestItems = pgTable("procurement_request_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  specification: text("specification"),
  category: varchar("category", { length: 120 }),
  quantity: integer("quantity").default(1).notNull(),
  unit: varchar("unit", { length: 50 }),
  unitPrice: integer("unit_price").default(0).notNull(),
  totalPrice: integer("total_price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  procurementRequestItemsRequestIdx: index("procurement_request_items_request_id_idx").on(table.procurementRequestId),
  procurementRequestItemsQuantityCheck: check(
    "procurement_request_items_quantity_check",
    sql`${table.quantity} > 0`
  ),
  procurementRequestItemsUnitPriceCheck: check(
    "procurement_request_items_unit_price_check",
    sql`${table.unitPrice} >= 0`
  ),
  procurementRequestItemsTotalPriceCheck: check(
    "procurement_request_items_total_price_check",
    sql`${table.totalPrice} >= 0`
  ),
}));

export const vendorQuotations = pgTable("vendor_quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id).notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  submittedAt: timestamp("submitted_at"),
  validUntil: timestamp("valid_until"),
  isSelected: boolean("is_selected").default(false).notNull(),
  notes: text("notes"),
  comparisonNotes: text("comparison_notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  vendorQuotationsRequestIdx: index("vendor_quotations_request_id_idx").on(table.procurementRequestId),
  vendorQuotationsVendorIdx: index("vendor_quotations_vendor_id_idx").on(table.vendorId),
  vendorQuotationsAmountCheck: check("vendor_quotations_amount_check", sql`${table.amount} > 0`),
}));

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id).notNull(),
  poNumber: varchar("po_number", { length: 60 }).notNull(),
  status: purchaseOrderStatusEnum("status").default("issued").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  issuedAt: timestamp("issued_at").notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  purchaseOrdersRequestUnique: uniqueIndex("purchase_orders_procurement_request_id_key").on(table.procurementRequestId),
  purchaseOrdersPoNumberUnique: uniqueIndex("purchase_orders_po_number_key").on(table.poNumber),
  purchaseOrdersVendorIdx: index("purchase_orders_vendor_id_idx").on(table.vendorId),
  purchaseOrdersStatusIdx: index("purchase_orders_status_idx").on(table.status),
  purchaseOrdersAmountCheck: check("purchase_orders_amount_check", sql`${table.amount} > 0`),
}));

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "cascade" }).notNull(),
  receiptNumber: varchar("receipt_number", { length: 60 }).notNull(),
  status: goodsReceiptStatusEnum("status").default("received").notNull(),
  receivedAmount: integer("received_amount").default(0).notNull(),
  conditionNotes: text("condition_notes"),
  notes: text("notes"),
  receivedBy: uuid("received_by").references(() => users.id).notNull(),
  receivedAt: timestamp("received_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  goodsReceiptsReceiptNumberUnique: uniqueIndex("goods_receipts_receipt_number_key").on(table.receiptNumber),
  goodsReceiptsRequestIdx: index("goods_receipts_request_id_idx").on(table.procurementRequestId),
  goodsReceiptsPurchaseOrderIdx: index("goods_receipts_purchase_order_id_idx").on(table.purchaseOrderId),
  goodsReceiptsReceivedAmountCheck: check("goods_receipts_received_amount_check", sql`${table.receivedAmount} >= 0`),
}));

export const supplierInvoices = pgTable("supplier_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendors.id).notNull(),
  goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceipts.id, { onDelete: "set null" }),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  status: supplierInvoiceStatusEnum("status").default("received").notNull(),
  paymentStatus: supplierPaymentStatusEnum("payment_status").default("unpaid").notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date"),
  linkedExpenditureId: uuid("linked_expenditure_id").references(() => expenditures.id, { onDelete: "set null" }),
  linkedDisbursementId: uuid("linked_disbursement_id").references(() => disbursementLogs.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  supplierInvoicesVendorInvoiceUnique: uniqueIndex("supplier_invoices_vendor_invoice_key").on(
    table.vendorId,
    table.invoiceNumber
  ),
  supplierInvoicesRequestIdx: index("supplier_invoices_request_id_idx").on(table.procurementRequestId),
  supplierInvoicesVendorIdx: index("supplier_invoices_vendor_id_idx").on(table.vendorId),
  supplierInvoicesStatusIdx: index("supplier_invoices_status_idx").on(table.status),
  supplierInvoicesAmountCheck: check("supplier_invoices_amount_check", sql`${table.amount} > 0`),
}));

export const procurementDocuments = pgTable("procurement_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  quotationId: uuid("quotation_id").references(() => vendorQuotations.id, { onDelete: "set null" }),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceipts.id, { onDelete: "set null" }),
  supplierInvoiceId: uuid("supplier_invoice_id").references(() => supplierInvoices.id, { onDelete: "set null" }),
  documentType: procurementDocumentTypeEnum("document_type").default("other").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  procurementDocumentsRequestIdx: index("procurement_documents_request_id_idx").on(table.procurementRequestId),
  procurementDocumentsQuotationIdx: index("procurement_documents_quotation_id_idx").on(table.quotationId),
  procurementDocumentsPurchaseOrderIdx: index("procurement_documents_purchase_order_id_idx").on(table.purchaseOrderId),
  procurementDocumentsGoodsReceiptIdx: index("procurement_documents_goods_receipt_id_idx").on(table.goodsReceiptId),
  procurementDocumentsSupplierInvoiceIdx: index("procurement_documents_supplier_invoice_id_idx").on(table.supplierInvoiceId),
}));

export const procurementApprovals = pgTable("procurement_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  procurementRequestId: uuid("procurement_request_id").references(() => procurementRequests.id, { onDelete: "cascade" }).notNull(),
  approverId: uuid("approver_id").references(() => users.id).notNull(),
  requiredRole: procurementApprovalRoleEnum("required_role").notNull(),
  decision: procurementApprovalDecisionEnum("decision").notNull(),
  thresholdAmount: integer("threshold_amount").notNull(),
  comments: text("comments"),
  decidedAt: timestamp("decided_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  procurementApprovalsRequestIdx: index("procurement_approvals_request_id_idx").on(table.procurementRequestId),
  procurementApprovalsApproverIdx: index("procurement_approvals_approver_id_idx").on(table.approverId),
  procurementApprovalsThresholdCheck: check("procurement_approvals_threshold_amount_check", sql`${table.thresholdAmount} >= 0`),
}));

export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn"]);
export const proposalTypeEnum = pgEnum("proposal_type", ["grant", "tor"]);

export const proposalTemplates = pgTable("proposal_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  sections: jsonb("sections").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  proposalType: proposalTypeEnum("proposal_type").default("grant").notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  templateId: uuid("template_id").references(() => proposalTemplates.id, { onDelete: "set null" }),
  status: proposalStatusEnum("status").default("draft").notNull(),
  amountRequested: integer("amount_requested").notNull(),
  amountApproved: integer("amount_approved"),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  torCode: varchar("tor_code", { length: 100 }),
  torSubmissionRef: varchar("tor_submission_ref", { length: 150 }),
  templateData: jsonb("template_data"),
  lookupText: text("lookup_text"),
  submissionDate: timestamp("submission_date"),
  decisionDate: timestamp("decision_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  description: text("description"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  proposalTypeIdx: index("proposals_proposal_type_idx").on(table.proposalType),
  proposalStatusIdx: index("proposals_status_idx").on(table.status),
  proposalDonorIdx: index("proposals_donor_id_idx").on(table.donorId),
  proposalProjectIdx: index("proposals_project_id_idx").on(table.projectId),
  proposalSubmissionDateIdx: index("proposals_submission_date_idx").on(table.submissionDate),
  proposalCreatedAtIdx: index("proposals_created_at_idx").on(table.createdAt),
}));

export const proposalDocuments = pgTable("proposal_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed"]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("pending").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  dueDate: timestamp("due_date"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  progress: integer("progress").default(0).notNull(),
  completedAt: timestamp("completed_at"),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  progressRangeCheck: check("tasks_progress_range_check", sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
  budgetAllocationIdIdx: uniqueIndex("tasks_budget_allocation_id_idx").on(table.budgetAllocationId),
}));

export const taskMilestones = pgTable("task_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskMilestoneUnique: uniqueIndex("task_milestones_task_id_milestone_id_key").on(table.taskId, table.milestoneId),
  taskIdIdx: index("task_milestones_task_id_idx").on(table.taskId),
  milestoneIdIdx: index("task_milestones_milestone_id_idx").on(table.milestoneId),
}));

export const taskDocuments = pgTable("task_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull(),
  metadata: jsonb("metadata"),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const budgetAllocations = pgTable("budget_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  plannedAmount: integer("planned_amount").notNull(),
  q1Amount: integer("q1_amount").default(0).notNull(),
  q2Amount: integer("q2_amount").default(0).notNull(),
  q3Amount: integer("q3_amount").default(0).notNull(),
  q4Amount: integer("q4_amount").default(0).notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expenditures = pgTable("expenditures", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  activityName: varchar("activity_name", { length: 255 }),
  amount: integer("amount").notNull(),
  expenditureDate: timestamp("expenditure_date").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const disbursementLogs = pgTable("disbursement_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  budgetAllocationId: uuid("budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  expenditureId: uuid("expenditure_id").references(() => expenditures.id, { onDelete: "set null" }),
  direction: disbursementDirectionEnum("direction").default("outward").notNull(),
  activityName: varchar("activity_name", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  disbursedAt: timestamp("disbursed_at").notNull(),
  reference: varchar("reference", { length: 255 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const donorAccessTokens = pgTable("donor_access_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportingProfiles = pgTable("reporting_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  primaryTemplate: reportingTemplateEnum("primary_template").default("eif_cpd_annex").notNull(),
  country: varchar("country", { length: 120 }),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  reportingStartDate: timestamp("reporting_start_date"),
  reportingEndDate: timestamp("reporting_end_date"),
  annualYear: integer("annual_year"),
  fundingFacility1Label: varchar("funding_facility_1_label", { length: 120 }),
  fundingFacility2Label: varchar("funding_facility_2_label", { length: 120 }),
  otherFundingLabel: varchar("other_funding_label", { length: 120 }),
  leadAgency: varchar("lead_agency", { length: 255 }),
  implementingPartner: varchar("implementing_partner", { length: 255 }),
  procurementNotes: text("procurement_notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingProfilesProjectUnique: uniqueIndex("reporting_profiles_project_id_key").on(table.projectId),
}));

export const reportingResults = pgTable("reporting_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => reportingProfiles.id, { onDelete: "set null" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => reportingResults.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  sourceBudgetAllocationId: uuid("source_budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  nodeType: reportingNodeTypeEnum("node_type").notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  indicatorCode: varchar("indicator_code", { length: 100 }),
  indicatorLabel: text("indicator_label"),
  baselineValue: integer("baseline_value"),
  targetValue: integer("target_value"),
  actualValue: integer("actual_value"),
  unitType: varchar("unit_type", { length: 100 }),
  targetGroup: text("target_group"),
  responsibleEntity: varchar("responsible_entity", { length: 255 }),
  leadEntity: varchar("lead_entity", { length: 255 }),
  meansOfVerification: text("means_of_verification"),
  assumptions: text("assumptions"),
  category: varchar("category", { length: 120 }),
  procurementCategory: varchar("procurement_category", { length: 120 }),
  procurementMethod: varchar("procurement_method", { length: 120 }),
  comment: text("comment"),
  executionRate: integer("execution_rate"),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingResultsProjectIdx: index("reporting_results_project_id_idx").on(table.projectId),
  reportingResultsParentIdx: index("reporting_results_parent_id_idx").on(table.parentId),
  reportingResultsCodeIdx: index("reporting_results_code_idx").on(table.projectId, table.code),
}));

export const reportingBudgetLines = pgTable("reporting_budget_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  profileId: uuid("profile_id").references(() => reportingProfiles.id, { onDelete: "set null" }),
  reportingResultId: uuid("reporting_result_id").references(() => reportingResults.id, { onDelete: "set null" }),
  sourceBudgetAllocationId: uuid("source_budget_allocation_id").references(() => budgetAllocations.id, { onDelete: "set null" }),
  accountCode: varchar("account_code", { length: 100 }),
  accountTitle: varchar("account_title", { length: 255 }),
  lineDescription: text("line_description"),
  fundingFacility: reportingFundingFacilityEnum("funding_facility").default("unspecified").notNull(),
  otherFundingSource: varchar("other_funding_source", { length: 255 }),
  unit: varchar("unit", { length: 80 }),
  quantity: integer("quantity"),
  unitCost: integer("unit_cost"),
  plannedAmount: integer("planned_amount").default(0).notNull(),
  actualAmount: integer("actual_amount").default(0).notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  year: integer("year"),
  month: integer("month"),
  quarter: integer("quarter"),
  procurementCategory: varchar("procurement_category", { length: 120 }),
  procurementMethod: varchar("procurement_method", { length: 120 }),
  comment: text("comment"),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  reportingBudgetLinesProjectIdx: index("reporting_budget_lines_project_id_idx").on(table.projectId),
  reportingBudgetLinesResultIdx: index("reporting_budget_lines_result_id_idx").on(table.reportingResultId),
  reportingBudgetLinesAccountIdx: index("reporting_budget_lines_account_idx").on(table.projectId, table.accountCode),
}));

export const reportingTransactions = pgTable("reporting_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  reportingResultId: uuid("reporting_result_id").references(() => reportingResults.id, { onDelete: "set null" }),
  reportingBudgetLineId: uuid("reporting_budget_line_id").references(() => reportingBudgetLines.id, { onDelete: "set null" }),
  donorId: uuid("donor_id").references(() => donors.id, { onDelete: "set null" }),
  sourceExpenditureId: uuid("source_expenditure_id").references(() => expenditures.id, { onDelete: "set null" }),
  sourceDisbursementId: uuid("source_disbursement_id").references(() => disbursementLogs.id, { onDelete: "set null" }),
  transactionType: reportingTransactionTypeEnum("transaction_type").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("ETB").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  reportingTransactionsProjectIdx: index("reporting_transactions_project_id_idx").on(table.projectId),
  reportingTransactionsBudgetLineIdx: index("reporting_transactions_budget_line_id_idx").on(table.reportingBudgetLineId),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  otpCodes: many(otpCodes),
  projects: many(projects),
  projectMemberships: many(projectMembers),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  auditLogs: many(auditLogs),
  proposalTemplates: many(proposalTemplates),
  proposalDocuments: many(proposalDocuments),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  requestedProcurementRequests: many(procurementRequests, {
    relationName: "procurementRequestRequester",
  }),
  assignedProcurementRequests: many(procurementRequests, {
    relationName: "procurementRequestOfficer",
  }),
  createdVendorQuotations: many(vendorQuotations),
  createdPurchaseOrders: many(purchaseOrders),
  receivedGoodsReceipts: many(goodsReceipts),
  createdSupplierInvoices: many(supplierInvoices),
  uploadedProcurementDocuments: many(procurementDocuments),
  procurementApprovals: many(procurementApprovals),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  user: one(users, {
    fields: [otpCodes.userId],
    references: [users.id],
  }),
}));

export const emailOutboxRelations = relations(emailOutbox, () => ({}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  manager: one(users, {
    fields: [projects.managerId],
    references: [users.id],
  }),
  donor: one(donors, {
    fields: [projects.donorId],
    references: [donors.id],
  }),
  projectDonors: many(projectDonors),
  milestones: many(milestones),
  members: many(projectMembers),
  documents: many(projectDocuments),
  proposals: many(proposals),
  tasks: many(tasks),
  budgetAllocations: many(budgetAllocations),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  procurementRequests: many(procurementRequests),
  reportingProfile: one(reportingProfiles, {
    fields: [projects.id],
    references: [reportingProfiles.projectId],
  }),
  reportingResults: many(reportingResults),
  reportingBudgetLines: many(reportingBudgetLines),
  reportingTransactions: many(reportingTransactions),
}));

export const projectDocumentsRelations = relations(projectDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocuments.projectId],
    references: [projects.id],
  }),
  uploader: one(users, {
    fields: [projectDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  taskMilestones: many(taskMilestones),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const donorsRelations = relations(donors, ({ many }) => ({
  projects: many(projects),
  projectDonors: many(projectDonors),
  proposals: many(proposals),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  accessTokens: many(donorAccessTokens),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  selectedProcurementRequests: many(procurementRequests, {
    relationName: "selectedProcurementRequests",
  }),
  quotations: many(vendorQuotations),
  purchaseOrders: many(purchaseOrders),
  invoices: many(supplierInvoices),
}));

export const donorAccessTokensRelations = relations(donorAccessTokens, ({ one }) => ({
  donor: one(donors, {
    fields: [donorAccessTokens.donorId],
    references: [donors.id],
  }),
  creator: one(users, {
    fields: [donorAccessTokens.createdBy],
    references: [users.id],
  }),
}));

export const projectDonorsRelations = relations(projectDonors, ({ one }) => ({
  project: one(projects, {
    fields: [projectDonors.projectId],
    references: [projects.id],
  }),
  donor: one(donors, {
    fields: [projectDonors.donorId],
    references: [donors.id],
  }),
}));

export const procurementRequestsRelations = relations(procurementRequests, ({ one, many }) => ({
  project: one(projects, {
    fields: [procurementRequests.projectId],
    references: [projects.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [procurementRequests.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  task: one(tasks, {
    fields: [procurementRequests.taskId],
    references: [tasks.id],
  }),
  requester: one(users, {
    fields: [procurementRequests.requesterId],
    references: [users.id],
    relationName: "procurementRequestRequester",
  }),
  procurementOfficer: one(users, {
    fields: [procurementRequests.procurementOfficerId],
    references: [users.id],
    relationName: "procurementRequestOfficer",
  }),
  selectedVendor: one(vendors, {
    fields: [procurementRequests.selectedVendorId],
    references: [vendors.id],
    relationName: "selectedProcurementRequests",
  }),
  lineItems: many(procurementRequestItems),
  quotations: many(vendorQuotations),
  purchaseOrder: one(purchaseOrders, {
    fields: [procurementRequests.id],
    references: [purchaseOrders.procurementRequestId],
  }),
  receipts: many(goodsReceipts),
  invoices: many(supplierInvoices),
  documents: many(procurementDocuments),
  approvals: many(procurementApprovals),
}));

export const procurementRequestItemsRelations = relations(procurementRequestItems, ({ one }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [procurementRequestItems.procurementRequestId],
    references: [procurementRequests.id],
  }),
}));

export const vendorQuotationsRelations = relations(vendorQuotations, ({ one, many }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [vendorQuotations.procurementRequestId],
    references: [procurementRequests.id],
  }),
  vendor: one(vendors, {
    fields: [vendorQuotations.vendorId],
    references: [vendors.id],
  }),
  creator: one(users, {
    fields: [vendorQuotations.createdBy],
    references: [users.id],
  }),
  documents: many(procurementDocuments),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [purchaseOrders.procurementRequestId],
    references: [procurementRequests.id],
  }),
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  creator: one(users, {
    fields: [purchaseOrders.createdBy],
    references: [users.id],
  }),
  receipts: many(goodsReceipts),
  invoices: many(supplierInvoices),
  documents: many(procurementDocuments),
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [goodsReceipts.procurementRequestId],
    references: [procurementRequests.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceipts.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  receiver: one(users, {
    fields: [goodsReceipts.receivedBy],
    references: [users.id],
  }),
  invoices: many(supplierInvoices),
  documents: many(procurementDocuments),
}));

export const supplierInvoicesRelations = relations(supplierInvoices, ({ one, many }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [supplierInvoices.procurementRequestId],
    references: [procurementRequests.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [supplierInvoices.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  vendor: one(vendors, {
    fields: [supplierInvoices.vendorId],
    references: [vendors.id],
  }),
  goodsReceipt: one(goodsReceipts, {
    fields: [supplierInvoices.goodsReceiptId],
    references: [goodsReceipts.id],
  }),
  linkedExpenditure: one(expenditures, {
    fields: [supplierInvoices.linkedExpenditureId],
    references: [expenditures.id],
  }),
  linkedDisbursement: one(disbursementLogs, {
    fields: [supplierInvoices.linkedDisbursementId],
    references: [disbursementLogs.id],
  }),
  creator: one(users, {
    fields: [supplierInvoices.createdBy],
    references: [users.id],
  }),
  documents: many(procurementDocuments),
}));

export const procurementDocumentsRelations = relations(procurementDocuments, ({ one }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [procurementDocuments.procurementRequestId],
    references: [procurementRequests.id],
  }),
  quotation: one(vendorQuotations, {
    fields: [procurementDocuments.quotationId],
    references: [vendorQuotations.id],
  }),
  purchaseOrder: one(purchaseOrders, {
    fields: [procurementDocuments.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  goodsReceipt: one(goodsReceipts, {
    fields: [procurementDocuments.goodsReceiptId],
    references: [goodsReceipts.id],
  }),
  supplierInvoice: one(supplierInvoices, {
    fields: [procurementDocuments.supplierInvoiceId],
    references: [supplierInvoices.id],
  }),
  uploader: one(users, {
    fields: [procurementDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const procurementApprovalsRelations = relations(procurementApprovals, ({ one }) => ({
  procurementRequest: one(procurementRequests, {
    fields: [procurementApprovals.procurementRequestId],
    references: [procurementRequests.id],
  }),
  approver: one(users, {
    fields: [procurementApprovals.approverId],
    references: [users.id],
  }),
}));

export const proposalTemplatesRelations = relations(proposalTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [proposalTemplates.createdBy],
    references: [users.id],
  }),
  proposals: many(proposals),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  donor: one(donors, {
    fields: [proposals.donorId],
    references: [donors.id],
  }),
  project: one(projects, {
    fields: [proposals.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [proposals.createdBy],
    references: [users.id],
  }),
  template: one(proposalTemplates, {
    fields: [proposals.templateId],
    references: [proposalTemplates.id],
  }),
  documents: many(proposalDocuments),
}));

export const proposalDocumentsRelations = relations(proposalDocuments, ({ one }) => ({
  proposal: one(proposals, {
    fields: [proposalDocuments.proposalId],
    references: [proposals.id],
  }),
  uploader: one(users, {
    fields: [proposalDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [tasks.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
  documents: many(taskDocuments),
  expenditures: many(expenditures),
  procurementRequests: many(procurementRequests),
  taskMilestones: many(taskMilestones),
}));

export const taskMilestonesRelations = relations(taskMilestones, ({ one }) => ({
  task: one(tasks, {
    fields: [taskMilestones.taskId],
    references: [tasks.id],
  }),
  milestone: one(milestones, {
    fields: [taskMilestones.milestoneId],
    references: [milestones.id],
  }),
}));

export const taskDocumentsRelations = relations(taskDocuments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDocuments.taskId],
    references: [tasks.id],
  }),
  uploader: one(users, {
    fields: [taskDocuments.uploadedBy],
    references: [users.id],
  }),
}));

export const budgetAllocationsRelations = relations(budgetAllocations, ({ one, many }) => ({
  project: one(projects, {
    fields: [budgetAllocations.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [budgetAllocations.id],
    references: [tasks.budgetAllocationId],
  }),
  assignee: one(users, {
    fields: [budgetAllocations.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [budgetAllocations.createdBy],
    references: [users.id],
  }),
  expenditures: many(expenditures),
  disbursementLogs: many(disbursementLogs),
  procurementRequests: many(procurementRequests),
  reportingResults: many(reportingResults),
  reportingBudgetLines: many(reportingBudgetLines),
}));

export const expendituresRelations = relations(expenditures, ({ one, many }) => ({
  project: one(projects, {
    fields: [expenditures.projectId],
    references: [projects.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [expenditures.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  task: one(tasks, {
    fields: [expenditures.taskId],
    references: [tasks.id],
  }),
  donor: one(donors, {
    fields: [expenditures.donorId],
    references: [donors.id],
  }),
  creator: one(users, {
    fields: [expenditures.createdBy],
    references: [users.id],
  }),
  disbursementLogs: many(disbursementLogs),
  supplierInvoices: many(supplierInvoices),
  reportingTransactions: many(reportingTransactions),
}));

export const disbursementLogsRelations = relations(disbursementLogs, ({ one, many }) => ({
  project: one(projects, {
    fields: [disbursementLogs.projectId],
    references: [projects.id],
  }),
  donor: one(donors, {
    fields: [disbursementLogs.donorId],
    references: [donors.id],
  }),
  budgetAllocation: one(budgetAllocations, {
    fields: [disbursementLogs.budgetAllocationId],
    references: [budgetAllocations.id],
  }),
  expenditure: one(expenditures, {
    fields: [disbursementLogs.expenditureId],
    references: [expenditures.id],
  }),
  creator: one(users, {
    fields: [disbursementLogs.createdBy],
    references: [users.id],
  }),
  supplierInvoices: many(supplierInvoices),
}));

export const reportingProfilesRelations = relations(reportingProfiles, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingProfiles.projectId],
    references: [projects.id],
  }),
  results: many(reportingResults),
  budgetLines: many(reportingBudgetLines),
}));

export const reportingResultsRelations = relations(reportingResults, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingResults.projectId],
    references: [projects.id],
  }),
  profile: one(reportingProfiles, {
    fields: [reportingResults.profileId],
    references: [reportingProfiles.id],
  }),
  parent: one(reportingResults, {
    fields: [reportingResults.parentId],
    references: [reportingResults.id],
    relationName: "reporting_result_hierarchy",
  }),
  children: many(reportingResults, {
    relationName: "reporting_result_hierarchy",
  }),
  task: one(tasks, {
    fields: [reportingResults.taskId],
    references: [tasks.id],
  }),
  milestone: one(milestones, {
    fields: [reportingResults.milestoneId],
    references: [milestones.id],
  }),
  sourceBudgetAllocation: one(budgetAllocations, {
    fields: [reportingResults.sourceBudgetAllocationId],
    references: [budgetAllocations.id],
  }),
  budgetLines: many(reportingBudgetLines),
  transactions: many(reportingTransactions),
}));

export const reportingBudgetLinesRelations = relations(reportingBudgetLines, ({ one, many }) => ({
  project: one(projects, {
    fields: [reportingBudgetLines.projectId],
    references: [projects.id],
  }),
  profile: one(reportingProfiles, {
    fields: [reportingBudgetLines.profileId],
    references: [reportingProfiles.id],
  }),
  result: one(reportingResults, {
    fields: [reportingBudgetLines.reportingResultId],
    references: [reportingResults.id],
  }),
  sourceBudgetAllocation: one(budgetAllocations, {
    fields: [reportingBudgetLines.sourceBudgetAllocationId],
    references: [budgetAllocations.id],
  }),
  transactions: many(reportingTransactions),
}));

export const reportingTransactionsRelations = relations(reportingTransactions, ({ one }) => ({
  project: one(projects, {
    fields: [reportingTransactions.projectId],
    references: [projects.id],
  }),
  result: one(reportingResults, {
    fields: [reportingTransactions.reportingResultId],
    references: [reportingResults.id],
  }),
  budgetLine: one(reportingBudgetLines, {
    fields: [reportingTransactions.reportingBudgetLineId],
    references: [reportingBudgetLines.id],
  }),
  donor: one(donors, {
    fields: [reportingTransactions.donorId],
    references: [donors.id],
  }),
  sourceExpenditure: one(expenditures, {
    fields: [reportingTransactions.sourceExpenditureId],
    references: [expenditures.id],
  }),
  sourceDisbursement: one(disbursementLogs, {
    fields: [reportingTransactions.sourceDisbursementId],
    references: [disbursementLogs.id],
  }),
}));

export type Donor = typeof donors.$inferSelect;
export type NewDonor = typeof donors.$inferInsert;
export type ProjectDonor = typeof projectDonors.$inferSelect;
export type NewProjectDonor = typeof projectDonors.$inferInsert;
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type ProcurementRequest = typeof procurementRequests.$inferSelect;
export type NewProcurementRequest = typeof procurementRequests.$inferInsert;
export type ProcurementRequestItem = typeof procurementRequestItems.$inferSelect;
export type NewProcurementRequestItem = typeof procurementRequestItems.$inferInsert;
export type VendorQuotation = typeof vendorQuotations.$inferSelect;
export type NewVendorQuotation = typeof vendorQuotations.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert;
export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type NewSupplierInvoice = typeof supplierInvoices.$inferInsert;
export type ProcurementDocument = typeof procurementDocuments.$inferSelect;
export type NewProcurementDocument = typeof procurementDocuments.$inferInsert;
export type ProcurementApproval = typeof procurementApprovals.$inferSelect;
export type NewProcurementApproval = typeof procurementApprovals.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type NewProposalTemplate = typeof proposalTemplates.$inferInsert;
export type ProposalDocument = typeof proposalDocuments.$inferSelect;
export type NewProposalDocument = typeof proposalDocuments.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskMilestone = typeof taskMilestones.$inferSelect;
export type NewTaskMilestone = typeof taskMilestones.$inferInsert;
export type TaskDocument = typeof taskDocuments.$inferSelect;
export type NewTaskDocument = typeof taskDocuments.$inferInsert;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;
export type NewBudgetAllocation = typeof budgetAllocations.$inferInsert;
export type Expenditure = typeof expenditures.$inferSelect;
export type NewExpenditure = typeof expenditures.$inferInsert;
export type DisbursementLog = typeof disbursementLogs.$inferSelect;
export type NewDisbursementLog = typeof disbursementLogs.$inferInsert;
export type ReportingProfile = typeof reportingProfiles.$inferSelect;
export type NewReportingProfile = typeof reportingProfiles.$inferInsert;
export type ReportingResult = typeof reportingResults.$inferSelect;
export type NewReportingResult = typeof reportingResults.$inferInsert;
export type ReportingBudgetLine = typeof reportingBudgetLines.$inferSelect;
export type NewReportingBudgetLine = typeof reportingBudgetLines.$inferInsert;
export type ReportingTransaction = typeof reportingTransactions.$inferSelect;
export type NewReportingTransaction = typeof reportingTransactions.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
export type EmailOutbox = typeof emailOutbox.$inferSelect;
export type NewEmailOutbox = typeof emailOutbox.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type NewProjectDocument = typeof projectDocuments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type DonorAccessToken = typeof donorAccessTokens.$inferSelect;
export type NewDonorAccessToken = typeof donorAccessTokens.$inferInsert;
