DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'profile_role'
      AND e.enumlabel = 'beneficiary'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'profile_role'
      AND e.enumlabel = 'team_member'
  ) THEN
    ALTER TYPE "profile_role" RENAME VALUE 'beneficiary' TO 'team_member';
  END IF;
END $$;

ALTER TABLE "profiles"
  ALTER COLUMN "role" SET DEFAULT 'team_member';
