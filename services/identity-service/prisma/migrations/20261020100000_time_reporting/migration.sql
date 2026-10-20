-- Feature #8: Time & Activity Reporting (PRD Modules 6 + 5)

CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_plan_tenant_emp_date" ON "daily_plans"("tenant_id", "employee_id", "plan_date");
CREATE INDEX "idx_plan_tenant_date_status" ON "daily_plans"("tenant_id", "plan_date", "status");

CREATE TABLE "daily_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "project_id" UUID,
    "ticket_id" UUID,
    "planned_outcome" TEXT,
    "estimated_minutes" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "actual_minutes" INTEGER,
    "outcome" TEXT,
    "blocker" TEXT,
    "evidence" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_planitem_tenant_plan" ON "daily_plan_items"("tenant_id", "plan_id");

CREATE TABLE "daily_report_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_report_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_report_tenant_emp_date_ver" ON "daily_report_versions"("tenant_id", "employee_id", "report_date", "version");
CREATE INDEX "idx_report_tenant_emp_date" ON "daily_report_versions"("tenant_id", "employee_id", "report_date");

CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "project_id" UUID,
    "ticket_id" UUID,
    "minutes" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_timeentry_tenant_emp_date" ON "time_entries"("tenant_id", "employee_id", "entry_date");
CREATE INDEX "idx_timeentry_tenant_project_date" ON "time_entries"("tenant_id", "project_id", "entry_date");

CREATE TABLE "attendance_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "check_in_at" TIMESTAMPTZ(6),
    "check_out_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'not_checked_in',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_attendance_tenant_emp_date" ON "attendance_days"("tenant_id", "employee_id", "work_date");
CREATE INDEX "idx_attendance_tenant_date_status" ON "attendance_days"("tenant_id", "work_date", "status");

CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "attendance_day_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "proposed_check_in" TIMESTAMPTZ(6),
    "proposed_check_out" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_attcorr_tenant_day_status" ON "attendance_corrections"("tenant_id", "attendance_day_id", "status");
