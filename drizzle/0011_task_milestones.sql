CREATE TABLE IF NOT EXISTS "task_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "milestone_id" uuid NOT NULL REFERENCES "milestones"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_milestones_task_id_milestone_id_key"
ON "task_milestones" ("task_id", "milestone_id");

CREATE INDEX IF NOT EXISTS "task_milestones_task_id_idx"
ON "task_milestones" ("task_id");

CREATE INDEX IF NOT EXISTS "task_milestones_milestone_id_idx"
ON "task_milestones" ("milestone_id");
