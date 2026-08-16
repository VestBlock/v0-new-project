\set ON_ERROR_STOP on

-- DealMachine v2 observation-authority database regression.
--
-- Run only against a disposable/local database after the migration is
-- present. Every control change, strategy activation, reviewer, request,
-- observation, attribution, and deletion fixture is rolled back.

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
    RAISE EXCEPTION 'DealMachine v2 assertion failed: %', p_message;
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
    RAISE EXCEPTION 'DealMachine v2 expected failure did not occur: %', p_message;
  END IF;
  IF p_expected_sqlstate IS NOT NULL
    AND observed_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
    RAISE EXCEPTION 'DealMachine v2 failure % returned SQLSTATE %, expected % (message: %).',
      p_message,
      observed_sqlstate,
      p_expected_sqlstate,
      observed_message;
  END IF;
  IF p_expected_message IS NOT NULL
    AND observed_message IS DISTINCT FROM p_expected_message THEN
    RAISE EXCEPTION 'DealMachine v2 failure % returned message %, expected %.',
      p_message,
      observed_message,
      p_expected_message;
  END IF;
END;
$$;

-- Pin the exact safe migration default, empty additive ledgers, forced RLS,
-- append-only privileges, and service-only RPC surface before fixtures.
DO $dealmachine_v2_initial_contract$
DECLARE
  table_name TEXT;
  relation_is_forced BOOLEAN;
  function_signature TEXT;
BEGIN
  PERFORM pg_temp.assert_true(
    (
      SELECT control_version = 1
        AND required_writer_release = 'dealmachine_v2_observation_v1'
        AND NOT integration_enabled
        AND maximum_operation = 'count_only'
        AND allowed_operations_json = '["schema_read","count_only"]'::JSONB
        AND max_credits_per_run = 0
        AND max_credits_per_day = 0
        AND max_credits_per_month = 0
      FROM public.dealmachine_v2_runtime_controls
      WHERE control_key = 'primary'
    ),
    'migration default must be disabled/count-only with zero paid credits'
  );

  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_requests)
      AND NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_observations)
      AND NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_source_attributions)
      AND NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_operator_reviews),
    'the additive migration must not backfill historical rows'
  );

  FOREACH table_name IN ARRAY ARRAY[
    'dealmachine_v2_runtime_controls',
    'dealmachine_v2_credit_reservations',
    'dealmachine_v2_requests',
    'dealmachine_v2_request_evidence',
    'dealmachine_v2_credit_settlements',
    'dealmachine_v2_observations',
    'dealmachine_v2_observation_payloads',
    'dealmachine_v2_observation_evidence',
    'dealmachine_v2_observation_entity_links',
    'dealmachine_v2_source_attributions',
    'dealmachine_v2_operator_reviews'
  ] LOOP
    SELECT relation.relrowsecurity AND relation.relforcerowsecurity
      INTO relation_is_forced
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = table_name;

    PERFORM pg_temp.assert_true(
      relation_is_forced,
      format('public.%s must have forced RLS', table_name)
    );
    PERFORM pg_temp.assert_true(
      NOT has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
        AND NOT has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
        AND NOT has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
        AND NOT has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT'),
      format('public.%s must not be exposed to customer roles', table_name)
    );
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'dealmachine_v2_credit_reservations',
    'dealmachine_v2_requests',
    'dealmachine_v2_request_evidence',
    'dealmachine_v2_credit_settlements',
    'dealmachine_v2_observations',
    'dealmachine_v2_observation_payloads',
    'dealmachine_v2_observation_evidence',
    'dealmachine_v2_observation_entity_links',
    'dealmachine_v2_source_attributions',
    'dealmachine_v2_operator_reviews'
  ] LOOP
    PERFORM pg_temp.assert_true(
      NOT has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
        AND NOT has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
        AND NOT has_table_privilege('service_role', format('public.%I', table_name), 'TRUNCATE'),
      format('service_role must not rewrite public.%s', table_name)
    );
  END LOOP;

  FOREACH function_signature IN ARRAY ARRAY[
    'public.get_dealmachine_v2_runtime_control()',
    'public.begin_dealmachine_v2_request(text,text,text,text,text,text,integer,text,timestamptz)',
    'public.append_dealmachine_v2_request_evidence(uuid,text,text,text,text,integer,jsonb,jsonb,timestamptz)',
    'public.settle_dealmachine_v2_credit_reservation(uuid,text,text,integer,jsonb,timestamptz)',
    'public.append_dealmachine_v2_observation(uuid,text,text,text,jsonb,text,timestamptz,timestamptz,jsonb,numeric,timestamptz,text,text)',
    'public.link_dealmachine_v2_observation_entity(uuid,text,text,text,numeric,jsonb,text,text,timestamptz)',
    'public.record_dealmachine_v2_source_attribution(uuid,text,text,text,text,timestamptz,jsonb)',
    'public.record_dealmachine_v2_operator_review(uuid,text,text,text,uuid,text,text,timestamptz,jsonb)',
    'public.purge_dealmachine_v2_observation_payload(uuid,text,text,jsonb,uuid,timestamptz)'
  ] LOOP
    PERFORM pg_temp.assert_true(
      to_regprocedure(function_signature) IS NOT NULL
        AND has_function_privilege('service_role', function_signature, 'EXECUTE')
        AND NOT has_function_privilege('anon', function_signature, 'EXECUTE')
        AND NOT has_function_privilege('authenticated', function_signature, 'EXECUTE'),
      format('%s must be service-role only', function_signature)
    );
  END LOOP;

  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname LIKE '%dealmachine_v2%'
        AND procedure.prosecdef
    ),
    'public DealMachine RPCs must not be SECURITY DEFINER'
  );

  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'private'
        AND procedure.proname LIKE '%dealmachine_v2%'
        AND procedure.prosecdef
        AND NOT ('search_path=""' = ANY(COALESCE(procedure.proconfig, ARRAY[]::TEXT[])))
    ),
    'every private SECURITY DEFINER function must pin an empty search_path'
  );
