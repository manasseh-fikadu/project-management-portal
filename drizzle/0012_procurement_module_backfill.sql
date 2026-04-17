DO $$
BEGIN
  CREATE TYPE "procurement_request_type" AS ENUM ('goods', 'services', 'works', 'consultancy');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_method" AS ENUM ('direct_purchase', 'request_for_quotation', 'framework_agreement', 'restricted_bidding', 'open_tender', 'single_source');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_status" AS ENUM ('draft', 'submitted', 'approved', 'rfq_open', 'quotes_received', 'po_issued', 'partially_received', 'received', 'invoiced', 'paid', 'cancelled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_approval_status" AS ENUM ('not_started', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "purchase_order_status" AS ENUM ('draft', 'issued', 'partially_received', 'received', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "goods_receipt_status" AS ENUM ('partial', 'received', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "supplier_invoice_status" AS ENUM ('received', 'approved', 'paid', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "supplier_payment_status" AS ENUM ('unpaid', 'partially_paid', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_approval_role" AS ENUM ('project_manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_approval_decision" AS ENUM ('approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "procurement_document_type" AS ENUM ('request', 'quotation', 'purchase_order', 'receipt', 'invoice', 'evaluation', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "vendors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "contact_person" varchar(255),
  "email" varchar(255),
  "phone" varchar(50),
  "address" text,
  "website" varchar(500),
  "tax_id" varchar(120),
  "bank_account_name" varchar(255),
  "bank_account_number" varchar(120),
  "bank_name" varchar(255),
  "category" varchar(120),
  "notes" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "procurement_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_number" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "justification" text,
  "request_type" "procurement_request_type" DEFAULT 'goods' NOT NULL,
  "procurement_method" "procurement_method" DEFAULT 'request_for_quotation' NOT NULL,
  "status" "procurement_status" DEFAULT 'draft' NOT NULL,
  "approval_status" "procurement_approval_status" DEFAULT 'not_started' NOT NULL,
  "priority" varchar(20) DEFAULT 'medium' NOT NULL,
  "currency" varchar(10) DEFAULT 'ETB' NOT NULL,
  "estimated_amount" integer NOT NULL,
  "approved_amount" integer,
  "committed_amount" integer DEFAULT 0 NOT NULL,
  "invoiced_amount" integer DEFAULT 0 NOT NULL,
  "paid_amount" integer DEFAULT 0 NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "budget_allocation_id" uuid REFERENCES "budget_allocations"("id") ON DELETE set null,
  "task_id" uuid REFERENCES "tasks"("id") ON DELETE set null,
  "requester_id" uuid NOT NULL REFERENCES "users"("id"),
  "procurement_officer_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "selected_vendor_id" uuid REFERENCES "vendors"("id") ON DELETE set null,
  "lookup_text" text,
  "needed_by_date" timestamp,
  "submitted_at" timestamp,
  "approved_at" timestamp,
  "purchase_order_issued_at" timestamp,
  "received_at" timestamp,
  "invoiced_at" timestamp,
  "paid_at" timestamp,
  "cancelled_at" timestamp,
  "rejection_reason" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "procurement_requests_estimated_amount_check" CHECK ("estimated_amount" > 0),
  CONSTRAINT "procurement_requests_approved_amount_check" CHECK ("approved_amount" IS NULL OR "approved_amount" >= 0)
);

CREATE TABLE IF NOT EXISTS "procurement_request_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "description" varchar(255) NOT NULL,
  "specification" text,
  "category" varchar(120),
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit" varchar(50),
  "unit_price" integer DEFAULT 0 NOT NULL,
  "total_price" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "procurement_request_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "procurement_request_items_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "procurement_request_items_total_price_check" CHECK ("total_price" >= 0)
);

CREATE TABLE IF NOT EXISTS "vendor_quotations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "reference_number" varchar(100),
  "amount" integer NOT NULL,
  "currency" varchar(10) DEFAULT 'ETB' NOT NULL,
  "submitted_at" timestamp,
  "valid_until" timestamp,
  "is_selected" boolean DEFAULT false NOT NULL,
  "notes" text,
  "comparison_notes" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "vendor_quotations_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "po_number" varchar(60) NOT NULL,
  "status" "purchase_order_status" DEFAULT 'issued' NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(10) DEFAULT 'ETB' NOT NULL,
  "issued_at" timestamp NOT NULL,
  "expected_delivery_date" timestamp,
  "notes" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "purchase_orders_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE IF NOT EXISTS "goods_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE cascade,
  "receipt_number" varchar(60) NOT NULL,
  "status" "goods_receipt_status" DEFAULT 'received' NOT NULL,
  "received_amount" integer DEFAULT 0 NOT NULL,
  "condition_notes" text,
  "notes" text,
  "received_by" uuid NOT NULL REFERENCES "users"("id"),
  "received_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "goods_receipts_received_amount_check" CHECK ("received_amount" >= 0)
);

