\set ON_ERROR_STOP on

-- Gate 3C database regression suite.
--
-- Run only after the Gate 3C migration is present. Every fixture and every
-- temporary activation is enclosed in this transaction and rolled back. This
-- script never grants production reviewer authority, activates a production
-- strategy, enables n8n, or preserves a send-cap change.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(
  p_condition BOOLEAN,
  p_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(p_condition, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Gate 3C assertion failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_sql TEXT,
  p_message TEXT,
  p_expected_sqlstate TEXT DEFAULT NULL,
  p_expected_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  failed BOOLEAN := FALSE;
  observed_sqlstate TEXT;
  observed_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    failed := TRUE;
    GET STACKED DIAGNOSTICS
      observed_sqlstate = RETURNED_SQLSTATE,
      observed_message = MESSAGE_TEXT;
  END;

  IF NOT failed THEN
    RAISE EXCEPTION 'Gate 3C expected failure did not occur: %', p_message;
  END IF;
  IF p_expected_sqlstate IS NOT NULL
    AND observed_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
    RAISE EXCEPTION 'Gate 3C failure % returned SQLSTATE %, expected % (message: %).',
      p_message,
      observed_sqlstate,
      p_expected_sqlstate,
      observed_message;
  END IF;
  IF p_expected_message IS NOT NULL
    AND observed_message IS DISTINCT FROM p_expected_message THEN
    RAISE EXCEPTION 'Gate 3C failure % returned message %, expected %.',
      p_message,
      observed_message,
      p_expected_message;
  END IF;
END;
$$;

-- Exact production safety state before the rollback-only fixtures begin.
DO $$
DECLARE
  mismatch_count INTEGER;
  ledger_name TEXT;
  relation_is_forced BOOLEAN;
BEGIN
  WITH expected(strategy_key, fingerprint) AS (
    VALUES
      ('business_acquisition_network', 'a96aae4117fade695c15e93a903802cf'),
      ('business_formation_readiness', '8e04e350de6912f13523248c81103762'),
      ('buyer_buy_box_activation', '050db76162fc612456c29d9e357b713f'),
      ('capital_readiness_intake', 'f5bad84ec7a3aa69c0801b8658771b04'),
      ('content_authority_intelligence', '086b8447a085f8a88f2b843b548ad1da'),
      ('credit_education_support', '06d89433fdee05d5689f156a323822ca'),
      ('customer_lifecycle_orchestration', '470951941abfca8b6f58304e2f93ebf3'),
      ('dealvault_activation', 'd73c205b8a67a551bec9532a69e8b804'),
      ('investor_capital_relationships', '34be21e3c62c2444ff8f35f360fce70b'),
      ('lender_provider_criteria', '432e0cc465f8f841949badab0693d9d3'),
      ('next_move_free_roadmap', 'a31a6d07a6e75c31516e79c248ea1282'),
      ('partner_referral_network', '1db7783037a719bb5ea44a203742767e'),
      ('professional_participant_activation', '5c8f3bff2bd292fe79ddc2181d6bf7e3'),
      ('property_opportunity_discovery', '38381df614e5c739c8de5f0bd9e3b870'),
      ('public_sector_opportunity_readiness', '52cc09671efc4caaa4ebcf292ffdb7b7'),
      ('seller_options_intake', '74c3fb77e802a30d001db78e48e21747'),
      ('service_provider_network', '0c59eae475c405662b0015b84f939dfe')
  )
  SELECT COUNT(*)::INTEGER INTO mismatch_count
  FROM expected
  LEFT JOIN public.operating_strategies strategy
    ON strategy.strategy_key = expected.strategy_key
  LEFT JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.version = 1
  WHERE version.id IS NULL
     OR version.status <> 'draft'
     OR version.external_send_cap <> 0
     OR version.approved_at IS NOT NULL
     OR version.activated_at IS NOT NULL
     OR version.owner_contract_json ->> 'dispatchAuthority' <> 'none_in_gate_3b'
     OR private.gate3b_operating_contract_fingerprint(
       (version.*)::public.operating_strategy_versions
     ) <> expected.fingerprint;

  PERFORM pg_temp.assert_true(
    mismatch_count = 0 AND (SELECT COUNT(*) FROM public.operating_strategy_versions) = 17,
    'the 17 Gate 3B drafts and fingerprints must be untouched'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.operating_strategy_versions WHERE status = 'active'),
    'no operating strategy may be active before the fixture'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.orchestration_controls
      WHERE integration_key = 'n8n' AND live_send_enabled
    ),
    'n8n must remain disabled'
  );
  PERFORM pg_temp.assert_true(
    EXISTS (
      SELECT 1
      FROM public.operating_strategy_runtime_controls
      WHERE control_key = 'canonical_binding'
        AND enforcement_mode = 'compatibility'
        AND schema_status = 'staged_pending_app_deployment'
        AND app_release_status = 'not_deployed'
    ),
    'the staged compatibility watermark must remain fail-closed'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities),
    'founder reviewer authority must be empty by default'
  );

  FOREACH ledger_name IN ARRAY ARRAY[
    'operating_strategy_activities',
    'operating_strategy_outcomes',
    'operating_strategy_outcome_attributions',
    'operating_strategy_dispatch_reservations',
    'operating_strategy_learning_windows',
    'operating_strategy_reviewer_authorities',
    'operating_strategy_review_manifests',
    'operating_strategy_review_manifest_windows',
    'operating_strategy_review_decisions',
    'operating_strategy_attribution_quarantine'
  ] LOOP
    SELECT relation.relrowsecurity AND relation.relforcerowsecurity
      INTO relation_is_forced
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = ledger_name;
    PERFORM pg_temp.assert_true(
      relation_is_forced,
      format('public.%s must have forced RLS', ledger_name)
    );
    PERFORM pg_temp.assert_true(
      NOT has_table_privilege('service_role', format('public.%I', ledger_name), 'UPDATE')
      AND NOT has_table_privilege('service_role', format('public.%I', ledger_name), 'DELETE')
      AND NOT has_table_privilege('service_role', format('public.%I', ledger_name), 'TRUNCATE'),
      format('service_role must not mutate append-only public.%s', ledger_name)
    );
  END LOOP;

  PERFORM pg_temp.assert_true(
    has_function_privilege(
      'service_role',
      'public.resolve_operating_strategy_runtime(text,text,timestamptz)',
      'EXECUTE'
    )
    AND has_function_privilege(
      'service_role',
      'public.list_operating_strategy_registry_projection()',
      'EXECUTE'
    )
    AND has_function_privilege(
      'service_role',
      'public.reserve_operating_strategy_dispatch(uuid,text,text,integer,text,text,integer,text[])',
      'EXECUTE'
    ),
    'service_role needs the resolver and atomic reservation RPCs'
  );
  PERFORM pg_temp.assert_true(
    NOT has_function_privilege(
      'anon', 'public.list_operating_strategy_registry_projection()', 'EXECUTE'
    )
    AND NOT has_function_privilege(
      'authenticated', 'public.list_operating_strategy_registry_projection()', 'EXECUTE'
    ),
    'the PII-free registry projection must remain service-role only'
  );
  PERFORM pg_temp.assert_true(
    NOT has_function_privilege(
      'service_role',
      'public.record_operating_strategy_review_decision(uuid,text,uuid,text,text,text,text)',
      'EXECUTE'
    )
    AND NOT has_function_privilege(
      'service_role',
      'public.activate_operating_strategy_version(uuid,uuid)',
      'EXECUTE'
    ),
    'service_role must not hold founder review or activation authority'
  );
END;
$$;

-- The test reviewer is transaction-local and is removed by ROLLBACK. Supabase
-- auth.users accepts this fixture shape on local and hosted Postgres projects.
INSERT INTO auth.users(
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '3c000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'gate3c-reviewer-test@vestblock.invalid',
  '',
  statement_timestamp(),
  '{}'::JSONB,
  '{}'::JSONB,
  statement_timestamp(),
  statement_timestamp()
)
ON CONFLICT (id) DO NOTHING;

SELECT set_config(
  'gate3c.test.reviewer_id',
  '3c000000-0000-4000-8000-000000000001',
  TRUE
);

SELECT set_config('gate3c.test.version_id', version.id::TEXT, TRUE),
       set_config('gate3c.test.strategy_id', version.operating_strategy_id::TEXT, TRUE)
FROM public.operating_strategy_versions version
JOIN public.operating_strategies strategy
  ON strategy.id = version.operating_strategy_id
WHERE strategy.strategy_key = 'seller_options_intake'
  AND version.version = 1;

SELECT pg_temp.assert_true(
  NULLIF(current_setting('gate3c.test.version_id', TRUE), '') IS NOT NULL,
  'seller_options_intake version fixture must exist'
);

-- Service-role behavior before any rollback-only activation: resolver fails
-- closed, while a currently deployed no-send legacy writer remains compatible.
SET LOCAL ROLE service_role;

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 17
      AND bool_and(version_status = 'draft')
      AND bool_and(external_send_cap = 0)
      AND COUNT(*) FILTER (
        WHERE strategy_key = 'seller_options_intake'
          AND operating_contract_fingerprint = '74c3fb77e802a30d001db78e48e21747'
      ) = 1
    FROM public.list_operating_strategy_registry_projection()
  ),
  'Obsidian registry projection must return the exact 17 safe Gate 3B draft fingerprints'
);

SELECT pg_temp.expect_error(
  $statement$
    SELECT * FROM public.resolve_operating_strategy_runtime(
      'operating_strategy',
      'seller_options_intake',
      statement_timestamp()
    )
  $statement$,
  'resolver must reject a draft strategy',
  '23514'
);