END;
$dealmachine_v2_initial_contract$;

-- This vector is produced by recursively sorting object keys with a binary
-- comparison and applying compact JSON.stringify in the application writer.
SELECT pg_temp.assert_true(
  private.dealmachine_v2_canonical_jsonb(
    '{"z":[3,{"b":"two","a":1.25},true,null],"a":{"quote":"A \"quoted\" value","nested":[2,1]}}'::JSONB
  ) = '{"a":{"nested":[2,1],"quote":"A \"quoted\" value"},"z":[3,{"a":1.25,"b":"two"},true,null]}',
  'canonical JSON must sort nested object keys and preserve arrays/scalars'
);
SELECT pg_temp.assert_true(
  private.dealmachine_v2_sha256_jsonb(
    '{"z":[3,{"b":"two","a":1.25},true,null],"a":{"quote":"A \"quoted\" value","nested":[2,1]}}'::JSONB
  ) = '09d56d30c5706fc76059c124ed040a3a832d1583a5e52516773403749f1e1a26',
  'database canonical SHA-256 must match the TypeScript writer vector'
);

-- The disabled default rejects even free provider-call claims.
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  $statement$
    SELECT * FROM public.begin_dealmachine_v2_request(
      'dmv2-run-disabled',
      'dmv2-request-disabled',
      'count_only',
      'POST',
      '/properties/search/count',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      0,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  $statement$,
  'disabled controls must reject a provider-call claim',
  '23514'
);
RESET ROLE;

-- Transaction-local count-only enablement. This creates no paid reservation.
UPDATE public.dealmachine_v2_runtime_controls
SET control_version = 2,
    integration_enabled = TRUE,
    maximum_operation = 'count_only',
    allowed_operations_json = '["schema_read","count_only"]'::JSONB,
    max_credits_per_run = 0,
    max_credits_per_day = 0,
    max_credits_per_month = 0,
    change_reason = 'Rollback-only count claim regression.'
WHERE control_key = 'primary';

SET LOCAL ROLE service_role;
SELECT
  set_config('dmv2.test.count_request_id', request_id::TEXT, TRUE),
  set_config('dmv2.test.count_claim_id', provider_call_claim_id::TEXT, TRUE)
FROM public.begin_dealmachine_v2_request(
  'dmv2-run-count',
  'dmv2-request-count-one',
  'count_only',
  'POST',
  '/properties/search/count',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  0,
  'dealmachine_v2_observation_v1',
  clock_timestamp()
)
WHERE should_execute
  AND reservation_id IS NULL
  AND reserved_credits = 0;

