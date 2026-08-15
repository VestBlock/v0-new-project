-- Gate 3A enforcement and regression hardening.
-- Existing runtime history is preserved. New or re-keyed runtime rows must map
-- to exactly one approved canonical operating strategy. No strategy is
-- activated and no external-send control is changed by this migration.

CREATE OR REPLACE FUNCTION private.gate3a_jsonb_nonblank_text(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_value) = 'string'
    AND length(btrim(p_value #>> '{}')) > 0;
$$;

CREATE OR REPLACE FUNCTION private.gate3a_jsonb_text_array(
  p_value JSONB,
  p_require_nonempty BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;
  IF p_require_nonempty AND jsonb_array_length(p_value) = 0 THEN
    RETURN FALSE;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_value) item
    WHERE NOT COALESCE(private.gate3a_jsonb_nonblank_text(item), FALSE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_operating_contract(p_contract JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  required_text_key TEXT;
  required_array_key TEXT;
  decision JSONB;
BEGIN
  IF jsonb_typeof(p_contract) IS DISTINCT FROM 'object' THEN
    RETURN FALSE;
  END IF;

  FOREACH required_text_key IN ARRAY ARRAY[
    'objective', 'targetParticipant', 'problem', 'valueExchange'
  ] LOOP
    IF NOT COALESCE(
      private.gate3a_jsonb_nonblank_text(p_contract -> required_text_key),
      FALSE
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  FOREACH required_array_key IN ARRAY ARRAY[
    'eligibilityCriteria', 'disqualificationCriteria', 'sourceData',
    'primaryChannels', 'followupCadence', 'humanApprovalPoints',
    'complianceLimits', 'learningInputs', 'failureConditions',
    'stopRules', 'handoffRules'
  ] LOOP
    IF NOT private.gate3a_jsonb_text_array(
      p_contract -> required_array_key,
      TRUE
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  IF NOT private.gate3a_jsonb_text_array(
    p_contract -> 'secondaryChannels',
    FALSE
  ) THEN
    RETURN FALSE;
  END IF;

  decision := p_contract -> 'versionDecisionRule';
  IF jsonb_typeof(decision) IS DISTINCT FROM 'object'
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision -> 'promote'), FALSE)
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision -> 'revise'), FALSE)
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision -> 'retire'), FALSE) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_lifecycle_contract(p_contract JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  initial_state TEXT;
  transition JSONB;
  terminal_state JSONB;
BEGIN
  IF jsonb_typeof(p_contract) IS DISTINCT FROM 'object'
    OR NOT private.gate3a_jsonb_text_array(p_contract -> 'states', TRUE)
    OR NOT private.gate3a_jsonb_text_array(p_contract -> 'terminalStates', TRUE)
    OR NOT private.gate3a_jsonb_text_array(p_contract -> 'cadence', TRUE)
    OR NOT private.gate3a_jsonb_text_array(p_contract -> 'stopConditions', TRUE)
    OR jsonb_typeof(p_contract -> 'transitions') IS DISTINCT FROM 'array'
    OR NOT COALESCE(
      private.gate3a_jsonb_nonblank_text(p_contract -> 'initialState'),
      FALSE
    ) THEN
    RETURN FALSE;
  END IF;

  IF jsonb_array_length(p_contract -> 'transitions') = 0 THEN
    RETURN FALSE;
  END IF;

  initial_state := p_contract ->> 'initialState';
  IF NOT (p_contract -> 'states' @> jsonb_build_array(initial_state)) THEN
    RETURN FALSE;
  END IF;

  FOR terminal_state IN
    SELECT value FROM jsonb_array_elements(p_contract -> 'terminalStates')
  LOOP
    IF NOT (p_contract -> 'states' @> jsonb_build_array(terminal_state #>> '{}')) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  FOR transition IN
    SELECT value FROM jsonb_array_elements(p_contract -> 'transitions')
  LOOP
    IF jsonb_typeof(transition) IS DISTINCT FROM 'object'
      OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(transition -> 'from'), FALSE)
      OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(transition -> 'to'), FALSE)
      OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(transition -> 'event'), FALSE)
      OR NOT (p_contract -> 'states' @> jsonb_build_array(transition ->> 'from'))
      OR NOT (p_contract -> 'states' @> jsonb_build_array(transition ->> 'to')) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_owner_contract(
  p_contract JSONB,
  p_expected_crm_owner TEXT,
  p_expected_automation_owner TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_contract) = 'object'
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'crmAuthority'), FALSE)
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'automationRole'), FALSE)
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'dispatchAuthority'), FALSE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'handoffRules', TRUE)
    AND p_contract ->> 'crmAuthority' = p_expected_crm_owner
    AND p_contract ->> 'automationRole' = p_expected_automation_owner
    AND p_contract ->> 'dispatchAuthority' = 'none_in_gate_3a';
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_outcome_contract(p_contract JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_typeof(p_contract) = 'object'
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'primaryConversionEvent'), FALSE)
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'businessValue'), FALSE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'leadingIndicators', TRUE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'learningInputs', TRUE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'attributionDimensions', TRUE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'stopConditions', TRUE)
    AND jsonb_typeof(p_contract -> 'learningWindowDays') = 'number'
    AND (p_contract ->> 'learningWindowDays') ~ '^[1-9][0-9]*$'
    AND jsonb_typeof(p_contract -> 'minimumExposure') = 'number'
    AND (p_contract ->> 'minimumExposure') ~ '^[1-9][0-9]*$';
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_source_provenance(p_provenance JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(p_provenance) IS DISTINCT FROM 'array' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_array_length(p_provenance) = 0 THEN
    RETURN FALSE;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_provenance) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
       OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(item -> 'source'), FALSE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.gate3a_valid_portfolio_contract(p_contract JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  required_text_key TEXT;
  required_array_key TEXT;
  cost_limits JSONB;
  decision_rule JSONB;
BEGIN
  IF jsonb_typeof(p_contract) IS DISTINCT FROM 'object' THEN
    RETURN FALSE;
  END IF;

  FOREACH required_text_key IN ARRAY ARRAY[
    'objective', 'targetCustomer', 'recommendedCustomerPath',
    'primaryConversionEvent', 'experimentHypothesis'
  ] LOOP
    IF NOT COALESCE(
      private.gate3a_jsonb_nonblank_text(p_contract -> required_text_key),
      FALSE
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  FOREACH required_array_key IN ARRAY ARRAY[
    'qualificationCriteria', 'approvedDataSources', 'outreachMethods',
    'consentOrLawfulBasis', 'exclusionsAndSuppressions', 'kpis',
    'failureConditions', 'humanReviewRequirements'
  ] LOOP
    IF NOT private.gate3a_jsonb_text_array(
      p_contract -> required_array_key,
      TRUE
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  cost_limits := p_contract -> 'costAndCapacityLimits';
  IF jsonb_typeof(cost_limits) IS DISTINCT FROM 'object'
    OR cost_limits ->> 'defaultMode' IS DISTINCT FROM 'no_send'
    OR jsonb_typeof(cost_limits -> 'dailyExternalCap') IS DISTINCT FROM 'number'
    OR cost_limits ->> 'dailyExternalCap' <> '0' THEN
    RETURN FALSE;
  END IF;

  IF jsonb_typeof(p_contract -> 'learningWindowDays') IS DISTINCT FROM 'number'
    OR (p_contract ->> 'learningWindowDays') !~ '^[1-9][0-9]*$' THEN
    RETURN FALSE;
  END IF;

  decision_rule := p_contract -> 'versionDecisionRule';
  IF jsonb_typeof(decision_rule) IS DISTINCT FROM 'object'
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision_rule -> 'promote'), FALSE)
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision_rule -> 'revise'), FALSE)
    OR NOT COALESCE(private.gate3a_jsonb_nonblank_text(decision_rule -> 'retire'), FALSE) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

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
    AND (
      p_version.destination_path IS NULL
      OR p_version.destination_path !~ '^/'
      OR p_version.cta_label IS NULL
      OR NULLIF(btrim(p_version.cta_label), '') IS NULL
    ) THEN
    RAISE EXCEPTION 'A public strategy requires a valid destination and CTA.' USING ERRCODE = '23514';
  END IF;
  IF p_version.destination_mode = 'internal_only'
    AND (p_version.destination_path IS NOT NULL OR p_version.cta_label IS NOT NULL) THEN
    RAISE EXCEPTION 'An internal-only strategy cannot expose a destination or CTA.' USING ERRCODE = '23514';
  END IF;

  IF NOT private.gate3a_valid_operating_contract(p_version.contract_json) THEN
    RAISE EXCEPTION 'The operating contract has missing or invalid values.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_lifecycle_contract(p_version.lifecycle_contract_json) THEN
    RAISE EXCEPTION 'The CRM lifecycle contract has missing or invalid values.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_owner_contract(
    p_version.owner_contract_json,
    p_version.crm_owner_key,
    p_version.automation_owner_key
  ) THEN
    RAISE EXCEPTION 'The owner contract has missing, invalid, or conflicting values.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_outcome_contract(p_version.outcome_contract_json) THEN
    RAISE EXCEPTION 'The outcome contract has missing or invalid values.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_source_provenance(p_version.source_provenance_json) THEN
    RAISE EXCEPTION 'Named source provenance is required before activation.' USING ERRCODE = '23514';
  END IF;
  IF p_version.approved_at IS NULL OR p_version.approved_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Operator approval is required before activation.' USING ERRCODE = '23514';
  END IF;
  IF p_version.external_send_cap <> 0
    OR p_version.execution_mode IN ('internal_test', 'approved_live') THEN
    RAISE EXCEPTION 'Gate 3A operating strategies must remain zero-send.' USING ERRCODE = '23514';
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

