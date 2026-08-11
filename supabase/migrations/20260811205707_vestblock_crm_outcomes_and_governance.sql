-- VestBlock first-party CRM, attribution, strategy evidence, and privacy operations.
-- Generated with Supabase CLI. Commit and validate this migration; do not apply to
-- production without the release approval and rollback checkpoint.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.vestblock_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  display_name TEXT NOT NULL,
  domain TEXT,
  verticals TEXT[] NOT NULL DEFAULT '{}',
  source_type TEXT NOT NULL,
  source_reference TEXT,
  source_observed_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  full_name TEXT,
  email_normalized TEXT,
  phone_e164 TEXT,
  city TEXT,
  state TEXT,
  country_code TEXT DEFAULT 'US',
  lifecycle_stage TEXT NOT NULL DEFAULT 'lead' CHECK (lifecycle_stage IN (
    'lead', 'qualified', 'opportunity', 'customer', 'partner', 'inactive', 'suppressed'
  )),
  source_type TEXT NOT NULL,
  source_reference TEXT,
  source_observed_at TIMESTAMPTZ,
  lawful_basis TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_unique
  ON public.crm_contacts(email_normalized)
  WHERE email_normalized IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_phone_unique
  ON public.crm_contacts(phone_e164)
  WHERE phone_e164 IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_contact_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL,
  vertical TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'partial', 'verified', 'expired')),
  verified_at TIMESTAMPTZ,
  verification_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, company_id, role_key, vertical)
);