INSERT INTO public.orchestration_runs(
  integration_key,
  event_type,
  idempotency_key,
  mode,
  channel,
  status,
  request_digest
) VALUES (
  'n8n',
  'gate3c_legacy_compatibility_probe',
  'gate3c-legacy-compatibility-probe',
  'no_send',
  'no_outreach',
  'queued',
  md5('gate3c-legacy-compatibility-probe')
);

SELECT pg_temp.assert_true(
  (
    SELECT strategy_binding_mode = 'legacy_compat'
      AND operating_strategy_version_id IS NULL
    FROM public.orchestration_runs
    WHERE idempotency_key = 'gate3c-legacy-compatibility-probe'
  ),
  'legacy writers must remain tagged and compatible before app deployment'
);

UPDATE public.orchestration_runs
SET status = 'failed', failure_code = 'gate3c_compatibility_probe'
WHERE idempotency_key = 'gate3c-legacy-compatibility-probe';
SELECT pg_temp.assert_true(
  (
    SELECT status = 'failed' AND strategy_binding_mode = 'legacy_compat'
    FROM public.orchestration_runs
    WHERE idempotency_key = 'gate3c-legacy-compatibility-probe'
  ),
  'compatibility mode must allow ordinary legacy status updates'
);
SELECT pg_temp.expect_error(
  $statement$
    UPDATE public.orchestration_runs
    SET strategy_writer_release = 'gate3c-illegal-rebind'
    WHERE idempotency_key = 'gate3c-legacy-compatibility-probe'
  $statement$,
  'compatibility mode must freeze legacy binding snapshot fields',
  '23514'
);

RESET ROLE;

-- Rehearse the later release-cutover watermark without preserving it. Once
-- governed_required is approved, even a writer that explicitly labels itself
-- legacy_compat must fail rather than bypassing the global binding switch.
UPDATE public.operating_strategy_runtime_controls
SET enforcement_mode = 'governed_required',
    schema_status = 'cutover_complete',
    app_release_status = 'deployed_governed',
    required_writer_release = 'gate3c-db-test',
    cutover_at = statement_timestamp(),
    cutover_approved_by_user_id = current_setting('gate3c.test.reviewer_id')::UUID,
    updated_at = statement_timestamp()
WHERE control_key = 'canonical_binding';

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  $statement$
    INSERT INTO public.orchestration_runs(
      integration_key,
      event_type,
      idempotency_key,
      mode,
      channel,
      status,
      request_digest,
      strategy_binding_mode
    ) VALUES (
      'n8n',
      'gate3c_explicit_legacy_after_cutover',
      'gate3c-explicit-legacy-after-cutover',
      'no_send',
      'no_outreach',
      'queued',
      md5('gate3c-explicit-legacy-after-cutover'),
      'legacy_compat'
    )
  $statement$,
  'governed_required must reject an explicit legacy_compat writer',
  '23514'
);
SELECT pg_temp.expect_error(
  $statement$
    UPDATE public.orchestration_runs
    SET status = 'cancelled'
    WHERE idempotency_key = 'gate3c-legacy-compatibility-probe'
  $statement$,
  'governed_required must reject updates to existing legacy rows',
  '23514'
);
SELECT pg_temp.expect_error(
  $statement$
    INSERT INTO public.orchestration_runs(
      integration_key,
      event_type,
      idempotency_key,
      mode,
      channel,
      status,
      request_digest
    ) VALUES (
      'n8n',
      'gate3c_legacy_upsert_after_cutover',
      'gate3c-legacy-compatibility-probe',
      'no_send',
      'no_outreach',
      'cancelled',
      md5('gate3c-legacy-upsert-after-cutover')
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET status = EXCLUDED.status
  $statement$,
  'governed_required must reject an upsert update to an existing legacy row',
  '23514'
);
RESET ROLE;

UPDATE public.operating_strategy_runtime_controls
SET enforcement_mode = 'compatibility',
    schema_status = 'staged_pending_app_deployment',
    app_release_status = 'not_deployed',
    required_writer_release = NULL,
    cutover_at = NULL,
    cutover_approved_by_user_id = NULL,
    updated_at = statement_timestamp()
WHERE control_key = 'canonical_binding';

-- Temporarily model an already founder-approved version without exercising the
-- production activation path. Replica mode is scoped to this transaction and
-- used only to build rollback-only test evidence around the new Gate 3C schema.
SET LOCAL session_replication_role = replica;
UPDATE public.operating_strategy_versions
SET status = 'active',
    execution_mode = 'approved_live',
    external_send_cap = 0,
    approved_by_user_id = current_setting('gate3c.test.reviewer_id')::UUID,
    approved_at = date_trunc('day', statement_timestamp()) - INTERVAL '4 days',
    activated_at = date_trunc('day', statement_timestamp()) - INTERVAL '4 days',
    contract_json = jsonb_set(
      jsonb_set(
        contract_json,
        '{primaryChannels}',
        '["resend_email","outlook_graph","gmail_email"]'::JSONB,
        TRUE
      ),
      '{secondaryChannels}',
      '["operator_task"]'::JSONB,
      TRUE
    ),
    owner_contract_json = jsonb_set(
      owner_contract_json,
      '{dispatchAuthority}',
      '"vestblock_application"'::JSONB,
      TRUE
    ),
    outcome_contract_json = outcome_contract_json
      || jsonb_build_object(
        'learningWindowDays', 1,
        'minimumExposure', 1,
        'minimumPrimaryConversions', 1,
        'requiredCompleteWindows', 2
      )
WHERE id = current_setting('gate3c.test.version_id')::UUID;
UPDATE public.strategy_identifier_crosswalk
SET valid_from = statement_timestamp() - INTERVAL '10 days',
    updated_at = statement_timestamp()
WHERE source_namespace = 'operating_strategy'
  AND source_identifier = 'seller_options_intake'
  AND operating_strategy_id = current_setting('gate3c.test.strategy_id')::UUID
  AND resolution_status = 'current'
  AND valid_to IS NULL;
SET LOCAL session_replication_role = origin;

SELECT set_config('gate3c.test.activated_at', version.activated_at::TEXT, TRUE)
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SELECT set_config(
  'gate3c.test.contract_fingerprint',
  private.gate3b_operating_contract_fingerprint(
    (version.*)::public.operating_strategy_versions
  ),
  TRUE
)
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;


SET LOCAL ROLE service_role;

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.reserve_operating_strategy_dispatch(
        %L::UUID, %L, 'resend_email', 1,
        'gate3c-zero-cap', 'gate3c-db-test', 900,
        ARRAY[]::TEXT[]
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.contract_fingerprint')
  ),
  'zero external-send capacity must reject reservations',
  '23514'
);

RESET ROLE;

-- Internal-test mode never authorizes an external provider dispatch. Gate 3A
-- requires its cap to remain zero, so the assertion below pins the exact mode-
-- gate message and cannot pass through the later zero-cap guard instead.
SET LOCAL session_replication_role = replica;
UPDATE public.operating_strategy_versions
SET execution_mode = 'internal_test', external_send_cap = 0
WHERE id = current_setting('gate3c.test.version_id')::UUID;
SET LOCAL session_replication_role = origin;

SELECT set_config(
  'gate3c.test.contract_fingerprint',
  private.gate3b_operating_contract_fingerprint(
    (version.*)::public.operating_strategy_versions
  ),
  TRUE
)
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.reserve_operating_strategy_dispatch(
        %L::UUID, %L, 'resend_email', 1,
        'gate3c-internal-test', 'gate3c-db-test', 900,
        ARRAY[]::TEXT[]
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.contract_fingerprint')
  ),
  'internal_test must not reserve external dispatch',
  '23514',
  'Dispatch capacity requires an approved, activated, send-capable operating version.'
);
RESET ROLE;

-- Restore an approved-live rollback fixture with a cap of two logical sends.
SET LOCAL session_replication_role = replica;
UPDATE public.operating_strategy_versions
SET execution_mode = 'approved_live', external_send_cap = 2
WHERE id = current_setting('gate3c.test.version_id')::UUID;
SET LOCAL session_replication_role = origin;

SELECT set_config(
  'gate3c.test.contract_fingerprint',
  private.gate3b_operating_contract_fingerprint(
    (version.*)::public.operating_strategy_versions
  ),
  TRUE
)
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SET LOCAL ROLE service_role;

SELECT pg_temp.assert_true(
  (
    SELECT resolved.operating_strategy_version_id =
        current_setting('gate3c.test.version_id')::UUID
      AND resolved.operating_contract_fingerprint =
        current_setting('gate3c.test.contract_fingerprint')
      AND resolved.execution_mode = 'approved_live'
      AND resolved.external_send_cap = 2
    FROM public.resolve_operating_strategy_runtime(
      'operating_strategy',
      'seller_options_intake',
      statement_timestamp()
    ) resolved
  ),
  'resolver must return the exact active version and DB-computed fingerprint'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_activity(
        p_operating_strategy_version_id => %L::UUID,
        p_activity_type => 'domain_event',
        p_activity_namespace => 'seller_case_event',
        p_activity_key => 'gate3c-preactivation-root',
        p_subject_namespace => 'seller_case',
        p_subject_key => 'gate3c-preactivation-subject',
        p_idempotency_key => 'gate3c-preactivation-root',
        p_writer_release => 'gate3c-db-test',
        p_occurred_at => %L::TIMESTAMPTZ - INTERVAL '1 minute',
        p_source_namespace => 'operating_strategy',
        p_source_identifier => 'seller_options_intake',
        p_provenance_json => '[{"source":"preactivation rejection fixture"}]'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.activated_at')
  ),
  'root evidence must not predate operating-version activation',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.summarize_operating_strategy_learning_window(
        %L::UUID,
        'gate3c-preactivation-window',
        %L::TIMESTAMPTZ - INTERVAL '1 day',
        %L::TIMESTAMPTZ,
        'gate3c-preactivation-window',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.activated_at'),
    current_setting('gate3c.test.activated_at')
  ),
  'learning windows must not begin before operating-version activation',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.summarize_operating_strategy_learning_window(
        %L::UUID,
        'gate3c-oversized-first-window',
        %L::TIMESTAMPTZ,
        %L::TIMESTAMPTZ + INTERVAL '2 days',
        'gate3c-oversized-first-window',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.activated_at'),
    current_setting('gate3c.test.activated_at')
  ),
  'a learning window cannot exceed the exact contract duration',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.summarize_operating_strategy_learning_window(
        %L::UUID,
        'gate3c-shifted-first-window',
        %L::TIMESTAMPTZ + INTERVAL '1 hour',
        %L::TIMESTAMPTZ + INTERVAL '1 day 1 hour',
        'gate3c-shifted-first-window',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.activated_at'),
    current_setting('gate3c.test.activated_at')
  ),
  'the first learning window cannot shift away from activation',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.reserve_operating_strategy_dispatch(
        %L::UUID, %L, 'resend_email', 1,
        'gate3c-unapproved-fallback', 'gate3c-db-test', 900,
        ARRAY['sms_gateway']::TEXT[]
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.contract_fingerprint')
  ),
  'an unapproved fallback adapter must reject the logical reservation',
  '23514'
);