SELECT pg_temp.assert_true(
  NULLIF(current_setting('dmv2.test.count_request_id', TRUE), '') IS NOT NULL
    AND NULLIF(current_setting('dmv2.test.count_claim_id', TRUE), '') IS NOT NULL,
  'first count claim must atomically authorize one provider call without credits'
);

SELECT pg_temp.assert_true(
  (
    SELECT request_id = current_setting('dmv2.test.count_request_id')::UUID
      AND reservation_id IS NULL
      AND provider_call_claim_id = current_setting('dmv2.test.count_claim_id')::UUID
      AND NOT should_execute
    FROM public.begin_dealmachine_v2_request(
      'dmv2-run-count',
      'dmv2-request-count-one',
      'count_only',
      'POST',
      '/properties/search/count',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      0,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  ),
  'exact count replay must return the claim and forbid a second provider call'
);

SELECT public.append_dealmachine_v2_request_evidence(
  current_setting('dmv2.test.count_request_id')::UUID,
  'dmv2-evidence-count-one',
  'provider_response',
  'dmv2-provider-count-one',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  0,
  '{}'::JSONB,
  '{"mode":"count_only"}'::JSONB,
  clock_timestamp()
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.settle_dealmachine_v2_credit_reservation(
        %L::UUID,
        'dmv2-free-settlement-forbidden',
        'consumed',
        0,
        '{}'::JSONB,
        clock_timestamp()
      )
    $statement$,
    current_setting('dmv2.test.count_request_id')
  ),
  'zero-credit count requests must not create a settlement',
  '23514'
);
RESET ROLE;

-- Transaction-local paid sample enablement with deliberately tiny atomic caps.
UPDATE public.dealmachine_v2_runtime_controls
SET control_version = 3,
    integration_enabled = TRUE,
    maximum_operation = 'property_sample',
    allowed_operations_json = '["schema_read","count_only","property_sample"]'::JSONB,
    max_credits_per_run = 2,
    max_credits_per_day = 3,
    max_credits_per_month = 4,
    change_reason = 'Rollback-only paid claim and budget regression.'
WHERE control_key = 'primary';

SET LOCAL ROLE service_role;
SELECT
  set_config('dmv2.test.paid_request_id', request_id::TEXT, TRUE),
  set_config('dmv2.test.paid_reservation_id', reservation_id::TEXT, TRUE),
  set_config('dmv2.test.paid_claim_id', provider_call_claim_id::TEXT, TRUE)
FROM public.begin_dealmachine_v2_request(
  'dmv2-run-paid',
  'dmv2-request-paid-one',
  'property_sample',
  'POST',
  '/properties/search',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  2,
  'dealmachine_v2_observation_v1',
  clock_timestamp()
)
WHERE should_execute
  AND reservation_id IS NOT NULL
  AND reserved_credits = 2;

SELECT pg_temp.assert_true(
  NULLIF(current_setting('dmv2.test.paid_request_id', TRUE), '') IS NOT NULL
    AND NULLIF(current_setting('dmv2.test.paid_reservation_id', TRUE), '') IS NOT NULL
    AND NULLIF(current_setting('dmv2.test.paid_claim_id', TRUE), '') IS NOT NULL,
  'paid begin must atomically reserve credits and create one provider-call claim'
);

