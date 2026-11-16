-- AlterTable
ALTER TABLE "tenant_workspaces" ADD COLUMN IF NOT EXISTS "ai_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "releases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target_env" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "owner_employee_id" UUID,
    "change_window" TEXT,
    "rollback_plan" TEXT,
    "qa_evidence_ref" TEXT,
    "securityStatus" TEXT NOT NULL DEFAULT 'pending',
    "deployed_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "release_gates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "release_id" UUID NOT NULL,
    "gate_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checked_by" UUID,
    "checked_at" TIMESTAMPTZ(6),
    "notes" TEXT,

    CONSTRAINT "release_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "presales_proposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "opportunity_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "valid_until" TIMESTAMPTZ(6),
    "notes" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presales_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "presales_estimate_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "role_title" TEXT NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "hourly_rate_cents" BIGINT NOT NULL DEFAULT 0,
    "total_cents" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "presales_estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_read" ON "notifications"("tenant_id", "recipient_user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_release_tenant_number" ON "releases"("tenant_id", "number");
CREATE INDEX IF NOT EXISTS "idx_release_tenant_status" ON "releases"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_release_gate_tenant_release" ON "release_gates"("tenant_id", "release_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_presales_tenant_number" ON "presales_proposals"("tenant_id", "number");
CREATE INDEX IF NOT EXISTS "idx_presales_tenant_status" ON "presales_proposals"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_presales_line_tenant_proposal" ON "presales_estimate_lines"("tenant_id", "proposal_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "release_gates" ADD CONSTRAINT "release_gates_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "presales_estimate_lines" ADD CONSTRAINT "presales_estimate_lines_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "presales_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
