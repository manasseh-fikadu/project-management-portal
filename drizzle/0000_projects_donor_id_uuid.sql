-- Safely migrate projects.donor_id from varchar/text to uuid and preserve FK behavior.
DO $$
DECLARE
  donor_fk_name text;
BEGIN
  SELECT tc.constraint_name
    INTO donor_fk_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'projects'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'donor_id'
  LIMIT 1;

  IF donor_fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "projects" DROP CONSTRAINT %I', donor_fk_name);
  END IF;
END $$;

-- Null out rows that do not contain valid UUID values before type conversion.
UPDATE "projects"
SET "donor_id" = NULL
WHERE "donor_id" IS NOT NULL
  AND NOT (trim("donor_id"::text) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

ALTER TABLE "projects"
  ALTER COLUMN "donor_id" TYPE uuid
  USING NULLIF(trim("donor_id"::text), '')::uuid;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_donor_id_donors_id_fk"
  FOREIGN KEY ("donor_id")
  REFERENCES "donors"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
