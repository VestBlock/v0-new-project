CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  buyer_type TEXT NOT NULL CHECK (buyer_type IN ('local_operator', 'institutional', 'specialty')),
  category TEXT NOT NULL,
  buyer_size TEXT,
  headquarters_city TEXT,
  headquarters_state TEXT,
  markets_served TEXT[] NOT NULL DEFAULT '{}'::text[],
  national_or_regional TEXT NOT NULL DEFAULT 'regional' CHECK (national_or_regional IN ('local', 'regional', 'national', 'multi_state')),
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  source TEXT,
  source_url TEXT,
  external_id TEXT,
  outreach_status TEXT NOT NULL DEFAULT 'not_started' CHECK (outreach_status IN ('not_started', 'draft_ready', 'needs_review', 'approved', 'queued', 'sent', 'responded', 'followup_due', 'failed', 'do_not_contact')),
  relationship_stage TEXT NOT NULL DEFAULT 'discovered' CHECK (relationship_stage IN ('discovered', 'researched', 'outreach_ready', 'contacted', 'followup_due', 'responded', 'reviewing', 'active_buyer', 'dormant', 'paused', 'not_a_fit')),
  confidence_score INTEGER NOT NULL DEFAULT 0,
  fit_summary TEXT,
  notes TEXT,
  distress_utility_score INTEGER NOT NULL DEFAULT 0,
  code_violation_utility_score INTEGER NOT NULL DEFAULT 0,
  seller_lead_utility_score INTEGER NOT NULL DEFAULT 0,
  market_expansion_value_score INTEGER NOT NULL DEFAULT 0,
  institutional_fit_value_score INTEGER NOT NULL DEFAULT 0,
  referral_value_score INTEGER NOT NULL DEFAULT 0,
  bilingual_support BOOLEAN NOT NULL DEFAULT FALSE,
  spanish_support BOOLEAN NOT NULL DEFAULT FALSE,
  proof_of_funds_status TEXT,
  closing_speed TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  last_scored_at TIMESTAMPTZ,
  last_outreach_generated_at TIMESTAMPTZ,
  contact_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_buy_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  buy_box_name TEXT NOT NULL,
  asset_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  states TEXT[] NOT NULL DEFAULT '{}'::text[],
  cities TEXT[] NOT NULL DEFAULT '{}'::text[],
  zip_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
  metros TEXT[] NOT NULL DEFAULT '{}'::text[],
  occupancy_preference TEXT,
  distressed_tolerance INTEGER NOT NULL DEFAULT 0,
  code_violation_tolerance INTEGER NOT NULL DEFAULT 0,
  tenant_occupied_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  section8_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  price_min NUMERIC(14,2),
  price_max NUMERIC(14,2),
  arv_min NUMERIC(14,2),
  arv_max NUMERIC(14,2),
  rehab_budget_max NUMERIC(14,2),
  minimum_equity_percent NUMERIC(5,2),
  minimum_discount_percent NUMERIC(5,2),
  preferred_deal_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  closing_speed TEXT,
  proof_of_funds_status TEXT,
  creative_finance_open BOOLEAN NOT NULL DEFAULT FALSE,
  portfolio_size_preference TEXT,
  institutional_criteria TEXT,
  bilingual_support BOOLEAN NOT NULL DEFAULT FALSE,
  spanish_support BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  metro_area TEXT,
  market_type TEXT NOT NULL DEFAULT 'target',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'email',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  buyer_contact_id UUID REFERENCES buyer_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email_intro', 'email_followup', 'linkedin_dm', 'phone_script', 'spanish_email')),
  subject TEXT,
  body TEXT NOT NULL,
  cta TEXT,
  partnership_angle TEXT,
  property_referral_angle TEXT,
  compliance_note TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived')),
  language TEXT NOT NULL DEFAULT 'en',
  generated_with TEXT,
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  send_provider TEXT,
  send_error TEXT,
  last_generated_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_outreach_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  source_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial')),
  result_count INTEGER NOT NULL DEFAULT 0,
  request_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  asset_type TEXT,
  occupancy TEXT,
  deal_type TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  fit_summary TEXT,
  fit_explanation TEXT,
  next_info_needed TEXT[] NOT NULL DEFAULT '{}'::text[],
  fallback_buyer_categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'reviewed', 'shared', 'active', 'rejected', 'archived')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL UNIQUE REFERENCES buyers(id) ON DELETE CASCADE,
  outreach_sent_count INTEGER NOT NULL DEFAULT 0,
  outreach_failed_count INTEGER NOT NULL DEFAULT 0,
  response_count INTEGER NOT NULL DEFAULT 0,
  active_match_count INTEGER NOT NULL DEFAULT 0,
  closed_referral_count INTEGER NOT NULL DEFAULT 0,
  average_match_score INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TIMESTAMPTZ,
  last_responded_at TIMESTAMPTZ,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyer_relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyers_type_category ON buyers(buyer_type, category);
