-- VestBlock Phase 1: AI Deal Hunter / OSINT Property Intelligence
-- Apply in Supabase SQL editor before using the admin import UI in production.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS property_intelligence_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'upload',
  source_url TEXT,
  file_name TEXT,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_count INTEGER NOT NULL DEFAULT 0,
  confidence_level INTEGER NOT NULL DEFAULT 70 CHECK (confidence_level BETWEEN 0 AND 100),
  notes TEXT,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS property_intelligence_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES property_intelligence_sources(id) ON DELETE SET NULL,
  import_status TEXT NOT NULL DEFAULT 'completed',
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_deduped INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS owner_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_name TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'unknown',
  mailing_address TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_zip TEXT,
  is_absentee BOOLEAN NOT NULL DEFAULT FALSE,
  is_out_of_state BOOLEAN NOT NULL DEFAULT FALSE,
  is_llc BOOLEAN NOT NULL DEFAULT FALSE,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_intelligence_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES property_intelligence_sources(id) ON DELETE SET NULL,
  import_id UUID REFERENCES property_intelligence_imports(id) ON DELETE SET NULL,
  owner_entity_id UUID REFERENCES owner_entities(id) ON DELETE SET NULL,
  existing_property_analysis_id UUID,
  existing_dscr_analysis_id UUID,
  parcel_id TEXT,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  land_use TEXT,
  property_class TEXT,
  assessed_value NUMERIC,
  land_value NUMERIC,
  building_value NUMERIC,
  improvement_value NUMERIC,
  structure_sqft NUMERIC,
  lot_sqft NUMERIC,
  year_built INTEGER,
  is_vacant_lot BOOLEAN NOT NULL DEFAULT FALSE,
  vacant_lot_confidence INTEGER NOT NULL DEFAULT 0 CHECK (vacant_lot_confidence BETWEEN 0 AND 100),
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_label TEXT NOT NULL,
  signal_value TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 70 CHECK (confidence_score BETWEEN 0 AND 100),
  source_name TEXT,
  source_url TEXT,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcel_geometries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  geometry_type TEXT NOT NULL DEFAULT 'geojson',
  geojson JSONB NOT NULL,
  source_name TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 70 CHECK (confidence_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_contact_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_entity_id UUID REFERENCES owner_entities(id) ON DELETE CASCADE,
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  contact_value TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS osint_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  owner_entity_id UUID REFERENCES owner_entities(id) ON DELETE CASCADE,
  adapter_name TEXT NOT NULL,
  query TEXT NOT NULL,
  result_type TEXT NOT NULL,
  result_value TEXT,
  source_url TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  compliance_warning_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT NOT NULL,
  recommended_next_action TEXT NOT NULL,
  scoring_version TEXT NOT NULL DEFAULT 'phase1-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_layers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layer_key TEXT NOT NULL UNIQUE,
  layer_name TEXT NOT NULL,
  layer_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source_id UUID REFERENCES property_intelligence_sources(id) ON DELETE SET NULL,
  style_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_match_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  buyer_id UUID,
  buyer_match_score INTEGER NOT NULL CHECK (buyer_match_score BETWEEN 0 AND 100),
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  recommended_pitch_angle TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_key TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_imported INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_preparation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_intelligence_record_id UUID REFERENCES property_intelligence_records(id) ON DELETE CASCADE,
  owner_summary TEXT,
  public_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_outreach_angle TEXT,
  sms_draft TEXT,
  email_draft TEXT,
  call_opener TEXT,
  follow_up_message TEXT,
  buyer_facing_pitch TEXT,
  approval_status TEXT NOT NULL DEFAULT 'needs_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_intelligence_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_entity_type TEXT NOT NULL,
  from_entity_id UUID NOT NULL,
  relationship_type TEXT NOT NULL,
  to_entity_type TEXT NOT NULL,
  to_entity_id UUID NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 70 CHECK (confidence_score BETWEEN 0 AND 100),
  source TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_intelligence_records_city_state ON property_intelligence_records (city, state);
CREATE INDEX IF NOT EXISTS idx_property_intelligence_records_zip ON property_intelligence_records (zip_code);
CREATE INDEX IF NOT EXISTS idx_property_intelligence_records_vacant ON property_intelligence_records (is_vacant_lot, vacant_lot_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_property_signals_type ON property_signals (signal_type);
CREATE INDEX IF NOT EXISTS idx_deal_scores_score ON deal_scores (score DESC);

ALTER TABLE property_intelligence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_geometries ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_contact_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE osint_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_preparation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_intelligence_relationships ENABLE ROW LEVEL SECURITY;

-- Service-role/admin APIs access these tables. Keep public/anon access closed by default.
