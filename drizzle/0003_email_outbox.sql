CREATE TYPE "email_outbox_status" AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE "email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(50) NOT NULL,
  "recipient_email" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "email_outbox_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "email_outbox_status_created_at_idx"
  ON "email_outbox" ("status", "created_at");
