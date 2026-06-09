CREATE TABLE IF NOT EXISTS investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  person_name TEXT,
  llc_name TEXT,
  company_name TEXT,
  primary_investor_type TEXT NOT NULL DEFAULT 'fix_and_flip' CHECK (
    primary_investor_type IN (
      'fix_and_flip',
      'buy_and_hold',
      'dscr_investor',
      'wholesaler',
      'acquisition_manager',
      'institutional_buyer',
      'private_lender',
      'hard_money_borrower'
    )
  ),
  classification_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  linkedin_url TEXT,
  facebook_url TEXT,
  markets TEXT[] NOT NULL DEFAULT '{}'::text[],
  property_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  estimated_buy_box JSONB NOT NULL DEFAULT '{}'::jsonb,
  financing_indicators TEXT[] NOT NULL DEFAULT '{}'::text[],
  source_names TEXT[] NOT NULL DEFAULT '{}'::text[],
  source_confidence_score INTEGER NOT NULL DEFAULT 0,
  recent_activity_score INTEGER NOT NULL DEFAULT 0,
  transaction_volume_score INTEGER NOT NULL DEFAULT 0,
  geographic_fit_score INTEGER NOT NULL DEFAULT 0,
  financing_need_score INTEGER NOT NULL DEFAULT 0,
  disposition_need_score INTEGER NOT NULL DEFAULT 0,
  partnership_potential_score INTEGER NOT NULL DEFAULT 0,
  partnership_score INTEGER NOT NULL DEFAULT 0,
  deal_flow_fit BOOLEAN NOT NULL DEFAULT TRUE,
  disposition_fit BOOLEAN NOT NULL DEFAULT FALSE,
  financing_fit BOOLEAN NOT NULL DEFAULT FALSE,
  partnership_fit BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_sequence TEXT NOT NULL DEFAULT 'D' CHECK (assigned_sequence IN ('A', 'B', 'C', 'D')),
  outreach_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    outreach_status IN (
      'not_started',
      'draft_ready',
      'needs_review',
      'approved',
      'queued',
      'sent',
      'responded',
      'followup_due',
      'failed',
      'do_not_contact'
    )
  ),
  relationship_stage TEXT NOT NULL DEFAULT 'discovered' CHECK (
    relationship_stage IN (
      'discovered',
      'researched',
      'outreach_ready',
      'contacted',
      'followup_due',
      'responded',
      'qualified',
      'active_buyer',
      'active_borrower',
      'active_seller',
      'active_partner',
      'revenue_opportunity',
      'dormant',
      'paused',
      'not_a_fit'
    )
  ),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  last_scored_at TIMESTAMPTZ,
  last_outreach_generated_at TIMESTAMPTZ,
  ai_follow_up_summary TEXT,
  routing_owner TEXT,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_flags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_source_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'recent_flip_transaction',
      'county_deed_record',
      'llc_ownership_record',
      'dealmachine_export',
      'public_property_sales',
      'linkedin',
      'facebook_investor_group',
      'local_reia_directory',
      'public_foreclosure_buyer',
      'manual_research',
      'partner_referral'
    )
  ),
  source_name TEXT,
  source_url TEXT,
  external_id TEXT,
  record_date DATE,
  confidence_score INTEGER NOT NULL DEFAULT 50,
  evidence_summary TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  property_type TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'purchase',
  transaction_date DATE,
  purchase_price NUMERIC(14,2),
  sale_price NUMERIC(14,2),
  estimated_rehab NUMERIC(14,2),
  estimated_profit NUMERIC(14,2),
  financing_type TEXT,
  source_type TEXT,
  source_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS investor_outreach_sequences (
  code TEXT PRIMARY KEY CHECK (code IN ('A', 'B', 'C', 'D')),
  name TEXT NOT NULL,
  value_proposition TEXT NOT NULL,
  default_subject TEXT NOT NULL,
  default_body TEXT NOT NULL,
  default_cta TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  investor_contact_id UUID REFERENCES investor_contacts(id) ON DELETE SET NULL,
  sequence_code TEXT NOT NULL REFERENCES investor_outreach_sequences(code) ON DELETE RESTRICT,
  step_number INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin_dm', 'facebook_dm', 'phone_script', 'sms')),
  subject TEXT,
  body TEXT NOT NULL,
  cta TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (
    status IN ('draft', 'needs_review', 'approved', 'queued', 'sent', 'failed', 'archived')
  ),
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

CREATE TABLE IF NOT EXISTS investor_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  outreach_message_id UUID REFERENCES investor_outreach_messages(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'open',
      'click',
      'reply',
      'call_booked',
      'lending_request',
      'buy_box_received',
      'deal_submitted',
      'deal_sold',
      'funding_closed',
      'note',
      'manual_status_change'
    )
  ),
  event_value TEXT,
  event_amount NUMERIC(14,2),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  opportunity_type TEXT NOT NULL CHECK (
    opportunity_type IN (
      'active_buyer',
      'active_borrower',
      'active_seller',
      'lending_opportunity',
      'partnership_opportunity',
      'revenue_opportunity',
      'disposition_request',
      'deal_submission',
      'funding_request'
    )
  ),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'working', 'won', 'lost', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_revenue NUMERIC(14,2),
  route_to_team TEXT NOT NULL DEFAULT 'partnerships',
  due_at TIMESTAMPTZ,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (
    task_type IN (
      'collect_buy_box',
      'collect_lending_requirements',
      'collect_disposition_requirements',
      'route_deal',
      'route_lending',
      'book_call',
      'manual_review'
    )
  ),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'canceled')),
  assigned_team TEXT NOT NULL DEFAULT 'partnerships',
  prompt TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (
    run_type IN (
      'daily_discovery',
      'discovery',
      'scoring',
      'outreach_generation',
      'outreach_send',
      'followup',
      'performance_rollup',
      'pipeline'
    )
  ),
  source_key TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  request_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_profiles_email_unique
  ON investor_profiles(lower(contact_email))
  WHERE contact_email IS NOT NULL AND contact_email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_profiles_source_identity_unique
  ON investor_profiles((metadata_json->>'sourceIdentity'))
  WHERE metadata_json ? 'sourceIdentity';
