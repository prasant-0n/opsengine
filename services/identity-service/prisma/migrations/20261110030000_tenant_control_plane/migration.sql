-- AlterTable
ALTER TABLE "tenant_workspaces" ADD COLUMN IF NOT EXISTS "lifecycle_status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "tenant_workspaces" ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;
ALTER TABLE "tenant_workspaces" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_tier" TEXT NOT NULL DEFAULT 'starter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "seat_limit" INTEGER NOT NULL DEFAULT 10,
    "storage_limit_bytes" BIGINT NOT NULL DEFAULT 5368709120,
    "features" JSONB NOT NULL DEFAULT '["core_hrms", "crm_core", "documents", "calendar"]',
    "trial_ends_at" TIMESTAMPTZ(6),
    "current_period_start" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_data_exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "requested_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "record_count" INTEGER NOT NULL DEFAULT 0,
    "archive_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "support_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_subscriptions_tenant_id_key" ON "tenant_subscriptions"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_subscriptions_tenant_status" ON "tenant_subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tenant_data_exports_tenant_created" ON "tenant_data_exports"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "support_sessions_token_key" ON "support_sessions"("token");
CREATE INDEX IF NOT EXISTS "idx_support_sessions_token" ON "support_sessions"("token");
CREATE INDEX IF NOT EXISTS "idx_support_sessions_tenant_operator" ON "support_sessions"("tenant_id", "operator_user_id");
