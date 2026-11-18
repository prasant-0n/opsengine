-- CreateTable
CREATE TABLE "employee_surveys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'pulse',
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_survey_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "employee_id" UUID,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "nps_score" INTEGER,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognition_badges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'award',
    "points_value" INTEGER NOT NULL DEFAULT 50,
    "category" TEXT NOT NULL DEFAULT 'culture',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recognition_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_recognitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "points_awarded" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_survey_tenant_category" ON "employee_surveys"("tenant_id", "category", "status");

-- CreateIndex
CREATE INDEX "idx_survey_resp_tenant_survey" ON "employee_survey_responses"("tenant_id", "survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_badge_tenant_code" ON "recognition_badges"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "idx_recog_tenant_recipient" ON "employee_recognitions"("tenant_id", "recipient_id");

-- CreateIndex
CREATE INDEX "idx_recog_tenant_sender" ON "employee_recognitions"("tenant_id", "sender_id");
