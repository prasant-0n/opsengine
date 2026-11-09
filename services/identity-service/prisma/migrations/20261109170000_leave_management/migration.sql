-- CreateTable leave_types
CREATE TABLE IF NOT EXISTS "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "annual_allowance" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_balances
CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_requests
CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" DOUBLE PRECISION NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable leave_adjustments
CREATE TABLE IF NOT EXISTS "leave_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "leave_balance_id" UUID NOT NULL,
    "amount_days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "adjusted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_leave_types_tenant_active" ON "leave_types"("tenant_id", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_leave_types_tenant_code" ON "leave_types"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "idx_leave_balance_tenant_emp_year" ON "leave_balances"("tenant_id", "employee_id", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_leave_balance_tenant_emp_type_yr" ON "leave_balances"("tenant_id", "employee_id", "leave_type_id", "year");
CREATE INDEX IF NOT EXISTS "idx_leave_req_tenant_emp_start" ON "leave_requests"("tenant_id", "employee_id", "start_date");
CREATE INDEX IF NOT EXISTS "idx_leave_req_tenant_status" ON "leave_requests"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_leave_adj_tenant_bal" ON "leave_adjustments"("tenant_id", "leave_balance_id");
