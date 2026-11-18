-- CreateTable
CREATE TABLE "okr_objectives" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT NOT NULL DEFAULT 'company',
    "owner_employee_id" UUID,
    "department" TEXT,
    "period_year" INTEGER NOT NULL,
    "period_quarter" INTEGER NOT NULL,
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "okr_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_key_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "objective_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "unit" TEXT NOT NULL DEFAULT '%',
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "linked_project_id" UUID,
    "linked_milestone_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "okr_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_cycles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_quarter" INTEGER,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "self_review_deadline" DATE NOT NULL,
    "manager_review_deadline" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appraisal_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "reviewer_employee_id" UUID NOT NULL,
    "review_type" TEXT NOT NULL,
    "competency_ratings" JSONB NOT NULL DEFAULT '{}',
    "overall_rating" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "strengths_summary" TEXT,
    "growth_areas" TEXT,
    "okr_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recommendation" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appraisal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_okr_obj_tenant_period" ON "okr_objectives"("tenant_id", "period_year", "period_quarter");

-- CreateIndex
CREATE INDEX "idx_okr_obj_tenant_owner" ON "okr_objectives"("tenant_id", "owner_employee_id");

-- CreateIndex
CREATE INDEX "idx_okr_kr_tenant_obj" ON "okr_key_results"("tenant_id", "objective_id");

-- CreateIndex
CREATE INDEX "idx_appraisal_cycle_tenant_period" ON "appraisal_cycles"("tenant_id", "period_year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_appraisal_rev_tenant_cycle_emp_rev_type" ON "appraisal_reviews"("tenant_id", "cycle_id", "employee_id", "reviewer_employee_id", "review_type");

-- CreateIndex
CREATE INDEX "idx_appraisal_rev_tenant_cycle_emp" ON "appraisal_reviews"("tenant_id", "cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "idx_appraisal_rev_tenant_reviewer" ON "appraisal_reviews"("tenant_id", "reviewer_employee_id");