CREATE TABLE IF NOT EXISTS public.crm_channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'direct_mail', 'in_app', 'social')),
  status TEXT NOT NULL CHECK (status IN ('unknown', 'allowed', 'transactional_only', 'suppressed', 'unsubscribed', 'complaint')),
  lawful_basis TEXT,
  consent_source TEXT,
  consent_text_version TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  suppression_reason TEXT,
  provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id, channel)
);

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_key TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  vertical TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'identified' CHECK (stage IN (
    'identified', 'qualified', 'review', 'introduced', 'proposal', 'won', 'lost', 'paused'
  )),
  value_estimate NUMERIC(14,2),
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  strategy_id UUID REFERENCES public.strategy_updates(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  source_observed_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key TEXT NOT NULL UNIQUE,
  strategy_id UUID REFERENCES public.strategy_updates(id) ON DELETE SET NULL,
  campaign_run_id UUID REFERENCES public.command_center_strategy_runs(id) ON DELETE SET NULL,
  vertical TEXT NOT NULL,
  portfolio_role TEXT NOT NULL CHECK (portfolio_role IN ('focus', 'challenger', 'backlog', 'research')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'active', 'paused', 'completed', 'retired')),
  primary_channel TEXT NOT NULL,
  secondary_channel TEXT,
  audience_definition TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'not_granted' CHECK (approval_status IN ('not_granted', 'approved', 'revoked')),
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  cost_cap NUMERIC(12,2) NOT NULL DEFAULT 0,
  success_threshold_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  stop_conditions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  qualification_evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'excluded', 'awaiting_approval', 'approved', 'active', 'replied', 'converted', 'suppressed', 'completed')),
  exclusion_reason TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.crm_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES public.crm_enrollments(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES public.strategy_updates(id) ON DELETE SET NULL,
  campaign_run_id UUID REFERENCES public.command_center_strategy_runs(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  touch_type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  subject_summary TEXT,
  content_reference TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_touches_provider_message_unique
  ON public.crm_touches(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  touch_id UUID NOT NULL REFERENCES public.crm_touches(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  classification TEXT NOT NULL,
  sentiment TEXT,
  intent TEXT,
  summary TEXT,
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  stop_requested BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(touch_id)
);

CREATE TABLE IF NOT EXISTS public.crm_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  external_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  starts_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  outcome_summary TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES public.strategy_updates(id) ON DELETE SET NULL,
  conversion_type TEXT NOT NULL,
  value NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  occurred_at TIMESTAMPTZ NOT NULL,
  source_of_truth TEXT NOT NULL DEFAULT 'vestblock_crm',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  conversion_id UUID REFERENCES public.crm_conversions(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  event_type TEXT NOT NULL CHECK (event_type IN ('booked', 'collected', 'refunded', 'written_off')),
  provider TEXT,
  provider_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_attribution_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id UUID NOT NULL REFERENCES public.crm_conversions(id) ON DELETE CASCADE,
  touch_id UUID REFERENCES public.crm_touches(id) ON DELETE SET NULL,
  model TEXT NOT NULL CHECK (model IN ('first_touch', 'last_touch', 'position_based', 'self_reported', 'operator_assigned')),
  credit NUMERIC(7,6) NOT NULL CHECK (credit >= 0 AND credit <= 1),
  channel TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign_key TEXT,
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  basis TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversion_id, model, touch_id)
);

CREATE TABLE IF NOT EXISTS public.market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  publication_date TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL,
  credibility INTEGER NOT NULL CHECK (credibility BETWEEN 0 AND 100),
  recency_score INTEGER NOT NULL CHECK (recency_score BETWEEN 0 AND 100),
  verticals TEXT[] NOT NULL,
  fact_summary TEXT NOT NULL,
  what_changed TEXT,
  why_it_matters TEXT,
  recommended_experiment TEXT,
  missing_evidence TEXT,
  risk_note TEXT,
  evidence_class TEXT NOT NULL CHECK (evidence_class IN ('fact', 'estimate', 'hypothesis', 'missing')),
  contradiction_state TEXT NOT NULL DEFAULT 'none' CHECK (contradiction_state IN ('none', 'possible', 'confirmed')),
  source_family TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.strategy_score_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES public.strategy_updates(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES public.experiment_results(id) ON DELETE SET NULL,
  prior_score INTEGER,
  new_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  evidence_ids UUID[] NOT NULL DEFAULT '{}',
  changed_by TEXT NOT NULL CHECK (changed_by IN ('operator', 'scheduled_review', 'experiment_result')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_rights_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'correction', 'export', 'deletion', 'restriction')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'identity_review', 'in_progress', 'waiting', 'completed', 'denied')),
  details TEXT,
  source TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  resolution_summary TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_deletion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.data_rights_requests(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('planned', 'approved', 'running', 'completed', 'failed', 'rolled_back')),
  scope_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exception_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.crm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'service', 'workflow')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT,
  before_json JSONB,
  after_json JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_contacts_company_stage_idx ON public.crm_contacts(company_id, lifecycle_stage, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS crm_opportunities_stage_vertical_idx ON public.crm_opportunities(stage, vertical, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_campaigns_status_vertical_idx ON public.crm_campaigns(status, vertical, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_enrollments_status_next_idx ON public.crm_enrollments(status, next_action_at);
CREATE INDEX IF NOT EXISTS crm_touches_contact_time_idx ON public.crm_touches(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_conversions_strategy_time_idx ON public.crm_conversions(strategy_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS market_signals_vertical_time_idx ON public.market_signals USING GIN(verticals);
CREATE INDEX IF NOT EXISTS market_signals_retrieved_idx ON public.market_signals(retrieved_at DESC);
CREATE INDEX IF NOT EXISTS data_rights_status_due_idx ON public.data_rights_requests(status, due_at);
CREATE INDEX IF NOT EXISTS crm_audit_entity_time_idx ON public.crm_audit_log(entity_type, entity_id, created_at DESC);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'crm_companies', 'crm_contacts', 'crm_contact_roles', 'crm_channel_permissions',
    'crm_opportunities', 'crm_campaigns', 'crm_enrollments', 'crm_touches',
    'crm_replies', 'crm_meetings', 'crm_tasks', 'crm_conversions',
    'crm_revenue_events', 'crm_attribution_touches', 'market_signals',
    'strategy_score_changes', 'data_rights_requests', 'data_deletion_runs',
    'crm_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT TO authenticated USING (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE TO authenticated USING (private.vestblock_is_admin()) WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users can view their own data rights requests" ON public.data_rights_requests;
CREATE POLICY "Users can view their own data rights requests"
  ON public.data_rights_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE UPDATE, DELETE ON public.crm_audit_log FROM authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'crm_companies', 'crm_contacts', 'crm_contact_roles', 'crm_channel_permissions',
    'crm_opportunities', 'crm_campaigns', 'crm_enrollments', 'crm_meetings',
    'crm_tasks', 'data_rights_requests'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch_updated_at ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END $$;

COMMENT ON COLUMN public.crm_contacts.dedupe_key IS 'Deterministic server-generated identity key. Never derive it client-side or expose it in URLs.';
COMMENT ON TABLE public.market_signals IS 'Structured facts and concise summaries only; do not store copied article bodies.';
COMMENT ON TABLE public.crm_audit_log IS 'Append-only CRM audit trail. Personal data must be minimized in before/after JSON.';
