\set ON_ERROR_STOP on

BEGIN;

DO $gate3a_bootstrap$
DECLARE
  actor_id UUID;
BEGIN
  SELECT id INTO actor_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Gate 3A database test needs an existing operator user.';
  END IF;
  PERFORM set_config('vestblock.gate3a_test_actor_user_id', actor_id::TEXT, TRUE);
END;
$gate3a_bootstrap$;

SET LOCAL ROLE service_role;

DO $gate3a_test$
DECLARE
  v_actor UUID := current_setting('vestblock.gate3a_test_actor_user_id')::UUID;
  v_strategy_id UUID;
  v1_id UUID;
  v2_id UUID;
  v_hollow_id UUID;
  v_runtime_id UUID;
  v_runtime_strategy_id UUID;
  v_expected_runtime_strategy_id UUID;
  v_mapping_id UUID;
  v_count INTEGER;
  v_lane_v1_id UUID;
  v_lane_v2_id UUID;
  v_proposal_id UUID;
  v_rollback_proposal_id UUID;
  v_proposal_json JSONB;
  v_version_json JSONB;
  v_lane_count_before INTEGER;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Gate 3A database test must execute as service_role.';
  END IF;
  IF has_table_privilege(current_user, 'public.strategy_lane_versions', 'DELETE')
    OR has_table_privilege(current_user, 'public.strategy_lane_versions', 'TRUNCATE')
    OR has_table_privilege(current_user, 'public.strategy_lane_outcomes', 'DELETE')
    OR has_table_privilege(current_user, 'public.strategy_updates', 'DELETE')
    OR has_table_privilege(current_user, 'public.strategy_updates', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Gate 3A history privileges are broader than intended.';
  END IF;

  SELECT strategy.id, version.id
    INTO v_strategy_id, v1_id
  FROM public.operating_strategies strategy
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
  WHERE strategy.strategy_key = 'capital_readiness_intake'
    AND version.version = 1;

  BEGIN
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
      external_send_cap,
      approved_by_user_id,
      approved_at
    ) VALUES (
      v_strategy_id,
      99,
      'draft',
      'no_send',
      'Hollow contract rejection test',
      'public_route',
      '/capital',
      'Review capital',
      jsonb_build_object(
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
      ),
      jsonb_build_object(
        'states', NULL,
        'initialState', NULL,
        'terminalStates', NULL,
        'transitions', NULL,
        'cadence', NULL,
        'stopConditions', NULL
      ),
      jsonb_build_object(
        'crmAuthority', NULL,
        'automationRole', NULL,
        'dispatchAuthority', NULL,
        'handoffRules', NULL
      ),
      jsonb_build_object(
        'primaryConversionEvent', NULL,
        'leadingIndicators', NULL,
        'businessValue', NULL,
        'learningInputs', NULL,
        'learningWindowDays', 1,
        'minimumExposure', 1,
        'attributionDimensions', NULL,
        'stopConditions', NULL
      ),
      jsonb_build_array(jsonb_build_object('source', 'Gate 3A rollback test')),
      'vestblock_crm',
      'vestblock_application',
      0,
      v_actor,
      NOW()
    ) RETURNING id INTO v_hollow_id;

    PERFORM public.validate_operating_strategy_version(v_hollow_id);
    RAISE EXCEPTION 'Hollow operating contracts were accepted.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
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
      external_send_cap,
      approved_by_user_id,
      approved_at
    )
    SELECT
      operating_strategy_id,
      98,
      'draft',
      execution_mode,
      title,
      destination_mode,
      destination_path,
      cta_label,
      contract_json,
      lifecycle_contract_json,
      owner_contract_json,
      outcome_contract_json - 'learningWindowDays',
      source_provenance_json,
      crm_owner_key,
      automation_owner_key,
      0,
      v_actor,
      NOW()
    FROM public.operating_strategy_versions
    WHERE id = v1_id
    RETURNING id INTO v_hollow_id;

    PERFORM public.validate_operating_strategy_version(v_hollow_id);
    RAISE EXCEPTION 'An outcome contract without learningWindowDays was accepted.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
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
      external_send_cap,
      approved_by_user_id,
      approved_at
    )
    SELECT
      operating_strategy_id,
      97,
      'draft',
      execution_mode,
      title,
      destination_mode,
      destination_path,
      cta_label,
      contract_json,
      lifecycle_contract_json,
      owner_contract_json,
      outcome_contract_json - 'minimumExposure',
      source_provenance_json,
      crm_owner_key,
      automation_owner_key,
      0,
      v_actor,
      NOW()
    FROM public.operating_strategy_versions
    WHERE id = v1_id
    RETURNING id INTO v_hollow_id;

    PERFORM public.validate_operating_strategy_version(v_hollow_id);
    RAISE EXCEPTION 'An outcome contract without minimumExposure was accepted.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  PERFORM * FROM public.activate_operating_strategy_version(v1_id, v_actor);

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.resolve_operating_strategy_identifier(
    'operating_strategy',
    'capital_readiness_intake',
    NOW()
  );
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'An active canonical identifier did not resolve exactly once.';
  END IF;

  SELECT id INTO v_expected_runtime_strategy_id
  FROM public.operating_strategies
  WHERE strategy_key = 'property_opportunity_discovery';

  INSERT INTO public.command_center_strategy_runs(
    strategy_key,
    strategy_identifier_namespace,
    strategy_name,
    run_key,
    execution_mode,
    source_provider
  ) VALUES (
    'tax-code-stack',
    'seller_execution',
    'Gate 3A mapped-runtime test',
    'gate3a-mapped-' || gen_random_uuid()::TEXT,
    'dry_run',
    'gate3a_test'
  )
  RETURNING id, operating_strategy_id
    INTO v_runtime_id, v_runtime_strategy_id;
  IF v_runtime_strategy_id IS DISTINCT FROM v_expected_runtime_strategy_id THEN
    RAISE EXCEPTION 'A mapped runtime key did not bind to its canonical strategy.';
  END IF;

  BEGIN
    INSERT INTO public.command_center_strategy_runs(
      strategy_key,
      strategy_identifier_namespace,
      strategy_name,
      run_key,
      execution_mode,
      source_provider
    ) VALUES (
      'unknown_strategy_key',
      'legacy_runtime',
      'Gate 3A unknown-runtime test',
      'gate3a-unknown-' || gen_random_uuid()::TEXT,
      'dry_run',
      'gate3a_test'
    );
    RAISE EXCEPTION 'An unknown runtime strategy key was accepted.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.command_center_strategy_runs(
      strategy_key,
      strategy_identifier_namespace,
      strategy_name,
      run_key,
      execution_mode,
      source_provider
    ) VALUES (
      'public_sector_opportunity_readiness',
      'operating_strategy',
      'Gate 3A proposed-parent runtime test',
      'gate3a-proposed-' || gen_random_uuid()::TEXT,
      'dry_run',
      'gate3a_test'
    );
    RAISE EXCEPTION 'A runtime key under a proposed portfolio was accepted.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

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
    operating_strategy_id,
    2,
    'draft',
    execution_mode,
    title,
    destination_mode,
    destination_path,
    cta_label,
    contract_json,
    lifecycle_contract_json,
    owner_contract_json,
    outcome_contract_json,
    source_provenance_json || jsonb_build_array(
      jsonb_build_object('source', 'Gate 3A rollback integration test')
    ),
    crm_owner_key,
    automation_owner_key,
    0
  FROM public.operating_strategy_versions
  WHERE id = v1_id
  RETURNING id INTO v2_id;

  PERFORM * FROM public.activate_operating_strategy_version(v2_id, v_actor);

  IF NOT EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE id = v1_id AND status = 'retired' AND retired_at IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE id = v2_id AND status = 'active' AND supersedes_id = v1_id
  ) OR (
    SELECT COUNT(*) FROM public.operating_strategy_versions
    WHERE operating_strategy_id = v_strategy_id
  ) <> 2 THEN
    RAISE EXCEPTION 'Operating strategy supersession did not preserve exact history.';
  END IF;

  BEGIN
    PERFORM * FROM public.resolve_operating_strategy_identifier(
      'operating_strategy',
      'unknown_strategy_key',
      NOW()
    );
    RAISE EXCEPTION 'An unknown strategy identifier did not fail closed.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.operating_strategy_versions
    SET contract_json = contract_json || '{"unauthorizedMutation":true}'::JSONB
    WHERE id = v1_id;
    RAISE EXCEPTION 'Retired operating strategy history was mutable.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM *
    FROM public.activate_operating_strategy_version(
      (
        SELECT version.id
        FROM public.operating_strategy_versions version
        JOIN public.operating_strategies strategy
          ON strategy.id = version.operating_strategy_id
        WHERE strategy.strategy_key = 'public_sector_opportunity_readiness'
          AND version.version = 1
      ),
      v_actor
    );
    RAISE EXCEPTION 'A strategy under a proposed portfolio activated.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  SELECT id INTO v_mapping_id
  FROM public.strategy_identifier_crosswalk
  WHERE source_namespace = 'operating_strategy'
    AND source_identifier = 'capital_readiness_intake'
    AND resolution_status = 'current';

  UPDATE public.strategy_identifier_crosswalk
  SET resolution_status = 'historical',
      allows_new_activity = FALSE,
      valid_to = NOW()
  WHERE id = v_mapping_id;

  INSERT INTO public.strategy_identifier_crosswalk(
    source_namespace,
    source_identifier,
    identifier_kind,
    portfolio_key,
    operating_strategy_id,
    resolution_status,
    allows_new_activity,
    valid_from,
    source_provenance_json,
    approved_by_user_id,
    approved_at
  )
  SELECT
    source_namespace,
    source_identifier,
    identifier_kind,
    portfolio_key,
    operating_strategy_id,
    'current',
    TRUE,
    NOW(),
    source_provenance_json || jsonb_build_array(
      jsonb_build_object('source', 'Gate 3A rollback successor mapping')
    ),
    v_actor,
    NOW()
  FROM public.strategy_identifier_crosswalk
  WHERE id = v_mapping_id;

  IF (
    SELECT COUNT(*) FROM public.strategy_identifier_crosswalk
    WHERE source_namespace = 'operating_strategy'
      AND source_identifier = 'capital_readiness_intake'
  ) <> 2 THEN
    RAISE EXCEPTION 'Crosswalk history was not preserved.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_lane_count_before
  FROM public.strategy_lane_versions
  WHERE lane_key = 'content_visibility';

  INSERT INTO public.strategy_updates(
    category,
    target_type,
    target_key,
    risk_level,
    approval_status,
    title,
    rationale,
    proposed_change_json,
    requires_admin_review,
    approved_by_user_id,
    approved_at
  ) VALUES (
    'platform_strategy',
    'platform_strategy_lane',
    'content_visibility',
    'low',
    'approved',
    'Gate 3A atomic rollback proof',
    'Prove the proposal RPC joins the caller transaction.',
    jsonb_build_object(
      'contractPatch', jsonb_build_object(
        'experimentHypothesis',
        'Gate 3A nested rollback should leave no activated version.'
      ),
      'sourcedFacts', jsonb_build_array(
        jsonb_build_object('source', 'Gate 3A rollback integration test')
      )
    ),
    TRUE,
    v_actor,
    NOW()
  ) RETURNING id INTO v_rollback_proposal_id;

  BEGIN
    PERFORM * FROM public.apply_strategy_lane_proposal(
      v_rollback_proposal_id,
      v_actor
    );
    RAISE EXCEPTION 'gate3a_deliberate_nested_rollback';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'gate3a_deliberate_nested_rollback' THEN
        RAISE;
      END IF;
  END;

  IF (
    SELECT approval_status FROM public.strategy_updates
    WHERE id = v_rollback_proposal_id
  ) <> 'approved' OR (
    SELECT COUNT(*) FROM public.strategy_lane_versions
    WHERE lane_key = 'content_visibility'
  ) <> v_lane_count_before OR NOT EXISTS (
    SELECT 1 FROM public.strategy_lane_versions
    WHERE lane_key = 'content_visibility' AND status = 'active' AND version = 1
  ) THEN
    RAISE EXCEPTION 'Atomic proposal work escaped a nested rollback boundary.';
  END IF;

  SELECT id INTO v_lane_v1_id
  FROM public.strategy_lane_versions
  WHERE lane_key = 'capital_funding' AND status = 'active';

  SELECT COUNT(*)::INTEGER INTO v_lane_count_before
  FROM public.strategy_lane_versions
  WHERE lane_key = 'capital_funding';

  INSERT INTO public.strategy_updates(
    category,
    target_type,
    target_key,
    risk_level,
    approval_status,
    title,
    rationale,
    proposed_change_json,
    requires_admin_review,
    approved_by_user_id,
    approved_at
  ) VALUES (
    'platform_strategy',
    'platform_strategy_lane',
    'capital_funding',
    'medium',
    'approved',
    'Gate 3A atomic application proof',
    'Prove proposal state and strategy supersession commit together.',
    jsonb_build_object(
      'contractPatch', jsonb_build_object(
        'experimentHypothesis',
        'Atomic proposal application preserves governance and history.'
      ),
      'sourcedFacts', jsonb_build_array(
        jsonb_build_object('source', 'Gate 3A rollback integration test')
      )
    ),
    TRUE,
    v_actor,
    NOW()
  ) RETURNING id INTO v_proposal_id;

  SELECT proposal_json, version_json
    INTO v_proposal_json, v_version_json
  FROM public.apply_strategy_lane_proposal(v_proposal_id, v_actor);

  v_lane_v2_id := (v_version_json ->> 'id')::UUID;
  IF v_proposal_json ->> 'approval_status' <> 'auto_applied'
    OR (v_proposal_json ->> 'id')::UUID IS DISTINCT FROM v_proposal_id
    OR NOT EXISTS (
      SELECT 1 FROM public.strategy_lane_versions
      WHERE id = v_lane_v1_id AND status = 'retired'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.strategy_lane_versions
      WHERE id = v_lane_v2_id
        AND status = 'active'
        AND supersedes_id = v_lane_v1_id
    )
    OR (
      SELECT COUNT(*) FROM public.strategy_lane_versions
      WHERE lane_key = 'capital_funding'
    ) <> v_lane_count_before + 1 THEN
    RAISE EXCEPTION 'Atomic proposal application did not preserve proposal and version state.';
  END IF;

  BEGIN
    PERFORM * FROM public.apply_strategy_lane_proposal(v_proposal_id, v_actor);
    RAISE EXCEPTION 'An already-applied proposal was applied twice.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.strategy_lane_versions
    SET contract_json = contract_json || '{"unauthorizedMutation":true}'::JSONB
    WHERE id = v_lane_v1_id;
    RAISE EXCEPTION 'Retired portfolio strategy history was mutable.';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate3a_test$;

RESET ROLE;
ROLLBACK;

SELECT
  'passed' AS gate3a_strategy_registry_database_test,
  (SELECT COUNT(*) FROM public.operating_strategy_versions WHERE status = 'active') AS active_operating_versions_after_rollback,
  (SELECT COUNT(*) FROM public.operating_strategy_versions) AS operating_version_rows_after_rollback,
  (SELECT COUNT(*) FROM public.strategy_lane_versions WHERE status = 'active') AS active_portfolios_after_rollback;