CREATE INDEX IF NOT EXISTS idx_buyers_relationship_stage ON buyers(relationship_stage, outreach_status);
CREATE INDEX IF NOT EXISTS idx_buyers_state_confidence ON buyers(headquarters_state, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_buyers_markets_served ON buyers USING GIN(markets_served);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyers_source_external_unique ON buyers(source, external_id);
CREATE INDEX IF NOT EXISTS idx_buyer_buy_boxes_buyer ON buyer_buy_boxes(buyer_id, active);
CREATE INDEX IF NOT EXISTS idx_buyer_buy_boxes_states ON buyer_buy_boxes USING GIN(states);
CREATE INDEX IF NOT EXISTS idx_buyer_buy_boxes_cities ON buyer_buy_boxes USING GIN(cities);
CREATE INDEX IF NOT EXISTS idx_buyer_buy_boxes_zips ON buyer_buy_boxes USING GIN(zip_codes);
CREATE INDEX IF NOT EXISTS idx_buyer_buy_boxes_assets ON buyer_buy_boxes USING GIN(asset_types);
CREATE INDEX IF NOT EXISTS idx_buyer_markets_buyer ON buyer_markets(buyer_id, state);
CREATE INDEX IF NOT EXISTS idx_buyer_contacts_buyer ON buyer_contacts(buyer_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_outreach_messages_buyer ON buyer_outreach_messages(buyer_id, status, channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_outreach_messages_buyer_channel_unique ON buyer_outreach_messages(buyer_id, channel);
CREATE INDEX IF NOT EXISTS idx_buyer_outreach_runs_status ON buyer_outreach_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_notes_buyer ON buyer_notes(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_matches_lead ON buyer_matches(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_matches_buyer ON buyer_matches(buyer_id, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_relationship_events_buyer ON buyer_relationship_events(buyer_id, created_at DESC);

CREATE TRIGGER buyers_touch_updated_at
  BEFORE UPDATE ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_buy_boxes_touch_updated_at
  BEFORE UPDATE ON buyer_buy_boxes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_markets_touch_updated_at
  BEFORE UPDATE ON buyer_markets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_contacts_touch_updated_at
  BEFORE UPDATE ON buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_outreach_messages_touch_updated_at
  BEFORE UPDATE ON buyer_outreach_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_matches_touch_updated_at
  BEFORE UPDATE ON buyer_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER buyer_performance_touch_updated_at
  BEFORE UPDATE ON buyer_performance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_buy_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_outreach_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_relationship_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'buyers',
      'buyer_buy_boxes',
      'buyer_markets',
      'buyer_contacts',
      'buyer_outreach_messages',
      'buyer_outreach_runs',
      'buyer_notes',
      'buyer_matches',
      'buyer_performance',
      'buyer_relationship_events'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT TO authenticated USING (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE TO authenticated USING (private.vestblock_is_admin()) WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins and users can view buyer matches" ON buyer_matches;
CREATE POLICY "Admins and users can view buyer matches"
  ON buyer_matches FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON buyers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_buy_boxes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_markets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_outreach_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_outreach_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_performance TO authenticated;
GRANT SELECT, INSERT, UPDATE ON buyer_relationship_events TO authenticated;

GRANT ALL ON buyers TO service_role;
GRANT ALL ON buyer_buy_boxes TO service_role;
GRANT ALL ON buyer_markets TO service_role;
GRANT ALL ON buyer_contacts TO service_role;
GRANT ALL ON buyer_outreach_messages TO service_role;
GRANT ALL ON buyer_outreach_runs TO service_role;
GRANT ALL ON buyer_notes TO service_role;
GRANT ALL ON buyer_matches TO service_role;
GRANT ALL ON buyer_performance TO service_role;
GRANT ALL ON buyer_relationship_events TO service_role;