SELECT set_config('gate3c.test.reservation_one_id', reservation.reservation_id::TEXT, TRUE),
       set_config('gate3c.test.reservation_one_remaining', reservation.remaining_daily_capacity::TEXT, TRUE)
FROM public.reserve_operating_strategy_dispatch(
  current_setting('gate3c.test.version_id')::UUID,
  current_setting('gate3c.test.contract_fingerprint'),
  'resend_email',
  1,
  'gate3c-reservation-one',
  'gate3c-db-test',
  900,
  ARRAY['outlook_graph', 'gmail_email', 'outlook_graph']::TEXT[]
) reservation;

SELECT pg_temp.assert_true(
  (
    SELECT channel_candidates = ARRAY['resend_email', 'outlook_graph', 'gmail_email']::TEXT[]
      AND remaining_capacity_after_reservation = 1
    FROM public.operating_strategy_dispatch_reservations
    WHERE id = current_setting('gate3c.test.reservation_one_id')::UUID
  ),
  'fallback priority must preserve first occurrence and one logical reservation unit'
);

SELECT pg_temp.assert_true(
  (
    SELECT reservation_id = current_setting('gate3c.test.reservation_one_id')::UUID
      AND remaining_daily_capacity =
        current_setting('gate3c.test.reservation_one_remaining')::INTEGER
    FROM public.reserve_operating_strategy_dispatch(
      current_setting('gate3c.test.version_id')::UUID,
      current_setting('gate3c.test.contract_fingerprint'),
      'resend_email',
      1,
      'gate3c-reservation-one',
      'gate3c-db-test',
      900,
      ARRAY['outlook_graph', 'gmail_email', 'outlook_graph']::TEXT[]
    )
  ),
  'an exact reservation retry must return the same durable reservation snapshot'
);

SELECT set_config('gate3c.test.enrollment_one_id', gen_random_uuid()::TEXT, TRUE),
       set_config('gate3c.test.intent_one_at', statement_timestamp()::TEXT, TRUE),
       set_config('gate3c.test.suppression_one_at', statement_timestamp()::TEXT, TRUE);

SELECT pg_temp.expect_error(
  format(
    $statement$
      INSERT INTO public.command_center_outbound_enrollments(
        id, strategy_key, strategy_identifier_namespace, channel, status,
        last_message_id, operating_strategy_id, operating_strategy_version_id,
        strategy_binding_mode, strategy_binding_recorded_at,
        strategy_writer_release, destination_mode_snapshot,
        destination_path_snapshot, cta_label_snapshot,
        operating_contract_fingerprint, governed_stage,
        dispatch_reservation_id, dispatch_channel, dispatch_intent_at,
        outreach_purpose, consent_basis_snapshot_json,
        suppression_snapshot_json, message_version_key
      )
      SELECT
        %L::UUID, 'seller_options_intake', 'operating_strategy', 'email', 'queued',
        'gate3c-local-message-one', strategy.operating_strategy_id, strategy.id,
        'governed_v1', statement_timestamp(), 'gate3c-db-test',
        strategy.destination_mode, strategy.destination_path, strategy.cta_label,
        %L, 'dispatch_intent', %L::UUID, 'resend_email', %L::TIMESTAMPTZ,
        'Request a permissioned seller options review', '{}'::JSONB,
        '{"suppressionCleared":true,"checkedAt":"2026-08-15T00:00:00Z","evidenceKey":"suppression:test"}'::JSONB,
        'seller-options-message-v1'
      FROM public.operating_strategy_versions strategy
      WHERE strategy.id = %L::UUID
    $statement$,
    current_setting('gate3c.test.enrollment_one_id'),
    current_setting('gate3c.test.contract_fingerprint'),
    current_setting('gate3c.test.reservation_one_id'),
    current_setting('gate3c.test.intent_one_at'),
    current_setting('gate3c.test.version_id')
  ),
  'empty consent evidence must reject a dispatch intent',
  '23514'
);

INSERT INTO public.command_center_outbound_enrollments(
  id,
  strategy_key,
  strategy_identifier_namespace,
  channel,
  status,
  last_message_id,
  operating_strategy_id,
  operating_strategy_version_id,
  strategy_binding_mode,
  strategy_binding_recorded_at,
  strategy_writer_release,
  destination_mode_snapshot,
  destination_path_snapshot,
  cta_label_snapshot,
  operating_contract_fingerprint,
  governed_stage,
  dispatch_reservation_id,
  dispatch_channel,
  dispatch_intent_at,
  outreach_purpose,
  consent_basis_snapshot_json,
  suppression_snapshot_json,
  message_version_key
)
SELECT
  current_setting('gate3c.test.enrollment_one_id')::UUID,
  'seller_options_intake',
  'operating_strategy',
  'email',
  'queued',
  'gate3c-local-message-one',
  version.operating_strategy_id,
  version.id,
  'governed_v1',
  statement_timestamp(),
  'gate3c-db-test',
  version.destination_mode,
  version.destination_path,
  version.cta_label,
  current_setting('gate3c.test.contract_fingerprint'),
  'dispatch_intent',
  current_setting('gate3c.test.reservation_one_id')::UUID,
  'resend_email',
  current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
  'Request a permissioned seller options review',
  jsonb_build_object(
    'dispatchAuthorized', TRUE,
    'basis', 'documented customer request',
    'evidenceKey', 'consent:gate3c-one'
  ),
  jsonb_build_object(
    'suppressionCleared', TRUE,
    'checkedAt', current_setting('gate3c.test.suppression_one_at')::TIMESTAMPTZ,
    'evidenceKey', 'suppression:gate3c-one'
  ),
  'seller-options-message-v1'
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SELECT set_config(
  'gate3c.test.activity_one_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'enrollment',
    p_activity_namespace => 'command_center_outbound_enrollment',
    p_activity_key => current_setting('gate3c.test.enrollment_one_id'),
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-enrollment-activity-one',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_outbound_enrollment_id => current_setting('gate3c.test.enrollment_one_id')::UUID,
    p_dispatch_reservation_id => current_setting('gate3c.test.reservation_one_id')::UUID,
    p_dispatch_channel => 'resend_email',
    p_dispatch_intent_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_outreach_purpose => 'Request a permissioned seller options review',
    p_consent_basis_snapshot_json => jsonb_build_object(
      'dispatchAuthorized', TRUE,
      'basis', 'documented customer request',
      'evidenceKey', 'consent:gate3c-one'
    ),
    p_suppression_snapshot_json => jsonb_build_object(
      'suppressionCleared', TRUE,
      'checkedAt', current_setting('gate3c.test.suppression_one_at')::TIMESTAMPTZ,
      'evidenceKey', 'suppression:gate3c-one'
    ),
    p_message_version_key => 'seller-options-message-v1',
    p_provenance_json => '[{"source":"gate3c database regression"}]'::JSONB,
    p_metadata_json => '{"fixture":true}'::JSONB
  )::TEXT,
  TRUE
);

UPDATE public.command_center_outbound_enrollments
SET canonical_activity_id = current_setting('gate3c.test.activity_one_id')::UUID
WHERE id = current_setting('gate3c.test.enrollment_one_id')::UUID;

SELECT pg_temp.assert_true(
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'enrollment',
    p_activity_namespace => 'command_center_outbound_enrollment',
    p_activity_key => current_setting('gate3c.test.enrollment_one_id'),
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-enrollment-activity-one',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_outbound_enrollment_id => current_setting('gate3c.test.enrollment_one_id')::UUID,
    p_dispatch_reservation_id => current_setting('gate3c.test.reservation_one_id')::UUID,
    p_dispatch_channel => 'resend_email',
    p_dispatch_intent_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_outreach_purpose => 'Request a permissioned seller options review',
    p_consent_basis_snapshot_json => jsonb_build_object(
      'dispatchAuthorized', TRUE,
      'basis', 'documented customer request',
      'evidenceKey', 'consent:gate3c-one'
    ),
    p_suppression_snapshot_json => jsonb_build_object(
      'suppressionCleared', TRUE,
      'checkedAt', current_setting('gate3c.test.suppression_one_at')::TIMESTAMPTZ,
      'evidenceKey', 'suppression:gate3c-one'
    ),
    p_message_version_key => 'seller-options-message-v1',
    p_provenance_json => '[{"source":"gate3c database regression"}]'::JSONB,
    p_metadata_json => '{"fixture":true}'::JSONB
  ) = current_setting('gate3c.test.activity_one_id')::UUID,
  'exact activity retry must not consume reservation capacity twice'
);

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 1
    FROM public.operating_strategy_activities
    WHERE dispatch_reservation_id = current_setting('gate3c.test.reservation_one_id')::UUID
      AND activity_type = 'enrollment'
  ),
  'one logical send must have exactly one canonical enrollment activity'
);

