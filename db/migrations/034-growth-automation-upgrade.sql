ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS urgency_level TEXT,
  ADD COLUMN IF NOT EXISTS contactability_level TEXT,
  ADD COLUMN IF NOT EXISTS language_segment TEXT,
  ADD COLUMN IF NOT EXISTS outreach_angle TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value_label TEXT,
  ADD COLUMN IF NOT EXISTS market_segment TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS last_outreach_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website_audit_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS automation_flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS best_offer_reason TEXT,
  ADD COLUMN IF NOT EXISTS mailing_matches_property BOOLEAN;

DO $$
BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (
    status IN (
      'new',
      'scored',
      'outreach_ready',
      'contacted',
      'replied',
      'interested',
      'qualified',
      'nurturing',
      'closed',
      'closed_won',
      'closed_lost',
      'disqualified',
      'do_not_contact'
    )
  );

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_outreach_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_outreach_status_check
  CHECK (
    outreach_status IN (
      'not_started',
      'draft_ready',
      'needs_review',
      'approved',
      'queued',
      'sent',
      'followup_due',
      'failed',
      'do_not_contact'
    )
  );

DO $$
BEGIN
  ALTER TABLE outreach_messages DROP CONSTRAINT IF EXISTS outreach_messages_channel_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE outreach_messages DROP CONSTRAINT IF EXISTS outreach_messages_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE outreach_messages
  ADD COLUMN IF NOT EXISTS cta TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS variant_key TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_provider TEXT,
  ADD COLUMN IF NOT EXISTS send_error TEXT,
  ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE outreach_messages
  ADD CONSTRAINT outreach_messages_channel_check
  CHECK (channel IN ('sms', 'email', 'facebook_dm', 'instagram_dm', 'phone_script'));

ALTER TABLE outreach_messages
  ADD CONSTRAINT outreach_messages_status_check
  CHECK (status IN ('draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived'));

CREATE TABLE IF NOT EXISTS outreach_send_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  outreach_message_id UUID REFERENCES outreach_messages(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'facebook_dm', 'instagram_dm', 'phone_script')),
  provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'queued', 'sent', 'failed', 'skipped')),
  recipient TEXT,
  subject TEXT,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_outreach_status ON leads(outreach_status, next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_owner_user_id ON leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_market_segment ON leads(market_segment);
CREATE INDEX IF NOT EXISTS idx_leads_language_segment ON leads(language_segment);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_status_channel ON outreach_messages(status, channel);
CREATE INDEX IF NOT EXISTS idx_outreach_send_events_lead_created ON outreach_send_events(lead_id, created_at DESC);

ALTER TABLE outreach_send_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view outreach send events" ON outreach_send_events;
CREATE POLICY "Admins can view outreach send events"
  ON outreach_send_events FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert outreach send events" ON outreach_send_events;
CREATE POLICY "Admins can insert outreach send events"
  ON outreach_send_events FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT ON outreach_send_events TO authenticated;
GRANT ALL ON outreach_send_events TO service_role;

UPDATE lead_sources
SET config_json = config_json || jsonb_build_object(
  'dailyEnabled', TRUE,
  'dailyLimit', CASE
    WHEN source_key = 'wisconsin_dfi_new_businesses' THEN 12
    WHEN source_key IN ('google_places_businesses', 'outscraper_google_maps_businesses') THEN 24
    WHEN source_key = 'sam_contract_opportunities' THEN 20
    ELSE 16
  END,
  'priorityMarkets', CASE
    WHEN source_key IN ('google_places_businesses', 'outscraper_google_maps_businesses')
      THEN jsonb_build_array(
        jsonb_build_object('city', 'Milwaukee', 'state', 'WI', 'language', 'en', 'region', 'US'),
        jsonb_build_object('city', 'Milwaukee', 'state', 'WI', 'language', 'es', 'region', 'US'),
        jsonb_build_object('city', 'Chicago', 'state', 'IL', 'language', 'en', 'region', 'US'),
        jsonb_build_object('city', 'Chicago', 'state', 'IL', 'language', 'es', 'region', 'US'),
        jsonb_build_object('city', 'Cincinnati', 'state', 'OH', 'language', 'en', 'region', 'US')
      )
    ELSE COALESCE(config_json->'priorityMarkets', '[]'::jsonb)
  END
)
WHERE source_key IN (
  'wisconsin_dfi_new_businesses',
  'cincinnati_code_enforcement',
  'milwaukee_accela_enforcement',
  'google_places_businesses',
  'outscraper_google_maps_businesses',
  'sam_contract_opportunities'
);
