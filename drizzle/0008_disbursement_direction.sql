DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'disbursement_direction'
  ) THEN
    CREATE TYPE "disbursement_direction" AS ENUM ('outward', 'inward');
  END IF;
END $$;

ALTER TABLE "disbursement_logs"
ADD COLUMN IF NOT EXISTS "direction" "disbursement_direction";

ALTER TABLE "disbursement_logs"
ALTER COLUMN "direction" SET DEFAULT 'outward';

UPDATE "disbursement_logs"
SET "direction" = 'outward'
WHERE "direction" IS NULL;

ALTER TABLE "disbursement_logs"
ALTER COLUMN "direction" SET NOT NULL;
