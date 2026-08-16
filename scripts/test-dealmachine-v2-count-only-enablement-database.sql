\set ON_ERROR_STOP on

-- Rollback-only proof for the DealMachine v2 count-only successor migration.
-- The successor migration must already be present. This transaction creates
-- one free count claim, proves replay safety, and leaves no fixture rows.

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
    RAISE EXCEPTION 'DealMachine count-only assertion failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_sql TEXT,
  p_message TEXT,
  p_expected_sqlstate TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  failed BOOLEAN := FALSE;
  observed_sqlstate TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    failed := TRUE;
    GET STACKED DIAGNOSTICS observed_sqlstate = RETURNED_SQLSTATE;
  END;

  IF NOT failed THEN
    RAISE EXCEPTION 'DealMachine count-only expected failure did not occur: %', p_message;
  END IF;
  IF observed_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
    RAISE EXCEPTION 'DealMachine count-only failure % returned SQLSTATE %, expected %.',
      p_message,
      observed_sqlstate,
      p_expected_sqlstate;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  (
    SELECT control_version = 2
      AND required_writer_release = 'dealmachine_v2_observation_v1'
      AND integration_enabled
      AND maximum_operation = 'count_only'
      AND allowed_operations_json = '["schema_read","count_only"]'::JSONB
      AND NOT (allowed_operations_json ? 'property_sample')
      AND max_credits_per_run = 0
      AND max_credits_per_day = 0
      AND max_credits_per_month = 0
    FROM public.dealmachine_v2_runtime_controls
    WHERE control_key = 'primary'
  ),
  'version 2 must enable only free count discovery with zero paid budget'
);

SET LOCAL ROLE service_role;
SELECT pg_temp.expect_error(
  $statement$
    SELECT * FROM public.begin_dealmachine_v2_request(
      'dmv2-count-enablement-paid-forbidden',
      'dmv2-count-enablement-paid-forbidden',
      'property_sample',
      'POST',
      '/properties/search',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      1,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  $statement$,
  'property_sample must remain forbidden',
  '23514'
);

SELECT
  set_config('dmv2.count_enablement.request_id', request_id::TEXT, TRUE),
  set_config('dmv2.count_enablement.claim_id', provider_call_claim_id::TEXT, TRUE)
FROM public.begin_dealmachine_v2_request(
  'dmv2-count-enablement-free',
  'dmv2-count-enablement-free',
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
  AND reserved_credits = 0
  AND control_version = 2;

SELECT pg_temp.assert_true(
  NULLIF(current_setting('dmv2.count_enablement.request_id', TRUE), '') IS NOT NULL
    AND NULLIF(current_setting('dmv2.count_enablement.claim_id', TRUE), '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_credit_reservations),
  'count-only must create one free claim and no credit reservation'
);

SELECT pg_temp.assert_true(
  (
    SELECT request_id = current_setting('dmv2.count_enablement.request_id')::UUID
      AND provider_call_claim_id = current_setting('dmv2.count_enablement.claim_id')::UUID
      AND reservation_id IS NULL
      AND reserved_credits = 0
      AND NOT should_execute
    FROM public.begin_dealmachine_v2_request(
      'dmv2-count-enablement-free',
      'dmv2-count-enablement-free',
      'count_only',
      'POST',
      '/properties/search/count',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      0,
      'dealmachine_v2_observation_v1',
      clock_timestamp()
    )
  ),
  'exact count replay must return stable IDs and should_execute=false'
);
RESET ROLE;

SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.dealmachine_v2_credit_reservations)
    AND NOT EXISTS (
      SELECT 1
      FROM public.dealmachine_v2_requests
      WHERE operation = 'property_sample'
    ),
  'the regression must create no paid reservation or paid request'
);

ROLLBACK;

DO $dealmachine_v2_count_only_post_rollback$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_runtime_controls
    WHERE control_key = 'primary'
      AND control_version = 2
      AND integration_enabled
      AND maximum_operation = 'count_only'
      AND allowed_operations_json = '["schema_read","count_only"]'::JSONB
      AND NOT (allowed_operations_json ? 'property_sample')
      AND max_credits_per_run = 0
      AND max_credits_per_day = 0
      AND max_credits_per_month = 0
  ) THEN
    RAISE EXCEPTION 'Count-only regression changed the version-2 control.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_requests
    WHERE idempotency_key LIKE 'dmv2-count-enablement-%'
  ) OR EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_credit_reservations
    WHERE idempotency_key LIKE 'dmv2-count-enablement-%'
  ) THEN
    RAISE EXCEPTION 'Count-only regression left fixture rows behind.';
  END IF;
END;
$dealmachine_v2_count_only_post_rollback$;
