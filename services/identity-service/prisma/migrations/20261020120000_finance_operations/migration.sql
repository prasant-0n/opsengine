-- Feature #10: Finance Operations (PRD Module 12)

CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "project_id" UUID,
    "milestone_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL DEFAULT 0,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "issued_on" TIMESTAMPTZ(6),
    "due_on" TIMESTAMPTZ(6),
    "dispute_status" TEXT NOT NULL DEFAULT 'none',
    "dispute_reason" TEXT,
    "approval_instance_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_invoice_tenant_number" ON "invoices"("tenant_id", "number");
CREATE INDEX "idx_invoice_tenant_status_created" ON "invoices"("tenant_id", "status", "created_at");
CREATE INDEX "idx_invoice_tenant_account_created" ON "invoices"("tenant_id", "account_id", "created_at");

CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" BIGINT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "project_id" UUID,
    "milestone_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_invline_invoice_number" ON "invoice_lines"("invoice_id", "line_number");
CREATE INDEX "idx_invline_tenant_invoice" ON "invoice_lines"("tenant_id", "invoice_id");

CREATE TABLE "receivables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "original_amount_cents" BIGINT NOT NULL,
    "paid_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "outstanding_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "due_on" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'open',
    "follow_up_owner_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_receivable_invoice" ON "receivables"("invoice_id");
CREATE INDEX "idx_receivable_tenant_status_due" ON "receivables"("tenant_id", "status", "due_on");

CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "receivable_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "received_on" TIMESTAMPTZ(6) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT,
    "notes" TEXT,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_payment_tenant_invoice" ON "payments"("tenant_id", "invoice_id", "received_on");

CREATE TABLE "payment_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "payment_id" UUID,
    "type" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by" UUID,
    "approval_instance_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "payment_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_adj_tenant_invoice" ON "payment_adjustments"("tenant_id", "invoice_id", "created_at");
