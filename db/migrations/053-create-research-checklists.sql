CREATE TABLE IF NOT EXISTS osint_research_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN (
      'property',
      'seller',
      'buyer',
      'lender',
      'investor',
      'contractor',
      'developer',
      'land_bank',
      'bank_owned_asset',
      'partner_prospect',
      'lead',
      'other'
    )
  ),
  entity_id UUID,
  source_type TEXT,
  source_id TEXT,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  owner_name TEXT,
  company_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_links_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunity_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_lane TEXT CHECK (
    recommended_lane IS NULL OR recommended_lane IN (
      'seller_fast_cash',
      'seller_creative',
      'seller_novation',
      'buyer_buy_box',
      'lender_criteria',
      'contractor_partner',
      'developer_partner',
      'land_bank_relationship',
      'bank_owned_assets',
      'investor_partnership',
      'no_outreach'
    )
  ),
  outreach_status TEXT NOT NULL DEFAULT 'not_ready' CHECK (
    outreach_status IN (
      'not_ready',
      'needs_review',
      'ready',
      'approved',
      'sent',
      'responded',
      'do_not_contact'
    )
  ),
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  research_summary TEXT,
  next_action TEXT,
  assigned_owner TEXT,
  follow_up_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_checklists_entity ON osint_research_checklists(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_research_checklists_property_address ON osint_research_checklists(property_address);
CREATE INDEX IF NOT EXISTS idx_research_checklists_market ON osint_research_checklists(city, state);
CREATE INDEX IF NOT EXISTS idx_research_checklists_email ON osint_research_checklists(lower(contact_email)) WHERE contact_email IS NOT NULL AND contact_email <> '';
CREATE INDEX IF NOT EXISTS idx_research_checklists_phone ON osint_research_checklists(contact_phone);
CREATE INDEX IF NOT EXISTS idx_research_checklists_lane ON osint_research_checklists(recommended_lane);
CREATE INDEX IF NOT EXISTS idx_research_checklists_outreach_status ON osint_research_checklists(outreach_status);
CREATE INDEX IF NOT EXISTS idx_research_checklists_confidence ON osint_research_checklists(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_research_checklists_follow_up ON osint_research_checklists(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_research_checklists_created ON osint_research_checklists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_checklists_source ON osint_research_checklists(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_research_checklists_source_unique
  ON osint_research_checklists(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

DROP TRIGGER IF EXISTS osint_research_checklists_touch_updated_at ON osint_research_checklists;
CREATE TRIGGER osint_research_checklists_touch_updated_at
  BEFORE UPDATE ON osint_research_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE osint_research_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view osint_research_checklists" ON osint_research_checklists;
CREATE POLICY "Admins can view osint_research_checklists"
  ON osint_research_checklists
  FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert osint_research_checklists" ON osint_research_checklists;
CREATE POLICY "Admins can insert osint_research_checklists"
  ON osint_research_checklists
  FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update osint_research_checklists" ON osint_research_checklists;
CREATE POLICY "Admins can update osint_research_checklists"
  ON osint_research_checklists
  FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON osint_research_checklists TO authenticated;
GRANT ALL ON osint_research_checklists TO service_role;
