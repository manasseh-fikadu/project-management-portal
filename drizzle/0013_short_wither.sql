CREATE UNIQUE INDEX IF NOT EXISTS "vendor_quotations_id_request_key"
ON "vendor_quotations" ("id", "procurement_request_id");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_id_request_key"
ON "purchase_orders" ("id", "procurement_request_id");

CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_id_request_key"
ON "goods_receipts" ("id", "procurement_request_id");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_invoices_id_request_key"
ON "supplier_invoices" ("id", "procurement_request_id");

ALTER TABLE "goods_receipts"
DROP CONSTRAINT IF EXISTS "goods_receipts_purchase_order_id_purchase_orders_id_fk";

ALTER TABLE "supplier_invoices"
DROP CONSTRAINT IF EXISTS "supplier_invoices_purchase_order_id_purchase_orders_id_fk";

ALTER TABLE "supplier_invoices"
DROP CONSTRAINT IF EXISTS "supplier_invoices_goods_receipt_id_goods_receipts_id_fk";

ALTER TABLE "procurement_documents"
DROP CONSTRAINT IF EXISTS "procurement_documents_quotation_id_vendor_quotations_id_fk";

ALTER TABLE "procurement_documents"
DROP CONSTRAINT IF EXISTS "procurement_documents_purchase_order_id_purchase_orders_id_fk";

ALTER TABLE "procurement_documents"
DROP CONSTRAINT IF EXISTS "procurement_documents_goods_receipt_id_goods_receipts_id_fk";

ALTER TABLE "procurement_documents"
DROP CONSTRAINT IF EXISTS "procurement_documents_supplier_invoice_id_supplier_invoices_id_fk";

ALTER TABLE "goods_receipts"
ADD CONSTRAINT "goods_receipts_purchase_order_request_fkey"
FOREIGN KEY ("purchase_order_id", "procurement_request_id")
REFERENCES "purchase_orders" ("id", "procurement_request_id")
ON DELETE CASCADE;

ALTER TABLE "supplier_invoices"
ADD CONSTRAINT "supplier_invoices_purchase_order_request_fkey"
FOREIGN KEY ("purchase_order_id", "procurement_request_id")
REFERENCES "purchase_orders" ("id", "procurement_request_id");

ALTER TABLE "supplier_invoices"
ADD CONSTRAINT "supplier_invoices_goods_receipt_request_fkey"
FOREIGN KEY ("goods_receipt_id", "procurement_request_id")
REFERENCES "goods_receipts" ("id", "procurement_request_id");

ALTER TABLE "procurement_documents"
ADD CONSTRAINT "proc_docs_quotation_request_fkey"
FOREIGN KEY ("quotation_id", "procurement_request_id")
REFERENCES "vendor_quotations" ("id", "procurement_request_id");

ALTER TABLE "procurement_documents"
ADD CONSTRAINT "proc_docs_purchase_order_request_fkey"
FOREIGN KEY ("purchase_order_id", "procurement_request_id")
REFERENCES "purchase_orders" ("id", "procurement_request_id");

ALTER TABLE "procurement_documents"
ADD CONSTRAINT "proc_docs_goods_receipt_request_fkey"
FOREIGN KEY ("goods_receipt_id", "procurement_request_id")
REFERENCES "goods_receipts" ("id", "procurement_request_id");

ALTER TABLE "procurement_documents"
ADD CONSTRAINT "proc_docs_supplier_invoice_request_fkey"
FOREIGN KEY ("supplier_invoice_id", "procurement_request_id")
REFERENCES "supplier_invoices" ("id", "procurement_request_id");
