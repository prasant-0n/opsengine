-- Feature #11: Recruitment & Onboarding — Offers, Onboarding, Induction, Probation (PRD Module 3 tail + Module 4)

CREATE TABLE "offer_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "job_family" TEXT,
    "employment_type" TEXT,
    "body" TEXT NOT NULL,
    "default_terms_days" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "offer_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_offertpl_tenant_name_version" ON "offer_templates"("tenant_id", "name", "version");
CREATE INDEX "idx_offertpl_tenant_active" ON "offer_templates"("tenant_id", "active", "created_at");

CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "candidate_id" UUID NOT NULL,
    "requisition_id" UUID,
    "template_id" UUID,
    "job_title" TEXT NOT NULL,
    "grade" TEXT,
    "employment_type" TEXT,
    "location" TEXT,
    "work_mode" TEXT,
    "start_date" TIMESTAMPTZ(6),
    "base_comp_cents" BIGINT NOT NULL DEFAULT 0,
    "variable_cents" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approval_instance_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "decline_reason" TEXT,
    "expires_on" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_offer_tenant_number" ON "offers"("tenant_id", "number");
CREATE INDEX "idx_offer_tenant_status_created" ON "offers"("tenant_id", "status", "created_at");
CREATE INDEX "idx_offer_tenant_candidate" ON "offers"("tenant_id", "candidate_id");

CREATE TABLE "onboarding_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "job_family" TEXT,
    "location" TEXT,
    "employment_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_on" TIMESTAMPTZ(6),
    "completed_on" TIMESTAMPTZ(6),
    "buddy_employee_id" UUID,
    "created_employee_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "onboarding_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_onbplan_tenant_candidate_offer" ON "onboarding_plans"("tenant_id", "candidate_id", "offer_id");
CREATE INDEX "idx_onbplan_tenant_status_created" ON "onboarding_plans"("tenant_id", "status", "created_at");

CREATE TABLE "onboarding_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'hr',
    "owner_employee_id" UUID,
    "owner_role" TEXT,
    "due_on" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "blocked_reason" TEXT,
    "evidence_ref" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_onbtask_tenant_plan_status" ON "onboarding_tasks"("tenant_id", "plan_id", "status");

CREATE TABLE "onboarding_task_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "onboarding_task_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_onbdep_tenant_task_parent" ON "onboarding_task_dependencies"("tenant_id", "task_id", "depends_on_task_id");
CREATE INDEX "idx_onbdep_tenant_task" ON "onboarding_task_dependencies"("tenant_id", "task_id");

CREATE TABLE "induction_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "location" TEXT,
    "link" TEXT,
    "owner_employee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "induction_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_induction_tenant_plan_start" ON "induction_events"("tenant_id", "plan_id", "start_at");

CREATE TABLE "policy_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "policy_name" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ack_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "policy_acknowledgements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_policy_ack_tenant_plan" ON "policy_acknowledgements"("tenant_id", "plan_id");

CREATE TABLE "probation_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "start_on" TIMESTAMPTZ(6) NOT NULL,
    "due_on" TIMESTAMPTZ(6) NOT NULL,
    "end_on" TIMESTAMPTZ(6),
    "manager_employee_id" UUID,
    "employee_reviewer_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recommendation" TEXT,
    "outcome" TEXT,
    "manager_feedback" TEXT,
    "employee_feedback" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "new_end_on" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "probation_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_probation_tenant_plan_status" ON "probation_reviews"("tenant_id", "plan_id", "status");
CREATE INDEX "idx_probation_tenant_due" ON "probation_reviews"("tenant_id", "due_on");
