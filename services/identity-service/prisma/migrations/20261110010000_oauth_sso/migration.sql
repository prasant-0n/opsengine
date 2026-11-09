-- AlterTable
ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "oauth_provider" TEXT;
ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "oauth_subject" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_auth_users_tenant_oauth" ON "auth_users"("tenantId", "oauth_provider", "oauth_subject");
