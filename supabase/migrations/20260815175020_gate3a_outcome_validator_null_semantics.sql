-- Gate 3A null-semantics repair for required numeric outcome fields.
-- A missing learning window or minimum exposure must return FALSE, never NULL.

CREATE OR REPLACE FUNCTION private.gate3a_valid_outcome_contract(p_contract JSONB)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_typeof(p_contract) = 'object'
      AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'primaryConversionEvent'), FALSE)
      AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'businessValue'), FALSE)
      AND private.gate3a_jsonb_text_array(p_contract -> 'leadingIndicators', TRUE)
      AND private.gate3a_jsonb_text_array(p_contract -> 'learningInputs', TRUE)
      AND private.gate3a_jsonb_text_array(p_contract -> 'attributionDimensions', TRUE)
      AND private.gate3a_jsonb_text_array(p_contract -> 'stopConditions', TRUE)
      AND jsonb_typeof(p_contract -> 'learningWindowDays') = 'number'
      AND (p_contract ->> 'learningWindowDays') ~ '^[1-9][0-9]*$'
      AND jsonb_typeof(p_contract -> 'minimumExposure') = 'number'
      AND (p_contract ->> 'minimumExposure') ~ '^[1-9][0-9]*$',
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION private.gate3a_valid_outcome_contract(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_outcome_contract(JSONB)
  TO service_role;

DO $$
DECLARE
  base_contract JSONB := jsonb_build_object(
    'primaryConversionEvent', 'verified outcome',
    'leadingIndicators', jsonb_build_array('qualified record'),
    'businessValue', 'verified customer progression',
    'learningInputs', jsonb_build_array('strategy version'),
    'learningWindowDays', 30,
    'minimumExposure', 1,
    'attributionDimensions', jsonb_build_array('source'),
    'stopConditions', jsonb_build_array('compliance regression')
  );
BEGIN
  IF private.gate3a_valid_outcome_contract(
    base_contract - 'learningWindowDays'
  ) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'A missing learningWindowDays field must fail closed.';
  END IF;
  IF private.gate3a_valid_outcome_contract(
    base_contract - 'minimumExposure'
  ) IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'A missing minimumExposure field must fail closed.';
  END IF;
  IF private.gate3a_valid_outcome_contract(base_contract) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A complete outcome contract must remain valid.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3A validator repair must not activate operating strategies or sending.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3A requires n8n live sending to remain disabled.';
  END IF;
END;
$$;