SELECT pg_temp.assert_true(
  (
    SELECT request_id = current_setting('dmv2.test.paid_request_id')::UUID
      AND reservation_id = current_setting('dmv2.test.paid_reservation_id')::UUID
      AND provider_call_claim_id = current_setting('dmv2.test.paid_claim_id')::UUID
      AND reserved_credits = 2
      AND NOT should_execute
    FROM public.begin_dealmachine_v2_request(
      'dmv2-run-paid',
      'dmv2-request-paid-one',
      'property_sample',
      'POST',
      '/properties/search',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      2,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  ),
  'exact paid replay must return stable reservation/claim IDs and should_execute=false'
);
RESET ROLE;

-- Simulate a crash after the claim and after its reservation TTL. The fixture
-- bypass is transaction-local; ordinary append-only triggers are restored
-- immediately. A claimed reservation must still consume the full budget.
SET LOCAL session_replication_role = replica;
UPDATE public.dealmachine_v2_credit_reservations
SET reserved_at = clock_timestamp() - INTERVAL '2 hours',
    expires_at = clock_timestamp() - INTERVAL '1 hour'
WHERE id = current_setting('dmv2.test.paid_reservation_id')::UUID;
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  $statement$
    SELECT * FROM public.begin_dealmachine_v2_request(
      'dmv2-run-paid',
      'dmv2-request-paid-over-cap',
      'property_sample',
      'POST',
      '/properties/search',
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      1,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  $statement$,
  'claimed but unsettled credits must remain budgeted after reservation TTL',
  '23514'
);
RESET ROLE;

-- A proven local/pre-call schema block releases its reservation. A provider
-- response of unknown billing status uses provider_ambiguous and remains fully
-- budgeted even when later reconciliation evidence is appended.
SET LOCAL ROLE service_role;
SELECT set_config(
  'dmv2.test.precall_request_id',
  request_id::TEXT,
  TRUE
)
FROM public.begin_dealmachine_v2_request(
  'dmv2-run-precall',
  'dmv2-request-precall-schema-block',
  'property_sample',
  'POST',
  '/properties/search',
  '1111111111111111111111111111111111111111111111111111111111111111',
  1,
  'dealmachine_v2_observation_v1',
  clock_timestamp()
)
WHERE should_execute;

SELECT public.append_dealmachine_v2_request_evidence(
  current_setting('dmv2.test.precall_request_id')::UUID,
  'dmv2-evidence-precall-schema-block',
  'schema_drift_blocked',
  NULL,
  NULL,
  0,
  '{}'::JSONB,
  '{"reason":"pre_call_schema_drift"}'::JSONB,
  clock_timestamp()
);
SELECT public.settle_dealmachine_v2_credit_reservation(
  current_setting('dmv2.test.precall_request_id')::UUID,
  'dmv2-settlement-precall-released',
  'released',
  0,
  '{"providerCalled":false}'::JSONB,
  clock_timestamp()
);

SELECT set_config(
  'dmv2.test.ambiguous_request_id',
  request_id::TEXT,
  TRUE
)
FROM public.begin_dealmachine_v2_request(
  'dmv2-run-ambiguous',
  'dmv2-request-provider-ambiguous',
  'property_sample',
  'POST',
  '/properties/search',
  '2222222222222222222222222222222222222222222222222222222222222222',
  1,
  'dealmachine_v2_observation_v1',
  clock_timestamp()
)
WHERE should_execute;

SELECT public.append_dealmachine_v2_request_evidence(
  current_setting('dmv2.test.ambiguous_request_id')::UUID,
  'dmv2-evidence-provider-ambiguous',
  'provider_ambiguous',
  'dmv2-provider-ambiguous-one',
  '3333333333333333333333333333333333333333333333333333333333333333',
  NULL,
  '{}'::JSONB,
  '{"reason":"provider_response_schema_drift"}'::JSONB,
  clock_timestamp()
);
SELECT public.settle_dealmachine_v2_credit_reservation(
  current_setting('dmv2.test.ambiguous_request_id')::UUID,
  'dmv2-settlement-provider-ambiguous',
  'ambiguous',
  NULL,
  '{"providerCalled":true}'::JSONB,
  clock_timestamp()
);
SELECT public.append_dealmachine_v2_request_evidence(
  current_setting('dmv2.test.ambiguous_request_id')::UUID,
  'dmv2-evidence-provider-reconciled',
  'reconciled',
  NULL,
  '3333333333333333333333333333333333333333333333333333333333333333',
  1,
  '{}'::JSONB,
  '{"reconciledWithoutProviderReplay":true}'::JSONB,
  clock_timestamp()
);

SELECT pg_temp.assert_true(
  (
    SELECT released.budgeted_credits = 0
      AND ambiguous.budgeted_credits = 1
      AND EXISTS (
        SELECT 1
        FROM public.dealmachine_v2_request_evidence evidence
        WHERE evidence.request_id = current_setting('dmv2.test.ambiguous_request_id')::UUID
          AND evidence.event_type = 'reconciled'
          AND evidence.actual_credits = 1
      )
    FROM public.dealmachine_v2_credit_settlements released
    CROSS JOIN public.dealmachine_v2_credit_settlements ambiguous
    WHERE released.request_id = current_setting('dmv2.test.precall_request_id')::UUID
      AND ambiguous.request_id = current_setting('dmv2.test.ambiguous_request_id')::UUID
  ),
  'pre-call release and post-provider ambiguous reconciliation must stay distinct'
);
RESET ROLE;

-- Close the integration again. Exact replay, provider evidence, observation
-- persistence, and settlement must remain available for crash recovery, but
-- the existing immutable claim can never authorize another provider POST.
UPDATE public.dealmachine_v2_runtime_controls
SET control_version = 4,
    integration_enabled = FALSE,
    maximum_operation = 'count_only',
    allowed_operations_json = '["schema_read","count_only"]'::JSONB,
    max_credits_per_run = 0,
    max_credits_per_day = 0,
    max_credits_per_month = 0,
    change_reason = 'Rollback-only recovery while disabled regression.'
WHERE control_key = 'primary';

SET LOCAL ROLE service_role;
SELECT pg_temp.assert_true(
  (
    SELECT request_id = current_setting('dmv2.test.paid_request_id')::UUID
      AND provider_call_claim_id = current_setting('dmv2.test.paid_claim_id')::UUID
      AND NOT should_execute
    FROM public.begin_dealmachine_v2_request(
      'dmv2-run-paid',
      'dmv2-request-paid-one',
      'property_sample',
      'POST',
      '/properties/search',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      2,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  ),
  'disabled recovery replay must return evidence authority but never another call claim'
);

SELECT public.append_dealmachine_v2_request_evidence(
  current_setting('dmv2.test.paid_request_id')::UUID,
  'dmv2-evidence-paid-one',
  'provider_response',
  'dmv2-provider-paid-one',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  1,
  '{"remaining":59}'::JSONB,
  '{"recoveredAfterClaim":true}'::JSONB,
  clock_timestamp()
);

SELECT set_config('dmv2.test.observed_at', clock_timestamp()::TEXT, TRUE);
SELECT set_config(
  'dmv2.test.observation_id',
  public.append_dealmachine_v2_observation(
    current_setting('dmv2.test.paid_request_id')::UUID,
    'property',
    'dm-test-property-1',
    '4dba785047a527ded225cafcb7cbc9a88725c8675abe8781d9ef3129e5e68db8',
    '{"property_id":"dm-test-property-1","full_address":"123 Test St","equity_percent":42}'::JSONB,
    'dealmachine-v2-regression',
    current_setting('dmv2.test.observed_at')::TIMESTAMPTZ - INTERVAL '1 hour',
    current_setting('dmv2.test.observed_at')::TIMESTAMPTZ,
    jsonb_build_object(
      'full_address', jsonb_build_object(
        'observedAt', current_setting('dmv2.test.observed_at')::TIMESTAMPTZ,
        'expiresAt', current_setting('dmv2.test.observed_at')::TIMESTAMPTZ + INTERVAL '30 days',
        'confidence', 0.90
      ),
      'equity_percent', jsonb_build_object(
        'observedAt', current_setting('dmv2.test.observed_at')::TIMESTAMPTZ,
        'expiresAt', current_setting('dmv2.test.observed_at')::TIMESTAMPTZ + INTERVAL '30 days',
        'confidence', 0.80
      )
    ),
    0.85,
    current_setting('dmv2.test.observed_at')::TIMESTAMPTZ + INTERVAL '60 days',
    'dmv2-observation-one',
    'dealmachine_v2_observation_v1'
  )::TEXT,
  TRUE
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT public.append_dealmachine_v2_observation(
        %L::UUID,
        'property',
        'dm-test-property-sensitive',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '{"property_id":"dm-test-property-sensitive","owner_email":"blocked@example.invalid"}'::JSONB,
        'dealmachine-v2-regression',
        NULL,
        clock_timestamp(),
        jsonb_build_object(
          'property_id', jsonb_build_object(
            'observedAt', clock_timestamp(),
            'expiresAt', clock_timestamp() + INTERVAL '1 day'
          )
        ),
        0.5,
        clock_timestamp() + INTERVAL '1 day',
        'dmv2-observation-sensitive',
        'dealmachine_v2_observation_v1'
      )
    $statement$,
    current_setting('dmv2.test.paid_request_id')
  ),
  'people/contact fields must be rejected before raw persistence',
  '23514'
);

SELECT set_config(
  'dmv2.test.link_id',
  public.link_dealmachine_v2_observation_entity(
    current_setting('dmv2.test.observation_id')::UUID,
    'property',
    'dm-test-property-1',
    'provider_property_id',
    0.95,
    '{"basis":"provider_property_id"}'::JSONB,
    'dmv2-link-one',
    'dealmachine_v2_observation_v1',
    clock_timestamp()
  )::TEXT,
  TRUE
);

SELECT set_config(
  'dmv2.test.settlement_id',
  public.settle_dealmachine_v2_credit_reservation(
    current_setting('dmv2.test.paid_request_id')::UUID,
    'dmv2-settlement-paid-one',
    'consumed',
    1,
    '{"recoveredWithoutAnotherProviderCall":true}'::JSONB,
    clock_timestamp()
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT settlement.disposition = 'consumed'
      AND settlement.actual_credits = 1
      AND settlement.budgeted_credits = 1
      AND NOT controls.integration_enabled
    FROM public.dealmachine_v2_credit_settlements settlement
    CROSS JOIN public.dealmachine_v2_runtime_controls controls
    WHERE settlement.id = current_setting('dmv2.test.settlement_id')::UUID
      AND controls.control_key = 'primary'
  ),
  'evidence/observation/settlement recovery must work while new calls remain disabled'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.record_dealmachine_v2_source_attribution(
        %L::UUID,
        'seller_execution',
        'preforeclosure-equity',
        'dmv2-attribution-before-review',
        'dealmachine_v2_observation_v1',
        clock_timestamp(),
        '{}'::JSONB
      )
    $statement$,
    current_setting('dmv2.test.link_id')
  ),
  'source attribution must fail before an accepted operator review',
  '23514',
  'DealMachine attribution requires a prior accepted operator review.'
);
RESET ROLE;

