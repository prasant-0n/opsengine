-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employee_number" TEXT,
ADD COLUMN     "employment_type" TEXT,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "probation_ends_at" TIMESTAMPTZ(6),
ADD COLUMN     "start_date" TIMESTAMPTZ(6),
ADD COLUMN     "work_email" TEXT;

-- CreateIndex
CREATE INDEX "idx_employees_tenant_status" ON "employees"("tenant_id", "employment_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employees_tenant_number" ON "employees"("tenant_id", "employee_number");

