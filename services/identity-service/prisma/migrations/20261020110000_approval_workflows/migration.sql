-- Feature #9: Workflow & Approval Engine (PRD Module 13 + §4 Decision Matrix)

CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_wfdef_tenant_name" ON "workflow_definitions"("tenant_id", "name");
CREATE INDEX "idx_wfdef_tenant_subject_active" ON "workflow_definitions"("tenant_id", "subject_type", "active");

CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "rules" JSONB NOT NULL,
    "effective_from" TIMESTAMPTZ(6),
    "effective_to" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_wfver_def_number" ON "workflow_versions"("definition_id", "version_number");
CREATE INDEX "idx_wfver_tenant_def_status" ON "workflow_versions"("tenant_id", "definition_id", "status");

CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "subject_version" TEXT NOT NULL,
    "subject_context" JSONB,
    "workflow_version_id" UUID NOT NULL,
    "requester_employee_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "current_step_number" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "amount_cents" BIGINT,
    "due_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_apprinst_tenant_status" ON "approval_instances"("tenant_id", "status");
CREATE INDEX "idx_apprinst_tenant_subject" ON "approval_instances"("tenant_id", "subject_type", "subject_id");
CREATE INDEX "idx_apprinst_tenant_requester" ON "approval_instances"("tenant_id", "requester_employee_id");

CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'any',
    "resolver" JSONB NOT NULL,
    "min_approvals" INTEGER NOT NULL DEFAULT 1,
    "amount_threshold_cents" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_apprstep_tenant_instance" ON "approval_steps"("tenant_id", "instance_id", "step_number");

CREATE TABLE "approval_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_id" UUID,
    "approver_employee_id" UUID NOT NULL,
    "on_behalf_of_employee_id" UUID,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "is_sod_override" BOOLEAN NOT NULL DEFAULT false,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_apprdec_tenant_instance" ON "approval_decisions"("tenant_id", "instance_id", "decided_at");

CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "from_employee_id" UUID NOT NULL,
    "to_employee_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL DEFAULT 'ALL',
    "scope_value" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_apprdeleg_tenant_from" ON "approval_delegations"("tenant_id", "from_employee_id", "active");
CREATE INDEX "idx_apprdeleg_tenant_to" ON "approval_delegations"("tenant_id", "to_employee_id", "active");