-- Reviewer and strategy activations are transaction-local rollback fixtures.
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
  'd2000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'dealmachine-v2-reviewer-test@vestblock.invalid',
  '',
  clock_timestamp(),
  '{}'::JSONB,
  '{}'::JSONB,
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;
SELECT set_config(
  'dmv2.test.reviewer_id',
  'd2000000-0000-4000-8000-000000000001',
  TRUE
);

SET LOCAL ROLE service_role;
SELECT set_config(
  'dmv2.test.review_id',
  public.record_dealmachine_v2_operator_review(
    current_setting('dmv2.test.link_id')::UUID,
    'accepted_for_attribution',
    'verified_property_identity',
    'Rollback-only operator review fixture.',
    current_setting('dmv2.test.reviewer_id')::UUID,
    'dmv2-review-one',
    'dealmachine_v2_observation_v1',
    clock_timestamp(),
    '{"propertyIdentityVerified":true}'::JSONB
  )::TEXT,
  TRUE
);

SELECT pg_temp.assert_true(
  (
    SELECT NOT outreach_authorized
      AND NOT customer_workflow_authorized
      AND dispatch_authority = 'none'
    FROM public.dealmachine_v2_operator_reviews
    WHERE id = current_setting('dmv2.test.review_id')::UUID
  ),
  'operator review must never authorize outreach, workflow, or dispatch'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      INSERT INTO public.dealmachine_v2_operator_reviews(
        observation_entity_link_id,
        decision,
        reason_code,
        reviewer_user_id,
        outreach_authorized,
        customer_workflow_authorized,
        dispatch_authority,
        idempotency_key,
        writer_release,
        reviewed_at
      ) VALUES (
        %L::UUID,
        'accepted_for_attribution',
        'forbidden_outreach_authority',
        %L::UUID,
        TRUE,
        FALSE,
        'none',
        'dmv2-review-forbidden-authority',
        'dealmachine_v2_observation_v1',
        clock_timestamp()
      )
    $statement$,
    current_setting('dmv2.test.link_id'),
    current_setting('dmv2.test.reviewer_id')
  ),
  'even direct service inserts cannot turn review into outreach authority',
  '23514'
);

