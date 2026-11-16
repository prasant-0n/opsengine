-- AlterTable: add account_id and sla_due_at to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "account_id" UUID;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sla_due_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "idx_ticket_tenant_account" ON "tickets"("tenant_id", "account_id");

-- CreateTable: ticket_comments
CREATE TABLE IF NOT EXISTS "ticket_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_type" TEXT NOT NULL DEFAULT 'staff',
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_ticket_comment_tenant_ticket" ON "ticket_comments"("tenant_id", "ticket_id", "created_at");

-- CreateTable: client_deliverables
CREATE TABLE IF NOT EXISTS "client_deliverables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "milestone_id" UUID,
    "account_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deliverable_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_client_deliv_tenant_account_status" ON "client_deliverables"("tenant_id", "account_id", "status");
CREATE INDEX IF NOT EXISTS "idx_client_deliv_tenant_project" ON "client_deliverables"("tenant_id", "project_id");

-- CreateTable: client_deliverable_signoffs
CREATE TABLE IF NOT EXISTS "client_deliverable_signoffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "deliverable_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "contact_id" UUID,
    "signer_name" TEXT NOT NULL,
    "signer_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "signature_hash" TEXT NOT NULL,
    "feedback_notes" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_deliverable_signoffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_deliv_signoff_tenant_deliv" ON "client_deliverable_signoffs"("tenant_id", "deliverable_id");
CREATE INDEX IF NOT EXISTS "idx_deliv_signoff_tenant_account" ON "client_deliverable_signoffs"("tenant_id", "account_id");