SELECT set_config('gate3c.test.reservation_two_id', reservation.reservation_id::TEXT, TRUE)
FROM public.reserve_operating_strategy_dispatch(
  current_setting('gate3c.test.version_id')::UUID,
  current_setting('gate3c.test.contract_fingerprint'),
  'outlook_graph', 1, 'gate3c-reservation-two', 'gate3c-db-test', 900,
  ARRAY['resend_email']::TEXT[]
) reservation;

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.reserve_operating_strategy_dispatch(
        %L::UUID, %L, 'resend_email', 1,
        'gate3c-cap-contender', 'gate3c-db-test', 900,
        ARRAY['outlook_graph']::TEXT[]
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.contract_fingerprint')
  ),
  'a serialized cap contender must fail after consumed plus outstanding capacity reaches two',
  '23514'
);

SELECT set_config('gate3c.test.enrollment_two_id', gen_random_uuid()::TEXT, TRUE),
       set_config('gate3c.test.intent_two_at', statement_timestamp()::TEXT, TRUE),
       set_config('gate3c.test.suppression_two_at', statement_timestamp()::TEXT, TRUE);

INSERT INTO public.command_center_outbound_enrollments(
  id, strategy_key, strategy_identifier_namespace, channel, status,
  last_message_id, operating_strategy_id, operating_strategy_version_id,
  strategy_binding_mode, strategy_binding_recorded_at, strategy_writer_release,
  destination_mode_snapshot, destination_path_snapshot, cta_label_snapshot,
  operating_contract_fingerprint, governed_stage, dispatch_reservation_id,
  dispatch_channel, dispatch_intent_at, outreach_purpose,
  consent_basis_snapshot_json, suppression_snapshot_json, message_version_key
)
SELECT
  current_setting('gate3c.test.enrollment_two_id')::UUID,
  'seller_options_intake', 'operating_strategy', 'email', 'queued',
  'gate3c-local-message-two', version.operating_strategy_id, version.id,
  'governed_v1', statement_timestamp(), 'gate3c-db-test',
  version.destination_mode, version.destination_path, version.cta_label,
  current_setting('gate3c.test.contract_fingerprint'), 'dispatch_intent',
  current_setting('gate3c.test.reservation_two_id')::UUID, 'outlook_graph',
  current_setting('gate3c.test.intent_two_at')::TIMESTAMPTZ,
  'Request a permissioned seller options review',
  jsonb_build_object(
    'dispatchAuthorized', TRUE,
    'basis', 'documented customer request',
    'evidenceKey', 'consent:gate3c-two'
  ),
  jsonb_build_object(
    'suppressionCleared', TRUE,
    'checkedAt', current_setting('gate3c.test.suppression_two_at')::TIMESTAMPTZ,
    'evidenceKey', 'suppression:gate3c-two'
  ),
  'seller-options-message-v1'
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SELECT pg_temp.expect_error(
  format(
    $statement$
      UPDATE public.command_center_outbound_enrollments
      SET canonical_activity_id = %L::UUID
      WHERE id = %L::UUID
    $statement$,
    current_setting('gate3c.test.activity_one_id'),
    current_setting('gate3c.test.enrollment_two_id')
  ),
  'an enrollment cannot attach another entity canonical activity',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_activity(
        p_operating_strategy_version_id => %L::UUID,
        p_activity_type => 'delivery',
        p_activity_namespace => 'provider_delivery',
        p_activity_key => 'gate3c-pre-parent-delivery',
        p_subject_namespace => 'seller_case',
        p_subject_key => 'gate3c-seller-subject-one',
        p_idempotency_key => 'gate3c-pre-parent-delivery',
        p_writer_release => 'gate3c-db-test',
        p_occurred_at => %L::TIMESTAMPTZ - INTERVAL '1 microsecond',
        p_parent_activity_id => %L::UUID,
        p_provider => 'resend',
        p_provider_message_id => 'gate3c-provider-message-pre-parent',
        p_provenance_json => '[{"source":"pre-parent rejection fixture"}]'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.intent_one_at'),
    current_setting('gate3c.test.activity_one_id')
  ),
  'a child callback must not predate its immutable parent',
  '23514'
);

SELECT set_config(
  'gate3c.test.delivery_activity_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'delivery',
    p_activity_namespace => 'provider_delivery',
    p_activity_key => 'gate3c-provider-delivery-one',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-provider-delivery-one',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_parent_activity_id => current_setting('gate3c.test.activity_one_id')::UUID,
    p_provider => 'resend',
    p_provider_message_id => 'gate3c-provider-message-one',
    p_provenance_json => '[{"source":"provider callback"}]'::JSONB,
    p_metadata_json => '{"deliveryStatus":"delivered"}'::JSONB
  )::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.pre_retirement_child_domain_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'domain_event',
    p_activity_namespace => 'seller_case_event',
    p_activity_key => 'gate3c-pre-retirement-child-domain',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-pre-retirement-child-domain',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_parent_activity_id => current_setting('gate3c.test.delivery_activity_id')::UUID,
    p_provenance_json => '[{"source":"pre-retirement child fixture"}]'::JSONB,
    p_metadata_json => '{"event":"active_era_child_domain"}'::JSONB
  )::TEXT,
  TRUE
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'primary_conversion', 'seller.operator_qualified',
        'seller_case', 'gate3c-seller-subject-one', 'verified',
        'gate3c-delivery-is-not-conversion', 'gate3c-db-test',
        ARRAY[%L::UUID], statement_timestamp(), 'provider', 'resend', NULL,
        '[{"kind":"delivery"}]'::JSONB, '{}'::JSONB,
        '[{"source":"provider callback"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.delivery_activity_id')
  ),
  'delivery telemetry cannot be a primary conversion',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'verified_value', 'seller.delivery_value',
        'seller_case', 'gate3c-seller-subject-one', 'verified',
        'gate3c-delivery-is-not-value', 'gate3c-db-test',
        ARRAY[%L::UUID], statement_timestamp(), 'provider', 'resend', NULL,
        '[{"kind":"delivery"}]'::JSONB, '{"amount":1}'::JSONB,
        '[{"source":"provider callback"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.delivery_activity_id')
  ),
  'delivery or reply telemetry cannot prove verified value',
  '23514'
);

RESET ROLE;

CREATE OR REPLACE FUNCTION pg_temp.record_window_evidence(
  p_suffix TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_include_guardrail BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  domain_activity_id UUID;
BEGIN
  domain_activity_id := public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'domain_event',
    p_activity_namespace => 'seller_case_event',
    p_activity_key => 'gate3c-domain-' || p_suffix,
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-learning-subject-' || p_suffix,
    p_idempotency_key => 'gate3c-domain-' || p_suffix,
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => p_occurred_at,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_provenance_json => jsonb_build_array(jsonb_build_object(
      'source', 'seller_case_event',
      'eventKey', 'gate3c-domain-' || p_suffix
    )),
    p_metadata_json => jsonb_build_object('fixtureWindow', p_suffix)
  );

  PERFORM public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'exposure',
    p_outcome_key => 'seller.governed_exposure',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-learning-subject-' || p_suffix,
    p_verification_status => 'observed',
    p_idempotency_key => 'gate3c-exposure-' || p_suffix,
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[domain_activity_id],
    p_occurred_at => p_occurred_at,
    p_evidence_json => jsonb_build_array(jsonb_build_object('domainEvent', domain_activity_id)),
    p_provenance_json => '[{"source":"seller case authority"}]'::JSONB
  );

  PERFORM public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'primary_conversion',
    p_outcome_key => 'seller.operator_qualified',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-learning-subject-' || p_suffix,
    p_verification_status => 'verified',
    p_idempotency_key => 'gate3c-primary-' || p_suffix,
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[domain_activity_id],
    p_occurred_at => p_occurred_at,
    p_verified_by_kind => 'domain_authority',
    p_verified_by_key => 'seller_case_event',
    p_evidence_json => jsonb_build_array(jsonb_build_object(
      'eventKey', 'gate3c-domain-' || p_suffix,
      'verified', TRUE
    )),
    p_provenance_json => '[{"source":"seller case authority"}]'::JSONB
  );

  IF p_include_guardrail THEN
    PERFORM public.record_operating_strategy_outcome(
      p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
      p_outcome_type => 'guardrail_failure',
      p_outcome_key => 'seller.suppression_regression',
      p_subject_namespace => 'seller_case',
      p_subject_key => 'gate3c-learning-subject-' || p_suffix,
      p_verification_status => 'verified',
      p_idempotency_key => 'gate3c-guardrail-' || p_suffix,
      p_writer_release => 'gate3c-db-test',
      p_activity_ids => ARRAY[domain_activity_id],
      p_occurred_at => p_occurred_at,
      p_verified_by_kind => 'operator',
      p_verified_by_key => 'gate3c-regression',
      p_evidence_json => '[{"guardrail":"suppression"}]'::JSONB,
      p_provenance_json => '[{"source":"operator review"}]'::JSONB
    );
  END IF;
END;
$$;

SELECT set_config(
         'gate3c.test.window_one_start',
         (date_trunc('day', statement_timestamp()) - INTERVAL '4 days')::TEXT,
         TRUE
       ),
       set_config(
         'gate3c.test.window_one_end',
         (date_trunc('day', statement_timestamp()) - INTERVAL '3 days')::TEXT,
         TRUE
       ),
       set_config(
         'gate3c.test.window_two_start',
         (date_trunc('day', statement_timestamp()) - INTERVAL '3 days')::TEXT,
         TRUE
       ),
       set_config(
         'gate3c.test.window_two_end',
         (date_trunc('day', statement_timestamp()) - INTERVAL '2 days')::TEXT,
         TRUE
       ),
       set_config(
         'gate3c.test.window_three_start',
         (date_trunc('day', statement_timestamp()) - INTERVAL '2 days')::TEXT,
         TRUE
       ),
       set_config(
         'gate3c.test.window_three_end',
         (date_trunc('day', statement_timestamp()) - INTERVAL '1 day')::TEXT,
         TRUE
       );