SELECT pg_temp.expect_error(
  format(
    $statement$
      SELECT * FROM public.record_dealmachine_v2_source_attribution(
        %L::UUID,
        'seller_execution',
        'preforeclosure-equity',
        'dmv2-attribution-before-active-version',
        'dealmachine_v2_observation_v1',
        clock_timestamp(),
        '{}'::JSONB
      )
    $statement$,
    current_setting('dmv2.test.link_id')
  ),
  'accepted review cannot attribute to a draft strategy version',
  '23514'
);
RESET ROLE;

SET LOCAL session_replication_role = replica;
UPDATE public.operating_strategy_versions version
SET status = 'active',
    approved_by_user_id = current_setting('dmv2.test.reviewer_id')::UUID,
    approved_at = clock_timestamp() - INTERVAL '2 minutes',
    activated_at = clock_timestamp() - INTERVAL '1 minute',
    updated_at = clock_timestamp()
FROM public.operating_strategies strategy
WHERE strategy.id = version.operating_strategy_id
  AND strategy.strategy_key IN (
    'property_opportunity_discovery',
    'seller_options_intake'
  )
  AND version.version = 1;
SET LOCAL session_replication_role = origin;

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
      AND bool_and(version.status = 'active')
      AND bool_and(version.external_send_cap = 0)
      AND bool_and(version.execution_mode IN ('internal_only', 'no_send'))
    FROM public.operating_strategy_versions version
    JOIN public.operating_strategies strategy
      ON strategy.id = version.operating_strategy_id
    WHERE strategy.strategy_key IN (
      'property_opportunity_discovery',
      'seller_options_intake'
    )
      AND version.version = 1
  ),
  'rollback fixtures may activate only two still-zero-send strategy versions'
);

