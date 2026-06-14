CREATE TABLE IF NOT EXISTS command_center_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  summary TEXT,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('critical', 'warning', 'info')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_center_event_id UUID REFERENCES command_center_events(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  analysis_source TEXT NOT NULL DEFAULT 'command_center',
  estimate_value NUMERIC,
  arv NUMERIC,
  repair_budget NUMERIC,
  assignment_fee NUMERIC,
  mao NUMERIC,
  seller_ask NUMERIC,
  spread NUMERIC,
  end_buyer_profit NUMERIC,
  grade TEXT CHECK (grade IN ('RISKY', 'GOOD')),
  deal_strength_score INTEGER,
  deal_strength_label TEXT,
  primary_route_key TEXT,
  primary_route_label TEXT,
  primary_route_score INTEGER,
  buyer_interest_label TEXT,
  buyer_interest_score INTEGER,
  builder_label TEXT,
  next_action TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  opportunity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_center_events_type_time
  ON command_center_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_events_entity
  ON command_center_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_property_analysis_runs_address
  ON property_analysis_runs(property_address);
CREATE INDEX IF NOT EXISTS idx_property_analysis_runs_created
  ON property_analysis_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_analysis_runs_grade
  ON property_analysis_runs(grade, deal_strength_score DESC);

ALTER TABLE command_center_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view command center events" ON command_center_events;
CREATE POLICY "Admins can view command center events"
  ON command_center_events FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center events" ON command_center_events;
CREATE POLICY "Admins can insert command center events"
  ON command_center_events FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update command center events" ON command_center_events;
CREATE POLICY "Admins can update command center events"
  ON command_center_events FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view property analysis runs" ON property_analysis_runs;
CREATE POLICY "Admins can view property analysis runs"
  ON property_analysis_runs FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert property analysis runs" ON property_analysis_runs;
CREATE POLICY "Admins can insert property analysis runs"
  ON property_analysis_runs FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update property analysis runs" ON property_analysis_runs;
CREATE POLICY "Admins can update property analysis runs"
  ON property_analysis_runs FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON command_center_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON property_analysis_runs TO authenticated;
GRANT ALL ON command_center_events TO service_role;
GRANT ALL ON property_analysis_runs TO service_role;
