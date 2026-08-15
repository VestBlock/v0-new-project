-- Gate 3A: canonical portfolio and operating-strategy registry.
-- This migration is intentionally additive. It preserves every legacy raw
-- strategy key and keeps all external sending disabled.

CREATE TABLE public.strategy_portfolios (
  portfolio_key TEXT PRIMARY KEY CHECK (portfolio_key ~ '^[a-z0-9_]+$'),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  governance_status TEXT NOT NULL CHECK (governance_status IN ('proposed', 'approved', 'retired')),
  external_send_cap INTEGER NOT NULL DEFAULT 0 CHECK (external_send_cap = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.strategy_portfolios(portfolio_key, title, governance_status)
VALUES
  ('capital_funding', 'Capital and funding', 'approved'),
  ('real_estate_buyers_investors', 'Real estate buyers and investors', 'approved'),
  ('seller_property_acquisition', 'Sellers and property acquisition', 'approved'),
  ('lenders_capital_providers', 'Lenders and capital providers', 'approved'),
  ('real_estate_professionals_providers', 'Real estate professionals and providers', 'approved'),
  ('business_buyers_sellers', 'Business buyers and sellers', 'approved'),
  ('next_move_roadmaps', 'Next Move financial roadmaps', 'approved'),
  ('dealvault_opportunities', 'DealVault opportunities', 'approved'),
  ('partnerships_referrals', 'Partnerships and referrals', 'approved'),
  ('content_visibility', 'Content and visibility', 'approved'),
  ('public_sector_opportunities', 'Public-sector opportunities', 'proposed'),
  ('customer_lifecycle_growth', 'Customer lifecycle growth', 'proposed');

ALTER TABLE public.strategy_lane_versions
  ADD CONSTRAINT strategy_lane_versions_portfolio_key_fkey
  FOREIGN KEY (lane_key)
  REFERENCES public.strategy_portfolios(portfolio_key)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS strategy_lane_versions_supersedes_idx
  ON public.strategy_lane_versions(supersedes_id)
  WHERE supersedes_id IS NOT NULL;

WITH seed(lane_key, title, objective, target_customer, customer_path, conversion_event) AS (
  VALUES
    (
      'public_sector_opportunities',
      'Public-sector opportunities',
      'Help qualified organizations prepare for public-sector opportunities without implying award eligibility or selection.',
      'Businesses and service providers evaluating public-sector readiness.',
      'Opportunity education, readiness review, operator verification, and a documented bid or no-bid decision.',
      'Operator-approved readiness decision'
    ),
    (
      'customer_lifecycle_growth',
      'Customer lifecycle growth',
      'Coordinate permissioned next steps across VestBlock while each receiving strategy retains responsibility for its own communication and outcome.',
      'VestBlock customers and participants with an unfinished or newly eligible next step.',
      'Internal eligibility assessment, proposal or task creation, and one idempotent handoff to the receiving strategy.',
      'Receiving strategy accepts an eligible handoff'
    )
)
INSERT INTO public.strategy_lane_versions(
  lane_key,
  version,
  title,
  status,
  contract_json,
  source_provenance_json
)
SELECT
  lane_key,
  1,
  title,
  'draft',
  jsonb_build_object(
    'objective', objective,
    'targetCustomer', target_customer,
    'qualificationCriteria', jsonb_build_array('Verified role or customer request', 'Required intake fields complete', 'No permission or suppression conflict'),
    'approvedDataSources', jsonb_build_array('customer-submitted records', 'operator-reviewed CRM records', 'timestamped approved source evidence'),
    'recommendedCustomerPath', customer_path,
    'outreachMethods', jsonb_build_array('website_notification', 'operator_task', 'no_outreach'),
    'consentOrLawfulBasis', jsonb_build_array('customer request or explicit matching permission', 'operator review before any external contact'),
    'exclusionsAndSuppressions', jsonb_build_array('global suppression list', 'withdrawn or private records', 'identity or permission conflict', 'unsupported eligibility or outcome claims'),
    'primaryConversionEvent', conversion_event,
    'kpis', jsonb_build_array('eligible records', 'operator reviews', 'accepted handoffs', 'verified customer progression'),
    'costAndCapacityLimits', jsonb_build_object('defaultMode', 'no_send', 'dailyExternalCap', 0, 'requiresOperatorCapacityCheck', true),
    'failureConditions', jsonb_build_array('missing permission', 'stale evidence', 'unverified claim', 'ambiguous strategy ownership'),
    'humanReviewRequirements', jsonb_build_array('portfolio approval', 'material contract change', 'external outreach activation', 'financial or public-sector claim'),
    'experimentHypothesis', 'Explicit eligibility, ownership, and handoff rules will improve qualified progression without creating duplicate or unsupported outreach.',
    'learningWindowDays', 30,
    'versionDecisionRule', jsonb_build_object('promote', 'verified progress with no guardrail regression', 'revise', 'mixed evidence or correctable failure', 'retire', 'material compliance failure or two windows without qualified progress')
  ),
  jsonb_build_array(jsonb_build_object('source', 'Gate 2 canonical strategy registry', 'kind', 'operator-approved proposal', 'observedAt', NOW()))
FROM seed
ON CONFLICT (lane_key, version) DO NOTHING;

CREATE TABLE public.strategy_execution_owners (
  owner_key TEXT PRIMARY KEY CHECK (owner_key ~ '^[a-z0-9_]+$'),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('application', 'orchestrator', 'human', 'disabled')),
  dispatch_capable BOOLEAN NOT NULL DEFAULT FALSE,
  crm_authority BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.strategy_execution_owners(owner_key, title, owner_kind, dispatch_capable, crm_authority, enabled)
VALUES
  ('vestblock_crm', 'VestBlock CRM', 'application', FALSE, TRUE, TRUE),
  ('vestblock_application', 'VestBlock application', 'application', FALSE, FALSE, TRUE),
  ('operator_manual', 'VestBlock operator', 'human', FALSE, FALSE, TRUE),
  ('n8n_signed_bridge', 'n8n signed orchestration bridge', 'orchestrator', FALSE, FALSE, TRUE),
  ('disabled', 'Disabled owner', 'disabled', FALSE, FALSE, FALSE);

CREATE TABLE public.operating_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_key TEXT NOT NULL UNIQUE CHECK (strategy_key ~ '^[a-z0-9_]+$'),
  portfolio_key TEXT NOT NULL REFERENCES public.strategy_portfolios(portfolio_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  UNIQUE (id, portfolio_key)
);

CREATE INDEX operating_strategies_portfolio_idx
  ON public.operating_strategies(portfolio_key, strategy_key);

CREATE TABLE public.operating_strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  execution_mode TEXT NOT NULL DEFAULT 'no_send' CHECK (execution_mode IN ('inactive', 'internal_only', 'no_send', 'internal_test', 'approved_live')),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  destination_mode TEXT NOT NULL CHECK (destination_mode IN ('public_route', 'internal_only', 'unresolved')),
  destination_path TEXT,
  cta_label TEXT,
  contract_json JSONB NOT NULL CHECK (jsonb_typeof(contract_json) = 'object'),
  lifecycle_contract_json JSONB NOT NULL CHECK (jsonb_typeof(lifecycle_contract_json) = 'object'),
  owner_contract_json JSONB NOT NULL CHECK (jsonb_typeof(owner_contract_json) = 'object'),
  outcome_contract_json JSONB NOT NULL CHECK (jsonb_typeof(outcome_contract_json) = 'object'),
  source_provenance_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_provenance_json) = 'array'),
  crm_owner_key TEXT NOT NULL REFERENCES public.strategy_execution_owners(owner_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  automation_owner_key TEXT NOT NULL REFERENCES public.strategy_execution_owners(owner_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  external_send_cap INTEGER NOT NULL DEFAULT 0 CHECK (
    external_send_cap >= 0
    AND (execution_mode = 'approved_live' OR external_send_cap = 0)
  ),
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  supersedes_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operating_strategy_id, version),
  UNIQUE (id, operating_strategy_id),
  CONSTRAINT operating_strategy_versions_destination_shape_check CHECK (
    (destination_mode = 'public_route' AND destination_path ~ '^/' AND length(btrim(cta_label)) > 0)
    OR (destination_mode IN ('internal_only', 'unresolved') AND destination_path IS NULL AND cta_label IS NULL)
  ),
  CONSTRAINT operating_strategy_versions_supersedes_self_check CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  CONSTRAINT operating_strategy_versions_supersedes_same_strategy_fkey
    FOREIGN KEY (supersedes_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE UNIQUE INDEX operating_strategy_versions_one_active_idx
  ON public.operating_strategy_versions(operating_strategy_id)
  WHERE status = 'active';
CREATE INDEX operating_strategy_versions_status_idx
  ON public.operating_strategy_versions(status, operating_strategy_id, version DESC);
CREATE INDEX operating_strategy_versions_supersedes_idx
  ON public.operating_strategy_versions(supersedes_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX operating_strategy_versions_crm_owner_idx
  ON public.operating_strategy_versions(crm_owner_key);
CREATE INDEX operating_strategy_versions_automation_owner_idx
  ON public.operating_strategy_versions(automation_owner_key);

CREATE TABLE public.operating_strategy_version_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version_id UUID NOT NULL REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'approved', 'activated', 'retired', 'rejected')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX operating_strategy_version_events_strategy_idx
  ON public.operating_strategy_version_events(operating_strategy_id, created_at DESC);
CREATE INDEX operating_strategy_version_events_version_idx
  ON public.operating_strategy_version_events(version_id, created_at DESC);

CREATE TABLE public.strategy_identifier_crosswalk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_namespace TEXT NOT NULL CHECK (source_namespace ~ '^[a-z0-9_]+$'),
  source_identifier TEXT NOT NULL CHECK (length(btrim(source_identifier)) > 0),
  identifier_kind TEXT NOT NULL CHECK (identifier_kind IN ('operating_strategy', 'source_tactic', 'segment', 'journey', 'recommendation_tag', 'legacy_alias')),
  portfolio_key TEXT NOT NULL REFERENCES public.strategy_portfolios(portfolio_key) ON UPDATE RESTRICT ON DELETE RESTRICT,
  operating_strategy_id UUID,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('unresolved', 'historical', 'current', 'retired')),
  allows_new_activity BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source_provenance_json JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_provenance_json) = 'array'),
  approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_namespace, source_identifier, valid_from),
  CONSTRAINT strategy_identifier_crosswalk_valid_window_check CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT strategy_identifier_crosswalk_new_activity_check CHECK (
    NOT allows_new_activity
    OR (resolution_status = 'current' AND operating_strategy_id IS NOT NULL AND valid_to IS NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT strategy_identifier_crosswalk_strategy_parent_fkey
    FOREIGN KEY (operating_strategy_id, portfolio_key)
    REFERENCES public.operating_strategies(id, portfolio_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE UNIQUE INDEX strategy_identifier_crosswalk_one_current_idx
  ON public.strategy_identifier_crosswalk(source_namespace, source_identifier)
  WHERE resolution_status = 'current' AND valid_to IS NULL;
CREATE INDEX strategy_identifier_crosswalk_strategy_idx
  ON public.strategy_identifier_crosswalk(operating_strategy_id, resolution_status);
CREATE INDEX strategy_identifier_crosswalk_portfolio_idx
  ON public.strategy_identifier_crosswalk(portfolio_key, resolution_status);

ALTER TABLE public.command_center_strategy_runs
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT;

ALTER TABLE public.strategy_lead_memberships
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT;

CREATE INDEX IF NOT EXISTS command_center_strategy_runs_operating_version_idx
  ON public.command_center_strategy_runs(operating_strategy_version_id)
  WHERE operating_strategy_version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS strategy_lead_memberships_operating_version_idx
  ON public.strategy_lead_memberships(operating_strategy_version_id)
  WHERE operating_strategy_version_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.gate3a_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER strategy_portfolios_touch_updated_at
BEFORE UPDATE ON public.strategy_portfolios
FOR EACH ROW EXECUTE FUNCTION private.gate3a_touch_updated_at();

CREATE TRIGGER operating_strategies_touch_updated_at
BEFORE UPDATE ON public.operating_strategies
FOR EACH ROW EXECUTE FUNCTION private.gate3a_touch_updated_at();

CREATE TRIGGER operating_strategy_versions_touch_updated_at
BEFORE UPDATE ON public.operating_strategy_versions
FOR EACH ROW EXECUTE FUNCTION private.gate3a_touch_updated_at();

CREATE TRIGGER strategy_identifier_crosswalk_touch_updated_at
BEFORE UPDATE ON public.strategy_identifier_crosswalk
FOR EACH ROW EXECUTE FUNCTION private.gate3a_touch_updated_at();

CREATE OR REPLACE FUNCTION private.gate3a_guard_operating_strategy_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.strategy_key IS DISTINCT FROM OLD.strategy_key
    OR NEW.portfolio_key IS DISTINCT FROM OLD.portfolio_key THEN
    RAISE EXCEPTION 'Operating strategy key and parent portfolio are immutable.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_guard_operating_strategy_identity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER operating_strategies_identity_guard
BEFORE UPDATE ON public.operating_strategies
FOR EACH ROW EXECUTE FUNCTION private.gate3a_guard_operating_strategy_identity();

CREATE OR REPLACE FUNCTION private.gate3a_assert_operating_strategy_version(
  p_version public.operating_strategy_versions
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  parent_status TEXT;
  crm_enabled BOOLEAN;
  crm_authority BOOLEAN;
  automation_enabled BOOLEAN;
BEGIN
  SELECT portfolio.governance_status
    INTO parent_status
  FROM public.operating_strategies strategy
  JOIN public.strategy_portfolios portfolio
    ON portfolio.portfolio_key = strategy.portfolio_key
  WHERE strategy.id = p_version.operating_strategy_id;

  IF parent_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'The parent portfolio must be approved before activation.' USING ERRCODE = '23514';
  END IF;

  IF p_version.destination_mode = 'unresolved' THEN
    RAISE EXCEPTION 'An unresolved destination cannot be activated.' USING ERRCODE = '23514';
  END IF;
  IF p_version.destination_mode = 'public_route'
    AND (p_version.destination_path !~ '^/' OR NULLIF(btrim(p_version.cta_label), '') IS NULL) THEN
    RAISE EXCEPTION 'A public strategy requires a valid destination and CTA.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    p_version.contract_json ?& ARRAY[
      'objective', 'targetParticipant', 'problem', 'valueExchange',
      'eligibilityCriteria', 'disqualificationCriteria', 'sourceData',
      'primaryChannels', 'secondaryChannels', 'followupCadence',
      'humanApprovalPoints', 'complianceLimits', 'learningInputs',
      'failureConditions', 'stopRules', 'handoffRules', 'versionDecisionRule'
    ]
  ) THEN
    RAISE EXCEPTION 'The operating contract is incomplete.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    p_version.lifecycle_contract_json ?& ARRAY[
      'states', 'initialState', 'terminalStates', 'transitions', 'cadence', 'stopConditions'
    ]
  )
    OR jsonb_array_length(COALESCE(p_version.lifecycle_contract_json -> 'states', '[]'::jsonb)) = 0
    OR jsonb_array_length(COALESCE(p_version.lifecycle_contract_json -> 'terminalStates', '[]'::jsonb)) = 0
    OR jsonb_array_length(COALESCE(p_version.lifecycle_contract_json -> 'transitions', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'The CRM lifecycle contract is incomplete.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    p_version.owner_contract_json ?& ARRAY[
      'crmAuthority', 'automationRole', 'dispatchAuthority', 'handoffRules'
    ]
  ) THEN
    RAISE EXCEPTION 'The owner contract is incomplete.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
    p_version.outcome_contract_json ?& ARRAY[
      'primaryConversionEvent', 'leadingIndicators', 'businessValue',
      'learningInputs', 'learningWindowDays', 'minimumExposure',
      'attributionDimensions', 'stopConditions'
    ]
  )
    OR COALESCE((p_version.outcome_contract_json ->> 'learningWindowDays')::INTEGER, 0) < 1
    OR COALESCE((p_version.outcome_contract_json ->> 'minimumExposure')::INTEGER, 0) < 1 THEN
    RAISE EXCEPTION 'The outcome contract is incomplete.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(p_version.source_provenance_json) = 0 THEN
    RAISE EXCEPTION 'Source provenance is required before activation.' USING ERRCODE = '23514';
  END IF;
  IF p_version.approved_at IS NULL OR p_version.approved_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Operator approval is required before activation.' USING ERRCODE = '23514';
  END IF;

  SELECT owner.enabled, owner.crm_authority
    INTO crm_enabled, crm_authority
  FROM public.strategy_execution_owners owner
  WHERE owner.owner_key = p_version.crm_owner_key;
  IF NOT COALESCE(crm_enabled, FALSE) OR NOT COALESCE(crm_authority, FALSE) THEN
    RAISE EXCEPTION 'The CRM owner must be enabled and authoritative.' USING ERRCODE = '23514';
  END IF;

  SELECT owner.enabled
    INTO automation_enabled
  FROM public.strategy_execution_owners owner
  WHERE owner.owner_key = p_version.automation_owner_key;
  IF NOT COALESCE(automation_enabled, FALSE) OR p_version.automation_owner_key = 'disabled' THEN
    RAISE EXCEPTION 'The automation owner must be enabled.' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.gate3a_guard_operating_strategy_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  predecessor_version INTEGER;
  predecessor_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('active', 'retired') THEN
    IF NEW.operating_strategy_id IS DISTINCT FROM OLD.operating_strategy_id
      OR NEW.version IS DISTINCT FROM OLD.version
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.execution_mode IS DISTINCT FROM OLD.execution_mode
      OR NEW.destination_mode IS DISTINCT FROM OLD.destination_mode
      OR NEW.destination_path IS DISTINCT FROM OLD.destination_path
      OR NEW.cta_label IS DISTINCT FROM OLD.cta_label
      OR NEW.contract_json IS DISTINCT FROM OLD.contract_json
      OR NEW.lifecycle_contract_json IS DISTINCT FROM OLD.lifecycle_contract_json
      OR NEW.owner_contract_json IS DISTINCT FROM OLD.owner_contract_json
      OR NEW.outcome_contract_json IS DISTINCT FROM OLD.outcome_contract_json
      OR NEW.source_provenance_json IS DISTINCT FROM OLD.source_provenance_json
      OR NEW.crm_owner_key IS DISTINCT FROM OLD.crm_owner_key
      OR NEW.automation_owner_key IS DISTINCT FROM OLD.automation_owner_key
      OR NEW.external_send_cap IS DISTINCT FROM OLD.external_send_cap
      OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN
      RAISE EXCEPTION 'Active and retired operating contracts are immutable.' USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'retired' AND NEW.status IS DISTINCT FROM 'retired' THEN
      RAISE EXCEPTION 'A retired operating version cannot be reopened.' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'retired') THEN
      RAISE EXCEPTION 'An active operating version can only remain active or retire.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'active' THEN
    PERFORM private.gate3a_assert_operating_strategy_version(NEW);
    IF NEW.activated_at IS NULL THEN
      RAISE EXCEPTION 'An active operating version needs an activation timestamp.' USING ERRCODE = '23514';
    END IF;
    IF NEW.version = 1 AND NEW.supersedes_id IS NOT NULL THEN
      RAISE EXCEPTION 'The first operating version cannot supersede another version.' USING ERRCODE = '23514';
    ELSIF NEW.version > 1 THEN
      SELECT prior.version, prior.status
        INTO predecessor_version, predecessor_status
      FROM public.operating_strategy_versions prior
      WHERE prior.id = NEW.supersedes_id
        AND prior.operating_strategy_id = NEW.operating_strategy_id;
      IF predecessor_version IS DISTINCT FROM NEW.version - 1 OR predecessor_status IS DISTINCT FROM 'retired' THEN
        RAISE EXCEPTION 'An active operating version must supersede the immediately prior retired version.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF NEW.status = 'retired' AND NEW.retired_at IS NULL THEN
    RAISE EXCEPTION 'A retired operating version needs a retirement timestamp.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_guard_operating_strategy_version() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER operating_strategy_versions_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_versions