CREATE TABLE IF NOT EXISTS "supplier_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "purchase_order_id" uuid REFERENCES "purchase_orders"("id") ON DELETE set null,
  "vendor_id" uuid NOT NULL REFERENCES "vendors"("id"),
  "goods_receipt_id" uuid REFERENCES "goods_receipts"("id") ON DELETE set null,
  "invoice_number" varchar(100) NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(10) DEFAULT 'ETB' NOT NULL,
  "status" "supplier_invoice_status" DEFAULT 'received' NOT NULL,
  "payment_status" "supplier_payment_status" DEFAULT 'unpaid' NOT NULL,
  "invoice_date" timestamp NOT NULL,
  "due_date" timestamp,
  "linked_expenditure_id" uuid REFERENCES "expenditures"("id") ON DELETE set null,
  "linked_disbursement_id" uuid REFERENCES "disbursement_logs"("id") ON DELETE set null,
  "notes" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "supplier_invoices_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE IF NOT EXISTS "procurement_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "quotation_id" uuid REFERENCES "vendor_quotations"("id") ON DELETE set null,
  "purchase_order_id" uuid REFERENCES "purchase_orders"("id") ON DELETE set null,
  "goods_receipt_id" uuid REFERENCES "goods_receipts"("id") ON DELETE set null,
  "supplier_invoice_id" uuid REFERENCES "supplier_invoices"("id") ON DELETE set null,
  "document_type" "procurement_document_type" DEFAULT 'other' NOT NULL,
  "name" varchar(255) NOT NULL,
  "type" varchar(100) NOT NULL,
  "url" text NOT NULL,
  "size" integer NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "procurement_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "procurement_request_id" uuid NOT NULL REFERENCES "procurement_requests"("id") ON DELETE cascade,
  "approver_id" uuid NOT NULL REFERENCES "users"("id"),
  "required_role" "procurement_approval_role" NOT NULL,
  "decision" "procurement_approval_decision" NOT NULL,
  "threshold_amount" integer NOT NULL,
  "comments" text,
  "decided_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "procurement_approvals_threshold_amount_check" CHECK ("threshold_amount" >= 0)
);

CREATE INDEX IF NOT EXISTS "vendors_name_idx" ON "vendors" ("name");
CREATE INDEX IF NOT EXISTS "vendors_is_active_idx" ON "vendors" ("is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "procurement_requests_request_number_key" ON "procurement_requests" ("request_number");
CREATE INDEX IF NOT EXISTS "procurement_requests_project_id_idx" ON "procurement_requests" ("project_id");
CREATE INDEX IF NOT EXISTS "procurement_requests_budget_allocation_id_idx" ON "procurement_requests" ("budget_allocation_id");
CREATE INDEX IF NOT EXISTS "procurement_requests_task_id_idx" ON "procurement_requests" ("task_id");
CREATE INDEX IF NOT EXISTS "procurement_requests_status_idx" ON "procurement_requests" ("status");
CREATE INDEX IF NOT EXISTS "procurement_requests_approval_status_idx" ON "procurement_requests" ("approval_status");
CREATE INDEX IF NOT EXISTS "procurement_requests_selected_vendor_id_idx" ON "procurement_requests" ("selected_vendor_id");

CREATE INDEX IF NOT EXISTS "procurement_request_items_request_id_idx" ON "procurement_request_items" ("procurement_request_id");

CREATE INDEX IF NOT EXISTS "vendor_quotations_request_id_idx" ON "vendor_quotations" ("procurement_request_id");
CREATE INDEX IF NOT EXISTS "vendor_quotations_vendor_id_idx" ON "vendor_quotations" ("vendor_id");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_procurement_request_id_key" ON "purchase_orders" ("procurement_request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_po_number_key" ON "purchase_orders" ("po_number");
CREATE INDEX IF NOT EXISTS "purchase_orders_vendor_id_idx" ON "purchase_orders" ("vendor_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_receipt_number_key" ON "goods_receipts" ("receipt_number");
CREATE INDEX IF NOT EXISTS "goods_receipts_request_id_idx" ON "goods_receipts" ("procurement_request_id");
CREATE INDEX IF NOT EXISTS "goods_receipts_purchase_order_id_idx" ON "goods_receipts" ("purchase_order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoices_vendor_invoice_key" ON "supplier_invoices" ("vendor_id", "invoice_number");
CREATE INDEX IF NOT EXISTS "supplier_invoices_request_id_idx" ON "supplier_invoices" ("procurement_request_id");
CREATE INDEX IF NOT EXISTS "supplier_invoices_vendor_id_idx" ON "supplier_invoices" ("vendor_id");
CREATE INDEX IF NOT EXISTS "supplier_invoices_status_idx" ON "supplier_invoices" ("status");

CREATE INDEX IF NOT EXISTS "procurement_documents_request_id_idx" ON "procurement_documents" ("procurement_request_id");
CREATE INDEX IF NOT EXISTS "procurement_documents_quotation_id_idx" ON "procurement_documents" ("quotation_id");
CREATE INDEX IF NOT EXISTS "procurement_documents_purchase_order_id_idx" ON "procurement_documents" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "procurement_documents_goods_receipt_id_idx" ON "procurement_documents" ("goods_receipt_id");
CREATE INDEX IF NOT EXISTS "procurement_documents_supplier_invoice_id_idx" ON "procurement_documents" ("supplier_invoice_id");

CREATE INDEX IF NOT EXISTS "procurement_approvals_request_id_idx" ON "procurement_approvals" ("procurement_request_id");
CREATE INDEX IF NOT EXISTS "procurement_approvals_approver_id_idx" ON "procurement_approvals" ("approver_id");
