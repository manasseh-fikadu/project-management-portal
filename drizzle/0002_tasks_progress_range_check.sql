ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_progress_range_check"
CHECK ("progress" >= 0 AND "progress" <= 100);