SET LOCAL ROLE service_role;
SELECT
  set_config('dmv2.test.attribution_one_id', attribution_id::TEXT, TRUE),
  set_config('dmv2.test.version_one_id', operating_strategy_version_id::TEXT, TRUE),
  set_config('dmv2.test.activity_one_id', canonical_activity_id::TEXT, TRUE)
FROM public.record_dealmachine_v2_source_attribution(
  current_setting('dmv2.test.link_id')::UUID,
  'seller_execution',
  'preforeclosure-equity',
  'dmv2-attribution-preforeclosure',
  'dealmachine_v2_observation_v1',
  clock_timestamp(),
  '{"strategyUse":"source_evidence_only"}'::JSONB
);

SELECT
  set_config('dmv2.test.attribution_two_id', attribution_id::TEXT, TRUE),
  set_config('dmv2.test.version_two_id', operating_strategy_version_id::TEXT, TRUE),
  set_config('dmv2.test.activity_two_id', canonical_activity_id::TEXT, TRUE)
FROM public.record_dealmachine_v2_source_attribution(
  current_setting('dmv2.test.link_id')::UUID,
  'seller_execution',
  'absentee-equity-creative',
  'dmv2-attribution-absentee',
  'dealmachine_v2_observation_v1',
  clock_timestamp(),
  '{"strategyUse":"source_evidence_only"}'::JSONB
);

SELECT pg_temp.assert_true(
  (
    SELECT COUNT(*) = 2
      AND COUNT(DISTINCT attribution.operating_strategy_version_id) = 2
      AND COUNT(DISTINCT attribution.observation_id) = 1
      AND COUNT(DISTINCT attribution.observation_entity_link_id) = 1
      AND bool_and(activity.activity_type = 'source')
      AND bool_and(activity.activity_namespace = 'dealmachine_observation_entity')
      AND bool_and(activity.writer_release = 'dealmachine_v2_observation_v1')
      AND bool_and(activity.metadata_json ->> 'outreachAuthorized' = 'false')
      AND bool_and(activity.metadata_json ->> 'customerWorkflowAuthorized' = 'false')
      AND bool_and(activity.metadata_json ->> 'dispatchAuthority' = 'none')
    FROM public.dealmachine_v2_source_attributions attribution
    JOIN public.operating_strategy_activities activity
      ON activity.id = attribution.canonical_activity_id
     AND activity.operating_strategy_version_id = attribution.operating_strategy_version_id
    WHERE attribution.observation_entity_link_id = current_setting('dmv2.test.link_id')::UUID
  ),
  'one observation/link must append two active-version source attributions without overwrite'
);
RESET ROLE;

