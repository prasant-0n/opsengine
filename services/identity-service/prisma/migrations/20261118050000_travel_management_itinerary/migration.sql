-- CreateTable
CREATE TABLE "travel_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'client_engagement',
    "destination_city" TEXT NOT NULL,
    "destination_country" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "estimated_total_cents" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "advance_amount_cents" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "project_id" UUID,
    "client_account_id" UUID,
    "linked_expense_report_id" UUID,
    "manager_approver_id" UUID,
    "manager_approved_at" TIMESTAMPTZ(6),
    "finance_approver_id" UUID,
    "finance_approved_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_itinerary_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "travel_request_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "carrier_or_vendor" TEXT NOT NULL,
    "booking_reference" TEXT,
    "confirmation_code" TEXT,
    "departure_at" TIMESTAMPTZ(6),
    "arrival_at" TIMESTAMPTZ(6),
    "cost_cents" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "travel_itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_travel_req_tenant_emp_status" ON "travel_requests"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "idx_travel_req_tenant_status" ON "travel_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_itinerary_tenant_req" ON "travel_itinerary_items"("tenant_id", "travel_request_id");
