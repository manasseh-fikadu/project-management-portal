ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "budget_allocation_id" uuid REFERENCES "budget_allocations"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "tasks_budget_allocation_id_idx"
ON "tasks" ("budget_allocation_id");
