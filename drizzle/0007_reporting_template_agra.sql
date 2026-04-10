DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'reporting_template'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'reporting_template'
      AND e.enumlabel = 'agra_budget_breakdown'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'reporting_template'
        AND e.enumlabel = 'eif_cpd_annex'
    ) THEN
      ALTER TYPE "reporting_template" ADD VALUE 'agra_budget_breakdown' BEFORE 'eif_cpd_annex';
    ELSE
      ALTER TYPE "reporting_template" ADD VALUE 'agra_budget_breakdown';
    END IF;
  END IF;
END $$;