SET LOCAL ROLE service_role;

SELECT pg_temp.record_window_evidence(
  'one',
  current_setting('gate3c.test.window_one_start')::TIMESTAMPTZ + INTERVAL '12 hours'
);
SELECT pg_temp.record_window_evidence(
  'two',
  current_setting('gate3c.test.window_two_start')::TIMESTAMPTZ + INTERVAL '12 hours'
);

SELECT set_config('gate3c.test.domain_one_activity_id', activity.id::TEXT, TRUE)
FROM public.operating_strategy_activities activity
WHERE activity.operating_strategy_version_id = current_setting('gate3c.test.version_id')::UUID
  AND activity.idempotency_key = 'gate3c-domain-one';

SELECT pg_temp.assert_true(
  public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'verified_value',
    p_outcome_key => 'seller.domain_verified_value',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-learning-subject-one',
    p_verification_status => 'verified',
    p_idempotency_key => 'gate3c-active-domain-value-one',
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[current_setting('gate3c.test.domain_one_activity_id')::UUID],
    p_occurred_at => current_setting('gate3c.test.window_one_start')::TIMESTAMPTZ + INTERVAL '12 hours',
    p_verified_by_kind => 'domain_authority',
    p_verified_by_key => 'seller_case_event',
    p_evidence_json => '[{"kind":"operator_verified_value"}]'::JSONB,
    p_value_json => '{"amount":1,"currency":"USD"}'::JSONB,
    p_provenance_json => '[{"source":"seller case authority"}]'::JSONB
  ) IS NOT NULL,
  'a governed domain event may prove an active-version verified value'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'primary_conversion', 'seller.operator_qualified',
        'seller_case', 'gate3c-learning-subject-one', 'verified',
        'gate3c-primary-one-different-idempotency', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ + INTERVAL '12 hours',
        'domain_authority', 'seller_case_event', NULL,
        '[{"eventKey":"gate3c-domain-one","verified":true}]'::JSONB,
        '{}'::JSONB, '[{"source":"seller case authority"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.domain_one_activity_id'),
    current_setting('gate3c.test.window_one_start')
  ),
  'a different idempotency key cannot duplicate one primary-conversion unit',
  '23505'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'exposure', 'seller.governed_exposure',
        'seller_case', 'gate3c-learning-subject-one', 'observed',
        'gate3c-exposure-one-different-idempotency', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ + INTERVAL '12 hours',
        NULL, NULL, NULL,
        jsonb_build_array(jsonb_build_object('domainEvent', %L::UUID)),
        '{}'::JSONB, '[{"source":"seller case authority"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.domain_one_activity_id'),
    current_setting('gate3c.test.window_one_start'),
    current_setting('gate3c.test.domain_one_activity_id')
  ),
  'a different idempotency key cannot duplicate one exposure unit',
  '23505'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'leading_indicator', 'seller.preactivation_evidence',
        'seller_case', 'gate3c-learning-subject-one', 'observed',
        'gate3c-preactivation-outcome', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ - INTERVAL '1 minute'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.domain_one_activity_id'),
    current_setting('gate3c.test.activated_at')
  ),
  'canonical outcomes must not predate operating-version activation',
  '23514'
);

SELECT set_config(
  'gate3c.test.window_one_id',
  public.summarize_operating_strategy_learning_window(
    current_setting('gate3c.test.version_id')::UUID,
    'gate3c-window-one',
    current_setting('gate3c.test.window_one_start')::TIMESTAMPTZ,
    current_setting('gate3c.test.window_one_end')::TIMESTAMPTZ,
    'gate3c-window-one',
    'gate3c-db-test'
  )::TEXT,
  TRUE
);
SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.summarize_operating_strategy_learning_window(
        %L::UUID,
        'gate3c-gapped-second-window',
        %L::TIMESTAMPTZ + INTERVAL '1 hour',
        %L::TIMESTAMPTZ + INTERVAL '1 day 1 hour',
        'gate3c-gapped-second-window',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.window_one_end'),
    current_setting('gate3c.test.window_one_end')
  ),
  'a later learning window cannot skip a gap after the prior window',
  '23514'
);
SELECT set_config(
  'gate3c.test.window_two_id',
  public.summarize_operating_strategy_learning_window(
    current_setting('gate3c.test.version_id')::UUID,
    'gate3c-window-two',
    current_setting('gate3c.test.window_two_start')::TIMESTAMPTZ,
    current_setting('gate3c.test.window_two_end')::TIMESTAMPTZ,
    'gate3c-window-two',
    'gate3c-db-test'
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
      AND bool_and(eligible_for_review)
      AND bool_and(exposure_count >= minimum_exposure)
      AND bool_and(primary_conversion_count >= minimum_primary_conversions)
      AND bool_and(guardrail_failure_count = 0)
      AND bool_and(required_complete_windows = 2)
      AND bool_and(operating_contract_fingerprint =
        current_setting('gate3c.test.contract_fingerprint'))
    FROM public.operating_strategy_learning_windows
    WHERE id = ANY(ARRAY[
      current_setting('gate3c.test.window_one_id')::UUID,
      current_setting('gate3c.test.window_two_id')::UUID
    ])
  ),
  'two complete windows must meet the pinned exposure and conversion contract'
);

SELECT pg_temp.assert_true(
  public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'exposure',
    p_outcome_key => 'seller.governed_exposure',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-learning-subject-one',
    p_verification_status => 'observed',
    p_idempotency_key => 'gate3c-exposure-one',
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[current_setting('gate3c.test.domain_one_activity_id')::UUID],
    p_occurred_at => current_setting('gate3c.test.window_one_start')::TIMESTAMPTZ + INTERVAL '12 hours',
    p_evidence_json => jsonb_build_array(jsonb_build_object(
      'domainEvent', current_setting('gate3c.test.domain_one_activity_id')::UUID
    )),
    p_provenance_json => '[{"source":"seller case authority"}]'::JSONB
  ) = (
    SELECT outcome.id
    FROM public.operating_strategy_outcomes outcome
    WHERE outcome.operating_strategy_version_id = current_setting('gate3c.test.version_id')::UUID
      AND outcome.idempotency_key = 'gate3c-exposure-one'
  ),
  'an exact outcome replay must remain idempotent after its window is finalized'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'leading_indicator', 'seller.late_backfill',
        'seller_case', 'gate3c-learning-subject-one', 'observed',
        'gate3c-late-backfill-after-summary', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ + INTERVAL '12 hours'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.domain_one_activity_id'),
    current_setting('gate3c.test.window_one_start')
  ),
  'a finalized learning window must reject a late backdated outcome',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.summarize_operating_strategy_learning_window(
        %L::UUID, 'gate3c-future-window', statement_timestamp(),
        statement_timestamp() + INTERVAL '1 day',
        'gate3c-future-window', 'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id')
  ),
  'incomplete future learning windows must fail',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.submit_operating_strategy_review_manifest(
        %L::UUID,
        'learning_proposal',
        'gate3c-auto-apply',
        '{"autoApply":true,"change":"promote cadence"}'::JSONB,
        ARRAY[%L::UUID,%L::UUID],
        'agent',
        'gate3c_test_agent',
        NULL,
        'gate3c-auto-apply',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.window_one_id'),
    current_setting('gate3c.test.window_two_id')
  ),
  'learning proposals cannot auto-apply',
  '23514'
);

SELECT set_config(
  'gate3c.test.manifest_id',
  public.submit_operating_strategy_review_manifest(
    current_setting('gate3c.test.version_id')::UUID,
    'learning_proposal',
    'gate3c-two-window-proposal',
    '{"autoApply":false,"change":"founder review of cadence evidence"}'::JSONB,
    ARRAY[
      current_setting('gate3c.test.window_one_id')::UUID,
      current_setting('gate3c.test.window_two_id')::UUID
    ],
    'agent',
    'gate3c_test_agent',
    NULL,
    'gate3c-two-window-proposal',
    'gate3c-db-test'
  )::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.manifest_fingerprint',
  manifest.proposal_fingerprint,
  TRUE
)
FROM public.operating_strategy_review_manifests manifest
WHERE manifest.id = current_setting('gate3c.test.manifest_id')::UUID;

SELECT set_config(
  'gate3c.test.self_manifest_id',
  public.submit_operating_strategy_review_manifest(
    current_setting('gate3c.test.version_id')::UUID,
    'learning_proposal',
    'gate3c-self-authored-proposal',
    '{"autoApply":false,"change":"self-authored review test"}'::JSONB,
    ARRAY[
      current_setting('gate3c.test.window_one_id')::UUID,
      current_setting('gate3c.test.window_two_id')::UUID
    ],
    'operator',
    'gate3c_self_proposer',
    current_setting('gate3c.test.reviewer_id')::UUID,
    'gate3c-self-authored-proposal',
    'gate3c-db-test'
  )::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.self_manifest_fingerprint',
  manifest.proposal_fingerprint,
  TRUE
)
FROM public.operating_strategy_review_manifests manifest
WHERE manifest.id = current_setting('gate3c.test.self_manifest_id')::UUID;

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
    FROM public.operating_strategy_review_manifest_windows
    WHERE manifest_id = current_setting('gate3c.test.manifest_id')::UUID
  ),
  'review manifest must pin exactly two immutable window fingerprints'
);

SELECT set_config('gate3c.test.quarantine_at', statement_timestamp()::TEXT, TRUE);