FOR EACH ROW EXECUTE FUNCTION private.gate3a_guard_operating_strategy_version();

CREATE OR REPLACE FUNCTION private.gate3a_guard_crosswalk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  mapped_portfolio TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.source_namespace IS DISTINCT FROM OLD.source_namespace
      OR NEW.source_identifier IS DISTINCT FROM OLD.source_identifier
      OR NEW.identifier_kind IS DISTINCT FROM OLD.identifier_kind
      OR NEW.portfolio_key IS DISTINCT FROM OLD.portfolio_key
      OR NEW.operating_strategy_id IS DISTINCT FROM OLD.operating_strategy_id
      OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
      OR NEW.source_provenance_json IS DISTINCT FROM OLD.source_provenance_json
      OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Crosswalk identity and mapping history are immutable; close the row and insert a successor.' USING ERRCODE = '23514';
    END IF;
    IF OLD.resolution_status <> 'current'
      AND (
        NEW.resolution_status IS DISTINCT FROM OLD.resolution_status
        OR NEW.allows_new_activity IS DISTINCT FROM OLD.allows_new_activity
        OR NEW.valid_to IS DISTINCT FROM OLD.valid_to
      ) THEN
      RAISE EXCEPTION 'Closed, unresolved, and historical crosswalk rows are immutable.' USING ERRCODE = '23514';
    END IF;
    IF OLD.resolution_status = 'current'
      AND NEW.resolution_status IS DISTINCT FROM 'current'
      AND (
        NEW.resolution_status NOT IN ('historical', 'retired')
        OR NEW.valid_to IS NULL
        OR NEW.allows_new_activity
      ) THEN
      RAISE EXCEPTION 'A current mapping can only close as historical or retired with new activity disabled.' USING ERRCODE = '23514';
    END IF;
    IF OLD.resolution_status = 'current'
      AND NEW.resolution_status = 'current'
      AND (
        NEW.allows_new_activity IS DISTINCT FROM OLD.allows_new_activity
        OR NEW.valid_to IS DISTINCT FROM OLD.valid_to
      ) THEN
      RAISE EXCEPTION 'Change a current mapping by closing it and inserting a successor.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.operating_strategy_id IS NOT NULL THEN
    SELECT strategy.portfolio_key INTO mapped_portfolio
    FROM public.operating_strategies strategy
    WHERE strategy.id = NEW.operating_strategy_id;
    IF mapped_portfolio IS DISTINCT FROM NEW.portfolio_key THEN
      RAISE EXCEPTION 'A crosswalk mapping must use the operating strategy parent portfolio.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.resolution_status = 'current' AND (
    NEW.operating_strategy_id IS NULL
    OR NEW.valid_to IS NOT NULL
    OR NEW.approved_at IS NULL
    OR jsonb_array_length(NEW.source_provenance_json) = 0
  ) THEN
    RAISE EXCEPTION 'A current mapping needs one strategy, an open window, approval, and provenance.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_guard_crosswalk() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER strategy_identifier_crosswalk_guard
