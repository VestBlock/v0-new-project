-- Gate 3C: governed runtime binding, attribution, outcomes, and human-reviewed learning.
--
-- This migration is intentionally safe to apply before the matching application
-- release. Existing runtime tables, rows, constraints, and legacy writers remain
-- compatible. New canonical RPCs fail closed unless they resolve one active
-- operating-strategy version. No strategy is activated and no send capacity is
-- granted here.

-- ---------------------------------------------------------------------------
-- Exact, read-only Gate 3B draft handoff guard. Gate 3C does not deploy the
-- application, so it deliberately leaves all 17 founder-reviewed draft
-- contracts and their fingerprints byte-for-byte unchanged.
-- ---------------------------------------------------------------------------

DO $gate3c_preconditions$
DECLARE
  expected_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
    INTO expected_count
  FROM public.operating_strategy_versions version
  WHERE version.version = 1
    AND version.status = 'draft'
    AND version.external_send_cap = 0
    AND version.approved_by_user_id IS NULL
    AND version.approved_at IS NULL
    AND version.activated_at IS NULL
    AND version.retired_at IS NULL;

  IF expected_count <> 17 OR (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17 THEN
    RAISE EXCEPTION 'Gate 3C requires the exact 17 untouched Gate 3B version-1 drafts.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3C refuses to run with an active or send-capable operating version.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orchestration_controls
    WHERE integration_key = 'n8n'
      AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3C requires n8n live sending to remain disabled.';
  END IF;
END
$gate3c_preconditions$;

DO $gate3c_fingerprint_guard$
DECLARE
  mismatch_count INTEGER;
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
  SELECT COUNT(*)::INTEGER
    INTO mismatch_count
  FROM expected
  LEFT JOIN public.operating_strategies strategy
    ON strategy.strategy_key = expected.strategy_key
  LEFT JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.version = 1
  WHERE version.id IS NULL
     OR version.status <> 'draft'
     OR version.external_send_cap <> 0
     OR version.owner_contract_json ->> 'dispatchAuthority' <> 'none_in_gate_3b'
     OR private.gate3b_operating_contract_fingerprint(
       (version.*)::public.operating_strategy_versions
     ) <> expected.fingerprint
     OR (
       SELECT COUNT(*)
       FROM jsonb_array_elements(version.contract_json -> 'integrationDependencies') dependency
       WHERE lower(dependency ->> 'integration') = 'canonical strategy-version binding'
     ) <> 1;

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'Gate 3C refuses to stage against % changed or noncanonical Gate 3B drafts.', mismatch_count;
  END IF;
END
$gate3c_fingerprint_guard$;

-- ---------------------------------------------------------------------------
-- Compatibility control. Only a later separately approved migration may flip
-- this singleton to governed_required after the matching app release.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_runtime_controls (
  control_key TEXT PRIMARY KEY CHECK (control_key = 'canonical_binding'),
  enforcement_mode TEXT NOT NULL DEFAULT 'compatibility' CHECK (
    enforcement_mode IN ('compatibility', 'governed_required')
  ),
  schema_status TEXT NOT NULL DEFAULT 'staged_pending_app_deployment' CHECK (
    schema_status IN ('staged_pending_app_deployment', 'app_deployed_pending_cutover', 'cutover_complete')
  ),
  schema_migration_version TEXT NOT NULL DEFAULT '20260815211500',
  app_release_status TEXT NOT NULL DEFAULT 'not_deployed' CHECK (
    app_release_status IN ('not_deployed', 'deployed_compatibility', 'deployed_governed')
  ),
  readiness_notes_json JSONB NOT NULL DEFAULT jsonb_build_object(
    'gate', '3C',
    'contractPatchRequiredAtAppRelease', TRUE,
    'legacyWritersRemainCompatible', TRUE,
    'activationOrSendAuthorityChanged', FALSE
  ) CHECK (jsonb_typeof(readiness_notes_json) = 'object'),
  compatibility_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  required_writer_release TEXT,
  cutover_at TIMESTAMPTZ,
  cutover_approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operating_strategy_runtime_controls_cutover_shape_check CHECK (
    enforcement_mode = 'compatibility'
    OR (
      NULLIF(btrim(required_writer_release), '') IS NOT NULL
      AND cutover_at IS NOT NULL
      AND cutover_approved_by_user_id IS NOT NULL
    )
  )
);

INSERT INTO public.operating_strategy_runtime_controls(control_key)
VALUES ('canonical_binding');

ALTER TABLE public.operating_strategy_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_runtime_controls FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_runtime_controls
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_runtime_controls TO service_role;

-- ---------------------------------------------------------------------------
-- Additive governed-binding columns on legacy runtime surfaces.
-- NULL means pre-Gate-3C history. New legacy writers are tagged legacy_compat;
-- new application code explicitly writes governed_v1. Existing uniqueness and
-- upsert contracts are deliberately untouched.
-- ---------------------------------------------------------------------------

ALTER TABLE public.strategy_source_events
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID,
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

ALTER TABLE public.strategy_market_state
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID,
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

ALTER TABLE public.command_center_strategy_runs
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

ALTER TABLE public.strategy_lead_memberships
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

ALTER TABLE public.command_center_outbound_enrollments
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID,
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS governed_stage TEXT,
  ADD COLUMN IF NOT EXISTS dispatch_reservation_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_channel TEXT,
  ADD COLUMN IF NOT EXISTS strategy_lead_membership_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_intent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS outreach_purpose TEXT,
  ADD COLUMN IF NOT EXISTS consent_basis_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS suppression_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS message_version_key TEXT;

ALTER TABLE public.orchestration_runs
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID,
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID,
  ADD COLUMN IF NOT EXISTS strategy_key TEXT,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT,
  ADD COLUMN IF NOT EXISTS outbound_enrollment_id UUID,
  ADD COLUMN IF NOT EXISTS dispatch_reservation_id UUID,
  ADD COLUMN IF NOT EXISTS subject_namespace TEXT,
  ADD COLUMN IF NOT EXISTS subject_key TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

ALTER TABLE public.participant_opportunity_matches
  ADD COLUMN IF NOT EXISTS operating_strategy_id UUID,
  ADD COLUMN IF NOT EXISTS operating_strategy_version_id UUID,
  ADD COLUMN IF NOT EXISTS strategy_key TEXT,
  ADD COLUMN IF NOT EXISTS strategy_identifier_namespace TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_mode TEXT,
  ADD COLUMN IF NOT EXISTS strategy_binding_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strategy_writer_release TEXT,
  ADD COLUMN IF NOT EXISTS destination_mode_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS destination_path_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS operating_contract_fingerprint TEXT;

DO $gate3c_add_runtime_constraints$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'strategy_source_events',
    'strategy_market_state',
    'command_center_strategy_runs',
    'strategy_lead_memberships',
    'command_center_outbound_enrollments',
    'orchestration_runs',
    'participant_opportunity_matches'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (strategy_binding_mode IS NULL OR strategy_binding_mode IN (''legacy_compat'', ''governed_v1''))',
      table_name,
      table_name || '_gate3c_binding_mode_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (destination_mode_snapshot IS NULL OR destination_mode_snapshot IN (''public_route'', ''internal_only'', ''unresolved''))',
      table_name,
      table_name || '_gate3c_destination_mode_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (operating_strategy_version_id, operating_strategy_id) REFERENCES public.operating_strategy_versions(id, operating_strategy_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      table_name,
      table_name || '_gate3c_version_parent_fkey'
    );
    EXECUTE format(
      'CREATE INDEX %I ON public.%I(operating_strategy_version_id) WHERE operating_strategy_version_id IS NOT NULL',
      table_name || '_gate3c_version_idx',
      table_name
    );
  END LOOP;
END
$gate3c_add_runtime_constraints$;

ALTER TABLE public.orchestration_runs
  ADD CONSTRAINT orchestration_runs_gate3c_source_binding_check CHECK (
    (strategy_key IS NULL AND strategy_identifier_namespace IS NULL)
    OR (
      NULLIF(btrim(strategy_key), '') IS NOT NULL
      AND NULLIF(btrim(strategy_identifier_namespace), '') IS NOT NULL
      AND strategy_identifier_namespace ~ '^[a-z0-9_]+$'
    )
  ),
  ADD CONSTRAINT orchestration_runs_gate3c_governed_source_check CHECK (
    strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR (
      NULLIF(btrim(strategy_key), '') IS NOT NULL
      AND NULLIF(btrim(strategy_identifier_namespace), '') IS NOT NULL
    )
  ),
  ADD CONSTRAINT orchestration_runs_gate3c_subject_shape_check CHECK (
    (subject_namespace IS NULL AND subject_key IS NULL)
    OR (
      subject_namespace ~ '^[a-z0-9_]+$'
      AND NULLIF(btrim(subject_key), '') IS NOT NULL
    )
  ),
  ADD CONSTRAINT orchestration_runs_gate3c_live_lineage_shape_check CHECK (
    mode <> 'approved_live'
    OR strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR (
      operating_strategy_id IS NOT NULL
      AND operating_strategy_version_id IS NOT NULL
      AND outbound_enrollment_id IS NOT NULL
      AND dispatch_reservation_id IS NOT NULL
      AND subject_namespace IS NOT NULL
      AND subject_key IS NOT NULL
      AND NULLIF(btrim(channel), '') IS NOT NULL
    )
  );

ALTER TABLE public.participant_opportunity_matches
  ADD CONSTRAINT participant_opportunity_matches_gate3c_source_binding_check CHECK (
    (strategy_key IS NULL AND strategy_identifier_namespace IS NULL)
    OR (
      NULLIF(btrim(strategy_key), '') IS NOT NULL
      AND NULLIF(btrim(strategy_identifier_namespace), '') IS NOT NULL
      AND strategy_identifier_namespace ~ '^[a-z0-9_]+$'
    )
  ),
  ADD CONSTRAINT participant_opportunity_matches_gate3c_governed_source_check CHECK (
    strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR (
      NULLIF(btrim(strategy_key), '') IS NOT NULL
      AND NULLIF(btrim(strategy_identifier_namespace), '') IS NOT NULL
    )
  );

CREATE INDEX orchestration_runs_gate3c_source_identifier_idx
  ON public.orchestration_runs(strategy_identifier_namespace, strategy_key)
  WHERE strategy_identifier_namespace IS NOT NULL AND strategy_key IS NOT NULL;
CREATE INDEX participant_opportunity_matches_gate3c_source_identifier_idx
  ON public.participant_opportunity_matches(strategy_identifier_namespace, strategy_key)
  WHERE strategy_identifier_namespace IS NOT NULL AND strategy_key IS NOT NULL;

CREATE TRIGGER orchestration_runs_canonical_operating_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id, operating_strategy_version_id
ON public.orchestration_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

CREATE TRIGGER participant_opportunity_matches_canonical_operating_strategy
BEFORE INSERT OR UPDATE OF strategy_key, strategy_identifier_namespace,
  operating_strategy_id, operating_strategy_version_id
ON public.participant_opportunity_matches
FOR EACH ROW EXECUTE FUNCTION private.gate3a_assign_runtime_strategy();