CREATE INDEX IF NOT EXISTS idx_investor_profiles_score ON investor_profiles(partnership_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_stage ON investor_profiles(relationship_stage, outreach_status);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_markets ON investor_profiles USING GIN(markets);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_classifications ON investor_profiles USING GIN(classification_tags);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_sources ON investor_profiles USING GIN(source_names);
CREATE INDEX IF NOT EXISTS idx_investor_source_evidence_profile ON investor_source_evidence(investor_profile_id, source_type);
CREATE INDEX IF NOT EXISTS idx_investor_transactions_profile ON investor_transactions(investor_profile_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_investor_transactions_market ON investor_transactions(city, state, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_investor_contacts_profile ON investor_contacts(investor_profile_id, is_primary DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_contacts_profile_email_unique
  ON investor_contacts(investor_profile_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_outreach_profile_sequence_step
  ON investor_outreach_messages(investor_profile_id, sequence_code, step_number, channel);
CREATE INDEX IF NOT EXISTS idx_investor_outreach_status ON investor_outreach_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_engagement_profile ON investor_engagement_events(investor_profile_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_engagement_type ON investor_engagement_events(event_type, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_opportunities_type_status ON investor_opportunities(opportunity_type, status, priority);
CREATE INDEX IF NOT EXISTS idx_investor_follow_up_profile ON investor_follow_up_tasks(investor_profile_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_investor_automation_runs_type_started ON investor_automation_runs(run_type, started_at DESC);

INSERT INTO investor_outreach_sequences (code, name, value_proposition, default_subject, default_body, default_cta)
VALUES
  (
    'A',
    'Deal Flow',
    'Bring investors deals',
    'Off-market deal flow in your market',
    'VestBlock helps investors acquire off-market opportunities that fit their buy box. We are building strategic partnerships with active buyers in your market and would like to learn more about what you''re currently acquiring.',
    'Can you send over your current buy box?'
  ),
  (
    'B',
    'Disposition Support',
    'Help investors sell deals',
    'Buyer network support for your inventory',
    'VestBlock works with investors and operators who need help moving inventory, finding buyers, and increasing disposition velocity. We may be able to help place properties with our growing investor network.',
    'Do you have any properties or assignments that need more buyer coverage?'
  ),
  (
    'C',
    'Financing Support',
    'Help investors obtain financing',
    'Capital options for acquisitions and projects',
    'VestBlock has lending relationships that can assist with fix-and-flip projects, rental acquisitions, DSCR opportunities, business funding, and working capital needs. We are interested in understanding your current financing requirements.',
    'What types of funding are you currently looking for?'
  ),
  (
    'D',
    'Strategic Partnership',
    'Create long-term investor partnerships',
    'Strategic investor partnership with VestBlock',
    'VestBlock is creating a deal-routing network that connects investors, wholesalers, lenders, acquisition teams, and disposition teams. We are seeking long-term partners who want more deal flow, more buyers, and more capital solutions.',
    'Would it make sense to compare partnership criteria this week?'
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  value_proposition = EXCLUDED.value_proposition,
  default_subject = EXCLUDED.default_subject,
  default_body = EXCLUDED.default_body,
  default_cta = EXCLUDED.default_cta,
  updated_at = NOW();

CREATE TRIGGER investor_profiles_touch_updated_at
  BEFORE UPDATE ON investor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_transactions_touch_updated_at
  BEFORE UPDATE ON investor_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_contacts_touch_updated_at
  BEFORE UPDATE ON investor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_outreach_sequences_touch_updated_at
  BEFORE UPDATE ON investor_outreach_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_outreach_messages_touch_updated_at
  BEFORE UPDATE ON investor_outreach_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_opportunities_touch_updated_at
  BEFORE UPDATE ON investor_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER investor_follow_up_tasks_touch_updated_at
  BEFORE UPDATE ON investor_follow_up_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_source_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'investor_profiles',
      'investor_source_evidence',
      'investor_transactions',
      'investor_contacts',
      'investor_outreach_sequences',
      'investor_outreach_messages',
      'investor_engagement_events',
      'investor_opportunities',
      'investor_follow_up_tasks',
      'investor_automation_runs'
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

GRANT SELECT, INSERT, UPDATE ON investor_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_source_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_outreach_sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_outreach_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_engagement_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_follow_up_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON investor_automation_runs TO authenticated;

GRANT ALL ON investor_profiles TO service_role;
GRANT ALL ON investor_source_evidence TO service_role;
GRANT ALL ON investor_transactions TO service_role;
GRANT ALL ON investor_contacts TO service_role;
GRANT ALL ON investor_outreach_sequences TO service_role;
GRANT ALL ON investor_outreach_messages TO service_role;
GRANT ALL ON investor_engagement_events TO service_role;
GRANT ALL ON investor_opportunities TO service_role;
GRANT ALL ON investor_follow_up_tasks TO service_role;
GRANT ALL ON investor_automation_runs TO service_role;
