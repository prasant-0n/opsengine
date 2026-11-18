-- CreateTable
CREATE TABLE "lms_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "passing_score" INTEGER NOT NULL DEFAULT 80,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "validity_months" INTEGER,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lms_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lms_course_enrollments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "enrollment_type" TEXT NOT NULL DEFAULT 'self_enrolled',
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lms_course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lms_skill_certifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_name" TEXT NOT NULL,
    "proficiency_level" TEXT NOT NULL DEFAULT 'intermediate',
    "issuing_authority" TEXT NOT NULL,
    "credential_id" TEXT,
    "verification_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "verification_hash" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lms_skill_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_course_tenant_code" ON "lms_courses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "idx_course_tenant_category" ON "lms_courses"("tenant_id", "category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_enrollment_tenant_course_emp" ON "lms_course_enrollments"("tenant_id", "course_id", "employee_id");

-- CreateIndex
CREATE INDEX "idx_enrollment_tenant_emp_status" ON "lms_course_enrollments"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "idx_enrollment_tenant_course_status" ON "lms_course_enrollments"("tenant_id", "course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_cert_tenant_emp_skill_cred" ON "lms_skill_certifications"("tenant_id", "employee_id", "skill_name", "credential_id");

-- CreateIndex
CREATE INDEX "idx_skill_cert_tenant_emp_status" ON "lms_skill_certifications"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "idx_skill_cert_tenant_skill_prof" ON "lms_skill_certifications"("tenant_id", "skill_name", "proficiency_level");
