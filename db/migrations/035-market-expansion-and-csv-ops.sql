CREATE TABLE IF NOT EXISTS target_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  metro_area TEXT,
  population INTEGER,
  business_density_score INTEGER NOT NULL DEFAULT 0,
  new_llc_score INTEGER NOT NULL DEFAULT 0,
  funding_need_score INTEGER NOT NULL DEFAULT 0,
  real_estate_activity_score INTEGER NOT NULL DEFAULT 0,
  spanish_business_score INTEGER NOT NULL DEFAULT 0,
  ai_receptionist_opportunity_score INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER NOT NULL DEFAULT 0,
  niche_focus TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'scraped', 'paused', 'exhausted')),
  last_scraped_at TIMESTAMPTZ,
  performance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city, state)
);

CREATE TABLE IF NOT EXISTS lead_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  phone TEXT,
  website TEXT,
  business_name TEXT,
  city TEXT,
  state TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS niche TEXT,
  ADD COLUMN IF NOT EXISTS target_market_id UUID REFERENCES target_markets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expansion_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS email_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS bounce_risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS suppression_reason TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_delivery_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_delivery_status_check
  CHECK (delivery_status IN ('not_sent', 'queued', 'sent', 'bounced', 'replied', 'booked', 'suppressed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_target_markets_status_score ON target_markets(status, final_score DESC, last_scraped_at);
CREATE INDEX IF NOT EXISTS idx_target_markets_city_state ON target_markets(city, state);
CREATE INDEX IF NOT EXISTS idx_lead_suppressions_email ON lead_suppressions(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_suppressions_phone ON lead_suppressions(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_suppressions_website ON lead_suppressions(website) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_target_market ON leads(target_market_id, niche);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_name ON leads(campaign_name);
CREATE INDEX IF NOT EXISTS idx_leads_delivery_status ON leads(delivery_status);
CREATE INDEX IF NOT EXISTS idx_leads_email_valid ON leads(email_valid);

ALTER TABLE target_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view target markets" ON target_markets;
CREATE POLICY "Admins can view target markets"
  ON target_markets FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert target markets" ON target_markets;
CREATE POLICY "Admins can insert target markets"
  ON target_markets FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update target markets" ON target_markets;
CREATE POLICY "Admins can update target markets"
  ON target_markets FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view lead suppressions" ON lead_suppressions;
CREATE POLICY "Admins can view lead suppressions"
  ON lead_suppressions FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert lead suppressions" ON lead_suppressions;
CREATE POLICY "Admins can insert lead suppressions"
  ON lead_suppressions FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update lead suppressions" ON lead_suppressions;
CREATE POLICY "Admins can update lead suppressions"
  ON lead_suppressions FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON target_markets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lead_suppressions TO authenticated;
GRANT ALL ON target_markets TO service_role;
GRANT ALL ON lead_suppressions TO service_role;