REVOKE ALL ON FUNCTION private.gate3a_jsonb_nonblank_text(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_jsonb_text_array(JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_operating_contract(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_lifecycle_contract(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_owner_contract(JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_outcome_contract(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_source_provenance(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_valid_portfolio_contract(JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.gate3a_jsonb_nonblank_text(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_jsonb_text_array(JSONB, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_operating_contract(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_lifecycle_contract(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_owner_contract(JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_outcome_contract(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_source_provenance(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_portfolio_contract(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  TO service_role;

ALTER TABLE public.strategy_lane_versions
  ADD CONSTRAINT strategy_lane_versions_id_lane_key_key UNIQUE (id, lane_key),
  ADD CONSTRAINT strategy_lane_versions_supersedes_self_check
    CHECK (supersedes_id IS NULL OR supersedes_id <> id),
  ADD CONSTRAINT strategy_lane_versions_supersedes_same_lane_fkey
    FOREIGN KEY (supersedes_id, lane_key)
    REFERENCES public.strategy_lane_versions(id, lane_key)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION private.gate3a_guard_strategy_lane_version_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  predecessor public.strategy_lane_versions;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'A portfolio strategy version must be inserted as a draft.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('active', 'retired') AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.lane_key IS DISTINCT FROM OLD.lane_key
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.contract_json IS DISTINCT FROM OLD.contract_json
    OR NEW.source_provenance_json IS DISTINCT FROM OLD.source_provenance_json
    OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Active and retired portfolio strategy history is immutable.' USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'A retired portfolio strategy version cannot be reopened.' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'retired') THEN
    RAISE EXCEPTION 'An active portfolio strategy version may only remain active or retire.' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'A draft portfolio strategy version may only remain draft or activate.' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'active' THEN
    IF NOT private.gate3a_valid_portfolio_contract(NEW.contract_json)
      OR NOT private.gate3a_valid_source_provenance(NEW.source_provenance_json)
      OR NEW.approved_by_user_id IS NULL
      OR NEW.approved_at IS NULL THEN
      RAISE EXCEPTION 'A portfolio strategy needs a complete zero-send contract, named evidence, and approval before activation.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.strategy_portfolios portfolio
      WHERE portfolio.portfolio_key = NEW.lane_key
        AND portfolio.governance_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'The parent portfolio must be approved before activation.' USING ERRCODE = '23514';
    END IF;
    IF NEW.version = 1 THEN
      IF NEW.supersedes_id IS NOT NULL THEN
        RAISE EXCEPTION 'The first portfolio strategy version cannot supersede another version.' USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT version.* INTO predecessor
      FROM public.strategy_lane_versions version
      WHERE version.id = NEW.supersedes_id
      FOR SHARE;
      IF predecessor.id IS NULL
        OR predecessor.lane_key IS DISTINCT FROM NEW.lane_key
        OR predecessor.version IS DISTINCT FROM NEW.version - 1
        OR predecessor.status IS DISTINCT FROM 'retired' THEN
        RAISE EXCEPTION 'An active portfolio version must supersede the immediately prior retired version in the same portfolio.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_guard_strategy_lane_version_history()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER strategy_lane_versions_history_guard
BEFORE INSERT OR UPDATE ON public.strategy_lane_versions
FOR EACH ROW EXECUTE FUNCTION private.gate3a_guard_strategy_lane_version_history();

ALTER TABLE public.strategy_lane_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_lane_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_lane_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_lane_outcomes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.strategy_lane_versions, public.strategy_lane_outcomes
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_lane_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_lane_outcomes TO service_role;

ALTER TABLE public.command_center_strategy_runs
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.strategy_lead_memberships
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.command_center_outbound_enrollments
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT;

ALTER TABLE public.strategy_market_state
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT;

ALTER TABLE public.strategy_source_events
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT;

CREATE INDEX command_center_strategy_runs_operating_strategy_idx
  ON public.command_center_strategy_runs(operating_strategy_id)
  WHERE operating_strategy_id IS NOT NULL;
CREATE INDEX strategy_lead_memberships_operating_strategy_idx
  ON public.strategy_lead_memberships(operating_strategy_id)
  WHERE operating_strategy_id IS NOT NULL;
CREATE INDEX command_center_outbound_enrollments_operating_strategy_idx
  ON public.command_center_outbound_enrollments(operating_strategy_id)
  WHERE operating_strategy_id IS NOT NULL;
CREATE INDEX strategy_market_state_operating_strategy_idx
  ON public.strategy_market_state(operating_strategy_id)
  WHERE operating_strategy_id IS NOT NULL;
CREATE INDEX strategy_source_events_operating_strategy_idx
  ON public.strategy_source_events(operating_strategy_id)
  WHERE operating_strategy_id IS NOT NULL;

CREATE INDEX strategy_identifier_crosswalk_runtime_lookup_idx
  ON public.strategy_identifier_crosswalk(
    source_identifier,
    source_namespace,
    operating_strategy_id
  )
  WHERE resolution_status = 'current'
    AND allows_new_activity
    AND valid_to IS NULL;

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
  'legacy_runtime',
  'seller-outreach',
  'legacy_alias',
  strategy.portfolio_key,
  strategy.id,
  'current',
  TRUE,
  jsonb_build_array(jsonb_build_object(
    'source', 'Gate 3A runtime writer inventory',
    'kind', 'approved compatibility mapping',
    'observedAt', NOW()
  )),
  NOW()
FROM public.operating_strategies strategy
WHERE strategy.strategy_key = 'seller_options_intake'
  AND NOT EXISTS (
    SELECT 1
    FROM public.strategy_identifier_crosswalk existing
    WHERE existing.source_namespace = 'legacy_runtime'
      AND existing.source_identifier = 'seller-outreach'
      AND existing.resolution_status = 'current'
      AND existing.valid_to IS NULL
  );

CREATE OR REPLACE FUNCTION private.gate3a_assign_runtime_strategy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate RECORD;
  match_count INTEGER := 0;
  mapped_ids UUID[] := ARRAY[]::UUID[];
  resolved_strategy_id UUID;
  requested_version_id UUID;
  requested_version_id_text TEXT;
BEGIN
  requested_version_id_text := to_jsonb(NEW) ->> 'operating_strategy_version_id';

  IF NEW.strategy_key IS NULL THEN
    IF NEW.strategy_identifier_namespace IS NOT NULL
      OR NEW.operating_strategy_id IS NOT NULL
      OR requested_version_id_text IS NOT NULL THEN
      RAISE EXCEPTION 'A null strategy key cannot carry a namespace or canonical strategy binding.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NULLIF(btrim(NEW.strategy_key), '') IS NULL THEN
    RAISE EXCEPTION 'A runtime strategy key cannot be blank.' USING ERRCODE = '23514';
  END IF;

  IF NEW.strategy_identifier_namespace IS NOT NULL
    AND (
      NULLIF(btrim(NEW.strategy_identifier_namespace), '') IS NULL
      OR NEW.strategy_identifier_namespace !~ '^[a-z0-9_]+$'
    ) THEN
    RAISE EXCEPTION 'A runtime strategy namespace cannot be blank.' USING ERRCODE = '23514';
  END IF;

  FOR candidate IN
    SELECT crosswalk.operating_strategy_id
    FROM public.strategy_identifier_crosswalk crosswalk
    JOIN public.operating_strategies strategy
      ON strategy.id = crosswalk.operating_strategy_id
     AND strategy.retired_at IS NULL
    JOIN public.strategy_portfolios portfolio
      ON portfolio.portfolio_key = strategy.portfolio_key
     AND portfolio.governance_status = 'approved'
    WHERE crosswalk.source_identifier = NEW.strategy_key
      AND (
        NEW.strategy_identifier_namespace IS NULL
        OR crosswalk.source_namespace = NEW.strategy_identifier_namespace
      )
      AND crosswalk.resolution_status = 'current'
      AND crosswalk.allows_new_activity
      AND crosswalk.approved_at IS NOT NULL
      AND crosswalk.valid_from <= statement_timestamp()
      AND (
        crosswalk.valid_to IS NULL
        OR crosswalk.valid_to > statement_timestamp()
      )
    ORDER BY crosswalk.id
    FOR SHARE OF crosswalk, strategy, portfolio
  LOOP
    match_count := match_count + 1;
    IF array_position(mapped_ids, candidate.operating_strategy_id) IS NULL THEN
      mapped_ids := array_append(mapped_ids, candidate.operating_strategy_id);
    END IF;
  END LOOP;

  IF NEW.strategy_identifier_namespace IS NOT NULL AND match_count <> 1 THEN
    RAISE EXCEPTION 'Unknown or inactive namespaced runtime strategy identifier: %:%',
      NEW.strategy_identifier_namespace,
      NEW.strategy_key
      USING ERRCODE = '23514';
  END IF;

  IF cardinality(mapped_ids) <> 1 THEN
    RAISE EXCEPTION 'Unknown, inactive, or ambiguous runtime strategy identifier: %:%',
      COALESCE(NEW.strategy_identifier_namespace, '<unscoped>'),
      NEW.strategy_key
      USING ERRCODE = '23514';
  END IF;

  resolved_strategy_id := mapped_ids[1];
  IF NEW.operating_strategy_id IS NOT NULL
    AND NEW.operating_strategy_id IS DISTINCT FROM resolved_strategy_id THEN
    RAISE EXCEPTION 'The supplied operating strategy conflicts with the canonical crosswalk.' USING ERRCODE = '23514';
  END IF;
  NEW.operating_strategy_id := resolved_strategy_id;

  requested_version_id := NULLIF(requested_version_id_text, '')::UUID;
  IF requested_version_id IS NOT NULL THEN
    PERFORM 1
    FROM public.operating_strategy_versions version
    WHERE version.id = requested_version_id
      AND version.operating_strategy_id = resolved_strategy_id
      AND version.status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The supplied operating strategy version is inactive or belongs to a different strategy.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_assign_runtime_strategy()
  FROM PUBLIC, anon, authenticated, service_role;
ALTER FUNCTION private.gate3a_assign_runtime_strategy() OWNER TO postgres;

CREATE TRIGGER command_center_strategy_runs_canonical_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id, operating_strategy_version_id
ON public.command_center_strategy_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE TRIGGER strategy_lead_memberships_canonical_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id, operating_strategy_version_id
ON public.strategy_lead_memberships
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE TRIGGER command_center_outbound_enrollments_canonical_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id
ON public.command_center_outbound_enrollments
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE TRIGGER strategy_market_state_canonical_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id
ON public.strategy_market_state
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE TRIGGER strategy_source_events_canonical_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id
ON public.strategy_source_events
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE OR REPLACE FUNCTION public.apply_strategy_lane_proposal(
  p_proposal_id UUID,
  p_actor_user_id UUID
)
RETURNS TABLE (proposal_json JSONB, version_json JSONB)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  proposal public.strategy_updates;
  current_version public.strategy_lane_versions;
  draft_version public.strategy_lane_versions;
  activated_version public.strategy_lane_versions;
  applied_proposal public.strategy_updates;
  change_payload JSONB;
  contract_patch JSONB;
  sourced_facts JSONB;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'An operator actor is required.' USING ERRCODE = '23514';
  END IF;

  SELECT update_row.* INTO proposal
  FROM public.strategy_updates update_row
  WHERE update_row.id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Strategy proposal not found.' USING ERRCODE = '23514';
  END IF;
  IF proposal.target_type <> 'platform_strategy_lane' THEN
    RAISE EXCEPTION 'This is not a platform strategy proposal.' USING ERRCODE = '23514';
  END IF;
  IF proposal.category <> 'platform_strategy'
    OR NOT proposal.requires_admin_review
    OR proposal.approval_status <> 'approved'
    OR proposal.approved_by_user_id IS NULL
    OR proposal.approved_at IS NULL THEN
    RAISE EXCEPTION 'Only an approved strategy proposal can be applied.' USING ERRCODE = '23514';
  END IF;

  change_payload := proposal.proposed_change_json;
  contract_patch := change_payload -> 'contractPatch';
  sourced_facts := change_payload -> 'sourcedFacts';
  IF jsonb_typeof(change_payload) IS DISTINCT FROM 'object'
    OR jsonb_typeof(contract_patch) IS DISTINCT FROM 'object'
    OR contract_patch = '{}'::JSONB THEN
    RAISE EXCEPTION 'A strategy proposal requires a nonempty object contract patch.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_source_provenance(sourced_facts) THEN
    RAISE EXCEPTION 'A strategy proposal requires named sourced evidence.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.strategy_portfolios portfolio
  WHERE portfolio.portfolio_key = proposal.target_key
    AND portfolio.governance_status = 'approved'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The proposal target portfolio is not approved.' USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO current_version
  FROM public.strategy_lane_versions version
  WHERE version.lane_key = proposal.target_key
    AND version.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active strategy portfolio version not found.' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.strategy_lane_versions version
    WHERE version.lane_key = current_version.lane_key
      AND version.version = current_version.version + 1
  ) THEN
    RAISE EXCEPTION 'The next portfolio strategy version already exists and must be reviewed explicitly.' USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_portfolio_contract(
    current_version.contract_json || contract_patch
  ) THEN
    RAISE EXCEPTION 'The proposed portfolio contract has missing, invalid, or non-zero-send values.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.strategy_lane_versions(
    lane_key,
    version,
    title,
    status,
    contract_json,
    source_provenance_json,
    approved_by_user_id,
    approved_at
  ) VALUES (
    current_version.lane_key,
    current_version.version + 1,
    current_version.title,
    'draft',
    current_version.contract_json || contract_patch,
    current_version.source_provenance_json || sourced_facts,
    proposal.approved_by_user_id,
    proposal.approved_at
  )
  RETURNING * INTO draft_version;

  SELECT activated.* INTO activated_version
  FROM public.activate_strategy_lane_version(draft_version.id, p_actor_user_id) activated;
  IF activated_version.id IS NULL THEN
    RAISE EXCEPTION 'Portfolio activation did not return a version.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.strategy_updates
  SET approval_status = 'auto_applied',
      applied_change_json = jsonb_build_object(
        'strategyVersionId', activated_version.id,
        'version', activated_version.version,
        'appliedByUserId', p_actor_user_id,
        'approvedByUserId', proposal.approved_by_user_id
      ),
      applied_at = NOW(),
      updated_at = NOW()
  WHERE id = proposal.id
    AND approval_status = 'approved'
  RETURNING * INTO applied_proposal;

  IF applied_proposal.id IS NULL THEN
    RAISE EXCEPTION 'The proposal changed while it was being applied.' USING ERRCODE = '40001';
  END IF;

  RETURN QUERY SELECT to_jsonb(applied_proposal), to_jsonb(activated_version);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_strategy_lane_proposal(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_strategy_lane_proposal(UUID, UUID)
  TO service_role;

REVOKE ALL ON TABLE public.strategy_updates FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_updates TO service_role;

CREATE INDEX operating_strategy_version_events_actor_idx
  ON public.operating_strategy_version_events(actor_user_id)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX operating_strategy_versions_approved_by_idx
  ON public.operating_strategy_versions(approved_by_user_id)
  WHERE approved_by_user_id IS NOT NULL;
CREATE INDEX operating_strategy_versions_supersedes_strategy_idx
  ON public.operating_strategy_versions(supersedes_id, operating_strategy_id)
  WHERE supersedes_id IS NOT NULL;
CREATE INDEX strategy_identifier_crosswalk_approved_by_idx
  ON public.strategy_identifier_crosswalk(approved_by_user_id)
  WHERE approved_by_user_id IS NOT NULL;
CREATE INDEX strategy_identifier_crosswalk_strategy_parent_idx
  ON public.strategy_identifier_crosswalk(operating_strategy_id, portfolio_key)
  WHERE operating_strategy_id IS NOT NULL;
CREATE INDEX strategy_lane_versions_approved_by_idx
  ON public.strategy_lane_versions(approved_by_user_id)
  WHERE approved_by_user_id IS NOT NULL;
CREATE INDEX strategy_lane_outcomes_reviewed_by_idx
  ON public.strategy_lane_outcomes(reviewed_by_user_id)
  WHERE reviewed_by_user_id IS NOT NULL;

DO $$
BEGIN
  IF private.gate3a_valid_operating_contract(jsonb_build_object(
    'objective', NULL,
    'targetParticipant', NULL,
    'problem', NULL,
    'valueExchange', NULL,
    'eligibilityCriteria', NULL,
    'disqualificationCriteria', NULL,
    'sourceData', NULL,
    'primaryChannels', NULL,
    'secondaryChannels', NULL,
    'followupCadence', NULL,
    'humanApprovalPoints', NULL,
    'complianceLimits', NULL,
    'learningInputs', NULL,
    'failureConditions', NULL,
    'stopRules', NULL,
    'handoffRules', NULL,
    'versionDecisionRule', NULL
  )) THEN
    RAISE EXCEPTION 'Hollow operating contracts must fail validation.';
  END IF;

  IF has_table_privilege('service_role', 'public.strategy_lane_versions', 'DELETE')
    OR has_table_privilege('service_role', 'public.strategy_lane_versions', 'TRUNCATE')
    OR has_table_privilege('service_role', 'public.strategy_lane_outcomes', 'DELETE')
    OR has_table_privilege('service_role', 'public.strategy_lane_outcomes', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Portfolio strategy history must not be deletable or truncatable.';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.strategy_identifier_crosswalk
    WHERE source_namespace = 'legacy_runtime'
      AND source_identifier = 'seller-outreach'
      AND resolution_status = 'current'
      AND allows_new_activity
      AND valid_to IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'The seller outreach runtime writer lacks one canonical mapping.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3A enforcement must not activate operating strategies or sending.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3A requires n8n live sending to remain disabled.';
  END IF;
END;
$$;
