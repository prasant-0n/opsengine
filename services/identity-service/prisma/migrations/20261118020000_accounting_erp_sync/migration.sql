-- CreateTable
CREATE TABLE "erp_integrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "realm_id" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "coa_mapping" JSONB NOT NULL DEFAULT '{}',
    "last_sync_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "erp_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_sync_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "external_id" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "payload_snapshot" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "erp_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_erp_integration_tenant_provider" ON "erp_integrations"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "idx_erp_integration_tenant_status" ON "erp_integrations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_erp_sync_idempotency" ON "erp_sync_logs"("tenant_id", "provider", "entity_type", "entity_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "idx_erp_sync_tenant_entity_status" ON "erp_sync_logs"("tenant_id", "entity_type", "status");

-- CreateIndex
CREATE INDEX "idx_erp_sync_tenant_integration" ON "erp_sync_logs"("tenant_id", "integration_id", "status");
