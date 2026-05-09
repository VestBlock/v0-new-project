CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL,
  base_url TEXT,
  city TEXT,
  state TEXT,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS property_address TEXT,
  ADD COLUMN IF NOT EXISTS mailing_address TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS language_signal TEXT,
  ADD COLUMN IF NOT EXISTS pain_signal TEXT,
  ADD COLUMN IF NOT EXISTS best_offer TEXT,
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_detail TEXT,
  ADD COLUMN IF NOT EXISTS unsubscribe_note TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE leads
  ADD CONSTRAINT leads_lead_type_check
  CHECK (
    lead_type IN (
      'sell_house',
      'real_estate',
      'ai_assistant',
      'business_funding',
      'credit_card_funding_strategy',
      'lead_intelligence',
      'new_business_filing',
      'code_violation',
      'google_places',
      'sam_opportunity',
      'website_upgrade',
      'gov_contract',
      'business_formation'
    )
  );

ALTER TABLE leads
  ADD CONSTRAINT leads_status_check
  CHECK (
    status IN (
      'new',
      'scored',
      'outreach_ready',
      'contacted',
      'replied',
      'qualified',
      'nurturing',
      'closed',
      'disqualified'
    )
  );

CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  urgency_score INTEGER NOT NULL DEFAULT 0,
  business_age_score INTEGER NOT NULL DEFAULT 0,
  funding_need_score INTEGER NOT NULL DEFAULT 0,
  website_weakness_score INTEGER NOT NULL DEFAULT 0,
  language_niche_score INTEGER NOT NULL DEFAULT 0,
  distress_signal_score INTEGER NOT NULL DEFAULT 0,
  contract_fit_score INTEGER NOT NULL DEFAULT 0,
  contactability_score INTEGER NOT NULL DEFAULT 0,
  estimated_value_score INTEGER NOT NULL DEFAULT 0,
  best_offer TEXT,
  reasoning TEXT,
  scoring_version TEXT NOT NULL DEFAULT 'v1',
  breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'facebook_dm', 'phone_script')),
  subject TEXT,
  body TEXT NOT NULL,
  compliance_note TEXT,
  generated_with TEXT DEFAULT 'template',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, channel)
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
  source_key TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial')),
  request_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_user_id UUID,
  note TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_best_offer ON leads(best_offer);
