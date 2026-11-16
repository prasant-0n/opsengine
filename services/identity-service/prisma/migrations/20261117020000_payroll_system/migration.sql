-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "basic_cents" BIGINT NOT NULL DEFAULT 0,
    "hra_cents" BIGINT NOT NULL DEFAULT 0,
    "allowance_cents" BIGINT NOT NULL DEFAULT 0,
    "pf_employee_cents" BIGINT NOT NULL DEFAULT 0,
    "pf_employer_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_tds_cents" BIGINT NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_routing_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_gross_cents" BIGINT NOT NULL DEFAULT 0,
    "total_deductions_cents" BIGINT NOT NULL DEFAULT 0,
    "total_net_cents" BIGINT NOT NULL DEFAULT 0,
    "total_employees" INTEGER NOT NULL DEFAULT 0,
    "executed_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "disbursed_at" TIMESTAMPTZ(6),
    "batch_export_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payslip_number" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "working_days" INTEGER NOT NULL DEFAULT 30,
    "worked_days" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "unpaid_leave_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basic_cents" BIGINT NOT NULL DEFAULT 0,
    "hra_cents" BIGINT NOT NULL DEFAULT 0,
    "allowances_cents" BIGINT NOT NULL DEFAULT 0,
    "gross_pay_cents" BIGINT NOT NULL DEFAULT 0,
    "pf_employee_cents" BIGINT NOT NULL DEFAULT 0,
    "pf_employer_cents" BIGINT NOT NULL DEFAULT 0,
    "tax_tds_cents" BIGINT NOT NULL DEFAULT 0,
    "lop_deduction_cents" BIGINT NOT NULL DEFAULT 0,
    "total_deductions_cents" BIGINT NOT NULL DEFAULT 0,
    "net_pay_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "checksum_sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "payment_reference" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_salary_struct_tenant_emp_effective" ON "salary_structures"("tenant_id", "employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "idx_salary_struct_tenant_emp_status" ON "salary_structures"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payroll_run_tenant_year_month" ON "payroll_runs"("tenant_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "idx_payroll_run_tenant_status" ON "payroll_runs"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payslip_tenant_run_emp" ON "payslips"("tenant_id", "payroll_run_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payslip_tenant_number" ON "payslips"("tenant_id", "payslip_number");

-- CreateIndex
CREATE INDEX "idx_payslip_tenant_emp_period" ON "payslips"("tenant_id", "employee_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "idx_payslip_tenant_status" ON "payslips"("tenant_id", "status");
