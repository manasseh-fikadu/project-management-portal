ALTER TYPE "email_outbox_status" ADD VALUE IF NOT EXISTS 'processing';

ALTER TABLE "email_outbox"
  ADD COLUMN IF NOT EXISTS "processor_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp;

CREATE INDEX IF NOT EXISTS "email_outbox_status_attempts_created_at_idx"
  ON "email_outbox" ("status", "attempts", "created_at");