ALTER TABLE public.command_center_outbound_enrollments
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_id_version_key
    UNIQUE (id, operating_strategy_version_id),
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_membership_fkey
    FOREIGN KEY (strategy_lead_membership_id)
    REFERENCES public.strategy_lead_memberships(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_intent_shape_check CHECK (
    strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR (
      operating_strategy_id IS NOT NULL
      AND operating_strategy_version_id IS NOT NULL
      AND governed_stage IN ('draft', 'dispatch_intent')
      AND (
        (
          governed_stage = 'draft'
          AND status IN ('needs_review', 'approved')
          AND dispatch_intent_at IS NULL
          AND provider IS NULL
          AND provider_message_id IS NULL
        )
        OR (
          governed_stage = 'dispatch_intent'
          AND dispatch_reservation_id IS NOT NULL
          AND NULLIF(btrim(dispatch_channel), '') IS NOT NULL
          AND dispatch_intent_at IS NOT NULL
          AND NULLIF(btrim(outreach_purpose), '') IS NOT NULL
          AND jsonb_typeof(consent_basis_snapshot_json) = 'object'
          AND consent_basis_snapshot_json -> 'dispatchAuthorized' = 'true'::JSONB
          AND NULLIF(btrim(consent_basis_snapshot_json ->> 'basis'), '') IS NOT NULL
          AND NULLIF(btrim(consent_basis_snapshot_json ->> 'evidenceKey'), '') IS NOT NULL
          AND jsonb_typeof(suppression_snapshot_json) = 'object'
          AND suppression_snapshot_json -> 'suppressionCleared' = 'true'::JSONB
          AND NULLIF(btrim(suppression_snapshot_json ->> 'checkedAt'), '') IS NOT NULL
          AND NULLIF(btrim(suppression_snapshot_json ->> 'evidenceKey'), '') IS NOT NULL
          AND NULLIF(btrim(message_version_key), '') IS NOT NULL
        )
      )
    )
  ),
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_stage_scope_check CHECK (
    strategy_binding_mode = 'governed_v1'
    OR (governed_stage IS NULL AND dispatch_reservation_id IS NULL AND dispatch_channel IS NULL)
  ),
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_provider_shape_check CHECK (
    (provider IS NULL AND provider_message_id IS NULL)
    OR (
      strategy_binding_mode = 'governed_v1'
      AND governed_stage = 'dispatch_intent'
      AND NULLIF(btrim(provider), '') IS NOT NULL
      AND NULLIF(btrim(provider_message_id), '') IS NOT NULL
    )
  );

CREATE UNIQUE INDEX cc_outbound_enrollments_gate3c_provider_message_uidx
  ON public.command_center_outbound_enrollments(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE UNIQUE INDEX command_center_outbound_enrollments_gate3c_local_message_uidx
  ON public.command_center_outbound_enrollments(channel, last_message_id)
  WHERE strategy_binding_mode = 'governed_v1' AND last_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.gate3c_validate_runtime_binding(
  p_operating_strategy_id UUID,
  p_operating_strategy_version_id UUID,
  p_operating_contract_fingerprint TEXT,
  p_destination_mode TEXT,
  p_destination_path TEXT,
  p_cta_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  expected_fingerprint TEXT;
BEGIN
  SELECT candidate.*
    INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id
    AND candidate.operating_strategy_id = p_operating_strategy_id
    AND candidate.status = 'active'
    AND candidate.activated_at IS NOT NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A governed runtime record requires the exact active operating-strategy version.'
      USING ERRCODE = '23514';
  END IF;

  expected_fingerprint := private.gate3b_operating_contract_fingerprint(version);
  IF p_operating_contract_fingerprint IS DISTINCT FROM expected_fingerprint
    OR p_destination_mode IS DISTINCT FROM version.destination_mode
    OR p_destination_path IS DISTINCT FROM version.destination_path
    OR p_cta_label IS DISTINCT FROM version.cta_label THEN
    RAISE EXCEPTION 'The governed runtime binding does not match the active contract snapshot.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_validate_runtime_binding(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_guard_legacy_runtime_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  enforcement_mode TEXT;
  row_json JSONB := to_jsonb(NEW);
  prior_json JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::JSONB END;
BEGIN
  SELECT controls.enforcement_mode
    INTO enforcement_mode
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';

  IF TG_OP = 'INSERT' THEN
    IF enforcement_mode = 'governed_required'
      AND NEW.strategy_binding_mode IS DISTINCT FROM 'governed_v1' THEN
      RAISE EXCEPTION 'This runtime surface requires a governed_v1 binding after cutover.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.strategy_binding_mode IS NULL THEN
      NEW.strategy_binding_mode := 'legacy_compat';
    END IF;

    IF NEW.strategy_binding_mode = 'legacy_compat' THEN
      IF NEW.operating_strategy_version_id IS NOT NULL
        OR NEW.operating_contract_fingerprint IS NOT NULL
        OR NEW.strategy_binding_recorded_at IS NOT NULL THEN
        RAISE EXCEPTION 'A legacy_compat row cannot claim a governed operating version.'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW.strategy_binding_mode <> 'governed_v1'
      OR NEW.strategy_binding_recorded_at IS NULL
      OR NULLIF(btrim(NEW.strategy_writer_release), '') IS NULL THEN
      RAISE EXCEPTION 'A governed runtime row requires binding time and writer release.'
        USING ERRCODE = '23514';
    END IF;

    PERFORM private.gate3c_validate_runtime_binding(
      NEW.operating_strategy_id,
      NEW.operating_strategy_version_id,
      NEW.operating_contract_fingerprint,
      NEW.destination_mode_snapshot,
      NEW.destination_path_snapshot,
      NEW.cta_label_snapshot
    );
    RETURN NEW;
  END IF;

  IF enforcement_mode = 'governed_required'
    AND OLD.strategy_binding_mode IS DISTINCT FROM 'governed_v1' THEN
    RAISE EXCEPTION 'A historical or legacy_compat runtime row cannot be updated after governed cutover.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.strategy_binding_mode IS DISTINCT FROM 'governed_v1' THEN
    IF NEW.strategy_binding_mode IS DISTINCT FROM OLD.strategy_binding_mode
      OR NEW.operating_strategy_id IS DISTINCT FROM OLD.operating_strategy_id
      OR NEW.operating_strategy_version_id IS DISTINCT FROM OLD.operating_strategy_version_id
      OR NEW.strategy_binding_recorded_at IS DISTINCT FROM OLD.strategy_binding_recorded_at
      OR NEW.strategy_writer_release IS DISTINCT FROM OLD.strategy_writer_release
      OR NEW.destination_mode_snapshot IS DISTINCT FROM OLD.destination_mode_snapshot
      OR NEW.destination_path_snapshot IS DISTINCT FROM OLD.destination_path_snapshot
      OR NEW.cta_label_snapshot IS DISTINCT FROM OLD.cta_label_snapshot
      OR NEW.operating_contract_fingerprint IS DISTINCT FROM OLD.operating_contract_fingerprint
      OR (row_json ->> 'strategy_key') IS DISTINCT FROM (prior_json ->> 'strategy_key')
      OR (row_json ->> 'strategy_identifier_namespace') IS DISTINCT FROM
        (prior_json ->> 'strategy_identifier_namespace')
      OR (row_json ->> 'canonical_activity_id') IS DISTINCT FROM
        (prior_json ->> 'canonical_activity_id') THEN
      RAISE EXCEPTION 'Historical and legacy_compat binding identity and snapshots are immutable.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    AND (
      NEW.operating_strategy_version_id IS NOT NULL
      OR NEW.operating_contract_fingerprint IS NOT NULL
      OR NEW.strategy_binding_recorded_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Historical and legacy_compat rows cannot claim a governed operating version.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.strategy_binding_mode = 'governed_v1' THEN
    IF NEW.strategy_binding_mode IS DISTINCT FROM OLD.strategy_binding_mode
      OR NEW.operating_strategy_id IS DISTINCT FROM OLD.operating_strategy_id
      OR NEW.operating_strategy_version_id IS DISTINCT FROM OLD.operating_strategy_version_id
      OR NEW.strategy_binding_recorded_at IS DISTINCT FROM OLD.strategy_binding_recorded_at
      OR NEW.strategy_writer_release IS DISTINCT FROM OLD.strategy_writer_release
      OR NEW.destination_mode_snapshot IS DISTINCT FROM OLD.destination_mode_snapshot
      OR NEW.destination_path_snapshot IS DISTINCT FROM OLD.destination_path_snapshot
      OR NEW.cta_label_snapshot IS DISTINCT FROM OLD.cta_label_snapshot
      OR NEW.operating_contract_fingerprint IS DISTINCT FROM OLD.operating_contract_fingerprint
      OR (row_json ->> 'strategy_key') IS DISTINCT FROM (prior_json ->> 'strategy_key')
      OR (row_json ->> 'strategy_identifier_namespace') IS DISTINCT FROM
        (prior_json ->> 'strategy_identifier_namespace') THEN
      RAISE EXCEPTION 'A governed runtime strategy binding is immutable.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_legacy_runtime_binding()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER command_center_strategy_runs_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.command_center_strategy_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER strategy_source_events_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.strategy_source_events
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER strategy_market_state_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.strategy_market_state
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER strategy_lead_memberships_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.strategy_lead_memberships
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER command_center_outbound_enrollments_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.command_center_outbound_enrollments
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER orchestration_runs_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.orchestration_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();
CREATE TRIGGER participant_opportunity_matches_gate3c_binding_guard
BEFORE INSERT OR UPDATE ON public.participant_opportunity_matches
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_legacy_runtime_binding();

-- ---------------------------------------------------------------------------
-- Active runtime resolver. The database is the only fingerprint authority.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_operating_strategy_runtime(
  p_source_namespace TEXT,
  p_source_identifier TEXT,
  p_as_of TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  portfolio_key TEXT,
  strategy_key TEXT,
  operating_strategy_id UUID,
  operating_strategy_version_id UUID,
  operating_strategy_version INTEGER,
  version_status TEXT,
  operating_contract_fingerprint TEXT,
  execution_mode TEXT,
  external_send_cap INTEGER,
  destination_mode TEXT,
  destination_path TEXT,
  cta_label TEXT,
  crm_owner_key TEXT,
  automation_owner_key TEXT,
  dispatch_authority TEXT,
  primary_channels_json JSONB,
  secondary_channels_json JSONB,
  owner_contract_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  match_count INTEGER;
BEGIN
  IF NULLIF(btrim(p_source_namespace), '') IS NULL
    OR p_source_namespace !~ '^[a-z0-9_]+$'
    OR NULLIF(btrim(p_source_identifier), '') IS NULL
    OR p_as_of IS NULL THEN
    RAISE EXCEPTION 'A namespaced strategy identifier and as-of time are required.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO match_count
  FROM public.strategy_identifier_crosswalk crosswalk
  JOIN public.operating_strategies strategy
    ON strategy.id = crosswalk.operating_strategy_id
   AND strategy.retired_at IS NULL
  JOIN public.strategy_portfolios portfolio
    ON portfolio.portfolio_key = strategy.portfolio_key
   AND portfolio.governance_status = 'approved'
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.status = 'active'
   AND version.activated_at IS NOT NULL
  WHERE crosswalk.source_namespace = p_source_namespace
    AND crosswalk.source_identifier = p_source_identifier
    AND crosswalk.resolution_status = 'current'
    AND crosswalk.allows_new_activity
    AND crosswalk.approved_at IS NOT NULL
    AND crosswalk.valid_from <= p_as_of
    AND (crosswalk.valid_to IS NULL OR crosswalk.valid_to > p_as_of);

  IF match_count <> 1 THEN
    RAISE EXCEPTION 'Expected one active runtime strategy for %:%, found %.',
      p_source_namespace,
      p_source_identifier,
      match_count
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT
    crosswalk.portfolio_key,
    strategy.strategy_key,
    strategy.id,
    version.id,
    version.version,
    version.status,
    private.gate3b_operating_contract_fingerprint(
      (version.*)::public.operating_strategy_versions
    ),
    version.execution_mode,
    version.external_send_cap,
    version.destination_mode,
    version.destination_path,
    version.cta_label,
    version.crm_owner_key,
    version.automation_owner_key,
    version.owner_contract_json ->> 'dispatchAuthority',
    version.contract_json -> 'primaryChannels',
    version.contract_json -> 'secondaryChannels',
    version.owner_contract_json
  FROM public.strategy_identifier_crosswalk crosswalk
  JOIN public.operating_strategies strategy
    ON strategy.id = crosswalk.operating_strategy_id
   AND strategy.retired_at IS NULL
  JOIN public.strategy_portfolios portfolio
    ON portfolio.portfolio_key = strategy.portfolio_key
   AND portfolio.governance_status = 'approved'
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
   AND version.status = 'active'
   AND version.activated_at IS NOT NULL
  WHERE crosswalk.source_namespace = p_source_namespace
    AND crosswalk.source_identifier = p_source_identifier
    AND crosswalk.resolution_status = 'current'
    AND crosswalk.allows_new_activity
    AND crosswalk.approved_at IS NOT NULL
    AND crosswalk.valid_from <= p_as_of
    AND (crosswalk.valid_to IS NULL OR crosswalk.valid_to > p_as_of);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_operating_strategy_runtime(TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operating_strategy_runtime(TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- PII-free registry projection for the guarded Obsidian strategy-vault export.
-- It exposes governed contract documents and lifecycle timestamps only; no
-- runtime subjects, recipients, reviewer identities, or outreach payloads.
CREATE OR REPLACE FUNCTION public.list_operating_strategy_registry_projection()
RETURNS TABLE (
  portfolio_key TEXT,
  portfolio_title TEXT,
  strategy_key TEXT,
  strategy_title TEXT,
  operating_strategy_id UUID,
  operating_strategy_version_id UUID,
  operating_strategy_version INTEGER,
  version_status TEXT,
  execution_mode TEXT,
  destination_mode TEXT,
  destination_path TEXT,
  cta_label TEXT,
  external_send_cap INTEGER,
  crm_owner_key TEXT,
  automation_owner_key TEXT,
  operating_contract_fingerprint TEXT,
  contract_json JSONB,
  lifecycle_contract_json JSONB,
  owner_contract_json JSONB,
  outcome_contract_json JSONB,
  source_provenance_json JSONB,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  version_created_at TIMESTAMPTZ,
  version_updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    portfolio.portfolio_key,
    portfolio.title,
    strategy.strategy_key,
    strategy.title,
    strategy.id,
    version.id,
    version.version,
    version.status,
    version.execution_mode,
    version.destination_mode,
    version.destination_path,
    version.cta_label,
    version.external_send_cap,
    version.crm_owner_key,
    version.automation_owner_key,
    private.gate3b_operating_contract_fingerprint(
      (version.*)::public.operating_strategy_versions
    ),
    version.contract_json,
    version.lifecycle_contract_json,
    version.owner_contract_json,
    version.outcome_contract_json,
    version.source_provenance_json,
    version.approved_at,
    version.activated_at,
    version.retired_at,
    version.created_at,
    version.updated_at
  FROM public.operating_strategies strategy
  JOIN public.strategy_portfolios portfolio
    ON portfolio.portfolio_key = strategy.portfolio_key
  JOIN public.operating_strategy_versions version
    ON version.operating_strategy_id = strategy.id
  ORDER BY portfolio.portfolio_key, strategy.strategy_key, version.version;
$$;

REVOKE ALL ON FUNCTION public.list_operating_strategy_registry_projection()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_operating_strategy_registry_projection()
  TO service_role;

-- ---------------------------------------------------------------------------
-- Canonical append-only runtime activity ledger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.gate3c_canonical_fingerprint(p_value JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT md5(p_value::TEXT);
$$;

REVOKE ALL ON FUNCTION private.gate3c_canonical_fingerprint(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.operating_strategy_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'source',
    'enrollment',
    'orchestration',
    'message',
    'delivery',
    'reply',
    'domain_event',
    'handoff',
    'suppression',
    'operator_review'
  )),
  activity_namespace TEXT NOT NULL CHECK (activity_namespace ~ '^[a-z0-9_]+$'),
  activity_key TEXT NOT NULL CHECK (NULLIF(btrim(activity_key), '') IS NOT NULL),
  subject_namespace TEXT NOT NULL CHECK (subject_namespace ~ '^[a-z0-9_]+$'),
  subject_key TEXT NOT NULL CHECK (NULLIF(btrim(subject_key), '') IS NOT NULL),
  parent_activity_id UUID REFERENCES public.operating_strategy_activities(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_namespace TEXT,
  source_identifier TEXT,
  strategy_lead_membership_id UUID REFERENCES public.strategy_lead_memberships(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  outbound_enrollment_id UUID REFERENCES public.command_center_outbound_enrollments(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  dispatch_reservation_id UUID,
  dispatch_channel TEXT,
  dispatch_intent_at TIMESTAMPTZ,
  provider TEXT,
  provider_message_id TEXT,
  outreach_purpose TEXT,
  consent_basis_snapshot_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    jsonb_typeof(consent_basis_snapshot_json) = 'object'
  ),
  suppression_snapshot_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    jsonb_typeof(suppression_snapshot_json) = 'object'
  ),
  message_version_key TEXT,
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  destination_mode_snapshot TEXT NOT NULL CHECK (
    destination_mode_snapshot IN ('public_route', 'internal_only', 'unresolved')
  ),
  destination_path_snapshot TEXT,
  cta_label_snapshot TEXT,
  operating_contract_fingerprint TEXT NOT NULL CHECK (
    operating_contract_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  provenance_json JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (
    jsonb_typeof(provenance_json) = 'array'
  ),
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    jsonb_typeof(metadata_json) = 'object'
  ),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  activity_fingerprint TEXT NOT NULL CHECK (activity_fingerprint ~ '^[0-9a-f]{32}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, operating_strategy_version_id),
  UNIQUE (operating_strategy_version_id, idempotency_key),
  UNIQUE (operating_strategy_version_id, activity_namespace, activity_key),
  CONSTRAINT operating_strategy_activities_version_parent_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_activities_source_shape_check CHECK (
    (source_namespace IS NULL AND source_identifier IS NULL)
    OR (
      source_namespace ~ '^[a-z0-9_]+$'
      AND NULLIF(btrim(source_identifier), '') IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_required_source_check CHECK (
    activity_type NOT IN ('source', 'enrollment')
    OR (
      source_namespace IS NOT NULL
      AND source_identifier IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_destination_shape_check CHECK (
    (
      destination_mode_snapshot = 'public_route'
      AND destination_path_snapshot ~ '^/'
      AND NULLIF(btrim(cta_label_snapshot), '') IS NOT NULL
    )
    OR (
      destination_mode_snapshot IN ('internal_only', 'unresolved')
      AND destination_path_snapshot IS NULL
      AND cta_label_snapshot IS NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_provider_shape_check CHECK (
    (provider IS NULL AND provider_message_id IS NULL)
    OR (
      NULLIF(btrim(provider), '') IS NOT NULL
      AND NULLIF(btrim(provider_message_id), '') IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_enrollment_shape_check CHECK (
    activity_type <> 'enrollment'
    OR (
      outbound_enrollment_id IS NOT NULL
      AND activity_namespace = 'command_center_outbound_enrollment'
      AND activity_key = outbound_enrollment_id::TEXT
      AND dispatch_reservation_id IS NOT NULL
      AND NULLIF(btrim(dispatch_channel), '') IS NOT NULL
      AND dispatch_intent_at IS NOT NULL
      AND NULLIF(btrim(outreach_purpose), '') IS NOT NULL
      AND consent_basis_snapshot_json -> 'dispatchAuthorized' = 'true'::JSONB
      AND NULLIF(btrim(consent_basis_snapshot_json ->> 'basis'), '') IS NOT NULL
      AND NULLIF(btrim(consent_basis_snapshot_json ->> 'evidenceKey'), '') IS NOT NULL
      AND suppression_snapshot_json -> 'suppressionCleared' = 'true'::JSONB
      AND NULLIF(btrim(suppression_snapshot_json ->> 'checkedAt'), '') IS NOT NULL
      AND NULLIF(btrim(suppression_snapshot_json ->> 'evidenceKey'), '') IS NOT NULL
      AND NULLIF(btrim(message_version_key), '') IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_delivery_shape_check CHECK (
    activity_type <> 'delivery'
    OR (
      parent_activity_id IS NOT NULL
      AND NULLIF(btrim(provider), '') IS NOT NULL
      AND NULLIF(btrim(provider_message_id), '') IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_activities_reply_shape_check CHECK (
    activity_type <> 'reply' OR parent_activity_id IS NOT NULL
  ),
  CONSTRAINT operating_strategy_activities_domain_provenance_check CHECK (
    activity_type <> 'domain_event' OR jsonb_array_length(provenance_json) > 0
  )
);

CREATE INDEX operating_strategy_activities_strategy_time_idx
  ON public.operating_strategy_activities(
    operating_strategy_version_id,
    activity_type,
    occurred_at DESC
  );
CREATE INDEX operating_strategy_activities_subject_idx
  ON public.operating_strategy_activities(
    subject_namespace,
    subject_key,
    operating_strategy_version_id,
    occurred_at DESC
  );
CREATE INDEX operating_strategy_activities_parent_idx
  ON public.operating_strategy_activities(parent_activity_id)
  WHERE parent_activity_id IS NOT NULL;
CREATE INDEX operating_strategy_activities_membership_idx
  ON public.operating_strategy_activities(strategy_lead_membership_id)
  WHERE strategy_lead_membership_id IS NOT NULL;
CREATE INDEX operating_strategy_activities_enrollment_idx
  ON public.operating_strategy_activities(outbound_enrollment_id)
  WHERE outbound_enrollment_id IS NOT NULL;
CREATE INDEX operating_strategy_activities_provider_message_idx
  ON public.operating_strategy_activities(provider, provider_message_id, activity_type, occurred_at DESC)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.gate3c_guard_activity_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  parent public.operating_strategy_activities;
  mapped_strategy_id UUID;
  mapped_count INTEGER;
BEGIN
  SELECT candidate.*
    INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = NEW.operating_strategy_version_id
    AND candidate.status IN ('active', 'retired')
    AND candidate.activated_at IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canonical activity requires an activated, non-draft operating-strategy version.'
      USING ERRCODE = '23514';
  END IF;

  NEW.operating_strategy_id := version.operating_strategy_id;
  NEW.recorded_at := clock_timestamp();

  IF NEW.parent_activity_id IS NOT NULL THEN
    SELECT activity.* INTO parent
    FROM public.operating_strategy_activities activity
    WHERE activity.id = NEW.parent_activity_id
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent canonical activity not found.' USING ERRCODE = '23514';
    END IF;
    IF parent.subject_namespace IS DISTINCT FROM NEW.subject_namespace
      OR parent.subject_key IS DISTINCT FROM NEW.subject_key THEN
      RAISE EXCEPTION 'Parent and child canonical activities must identify the same subject.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.activity_type <> 'handoff'
      AND parent.operating_strategy_version_id IS DISTINCT FROM NEW.operating_strategy_version_id THEN
      RAISE EXCEPTION 'Only a handoff activity may cross operating-strategy versions.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.activity_type <> 'handoff' THEN
      IF (NEW.source_namespace IS NOT NULL OR NEW.source_identifier IS NOT NULL)
        AND (
          NEW.source_namespace IS DISTINCT FROM parent.source_namespace
          OR NEW.source_identifier IS DISTINCT FROM parent.source_identifier
        ) THEN
        RAISE EXCEPTION 'A child activity cannot replace its parent source attribution.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.strategy_lead_membership_id IS NOT NULL
        AND NEW.strategy_lead_membership_id IS DISTINCT FROM parent.strategy_lead_membership_id THEN
        RAISE EXCEPTION 'A child activity cannot replace its parent membership attribution.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.outbound_enrollment_id IS NOT NULL
        AND NEW.outbound_enrollment_id IS DISTINCT FROM parent.outbound_enrollment_id THEN
        RAISE EXCEPTION 'A child activity cannot replace its parent outbound-enrollment attribution.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF NEW.parent_activity_id IS NULL OR NEW.activity_type = 'handoff' THEN
    IF NEW.occurred_at < version.activated_at THEN
      RAISE EXCEPTION 'A root or handoff activity cannot predate activation of its bound operating version.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.occurred_at < parent.occurred_at THEN
    RAISE EXCEPTION 'A child callback cannot predate its immutable parent activity.'
      USING ERRCODE = '23514';
  END IF;

  IF version.status = 'retired' THEN
    IF NEW.parent_activity_id IS NULL
      OR NEW.activity_type NOT IN (
        'delivery', 'reply', 'suppression', 'domain_event', 'operator_review', 'orchestration'
      )
      OR parent.operating_strategy_version_id IS DISTINCT FROM NEW.operating_strategy_version_id THEN
      RAISE EXCEPTION 'A retired version accepts only an exact child callback on its immutable lineage.'
        USING ERRCODE = '23514';
    END IF;
    NEW.destination_mode_snapshot := parent.destination_mode_snapshot;
    NEW.destination_path_snapshot := parent.destination_path_snapshot;
    NEW.cta_label_snapshot := parent.cta_label_snapshot;
    NEW.operating_contract_fingerprint := parent.operating_contract_fingerprint;
    -- A source crosswalk may legitimately be closed after the original send.
    -- Late callbacks therefore rely on their exact, already-proven parent
    -- lineage (and may repeat its source keys) rather than requiring permission
    -- for new activity on a retired mapping.
  ELSE
    NEW.destination_mode_snapshot := version.destination_mode;
    NEW.destination_path_snapshot := version.destination_path;
    NEW.cta_label_snapshot := version.cta_label;
    NEW.operating_contract_fingerprint := private.gate3b_operating_contract_fingerprint(version);
  END IF;

  IF NEW.source_namespace IS NOT NULL
    AND (NEW.parent_activity_id IS NULL OR NEW.activity_type = 'handoff') THEN
    SELECT COUNT(*),
      (array_agg(crosswalk.operating_strategy_id ORDER BY crosswalk.id))[1]
      INTO mapped_count, mapped_strategy_id
    FROM public.strategy_identifier_crosswalk crosswalk
    WHERE crosswalk.source_namespace = NEW.source_namespace
      AND crosswalk.source_identifier = NEW.source_identifier
      AND crosswalk.resolution_status = 'current'
      AND crosswalk.allows_new_activity
      AND crosswalk.approved_at IS NOT NULL
      AND crosswalk.valid_from <= NEW.occurred_at
      AND (crosswalk.valid_to IS NULL OR crosswalk.valid_to > NEW.occurred_at);
    IF mapped_count <> 1 OR mapped_strategy_id IS DISTINCT FROM version.operating_strategy_id THEN
      RAISE EXCEPTION 'Activity source identifier does not resolve to the bound strategy.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.activity_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'operatingStrategyId', NEW.operating_strategy_id,
    'operatingStrategyVersionId', NEW.operating_strategy_version_id,
    'activityType', NEW.activity_type,
    'activityNamespace', NEW.activity_namespace,
    'activityKey', NEW.activity_key,
    'subjectNamespace', NEW.subject_namespace,
    'subjectKey', NEW.subject_key,
    'parentActivityId', NEW.parent_activity_id,
    'sourceNamespace', NEW.source_namespace,
    'sourceIdentifier', NEW.source_identifier,
    'strategyLeadMembershipId', NEW.strategy_lead_membership_id,
    'outboundEnrollmentId', NEW.outbound_enrollment_id,
    'dispatchReservationId', NEW.dispatch_reservation_id,
    'dispatchChannel', NEW.dispatch_channel,
    'dispatchIntentAt', NEW.dispatch_intent_at,
    'provider', NEW.provider,
    'providerMessageId', NEW.provider_message_id,
    'outreachPurpose', NEW.outreach_purpose,
    'consentBasisSnapshot', NEW.consent_basis_snapshot_json,
    'suppressionSnapshot', NEW.suppression_snapshot_json,
    'messageVersionKey', NEW.message_version_key,
    'writerRelease', NEW.writer_release,
    'destinationMode', NEW.destination_mode_snapshot,
    'destinationPath', NEW.destination_path_snapshot,
    'ctaLabel', NEW.cta_label_snapshot,
    'contractFingerprint', NEW.operating_contract_fingerprint,
    'provenance', NEW.provenance_json,
    'metadata', NEW.metadata_json,
    'occurredAt', NEW.occurred_at
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_activity_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_reject_append_only_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is forbidden.', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_reject_append_only_change()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_activities_insert_guard
BEFORE INSERT ON public.operating_strategy_activities
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_activity_insert();
CREATE TRIGGER operating_strategy_activities_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_activities
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_activities_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_activities
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_activities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_activities
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.operating_strategy_activities TO service_role;

CREATE OR REPLACE FUNCTION public.record_operating_strategy_activity(
  p_operating_strategy_version_id UUID,
  p_activity_type TEXT,
  p_activity_namespace TEXT,
  p_activity_key TEXT,
  p_subject_namespace TEXT,
  p_subject_key TEXT,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_parent_activity_id UUID DEFAULT NULL,
  p_source_namespace TEXT DEFAULT NULL,
  p_source_identifier TEXT DEFAULT NULL,
  p_strategy_lead_membership_id UUID DEFAULT NULL,
  p_outbound_enrollment_id UUID DEFAULT NULL,
  p_dispatch_reservation_id UUID DEFAULT NULL,
  p_dispatch_channel TEXT DEFAULT NULL,
  p_dispatch_intent_at TIMESTAMPTZ DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_provider_message_id TEXT DEFAULT NULL,
  p_outreach_purpose TEXT DEFAULT NULL,
  p_consent_basis_snapshot_json JSONB DEFAULT '{}'::JSONB,
  p_suppression_snapshot_json JSONB DEFAULT '{}'::JSONB,
  p_message_version_key TEXT DEFAULT NULL,
  p_provenance_json JSONB DEFAULT '[]'::JSONB,
  p_metadata_json JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result_id UUID;
  existing_fingerprint TEXT;
  candidate_fingerprint TEXT;
BEGIN
  SELECT activity.id INTO result_id
  FROM public.operating_strategy_activities activity
  WHERE activity.operating_strategy_version_id = p_operating_strategy_version_id
    AND activity.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.operating_strategy_activities activity
      WHERE activity.id = result_id
        AND (
          activity.activity_type IS DISTINCT FROM p_activity_type
          OR activity.activity_namespace IS DISTINCT FROM p_activity_namespace
          OR activity.activity_key IS DISTINCT FROM p_activity_key
          OR activity.subject_namespace IS DISTINCT FROM p_subject_namespace
          OR activity.subject_key IS DISTINCT FROM p_subject_key
          OR activity.parent_activity_id IS DISTINCT FROM p_parent_activity_id
          OR activity.source_namespace IS DISTINCT FROM p_source_namespace
          OR activity.source_identifier IS DISTINCT FROM p_source_identifier
          OR activity.strategy_lead_membership_id IS DISTINCT FROM p_strategy_lead_membership_id
          OR activity.outbound_enrollment_id IS DISTINCT FROM p_outbound_enrollment_id
          OR activity.dispatch_reservation_id IS DISTINCT FROM p_dispatch_reservation_id
          OR activity.dispatch_channel IS DISTINCT FROM p_dispatch_channel
          OR activity.dispatch_intent_at IS DISTINCT FROM p_dispatch_intent_at
          OR activity.provider IS DISTINCT FROM p_provider
          OR activity.provider_message_id IS DISTINCT FROM p_provider_message_id
          OR activity.outreach_purpose IS DISTINCT FROM p_outreach_purpose
          OR activity.consent_basis_snapshot_json IS DISTINCT FROM p_consent_basis_snapshot_json
          OR activity.suppression_snapshot_json IS DISTINCT FROM p_suppression_snapshot_json
          OR activity.message_version_key IS DISTINCT FROM p_message_version_key
          OR activity.writer_release IS DISTINCT FROM p_writer_release
          OR activity.provenance_json IS DISTINCT FROM p_provenance_json
          OR activity.metadata_json IS DISTINCT FROM p_metadata_json
          OR activity.occurred_at IS DISTINCT FROM p_occurred_at
        )
    ) THEN
      RAISE EXCEPTION 'Activity idempotency key was reused for different evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN result_id;
  END IF;

  INSERT INTO public.operating_strategy_activities(
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
    operating_contract_fingerprint,
    provenance_json,
    metadata_json,
    idempotency_key,
    activity_fingerprint,
    occurred_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_operating_strategy_version_id,
    p_activity_type,
    p_activity_namespace,
    p_activity_key,
    p_subject_namespace,
    p_subject_key,
    p_parent_activity_id,
    p_source_namespace,
    p_source_identifier,
    p_strategy_lead_membership_id,
    p_outbound_enrollment_id,
    p_dispatch_reservation_id,
    p_dispatch_channel,
    p_dispatch_intent_at,
    p_provider,
    p_provider_message_id,
    p_outreach_purpose,
    p_consent_basis_snapshot_json,
    p_suppression_snapshot_json,
    p_message_version_key,
    p_writer_release,
    'internal_only',
    '00000000000000000000000000000000',
    p_provenance_json,
    p_metadata_json,
    p_idempotency_key,
    '00000000000000000000000000000000',
    p_occurred_at
  )
  ON CONFLICT (operating_strategy_version_id, idempotency_key) DO NOTHING
  RETURNING id, activity_fingerprint INTO result_id, candidate_fingerprint;

  IF result_id IS NOT NULL THEN
    RETURN result_id;
  END IF;

  SELECT activity.id, activity.activity_fingerprint
    INTO result_id, existing_fingerprint
  FROM public.operating_strategy_activities activity
  WHERE activity.operating_strategy_version_id = p_operating_strategy_version_id
    AND activity.idempotency_key = p_idempotency_key;

  -- Re-run the candidate through the insert guard under a savepoint-free SELECT
  -- by comparing every caller-controlled field. This rejects idempotency-key reuse
  -- for different activity evidence while allowing exact retries.
  IF result_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.operating_strategy_activities activity
    WHERE activity.id = result_id
      AND (
        activity.activity_type IS DISTINCT FROM p_activity_type
        OR activity.activity_namespace IS DISTINCT FROM p_activity_namespace
        OR activity.activity_key IS DISTINCT FROM p_activity_key
        OR activity.subject_namespace IS DISTINCT FROM p_subject_namespace
        OR activity.subject_key IS DISTINCT FROM p_subject_key
        OR activity.parent_activity_id IS DISTINCT FROM p_parent_activity_id
        OR activity.source_namespace IS DISTINCT FROM p_source_namespace
        OR activity.source_identifier IS DISTINCT FROM p_source_identifier
        OR activity.strategy_lead_membership_id IS DISTINCT FROM p_strategy_lead_membership_id
        OR activity.outbound_enrollment_id IS DISTINCT FROM p_outbound_enrollment_id
        OR activity.dispatch_reservation_id IS DISTINCT FROM p_dispatch_reservation_id
        OR activity.dispatch_channel IS DISTINCT FROM p_dispatch_channel
        OR activity.dispatch_intent_at IS DISTINCT FROM p_dispatch_intent_at
        OR activity.provider IS DISTINCT FROM p_provider
        OR activity.provider_message_id IS DISTINCT FROM p_provider_message_id
        OR activity.outreach_purpose IS DISTINCT FROM p_outreach_purpose
        OR activity.consent_basis_snapshot_json IS DISTINCT FROM p_consent_basis_snapshot_json
        OR activity.suppression_snapshot_json IS DISTINCT FROM p_suppression_snapshot_json
        OR activity.message_version_key IS DISTINCT FROM p_message_version_key
        OR activity.writer_release IS DISTINCT FROM p_writer_release
        OR activity.provenance_json IS DISTINCT FROM p_provenance_json
        OR activity.metadata_json IS DISTINCT FROM p_metadata_json
        OR activity.occurred_at IS DISTINCT FROM p_occurred_at
      )
  ) THEN
    RAISE EXCEPTION 'Activity idempotency key was reused for different evidence.'
      USING ERRCODE = '23505';
  END IF;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_operating_strategy_activity(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ,
  UUID, TEXT, TEXT, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT,
  JSONB, JSONB, TEXT, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_operating_strategy_activity(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ,
  UUID, TEXT, TEXT, UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT,
  JSONB, JSONB, TEXT, JSONB, JSONB
) TO service_role;

DO $gate3c_add_canonical_activity_links$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'strategy_source_events',
    'strategy_market_state',
    'command_center_strategy_runs',
    'strategy_lead_memberships',
    'command_center_outbound_enrollments',
    'orchestration_runs',
    'participant_opportunity_matches'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN canonical_activity_id UUID',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (canonical_activity_id, operating_strategy_version_id) REFERENCES public.operating_strategy_activities(id, operating_strategy_version_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      table_name,
      table_name || '_gate3c_activity_version_fkey'
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX %I ON public.%I(canonical_activity_id) WHERE canonical_activity_id IS NOT NULL',
      table_name || '_gate3c_activity_uidx',
      table_name
    );
  END LOOP;
END
$gate3c_add_canonical_activity_links$;

CREATE OR REPLACE FUNCTION private.gate3c_guard_exact_runtime_activity_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_json JSONB := to_jsonb(NEW);
  prior_json JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::JSONB END;
  row_id UUID;
  canonical_activity_id UUID;
  operating_version_id UUID;
  activity public.operating_strategy_activities;
  expected_namespace TEXT := TG_ARGV[0];
  link_kind TEXT := COALESCE(TG_ARGV[1], 'entity');
BEGIN
  row_id := (row_json ->> 'id')::UUID;
  canonical_activity_id := NULLIF(row_json ->> 'canonical_activity_id', '')::UUID;
  operating_version_id := NULLIF(row_json ->> 'operating_strategy_version_id', '')::UUID;

  IF TG_OP = 'UPDATE'
    AND NULLIF(prior_json ->> 'canonical_activity_id', '') IS NOT NULL
    AND (row_json ->> 'canonical_activity_id') IS DISTINCT FROM
      (prior_json ->> 'canonical_activity_id') THEN
    RAISE EXCEPTION 'A canonical runtime activity link is immutable once recorded.'
      USING ERRCODE = '23514';
  END IF;
  IF canonical_activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = canonical_activity_id
    AND candidate.operating_strategy_version_id = operating_version_id
    AND candidate.activity_namespace = expected_namespace
    AND candidate.activity_key = row_id::TEXT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canonical activity must match the exact runtime entity namespace, key, and operating version.'
      USING ERRCODE = '23514';
  END IF;
  IF link_kind = 'membership'
    AND activity.strategy_lead_membership_id IS DISTINCT FROM row_id THEN
    RAISE EXCEPTION 'Membership activity must identify the exact strategy membership.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_exact_runtime_activity_link()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER strategy_source_events_gate3c_exact_activity_link
BEFORE INSERT OR UPDATE OF canonical_activity_id, operating_strategy_version_id
ON public.strategy_source_events
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_exact_runtime_activity_link(
  'strategy_source_event', 'entity'
);
CREATE TRIGGER strategy_market_state_gate3c_exact_activity_link
BEFORE INSERT OR UPDATE OF canonical_activity_id, operating_strategy_version_id
ON public.strategy_market_state
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_exact_runtime_activity_link(
  'strategy_market_state', 'entity'
);
CREATE TRIGGER command_center_strategy_runs_gate3c_exact_activity_link
BEFORE INSERT OR UPDATE OF canonical_activity_id, operating_strategy_version_id
ON public.command_center_strategy_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_exact_runtime_activity_link(
  'command_center_strategy_run', 'entity'
);
CREATE TRIGGER strategy_lead_memberships_gate3c_exact_activity_link
BEFORE INSERT OR UPDATE OF canonical_activity_id, operating_strategy_version_id
ON public.strategy_lead_memberships
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_exact_runtime_activity_link(
  'strategy_lead_membership', 'membership'
);
CREATE TRIGGER participant_opportunity_matches_gate3c_exact_activity_link
BEFORE INSERT OR UPDATE OF canonical_activity_id, operating_strategy_version_id
ON public.participant_opportunity_matches
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_exact_runtime_activity_link(
  'participant_opportunity_match', 'entity'
);

ALTER TABLE public.command_center_outbound_enrollments
  ADD CONSTRAINT cc_outbound_enrollments_gate3c_dispatch_activity_check CHECK (
    strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR status IN ('queued', 'needs_review', 'approved')
    OR canonical_activity_id IS NOT NULL
  );

CREATE OR REPLACE FUNCTION private.gate3c_guard_enrollment_activity_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  activity public.operating_strategy_activities;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.strategy_binding_mode = 'governed_v1' THEN
    IF OLD.governed_stage = 'dispatch_intent'
      AND (
        NEW.governed_stage IS DISTINCT FROM OLD.governed_stage
        OR NEW.strategy_lead_membership_id IS DISTINCT FROM OLD.strategy_lead_membership_id
        OR NEW.dispatch_reservation_id IS DISTINCT FROM OLD.dispatch_reservation_id
        OR NEW.dispatch_channel IS DISTINCT FROM OLD.dispatch_channel
        OR NEW.dispatch_intent_at IS DISTINCT FROM OLD.dispatch_intent_at
        OR NEW.outreach_purpose IS DISTINCT FROM OLD.outreach_purpose
        OR NEW.consent_basis_snapshot_json IS DISTINCT FROM OLD.consent_basis_snapshot_json
        OR NEW.suppression_snapshot_json IS DISTINCT FROM OLD.suppression_snapshot_json
        OR NEW.message_version_key IS DISTINCT FROM OLD.message_version_key
        OR NEW.channel IS DISTINCT FROM OLD.channel
        OR NEW.last_message_id IS DISTINCT FROM OLD.last_message_id
      ) THEN
      RAISE EXCEPTION 'A governed dispatch intent and its evidence are immutable.'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.provider IS NOT NULL
      AND (
        NEW.provider IS DISTINCT FROM OLD.provider
        OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
      ) THEN
      RAISE EXCEPTION 'A governed provider callback identity is immutable once recorded.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.canonical_activity_id IS NOT NULL
    AND NEW.canonical_activity_id IS DISTINCT FROM OLD.canonical_activity_id THEN
    RAISE EXCEPTION 'A canonical enrollment activity link is immutable.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.canonical_activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = NEW.canonical_activity_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND candidate.activity_type = 'enrollment'
    AND candidate.outbound_enrollment_id = NEW.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The enrollment must link its exact canonical enrollment activity and version.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_enrollment_activity_link()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER command_center_outbound_enrollments_gate3c_activity_link_guard
BEFORE INSERT OR UPDATE
ON public.command_center_outbound_enrollments
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_enrollment_activity_link();

-- ---------------------------------------------------------------------------
-- Canonical append-only outcomes and exact source/enrollment/message/domain
-- event attribution. Engagement telemetry may support an outcome, but a
-- verified primary conversion always requires a governed domain event.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN (
    'exposure',
    'leading_indicator',
    'primary_conversion',
    'guardrail_failure',
    'handoff',
    'verified_value'
  )),
  outcome_key TEXT NOT NULL CHECK (outcome_key ~ '^[a-z0-9][a-z0-9_.:-]*$'),
  subject_namespace TEXT NOT NULL CHECK (subject_namespace ~ '^[a-z0-9_]+$'),
  subject_key TEXT NOT NULL CHECK (NULLIF(btrim(subject_key), '') IS NOT NULL),
  verification_status TEXT NOT NULL CHECK (
    verification_status IN ('observed', 'verified', 'rejected')
  ),
  verified_by_kind TEXT,
  verified_by_key TEXT,
  verified_by_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  activity_ids_snapshot UUID[] NOT NULL CHECK (cardinality(activity_ids_snapshot) > 0),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  destination_mode_snapshot TEXT NOT NULL CHECK (
    destination_mode_snapshot IN ('public_route', 'internal_only', 'unresolved')
  ),
  destination_path_snapshot TEXT,
  cta_label_snapshot TEXT,
  operating_contract_fingerprint TEXT NOT NULL CHECK (
    operating_contract_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  evidence_json JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(evidence_json) = 'array'),
  value_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(value_json) = 'object'),
  provenance_json JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(provenance_json) = 'array'),
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata_json) = 'object'),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  outcome_fingerprint TEXT NOT NULL CHECK (outcome_fingerprint ~ '^[0-9a-f]{32}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, operating_strategy_version_id),
  UNIQUE (operating_strategy_version_id, idempotency_key),
  CONSTRAINT operating_strategy_outcomes_version_parent_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_outcomes_destination_shape_check CHECK (
    (
      destination_mode_snapshot = 'public_route'
      AND destination_path_snapshot ~ '^/'
      AND NULLIF(btrim(cta_label_snapshot), '') IS NOT NULL
    )
    OR (
      destination_mode_snapshot IN ('internal_only', 'unresolved')
      AND destination_path_snapshot IS NULL
      AND cta_label_snapshot IS NULL
    )
  ),
  CONSTRAINT operating_strategy_outcomes_verifier_shape_check CHECK (
    verification_status <> 'verified'
    OR (
      NULLIF(btrim(verified_by_kind), '') IS NOT NULL
      AND NULLIF(btrim(verified_by_key), '') IS NOT NULL
    )
  ),
  CONSTRAINT operating_strategy_outcomes_primary_conversion_check CHECK (
    outcome_type <> 'primary_conversion'
    OR (
      verification_status = 'verified'
      AND jsonb_array_length(evidence_json) > 0
      AND jsonb_array_length(provenance_json) > 0
    )
  ),
  CONSTRAINT operating_strategy_outcomes_verified_value_check CHECK (
    outcome_type <> 'verified_value'
    OR (
      verification_status = 'verified'
      AND jsonb_array_length(evidence_json) > 0
      AND jsonb_array_length(provenance_json) > 0
    )
  )
);

CREATE INDEX operating_strategy_outcomes_window_idx
  ON public.operating_strategy_outcomes(
    operating_strategy_version_id,
    occurred_at,
    outcome_type,
    verification_status
  );
CREATE INDEX operating_strategy_outcomes_subject_idx
  ON public.operating_strategy_outcomes(
    subject_namespace,
    subject_key,
    operating_strategy_version_id,
    occurred_at DESC
  );

-- Gate 3B defines exposure units and verified outcomes as count-once facts.
-- The subject key must identify that canonical business unit (case, match,
-- plan, introduction, asset, etc.); changing an idempotency key cannot create
-- another countable fact for the same version/outcome/subject.
CREATE UNIQUE INDEX operating_strategy_outcomes_count_once_unit_uidx
  ON public.operating_strategy_outcomes(
    operating_strategy_version_id,
    outcome_type,
    outcome_key,
    subject_namespace,
    subject_key
  )
  WHERE outcome_type IN ('exposure', 'primary_conversion', 'guardrail_failure');

CREATE TABLE public.operating_strategy_outcome_attributions (
  outcome_id UUID NOT NULL,
  activity_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  attribution_role TEXT NOT NULL CHECK (attribution_role IN (
    'source', 'enrollment', 'message', 'domain_event', 'supporting'
  )),
  activity_type_snapshot TEXT NOT NULL,
  source_namespace TEXT,
  source_identifier TEXT,
  strategy_lead_membership_id UUID,
  outbound_enrollment_id UUID,
  dispatch_reservation_id UUID,
  dispatch_channel TEXT,
  provider TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (outcome_id, activity_id),
  CONSTRAINT operating_strategy_outcome_attributions_outcome_fkey
    FOREIGN KEY (outcome_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_outcomes(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_outcome_attributions_activity_fkey
    FOREIGN KEY (activity_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_activities(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX operating_strategy_outcome_attributions_activity_idx
  ON public.operating_strategy_outcome_attributions(activity_id, outcome_id);
CREATE INDEX operating_strategy_outcome_attributions_source_idx
  ON public.operating_strategy_outcome_attributions(source_namespace, source_identifier)
  WHERE source_namespace IS NOT NULL AND source_identifier IS NOT NULL;
CREATE INDEX operating_strategy_outcome_attributions_enrollment_idx
  ON public.operating_strategy_outcome_attributions(outbound_enrollment_id)
  WHERE outbound_enrollment_id IS NOT NULL;
CREATE INDEX operating_strategy_outcome_attributions_reservation_idx
  ON public.operating_strategy_outcome_attributions(dispatch_reservation_id)
  WHERE dispatch_reservation_id IS NOT NULL;
CREATE INDEX operating_strategy_outcome_attributions_provider_idx
  ON public.operating_strategy_outcome_attributions(provider, provider_message_id)
  WHERE provider IS NOT NULL AND provider_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.gate3c_guard_outcome_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  normalized_activity_ids UUID[];
  supplied_activity_count INTEGER;
  matching_activity_count INTEGER;
  verified_domain_event_count INTEGER;
  late_child_domain_event_count INTEGER;
  snapshot_count INTEGER;
  evidence_contract_fingerprint TEXT;
  evidence_destination_mode TEXT;
  evidence_destination_path TEXT;
  evidence_cta_label TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.operating_strategy_version_id::TEXT, 0)
  );

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = NEW.operating_strategy_version_id
    AND candidate.status IN ('active', 'retired')
    AND candidate.activated_at IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Canonical outcomes require an activated, non-draft operating-strategy version.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.occurred_at < version.activated_at THEN
    RAISE EXCEPTION 'A canonical outcome cannot predate activation of its bound operating version.'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_learning_windows learning_window
    WHERE learning_window.operating_strategy_version_id = NEW.operating_strategy_version_id
      AND NEW.occurred_at >= learning_window.window_started_at
      AND NEW.occurred_at < learning_window.window_ended_at
  ) THEN
    RAISE EXCEPTION 'A canonical outcome cannot be backfilled into an immutable finalized learning window.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT item.activity_id ORDER BY item.activity_id), ARRAY[]::UUID[])
    INTO normalized_activity_ids
  FROM unnest(COALESCE(NEW.activity_ids_snapshot, ARRAY[]::UUID[])) AS item(activity_id);
  NEW.activity_ids_snapshot := normalized_activity_ids;
  supplied_activity_count := cardinality(normalized_activity_ids);
  IF supplied_activity_count = 0 THEN
    RAISE EXCEPTION 'A canonical outcome requires at least one attributed activity.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE activity.operating_strategy_version_id = NEW.operating_strategy_version_id
        AND activity.subject_namespace = NEW.subject_namespace
        AND activity.subject_key = NEW.subject_key
        AND activity.occurred_at <= NEW.occurred_at
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE activity.operating_strategy_version_id = NEW.operating_strategy_version_id
        AND activity.subject_namespace = NEW.subject_namespace
        AND activity.subject_key = NEW.subject_key
        AND activity.activity_type = 'domain_event'
        AND activity.occurred_at <= NEW.occurred_at
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE activity.operating_strategy_version_id = NEW.operating_strategy_version_id
        AND activity.subject_namespace = NEW.subject_namespace
        AND activity.subject_key = NEW.subject_key
        AND activity.activity_type = 'domain_event'
        AND activity.parent_activity_id IS NOT NULL
        AND version.retired_at IS NOT NULL
        AND activity.recorded_at >= version.retired_at
        AND activity.occurred_at <= NEW.occurred_at
    )::INTEGER
    INTO matching_activity_count, verified_domain_event_count, late_child_domain_event_count
  FROM public.operating_strategy_activities activity
  WHERE activity.id = ANY(normalized_activity_ids);

  IF matching_activity_count <> supplied_activity_count THEN
    RAISE EXCEPTION 'Every attributed activity must exist on the exact version and subject.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COUNT(DISTINCT (
      activity.operating_contract_fingerprint,
      activity.destination_mode_snapshot,
      activity.destination_path_snapshot,
      activity.cta_label_snapshot
    ))::INTEGER,
    (array_agg(activity.operating_contract_fingerprint ORDER BY activity.id))[1],
    (array_agg(activity.destination_mode_snapshot ORDER BY activity.id))[1],
    (array_agg(activity.destination_path_snapshot ORDER BY activity.id))[1],
    (array_agg(activity.cta_label_snapshot ORDER BY activity.id))[1]
    INTO snapshot_count,
      evidence_contract_fingerprint,
      evidence_destination_mode,
      evidence_destination_path,
      evidence_cta_label
  FROM public.operating_strategy_activities activity
  WHERE activity.id = ANY(normalized_activity_ids)
    AND activity.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND activity.subject_namespace = NEW.subject_namespace
    AND activity.subject_key = NEW.subject_key
    AND activity.occurred_at <= NEW.occurred_at;
  IF snapshot_count <> 1 THEN
    RAISE EXCEPTION 'Every attributed activity must carry one identical immutable contract and destination snapshot.'
      USING ERRCODE = '23514';
  END IF;

  IF version.status = 'retired' THEN
    IF version.retired_at IS NULL THEN
      RAISE EXCEPTION 'A retired operating version must carry its immutable retirement timestamp.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.outcome_type NOT IN ('primary_conversion', 'verified_value')
      OR NEW.verification_status <> 'verified'
      OR jsonb_array_length(NEW.evidence_json) = 0
      OR jsonb_array_length(NEW.provenance_json) = 0 THEN
      RAISE EXCEPTION 'A retired version accepts only verified conversion or value outcomes with substantive evidence and provenance.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.outcome_type IN ('primary_conversion', 'verified_value')
      AND late_child_domain_event_count < 1 THEN
      RAISE EXCEPTION 'A retired-version conversion or verified value requires an exact late child domain event.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.outcome_type IN ('primary_conversion', 'verified_value')
    AND verified_domain_event_count < 1 THEN
    RAISE EXCEPTION 'Delivery, open, click, reply, or message telemetry cannot prove a conversion or verified value; a governed domain event is required.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.occurred_at > statement_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'A canonical outcome cannot be recorded materially in the future.'
      USING ERRCODE = '23514';
  END IF;

  NEW.operating_strategy_id := version.operating_strategy_id;
  IF version.status = 'retired' THEN
    NEW.destination_mode_snapshot := evidence_destination_mode;
    NEW.destination_path_snapshot := evidence_destination_path;
    NEW.cta_label_snapshot := evidence_cta_label;
    NEW.operating_contract_fingerprint := evidence_contract_fingerprint;
  ELSE
    IF evidence_contract_fingerprint IS DISTINCT FROM
      private.gate3b_operating_contract_fingerprint(version)
      OR evidence_destination_mode IS DISTINCT FROM version.destination_mode
      OR evidence_destination_path IS DISTINCT FROM version.destination_path
      OR evidence_cta_label IS DISTINCT FROM version.cta_label THEN
      RAISE EXCEPTION 'Active-version outcome evidence does not match the current immutable contract snapshot.'
        USING ERRCODE = '23514';
    END IF;
    NEW.destination_mode_snapshot := version.destination_mode;
    NEW.destination_path_snapshot := version.destination_path;
    NEW.cta_label_snapshot := version.cta_label;
    NEW.operating_contract_fingerprint := evidence_contract_fingerprint;
  END IF;
  NEW.outcome_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'operatingStrategyId', NEW.operating_strategy_id,
    'operatingStrategyVersionId', NEW.operating_strategy_version_id,
    'outcomeType', NEW.outcome_type,
    'outcomeKey', NEW.outcome_key,
    'subjectNamespace', NEW.subject_namespace,
    'subjectKey', NEW.subject_key,
    'verificationStatus', NEW.verification_status,
    'verifiedByKind', NEW.verified_by_kind,
    'verifiedByKey', NEW.verified_by_key,
    'verifiedByUserId', NEW.verified_by_user_id,
    'activityIds', NEW.activity_ids_snapshot,
    'writerRelease', NEW.writer_release,
    'destinationMode', NEW.destination_mode_snapshot,
    'destinationPath', NEW.destination_path_snapshot,
    'ctaLabel', NEW.cta_label_snapshot,
    'contractFingerprint', NEW.operating_contract_fingerprint,
    'evidence', NEW.evidence_json,
    'value', NEW.value_json,
    'provenance', NEW.provenance_json,
    'metadata', NEW.metadata_json,
    'occurredAt', NEW.occurred_at
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_outcome_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_guard_outcome_attribution_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  outcome public.operating_strategy_outcomes;
  activity public.operating_strategy_activities;
BEGIN
  SELECT candidate.* INTO outcome
  FROM public.operating_strategy_outcomes candidate
  WHERE candidate.id = NEW.outcome_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attributed outcome not found on the supplied version.' USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = NEW.activity_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
  FOR SHARE;
  IF NOT FOUND OR array_position(outcome.activity_ids_snapshot, NEW.activity_id) IS NULL THEN
    RAISE EXCEPTION 'Attributed activity is not part of the immutable outcome evidence set.'
      USING ERRCODE = '23514';
  END IF;

  NEW.attribution_role := CASE
    WHEN activity.activity_type = 'source' THEN 'source'
    WHEN activity.activity_type = 'enrollment' THEN 'enrollment'
    WHEN activity.activity_type IN ('message', 'delivery', 'reply') THEN 'message'
    WHEN activity.activity_type = 'domain_event' THEN 'domain_event'
    ELSE 'supporting'
  END;
  NEW.activity_type_snapshot := activity.activity_type;
  NEW.source_namespace := activity.source_namespace;
  NEW.source_identifier := activity.source_identifier;
  NEW.strategy_lead_membership_id := activity.strategy_lead_membership_id;
  NEW.outbound_enrollment_id := activity.outbound_enrollment_id;
  NEW.dispatch_reservation_id := activity.dispatch_reservation_id;
  NEW.dispatch_channel := activity.dispatch_channel;
  NEW.provider := activity.provider;
  NEW.provider_message_id := activity.provider_message_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_outcome_attribution_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_validate_outcome_attribution_set()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recorded_activity_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(attribution.activity_id ORDER BY attribution.activity_id), ARRAY[]::UUID[])
    INTO recorded_activity_ids
  FROM public.operating_strategy_outcome_attributions attribution
  WHERE attribution.outcome_id = NEW.id;

  IF recorded_activity_ids IS DISTINCT FROM NEW.activity_ids_snapshot THEN
    RAISE EXCEPTION 'Outcome attribution rows must exactly match the immutable activity evidence set.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_validate_outcome_attribution_set()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_outcomes_insert_guard
BEFORE INSERT ON public.operating_strategy_outcomes
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_outcome_insert();
CREATE TRIGGER operating_strategy_outcomes_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_outcomes
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_outcomes_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_outcomes
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE CONSTRAINT TRIGGER operating_strategy_outcomes_attribution_set_guard
AFTER INSERT ON public.operating_strategy_outcomes
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.gate3c_validate_outcome_attribution_set();

CREATE TRIGGER operating_strategy_outcome_attributions_insert_guard
BEFORE INSERT ON public.operating_strategy_outcome_attributions
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_outcome_attribution_insert();
CREATE TRIGGER operating_strategy_outcome_attributions_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_outcome_attributions
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_outcome_attributions_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_outcome_attributions
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_outcomes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_outcome_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_outcome_attributions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_outcomes,
  public.operating_strategy_outcome_attributions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_outcomes,
  public.operating_strategy_outcome_attributions TO service_role;

CREATE OR REPLACE FUNCTION public.record_operating_strategy_outcome(
  p_operating_strategy_version_id UUID,
  p_outcome_type TEXT,
  p_outcome_key TEXT,
  p_subject_namespace TEXT,
  p_subject_key TEXT,
  p_verification_status TEXT,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_activity_ids UUID[],
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_verified_by_kind TEXT DEFAULT NULL,
  p_verified_by_key TEXT DEFAULT NULL,
  p_verified_by_user_id UUID DEFAULT NULL,
  p_evidence_json JSONB DEFAULT '[]'::JSONB,
  p_value_json JSONB DEFAULT '{}'::JSONB,
  p_provenance_json JSONB DEFAULT '[]'::JSONB,
  p_metadata_json JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_id UUID;
  normalized_activity_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT item.activity_id ORDER BY item.activity_id), ARRAY[]::UUID[])
    INTO normalized_activity_ids
  FROM unnest(COALESCE(p_activity_ids, ARRAY[]::UUID[])) AS item(activity_id);

  -- Serialize outcome insertion with final learning-window snapshots. Exact
  -- retries are resolved before the insert guard so they remain idempotent
  -- after their original window has been finalized.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_operating_strategy_version_id::TEXT, 0)
  );
  SELECT outcome.id INTO result_id
  FROM public.operating_strategy_outcomes outcome
  WHERE outcome.operating_strategy_version_id = p_operating_strategy_version_id
    AND outcome.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.operating_strategy_outcomes outcome
      WHERE outcome.id = result_id
        AND (
          outcome.outcome_type IS DISTINCT FROM p_outcome_type
          OR outcome.outcome_key IS DISTINCT FROM p_outcome_key
          OR outcome.subject_namespace IS DISTINCT FROM p_subject_namespace
          OR outcome.subject_key IS DISTINCT FROM p_subject_key
          OR outcome.verification_status IS DISTINCT FROM p_verification_status
          OR outcome.verified_by_kind IS DISTINCT FROM p_verified_by_kind
          OR outcome.verified_by_key IS DISTINCT FROM p_verified_by_key
          OR outcome.verified_by_user_id IS DISTINCT FROM p_verified_by_user_id
          OR outcome.activity_ids_snapshot IS DISTINCT FROM normalized_activity_ids
          OR outcome.writer_release IS DISTINCT FROM p_writer_release
          OR outcome.evidence_json IS DISTINCT FROM p_evidence_json
          OR outcome.value_json IS DISTINCT FROM p_value_json
          OR outcome.provenance_json IS DISTINCT FROM p_provenance_json
          OR outcome.metadata_json IS DISTINCT FROM p_metadata_json
          OR outcome.occurred_at IS DISTINCT FROM p_occurred_at
        )
    ) THEN
      RAISE EXCEPTION 'Outcome idempotency key was reused for different evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN result_id;
  END IF;

  INSERT INTO public.operating_strategy_outcomes(
    operating_strategy_id,
    operating_strategy_version_id,
    outcome_type,
    outcome_key,
    subject_namespace,
    subject_key,
    verification_status,
    verified_by_kind,
    verified_by_key,
    verified_by_user_id,
    activity_ids_snapshot,
    writer_release,
    destination_mode_snapshot,
    operating_contract_fingerprint,
    evidence_json,
    value_json,
    provenance_json,
    metadata_json,
    idempotency_key,
    outcome_fingerprint,
    occurred_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_operating_strategy_version_id,
    p_outcome_type,
    p_outcome_key,
    p_subject_namespace,
    p_subject_key,
    p_verification_status,
    p_verified_by_kind,
    p_verified_by_key,
    p_verified_by_user_id,
    normalized_activity_ids,
    p_writer_release,
    'internal_only',
    '00000000000000000000000000000000',
    p_evidence_json,
    p_value_json,
    p_provenance_json,
    p_metadata_json,
    p_idempotency_key,
    '00000000000000000000000000000000',
    p_occurred_at
  )
  ON CONFLICT (operating_strategy_version_id, idempotency_key) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT outcome.id INTO result_id
    FROM public.operating_strategy_outcomes outcome
    WHERE outcome.operating_strategy_version_id = p_operating_strategy_version_id
      AND outcome.idempotency_key = p_idempotency_key;

    IF result_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_outcomes outcome
      WHERE outcome.id = result_id
        AND (
          outcome.outcome_type IS DISTINCT FROM p_outcome_type
          OR outcome.outcome_key IS DISTINCT FROM p_outcome_key
          OR outcome.subject_namespace IS DISTINCT FROM p_subject_namespace
          OR outcome.subject_key IS DISTINCT FROM p_subject_key
          OR outcome.verification_status IS DISTINCT FROM p_verification_status
          OR outcome.verified_by_kind IS DISTINCT FROM p_verified_by_kind
          OR outcome.verified_by_key IS DISTINCT FROM p_verified_by_key
          OR outcome.verified_by_user_id IS DISTINCT FROM p_verified_by_user_id
          OR outcome.activity_ids_snapshot IS DISTINCT FROM normalized_activity_ids
          OR outcome.writer_release IS DISTINCT FROM p_writer_release
          OR outcome.evidence_json IS DISTINCT FROM p_evidence_json
          OR outcome.value_json IS DISTINCT FROM p_value_json
          OR outcome.provenance_json IS DISTINCT FROM p_provenance_json
          OR outcome.metadata_json IS DISTINCT FROM p_metadata_json
          OR outcome.occurred_at IS DISTINCT FROM p_occurred_at
        )
    ) THEN
      RAISE EXCEPTION 'Outcome idempotency key was reused for different evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN result_id;
  END IF;

  INSERT INTO public.operating_strategy_outcome_attributions(
    outcome_id,
    activity_id,
    operating_strategy_version_id,
    attribution_role,
    activity_type_snapshot
  )
  SELECT
    result_id,
    activity.id,
    p_operating_strategy_version_id,
    'supporting',
    activity.activity_type
  FROM public.operating_strategy_activities activity
  WHERE activity.id = ANY(normalized_activity_ids)
  ORDER BY activity.id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_operating_strategy_outcome(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], TIMESTAMPTZ,
  TEXT, TEXT, UUID, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_operating_strategy_outcome(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], TIMESTAMPTZ,
  TEXT, TEXT, UUID, JSONB, JSONB, JSONB, JSONB
) TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic daily external-send capacity reservation. Version-row locking makes
-- concurrent batches serialize before any provider dispatch. Reservations are
-- short-lived; canonical enrollment activities consume their reserved units.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_dispatch_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  operating_contract_fingerprint TEXT NOT NULL CHECK (
    operating_contract_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  channel TEXT NOT NULL CHECK (NULLIF(btrim(channel), '') IS NOT NULL),
  channel_candidates TEXT[] NOT NULL CHECK (
    cardinality(channel_candidates) > 0 AND channel = channel_candidates[1]
  ),
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  remaining_capacity_after_reservation INTEGER NOT NULL CHECK (
    remaining_capacity_after_reservation >= 0
  ),
  ttl_seconds INTEGER NOT NULL CHECK (ttl_seconds BETWEEN 30 AND 900),
  capacity_window_started_at TIMESTAMPTZ NOT NULL,
  capacity_window_ends_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  reservation_fingerprint TEXT NOT NULL CHECK (reservation_fingerprint ~ '^[0-9a-f]{32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, operating_strategy_version_id),
  UNIQUE (operating_strategy_version_id, idempotency_key),
  CONSTRAINT operating_strategy_dispatch_reservations_version_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_dispatch_reservations_time_check CHECK (
    capacity_window_started_at < capacity_window_ends_at
    AND expires_at > created_at
    AND expires_at <= capacity_window_ends_at
  )
);

CREATE INDEX operating_strategy_dispatch_reservations_capacity_idx
  ON public.operating_strategy_dispatch_reservations(
    operating_strategy_version_id,
    capacity_window_started_at,
    expires_at
  );

ALTER TABLE public.command_center_outbound_enrollments
  ADD CONSTRAINT command_center_outbound_enrollments_gate3c_reservation_fkey
    FOREIGN KEY (dispatch_reservation_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_dispatch_reservations(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.orchestration_runs
  ADD CONSTRAINT orchestration_runs_gate3c_enrollment_fkey
    FOREIGN KEY (outbound_enrollment_id, operating_strategy_version_id)
    REFERENCES public.command_center_outbound_enrollments(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT orchestration_runs_gate3c_reservation_fkey
    FOREIGN KEY (dispatch_reservation_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_dispatch_reservations(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT orchestration_runs_gate3c_live_activity_shape_check CHECK (
    mode <> 'approved_live'
    OR strategy_binding_mode IS DISTINCT FROM 'governed_v1'
    OR canonical_activity_id IS NOT NULL
  );

ALTER TABLE public.operating_strategy_activities
  ADD CONSTRAINT operating_strategy_activities_dispatch_reservation_fkey
    FOREIGN KEY (dispatch_reservation_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_dispatch_reservations(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT operating_strategy_activities_dispatch_reservation_scope_check CHECK (
    (
      activity_type = 'enrollment'
      AND dispatch_reservation_id IS NOT NULL
      AND NULLIF(btrim(dispatch_channel), '') IS NOT NULL
    )
    OR (
      activity_type <> 'enrollment'
      AND dispatch_reservation_id IS NULL
      AND dispatch_channel IS NULL
    )
  );

CREATE OR REPLACE FUNCTION private.gate3c_guard_dispatch_reservation_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reservation public.operating_strategy_dispatch_reservations;
  enrollment public.command_center_outbound_enrollments;
  existing_activity public.operating_strategy_activities;
  consumed_count INTEGER;
BEGIN
  IF NEW.activity_type <> 'enrollment' THEN
    RETURN NEW;
  END IF;

  -- Capacity reservation and consumption share this version-row lock. This
  -- prevents an activity commit between the reservation RPC's dispatched and
  -- outstanding-reservation counts from temporarily releasing the same unit
  -- twice under READ COMMITTED snapshots.
  PERFORM 1
  FROM public.operating_strategy_versions version
  WHERE version.id = NEW.operating_strategy_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A canonical enrollment requires an existing operating version.'
      USING ERRCODE = '23514';
  END IF;

  -- BEFORE INSERT runs before ON CONFLICT. Let an exact reservation identity
  -- replay reach the RPC's full evidence comparison without consuming a second
  -- unit; reject a conflicting reuse immediately.
  SELECT candidate.* INTO existing_activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND candidate.idempotency_key = NEW.idempotency_key;
  IF FOUND THEN
    IF existing_activity.dispatch_reservation_id IS DISTINCT FROM NEW.dispatch_reservation_id
      OR existing_activity.outbound_enrollment_id IS DISTINCT FROM NEW.outbound_enrollment_id
      OR existing_activity.dispatch_channel IS DISTINCT FROM NEW.dispatch_channel THEN
      RAISE EXCEPTION 'Enrollment activity idempotency conflicts with reserved dispatch evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
  END IF;

  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = NEW.dispatch_reservation_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A canonical enrollment requires its exact dispatch reservation.'
      USING ERRCODE = '23514';
  END IF;
  IF statement_timestamp() >= reservation.expires_at
    OR NEW.dispatch_intent_at < reservation.capacity_window_started_at
    OR NEW.dispatch_intent_at >= reservation.capacity_window_ends_at THEN
    RAISE EXCEPTION 'The dispatch reservation is expired or outside its daily capacity window.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO enrollment
  FROM public.command_center_outbound_enrollments candidate
  WHERE candidate.id = NEW.outbound_enrollment_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND candidate.dispatch_reservation_id = reservation.id
    AND candidate.strategy_binding_mode = 'governed_v1'
    AND candidate.governed_stage = 'dispatch_intent'
    AND candidate.dispatch_channel = NEW.dispatch_channel
    AND NEW.dispatch_channel = ANY(reservation.channel_candidates)
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The reservation, governed enrollment, channel, and version must match exactly.'
      USING ERRCODE = '23514';
  END IF;
  IF enrollment.dispatch_intent_at IS DISTINCT FROM NEW.dispatch_intent_at
    OR enrollment.outreach_purpose IS DISTINCT FROM NEW.outreach_purpose
    OR enrollment.consent_basis_snapshot_json IS DISTINCT FROM NEW.consent_basis_snapshot_json
    OR enrollment.suppression_snapshot_json IS DISTINCT FROM NEW.suppression_snapshot_json
    OR enrollment.message_version_key IS DISTINCT FROM NEW.message_version_key THEN
    RAISE EXCEPTION 'The canonical enrollment activity must preserve the exact dispatch-intent evidence snapshot.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)::INTEGER INTO consumed_count
  FROM public.operating_strategy_activities activity
  WHERE activity.dispatch_reservation_id = reservation.id
    AND activity.activity_type = 'enrollment';
  IF consumed_count >= reservation.requested_count THEN
    RAISE EXCEPTION 'The dispatch reservation has no unconsumed capacity.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_dispatch_reservation_activity()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_activities_dispatch_reservation_guard
BEFORE INSERT ON public.operating_strategy_activities
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_dispatch_reservation_activity();

CREATE OR REPLACE FUNCTION private.gate3c_guard_live_orchestration_lineage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  activity public.operating_strategy_activities;
  enrollment public.command_center_outbound_enrollments;
  reservation public.operating_strategy_dispatch_reservations;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.canonical_activity_id IS NOT NULL
    AND NEW.canonical_activity_id IS DISTINCT FROM OLD.canonical_activity_id THEN
    RAISE EXCEPTION 'An orchestration canonical activity link is immutable once recorded.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.strategy_binding_mode = 'governed_v1'
    AND OLD.mode = 'approved_live'
    AND (
      NEW.mode IS DISTINCT FROM OLD.mode
      OR NEW.outbound_enrollment_id IS DISTINCT FROM OLD.outbound_enrollment_id
      OR NEW.dispatch_reservation_id IS DISTINCT FROM OLD.dispatch_reservation_id
      OR NEW.canonical_activity_id IS DISTINCT FROM OLD.canonical_activity_id
      OR NEW.subject_namespace IS DISTINCT FROM OLD.subject_namespace
      OR NEW.subject_key IS DISTINCT FROM OLD.subject_key
      OR NEW.channel IS DISTINCT FROM OLD.channel
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    ) THEN
    RAISE EXCEPTION 'Governed approved-live orchestration lineage is immutable.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.mode <> 'approved_live' OR NEW.strategy_binding_mode IS DISTINCT FROM 'governed_v1' THEN
    IF NEW.canonical_activity_id IS NOT NULL THEN
      SELECT candidate.* INTO activity
      FROM public.operating_strategy_activities candidate
      WHERE candidate.id = NEW.canonical_activity_id
        AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
        AND candidate.activity_type = 'orchestration'
        AND candidate.activity_namespace = 'orchestration_run'
        AND candidate.activity_key = NEW.id::TEXT;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'A non-live orchestration link must identify its exact orchestration activity.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = NEW.canonical_activity_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND candidate.activity_type = 'enrollment'
    AND candidate.outbound_enrollment_id = NEW.outbound_enrollment_id
    AND candidate.dispatch_reservation_id = NEW.dispatch_reservation_id
    AND candidate.dispatch_channel = NEW.channel
    AND candidate.subject_namespace = NEW.subject_namespace
    AND candidate.subject_key = NEW.subject_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved-live orchestration requires the exact canonical enrollment activity, version, reservation, channel, and subject.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO enrollment
  FROM public.command_center_outbound_enrollments candidate
  WHERE candidate.id = NEW.outbound_enrollment_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND candidate.dispatch_reservation_id = NEW.dispatch_reservation_id
    AND candidate.canonical_activity_id = NEW.canonical_activity_id
    AND candidate.dispatch_channel = NEW.channel
    AND candidate.strategy_binding_mode = 'governed_v1'
    AND candidate.governed_stage = 'dispatch_intent';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved-live orchestration enrollment lineage does not match.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = NEW.dispatch_reservation_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND NEW.channel = ANY(candidate.channel_candidates);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved-live orchestration reservation lineage does not match.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.orchestration_controls controls
    WHERE controls.integration_key = NEW.integration_key
      AND controls.live_send_enabled
      AND NOT controls.kill_switch
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(controls.approved_channels_json) approved(channel)
        WHERE approved.channel = NEW.channel
      )
  ) THEN
    RAISE EXCEPTION 'Approved-live orchestration remains blocked by its integration control or channel allowlist.'
      USING ERRCODE = '23514';
  END IF;
  IF (TG_OP = 'INSERT' OR OLD.mode IS DISTINCT FROM 'approved_live')
    AND statement_timestamp() >= reservation.expires_at THEN
    RAISE EXCEPTION 'Approved-live orchestration cannot begin with an expired reservation.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_live_orchestration_lineage()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER orchestration_runs_gate3c_live_lineage_guard
BEFORE INSERT OR UPDATE ON public.orchestration_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_live_orchestration_lineage();

CREATE INDEX orchestration_runs_gate3c_enrollment_idx
  ON public.orchestration_runs(outbound_enrollment_id)
  WHERE outbound_enrollment_id IS NOT NULL;
CREATE INDEX orchestration_runs_gate3c_reservation_idx
  ON public.orchestration_runs(dispatch_reservation_id)
  WHERE dispatch_reservation_id IS NOT NULL;
CREATE INDEX orchestration_runs_gate3c_subject_idx
  ON public.orchestration_runs(subject_namespace, subject_key)
  WHERE subject_namespace IS NOT NULL AND subject_key IS NOT NULL;

CREATE TRIGGER operating_strategy_dispatch_reservations_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_dispatch_reservations
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_dispatch_reservations_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_dispatch_reservations
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_dispatch_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_dispatch_reservations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_dispatch_reservations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_dispatch_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_operating_strategy_dispatch(
  p_operating_strategy_version_id UUID,
  p_operating_contract_fingerprint TEXT,
  p_channel TEXT,
  p_requested_count INTEGER,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_ttl_seconds INTEGER DEFAULT 300,
  p_fallback_channels TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
  reservation_id UUID,
  reserved_count INTEGER,
  remaining_daily_capacity INTEGER,
  expires_at TIMESTAMPTZ,
  capacity_window_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  expected_fingerprint TEXT;
  existing_reservation public.operating_strategy_dispatch_reservations;
  window_started_at TIMESTAMPTZ;
  window_ends_at TIMESTAMPTZ;
  reservation_expires_at TIMESTAMPTZ;
  dispatched_count INTEGER;
  outstanding_reserved_count INTEGER;
  available_count INTEGER;
  new_reservation_id UUID;
  new_reservation_fingerprint TEXT;
  normalized_fallback_channels TEXT[];
  channel_candidates TEXT[];
BEGIN
  IF p_requested_count IS NULL OR p_requested_count < 1
    OR p_ttl_seconds IS NULL OR p_ttl_seconds < 30 OR p_ttl_seconds > 900
    OR NULLIF(btrim(p_channel), '') IS NULL
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL
    OR NULLIF(btrim(p_writer_release), '') IS NULL THEN
    RAISE EXCEPTION 'Dispatch reservation count, channel, idempotency key, writer release, and 30-900 second TTL are required.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id
  FOR UPDATE;
  IF NOT FOUND
    OR version.status <> 'active'
    OR version.activated_at IS NULL
    OR version.approved_at IS NULL
    OR version.execution_mode <> 'approved_live' THEN
    RAISE EXCEPTION 'Dispatch capacity requires an approved, activated, send-capable operating version.'
      USING ERRCODE = '23514';
  END IF;

  expected_fingerprint := private.gate3b_operating_contract_fingerprint(version);
  IF p_operating_contract_fingerprint IS DISTINCT FROM expected_fingerprint THEN
    RAISE EXCEPTION 'Dispatch reservation contract fingerprint mismatch.' USING ERRCODE = '23514';
  END IF;
  IF version.external_send_cap < 1 THEN
    RAISE EXCEPTION 'External send capacity is zero.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(version.owner_contract_json ->> 'dispatchAuthority', '') LIKE 'none%'
    OR COALESCE(version.owner_contract_json ->> 'dispatchAuthority', '') = '' THEN
    RAISE EXCEPTION 'The active version does not grant dispatch authority.' USING ERRCODE = '23514';
  END IF;
  -- Preserve the caller's first-occurrence fallback order. A reservation is one
  -- logical send, so adapter priority is contract evidence rather than a set to
  -- alphabetize. Duplicate candidates are collapsed without changing priority.
  SELECT COALESCE(array_agg(item.channel ORDER BY item.first_ordinality), ARRAY[]::TEXT[])
    INTO normalized_fallback_channels
  FROM (
    SELECT fallback.channel, MIN(fallback.ordinality) AS first_ordinality
    FROM unnest(COALESCE(p_fallback_channels, ARRAY[]::TEXT[]))
      WITH ORDINALITY AS fallback(channel, ordinality)
    WHERE fallback.channel IS DISTINCT FROM p_channel
    GROUP BY fallback.channel
  ) item;
  channel_candidates := ARRAY[p_channel] || normalized_fallback_channels;

  IF EXISTS (
    SELECT 1
    FROM unnest(channel_candidates) AS requested(channel)
    WHERE NULLIF(btrim(requested.channel), '') IS NULL
      OR requested.channel IN ('no_outreach', 'operator_task')
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          COALESCE(version.contract_json -> 'primaryChannels', '[]'::JSONB)
          || COALESCE(version.contract_json -> 'secondaryChannels', '[]'::JSONB)
        ) allowed(channel)
        WHERE allowed.channel = requested.channel
      )
  ) THEN
    RAISE EXCEPTION 'Every primary or fallback dispatch channel must be authorized by the active version.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(version.contract_json -> 'primaryChannels', '[]'::JSONB)
      || COALESCE(version.contract_json -> 'secondaryChannels', '[]'::JSONB)
    ) allowed(channel)
    WHERE allowed.channel = p_channel
  ) OR p_channel IN ('no_outreach', 'operator_task') THEN
    RAISE EXCEPTION 'The requested dispatch channel is not authorized by the active version.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO existing_reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.operating_strategy_version_id = p_operating_strategy_version_id
    AND candidate.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_reservation.operating_contract_fingerprint IS DISTINCT FROM p_operating_contract_fingerprint
      OR existing_reservation.channel IS DISTINCT FROM p_channel
      OR existing_reservation.channel_candidates IS DISTINCT FROM channel_candidates
      OR existing_reservation.requested_count IS DISTINCT FROM p_requested_count
      OR existing_reservation.ttl_seconds IS DISTINCT FROM p_ttl_seconds
      OR existing_reservation.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'Dispatch reservation idempotency key was reused for a different request.'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT
      existing_reservation.id,
      existing_reservation.requested_count,
      existing_reservation.remaining_capacity_after_reservation,
      existing_reservation.expires_at,
      existing_reservation.capacity_window_ends_at;
    RETURN;
  END IF;

  window_started_at := date_trunc('day', statement_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  window_ends_at := window_started_at + INTERVAL '1 day';
  reservation_expires_at := LEAST(
    statement_timestamp() + make_interval(secs => p_ttl_seconds),
    window_ends_at
  );

  SELECT COUNT(*)::INTEGER INTO dispatched_count
  FROM public.operating_strategy_activities activity
  WHERE activity.operating_strategy_version_id = p_operating_strategy_version_id
    AND activity.activity_type = 'enrollment'
    AND activity.dispatch_intent_at >= window_started_at
    AND activity.dispatch_intent_at < window_ends_at;

  SELECT COALESCE(SUM(GREATEST(
    reservation.requested_count - (
      SELECT COUNT(*)::INTEGER
      FROM public.operating_strategy_activities consumed
      WHERE consumed.dispatch_reservation_id = reservation.id
        AND consumed.activity_type = 'enrollment'
    ),
    0
  )), 0)::INTEGER INTO outstanding_reserved_count
  FROM public.operating_strategy_dispatch_reservations reservation
  WHERE reservation.operating_strategy_version_id = p_operating_strategy_version_id
    AND reservation.capacity_window_started_at = window_started_at
    AND reservation.expires_at > statement_timestamp();

  available_count := version.external_send_cap - dispatched_count - outstanding_reserved_count;
  IF p_requested_count > available_count THEN
    RAISE EXCEPTION 'Daily external-send cap exceeded: requested %, available %.',
      p_requested_count,
      GREATEST(available_count, 0)
      USING ERRCODE = '23514';
  END IF;

  new_reservation_id := gen_random_uuid();
  new_reservation_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'reservationId', new_reservation_id,
    'operatingStrategyId', version.operating_strategy_id,
    'operatingStrategyVersionId', version.id,
    'operatingContractFingerprint', expected_fingerprint,
    'channel', p_channel,
    'channelCandidates', channel_candidates,
    'requestedCount', p_requested_count,
    'remainingCapacityAfterReservation', available_count - p_requested_count,
    'ttlSeconds', p_ttl_seconds,
    'capacityWindowStartedAt', window_started_at,
    'capacityWindowEndsAt', window_ends_at,
    'expiresAt', reservation_expires_at,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));

  INSERT INTO public.operating_strategy_dispatch_reservations(
    id,
    operating_strategy_id,
    operating_strategy_version_id,
    operating_contract_fingerprint,
    channel,
    channel_candidates,
    requested_count,
    remaining_capacity_after_reservation,
    ttl_seconds,
    capacity_window_started_at,
    capacity_window_ends_at,
    expires_at,
    writer_release,
    idempotency_key,
    reservation_fingerprint
  ) VALUES (
    new_reservation_id,
    version.operating_strategy_id,
    version.id,
    expected_fingerprint,
    p_channel,
    channel_candidates,
    p_requested_count,
    available_count - p_requested_count,
    p_ttl_seconds,
    window_started_at,
    window_ends_at,
    reservation_expires_at,
    p_writer_release,
    p_idempotency_key,
    new_reservation_fingerprint
  );

  RETURN QUERY SELECT
    new_reservation_id,
    p_requested_count,
    available_count - p_requested_count,
    reservation_expires_at,
    window_ends_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) TO service_role;

-- ---------------------------------------------------------------------------
-- Complete, immutable learning windows. Thresholds are copied from the exact
-- active version contract. Any guardrail failure blocks review eligibility.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_learning_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  window_key TEXT NOT NULL CHECK (window_key ~ '^[a-z0-9][a-z0-9_.:-]*$'),
  window_state TEXT NOT NULL DEFAULT 'complete' CHECK (window_state = 'complete'),
  window_started_at TIMESTAMPTZ NOT NULL,
  window_ended_at TIMESTAMPTZ NOT NULL,
  learning_window_days INTEGER NOT NULL CHECK (learning_window_days > 0),
  minimum_exposure INTEGER NOT NULL CHECK (minimum_exposure > 0),
  minimum_primary_conversions INTEGER NOT NULL CHECK (minimum_primary_conversions > 0),
  required_complete_windows INTEGER NOT NULL CHECK (required_complete_windows = 2),
  exposure_count INTEGER NOT NULL CHECK (exposure_count >= 0),
  leading_indicator_count INTEGER NOT NULL CHECK (leading_indicator_count >= 0),
  primary_conversion_count INTEGER NOT NULL CHECK (primary_conversion_count >= 0),
  guardrail_failure_count INTEGER NOT NULL CHECK (guardrail_failure_count >= 0),
  eligible_for_review BOOLEAN NOT NULL,
  source_outcome_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  operating_contract_fingerprint TEXT NOT NULL CHECK (
    operating_contract_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  summary_fingerprint TEXT NOT NULL CHECK (summary_fingerprint ~ '^[0-9a-f]{32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, operating_strategy_version_id),
  UNIQUE (operating_strategy_version_id, window_key),
  UNIQUE (operating_strategy_version_id, idempotency_key),
  CONSTRAINT operating_strategy_learning_windows_version_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_learning_windows_bounds_check CHECK (
    window_started_at < window_ended_at
  ),
  CONSTRAINT operating_strategy_learning_windows_eligibility_check CHECK (
    eligible_for_review = (
      exposure_count >= minimum_exposure
      AND primary_conversion_count >= minimum_primary_conversions
      AND guardrail_failure_count = 0
    )
  )
);

CREATE INDEX operating_strategy_learning_windows_version_time_idx
  ON public.operating_strategy_learning_windows(
    operating_strategy_version_id,
    window_started_at,
    window_ended_at
  );
CREATE INDEX operating_strategy_learning_windows_review_idx
  ON public.operating_strategy_learning_windows(
    operating_strategy_version_id,
    eligible_for_review,
    window_ended_at DESC
  );

CREATE OR REPLACE FUNCTION private.gate3c_guard_learning_window_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  contract_fingerprint TEXT;
  prior_window_end TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.operating_strategy_version_id::TEXT, 0));

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = NEW.operating_strategy_version_id
    AND candidate.status = 'active'
    AND candidate.activated_at IS NOT NULL
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A learning window requires the exact active operating version.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.window_ended_at > statement_timestamp()
    OR NEW.window_started_at >= NEW.window_ended_at THEN
    RAISE EXCEPTION 'Only elapsed, complete learning windows may be summarized.'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.window_started_at < version.activated_at THEN
    RAISE EXCEPTION 'A learning window cannot begin before activation of its bound operating version.'
      USING ERRCODE = '23514';
  END IF;
  IF version.outcome_contract_json ->> 'requiredCompleteWindows' <> '2'
    OR (version.outcome_contract_json ->> 'learningWindowDays') !~ '^[1-9][0-9]*$'
    OR (version.outcome_contract_json ->> 'minimumExposure') !~ '^[1-9][0-9]*$'
    OR (version.outcome_contract_json ->> 'minimumPrimaryConversions') !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION 'The active version does not contain a governed two-window learning contract.'
      USING ERRCODE = '23514';
  END IF;

  NEW.learning_window_days := (version.outcome_contract_json ->> 'learningWindowDays')::INTEGER;
  NEW.minimum_exposure := (version.outcome_contract_json ->> 'minimumExposure')::INTEGER;
  NEW.minimum_primary_conversions :=
    (version.outcome_contract_json ->> 'minimumPrimaryConversions')::INTEGER;
  NEW.required_complete_windows := 2;
  IF NEW.window_ended_at IS DISTINCT FROM
    NEW.window_started_at + make_interval(days => NEW.learning_window_days) THEN
    RAISE EXCEPTION 'The learning window must have the exact duration required by the version contract.'
      USING ERRCODE = '23514';
  END IF;

  SELECT learning_window.window_ended_at INTO prior_window_end
  FROM public.operating_strategy_learning_windows learning_window
  WHERE learning_window.operating_strategy_version_id = NEW.operating_strategy_version_id
  ORDER BY learning_window.window_ended_at DESC, learning_window.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.window_started_at IS DISTINCT FROM version.activated_at THEN
      RAISE EXCEPTION 'The first learning window must begin exactly at operating-version activation.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.window_started_at IS DISTINCT FROM prior_window_end THEN
    RAISE EXCEPTION 'Learning windows must be consecutive with no gap, overlap, or cherry-picked period.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_learning_windows existing
    WHERE existing.operating_strategy_version_id = NEW.operating_strategy_version_id
      AND tstzrange(existing.window_started_at, existing.window_ended_at, '[)')
        && tstzrange(NEW.window_started_at, NEW.window_ended_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Complete learning windows for one version may not overlap.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COUNT(DISTINCT (
      outcome.outcome_key,
      outcome.subject_namespace,
      outcome.subject_key
    )) FILTER (
      WHERE outcome.outcome_type = 'exposure'
        AND outcome.verification_status <> 'rejected'
    )::INTEGER,
    COUNT(DISTINCT (
      outcome.outcome_key,
      outcome.subject_namespace,
      outcome.subject_key
    )) FILTER (
      WHERE outcome.outcome_type = 'leading_indicator'
        AND outcome.verification_status <> 'rejected'
    )::INTEGER,
    COUNT(DISTINCT (
      outcome.outcome_key,
      outcome.subject_namespace,
      outcome.subject_key
    )) FILTER (
      WHERE outcome.outcome_type = 'primary_conversion'
        AND outcome.verification_status = 'verified'
    )::INTEGER,
    COUNT(DISTINCT (
      outcome.outcome_key,
      outcome.subject_namespace,
      outcome.subject_key
    )) FILTER (
      WHERE outcome.outcome_type = 'guardrail_failure'
        AND outcome.verification_status <> 'rejected'
    )::INTEGER,
    COALESCE(array_agg(outcome.id ORDER BY outcome.occurred_at, outcome.id), ARRAY[]::UUID[])
    INTO
      NEW.exposure_count,
      NEW.leading_indicator_count,
      NEW.primary_conversion_count,
      NEW.guardrail_failure_count,
      NEW.source_outcome_ids
  FROM public.operating_strategy_outcomes outcome
  WHERE outcome.operating_strategy_version_id = NEW.operating_strategy_version_id
    AND outcome.occurred_at >= NEW.window_started_at
    AND outcome.occurred_at < NEW.window_ended_at;

  NEW.eligible_for_review :=
    NEW.exposure_count >= NEW.minimum_exposure
    AND NEW.primary_conversion_count >= NEW.minimum_primary_conversions
    AND NEW.guardrail_failure_count = 0;
  NEW.operating_strategy_id := version.operating_strategy_id;
  contract_fingerprint := private.gate3b_operating_contract_fingerprint(version);
  NEW.operating_contract_fingerprint := contract_fingerprint;
  NEW.summary_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'operatingStrategyId', NEW.operating_strategy_id,
    'operatingStrategyVersionId', NEW.operating_strategy_version_id,
    'windowKey', NEW.window_key,
    'windowState', NEW.window_state,
    'windowStartedAt', NEW.window_started_at,
    'windowEndedAt', NEW.window_ended_at,
    'learningWindowDays', NEW.learning_window_days,
    'minimumExposure', NEW.minimum_exposure,
    'minimumPrimaryConversions', NEW.minimum_primary_conversions,
    'requiredCompleteWindows', NEW.required_complete_windows,
    'exposureCount', NEW.exposure_count,
    'leadingIndicatorCount', NEW.leading_indicator_count,
    'primaryConversionCount', NEW.primary_conversion_count,
    'guardrailFailureCount', NEW.guardrail_failure_count,
    'eligibleForReview', NEW.eligible_for_review,
    'sourceOutcomeIds', NEW.source_outcome_ids,
    'operatingContractFingerprint', contract_fingerprint,
    'writerRelease', NEW.writer_release
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_learning_window_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_learning_windows_insert_guard
BEFORE INSERT ON public.operating_strategy_learning_windows
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_learning_window_insert();
CREATE TRIGGER operating_strategy_learning_windows_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_learning_windows
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_learning_windows_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_learning_windows
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_learning_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_learning_windows FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_learning_windows
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_learning_windows TO service_role;

CREATE OR REPLACE FUNCTION public.summarize_operating_strategy_learning_window(
  p_operating_strategy_version_id UUID,
  p_window_key TEXT,
  p_window_started_at TIMESTAMPTZ,
  p_window_ended_at TIMESTAMPTZ,
  p_idempotency_key TEXT,
  p_writer_release TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version_id UUID;
  result_id UUID;
BEGIN
  IF NULLIF(btrim(p_window_key), '') IS NULL
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL
    OR NULLIF(btrim(p_writer_release), '') IS NULL
    OR p_window_started_at IS NULL
    OR p_window_ended_at IS NULL THEN
    RAISE EXCEPTION 'Window key, exact bounds, idempotency key, and writer release are required.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_operating_strategy_version_id::TEXT, 0)
  );

  SELECT version.id INTO version_id
  FROM public.operating_strategy_versions version
  WHERE version.id = p_operating_strategy_version_id
    AND version.status = 'active'
    AND version.activated_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A learning window requires an active operating version.'
      USING ERRCODE = '23514';
  END IF;

  SELECT learning_window.id INTO result_id
  FROM public.operating_strategy_learning_windows learning_window
  WHERE learning_window.operating_strategy_version_id = p_operating_strategy_version_id
    AND learning_window.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.operating_strategy_learning_windows learning_window
      WHERE learning_window.id = result_id
        AND (
          learning_window.window_key IS DISTINCT FROM p_window_key
          OR learning_window.window_started_at IS DISTINCT FROM p_window_started_at
          OR learning_window.window_ended_at IS DISTINCT FROM p_window_ended_at
          OR learning_window.writer_release IS DISTINCT FROM p_writer_release
        )
    ) THEN
      RAISE EXCEPTION 'Learning-window idempotency key was reused for different bounds.'
        USING ERRCODE = '23505';
    END IF;
    RETURN result_id;
  END IF;

  INSERT INTO public.operating_strategy_learning_windows(
    operating_strategy_id,
    operating_strategy_version_id,
    window_key,
    window_started_at,
    window_ended_at,
    learning_window_days,
    minimum_exposure,
    minimum_primary_conversions,
    required_complete_windows,
    exposure_count,
    leading_indicator_count,
    primary_conversion_count,
    guardrail_failure_count,
    eligible_for_review,
    operating_contract_fingerprint,
    writer_release,
    idempotency_key,
    summary_fingerprint
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_operating_strategy_version_id,
    p_window_key,
    p_window_started_at,
    p_window_ended_at,
    1,
    1,
    1,
    2,
    0,
    0,
    0,
    0,
    FALSE,
    '00000000000000000000000000000000',
    p_writer_release,
    p_idempotency_key,
    '00000000000000000000000000000000'
  )
  RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.summarize_operating_strategy_learning_window(
  UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.summarize_operating_strategy_learning_window(
  UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- Founder review authority and immutable proposal manifests. The allowlist is
-- intentionally empty in Gate 3C. A separately approved migration must name a
-- reviewer before any decision or activation can succeed.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_reviewer_authorities (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  authority_role TEXT NOT NULL CHECK (authority_role = 'founder_reviewer'),
  can_review_learning BOOLEAN NOT NULL DEFAULT TRUE,
  can_activate_operating_versions BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,
  authority_fingerprint TEXT NOT NULL CHECK (authority_fingerprint ~ '^[0-9a-f]{32}$'),
  source_provenance_json JSONB NOT NULL CHECK (
    jsonb_typeof(source_provenance_json) = 'array'
    AND jsonb_array_length(source_provenance_json) > 0
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operating_strategy_reviewer_authorities_validity_check CHECK (
    valid_to IS NULL OR valid_to > valid_from
  )
);

CREATE OR REPLACE FUNCTION private.gate3c_guard_reviewer_authority_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.authority_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'userId', NEW.user_id,
    'authorityRole', NEW.authority_role,
    'canReviewLearning', NEW.can_review_learning,
    'canActivateOperatingVersions', NEW.can_activate_operating_versions,
    'validFrom', NEW.valid_from,
    'validTo', NEW.valid_to,
    'sourceProvenance', NEW.source_provenance_json
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_reviewer_authority_write()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER operating_strategy_reviewer_authorities_write_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_reviewer_authorities
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_reviewer_authority_write();

ALTER TABLE public.operating_strategy_reviewer_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_reviewer_authorities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_reviewer_authorities
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_reviewer_authorities TO service_role;

CREATE TABLE public.operating_strategy_review_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('learning_proposal', 'activation_review')),
  proposal_key TEXT NOT NULL CHECK (proposal_key ~ '^[a-z0-9][a-z0-9_.:-]*$'),
  proposed_change_json JSONB NOT NULL CHECK (
    jsonb_typeof(proposed_change_json) = 'object'
    AND proposed_change_json <> '{}'::JSONB
  ),
  proposed_by_kind TEXT NOT NULL CHECK (proposed_by_kind IN ('agent', 'operator', 'system')),
  proposed_by_key TEXT NOT NULL CHECK (NULLIF(btrim(proposed_by_key), '') IS NOT NULL),
  proposed_by_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  learning_window_ids_snapshot UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  required_complete_windows INTEGER NOT NULL CHECK (required_complete_windows IN (0, 2)),
  operating_version_status_snapshot TEXT NOT NULL CHECK (
    operating_version_status_snapshot IN ('draft', 'active')
  ),
  external_send_cap_snapshot INTEGER NOT NULL CHECK (external_send_cap_snapshot >= 0),
  operating_contract_fingerprint TEXT NOT NULL CHECK (
    operating_contract_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  apply_status TEXT NOT NULL DEFAULT 'pending_human_review' CHECK (
    apply_status = 'pending_human_review'
  ),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  proposal_fingerprint TEXT NOT NULL CHECK (proposal_fingerprint ~ '^[0-9a-f]{32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, operating_strategy_version_id),
  UNIQUE (operating_strategy_version_id, idempotency_key),
  CONSTRAINT operating_strategy_review_manifests_version_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_review_manifests_window_shape_check CHECK (
    (review_type = 'learning_proposal' AND required_complete_windows = 2
      AND cardinality(learning_window_ids_snapshot) = 2)
    OR (review_type = 'activation_review' AND required_complete_windows = 0
      AND cardinality(learning_window_ids_snapshot) = 0)
  ),
  CONSTRAINT operating_strategy_review_manifests_no_auto_apply_check CHECK (
    NOT (proposed_change_json ? 'activationAppliedAt')
    AND NOT (proposed_change_json ? 'appliedAt')
    AND (
      NOT (proposed_change_json ? 'autoApply')
      OR proposed_change_json -> 'autoApply' = 'false'::JSONB
    )
    AND (
      NOT (proposed_change_json ? 'applyAutomatically')
      OR proposed_change_json -> 'applyAutomatically' = 'false'::JSONB
    )
  )
);

CREATE TABLE public.operating_strategy_review_manifest_windows (
  manifest_id UUID NOT NULL,
  learning_window_id UUID NOT NULL,
  operating_strategy_version_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal IN (1, 2)),
  summary_fingerprint_snapshot TEXT NOT NULL CHECK (
    summary_fingerprint_snapshot ~ '^[0-9a-f]{32}$'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manifest_id, learning_window_id),
  UNIQUE (manifest_id, ordinal),
  CONSTRAINT operating_strategy_review_manifest_windows_manifest_fkey
    FOREIGN KEY (manifest_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_review_manifests(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT operating_strategy_review_manifest_windows_window_fkey
    FOREIGN KEY (learning_window_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_learning_windows(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE TABLE public.operating_strategy_review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id UUID NOT NULL UNIQUE REFERENCES public.operating_strategy_review_manifests(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  reviewed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reviewed_by_key TEXT NOT NULL CHECK (NULLIF(btrim(reviewed_by_key), '') IS NOT NULL),
  expected_proposal_fingerprint TEXT NOT NULL CHECK (
    expected_proposal_fingerprint ~ '^[0-9a-f]{32}$'
  ),
  rationale TEXT NOT NULL CHECK (length(btrim(rationale)) >= 12),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  decision_fingerprint TEXT NOT NULL CHECK (decision_fingerprint ~ '^[0-9a-f]{32}$'),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX operating_strategy_review_manifests_queue_idx
  ON public.operating_strategy_review_manifests(review_type, created_at DESC);
CREATE INDEX operating_strategy_review_manifest_windows_window_idx
  ON public.operating_strategy_review_manifest_windows(learning_window_id, manifest_id);
CREATE INDEX operating_strategy_review_decisions_reviewer_idx
  ON public.operating_strategy_review_decisions(reviewed_by_user_id, decided_at DESC);

CREATE OR REPLACE FUNCTION private.gate3c_guard_review_manifest_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  normalized_window_ids UUID[];
  latest_window_ids UUID[];
  matching_window_count INTEGER;
  selected_window_fingerprints JSONB;
  runtime_control public.operating_strategy_runtime_controls;
BEGIN
  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = NEW.operating_strategy_version_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review manifest operating version not found.' USING ERRCODE = '23514';
  END IF;
  IF NEW.proposed_by_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.operating_strategy_reviewer_authorities authority
    WHERE authority.user_id = NEW.proposed_by_user_id
      AND authority.valid_from <= statement_timestamp()
      AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
  ) THEN
    RAISE EXCEPTION 'A governed reviewer cannot be represented as a service-authored proposer.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT item.window_id ORDER BY item.window_id), ARRAY[]::UUID[])
    INTO normalized_window_ids
  FROM unnest(COALESCE(NEW.learning_window_ids_snapshot, ARRAY[]::UUID[])) AS item(window_id);
  NEW.learning_window_ids_snapshot := normalized_window_ids;
  NEW.operating_strategy_id := version.operating_strategy_id;
  NEW.operating_version_status_snapshot := version.status;
  NEW.external_send_cap_snapshot := version.external_send_cap;
  NEW.operating_contract_fingerprint := private.gate3b_operating_contract_fingerprint(version);

  IF NEW.review_type = 'learning_proposal' THEN
    IF version.status <> 'active' OR version.activated_at IS NULL THEN
      RAISE EXCEPTION 'Learning proposals require an active operating version.' USING ERRCODE = '23514';
    END IF;
    NEW.required_complete_windows := 2;
    IF cardinality(normalized_window_ids) <> 2 THEN
      RAISE EXCEPTION 'A learning proposal requires exactly two complete windows.' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(array_agg(latest.id ORDER BY latest.id), ARRAY[]::UUID[])
      INTO latest_window_ids
    FROM (
      SELECT learning_window.id
      FROM public.operating_strategy_learning_windows learning_window
      WHERE learning_window.operating_strategy_version_id = version.id
      ORDER BY learning_window.window_ended_at DESC, learning_window.id DESC
      LIMIT 2
    ) latest;
    IF normalized_window_ids IS DISTINCT FROM latest_window_ids THEN
      RAISE EXCEPTION 'A learning proposal must use the exact two most recent complete windows.'
        USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)::INTEGER,
      COALESCE(jsonb_agg(jsonb_build_object(
        'windowId', learning_window.id,
        'summaryFingerprint', learning_window.summary_fingerprint
      ) ORDER BY learning_window.id), '[]'::JSONB)
      INTO matching_window_count, selected_window_fingerprints
    FROM public.operating_strategy_learning_windows learning_window
    WHERE learning_window.id = ANY(normalized_window_ids)
      AND learning_window.operating_strategy_version_id = version.id
      AND learning_window.window_state = 'complete'
      AND learning_window.eligible_for_review
      AND learning_window.guardrail_failure_count = 0
      AND learning_window.exposure_count >= learning_window.minimum_exposure
      AND learning_window.primary_conversion_count >= learning_window.minimum_primary_conversions
      AND learning_window.required_complete_windows = 2
      AND learning_window.operating_contract_fingerprint = NEW.operating_contract_fingerprint;
    IF matching_window_count <> 2 THEN
      RAISE EXCEPTION 'Both latest windows must meet exposure and verified-conversion thresholds with no guardrail failure.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    NEW.required_complete_windows := 0;
    NEW.learning_window_ids_snapshot := ARRAY[]::UUID[];
    selected_window_fingerprints := '[]'::JSONB;
    SELECT controls.* INTO runtime_control
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding';
    IF version.status <> 'draft'
      OR NEW.proposed_change_json ->> 'targetStatus' <> 'active'
      OR version.contract_json #>> '{activationReadiness,status}' <> 'ready'
      OR jsonb_array_length(COALESCE(
        version.contract_json #> '{activationReadiness,blockers}',
        '[]'::JSONB
      )) <> 0
      OR runtime_control.enforcement_mode <> 'governed_required'
      OR runtime_control.schema_status <> 'cutover_complete'
      OR runtime_control.app_release_status <> 'deployed_governed' THEN
      RAISE EXCEPTION 'Activation review remains blocked until the app cutover is complete and the contract has no readiness blockers.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.proposal_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'operatingStrategyId', NEW.operating_strategy_id,
    'operatingStrategyVersionId', NEW.operating_strategy_version_id,
    'reviewType', NEW.review_type,
    'proposalKey', NEW.proposal_key,
    'proposedChange', NEW.proposed_change_json,
    'proposedByKind', NEW.proposed_by_kind,
    'proposedByKey', NEW.proposed_by_key,
    'proposedByUserId', NEW.proposed_by_user_id,
    'learningWindows', selected_window_fingerprints,
    'requiredCompleteWindows', NEW.required_complete_windows,
    'operatingVersionStatus', NEW.operating_version_status_snapshot,
    'externalSendCap', NEW.external_send_cap_snapshot,
    'operatingContractFingerprint', NEW.operating_contract_fingerprint,
    'applyStatus', NEW.apply_status,
    'writerRelease', NEW.writer_release
  ));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_review_manifest_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_guard_review_manifest_window_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manifest public.operating_strategy_review_manifests;
  learning_window public.operating_strategy_learning_windows;
BEGIN
  SELECT candidate.* INTO manifest
  FROM public.operating_strategy_review_manifests candidate
  WHERE candidate.id = NEW.manifest_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id;
  SELECT candidate.* INTO learning_window
  FROM public.operating_strategy_learning_windows candidate
  WHERE candidate.id = NEW.learning_window_id
    AND candidate.operating_strategy_version_id = NEW.operating_strategy_version_id;
  IF manifest.id IS NULL OR learning_window.id IS NULL
    OR array_position(manifest.learning_window_ids_snapshot, learning_window.id) IS NULL THEN
    RAISE EXCEPTION 'Manifest-window attribution must match the immutable proposal window set.'
      USING ERRCODE = '23514';
  END IF;
  NEW.summary_fingerprint_snapshot := learning_window.summary_fingerprint;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_guard_review_manifest_window_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3c_validate_review_manifest_window_set()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recorded_window_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(link.learning_window_id ORDER BY link.learning_window_id), ARRAY[]::UUID[])
    INTO recorded_window_ids
  FROM public.operating_strategy_review_manifest_windows link
  WHERE link.manifest_id = NEW.id;
  IF recorded_window_ids IS DISTINCT FROM NEW.learning_window_ids_snapshot THEN
    RAISE EXCEPTION 'Manifest window rows must exactly match the immutable proposal window set.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3c_validate_review_manifest_window_set()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_review_manifests_insert_guard
BEFORE INSERT ON public.operating_strategy_review_manifests
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_review_manifest_insert();
CREATE TRIGGER operating_strategy_review_manifests_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_review_manifests
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_review_manifests_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_review_manifests
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE CONSTRAINT TRIGGER operating_strategy_review_manifests_window_set_guard
AFTER INSERT ON public.operating_strategy_review_manifests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.gate3c_validate_review_manifest_window_set();

CREATE TRIGGER operating_strategy_review_manifest_windows_insert_guard
BEFORE INSERT ON public.operating_strategy_review_manifest_windows
FOR EACH ROW EXECUTE FUNCTION private.gate3c_guard_review_manifest_window_insert();
CREATE TRIGGER operating_strategy_review_manifest_windows_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_review_manifest_windows
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_review_manifest_windows_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_review_manifest_windows
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

CREATE TRIGGER operating_strategy_review_decisions_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_review_decisions
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_review_decisions_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_review_decisions
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_review_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_review_manifests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_review_manifest_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_review_manifest_windows FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_review_decisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_review_manifests,
  public.operating_strategy_review_manifest_windows,
  public.operating_strategy_review_decisions
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_review_manifests,
  public.operating_strategy_review_manifest_windows,
  public.operating_strategy_review_decisions TO service_role;

CREATE OR REPLACE FUNCTION public.submit_operating_strategy_review_manifest(
  p_operating_strategy_version_id UUID,
  p_review_type TEXT,
  p_proposal_key TEXT,
  p_proposed_change_json JSONB,
  p_learning_window_ids UUID[],
  p_proposed_by_kind TEXT,
  p_proposed_by_key TEXT,
  p_proposed_by_user_id UUID,
  p_idempotency_key TEXT,
  p_writer_release TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_id UUID;
  normalized_window_ids UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT item.window_id ORDER BY item.window_id), ARRAY[]::UUID[])
    INTO normalized_window_ids
  FROM unnest(COALESCE(p_learning_window_ids, ARRAY[]::UUID[])) AS item(window_id);

  INSERT INTO public.operating_strategy_review_manifests(
    operating_strategy_id,
    operating_strategy_version_id,
    review_type,
    proposal_key,
    proposed_change_json,
    proposed_by_kind,
    proposed_by_key,
    proposed_by_user_id,
    learning_window_ids_snapshot,
    required_complete_windows,
    operating_version_status_snapshot,
    external_send_cap_snapshot,
    operating_contract_fingerprint,
    writer_release,
    idempotency_key,
    proposal_fingerprint
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_operating_strategy_version_id,
    p_review_type,
    p_proposal_key,
    p_proposed_change_json,
    p_proposed_by_kind,
    p_proposed_by_key,
    p_proposed_by_user_id,
    normalized_window_ids,
    CASE WHEN p_review_type = 'learning_proposal' THEN 2 ELSE 0 END,
    'draft',
    0,
    '00000000000000000000000000000000',
    p_writer_release,
    p_idempotency_key,
    '00000000000000000000000000000000'
  )
  ON CONFLICT (operating_strategy_version_id, idempotency_key) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT manifest.id INTO result_id
    FROM public.operating_strategy_review_manifests manifest
    WHERE manifest.operating_strategy_version_id = p_operating_strategy_version_id
      AND manifest.idempotency_key = p_idempotency_key;
    IF result_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_review_manifests manifest
      WHERE manifest.id = result_id
        AND (
          manifest.review_type IS DISTINCT FROM p_review_type
          OR manifest.proposal_key IS DISTINCT FROM p_proposal_key
          OR manifest.proposed_change_json IS DISTINCT FROM p_proposed_change_json
          OR manifest.proposed_by_kind IS DISTINCT FROM p_proposed_by_kind
          OR manifest.proposed_by_key IS DISTINCT FROM p_proposed_by_key
          OR manifest.proposed_by_user_id IS DISTINCT FROM p_proposed_by_user_id
          OR manifest.learning_window_ids_snapshot IS DISTINCT FROM normalized_window_ids
          OR manifest.writer_release IS DISTINCT FROM p_writer_release
        )
    ) THEN
      RAISE EXCEPTION 'Review-manifest idempotency key was reused for a different proposal.'
        USING ERRCODE = '23505';
    END IF;
    RETURN result_id;
  END IF;

  INSERT INTO public.operating_strategy_review_manifest_windows(
    manifest_id,
    learning_window_id,
    operating_strategy_version_id,
    ordinal,
    summary_fingerprint_snapshot
  )
  SELECT
    result_id,
    learning_window.id,
    p_operating_strategy_version_id,
    ROW_NUMBER() OVER (ORDER BY learning_window.window_started_at, learning_window.id)::INTEGER,
    learning_window.summary_fingerprint
  FROM public.operating_strategy_learning_windows learning_window
  WHERE learning_window.id = ANY(normalized_window_ids)
  ORDER BY learning_window.window_started_at, learning_window.id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_operating_strategy_review_manifest(
  UUID, TEXT, TEXT, JSONB, UUID[], TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_operating_strategy_review_manifest(
  UUID, TEXT, TEXT, JSONB, UUID[], TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_operating_strategy_review_decision(
  p_manifest_id UUID,
  p_decision TEXT,
  p_reviewed_by_user_id UUID,
  p_reviewed_by_key TEXT,
  p_rationale TEXT,
  p_expected_proposal_fingerprint TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manifest public.operating_strategy_review_manifests;
  existing_decision public.operating_strategy_review_decisions;
  decision_id UUID;
  decision_fingerprint TEXT;
  caller_user_id UUID;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_reviewed_by_user_id THEN
    RAISE EXCEPTION 'The authenticated reviewer identity must match the decision actor.'
      USING ERRCODE = '42501';
  END IF;

  SELECT candidate.* INTO manifest
  FROM public.operating_strategy_review_manifests candidate
  WHERE candidate.id = p_manifest_id
  FOR SHARE;
  IF NOT FOUND OR manifest.proposal_fingerprint IS DISTINCT FROM p_expected_proposal_fingerprint THEN
    RAISE EXCEPTION 'Review manifest not found or proposal fingerprint mismatch.'
      USING ERRCODE = '23514';
  END IF;
  IF manifest.proposed_by_user_id IS NOT NULL
    AND manifest.proposed_by_user_id = p_reviewed_by_user_id THEN
    RAISE EXCEPTION 'A proposer cannot review their own manifest.' USING ERRCODE = '23514';
  END IF;
  IF manifest.proposed_by_key = p_reviewed_by_key THEN
    RAISE EXCEPTION 'A proposal actor key cannot self-approve its manifest.' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_reviewer_authorities authority
    WHERE authority.user_id = p_reviewed_by_user_id
      AND authority.authority_role = 'founder_reviewer'
      AND authority.valid_from <= statement_timestamp()
      AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
      AND (
        (manifest.review_type = 'learning_proposal' AND authority.can_review_learning)
        OR (manifest.review_type = 'activation_review' AND authority.can_activate_operating_versions)
      )
  ) THEN
    RAISE EXCEPTION 'The authenticated user is not an allowlisted founder reviewer for this manifest.'
      USING ERRCODE = '42501';
  END IF;

  SELECT candidate.* INTO existing_decision
  FROM public.operating_strategy_review_decisions candidate
  WHERE candidate.manifest_id = p_manifest_id
     OR candidate.idempotency_key = p_idempotency_key
  ORDER BY candidate.manifest_id = p_manifest_id DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing_decision.manifest_id IS DISTINCT FROM p_manifest_id
      OR existing_decision.decision IS DISTINCT FROM p_decision
      OR existing_decision.reviewed_by_user_id IS DISTINCT FROM p_reviewed_by_user_id
      OR existing_decision.reviewed_by_key IS DISTINCT FROM p_reviewed_by_key
      OR existing_decision.rationale IS DISTINCT FROM p_rationale
      OR existing_decision.expected_proposal_fingerprint IS DISTINCT FROM p_expected_proposal_fingerprint
      OR existing_decision.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Review decision replay conflicts with immutable decision evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_decision.id;
  END IF;

  decision_id := gen_random_uuid();
  decision_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'decisionId', decision_id,
    'manifestId', p_manifest_id,
    'decision', p_decision,
    'reviewedByUserId', p_reviewed_by_user_id,
    'reviewedByKey', p_reviewed_by_key,
    'rationale', p_rationale,
    'expectedProposalFingerprint', p_expected_proposal_fingerprint,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO public.operating_strategy_review_decisions(
    id,
    manifest_id,
    decision,
    reviewed_by_user_id,
    reviewed_by_key,
    expected_proposal_fingerprint,
    rationale,
    idempotency_key,
    decision_fingerprint
  ) VALUES (
    decision_id,
    p_manifest_id,
    p_decision,
    p_reviewed_by_user_id,
    p_reviewed_by_key,
    p_expected_proposal_fingerprint,
    p_rationale,
    p_idempotency_key,
    decision_fingerprint
  );
  RETURN decision_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_operating_strategy_review_decision(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_operating_strategy_review_decision(
  UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Remove direct service-role activation authority while retaining draft-edit
-- compatibility through column-scoped grants. The existing public activation
-- signature is replaced so every path requires the authenticated, allowlisted
-- founder who approved an exact activation manifest.

REVOKE INSERT, UPDATE ON TABLE public.operating_strategy_versions FROM service_role;
GRANT INSERT (
  id,
  operating_strategy_id,
  version,
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
  created_at,
  updated_at
) ON public.operating_strategy_versions TO service_role;
GRANT UPDATE (
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
  updated_at
) ON public.operating_strategy_versions TO service_role;

CREATE OR REPLACE FUNCTION public.activate_operating_strategy_version(
  p_version_id UUID,
  p_actor_user_id UUID
)
RETURNS SETOF public.operating_strategy_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate public.operating_strategy_versions;
  current_version public.operating_strategy_versions;
  expected_version INTEGER;
  activated public.operating_strategy_versions;
  activation_manifest public.operating_strategy_review_manifests;
  activation_decision public.operating_strategy_review_decisions;
  runtime_control public.operating_strategy_runtime_controls;
  candidate_fingerprint TEXT;
  caller_user_id UUID;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the activation actor.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_reviewer_authorities authority
    WHERE authority.user_id = p_actor_user_id
      AND authority.authority_role = 'founder_reviewer'
      AND authority.can_activate_operating_versions
      AND authority.valid_from <= statement_timestamp()
      AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
  ) THEN
    RAISE EXCEPTION 'The authenticated user is not an active founder activation reviewer.'
      USING ERRCODE = '42501';
  END IF;

  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  IF runtime_control.enforcement_mode <> 'governed_required'
    OR runtime_control.schema_status <> 'cutover_complete'
    OR runtime_control.app_release_status <> 'deployed_governed' THEN
    RAISE EXCEPTION 'Operating-version activation remains blocked until governed app cutover is complete.'
      USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_version_id
  FOR UPDATE;
  IF NOT FOUND OR candidate.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft operating version can be activated.' USING ERRCODE = '23514';
  END IF;
  IF candidate.contract_json #>> '{activationReadiness,status}' <> 'ready'
    OR jsonb_array_length(COALESCE(
      candidate.contract_json #> '{activationReadiness,blockers}',
      '[]'::JSONB
    )) <> 0 THEN
    RAISE EXCEPTION 'The operating contract still has activation-readiness blockers.'
      USING ERRCODE = '23514';
  END IF;
  candidate_fingerprint := private.gate3b_operating_contract_fingerprint(candidate);

  SELECT manifest.*
    INTO activation_manifest
  FROM public.operating_strategy_review_manifests manifest
  JOIN public.operating_strategy_review_decisions decision
    ON decision.manifest_id = manifest.id
  WHERE manifest.operating_strategy_version_id = candidate.id
    AND manifest.review_type = 'activation_review'
    AND manifest.apply_status = 'pending_human_review'
    AND manifest.operating_contract_fingerprint = candidate_fingerprint
    AND manifest.proposed_change_json ->> 'targetStatus' = 'active'
    AND decision.decision = 'approved'
    AND decision.reviewed_by_user_id = p_actor_user_id
    AND decision.expected_proposal_fingerprint = manifest.proposal_fingerprint
  ORDER BY decision.decided_at DESC
  LIMIT 1;
  IF activation_manifest.id IS NOT NULL THEN
    SELECT decision.* INTO activation_decision
    FROM public.operating_strategy_review_decisions decision
    WHERE decision.manifest_id = activation_manifest.id
      AND decision.decision = 'approved'
      AND decision.reviewed_by_user_id = p_actor_user_id
      AND decision.expected_proposal_fingerprint = activation_manifest.proposal_fingerprint
    ORDER BY decision.decided_at DESC
    LIMIT 1;
  END IF;
  IF activation_manifest.id IS NULL OR activation_decision.id IS NULL THEN
    RAISE EXCEPTION 'No exact founder-approved activation manifest exists for this contract fingerprint.'
      USING ERRCODE = '23514';
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

  IF current_version.id IS NOT NULL THEN
    UPDATE public.operating_strategy_versions
    SET status = 'retired', retired_at = statement_timestamp()
    WHERE id = current_version.id;
    INSERT INTO public.operating_strategy_version_events(
      operating_strategy_id, version_id, event_type, actor_user_id, metadata_json
    ) VALUES (
      candidate.operating_strategy_id,
      current_version.id,
      'retired',
      p_actor_user_id,
      jsonb_build_object(
        'supersededByVersionId', candidate.id,
        'activationManifestId', activation_manifest.id,
        'activationDecisionId', activation_decision.id
      )
    );
  END IF;

  UPDATE public.operating_strategy_versions
  SET approved_by_user_id = p_actor_user_id,
      approved_at = statement_timestamp()
  WHERE id = candidate.id
  RETURNING * INTO candidate;
  PERFORM public.validate_operating_strategy_version(candidate.id);

  UPDATE public.operating_strategy_versions
  SET status = 'active',
      activated_at = statement_timestamp(),
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
    jsonb_build_object(
      'version', activated.version,
      'supersedesId', activated.supersedes_id,
      'activationManifestId', activation_manifest.id,
      'activationDecisionId', activation_decision.id,
      'approvedProposalFingerprint', activation_manifest.proposal_fingerprint,
      'draftContractFingerprint', candidate_fingerprint
    )
  );
  RETURN NEXT activated;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_operating_strategy_version(UUID, UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.activate_operating_strategy_version(UUID, UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Durable ambiguity quarantine. An ambiguous callback deliberately carries no
-- operating-version FK because choosing one would fabricate attribution.
-- ---------------------------------------------------------------------------

CREATE TABLE public.operating_strategy_attribution_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain TEXT NOT NULL CHECK (source_domain ~ '^[a-z0-9_]+$'),
  source_event_key TEXT NOT NULL CHECK (NULLIF(btrim(source_event_key), '') IS NOT NULL),
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'no_governed_enrollment',
    'ambiguous_governed_enrollment',
    'binding_mismatch',
    'unknown_source_mapping',
    'callback_identity_conflict',
    'provider_identity_missing',
    'attribution_not_found'
  )),
  identifiers_json JSONB NOT NULL CHECK (
    jsonb_typeof(identifiers_json) = 'object'
    AND NOT (identifiers_json ?| ARRAY['raw', 'payload', 'body', 'content', 'messageBody'])
  ),
  candidate_bindings_json JSONB NOT NULL CHECK (
    jsonb_typeof(candidate_bindings_json) = 'array'
  ),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{32}([0-9a-f]{32})?$'),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  quarantine_fingerprint TEXT NOT NULL CHECK (quarantine_fingerprint ~ '^[0-9a-f]{32}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_domain, source_event_key, payload_hash)
);

CREATE INDEX operating_strategy_attribution_quarantine_reason_idx
  ON public.operating_strategy_attribution_quarantine(reason_code, recorded_at DESC);

CREATE TRIGGER operating_strategy_attribution_quarantine_append_only_guard
BEFORE UPDATE OR DELETE ON public.operating_strategy_attribution_quarantine
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER operating_strategy_attribution_quarantine_truncate_guard
BEFORE TRUNCATE ON public.operating_strategy_attribution_quarantine
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE public.operating_strategy_attribution_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_attribution_quarantine FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_attribution_quarantine
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_attribution_quarantine TO service_role;

CREATE OR REPLACE FUNCTION public.record_operating_strategy_attribution_quarantine(
  p_source_domain TEXT,
  p_source_event_key TEXT,
  p_reason_code TEXT,
  p_identifiers_json JSONB,
  p_candidate_bindings_json JSONB,
  p_payload_hash TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_writer_release TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_id UUID;
  candidate_fingerprint TEXT;
BEGIN
  candidate_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'sourceDomain', p_source_domain,
    'sourceEventKey', p_source_event_key,
    'reasonCode', p_reason_code,
    'identifiers', p_identifiers_json,
    'candidateBindings', p_candidate_bindings_json,
    'payloadHash', p_payload_hash,
    'occurredAt', p_occurred_at,
    'writerRelease', p_writer_release
  ));

  INSERT INTO public.operating_strategy_attribution_quarantine(
    source_domain,
    source_event_key,
    reason_code,
    identifiers_json,
    candidate_bindings_json,
    payload_hash,
    writer_release,
    quarantine_fingerprint,
    occurred_at
  ) VALUES (
    p_source_domain,
    p_source_event_key,
    p_reason_code,
    p_identifiers_json,
    p_candidate_bindings_json,
    p_payload_hash,
    p_writer_release,
    candidate_fingerprint,
    p_occurred_at
  )
  ON CONFLICT (source_domain, source_event_key, payload_hash) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT quarantine.id INTO result_id
    FROM public.operating_strategy_attribution_quarantine quarantine
    WHERE quarantine.source_domain = p_source_domain
      AND quarantine.source_event_key = p_source_event_key
      AND quarantine.payload_hash = p_payload_hash;
    IF result_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_attribution_quarantine quarantine
      WHERE quarantine.id = result_id
        AND quarantine.quarantine_fingerprint IS DISTINCT FROM candidate_fingerprint
    ) THEN
      RAISE EXCEPTION 'Quarantine replay conflicts with immutable attribution evidence.'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_operating_strategy_attribution_quarantine(
  TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_operating_strategy_attribution_quarantine(
  TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TIMESTAMPTZ, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- Fail-closed postconditions: schema is staged, the application is not marked
-- deployed, founder authority is empty, and production remains zero-send.
-- ---------------------------------------------------------------------------

DO $gate3c_postconditions$
DECLARE
  mismatch_count INTEGER;
  table_name TEXT;
  ledger_row_count BIGINT;
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
  IF mismatch_count <> 0 OR (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17 THEN
    RAISE EXCEPTION 'Gate 3C changed a founder-reviewed Gate 3B draft or fingerprint.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3C changed the n8n live-send control.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.schema_status = 'staged_pending_app_deployment'
      AND controls.schema_migration_version = '20260815211500'
      AND controls.app_release_status = 'not_deployed'
      AND controls.required_writer_release IS NULL
      AND controls.cutover_at IS NULL
      AND controls.cutover_approved_by_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Gate 3C runtime controls are not in safe compatibility staging mode.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities) THEN
    RAISE EXCEPTION 'Gate 3C must not seed founder-review authority.';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
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
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I', table_name) INTO ledger_row_count;
    IF ledger_row_count <> 0 THEN
      RAISE EXCEPTION 'Gate 3C unexpectedly seeded % rows in public.%', ledger_row_count, table_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname = table_name
        AND relation.relrowsecurity
        AND relation.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'Gate 3C table public.% must force RLS.', table_name;
    END IF;
    IF has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
      OR has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
      OR has_table_privilege('service_role', format('public.%I', table_name), 'TRUNCATE') THEN
      RAISE EXCEPTION 'Gate 3C governed table public.% exposes service-role mutation privilege.', table_name;
    END IF;
  END LOOP;

  IF has_function_privilege(
      'service_role',
      'public.record_operating_strategy_review_decision(uuid,text,uuid,text,text,text,text)',
      'EXECUTE'
    ) OR has_function_privilege(
      'service_role',
      'public.activate_operating_strategy_version(uuid,uuid)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'The service role must not hold founder decision or activation authority.';
  END IF;
  IF has_function_privilege(
      'anon',
      'public.list_operating_strategy_registry_projection()',
      'EXECUTE'
    ) OR has_function_privilege(
      'authenticated',
      'public.list_operating_strategy_registry_projection()',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'The registry projection must remain service-role only.';
  END IF;
  IF NOT has_function_privilege(
      'service_role',
      'public.resolve_operating_strategy_runtime(text,text,timestamptz)',
      'EXECUTE'
    ) OR NOT has_function_privilege(
      'service_role',
      'public.list_operating_strategy_registry_projection()',
      'EXECUTE'
    ) OR NOT has_function_privilege(
      'service_role',
      'public.reserve_operating_strategy_dispatch(uuid,text,text,integer,text,text,integer,text[])',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'The service role is missing governed runtime RPC access.';
  END IF;
END
$gate3c_postconditions$;
