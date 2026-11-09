-- CreateTable documents
CREATE TABLE IF NOT EXISTS "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "owner_service" TEXT NOT NULL,
    "owner_id" UUID,
    "category" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploader_user_id" UUID NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "verification_notes" TEXT,
    "retention_class" TEXT NOT NULL DEFAULT 'standard',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_docs_tenant_category" ON "documents"("tenant_id", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_docs_tenant_owner" ON "documents"("tenant_id", "owner_service", "owner_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_docs_tenant_verification" ON "documents"("tenant_id", "verification_status");