BEFORE INSERT OR UPDATE ON public.strategy_identifier_crosswalk
FOR EACH ROW EXECUTE FUNCTION private.gate3a_guard_crosswalk();

CREATE OR REPLACE FUNCTION public.validate_operating_strategy_version(p_version_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  candidate public.operating_strategy_versions;
BEGIN
  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operating strategy version not found.' USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3a_assert_operating_strategy_version(candidate);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_operating_strategy_version(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_operating_strategy_version(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_operating_strategy_version(
  p_version_id UUID,
  p_actor_user_id UUID
)
RETURNS SETOF public.operating_strategy_versions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  candidate public.operating_strategy_versions;
  current_version public.operating_strategy_versions;
  expected_version INTEGER;
  activated public.operating_strategy_versions;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'An operator actor is required.' USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_version_id
  FOR UPDATE;
  IF NOT FOUND OR candidate.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft operating version can be activated.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.operating_strategies strategy
  WHERE strategy.id = candidate.operating_strategy_id
  FOR UPDATE;

  SELECT version.* INTO current_version
  FROM public.operating_strategy_versions version
  WHERE version.operating_strategy_id = candidate.operating_strategy_id
    AND version.status = 'active'
  FOR UPDATE;

  expected_version := COALESCE(current_version.version + 1, 1);
  IF candidate.version <> expected_version THEN
    RAISE EXCEPTION 'Operating strategy versions must activate sequentially.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.operating_strategy_versions
  SET approved_by_user_id = p_actor_user_id,
      approved_at = COALESCE(approved_at, NOW())
  WHERE id = candidate.id
  RETURNING * INTO candidate;

  PERFORM public.validate_operating_strategy_version(candidate.id);

  IF current_version.id IS NOT NULL THEN
    UPDATE public.operating_strategy_versions
    SET status = 'retired', retired_at = NOW()
    WHERE id = current_version.id;
    INSERT INTO public.operating_strategy_version_events(
      operating_strategy_id, version_id, event_type, actor_user_id, metadata_json
    ) VALUES (
      candidate.operating_strategy_id,
      current_version.id,
      'retired',
      p_actor_user_id,
      jsonb_build_object('supersededByVersionId', candidate.id)
    );
  END IF;

  UPDATE public.operating_strategy_versions
  SET status = 'active',
      activated_at = NOW(),
      supersedes_id = current_version.id
  WHERE id = candidate.id
  RETURNING * INTO activated;

  INSERT INTO public.operating_strategy_version_events(
    operating_strategy_id, version_id, event_type, actor_user_id, metadata_json
  ) VALUES (
    activated.operating_strategy_id,
    activated.id,
    'activated',
    p_actor_user_id,
    jsonb_build_object('version', activated.version, 'supersedesId', activated.supersedes_id)
  );

  RETURN NEXT activated;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_operating_strategy_version(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_operating_strategy_version(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_strategy_lane_version(
  p_version_id UUID,
  p_actor_user_id UUID
)
RETURNS SETOF public.strategy_lane_versions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  candidate public.strategy_lane_versions;
  current_version public.strategy_lane_versions;
  expected_version INTEGER;
  activated public.strategy_lane_versions;
  parent_status TEXT;
  required_contract_keys TEXT[] := ARRAY[
    'objective', 'targetCustomer', 'qualificationCriteria', 'approvedDataSources',
    'recommendedCustomerPath', 'outreachMethods', 'consentOrLawfulBasis',
    'exclusionsAndSuppressions', 'primaryConversionEvent', 'kpis',
    'costAndCapacityLimits', 'failureConditions', 'humanReviewRequirements',
    'experimentHypothesis', 'learningWindowDays', 'versionDecisionRule'
  ];
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'An operator actor is required.' USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO candidate
  FROM public.strategy_lane_versions version
  WHERE version.id = p_version_id
  FOR UPDATE;
  IF NOT FOUND OR candidate.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft portfolio version can be activated.' USING ERRCODE = '23514';
  END IF;

  SELECT portfolio.governance_status INTO parent_status
  FROM public.strategy_portfolios portfolio
  WHERE portfolio.portfolio_key = candidate.lane_key
  FOR UPDATE;
  IF parent_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'The portfolio must be approved before activation.' USING ERRCODE = '23514';
  END IF;

  IF NOT (candidate.contract_json ?& required_contract_keys)
    OR jsonb_array_length(candidate.source_provenance_json) = 0 THEN
    RAISE EXCEPTION 'The portfolio contract or provenance is incomplete.' USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO current_version
  FROM public.strategy_lane_versions version
  WHERE version.lane_key = candidate.lane_key
    AND version.status = 'active'
  FOR UPDATE;

  expected_version := COALESCE(current_version.version + 1, 1);
  IF candidate.version <> expected_version THEN
    RAISE EXCEPTION 'Portfolio versions must activate sequentially.' USING ERRCODE = '23514';
  END IF;

  IF current_version.id IS NOT NULL THEN
    UPDATE public.strategy_lane_versions
    SET status = 'retired', updated_at = NOW()
    WHERE id = current_version.id;
  END IF;

  UPDATE public.strategy_lane_versions
  SET status = 'active',
      approved_by_user_id = p_actor_user_id,
      approved_at = COALESCE(approved_at, NOW()),
      supersedes_id = current_version.id,
      updated_at = NOW()
  WHERE id = candidate.id
  RETURNING * INTO activated;

  RETURN NEXT activated;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_strategy_lane_version(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_strategy_lane_version(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_operating_strategy_identifier(
  p_source_namespace TEXT,
  p_source_identifier TEXT,
  p_as_of TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  portfolio_key TEXT,
  strategy_key TEXT,
  operating_strategy_id UUID,
  operating_strategy_version_id UUID,
  operating_strategy_version INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  match_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO match_count
  FROM public.strategy_identifier_crosswalk crosswalk
  JOIN public.operating_strategies strategy
    ON strategy.id = crosswalk.operating_strategy_id
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.status = 'active'
  WHERE crosswalk.source_namespace = p_source_namespace
    AND crosswalk.source_identifier = p_source_identifier
    AND crosswalk.resolution_status = 'current'
    AND crosswalk.allows_new_activity
    AND crosswalk.approved_at IS NOT NULL
    AND crosswalk.valid_from <= p_as_of
    AND (crosswalk.valid_to IS NULL OR crosswalk.valid_to > p_as_of);

  IF match_count <> 1 THEN
    RAISE EXCEPTION 'Unknown, inactive, or ambiguous strategy identifier: %:%', p_source_namespace, p_source_identifier
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT
    crosswalk.portfolio_key,
    strategy.strategy_key,
    strategy.id,
    version.id,
    version.version
  FROM public.strategy_identifier_crosswalk crosswalk
  JOIN public.operating_strategies strategy
    ON strategy.id = crosswalk.operating_strategy_id
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.status = 'active'
  WHERE crosswalk.source_namespace = p_source_namespace
    AND crosswalk.source_identifier = p_source_identifier
    AND crosswalk.resolution_status = 'current'
    AND crosswalk.allows_new_activity
    AND crosswalk.approved_at IS NOT NULL
    AND crosswalk.valid_from <= p_as_of
    AND (crosswalk.valid_to IS NULL OR crosswalk.valid_to > p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_operating_strategy_identifier(TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operating_strategy_identifier(TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

INSERT INTO public.operating_strategies(strategy_key, portfolio_key, title)
VALUES
  ('capital_readiness_intake', 'capital_funding', 'Capital readiness intake'),
  ('seller_options_intake', 'seller_property_acquisition', 'Seller options intake'),
  ('property_opportunity_discovery', 'seller_property_acquisition', 'Property opportunity discovery'),
  ('buyer_buy_box_activation', 'real_estate_buyers_investors', 'Buyer buy-box activation'),
  ('lender_provider_criteria', 'lenders_capital_providers', 'Lender and provider criteria'),
  ('next_move_free_roadmap', 'next_move_roadmaps', 'Free Next Move roadmap'),
  ('credit_education_support', 'next_move_roadmaps', 'Credit education and support'),
  ('business_formation_readiness', 'next_move_roadmaps', 'Business formation readiness'),
  ('dealvault_activation', 'dealvault_opportunities', 'DealVault activation'),
  ('service_provider_network', 'real_estate_professionals_providers', 'Service-provider network'),
  ('partner_referral_network', 'partnerships_referrals', 'Partner referral network'),
  ('investor_capital_relationships', 'lenders_capital_providers', 'Investor and capital relationships'),
  ('public_sector_opportunity_readiness', 'public_sector_opportunities', 'Public-sector opportunity readiness'),
  ('professional_participant_activation', 'customer_lifecycle_growth', 'Professional participant activation'),
  ('content_authority_intelligence', 'content_visibility', 'Content authority and intelligence'),
  ('customer_lifecycle_orchestration', 'customer_lifecycle_growth', 'Customer lifecycle orchestration'),
  ('business_acquisition_network', 'business_buyers_sellers', 'Business acquisition network');

WITH seed(
  strategy_key,
  execution_mode,
  destination_mode,
  destination_path,
  cta_label,
  objective,
  target_participant,
  problem,
  value_exchange,
  crm_owner_key,
  automation_owner_key,
  primary_conversion_event,
  business_value,
  handoff_rules
) AS (
  VALUES
    (
      'capital_readiness_intake', 'no_send', 'public_route', '/capital', 'Review my capital path',
      'Turn a stated capital objective into a complete, reviewable readiness case without representing a lender or promising approval.',
      'Business owners, property operators, acquisition buyers, and grant seekers with a defined use of funds.',
      'Capital requests often reach providers before the purpose, timing, records, and constraints are organized.',
      'A structured readiness review, documented gaps, and an appropriate next-step path.',
      'vestblock_crm', 'vestblock_application', 'Completed qualified capital intake',
      'More provider-review-ready cases with fewer preventable document and fit gaps.',
      '["Capital strategy owns readiness through provider-review eligibility.","Any provider introduction requires a separate permissioned handoff."]'::jsonb
    ),
    (
      'seller_options_intake', 'no_send', 'public_route', '/sell', 'Review my sale path',
      'Help an owner or authorized representative organize property, timing, condition, and priorities for an operator-reviewed sale path.',
      'Property owners or authorized representatives who request help understanding sale or transition options.',
      'Owners need a clear path without pressure, unsupported valuation claims, or a one-size-fits-all offer.',
      'A private seller case, an options review, and a documented operator next step.',
      'vestblock_crm', 'vestblock_application', 'Qualified seller case accepted for operator review',
      'More complete, permissioned seller cases that progress to a credible reviewed option.',
      '["Seller intake owns customer-submitted case preparation.","Sourced-property tactics hand off only after identity, permission, and suppression review."]'::jsonb
    ),
    (
      'property_opportunity_discovery', 'no_send', 'public_route', '/real-estate', 'Explore real estate paths',
      'Identify and qualify property signals from approved, timestamped sources before any operator-reviewed outreach or matching decision.',
      'VestBlock operators evaluating property opportunities for sellers, buyers, builders, and investors.',
      'Raw property signals are noisy, age quickly, and can create duplicate or inappropriate contact when provenance is weak.',
      'A provenance-backed, deduplicated, suppression-checked candidate ready for human review.',
      'vestblock_crm', 'vestblock_application', 'Property candidate accepted for operator review',
      'Higher-quality property inventory with clear provenance and fewer wasted or noncompliant contacts.',
      '["Discovery owns source evidence and qualification.","Seller options owns the customer case after an approved handoff."]'::jsonb
    ),
    (
      'buyer_buy_box_activation', 'no_send', 'public_route', '/workspace/profiles', 'Create my buyer profile',
      'Capture and verify an active buyer buy box so reviewed opportunities can be routed on criteria instead of assumption.',
      'Buyers, acquisition managers, landlords, builders, and investors with current acquisition criteria.',
      'Buyer interest is not actionable when markets, property types, economics, capacity, and no-go criteria are incomplete or stale.',
      'A private criteria profile, verification path, and operator-reviewed opportunity matching.',
      'vestblock_crm', 'vestblock_application', 'Verified buyer profile becomes match-eligible',
      'More active buy boxes and more useful operator-approved matches.',
      '["Participant activation owns draft-to-active profile completion.","Buyer strategy owns criteria refresh and matching only after activation."]'::jsonb
    ),
    (
      'lender_provider_criteria', 'no_send', 'public_route', '/workspace/profiles', 'Add my provider criteria',
      'Maintain current lender and capital-provider criteria for permissioned, operator-reviewed introductions.',
      'Lenders, brokers, CDFIs, private-capital providers, and specialty programs.',
      'Provider lists are not useful without verified geography, products, amounts, exclusions, capacity, and freshness.',
      'A private provider profile, criteria-verification process, and controlled introduction path.',
      'vestblock_crm', 'vestblock_application', 'Verified provider criteria become match-eligible',
      'More current provider coverage and fewer unsuitable introductions.',
      '["Participant activation owns profile completion.","Provider strategy owns criteria refresh and introductions after activation."]'::jsonb
    ),
    (
      'next_move_free_roadmap', 'no_send', 'public_route', '/next-move', 'Build my free roadmap',
      'Create an educational, personalized roadmap that orders a user''s most credible next actions across VestBlock paths.',
      'People and business owners seeking a practical credit, funding, income, property, or opportunity starting point.',
      'Users often have multiple goals but no clear order of operations or realistic preparation sequence.',
      'A free questionnaire, bounded analysis, and a saved action roadmap with transparent limitations.',
      'vestblock_crm', 'vestblock_application', 'Roadmap generated and saved',
      'More customers enter the right path with a usable sequence instead of an unsupported promise.',
      '["Roadmap owns educational sequencing.","Each receiving strategy owns its eligibility, communication, and outcome after an explicit handoff."]'::jsonb
    ),
    (
      'credit_education_support', 'no_send', 'public_route', '/credit-upload', 'Review my credit report',
      'Help customers understand credit-report information and organize educational next steps without guaranteeing score changes, deletions, or approvals.',
      'Customers who voluntarily submit a credit report or request credit education.',
      'Credit reports are difficult to interpret and can lead to risky claims or actions when context and evidence are missing.',
      'A private educational review, issue organization, and customer-controlled action path.',
      'vestblock_crm', 'vestblock_application', 'Customer receives and saves a credit education plan',
      'More informed customers and cleaner readiness files without prohibited credit-repair claims.',
      '["Credit support owns education and customer-selected actions.","Capital strategies receive only a permissioned readiness handoff."]'::jsonb
    ),
    (
      'business_formation_readiness', 'no_send', 'public_route', '/business-setup', 'Build my business foundation',
      'Organize foundational business records and readiness steps before a customer pursues credit, funding, grants, or growth.',
      'Founders and owners preparing an entity, banking, records, offer, and operating foundation.',
      'Funding and growth efforts fail when identity, entity, records, banking, and operating basics are inconsistent.',
      'An educational readiness checklist and a documented route into the appropriate next strategy.',
      'vestblock_crm', 'vestblock_application', 'Business foundation plan completed',
      'More customers reach capital and growth paths with coherent business records.',
      '["Business readiness owns foundation tasks.","Capital or growth strategy accepts only a complete, permissioned handoff."]'::jsonb
    ),
    (
      'dealvault_activation', 'no_send', 'public_route', '/dealvault', 'Explore DealVault',
      'Help qualified users understand and activate DealVault as a record layer for agreements, proof, milestones, and payout references.',
      'Operators, buyers, lenders, partners, and teams coordinating a documented transaction or opportunity.',
      'Deal activity loses continuity when records, proof, milestones, and responsibilities live in disconnected systems.',
      'A demo-first activation path and an organized, access-controlled DealVault record.',
      'vestblock_crm', 'vestblock_application', 'Qualified user creates or adopts a DealVault record',
      'More documented opportunities progress with clear records and fewer coordination gaps.',
      '["DealVault owns record activation and evidence continuity.","Opportunity strategies retain eligibility, claims, and relationship ownership."]'::jsonb
    ),
    (
      'service_provider_network', 'no_send', 'public_route', '/workspace/profiles', 'Create my provider profile',
      'Verify service coverage, role, capacity, and permissions before routing a professional into a customer or transaction need.',
      'Builders, developers, agents, wholesalers, contractors, and transaction or service specialists.',
      'A directory entry alone does not establish fit, credentials, capacity, or customer permission.',
      'A private role-specific profile and an operator-reviewed introduction path.',
      'vestblock_crm', 'vestblock_application', 'Verified provider profile becomes match-eligible',
      'More useful provider coverage and higher-quality completed introductions.',
      '["Participant activation owns profile draft-to-active.","Service-provider strategy owns post-activation criteria and introductions."]'::jsonb
    ),
    (
      'partner_referral_network', 'no_send', 'public_route', '/opportunity', 'Explore partnership paths',
      'Develop transparent reciprocal relationships through verification, a controlled test referral, and measured service quality.',
      'Organizations and professionals with complementary, verifiable capabilities.',
      'Unstructured referral relationships create disclosure, ownership, service-quality, and attribution gaps.',
      'A verified partner record, disclosed test referral, and evidence-based expansion decision.',
      'vestblock_crm', 'operator_manual', 'Approved test referral accepted',
      'More trustworthy customer routes with measurable partner quality.',
      '["Partner strategy owns verification and referral quality.","The receiving customer strategy retains customer consent and lifecycle ownership."]'::jsonb
    ),
    (
      'investor_capital_relationships', 'no_send', 'public_route', '/workspace/profiles', 'Create my investor profile',
      'Capture verified capital interests and constraints for controlled, operator-reviewed opportunity relationships.',
      'Private lenders, equity investors, acquisition operators, institutions, and builders acting as capital relationships.',
      'Capital interest is not matchable without a defined role, geography, criteria, capacity, restrictions, and verification date.',
      'A private investor profile and a permissioned relationship or opportunity review path.',
      'vestblock_crm', 'vestblock_application', 'Verified investor relationship becomes match-eligible',
      'More current capital relationships and fewer unqualified opportunity introductions.',
      '["Participant activation owns profile completion.","Investor relationship strategy owns post-activation criteria and reviewed introductions."]'::jsonb
    ),
    (
      'public_sector_opportunity_readiness', 'no_send', 'public_route', '/opportunity', 'Review opportunity readiness',
      'Organize public-sector readiness and a documented bid or no-bid decision without implying eligibility, award, or government affiliation.',
      'Businesses and service providers evaluating relevant public-sector opportunities.',
      'Opportunity notices are not actionable without eligibility, capability, timing, exclusions, documents, and operator review.',
      'A readiness assessment, sourced opportunity record, and human-approved decision path.',
      'vestblock_crm', 'operator_manual', 'Operator approves a documented readiness decision',
      'Fewer unqualified pursuits and stronger preparation for suitable opportunities.',
      '["Public-sector strategy owns source interpretation and readiness.","No bid submission, representation, or award claim occurs automatically."]'::jsonb
    ),
    (
      'professional_participant_activation', 'no_send', 'public_route', '/workspace/profiles', 'Complete my participant profile',
      'Move a participant profile from private draft through verification to an active, permissioned state.',
      'Buyers, investors, lenders, builders, developers, agents, wholesalers, business participants, and service providers.',
      'Downstream matching is unsafe when identity, criteria, ownership, verification, and permissions are incomplete.',
      'A private profile workflow with explicit matching, outreach, and visibility controls.',
      'vestblock_crm', 'vestblock_application', 'Verified participant profile becomes active',
      'More complete active profiles with clear permission boundaries.',
      '["This strategy exclusively owns draft-to-active profile completion and reminders.","After activation it emits one idempotent handoff and relinquishes dispatch to the receiving strategy."]'::jsonb
    ),
    (
      'content_authority_intelligence', 'no_send', 'public_route', '/opportunity', 'Find my next opportunity',
      'Turn current, sourced industry intelligence into useful VestBlock education and qualified customer-path visits.',
      'Prospective customers and participants seeking clear capital, real-estate, opportunity, or DealVault guidance.',
      'Generic content creates traffic without trust, attribution, or a clear next action.',
      'Accurate educational content connected to a specific, measurable VestBlock destination.',
      'vestblock_crm', 'vestblock_application', 'Qualified visit enters an approved customer path',
      'More attributable customer-path starts from useful, substantiated content.',
      '["Content strategy owns research, claims, publication, and attribution.","Receiving strategies own eligibility and conversion after the destination handoff."]'::jsonb
    ),
    (
      'customer_lifecycle_orchestration', 'internal_only', 'internal_only', NULL, NULL,
      'Detect permissioned unfinished or newly eligible next steps and create one auditable proposal or task for the responsible strategy.',
      'Existing VestBlock customers and participants with a valid lifecycle signal.',
      'Disconnected records can cause stalled journeys, duplicate outreach, or unclear ownership.',
      'An internal eligibility decision and an idempotent handoff proposal with no direct external dispatch.',
      'vestblock_crm', 'vestblock_application', 'Receiving strategy accepts an eligible handoff',
      'More customers progress without duplicate communication or ownership ambiguity.',
      '["Lifecycle orchestration may compute eligibility and create a proposal or operator task only.","It never calls n8n or a channel; the receiving strategy owns message, cadence, destination, dispatch, and outcome."]'::jsonb
    ),
    (
      'business_acquisition_network', 'no_send', 'public_route', '/capital', 'Prepare for a business acquisition',
      'Prepare confidential business-acquisition participants and criteria for controlled review and matching.',
      'Business owners considering a sale and qualified prospective business buyers.',
      'Business acquisition interest is sensitive and unusable without authority, confidentiality, criteria, readiness, and ownership.',
      'A confidential intake, readiness path, and operator-controlled introduction process.',
      'vestblock_crm', 'operator_manual', 'Qualified confidential introduction accepted for review',
      'More reviewable business opportunities with clear confidentiality and ownership.',
      '["Business acquisition strategy owns confidential qualification and matching.","Capital strategy owns financing readiness through a separate permissioned handoff."]'::jsonb
    )
)
INSERT INTO public.operating_strategy_versions(
  operating_strategy_id,
  version,
  status,
  execution_mode,
  title,
  destination_mode,
  destination_path,
  cta_label,
  contract_json,
  lifecycle_contract_json,
  owner_contract_json,
  outcome_contract_json,
  source_provenance_json,
  crm_owner_key,
  automation_owner_key,
  external_send_cap
)
SELECT
  strategy.id,
  1,
  'draft',
  seed.execution_mode,
  strategy.title,
  seed.destination_mode,
  seed.destination_path,
  seed.cta_label,
  jsonb_build_object(
    'objective', seed.objective,
    'targetParticipant', seed.target_participant,
    'problem', seed.problem,
    'valueExchange', seed.value_exchange,
    'eligibilityCriteria', jsonb_build_array('Verified role or customer request', 'Required criteria or intake fields complete', 'No suppression, identity, or permission conflict'),
    'disqualificationCriteria', jsonb_build_array('Unverified identity or authority', 'Missing permission or lawful basis', 'Stale material evidence', 'Unsupported or prohibited claim required'),
    'sourceData', jsonb_build_array('customer-submitted records', 'operator-reviewed CRM records', 'timestamped approved source evidence'),
    'primaryChannels', jsonb_build_array('website_notification', 'operator_task'),
    'secondaryChannels', jsonb_build_array('no_outreach'),
    'followupCadence', jsonb_build_array('Immediate transactional acknowledgement when requested', 'Operator review target: one business day', 'No automated external follow-up in Gate 3A'),
    'humanApprovalPoints', jsonb_build_array('Strategy activation', 'Material contract change', 'External outreach', 'Customer or provider introduction', 'Financial, public-sector, or performance claim'),
    'complianceLimits', jsonb_build_array('No approval, return, funding, score, award, inventory, or closing guarantee', 'Separate marketing, matching, outreach, and visibility permissions', 'Global suppression and stop-on-reply checks before any later dispatch'),
    'learningInputs', jsonb_build_array('source provenance', 'eligibility decision', 'operator review', 'customer progression', 'verified downstream outcome'),
    'failureConditions', jsonb_build_array('Missing consent or lawful basis', 'Stale evidence', 'Identity mismatch', 'Ambiguous owner', 'Unsupported claim', 'Capacity or cost guardrail breach'),
    'stopRules', jsonb_build_array('Stop on withdrawal, suppression, do-not-contact, permission loss, identity conflict, or material compliance failure'),
    'handoffRules', seed.handoff_rules,
    'versionDecisionRule', jsonb_build_object('promote', 'Verified improvement with no guardrail regression', 'revise', 'Mixed evidence or a correctable failure', 'retire', 'Material compliance failure or two completed windows without qualified progress')
  ),
  jsonb_build_object(
    'states', jsonb_build_array('draft', 'submitted', 'needs_information', 'under_review', 'ready', 'active', 'completed', 'declined', 'withdrawn'),
    'initialState', 'draft',
    'terminalStates', jsonb_build_array('completed', 'declined', 'withdrawn'),
    'transitions', jsonb_build_array(
      jsonb_build_object('from', 'draft', 'to', 'submitted', 'event', 'customer_or_operator_submits'),
      jsonb_build_object('from', 'submitted', 'to', 'under_review', 'event', 'operator_accepts_review'),
      jsonb_build_object('from', 'under_review', 'to', 'needs_information', 'event', 'required_information_missing'),
      jsonb_build_object('from', 'needs_information', 'to', 'under_review', 'event', 'information_received'),
      jsonb_build_object('from', 'under_review', 'to', 'ready', 'event', 'eligibility_confirmed'),
      jsonb_build_object('from', 'ready', 'to', 'active', 'event', 'approved_handoff_or_activation'),
      jsonb_build_object('from', 'active', 'to', 'completed', 'event', 'verified_primary_outcome'),
      jsonb_build_object('from', 'draft', 'to', 'withdrawn', 'event', 'customer_withdraws')
    ),
    'cadence', jsonb_build_array('Transactional acknowledgement only', 'Operator review queue', 'No automated external cadence in Gate 3A'),
    'stopConditions', jsonb_build_array('withdrawn', 'declined', 'suppressed', 'permission_revoked', 'identity_conflict')
  ),
  jsonb_build_object(
    'crmAuthority', seed.crm_owner_key,
    'automationRole', seed.automation_owner_key,
    'dispatchAuthority', 'none_in_gate_3a',
    'handoffRules', seed.handoff_rules
  ),
  jsonb_build_object(
    'primaryConversionEvent', seed.primary_conversion_event,
    'leadingIndicators', jsonb_build_array('eligible records', 'complete intakes or profiles', 'operator reviews', 'accepted handoffs'),
    'businessValue', seed.business_value,
    'learningInputs', jsonb_build_array('strategy version', 'source', 'segment', 'destination', 'lifecycle stage', 'verified outcome'),
    'learningWindowDays', 30,
    'minimumExposure', 1,
    'attributionDimensions', jsonb_build_array('portfolio', 'operating strategy version', 'source namespace and identifier', 'customer path', 'owner', 'outcome'),
    'stopConditions', jsonb_build_array('compliance regression', 'complaint or suppression breach', 'duplicate ownership', 'no qualified progress after two completed windows')
  ),
  jsonb_build_array(jsonb_build_object('source', 'Gate 2 canonical strategy registry', 'kind', 'operator-approved draft', 'observedAt', NOW())),
  seed.crm_owner_key,
  seed.automation_owner_key,
  0
FROM seed
JOIN public.operating_strategies strategy
  ON strategy.strategy_key = seed.strategy_key;

INSERT INTO public.operating_strategy_version_events(
  operating_strategy_id,
  version_id,
  event_type,
  metadata_json
)
SELECT
  version.operating_strategy_id,
  version.id,
  'created',
  jsonb_build_object('version', version.version, 'status', version.status, 'gate', '3A')
FROM public.operating_strategy_versions version
WHERE version.version = 1;

WITH seed(
  source_namespace,
  source_identifier,
  identifier_kind,
  strategy_key,
  resolution_status,
  allows_new_activity,
  unresolved_portfolio_key
) AS (
  VALUES
    ('operating_strategy', 'capital_readiness_intake', 'operating_strategy', 'capital_readiness_intake', 'current', TRUE, NULL),
    ('operating_strategy', 'seller_options_intake', 'operating_strategy', 'seller_options_intake', 'current', TRUE, NULL),
    ('operating_strategy', 'property_opportunity_discovery', 'operating_strategy', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('operating_strategy', 'buyer_buy_box_activation', 'operating_strategy', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('operating_strategy', 'lender_provider_criteria', 'operating_strategy', 'lender_provider_criteria', 'current', TRUE, NULL),
    ('operating_strategy', 'next_move_free_roadmap', 'operating_strategy', 'next_move_free_roadmap', 'current', TRUE, NULL),
    ('operating_strategy', 'credit_education_support', 'operating_strategy', 'credit_education_support', 'current', TRUE, NULL),
    ('operating_strategy', 'business_formation_readiness', 'operating_strategy', 'business_formation_readiness', 'current', TRUE, NULL),
    ('operating_strategy', 'dealvault_activation', 'operating_strategy', 'dealvault_activation', 'current', TRUE, NULL),
    ('operating_strategy', 'service_provider_network', 'operating_strategy', 'service_provider_network', 'current', TRUE, NULL),
    ('operating_strategy', 'partner_referral_network', 'operating_strategy', 'partner_referral_network', 'current', TRUE, NULL),
    ('operating_strategy', 'investor_capital_relationships', 'operating_strategy', 'investor_capital_relationships', 'current', TRUE, NULL),
    ('operating_strategy', 'public_sector_opportunity_readiness', 'operating_strategy', 'public_sector_opportunity_readiness', 'current', TRUE, NULL),
    ('operating_strategy', 'professional_participant_activation', 'operating_strategy', 'professional_participant_activation', 'current', TRUE, NULL),
    ('operating_strategy', 'content_authority_intelligence', 'operating_strategy', 'content_authority_intelligence', 'current', TRUE, NULL),
    ('operating_strategy', 'customer_lifecycle_orchestration', 'operating_strategy', 'customer_lifecycle_orchestration', 'current', TRUE, NULL),
    ('operating_strategy', 'business_acquisition_network', 'operating_strategy', 'business_acquisition_network', 'current', TRUE, NULL),

    ('seller_execution', 'preforeclosure-equity', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'tax-code-stack', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'tax-remote-equity-rotation', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'lien-equity', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'probate-vacant-equity', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'portfolio-landlord', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'small-multifamily-portfolio', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'builder-infill-teardown', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'land-wholesale', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'vacant-equity', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('seller_execution', 'seller-finance-free-clear', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'subject-to-low-equity', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'hybrid-equity-bridge', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'novation-retail-equity', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'absentee-equity-creative', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'active-stale-creative', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('seller_execution', 'active-stale-lowball', 'source_tactic', 'seller_options_intake', 'retired', FALSE, NULL),

    ('command_center_autopilot', 'buyer-demand-capture', 'source_tactic', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('command_center_autopilot', 'capital-desk-lender-capture', 'source_tactic', 'lender_provider_criteria', 'current', TRUE, NULL),
    ('command_center_autopilot', 'developer-builder-demand-capture', 'source_tactic', 'service_provider_network', 'current', TRUE, NULL),
    ('command_center_autopilot', 'creative-finance-buyer-capture', 'source_tactic', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('command_center_autopilot', 'tax-code-stack', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'senior-out-of-state-landlord', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'builder-infill-teardown', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'land-wholesale', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'small-multifamily-portfolio', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'institutional-btr-buybox', 'source_tactic', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('command_center_autopilot', 'on-market-lowball-agent-sweep', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'novation-retail-spread', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('command_center_autopilot', 'commercial-small-bay-distress', 'source_tactic', 'property_opportunity_discovery', 'current', TRUE, NULL),
    ('command_center_autopilot', 'stale-listing-creative-finance', 'source_tactic', 'seller_options_intake', 'current', TRUE, NULL),
    ('command_center_autopilot', 'buyer-reverse-engineering', 'source_tactic', 'buyer_buy_box_activation', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'contractor-distress-flip', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'failed-landlord-exit', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'insurance-damage-event', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'judgment-lien-pressure', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'permit-spike-developer-land', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'portfolio-fragmentation', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'rent-gap-multifamily', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'senior-downsizer', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'small-commercial-owner-exit', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'tax-assessment-shock', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'tired-airbnb-midterm', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'utility-lien-water-shutoff', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('command_center_autopilot', 'zombie-rehab', 'source_tactic', 'property_opportunity_discovery', 'historical', FALSE, NULL),

    ('city_scenario', 'divorce-separation-quiet-exit', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'relocation-job-transfer', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'out-of-state-heir-remote-relief', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'senior-downsizing-medical-soft-touch', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'fire-storm-insurance-damage', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'problem-tenant-eviction-relief', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'fsbo-conversion-real-buyer', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'failed-flipper-stuck-rehab', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'hoa-delinquent-association-pressure', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'reverse-mortgage-exit', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'title-issue-cloud-on-title', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'post-auction-backup-buyer', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'attorney-partnership-referral', 'recommendation_tag', 'partner_referral_network', 'historical', FALSE, NULL),
    ('city_scenario', 'neighbor-referral-bird-dog', 'recommendation_tag', 'partner_referral_network', 'historical', FALSE, NULL),
    ('city_scenario', 'preforeclosure-subto-absentee-rental', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'auction-postponed-distress', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'bankruptcy-dismissed-foreclosure-restart', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'eviction-landlord-fatigue', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'utility-shutoff-absentee-landlord', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'small-multifamily-breakup', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'probate-vacant-equity', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'estate-deferred-maintenance', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'tax-delinquent-vacant-improvement', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'tax-delinquent-senior-owner-soft-touch', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'multiple-liens-equity', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'water-lien-absentee-stack', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'code-boarded-fire-damage', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'active-dom90-condition-problem', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'back-on-market-fatigue', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'price-cut-3x-distress', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'teardown-near-infill-demand', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'vacant-lot-tax-lien-builder', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),
    ('city_scenario', 'corner-lot-small-builder', 'recommendation_tag', 'property_opportunity_discovery', 'historical', FALSE, NULL),

    ('next_move_focus', 'business-funding', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('next_move_focus', 'real-estate-funding', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('next_move_focus', 'grants', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('next_move_focus', 'business-credit', 'journey', 'business_formation_readiness', 'historical', FALSE, NULL),
    ('next_move_focus', 'sell-property', 'journey', 'seller_options_intake', 'historical', FALSE, NULL),
    ('next_move_focus', 'buy-property', 'journey', 'buyer_buy_box_activation', 'historical', FALSE, NULL),
    ('next_move_focus', 'fund-deal', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('next_move_focus', 'business-acquisition', 'journey', 'business_acquisition_network', 'historical', FALSE, NULL),
    ('next_move_focus', 'builder-developer', 'journey', 'service_provider_network', 'historical', FALSE, NULL),
    ('next_move_focus', 'improve-credit', 'journey', 'credit_education_support', 'historical', FALSE, NULL),
    ('next_move_focus', 'increase-income', 'journey', 'next_move_free_roadmap', 'historical', FALSE, NULL),
    ('next_move_focus', 'start-business', 'journey', 'business_formation_readiness', 'historical', FALSE, NULL),
    ('next_move_focus', 'grow-business', 'journey', 'business_formation_readiness', 'historical', FALSE, NULL),
    ('next_move_focus', 'visibility', 'journey', 'content_authority_intelligence', 'historical', FALSE, NULL),

    ('capital_path', 'business_funding', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('capital_path', 'real_estate_funding', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('capital_path', 'business_acquisition', 'journey', 'business_acquisition_network', 'historical', FALSE, NULL),
    ('capital_path', 'business_credit', 'journey', 'business_formation_readiness', 'historical', FALSE, NULL),
    ('capital_path', 'grants_programs', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('capital_path', 'capital_provider', 'journey', 'lender_provider_criteria', 'historical', FALSE, NULL),

    ('revenue_campaign', 'dealvault_smart_contracts', 'segment', 'dealvault_activation', 'current', TRUE, NULL),
    ('revenue_campaign', 'ai_receptionist_visibility', 'segment', 'content_authority_intelligence', 'current', TRUE, NULL),
    ('revenue_campaign', 'funding_prep', 'segment', 'capital_readiness_intake', 'current', TRUE, NULL),
    ('revenue_campaign', 'seller_real_estate', 'segment', 'seller_options_intake', 'current', TRUE, NULL),
    ('revenue_campaign', 'other', 'segment', NULL, 'unresolved', FALSE, 'content_visibility'),

    ('platform_scenario', 'business', 'journey', 'capital_readiness_intake', 'historical', FALSE, NULL),
    ('platform_scenario', 'property', 'journey', 'buyer_buy_box_activation', 'historical', FALSE, NULL),
    ('platform_scenario', 'sell', 'journey', 'seller_options_intake', 'historical', FALSE, NULL),
    ('platform_scenario', 'readiness', 'journey', 'next_move_free_roadmap', 'historical', FALSE, NULL),
    ('platform_scenario', 'participate', 'journey', 'professional_participant_activation', 'historical', FALSE, NULL),

    ('legacy_runtime', 'buyer-network', 'legacy_alias', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('legacy_runtime', 'buyer-packet-routing', 'legacy_alias', 'buyer_buy_box_activation', 'current', TRUE, NULL),
    ('legacy_runtime', 'investor-network', 'legacy_alias', 'investor_capital_relationships', 'current', TRUE, NULL),
    ('legacy_runtime', 'lender-network', 'legacy_alias', 'lender_provider_criteria', 'current', TRUE, NULL),
    ('legacy_runtime', 'seller_lead', 'legacy_alias', 'seller_options_intake', 'current', TRUE, NULL),
    ('legacy_runtime', 'global-suppression', 'legacy_alias', NULL, 'unresolved', FALSE, 'customer_lifecycle_growth')
)
INSERT INTO public.strategy_identifier_crosswalk(
  source_namespace,
  source_identifier,
  identifier_kind,
  portfolio_key,
  operating_strategy_id,
  resolution_status,
  allows_new_activity,
  source_provenance_json,
  approved_at
)
SELECT
  seed.source_namespace,
  seed.source_identifier,
  seed.identifier_kind,
  COALESCE(strategy.portfolio_key, seed.unresolved_portfolio_key),
  strategy.id,
  seed.resolution_status,
  seed.allows_new_activity,
  jsonb_build_array(jsonb_build_object(
    'source', 'Gate 2 strategy inventory and Gate 3A approval',
    'kind', 'namespaced compatibility mapping',
    'observedAt', NOW()
  )),
  CASE WHEN seed.resolution_status = 'unresolved' THEN NULL ELSE NOW() END
FROM seed
LEFT JOIN public.operating_strategies strategy
  ON strategy.strategy_key = seed.strategy_key;

ALTER TABLE public.strategy_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_portfolios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_execution_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_execution_owners FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_version_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_version_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_identifier_crosswalk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_identifier_crosswalk FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.strategy_portfolios,
  public.strategy_execution_owners,
  public.operating_strategies,
  public.operating_strategy_versions,
  public.operating_strategy_version_events,
  public.strategy_identifier_crosswalk
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_portfolios TO service_role;
GRANT SELECT ON TABLE public.strategy_execution_owners TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.operating_strategies TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.operating_strategy_versions TO service_role;
GRANT SELECT, INSERT ON TABLE public.operating_strategy_version_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_identifier_crosswalk TO service_role;

GRANT EXECUTE ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  TO service_role;

DO $$
DECLARE
  portfolio_count INTEGER;
  proposed_count INTEGER;
  strategy_count INTEGER;
  version_count INTEGER;
  crosswalk_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO portfolio_count FROM public.strategy_portfolios;
  IF portfolio_count <> 12 THEN
    RAISE EXCEPTION 'Gate 3A expected exactly 12 portfolio IDs; found %.', portfolio_count;
  END IF;

  SELECT COUNT(*)::INTEGER INTO proposed_count
  FROM public.strategy_portfolios
  WHERE governance_status = 'proposed'
    AND portfolio_key IN ('public_sector_opportunities', 'customer_lifecycle_growth');
  IF proposed_count <> 2 OR EXISTS (
    SELECT 1 FROM public.strategy_portfolios
    WHERE governance_status = 'proposed'
      AND portfolio_key NOT IN ('public_sector_opportunities', 'customer_lifecycle_growth')
  ) THEN
    RAISE EXCEPTION 'Gate 3A proposed portfolio set is not exact.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO strategy_count FROM public.operating_strategies;
  SELECT COUNT(*)::INTEGER INTO version_count FROM public.operating_strategy_versions;
  IF strategy_count <> 17 OR version_count <> 17 THEN
    RAISE EXCEPTION 'Gate 3A expected 17 stable strategies and 17 draft heads; found % and %.', strategy_count, version_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE status <> 'draft'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3A must not activate an operating strategy or external-send capacity.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.operating_strategies strategy
    LEFT JOIN public.strategy_portfolios portfolio
      ON portfolio.portfolio_key = strategy.portfolio_key
    WHERE portfolio.portfolio_key IS NULL
  ) THEN
    RAISE EXCEPTION 'Every operating strategy must have exactly one registered parent portfolio.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO crosswalk_count FROM public.strategy_identifier_crosswalk;
  IF crosswalk_count < 100 THEN
    RAISE EXCEPTION 'Gate 3A crosswalk is incomplete; found only % mappings.', crosswalk_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.strategy_identifier_crosswalk
    WHERE allows_new_activity
      AND (resolution_status <> 'current' OR operating_strategy_id IS NULL OR approved_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'A new-activity mapping is incomplete.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3A requires n8n live sending to remain disabled.';
  END IF;
END;
$$;