-- Trigger-level append-only protection remains effective even for the owner.
SELECT pg_temp.expect_error(
  format(
    $statement$
      UPDATE public.dealmachine_v2_requests
      SET run_key = 'dmv2-illegal-rewrite'
      WHERE id = %L::UUID
    $statement$,
    current_setting('dmv2.test.paid_request_id')
  ),
  'request evidence must be update-proof',
  '23514'
);
SELECT pg_temp.expect_error(
  format(
    $statement$
      DELETE FROM public.dealmachine_v2_observations
      WHERE id = %L::UUID
    $statement$,
    current_setting('dmv2.test.observation_id')
  ),
  'observation evidence must be delete-proof',
  '23514'
);

-- Raw payload deletion is a one-way, evidenced maintenance operation. The
-- immutable observation envelope, payload hash, links, and attributions stay.
SET LOCAL ROLE service_role;
SELECT
  set_config('dmv2.test.deletion_evidence_id', evidence_id::TEXT, TRUE),
  set_config('dmv2.test.deletion_was_replay', already_deleted::TEXT, TRUE)
FROM public.purge_dealmachine_v2_observation_payload(
  current_setting('dmv2.test.observation_id')::UUID,
  'dmv2-payload-deletion-one',
  'regression_retention_delete',
  '{"trigger":"rollback_regression"}'::JSONB,
  current_setting('dmv2.test.reviewer_id')::UUID,
  clock_timestamp()
);

SELECT pg_temp.assert_true(
  current_setting('dmv2.test.deletion_was_replay') = 'false'
    AND (
      SELECT payload.raw_payload_json IS NULL
        AND payload.deleted_at IS NOT NULL
        AND payload.deletion_evidence_id = current_setting('dmv2.test.deletion_evidence_id')::UUID
        AND observation.payload_hash = payload.payload_hash
      FROM public.dealmachine_v2_observation_payloads payload
      JOIN public.dealmachine_v2_observations observation
        ON observation.id = payload.observation_id
      WHERE payload.observation_id = current_setting('dmv2.test.observation_id')::UUID
    )
    AND (
      SELECT event_type = 'deletion_completed'
        AND evidence_json ->> 'payloadDeleted' = 'true'
        AND evidence_json ->> 'reasonCode' = 'regression_retention_delete'
      FROM public.dealmachine_v2_observation_evidence
      WHERE id = current_setting('dmv2.test.deletion_evidence_id')::UUID
    ),
  'payload purge must erase only raw JSON and append deletion evidence'
);

SELECT pg_temp.assert_true(
  (
    SELECT evidence_id = current_setting('dmv2.test.deletion_evidence_id')::UUID
      AND already_deleted
    FROM public.purge_dealmachine_v2_observation_payload(
      current_setting('dmv2.test.observation_id')::UUID,
      'dmv2-payload-deletion-one',
      'regression_retention_delete',
      '{"trigger":"rollback_regression"}'::JSONB,
      current_setting('dmv2.test.reviewer_id')::UUID,
      clock_timestamp()
    )
  ),
  'payload purge replay must be stable and never erase lineage twice'
);
RESET ROLE;

ROLLBACK;

-- Standalone regression proof: migration objects remain, while every fixture
-- and every temporary authorization/control change is gone.
DO $dealmachine_v2_post_rollback$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_runtime_controls
    WHERE control_key = 'primary'
      AND control_version = 1
      AND NOT integration_enabled
      AND maximum_operation = 'count_only'
      AND max_credits_per_run = 0
      AND max_credits_per_day = 0
      AND max_credits_per_month = 0
  ) THEN
    RAISE EXCEPTION 'DealMachine v2 rollback regression changed the safe runtime control.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_requests
    WHERE idempotency_key LIKE 'dmv2-%'
  ) OR EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_observations
    WHERE idempotency_key LIKE 'dmv2-%'
  ) OR EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_source_attributions
    WHERE idempotency_key LIKE 'dmv2-%'
  ) OR EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = 'd2000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'DealMachine v2 rollback regression left fixture rows behind.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions version
    JOIN public.operating_strategies strategy
      ON strategy.id = version.operating_strategy_id
    WHERE strategy.strategy_key IN (
      'property_opportunity_discovery',
      'seller_options_intake'
    )
      AND version.version = 1
      AND version.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'DealMachine v2 rollback regression left a strategy active.';
  END IF;
END;
$dealmachine_v2_post_rollback$;
