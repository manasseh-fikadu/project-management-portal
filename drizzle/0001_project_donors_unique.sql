-- Ensure unique project/donor links before adding the database constraint.
WITH ranked_links AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, donor_id
      ORDER BY created_at ASC, id ASC
    ) AS row_num
  FROM "project_donors"
)
DELETE FROM "project_donors"
WHERE id IN (
  SELECT id
  FROM ranked_links
  WHERE row_num > 1
);

ALTER TABLE "project_donors"
ADD CONSTRAINT "project_donors_project_id_donor_id_key"
UNIQUE ("project_id", "donor_id");