SELECT set_config(
  'gate3c.test.quarantine_id',
  public.record_operating_strategy_attribution_quarantine(
    'provider_callback',
    'gate3c-ambiguous-callback',
    'ambiguous_governed_enrollment',
    '{"provider":"resend","messageId":"ambiguous-test"}'::JSONB,
    '[{"enrollmentId":"candidate-one"},{"enrollmentId":"candidate-two"}]'::JSONB,
    md5('gate3c-ambiguous-callback-payload'),
    current_setting('gate3c.test.quarantine_at')::TIMESTAMPTZ,
    'gate3c-db-test'
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  public.record_operating_strategy_attribution_quarantine(
    'provider_callback',
    'gate3c-ambiguous-callback',
    'ambiguous_governed_enrollment',
    '{"provider":"resend","messageId":"ambiguous-test"}'::JSONB,
    '[{"enrollmentId":"candidate-one"},{"enrollmentId":"candidate-two"}]'::JSONB,
    md5('gate3c-ambiguous-callback-payload'),
    current_setting('gate3c.test.quarantine_at')::TIMESTAMPTZ,
    'gate3c-db-test'
  ) = current_setting('gate3c.test.quarantine_id')::UUID,
  'ambiguous attribution quarantine must replay idempotently'
);

-- The third complete window meets the numeric thresholds but includes a
-- guardrail failure, so it is ineligible and blocks any new latest-two proposal.
SELECT pg_temp.record_window_evidence(
  'three',
  current_setting('gate3c.test.window_three_start')::TIMESTAMPTZ + INTERVAL '12 hours',
  TRUE
);
SELECT set_config(
  'gate3c.test.window_three_id',
  public.summarize_operating_strategy_learning_window(
    current_setting('gate3c.test.version_id')::UUID,
    'gate3c-window-three',
    current_setting('gate3c.test.window_three_start')::TIMESTAMPTZ,
    current_setting('gate3c.test.window_three_end')::TIMESTAMPTZ,
    'gate3c-window-three',
    'gate3c-db-test'
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT NOT eligible_for_review
      AND exposure_count >= minimum_exposure
      AND primary_conversion_count >= minimum_primary_conversions
      AND guardrail_failure_count = 1
    FROM public.operating_strategy_learning_windows
    WHERE id = current_setting('gate3c.test.window_three_id')::UUID
  ),
  'a guardrail failure must block an otherwise eligible complete window'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.submit_operating_strategy_review_manifest(
        %L::UUID,
        'learning_proposal',
        'gate3c-guardrail-blocked-proposal',
        '{"autoApply":false,"change":"must remain blocked"}'::JSONB,
        ARRAY[%L::UUID,%L::UUID],
        'agent',
        'gate3c_test_agent',
        NULL,
        'gate3c-guardrail-blocked-proposal',
        'gate3c-db-test'
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.window_two_id'),
    current_setting('gate3c.test.window_three_id')
  ),
  'a latest complete window with a guardrail failure must block a proposal',
  '23514'
);

RESET ROLE;

SELECT set_config('gate3c.test.orchestration_run_id', gen_random_uuid()::TEXT, TRUE);

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  format(
    $statement$
      INSERT INTO public.orchestration_runs(
        id, integration_key, event_type, idempotency_key, mode, channel,
        status, request_digest, strategy_key, strategy_identifier_namespace,
        operating_strategy_id, operating_strategy_version_id,
        outbound_enrollment_id, dispatch_reservation_id,
        subject_namespace, subject_key, strategy_binding_mode,
        strategy_binding_recorded_at, strategy_writer_release,
        destination_mode_snapshot, destination_path_snapshot,
        cta_label_snapshot, operating_contract_fingerprint,
        canonical_activity_id
      )
      SELECT
        %L::UUID, 'n8n', 'gate3c_governed_dispatch',
        'gate3c-governed-live-run', 'approved_live', 'resend_email',
        'queued', md5('gate3c-governed-live-run'),
        'seller_options_intake', 'operating_strategy',
        version.operating_strategy_id, version.id,
        %L::UUID, %L::UUID, 'seller_case', 'gate3c-seller-subject-one',
        'governed_v1', statement_timestamp(), 'gate3c-db-test',
        version.destination_mode, version.destination_path, version.cta_label,
        %L, %L::UUID
      FROM public.operating_strategy_versions version
      WHERE version.id = %L::UUID
    $statement$,
    current_setting('gate3c.test.orchestration_run_id'),
    current_setting('gate3c.test.enrollment_one_id'),
    current_setting('gate3c.test.reservation_one_id'),
    current_setting('gate3c.test.contract_fingerprint'),
    current_setting('gate3c.test.activity_one_id'),
    current_setting('gate3c.test.version_id')
  ),
  'governed approved-live n8n run must fail while the integration control is disabled',
  '23514'
);
RESET ROLE;

UPDATE public.orchestration_controls
SET live_send_enabled = TRUE,
    kill_switch = FALSE,
    approved_channels_json = approved_channels_json || '["resend_email"]'::JSONB,
    updated_at = statement_timestamp()
WHERE integration_key = 'n8n';

SET LOCAL ROLE service_role;
INSERT INTO public.orchestration_runs(
  id,
  integration_key,
  event_type,
  idempotency_key,
  mode,
  channel,
  status,
  request_digest,
  strategy_key,
  strategy_identifier_namespace,
  operating_strategy_id,
  operating_strategy_version_id,
  outbound_enrollment_id,
  dispatch_reservation_id,
  subject_namespace,
  subject_key,
  strategy_binding_mode,
  strategy_binding_recorded_at,
  strategy_writer_release,
  destination_mode_snapshot,
  destination_path_snapshot,
  cta_label_snapshot,
  operating_contract_fingerprint,
  canonical_activity_id
)
SELECT
  current_setting('gate3c.test.orchestration_run_id')::UUID,
  'n8n',
  'gate3c_governed_dispatch',
  'gate3c-governed-live-run',
  'approved_live',
  'resend_email',
  'queued',
  md5('gate3c-governed-live-run'),
  'seller_options_intake',
  'operating_strategy',
  version.operating_strategy_id,
  version.id,
  current_setting('gate3c.test.enrollment_one_id')::UUID,
  current_setting('gate3c.test.reservation_one_id')::UUID,
  'seller_case',
  'gate3c-seller-subject-one',
  'governed_v1',
  statement_timestamp(),
  'gate3c-db-test',
  version.destination_mode,
  version.destination_path,
  version.cta_label,
  current_setting('gate3c.test.contract_fingerprint'),
  current_setting('gate3c.test.activity_one_id')::UUID
FROM public.operating_strategy_versions version
WHERE version.id = current_setting('gate3c.test.version_id')::UUID;

SELECT pg_temp.expect_error(
  format(
    $statement$
      UPDATE public.orchestration_runs
      SET channel = 'outlook_graph'
      WHERE id = %L::UUID
    $statement$,
    current_setting('gate3c.test.orchestration_run_id')
  ),
  'governed approved-live orchestration lineage must be immutable',
  '23514'
);

SELECT pg_temp.assert_true(
  (
    SELECT outbound_enrollment_id = current_setting('gate3c.test.enrollment_one_id')::UUID
      AND dispatch_reservation_id = current_setting('gate3c.test.reservation_one_id')::UUID
      AND canonical_activity_id = current_setting('gate3c.test.activity_one_id')::UUID
      AND operating_strategy_version_id = current_setting('gate3c.test.version_id')::UUID
      AND subject_namespace = 'seller_case'
      AND subject_key = 'gate3c-seller-subject-one'
    FROM public.orchestration_runs
    WHERE id = current_setting('gate3c.test.orchestration_run_id')::UUID
  ),
  'approved-live n8n runs must preserve exact version/enrollment/reservation/activity/subject lineage'
);
RESET ROLE;

UPDATE public.orchestration_controls
SET live_send_enabled = FALSE,
    updated_at = statement_timestamp()
WHERE integration_key = 'n8n';

-- Empty-by-default reviewer authority blocks authenticated decisions even when
-- service code attempts to supply an arbitrary actor UUID.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('gate3c.test.reviewer_id'),
  TRUE
);
SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_review_decision(
        %L::UUID,
        'approved',
        %L::UUID,
        'founder_test',
        'Founder reviewed the exact two-window evidence.',
        %L,
        'gate3c-review-decision'
      )
    $statement$,
    current_setting('gate3c.test.manifest_id'),
    current_setting('gate3c.test.reviewer_id'),
    current_setting('gate3c.test.manifest_fingerprint')
  ),
  'review decisions must fail while the founder allowlist is empty',
  '42501'
);
RESET ROLE;

-- Rollback-only founder authority bootstrap. Gate 3C itself seeds no reviewer.
INSERT INTO public.operating_strategy_reviewer_authorities(
  user_id,
  authority_role,
  can_review_learning,
  can_activate_operating_versions,
  valid_from,
  source_provenance_json,
  authority_fingerprint
) VALUES (
  current_setting('gate3c.test.reviewer_id')::UUID,
  'founder_reviewer',
  TRUE,
  TRUE,
  statement_timestamp() - INTERVAL '1 minute',
  '[{"source":"rollback-only Gate 3C database regression"}]'::JSONB,
  '00000000000000000000000000000000'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('gate3c.test.reviewer_id'),
  TRUE
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_review_decision(
        %L::UUID,
        'approved',
        %L::UUID,
        'founder_test',
        'A proposer cannot approve their own proposal.',
        %L,
        'gate3c-self-review-decision'
      )
    $statement$,
    current_setting('gate3c.test.self_manifest_id'),
    current_setting('gate3c.test.reviewer_id'),
    current_setting('gate3c.test.self_manifest_fingerprint')
  ),
  'a founder reviewer cannot self-approve a manifest',
  '23514'
);

