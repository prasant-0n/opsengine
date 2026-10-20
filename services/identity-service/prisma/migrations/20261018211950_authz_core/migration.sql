-- AlterTable
ALTER TABLE "reset_tokens" ADD COLUMN     "used_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMPTZ(6),
ADD COLUMN     "revoked_by" UUID,
ADD COLUMN     "user_agent" TEXT;

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "job_family" TEXT,
    "seniority" TEXT,
    "department" TEXT,
    "sbu_id" UUID,
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "team_type" TEXT,
    "parent_team_id" UUID,
    "sbu_id" UUID,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_team_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "membership_type" TEXT NOT NULL DEFAULT 'primary',
    "responsibility" TEXT NOT NULL DEFAULT 'member',
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "employee_team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "manager_employee_id" UUID NOT NULL,
    "report_employee_id" UUID NOT NULL,
    "relationship_type" TEXT NOT NULL DEFAULT 'direct',
    "scope" TEXT,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "reporting_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_group_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "access_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "principal_user_id" UUID NOT NULL,
    "principal_employee_id" UUID,
    "role_key" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),
    "granted_by" UUID,
    "reason" TEXT,
    "audit_ref" TEXT,

    CONSTRAINT "role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "principal_user_id" UUID NOT NULL,
    "principal_employee_id" UUID,
    "permission_key" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),
    "granted_by" UUID,
    "reason" TEXT,
    "audit_ref" TEXT,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "decision" TEXT,
    "reason_code" TEXT,
    "policy_version" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tenant_memberships_tenant_status" ON "tenant_memberships"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_memberships_tenant_user" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_employees_tenant_user" ON "employees"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_teams_tenant_name" ON "teams"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_etm_tenant_employee" ON "employee_team_memberships"("tenant_id", "employee_id", "valid_from");

-- CreateIndex
CREATE INDEX "idx_etm_tenant_team" ON "employee_team_memberships"("tenant_id", "team_id", "responsibility");

-- CreateIndex
CREATE INDEX "idx_rr_tenant_manager" ON "reporting_relationships"("tenant_id", "manager_employee_id", "valid_from");

-- CreateIndex
CREATE INDEX "idx_rr_tenant_report" ON "reporting_relationships"("tenant_id", "report_employee_id", "valid_from");

-- CreateIndex
CREATE INDEX "idx_access_groups_tenant_name" ON "access_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_agm_tenant_group" ON "access_group_memberships"("tenant_id", "group_id", "employee_id");

-- CreateIndex
CREATE INDEX "idx_role_grants_tenant_principal" ON "role_grants"("tenant_id", "principal_user_id", "role_key");

-- CreateIndex
CREATE INDEX "idx_perm_grants_tenant_principal" ON "permission_grants"("tenant_id", "principal_user_id", "permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_policy_versions_tenant_version" ON "policy_versions"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "idx_audit_events_tenant_type_time" ON "audit_events"("tenant_id", "event_type", "createdAt");

-- CreateIndex
CREATE INDEX "idx_sessions_tenant_user_active" ON "sessions"("tenantId", "user_id", "revoked_at");
