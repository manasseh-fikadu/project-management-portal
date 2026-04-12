ALTER TABLE "budget_allocations"
ADD COLUMN IF NOT EXISTS "assigned_to" uuid REFERENCES "users"("id") ON DELETE SET NULL;