SELECT set_config(
  'gate3c.test.decision_id',
  public.record_operating_strategy_review_decision(
    current_setting('gate3c.test.manifest_id')::UUID,
    'approved',
    current_setting('gate3c.test.reviewer_id')::UUID,
    'founder_test',
    'Founder reviewed the exact two-window evidence.',
    current_setting('gate3c.test.manifest_fingerprint'),
    'gate3c-review-decision'
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  public.record_operating_strategy_review_decision(
    current_setting('gate3c.test.manifest_id')::UUID,
    'approved',
    current_setting('gate3c.test.reviewer_id')::UUID,
    'founder_test',
    'Founder reviewed the exact two-window evidence.',
    current_setting('gate3c.test.manifest_fingerprint'),
    'gate3c-review-decision'
  ) = current_setting('gate3c.test.decision_id')::UUID,
  'an exact founder decision retry must be idempotent'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.activate_operating_strategy_version(%L::UUID, %L::UUID)
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.reviewer_id')
  ),
  'activation remains blocked while the runtime control is in compatibility staging',
  '23514'
);

RESET ROLE;

-- Retire the rollback fixture and close its source mapping to simulate a real
-- late provider callback after both version and crosswalk have moved on.
SET LOCAL session_replication_role = replica;
UPDATE public.operating_strategy_versions
SET status = 'retired', retired_at = clock_timestamp()
WHERE id = current_setting('gate3c.test.version_id')::UUID;
UPDATE public.strategy_identifier_crosswalk
SET resolution_status = 'retired',
    allows_new_activity = FALSE,
    valid_to = statement_timestamp(),
    updated_at = statement_timestamp()
WHERE source_namespace = 'operating_strategy'
  AND source_identifier = 'seller_options_intake'
  AND resolution_status = 'current'
  AND valid_to IS NULL;
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE service_role;

SELECT pg_temp.assert_true(
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'enrollment',
    p_activity_namespace => 'command_center_outbound_enrollment',
    p_activity_key => current_setting('gate3c.test.enrollment_one_id'),
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-enrollment-activity-one',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_outbound_enrollment_id => current_setting('gate3c.test.enrollment_one_id')::UUID,
    p_dispatch_reservation_id => current_setting('gate3c.test.reservation_one_id')::UUID,
    p_dispatch_channel => 'resend_email',
    p_dispatch_intent_at => current_setting('gate3c.test.intent_one_at')::TIMESTAMPTZ,
    p_outreach_purpose => 'Request a permissioned seller options review',
    p_consent_basis_snapshot_json => jsonb_build_object(
      'dispatchAuthorized', TRUE,
      'basis', 'documented customer request',
      'evidenceKey', 'consent:gate3c-one'
    ),
    p_suppression_snapshot_json => jsonb_build_object(
      'suppressionCleared', TRUE,
      'checkedAt', current_setting('gate3c.test.suppression_one_at')::TIMESTAMPTZ,
      'evidenceKey', 'suppression:gate3c-one'
    ),
    p_message_version_key => 'seller-options-message-v1',
    p_provenance_json => '[{"source":"gate3c database regression"}]'::JSONB,
    p_metadata_json => '{"fixture":true}'::JSONB
  ) = current_setting('gate3c.test.activity_one_id')::UUID,
  'an exact activity replay must remain valid after version retirement'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_activity(
        p_operating_strategy_version_id => %L::UUID,
        p_activity_type => 'enrollment',
        p_activity_namespace => 'command_center_outbound_enrollment',
        p_activity_key => %L,
        p_subject_namespace => 'seller_case',
        p_subject_key => 'gate3c-seller-subject-two',
        p_idempotency_key => 'gate3c-retired-new-enrollment',
        p_writer_release => 'gate3c-db-test',
        p_occurred_at => %L::TIMESTAMPTZ,
        p_source_namespace => 'operating_strategy',
        p_source_identifier => 'seller_options_intake',
        p_outbound_enrollment_id => %L::UUID,
        p_dispatch_reservation_id => %L::UUID,
        p_dispatch_channel => 'outlook_graph',
        p_dispatch_intent_at => %L::TIMESTAMPTZ,
        p_outreach_purpose => 'Request a permissioned seller options review',
        p_consent_basis_snapshot_json =>
          '{"dispatchAuthorized":true,"basis":"documented customer request","evidenceKey":"consent:gate3c-two"}'::JSONB,
        p_suppression_snapshot_json => jsonb_build_object(
          'suppressionCleared', TRUE,
          'checkedAt', %L::TIMESTAMPTZ,
          'evidenceKey', 'suppression:gate3c-two'
        ),
        p_message_version_key => 'seller-options-message-v1',
        p_provenance_json => '[{"source":"gate3c database regression"}]'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.enrollment_two_id'),
    current_setting('gate3c.test.intent_two_at'),
    current_setting('gate3c.test.enrollment_two_id'),
    current_setting('gate3c.test.reservation_two_id'),
    current_setting('gate3c.test.intent_two_at'),
    current_setting('gate3c.test.suppression_two_at')
  ),
  'a retired version must reject a new root enrollment',
  '23514'
);

SELECT set_config(
  'gate3c.test.late_delivery_at',
  GREATEST(statement_timestamp(), activity.occurred_at)::TEXT,
  TRUE
)
FROM public.operating_strategy_activities activity
WHERE activity.id = current_setting('gate3c.test.activity_one_id')::UUID;

SELECT set_config(
  'gate3c.test.late_delivery_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'delivery',
    p_activity_namespace => 'provider_delivery',
    p_activity_key => 'gate3c-late-delivery',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-late-delivery',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.late_delivery_at')::TIMESTAMPTZ,
    p_parent_activity_id => current_setting('gate3c.test.activity_one_id')::UUID,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_provider => 'resend',
    p_provider_message_id => 'gate3c-provider-message-late',
    p_provenance_json => '[{"source":"late provider callback"}]'::JSONB,
    p_metadata_json => '{"deliveryStatus":"delivered_after_retirement"}'::JSONB
  )::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.late_reply_at',
  (current_setting('gate3c.test.late_delivery_at')::TIMESTAMPTZ
    + INTERVAL '1 microsecond')::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.late_reply_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'reply',
    p_activity_namespace => 'provider_reply',
    p_activity_key => 'gate3c-late-reply',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-late-reply',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.late_reply_at')::TIMESTAMPTZ,
    p_parent_activity_id => current_setting('gate3c.test.late_delivery_id')::UUID,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_provenance_json => '[{"source":"late reply callback"}]'::JSONB,
    p_metadata_json => '{"classification":"human_review"}'::JSONB
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
      AND bool_and(operating_contract_fingerprint =
        current_setting('gate3c.test.contract_fingerprint'))
      AND bool_and(source_namespace = 'operating_strategy')
      AND bool_and(source_identifier = 'seller_options_intake')
    FROM public.operating_strategy_activities
    WHERE id = ANY(ARRAY[
      current_setting('gate3c.test.late_delivery_id')::UUID,
      current_setting('gate3c.test.late_reply_id')::UUID
    ])
  ),
  'late callbacks must inherit the retired parent fingerprint and closed source attribution'
);

SELECT set_config(
  'gate3c.test.learning_window_digest_before_late_outcomes',
  md5(COALESCE(jsonb_agg(to_jsonb(learning_window) ORDER BY learning_window.id)::TEXT, '[]')),
  TRUE
)
FROM public.operating_strategy_learning_windows learning_window
WHERE learning_window.operating_strategy_version_id = current_setting('gate3c.test.version_id')::UUID;

SELECT set_config(
  'gate3c.test.late_domain_at',
  (current_setting('gate3c.test.late_reply_at')::TIMESTAMPTZ
    + INTERVAL '1 microsecond')::TEXT,
  TRUE
);
SELECT set_config(
  'gate3c.test.late_outcome_at',
  (current_setting('gate3c.test.late_domain_at')::TIMESTAMPTZ
    + INTERVAL '1 microsecond')::TEXT,
  TRUE
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'primary_conversion', 'seller.retired_root_only',
        'seller_case', 'gate3c-learning-subject-one', 'verified',
        'gate3c-retired-root-only-conversion', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ,
        'domain_authority', 'seller_case_event', NULL,
        '[{"kind":"retired root-only fixture"}]'::JSONB, '{}'::JSONB,
        '[{"source":"gate3c database regression"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.domain_one_activity_id'),
    current_setting('gate3c.test.late_outcome_at')
  ),
  'a retired primary conversion cannot rely only on an active-era root event',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'primary_conversion', 'seller.retired_old_child_only',
        'seller_case', 'gate3c-seller-subject-one', 'verified',
        'gate3c-retired-old-child-only-conversion', 'gate3c-db-test',
        ARRAY[%L::UUID], %L::TIMESTAMPTZ,
        'domain_authority', 'seller_case_event', NULL,
        '[{"kind":"pre-retirement child rejection"}]'::JSONB, '{}'::JSONB,
        '[{"source":"gate3c database regression"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.pre_retirement_child_domain_id'),
    current_setting('gate3c.test.late_outcome_at')
  ),
  'a pre-retirement child domain event cannot prove a late retired conversion',
  '23514'
);

SELECT set_config(
  'gate3c.test.late_domain_activity_id',
  public.record_operating_strategy_activity(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_activity_type => 'domain_event',
    p_activity_namespace => 'seller_case_event',
    p_activity_key => 'gate3c-late-domain-conversion',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_idempotency_key => 'gate3c-late-domain-conversion',
    p_writer_release => 'gate3c-db-test',
    p_occurred_at => current_setting('gate3c.test.late_domain_at')::TIMESTAMPTZ,
    p_parent_activity_id => current_setting('gate3c.test.late_reply_id')::UUID,
    p_source_namespace => 'operating_strategy',
    p_source_identifier => 'seller_options_intake',
    p_provenance_json => '[{"source":"late seller case authority"}]'::JSONB,
    p_metadata_json => '{"event":"operator_qualified_after_retirement"}'::JSONB
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT activity.recorded_at >= version.retired_at
    FROM public.operating_strategy_activities activity
    JOIN public.operating_strategy_versions version
      ON version.id = activity.operating_strategy_version_id
    WHERE activity.id = current_setting('gate3c.test.late_domain_activity_id')::UUID
  ),
  'the qualifying late child domain event must be recorded after retirement'
);

