-- CreateTable
CREATE TABLE IF NOT EXISTS "calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL DEFAULT 'meeting',
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "organizer_id" UUID NOT NULL,
    "capacity" INTEGER,
    "related_type" TEXT,
    "related_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_attendees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "feedback" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meeting_notes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "agenda" TEXT,
    "notes" TEXT,
    "decisions" JSONB,
    "action_items" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_calendar_events_tenant_type" ON "calendar_events"("tenant_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_calendar_events_tenant_time" ON "calendar_events"("tenant_id", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_attendee_tenant_event_user" ON "event_attendees"("tenant_id", "event_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_event_attendees_tenant_user" ON "event_attendees"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_notes_event_id_key" ON "meeting_notes"("event_id");
CREATE INDEX IF NOT EXISTS "idx_meeting_notes_tenant_event" ON "meeting_notes"("tenant_id", "event_id");

-- AddForeignKey
ALTER TABLE "event_attendees" DROP CONSTRAINT IF EXISTS "event_attendees_event_id_fkey";
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_notes" DROP CONSTRAINT IF EXISTS "meeting_notes_event_id_fkey";
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
