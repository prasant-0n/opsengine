-- CreateTable: expense_reports
CREATE TABLE IF NOT EXISTS "expense_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "total_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "manager_approver_id" UUID,
    "finance_approver_id" UUID,
    "rejection_reason" TEXT,
    "voucher_number" TEXT,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_expense_rep_tenant_emp_status" ON "expense_reports"("tenant_id", "employee_id", "status");
CREATE INDEX IF NOT EXISTS "idx_expense_rep_tenant_status_created" ON "expense_reports"("tenant_id", "status", "created_at");

-- CreateTable: expense_items
CREATE TABLE IF NOT EXISTS "expense_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "spent_on" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_id" UUID,
    "policy_violation" BOOLEAN NOT NULL DEFAULT false,
    "violation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_expense_item_tenant_report" ON "expense_items"("tenant_id", "report_id");

-- CreateTable: expense_receipts
CREATE TABLE IF NOT EXISTS "expense_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_expense_receipt_tenant_emp" ON "expense_receipts"("tenant_id", "employee_id");
