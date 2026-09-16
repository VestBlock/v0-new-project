-- Make property identity jurisdiction-safe and retain every corroborating source.

CREATE OR REPLACE FUNCTION public.property_intelligence_canonical_key(
  p_parcel_id TEXT,
  p_property_address TEXT,
  p_city TEXT,
  p_state TEXT,
  p_zip_code TEXT,
  p_county TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  WITH normalized AS (
    SELECT
      regexp_replace(lower(coalesce(p_parcel_id, '')), '[^a-z0-9]+', '', 'g') AS parcel_id,
      btrim(regexp_replace(lower(coalesce(p_property_address, '')), '[^a-z0-9]+', ' ', 'g')) AS property_address,
      btrim(regexp_replace(lower(coalesce(p_city, '')), '[^a-z0-9]+', ' ', 'g')) AS city,
      regexp_replace(upper(coalesce(p_state, '')), '[^A-Z0-9]+', '', 'g') AS state,
      regexp_replace(lower(coalesce(p_zip_code, '')), '[^a-z0-9]+', '', 'g') AS zip_code,
      regexp_replace(
        regexp_replace(lower(coalesce(p_county, '')), '\m(county|parish|borough|census area|municipality)\M', '', 'g'),
        '[^a-z0-9]+',
        '',
        'g'
      ) AS county
  )
  SELECT CASE
    WHEN parcel_id <> '' AND state <> '' AND county <> ''
      THEN 'parcel:' || state || ':county:' || county || ':' || parcel_id
    WHEN parcel_id <> '' AND state <> '' AND zip_code <> ''
      THEN 'parcel:' || state || ':zip:' || zip_code || ':' || parcel_id
    WHEN parcel_id <> '' AND state <> '' AND city <> ''
      THEN 'parcel:' || state || ':city:' || regexp_replace(city, '[^a-z0-9]+', '', 'g') || ':' || parcel_id
    WHEN property_address <> '' AND city <> '' AND state <> ''
      THEN 'address:' || concat_ws('|', property_address, city, lower(state))
    ELSE NULL
  END
  FROM normalized;
$$;

ALTER TABLE property_intelligence_records
  ADD COLUMN IF NOT EXISTS normalized_parcel_id TEXT
  GENERATED ALWAYS AS (
    nullif(regexp_replace(lower(coalesce(parcel_id, '')), '[^a-z0-9]+', '', 'g'), '')
  ) STORED;

ALTER TABLE property_intelligence_records
  ADD COLUMN IF NOT EXISTS canonical_property_key TEXT
  GENERATED ALWAYS AS (
    public.property_intelligence_canonical_key(parcel_id, property_address, city, state, zip_code, county)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_property_intelligence_records_canonical_key
  ON property_intelligence_records (canonical_property_key)
  WHERE canonical_property_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_property_intelligence_records_state_parcel
  ON property_intelligence_records (state, normalized_parcel_id)
  WHERE normalized_parcel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS property_intelligence_record_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_intelligence_record_id UUID NOT NULL REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  source_id UUID REFERENCES property_intelligence_sources(id) ON DELETE SET NULL,
  import_id UUID REFERENCES property_intelligence_imports(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  file_name TEXT,
  evidence_key TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_intelligence_record_id, evidence_key)
);

CREATE INDEX IF NOT EXISTS idx_property_intelligence_record_sources_source
  ON property_intelligence_record_sources (source_id, observed_at DESC);

ALTER TABLE property_intelligence_record_sources ENABLE ROW LEVEL SECURITY;
GRANT ALL ON property_intelligence_record_sources TO service_role;
REVOKE ALL ON property_intelligence_record_sources FROM anon, authenticated;
