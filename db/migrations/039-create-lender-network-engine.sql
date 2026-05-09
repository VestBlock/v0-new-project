CREATE TABLE IF NOT EXISTS lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  lender_type TEXT NOT NULL CHECK (lender_type IN ('real_estate', 'business', 'personal', 'specialty')),
  category TEXT NOT NULL,
  lender_size TEXT,
  headquarters_city TEXT,
  headquarters_state TEXT,
  states_served TEXT[] NOT NULL DEFAULT '{}'::text[],
  national_or_regional TEXT NOT NULL DEFAULT 'regional' CHECK (national_or_regional IN ('local', 'regional', 'national', 'multi_state')),
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  source TEXT,
  source_url TEXT,
  external_id TEXT,
  outreach_status TEXT NOT NULL DEFAULT 'not_started' CHECK (outreach_status IN ('not_started', 'draft_ready', 'needs_review', 'approved', 'queued', 'sent', 'responded', 'followup_due', 'failed', 'do_not_contact')),
  relationship_stage TEXT NOT NULL DEFAULT 'discovered' CHECK (relationship_stage IN ('discovered', 'researched', 'outreach_ready', 'contacted', 'followup_due', 'responded', 'reviewing', 'active_partner', 'dormant', 'paused', 'not_a_fit')),
  confidence_score INTEGER NOT NULL DEFAULT 0,
  fit_summary TEXT,
  notes TEXT,
  min_credit_score INTEGER,
  min_revenue NUMERIC(14,2),
  min_time_in_business INTEGER,
  startup_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  collateral_required BOOLEAN NOT NULL DEFAULT FALSE,
  owner_occupied_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  investor_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  rehab_tolerance INTEGER NOT NULL DEFAULT 0,
  first_time_investor_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  bankruptcy_tolerance TEXT,
  tax_lien_tolerance TEXT,
  low_doc BOOLEAN NOT NULL DEFAULT FALSE,
  speed_to_close TEXT,
  industries_preferred TEXT[] NOT NULL DEFAULT '{}'::text[],
  industries_excluded TEXT[] NOT NULL DEFAULT '{}'::text[],
  loan_amount_min NUMERIC(14,2),
  loan_amount_max NUMERIC(14,2),
  dscr_min NUMERIC(5,2),
  seasoning_requirement TEXT,
  cash_out_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  bilingual_support BOOLEAN NOT NULL DEFAULT FALSE,
  spanish_support BOOLEAN NOT NULL DEFAULT FALSE,
  startup_friendliness_score INTEGER NOT NULL DEFAULT 0,
  real_estate_utility_score INTEGER NOT NULL DEFAULT 0,
  business_funding_utility_score INTEGER NOT NULL DEFAULT 0,
  spanish_market_value_score INTEGER NOT NULL DEFAULT 0,
  market_expansion_value_score INTEGER NOT NULL DEFAULT 0,
  referral_value_score INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS lender_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  min_credit_score INTEGER,
  min_revenue NUMERIC(14,2),
  min_time_in_business INTEGER,
  startup_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  owner_occupied_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  investor_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  collateral_required BOOLEAN NOT NULL DEFAULT FALSE,
  loan_amount_min NUMERIC(14,2),
  loan_amount_max NUMERIC(14,2),
  dscr_min NUMERIC(5,2),
  speed_to_close TEXT,
  truthful_notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lender_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  metro_area TEXT,
  market_type TEXT NOT NULL DEFAULT 'statewide',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lender_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  description TEXT,
  startup_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  low_doc BOOLEAN NOT NULL DEFAULT FALSE,
  bilingual_support BOOLEAN NOT NULL DEFAULT FALSE,
  spanish_support BOOLEAN NOT NULL DEFAULT FALSE,
  loan_amount_min NUMERIC(14,2),
  loan_amount_max NUMERIC(14,2),
  min_credit_score INTEGER,
  min_revenue NUMERIC(14,2),
  min_time_in_business INTEGER,
  dscr_min NUMERIC(5,2),
  seasoning_requirement TEXT,
  truthful_notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lender_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS lender_outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  lender_contact_id UUID REFERENCES lender_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email_intro', 'email_followup', 'linkedin_dm', 'phone_script', 'spanish_email')),
  subject TEXT,
  body TEXT NOT NULL,
  cta TEXT,
  partnership_angle TEXT,
  borrower_referral_angle TEXT,
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