SELECT set_config(
  'gate3c.test.late_primary_outcome_id',
  public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'primary_conversion',
    p_outcome_key => 'seller.late_operator_qualified',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_verification_status => 'verified',
    p_idempotency_key => 'gate3c-late-primary-conversion',
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[current_setting('gate3c.test.late_domain_activity_id')::UUID],
    p_occurred_at => current_setting('gate3c.test.late_outcome_at')::TIMESTAMPTZ,
    p_verified_by_kind => 'domain_authority',
    p_verified_by_key => 'seller_case_event',
    p_evidence_json => '[{"event":"operator_qualified_after_retirement"}]'::JSONB,
    p_provenance_json => '[{"source":"late seller case authority"}]'::JSONB
  )::TEXT,
  TRUE
);

SELECT set_config(
  'gate3c.test.late_value_outcome_id',
  public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'verified_value',
    p_outcome_key => 'seller.late_verified_value',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_verification_status => 'verified',
    p_idempotency_key => 'gate3c-late-verified-value',
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[current_setting('gate3c.test.late_domain_activity_id')::UUID],
    p_occurred_at => current_setting('gate3c.test.late_outcome_at')::TIMESTAMPTZ,
    p_verified_by_kind => 'domain_authority',
    p_verified_by_key => 'seller_case_event',
    p_evidence_json => '[{"kind":"verified value after retirement"}]'::JSONB,
    p_value_json => '{"amount":1,"currency":"USD"}'::JSONB,
    p_provenance_json => '[{"source":"late seller case authority"}]'::JSONB
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  public.record_operating_strategy_outcome(
    p_operating_strategy_version_id => current_setting('gate3c.test.version_id')::UUID,
    p_outcome_type => 'primary_conversion',
    p_outcome_key => 'seller.late_operator_qualified',
    p_subject_namespace => 'seller_case',
    p_subject_key => 'gate3c-seller-subject-one',
    p_verification_status => 'verified',
    p_idempotency_key => 'gate3c-late-primary-conversion',
    p_writer_release => 'gate3c-db-test',
    p_activity_ids => ARRAY[current_setting('gate3c.test.late_domain_activity_id')::UUID],
    p_occurred_at => current_setting('gate3c.test.late_outcome_at')::TIMESTAMPTZ,
    p_verified_by_kind => 'domain_authority',
    p_verified_by_key => 'seller_case_event',
    p_evidence_json => '[{"event":"operator_qualified_after_retirement"}]'::JSONB,
    p_provenance_json => '[{"source":"late seller case authority"}]'::JSONB
  ) = current_setting('gate3c.test.late_primary_outcome_id')::UUID,
  'an exact retired-version outcome retry must remain idempotent'
);

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
      AND bool_and(outcome.operating_contract_fingerprint =
        current_setting('gate3c.test.contract_fingerprint'))
      AND bool_and(outcome.destination_mode_snapshot = activity.destination_mode_snapshot)
      AND bool_and(outcome.destination_path_snapshot IS NOT DISTINCT FROM activity.destination_path_snapshot)
      AND bool_and(outcome.cta_label_snapshot IS NOT DISTINCT FROM activity.cta_label_snapshot)
    FROM public.operating_strategy_outcomes outcome
    CROSS JOIN public.operating_strategy_activities activity
    WHERE activity.id = current_setting('gate3c.test.late_domain_activity_id')::UUID
      AND outcome.id = ANY(ARRAY[
        current_setting('gate3c.test.late_primary_outcome_id')::UUID,
        current_setting('gate3c.test.late_value_outcome_id')::UUID
      ])
  ),
  'retired outcomes must inherit the one active-era activity snapshot'
);

RESET ROLE;
SET LOCAL session_replication_role = replica;
WITH inserted AS (
  INSERT INTO public.operating_strategy_activities(
    id,
    operating_strategy_id,
    operating_strategy_version_id,
    activity_type,
    activity_namespace,
    activity_key,
    subject_namespace,
    subject_key,
    parent_activity_id,
    source_namespace,
    source_identifier,
    strategy_lead_membership_id,
    outbound_enrollment_id,
    dispatch_reservation_id,
    dispatch_channel,
    dispatch_intent_at,
    provider,
    provider_message_id,
    outreach_purpose,
    consent_basis_snapshot_json,
    suppression_snapshot_json,
    message_version_key,
    writer_release,
    destination_mode_snapshot,
    destination_path_snapshot,
    cta_label_snapshot,
    operating_contract_fingerprint,
    provenance_json,
    metadata_json,
    idempotency_key,
    activity_fingerprint,
    occurred_at
  )
  SELECT
    gen_random_uuid(),
    activity.operating_strategy_id,
    activity.operating_strategy_version_id,
    activity.activity_type,
    activity.activity_namespace,
    'gate3c-mismatched-snapshot-domain',
    activity.subject_namespace,
    activity.subject_key,
    activity.parent_activity_id,
    activity.source_namespace,
    activity.source_identifier,
    activity.strategy_lead_membership_id,
    activity.outbound_enrollment_id,
    activity.dispatch_reservation_id,
    activity.dispatch_channel,
    activity.dispatch_intent_at,
    activity.provider,
    activity.provider_message_id,
    activity.outreach_purpose,
    activity.consent_basis_snapshot_json,
    activity.suppression_snapshot_json,
    activity.message_version_key,
    activity.writer_release,
    activity.destination_mode_snapshot,
    activity.destination_path_snapshot,
    activity.cta_label_snapshot,
    repeat('f', 32),
    activity.provenance_json,
    '{"fixture":"mismatched snapshot"}'::JSONB,
    'gate3c-mismatched-snapshot-domain',
    repeat('e', 32),
    activity.occurred_at
  FROM public.operating_strategy_activities activity
  WHERE activity.id = current_setting('gate3c.test.late_domain_activity_id')::UUID
  RETURNING id
)
SELECT set_config('gate3c.test.mismatched_snapshot_activity_id', inserted.id::TEXT, TRUE)
FROM inserted;
SET LOCAL session_replication_role = origin;
SET LOCAL ROLE service_role;

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.record_operating_strategy_outcome(
        %L::UUID, 'verified_value', 'seller.mismatched_snapshot_value',
        'seller_case', 'gate3c-seller-subject-one', 'verified',
        'gate3c-mismatched-snapshot-value', 'gate3c-db-test',
        ARRAY[%L::UUID, %L::UUID], %L::TIMESTAMPTZ,
        'domain_authority', 'seller_case_event', NULL,
        '[{"kind":"mismatched snapshot rejection"}]'::JSONB, '{"amount":1}'::JSONB,
        '[{"source":"gate3c database regression"}]'::JSONB, '{}'::JSONB
      )
    $statement$,
    current_setting('gate3c.test.version_id'),
    current_setting('gate3c.test.late_domain_activity_id'),
    current_setting('gate3c.test.mismatched_snapshot_activity_id'),
    current_setting('gate3c.test.late_outcome_at')
  ),
  'retired outcome evidence cannot mix contract or destination snapshots',
  '23514'
);

SELECT pg_temp.assert_true(
  current_setting('gate3c.test.learning_window_digest_before_late_outcomes') = (
    SELECT md5(COALESCE(
      jsonb_agg(to_jsonb(learning_window) ORDER BY learning_window.id)::TEXT,
      '[]'
    ))
    FROM public.operating_strategy_learning_windows learning_window
    WHERE learning_window.operating_strategy_version_id = current_setting('gate3c.test.version_id')::UUID
  ),
  'late retired outcomes must not change any finalized learning window'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.resolve_operating_strategy_runtime(
        'operating_strategy', 'seller_options_intake', statement_timestamp()
      )
    $statement$
  ),
  'resolver must not return a retired version or closed crosswalk',
  '23514'
);

RESET ROLE;

-- Trigger-level immutability still protects the ledgers from privileged direct
-- writes, independent of the service-role ACL checks above.
SELECT pg_temp.expect_error(
  format(
    $statement$
      UPDATE public.operating_strategy_activities
      SET metadata_json = '{"tampered":true}'::JSONB
      WHERE id = %L::UUID
    $statement$,
    current_setting('gate3c.test.activity_one_id')
  ),
  'canonical activities are append-only',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      UPDATE public.operating_strategy_review_manifests
      SET proposed_change_json = '{"tampered":true}'::JSONB
      WHERE id = %L::UUID
    $statement$,
    current_setting('gate3c.test.manifest_id')
  ),
  'review manifests are append-only',
  '23514'
);

-- ROLLBACK does not itself run deferred constraint triggers. Force all exact
-- outcome-attribution and manifest-window set checks before cleanup.
SET CONSTRAINTS ALL IMMEDIATE;

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ),
  'the rollback fixture must disable n8n before cleanup'
);

ROLLBACK;

-- Read-only post-rollback proof that none of the test activation, cap,
-- allowlist, n8n, activity, outcome, or review fixtures survived.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17
    OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions
      WHERE status <> 'draft'
         OR external_send_cap <> 0
         OR approved_at IS NOT NULL
         OR activated_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Gate 3C rollback regression changed the 17 production drafts.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_activities)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_outcomes)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_dispatch_reservations)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_learning_windows)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_review_manifests)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_review_decisions)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_attribution_quarantine) THEN
    RAISE EXCEPTION 'Gate 3C rollback regression left governed ledger fixtures behind.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3C rollback regression enabled n8n.';
  END IF;
END;
$$;
