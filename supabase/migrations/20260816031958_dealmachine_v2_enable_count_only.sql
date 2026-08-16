-- Enable free DealMachine v2 property-count discovery only.
--
-- This successor deliberately grants no paid-search capacity and cannot be
-- applied after any DealMachine request/evidence history exists. It changes
-- only the pristine migration-default control from version 1 to version 2.

DO $dealmachine_v2_count_only_enablement$
DECLARE
  controls public.dealmachine_v2_runtime_controls;
  table_name TEXT;
  ledger_has_rows BOOLEAN;
  updated_rows INTEGER;
BEGIN
  IF to_regclass('public.dealmachine_v2_runtime_controls') IS NULL
    OR to_regclass('public.dealmachine_v2_credit_reservations') IS NULL
    OR to_regclass('public.dealmachine_v2_requests') IS NULL
    OR to_regclass('public.dealmachine_v2_request_evidence') IS NULL
    OR to_regclass('public.dealmachine_v2_credit_settlements') IS NULL
    OR to_regclass('public.dealmachine_v2_observations') IS NULL
    OR to_regclass('public.dealmachine_v2_observation_payloads') IS NULL
    OR to_regclass('public.dealmachine_v2_observation_evidence') IS NULL
    OR to_regclass('public.dealmachine_v2_observation_entity_links') IS NULL
    OR to_regclass('public.dealmachine_v2_source_attributions') IS NULL
    OR to_regclass('public.dealmachine_v2_operator_reviews') IS NULL THEN
    RAISE EXCEPTION 'Count-only enablement requires the complete DealMachine v2 observation authority.';
  END IF;

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary'
  FOR UPDATE;

  IF NOT FOUND
    OR (SELECT COUNT(*) FROM public.dealmachine_v2_runtime_controls) <> 1
    OR controls.control_version <> 1
    OR controls.required_writer_release <> 'dealmachine_v2_observation_v1'
    OR controls.integration_enabled
    OR controls.maximum_operation <> 'count_only'
    OR controls.allowed_operations_json IS DISTINCT FROM
      '["schema_read","count_only"]'::JSONB
    OR controls.allowed_field_groups_json IS DISTINCT FROM
      '["property","ownership","equity","listing","preforeclosure","tax","lien","lot","condition"]'::JSONB
    OR controls.denied_field_groups_json IS DISTINCT FROM
      '["people","contacts","phone","email","demographics","income","wealth","credit","credit_behavior","health","insurance","politics","lifestyle","protected_class","protected_class_proxy"]'::JSONB
    OR controls.max_credits_per_run <> 0
    OR controls.max_credits_per_day <> 0
    OR controls.max_credits_per_month <> 0
    OR controls.reservation_ttl_minutes <> 15
    OR controls.retention_days <> 90
    OR controls.change_reason <>
      'Migration default: disabled, count-only, zero paid credits.'
    OR controls.changed_by_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Count-only enablement requires the exact pristine DealMachine v2 version-1 control.'
      USING ERRCODE = '23514';
  END IF;

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
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', table_name)
      INTO ledger_has_rows;
    IF ledger_has_rows THEN
      RAISE EXCEPTION 'Count-only enablement refuses nonempty DealMachine ledger public.%.',
        table_name
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  UPDATE public.dealmachine_v2_runtime_controls
  SET control_version = 2,
      integration_enabled = TRUE,
      change_reason = 'Enable free count-only discovery; paid property sampling remains disabled.'
  WHERE control_key = 'primary'
    AND control_version = 1;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Count-only enablement did not update exactly one pristine control.';
  END IF;

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';

  IF controls.control_version <> 2
    OR controls.required_writer_release <> 'dealmachine_v2_observation_v1'
    OR NOT controls.integration_enabled
    OR controls.maximum_operation <> 'count_only'
    OR controls.allowed_operations_json IS DISTINCT FROM
      '["schema_read","count_only"]'::JSONB
    OR controls.allowed_field_groups_json IS DISTINCT FROM
      '["property","ownership","equity","listing","preforeclosure","tax","lien","lot","condition"]'::JSONB
    OR controls.denied_field_groups_json IS DISTINCT FROM
      '["people","contacts","phone","email","demographics","income","wealth","credit","credit_behavior","health","insurance","politics","lifestyle","protected_class","protected_class_proxy"]'::JSONB
    OR controls.max_credits_per_run <> 0
    OR controls.max_credits_per_day <> 0
    OR controls.max_credits_per_month <> 0
    OR controls.reservation_ttl_minutes <> 15
    OR controls.retention_days <> 90
    OR controls.allowed_operations_json ? 'property_sample' THEN
    RAISE EXCEPTION 'Count-only enablement postcondition failed or granted paid-search authority.';
  END IF;
END;
$dealmachine_v2_count_only_enablement$;