CREATE INDEX IF NOT EXISTS idx_leads_city_state ON leads(city, state);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_external_id ON leads(source, external_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_address ON leads(property_address);
CREATE INDEX IF NOT EXISTS idx_lead_sources_active ON lead_sources(is_active, category);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_lead_channel ON outreach_messages(lead_id, channel);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_source_status ON scrape_runs(source_key, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_created_at ON lead_notes(lead_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external_id_unique
  ON leads(source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view lead sources" ON lead_sources;
CREATE POLICY "Admins can view lead sources"
  ON lead_sources FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert lead sources" ON lead_sources;
CREATE POLICY "Admins can insert lead sources"
  ON lead_sources FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update lead sources" ON lead_sources;
CREATE POLICY "Admins can update lead sources"
  ON lead_sources FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view lead scores" ON lead_scores;
CREATE POLICY "Admins can view lead scores"
  ON lead_scores FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert lead scores" ON lead_scores;
CREATE POLICY "Admins can insert lead scores"
  ON lead_scores FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update lead scores" ON lead_scores;
CREATE POLICY "Admins can update lead scores"
  ON lead_scores FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view outreach messages" ON outreach_messages;
CREATE POLICY "Admins can view outreach messages"
  ON outreach_messages FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert outreach messages" ON outreach_messages;
CREATE POLICY "Admins can insert outreach messages"
  ON outreach_messages FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update outreach messages" ON outreach_messages;
CREATE POLICY "Admins can update outreach messages"
  ON outreach_messages FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view scrape runs" ON scrape_runs;
CREATE POLICY "Admins can view scrape runs"
  ON scrape_runs FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert scrape runs" ON scrape_runs;
CREATE POLICY "Admins can insert scrape runs"
  ON scrape_runs FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update scrape runs" ON scrape_runs;
CREATE POLICY "Admins can update scrape runs"
  ON scrape_runs FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view lead notes" ON lead_notes;
CREATE POLICY "Admins can view lead notes"
  ON lead_notes FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert lead notes" ON lead_notes;
CREATE POLICY "Admins can insert lead notes"
  ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON lead_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lead_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON outreach_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON scrape_runs TO authenticated;
GRANT SELECT, INSERT ON lead_notes TO authenticated;

GRANT ALL ON lead_sources TO service_role;
GRANT ALL ON lead_scores TO service_role;
GRANT ALL ON outreach_messages TO service_role;
GRANT ALL ON scrape_runs TO service_role;
GRANT ALL ON lead_notes TO service_role;

DROP TRIGGER IF EXISTS on_lead_sources_updated ON lead_sources;
CREATE TRIGGER on_lead_sources_updated
  BEFORE UPDATE ON lead_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_lead_scores_updated ON lead_scores;
CREATE TRIGGER on_lead_scores_updated
  BEFORE UPDATE ON lead_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_outreach_messages_updated ON outreach_messages;
CREATE TRIGGER on_outreach_messages_updated
  BEFORE UPDATE ON outreach_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO lead_sources (
  source_key,
  name,
  category,
  source_type,
  base_url,
  city,
  state,
  config_json,
  is_active
) VALUES
  (
    'wisconsin_dfi_new_businesses',
    'Wisconsin DFI Business Filings',
    'new_business_formation',
    'official_search',
    'https://apps.dfi.wi.gov/apps/CorpSearch/',
    'Milwaukee',
    'WI',
    jsonb_build_object(
      'defaultQuery', 'LLC',
      'daysBack', 45,
      'entityTypes', jsonb_build_array('LLC', 'Corporation')
    ),
    TRUE
  ),
  (
    'cincinnati_code_enforcement',
    'Cincinnati Code Enforcement',
    'code_violation',
    'open_data_api',
    'https://data.cincinnati-oh.gov/resource/cncm-znd6.json',
    'Cincinnati',
    'OH',
    jsonb_build_object(
      'statusClass', 'OPEN',
      'daysBack', 120
    ),
    TRUE
  ),
  (
    'milwaukee_accela_enforcement',
    'Milwaukee Accela Enforcement Search',
    'code_violation',
    'public_search',
    'https://aca-prod.accela.com/MILWAUKEE/Cap/CapHome.aspx?module=Enforcement&TabName=Enforcement',
    'Milwaukee',
    'WI',
    jsonb_build_object(
      'searchMode', 'address_lookup',
      'requiresAddressSeed', TRUE
    ),
    TRUE
  ),
  (
    'google_places_businesses',
    'Google Places Business Search',
    'small_business',
    'api',
    'https://places.googleapis.com/v1/places:searchText',
    NULL,
    NULL,
    jsonb_build_object(
      'niches', jsonb_build_array(
        'barbershops',
        'beauty salons',
        'restaurants',
        'food trucks',
        'trucking companies',
        'cleaning companies',
        'contractors',
        'tax services',
        'daycare centers',
        'auto repair shops',
        'immigration services',
        'spanish-speaking businesses'
      )
    ),
    TRUE
  ),
  (
    'sam_contract_opportunities',
    'SAM.gov Contract Opportunities',
    'government_contracts',
    'api',
    'https://api.sam.gov/opportunities/v2/search',
    NULL,
    NULL,
    jsonb_build_object(
      'daysBack', 30,
      'defaultNaics', jsonb_build_array('236220', '541511', '541613', '561720')
    ),
    TRUE
  )
ON CONFLICT (source_key) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  source_type = EXCLUDED.source_type,
  base_url = EXCLUDED.base_url,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  config_json = EXCLUDED.config_json,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