CREATE TABLE IF NOT EXISTS lender_outreach_runs (
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

CREATE TABLE IF NOT EXISTS lender_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lender_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  funding_profile_id UUID REFERENCES funding_profiles(id) ON DELETE SET NULL,
  funding_recommendation_id UUID REFERENCES funding_recommendations(id) ON DELETE SET NULL,
  service_type TEXT,
  borrower_state TEXT,
  borrower_industry TEXT,
  deal_type TEXT,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  fit_summary TEXT,
  fit_explanation TEXT,
  next_docs_needed TEXT[] NOT NULL DEFAULT '{}'::text[],
  fallback_options TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'reviewed', 'shared', 'active', 'rejected', 'archived')),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lender_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL UNIQUE REFERENCES lenders(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS lender_relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lenders_type_category ON lenders(lender_type, category);
CREATE INDEX IF NOT EXISTS idx_lenders_relationship_stage ON lenders(relationship_stage, outreach_status);
CREATE INDEX IF NOT EXISTS idx_lenders_state_confidence ON lenders(headquarters_state, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_lenders_states_served ON lenders USING GIN(states_served);
CREATE INDEX IF NOT EXISTS idx_lenders_industries_preferred ON lenders USING GIN(industries_preferred);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lenders_source_external_unique ON lenders(source, external_id);
CREATE INDEX IF NOT EXISTS idx_lender_products_lender ON lender_products(lender_id, category);
CREATE INDEX IF NOT EXISTS idx_lender_markets_lender ON lender_markets(lender_id, state);
CREATE INDEX IF NOT EXISTS idx_lender_programs_lender ON lender_programs(lender_id, program_type);
CREATE INDEX IF NOT EXISTS idx_lender_contacts_lender ON lender_contacts(lender_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_lender_outreach_messages_lender ON lender_outreach_messages(lender_id, status, channel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lender_outreach_messages_lender_channel_unique ON lender_outreach_messages(lender_id, channel);
CREATE INDEX IF NOT EXISTS idx_lender_outreach_runs_status ON lender_outreach_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lender_notes_lender ON lender_notes(lender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lender_matches_user ON lender_matches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lender_matches_lead ON lender_matches(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lender_matches_lender ON lender_matches(lender_id, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_lender_relationship_events_lender ON lender_relationship_events(lender_id, created_at DESC);

CREATE TRIGGER lenders_touch_updated_at
  BEFORE UPDATE ON lenders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_products_touch_updated_at
  BEFORE UPDATE ON lender_products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_markets_touch_updated_at
  BEFORE UPDATE ON lender_markets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_programs_touch_updated_at
  BEFORE UPDATE ON lender_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_contacts_touch_updated_at
  BEFORE UPDATE ON lender_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_outreach_messages_touch_updated_at
  BEFORE UPDATE ON lender_outreach_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_matches_touch_updated_at
  BEFORE UPDATE ON lender_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER lender_performance_touch_updated_at
  BEFORE UPDATE ON lender_performance
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_outreach_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_relationship_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'lenders',
      'lender_products',
      'lender_markets',
      'lender_programs',
      'lender_contacts',
      'lender_outreach_messages',
      'lender_outreach_runs',
      'lender_notes',
      'lender_matches',
      'lender_performance',
      'lender_relationship_events'
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

DROP POLICY IF EXISTS "Users can view own lender matches" ON lender_matches;
CREATE POLICY "Users can view own lender matches"
  ON lender_matches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON lenders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_markets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_outreach_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_outreach_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_performance TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lender_relationship_events TO authenticated;

GRANT ALL ON lenders TO service_role;
GRANT ALL ON lender_products TO service_role;
GRANT ALL ON lender_markets TO service_role;
GRANT ALL ON lender_programs TO service_role;
GRANT ALL ON lender_contacts TO service_role;
GRANT ALL ON lender_outreach_messages TO service_role;
GRANT ALL ON lender_outreach_runs TO service_role;
GRANT ALL ON lender_notes TO service_role;
GRANT ALL ON lender_matches TO service_role;
GRANT ALL ON lender_performance TO service_role;
GRANT ALL ON lender_relationship_events TO service_role;
