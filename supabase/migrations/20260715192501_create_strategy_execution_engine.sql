-- Durable execution state for strategy-specific sourcing, qualification,
-- enrollment, delivery evidence, and bounded learning.

ALTER TABLE command_center_strategy_runs
  ADD COLUMN IF NOT EXISTS run_key TEXT,
  ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'execution',
  ADD COLUMN IF NOT EXISTS qualified_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounce_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_error TEXT;

ALTER TABLE command_center_strategy_runs
  DROP CONSTRAINT IF EXISTS command_center_strategy_runs_status_check;

ALTER TABLE command_center_strategy_runs
  ADD CONSTRAINT command_center_strategy_runs_status_check CHECK (
    status IN (
      'planned',
      'dry_run',
      'running',
      'completed',
      'blocked',
      'failed',
      'source_blocked',
      'quality_blocked',
      'awaiting_contacts'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_center_strategy_runs_run_key
  ON command_center_strategy_runs(run_key);

ALTER TABLE command_center_outbound_enrollments
  DROP CONSTRAINT IF EXISTS command_center_outbound_enrollments_status_check;

ALTER TABLE command_center_outbound_enrollments
  ADD CONSTRAINT command_center_outbound_enrollments_status_check CHECK (
    status IN (
      'queued',
      'needs_review',
      'approved',
      'accepted',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'replied',
      'bounced',
      'complained',
      'suppressed',
      'failed'
    )
  );

CREATE TABLE IF NOT EXISTS strategy_source_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  strategy_key TEXT,
  market TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'processing', 'completed', 'blocked', 'failed', 'ignored')
  ),
  payload_hash TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  download_url TEXT,
  rows_received INTEGER NOT NULL DEFAULT 0,
  rows_ingested INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  occurred_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS strategy_market_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_key TEXT NOT NULL,
  market TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'cooling', 'exhausted', 'blocked', 'paused')
  ),
  priority_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  consecutive_empty_runs INTEGER NOT NULL DEFAULT 0,
  last_source_at TIMESTAMPTZ,
  last_qualified_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(strategy_key, market, source_provider)
);

CREATE TABLE IF NOT EXISTS strategy_lead_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_run_id UUID REFERENCES command_center_strategy_runs(id) ON DELETE SET NULL,
  strategy_key TEXT NOT NULL,
  market TEXT,
  source_provider TEXT NOT NULL,
  qualification_score INTEGER NOT NULL DEFAULT 0,
  qualification_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  email_verification_status TEXT,
  status TEXT NOT NULL DEFAULT 'qualified' CHECK (
    status IN (
      'qualified',
      'needs_review',
      'approved',
      'accepted',
      'delivered',
      'opened',
      'clicked',
      'replied',
      'bounced',
      'complained',
      'suppressed',
      'rejected',
      'failed'
    )
  ),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_outcome_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE TABLE IF NOT EXISTS strategy_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'blocked', 'failed')),
  cities_attempted INTEGER NOT NULL DEFAULT 0,
  sources_attempted INTEGER NOT NULL DEFAULT 0,
  leads_discovered INTEGER NOT NULL DEFAULT 0,
  leads_qualified INTEGER NOT NULL DEFAULT 0,
  drafts_created INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_source_events_status_time
  ON strategy_source_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_source_events_strategy_market
  ON strategy_source_events(strategy_key, market, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_market_state_due
  ON strategy_market_state(status, next_run_at, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_lead_memberships_lane_status
  ON strategy_lead_memberships(strategy_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_lead_memberships_run
  ON strategy_lead_memberships(campaign_run_id, created_at DESC);

ALTER TABLE strategy_source_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_market_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_lead_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage strategy source events" ON strategy_source_events;
CREATE POLICY "Admins can manage strategy source events"
  ON strategy_source_events FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can manage strategy market state" ON strategy_market_state;
CREATE POLICY "Admins can manage strategy market state"
  ON strategy_market_state FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can manage strategy lead memberships" ON strategy_lead_memberships;
CREATE POLICY "Admins can manage strategy lead memberships"
  ON strategy_lead_memberships FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view strategy daily reports" ON strategy_daily_reports;
CREATE POLICY "Admins can view strategy daily reports"
  ON strategy_daily_reports FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON strategy_source_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON strategy_market_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON strategy_lead_memberships TO authenticated;
GRANT SELECT ON strategy_daily_reports TO authenticated;

GRANT ALL ON strategy_source_events TO service_role;
GRANT ALL ON strategy_market_state TO service_role;
GRANT ALL ON strategy_lead_memberships TO service_role;
GRANT ALL ON strategy_daily_reports TO service_role;
