-- Gate 3A hardening discovered during the post-apply fresh-eyes review.
-- No strategy is activated and no sending control is changed here.

ALTER TABLE public.operating_strategy_versions
  DROP CONSTRAINT operating_strategy_versions_destination_shape_check;

ALTER TABLE public.operating_strategy_versions
  ADD CONSTRAINT operating_strategy_versions_destination_shape_check CHECK (
    (
      destination_mode = 'public_route'
      AND destination_path IS NOT NULL
      AND destination_path ~ '^/'
      AND cta_label IS NOT NULL
      AND length(btrim(cta_label)) > 0
    )
    OR (
      destination_mode IN ('internal_only', 'unresolved')
      AND destination_path IS NULL
      AND cta_label IS NULL
    )
  );

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

REVOKE ALL ON TABLE
  public.strategy_portfolios,
  public.strategy_execution_owners,
  public.operating_strategies,
  public.operating_strategy_versions,
  public.operating_strategy_version_events,
  public.strategy_identifier_crosswalk
FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_portfolios TO service_role;
GRANT SELECT ON TABLE public.strategy_execution_owners TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.operating_strategies TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.operating_strategy_versions TO service_role;
GRANT SELECT, INSERT ON TABLE public.operating_strategy_version_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.strategy_identifier_crosswalk TO service_role;

GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)
  TO service_role;

DO $$
BEGIN
  IF has_table_privilege('service_role', 'public.strategy_portfolios', 'DELETE')
    OR has_table_privilege('service_role', 'public.strategy_execution_owners', 'DELETE')
    OR has_table_privilege('service_role', 'public.operating_strategies', 'DELETE')
    OR has_table_privilege('service_role', 'public.operating_strategy_versions', 'DELETE')
    OR has_table_privilege('service_role', 'public.operating_strategy_version_events', 'DELETE')
    OR has_table_privilege('service_role', 'public.strategy_identifier_crosswalk', 'DELETE') THEN
    RAISE EXCEPTION 'Gate 3A history tables must not be deletable by service_role.';
  END IF;

  IF has_table_privilege('service_role', 'public.operating_strategy_versions', 'TRUNCATE')
    OR has_table_privilege('service_role', 'public.operating_strategy_version_events', 'TRUNCATE')
    OR has_table_privilege('service_role', 'public.strategy_identifier_crosswalk', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Gate 3A history tables must not be truncatable by service_role.';
  END IF;

  IF NOT has_schema_privilege('service_role', 'private', 'USAGE')
    OR NOT has_function_privilege(
      'service_role',
      'private.gate3a_assert_operating_strategy_version(public.operating_strategy_versions)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'The service-role activation path lacks its private validation permission.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3A hardening must not activate strategies or sending.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3A requires n8n live sending to remain disabled.';
  END IF;
END;
$$;
