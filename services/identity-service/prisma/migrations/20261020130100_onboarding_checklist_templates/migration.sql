-- Feature #11: Onboarding checklist templates (configurable by job family / location / employment type)
-- Checklist definitions are validated data, never tenant executable JS (ADR-0011/0013).

CREATE TABLE "onboarding_checklist_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "job_family" TEXT,
    "location" TEXT,
    "employment_type" TEXT,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "onboarding_checklist_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_onbctl_tenant_name" ON "onboarding_checklist_templates"("tenant_id", "name");
CREATE INDEX "idx_onbctl_tenant_active" ON "onboarding_checklist_templates"("tenant_id", "active", "created_at");
