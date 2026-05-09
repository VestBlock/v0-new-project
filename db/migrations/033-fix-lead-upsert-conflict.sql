DELETE FROM leads
WHERE ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY source, external_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS row_number
    FROM leads
    WHERE external_id IS NOT NULL
  ) duplicates
  WHERE duplicates.row_number > 1
);

DROP INDEX IF EXISTS idx_leads_source_external_id_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_source_external_id_key'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_source_external_id_key UNIQUE (source, external_id);
  END IF;
END $$;
