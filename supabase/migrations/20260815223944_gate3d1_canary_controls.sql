-- Gate 3D.1: founder-reviewed, fail-closed controls for a one-recipient canary.
--
-- This successor does not activate a strategy, grant reviewer authority, release
-- either outbound control, dispatch a message, or change the staged Gate 3C
-- cutover watermark. It makes a later cap-one activation technically truthful
-- only after the exact governed release and founder review are present.

DO $gate3d1_preconditions$
BEGIN
  IF to_regclass('public.operating_strategy_outbound_controls') IS NOT NULL THEN
    RAISE EXCEPTION 'Gate 3D.1 outbound controls already exist.';
  END IF;
  IF (SELECT COUNT(*) FROM public.operating_strategy_versions) <> 17
    OR EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions
      WHERE status <> 'draft'
         OR execution_mode IN ('internal_test', 'approved_live')
         OR external_send_cap <> 0
         OR approved_by_user_id IS NOT NULL
         OR approved_at IS NOT NULL
         OR activated_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Gate 3D.1 requires the exact zero-send Gate 3C draft state.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.schema_status = 'staged_pending_app_deployment'
      AND controls.app_release_status = 'not_deployed'
      AND controls.required_writer_release IS NULL
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 requires the untouched Gate 3C compatibility watermark.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities) THEN
    RAISE EXCEPTION 'Gate 3D.1 does not guess or seed founder reviewer authority.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 requires n8n live sending to remain disabled.';
  END IF;
END
$gate3d1_preconditions$;

-- The global outbound control lives beside the canonical cutover watermark so
-- the two rows cannot drift. Existing and future rows default to fail-closed.
ALTER TABLE public.operating_strategy_runtime_controls
  ADD COLUMN canary_enforcement_status TEXT NOT NULL DEFAULT 'disabled' CHECK (
    canary_enforcement_status IN ('disabled', 'reviewed_cap_one')
  ),
  ADD COLUMN canary_operating_strategy_version_id UUID
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN canary_required_writer_release TEXT,
  ADD COLUMN canary_approved_by_user_id UUID
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN canary_approved_at TIMESTAMPTZ,
  ADD COLUMN outbound_kill_switch BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN outbound_control_reason TEXT NOT NULL DEFAULT 'Gate 3D.1 default engaged',
  ADD COLUMN outbound_control_writer_release TEXT,
  ADD COLUMN outbound_control_updated_by_user_id UUID
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD COLUMN outbound_control_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD CONSTRAINT operating_strategy_runtime_controls_gate3d1_canary_shape_check CHECK (
    (
      canary_enforcement_status = 'disabled'
      AND canary_operating_strategy_version_id IS NULL
      AND canary_required_writer_release IS NULL
      AND canary_approved_by_user_id IS NULL
      AND canary_approved_at IS NULL
    )
    OR (
      canary_enforcement_status = 'reviewed_cap_one'
      AND canary_operating_strategy_version_id IS NOT NULL
      AND NULLIF(btrim(canary_required_writer_release), '') IS NOT NULL
      AND canary_approved_by_user_id IS NOT NULL
      AND canary_approved_at IS NOT NULL
    )
  ),
  ADD CONSTRAINT operating_strategy_runtime_controls_gate3d1_outbound_shape_check CHECK (
    length(btrim(outbound_control_reason)) >= 12
    AND (
      outbound_kill_switch
      OR (
        (
          (
            enforcement_mode = 'governed_required'
            AND schema_status = 'cutover_complete'
            AND app_release_status = 'deployed_governed'
            AND NULLIF(btrim(required_writer_release), '') IS NOT NULL
            AND outbound_control_writer_release = required_writer_release
          )
          OR (
            enforcement_mode = 'compatibility'
            AND schema_status = 'app_deployed_pending_cutover'
            AND app_release_status = 'deployed_compatibility'
            AND canary_enforcement_status = 'reviewed_cap_one'
            AND outbound_control_writer_release = canary_required_writer_release
          )
        )
        AND outbound_control_updated_by_user_id IS NOT NULL
      )
    )
  );

-- Every strategy is paused independently. Missing rows also fail closed in the
-- reservation wrapper, so a future strategy cannot inherit send authority.
CREATE TABLE public.operating_strategy_outbound_controls (
  operating_strategy_id UUID PRIMARY KEY
    REFERENCES public.operating_strategies(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  paused BOOLEAN NOT NULL DEFAULT TRUE,
  pause_reason TEXT NOT NULL DEFAULT 'Gate 3D.1 default paused' CHECK (
    length(btrim(pause_reason)) >= 12
  ),
  writer_release TEXT,
  updated_by_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operating_strategy_outbound_controls_release_shape_check CHECK (
    paused
    OR (
      NULLIF(btrim(writer_release), '') IS NOT NULL
      AND updated_by_user_id IS NOT NULL
    )
  )
);

INSERT INTO public.operating_strategy_outbound_controls(operating_strategy_id)
SELECT strategy.id
FROM public.operating_strategies strategy
ORDER BY strategy.id;

ALTER TABLE public.operating_strategy_outbound_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_strategy_outbound_controls FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operating_strategy_outbound_controls
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.operating_strategy_outbound_controls TO service_role;

-- A positive inbound reply can authorize only continuation of that exact
-- conversation, property reference, and purpose. This is deliberately not a
-- marketing-consent record. External identifiers live in the unexposed private
-- schema and are available only through fail-closed RPCs.
CREATE TABLE private.inbound_reply_continuation_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_version_id UUID NOT NULL
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  authorization_basis TEXT NOT NULL DEFAULT 'positive_inbound_reply_continuation' CHECK (
    authorization_basis = 'positive_inbound_reply_continuation'
  ),
  inbound_provider TEXT NOT NULL CHECK (inbound_provider = 'outlook_graph'),
  inbound_message_id TEXT NOT NULL CHECK (NULLIF(btrim(inbound_message_id), '') IS NOT NULL),
  inbound_conversation_id TEXT NOT NULL CHECK (
    NULLIF(btrim(inbound_conversation_id), '') IS NOT NULL
  ),
  inbound_internet_message_id TEXT NOT NULL CHECK (
    NULLIF(btrim(inbound_internet_message_id), '') IS NOT NULL
  ),
  property_reference_key TEXT NOT NULL CHECK (
    NULLIF(btrim(property_reference_key), '') IS NOT NULL
    AND length(property_reference_key) <= 500
  ),
  purpose_key TEXT NOT NULL CHECK (purpose_key ~ '^[a-z0-9][a-z0-9_.:-]*$'),
  approved_by_user_id UUID NOT NULL
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  rationale TEXT NOT NULL CHECK (length(btrim(rationale)) >= 20),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  authorization_fingerprint TEXT NOT NULL CHECK (authorization_fingerprint ~ '^[0-9a-f]{32}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (inbound_provider, inbound_message_id, inbound_conversation_id, purpose_key),
  CONSTRAINT inbound_reply_continuation_authorizations_expiry_check CHECK (
    expires_at > approved_at AND expires_at <= approved_at + INTERVAL '7 days'
  )
);

CREATE TABLE private.inbound_reply_continuation_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL UNIQUE
    REFERENCES private.inbound_reply_continuation_authorizations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  revoked_by_user_id UUID NOT NULL
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 12),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  revocation_fingerprint TEXT NOT NULL CHECK (revocation_fingerprint ~ '^[0-9a-f]{32}$'),
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE TRIGGER inbound_reply_continuation_authorizations_append_only_guard
BEFORE UPDATE OR DELETE ON private.inbound_reply_continuation_authorizations
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER inbound_reply_continuation_authorizations_truncate_guard
BEFORE TRUNCATE ON private.inbound_reply_continuation_authorizations
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER inbound_reply_continuation_revocations_append_only_guard
BEFORE UPDATE OR DELETE ON private.inbound_reply_continuation_revocations
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER inbound_reply_continuation_revocations_truncate_guard
BEFORE TRUNCATE ON private.inbound_reply_continuation_revocations
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE private.inbound_reply_continuation_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_authorizations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_revocations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.inbound_reply_continuation_authorizations,
  private.inbound_reply_continuation_revocations
  FROM PUBLIC, anon, authenticated, service_role;

-- Exchange Application RBAC proof is an alternative to explicit Mail roles in
-- the app-only JWT. It stores no secret, token, or mail content—only the exact
-- scoped identities, role names, and fingerprints of an in-scope allow test and
-- an out-of-scope deny test. The proof expires within 24 hours.
CREATE TABLE private.exchange_application_rbac_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  mailbox_object_id UUID NOT NULL,
  mailbox_address TEXT NOT NULL CHECK (
    mailbox_address = lower(btrim(mailbox_address))
    AND mailbox_address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  rbac_role_set_json JSONB NOT NULL CHECK (
    jsonb_typeof(rbac_role_set_json) = 'array'
    AND jsonb_array_length(rbac_role_set_json) > 0
  ),
  in_scope_authorized BOOLEAN NOT NULL CHECK (in_scope_authorized),
  in_scope_test_fingerprint TEXT NOT NULL CHECK (
    in_scope_test_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  out_of_scope_denied BOOLEAN NOT NULL CHECK (out_of_scope_denied),
  out_of_scope_test_fingerprint TEXT NOT NULL CHECK (
    out_of_scope_test_fingerprint ~ '^[0-9a-f]{64}$'
    AND out_of_scope_test_fingerprint <> in_scope_test_fingerprint
  ),
  recorded_by_user_id UUID NOT NULL
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  rationale TEXT NOT NULL CHECK (length(btrim(rationale)) >= 20),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  attestation_fingerprint TEXT NOT NULL CHECK (attestation_fingerprint ~ '^[0-9a-f]{32}$'),
  CONSTRAINT exchange_application_rbac_attestations_expiry_check CHECK (
    expires_at > recorded_at AND expires_at <= recorded_at + INTERVAL '24 hours'
  )
);

CREATE TABLE private.exchange_application_rbac_attestation_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attestation_id UUID NOT NULL UNIQUE
    REFERENCES private.exchange_application_rbac_attestations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  revoked_by_user_id UUID NOT NULL
    REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 12),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  revocation_fingerprint TEXT NOT NULL CHECK (revocation_fingerprint ~ '^[0-9a-f]{32}$'),
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE TRIGGER exchange_application_rbac_attestations_append_only_guard
BEFORE UPDATE OR DELETE ON private.exchange_application_rbac_attestations
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER exchange_application_rbac_attestations_truncate_guard
BEFORE TRUNCATE ON private.exchange_application_rbac_attestations
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER exchange_application_rbac_attestation_revocations_append_only_guard
BEFORE UPDATE OR DELETE ON private.exchange_application_rbac_attestation_revocations
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER exchange_application_rbac_attestation_revocations_truncate_guard
BEFORE TRUNCATE ON private.exchange_application_rbac_attestation_revocations
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE private.exchange_application_rbac_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.exchange_application_rbac_attestations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.exchange_application_rbac_attestation_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.exchange_application_rbac_attestation_revocations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.exchange_application_rbac_attestations,
  private.exchange_application_rbac_attestation_revocations
  FROM PUBLIC, anon, authenticated, service_role;

-- Gate 3B's owner validator only recognized its historical no-dispatch labels.
-- The active-version assertion below remains the authority that decides which
-- label is valid for a zero-send version versus a reviewed cap-one canary.
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
  SELECT COALESCE((jsonb_typeof(p_contract) = 'object'
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'crmAuthority'), FALSE)
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'automationRole'), FALSE)
    AND COALESCE(private.gate3a_jsonb_nonblank_text(p_contract -> 'dispatchAuthority'), FALSE)
    AND private.gate3a_jsonb_text_array(p_contract -> 'handoffRules', TRUE)
    AND p_contract ->> 'crmAuthority' = p_expected_crm_owner
    AND p_contract ->> 'automationRole' = p_expected_automation_owner
    AND p_contract ->> 'dispatchAuthority' IN (
      'none_in_gate_3a',
      'none_in_gate_3b',
      'vestblock_application'
    )), FALSE);
$$;

REVOKE ALL ON FUNCTION private.gate3a_valid_owner_contract(JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.gate3a_valid_owner_contract(JSONB, TEXT, TEXT)
  TO service_role;

-- Replace only the obsolete zero-send clause. All Gate 3A/3B structural,
-- provenance, owner, and readiness checks remain in force. A send-capable
-- candidate is accepted only as one globally unique, founder-approved canary
-- under a completed Gate 3C cutover, while both outbound controls are engaged.
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
  runtime_control public.operating_strategy_runtime_controls;
  strategy_control public.operating_strategy_outbound_controls;
BEGIN
  SELECT portfolio.governance_status
    INTO parent_status
  FROM public.operating_strategies strategy
  JOIN public.strategy_portfolios portfolio
    ON portfolio.portfolio_key = strategy.portfolio_key
  WHERE strategy.id = p_version.operating_strategy_id;

  IF parent_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'The parent portfolio must be approved before activation.'
      USING ERRCODE = '23514';
  END IF;
  IF p_version.destination_mode = 'unresolved' THEN
    RAISE EXCEPTION 'An unresolved destination cannot be activated.'
      USING ERRCODE = '23514';
  END IF;
  IF p_version.destination_mode = 'public_route'
    AND (
      p_version.destination_path IS NULL
      OR p_version.destination_path !~ '^/'
      OR p_version.cta_label IS NULL
      OR NULLIF(btrim(p_version.cta_label), '') IS NULL
    ) THEN
    RAISE EXCEPTION 'A public strategy requires a valid destination and CTA.'
      USING ERRCODE = '23514';
  END IF;
  IF p_version.destination_mode = 'internal_only'
    AND (p_version.destination_path IS NOT NULL OR p_version.cta_label IS NOT NULL) THEN
    RAISE EXCEPTION 'An internal-only strategy cannot expose a destination or CTA.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT private.gate3a_valid_operating_contract(p_version.contract_json) THEN
    RAISE EXCEPTION 'The operating contract has missing or invalid values.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_lifecycle_contract(p_version.lifecycle_contract_json) THEN
    RAISE EXCEPTION 'The CRM lifecycle contract has missing or invalid values.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_owner_contract(
    p_version.owner_contract_json,
    p_version.crm_owner_key,
    p_version.automation_owner_key
  ) THEN
    RAISE EXCEPTION 'The owner contract has missing, invalid, or conflicting values.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_outcome_contract(p_version.outcome_contract_json) THEN
    RAISE EXCEPTION 'The outcome contract has missing or invalid values.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT private.gate3a_valid_source_provenance(p_version.source_provenance_json) THEN
    RAISE EXCEPTION 'Named source provenance is required before activation.'
      USING ERRCODE = '23514';
  END IF;
  IF p_version.approved_at IS NULL OR p_version.approved_by_user_id IS NULL THEN
    RAISE EXCEPTION 'Operator approval is required before activation.'
      USING ERRCODE = '23514';
  END IF;

  IF p_version.execution_mode = 'approved_live' THEN
    IF p_version.external_send_cap <> 1 THEN
      RAISE EXCEPTION 'Gate 3D.1 approved-live canaries require an exact external send cap of one.'
        USING ERRCODE = '23514';
    END IF;
    IF p_version.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application' THEN
      RAISE EXCEPTION 'A Gate 3D.1 canary requires VestBlock application dispatch authority.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT COALESCE(private.gate3b_activation_ready(p_version.contract_json), FALSE) THEN
      RAISE EXCEPTION 'The operating contract still has activation-readiness blockers.'
        USING ERRCODE = '23514';
    END IF;

    SELECT controls.* INTO runtime_control
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding';
    IF runtime_control.enforcement_mode <> 'compatibility'
      OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
      OR runtime_control.app_release_status <> 'deployed_compatibility'
      OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
      OR runtime_control.canary_operating_strategy_version_id IS DISTINCT FROM p_version.id
      OR NULLIF(btrim(runtime_control.canary_required_writer_release), '') IS NULL
      OR runtime_control.canary_approved_by_user_id IS DISTINCT FROM p_version.approved_by_user_id THEN
      RAISE EXCEPTION 'Gate 3D.1 live validation requires the exact selectively governed canary posture.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT runtime_control.outbound_kill_switch THEN
      RAISE EXCEPTION 'A canary must activate while the global outbound kill switch is engaged.'
        USING ERRCODE = '23514';
    END IF;

    SELECT controls.* INTO strategy_control
    FROM public.operating_strategy_outbound_controls controls
    WHERE controls.operating_strategy_id = p_version.operating_strategy_id;
    IF strategy_control.operating_strategy_id IS NULL OR NOT strategy_control.paused THEN
      RAISE EXCEPTION 'A canary must activate while its strategy outbound control is paused.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.operating_strategy_reviewer_authorities authority
      WHERE authority.user_id = p_version.approved_by_user_id
        AND authority.authority_role = 'founder_reviewer'
        AND authority.can_activate_operating_versions
        AND authority.valid_from <= statement_timestamp()
        AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
    ) THEN
      RAISE EXCEPTION 'The canary approver is not an active founder activation reviewer.'
        USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions other
      WHERE other.id <> p_version.id
        AND other.status = 'active'
        AND other.execution_mode = 'approved_live'
        AND other.external_send_cap > 0
    ) THEN
      RAISE EXCEPTION 'Gate 3D.1 permits only one active send-capable canary strategy.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF p_version.external_send_cap <> 0
      OR p_version.execution_mode = 'internal_test' THEN
      RAISE EXCEPTION 'Non-live Gate 3D.1 operating versions must remain zero-send.'
        USING ERRCODE = '23514';
    END IF;
    IF p_version.owner_contract_json ->> 'dispatchAuthority'
      NOT IN ('none_in_gate_3a', 'none_in_gate_3b') THEN
      RAISE EXCEPTION 'A non-live operating version cannot grant dispatch authority.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT owner.enabled, owner.crm_authority
    INTO crm_enabled, crm_authority
  FROM public.strategy_execution_owners owner
  WHERE owner.owner_key = p_version.crm_owner_key;
  IF NOT COALESCE(crm_enabled, FALSE) OR NOT COALESCE(crm_authority, FALSE) THEN
    RAISE EXCEPTION 'The CRM owner must be enabled and authoritative.'
      USING ERRCODE = '23514';
  END IF;

  SELECT owner.enabled
    INTO automation_enabled
  FROM public.strategy_execution_owners owner
  WHERE owner.owner_key = p_version.automation_owner_key;
  IF NOT COALESCE(automation_enabled, FALSE) OR p_version.automation_owner_key = 'disabled' THEN
    RAISE EXCEPTION 'The automation owner must be enabled.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3a_assert_operating_strategy_version(
  public.operating_strategy_versions
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.gate3a_assert_operating_strategy_version(
  public.operating_strategy_versions
) TO service_role;

-- Required writer release is now an executable invariant, not a shape-only
-- field. It is checked on every new governed runtime/ledger row.
CREATE OR REPLACE FUNCTION private.gate3d1_guard_required_writer_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  candidate_release TEXT;
  candidate_version_id UUID;
BEGIN
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';

  candidate_release := to_jsonb(NEW) ->> TG_ARGV[0];
  IF COALESCE(to_jsonb(NEW) ->> 'operating_strategy_version_id', '')
      ~ '^[0-9a-fA-F-]{36}$' THEN
    candidate_version_id := (to_jsonb(NEW) ->> 'operating_strategy_version_id')::UUID;
  END IF;

  IF runtime_control.enforcement_mode = 'governed_required' THEN
    IF runtime_control.schema_status <> 'cutover_complete'
      OR runtime_control.app_release_status <> 'deployed_governed'
      OR NULLIF(btrim(runtime_control.required_writer_release), '') IS NULL
      OR candidate_release IS DISTINCT FROM runtime_control.required_writer_release THEN
      RAISE EXCEPTION 'Governed writes require the exact configured writer release.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF runtime_control.canary_enforcement_status = 'reviewed_cap_one'
    AND candidate_version_id = runtime_control.canary_operating_strategy_version_id
    AND candidate_release IS DISTINCT FROM runtime_control.canary_required_writer_release THEN
    RAISE EXCEPTION 'Selective canary writes require the exact configured canary writer release.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_guard_required_writer_release()
  FROM PUBLIC, anon, authenticated, service_role;

-- Gate 3C's original activation-manifest branch intentionally required the
-- global cutover. Keep that guard unchanged for learning proposals, and use a
-- narrow activation-only guard for the exact selectively governed cap-one
-- version. Compatibility writers outside this version remain untouched.
DROP TRIGGER operating_strategy_review_manifests_insert_guard
  ON public.operating_strategy_review_manifests;
CREATE TRIGGER operating_strategy_review_manifests_insert_guard
BEFORE INSERT ON public.operating_strategy_review_manifests
FOR EACH ROW
WHEN (NEW.review_type = 'learning_proposal')
EXECUTE FUNCTION private.gate3c_guard_review_manifest_insert();

CREATE OR REPLACE FUNCTION private.gate3d1_guard_activation_review_manifest_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  version public.operating_strategy_versions;
  runtime_control public.operating_strategy_runtime_controls;
BEGIN
  IF NEW.review_type <> 'activation_review' THEN
    RAISE EXCEPTION 'Gate 3D.1 manifest guard only accepts activation reviews.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = NEW.operating_strategy_version_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review manifest operating version not found.'
      USING ERRCODE = '23514';
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

  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  IF version.status <> 'draft'
    OR version.execution_mode <> 'approved_live'
    OR version.external_send_cap <> 1
    OR version.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application'
    OR NEW.proposed_change_json ->> 'targetStatus' <> 'active'
    OR version.contract_json #>> '{activationReadiness,status}' <> 'ready'
    OR jsonb_array_length(COALESCE(
      version.contract_json #> '{activationReadiness,blockers}',
      '[]'::JSONB
    )) <> 0
    OR runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
    OR runtime_control.app_release_status <> 'deployed_compatibility'
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id IS DISTINCT FROM version.id
    OR runtime_control.canary_required_writer_release IS DISTINCT FROM NEW.writer_release THEN
    RAISE EXCEPTION 'Activation review requires the exact selectively governed cap-one canary posture.'
      USING ERRCODE = '23514';
  END IF;

  NEW.operating_strategy_id := version.operating_strategy_id;
  NEW.learning_window_ids_snapshot := ARRAY[]::UUID[];
  NEW.required_complete_windows := 0;
  NEW.operating_version_status_snapshot := version.status;
  NEW.external_send_cap_snapshot := version.external_send_cap;
  NEW.operating_contract_fingerprint :=
    private.gate3b_operating_contract_fingerprint(version);
  NEW.proposal_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'operatingStrategyId', NEW.operating_strategy_id,
    'operatingStrategyVersionId', NEW.operating_strategy_version_id,
    'reviewType', NEW.review_type,
    'proposalKey', NEW.proposal_key,
    'proposedChange', NEW.proposed_change_json,
    'proposedByKind', NEW.proposed_by_kind,
    'proposedByKey', NEW.proposed_by_key,
    'proposedByUserId', NEW.proposed_by_user_id,
    'learningWindows', '[]'::JSONB,
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

REVOKE ALL ON FUNCTION private.gate3d1_guard_activation_review_manifest_insert()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER gate3d1_activation_review_manifest_guard
BEFORE INSERT ON public.operating_strategy_review_manifests
FOR EACH ROW
WHEN (NEW.review_type = 'activation_review')
EXECUTE FUNCTION private.gate3d1_guard_activation_review_manifest_insert();

CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.strategy_source_events
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.strategy_market_state
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.command_center_strategy_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.strategy_lead_memberships
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.command_center_outbound_enrollments
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.orchestration_runs
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.participant_opportunity_matches
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('strategy_writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_activities
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_outcomes
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_dispatch_reservations
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_learning_windows
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_review_manifests
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');
CREATE TRIGGER gate3d1_writer_release_guard
BEFORE INSERT OR UPDATE ON public.operating_strategy_attribution_quarantine
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_guard_required_writer_release('writer_release');

-- Keep Gate 3C's fully tested capacity implementation, but move it behind a
-- private, ungrantable boundary. The public signature below is now the only
-- reservation entry point and checks the global/strategy controls on every
-- call, including idempotent replays.
ALTER FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) SET SCHEMA private;
ALTER FUNCTION private.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) RENAME TO gate3c_reserve_operating_strategy_dispatch_unchecked;
REVOKE ALL ON FUNCTION private.gate3c_reserve_operating_strategy_dispatch_unchecked(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) FROM PUBLIC, anon, authenticated, service_role;

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
  runtime_control public.operating_strategy_runtime_controls;
  strategy_control public.operating_strategy_outbound_controls;
BEGIN
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding'
  FOR SHARE;
  IF runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id THEN
    RETURN QUERY
    SELECT *
    FROM private.gate3c_reserve_operating_strategy_dispatch_unchecked(
      p_operating_strategy_version_id,
      p_operating_contract_fingerprint,
      p_channel,
      p_requested_count,
      p_idempotency_key,
      p_writer_release,
      p_ttl_seconds,
      p_fallback_channels
    );
    RETURN;
  END IF;
  IF runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
    OR runtime_control.app_release_status <> 'deployed_compatibility'
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id
    OR NULLIF(btrim(runtime_control.canary_required_writer_release), '') IS NULL
    OR p_writer_release IS DISTINCT FROM runtime_control.canary_required_writer_release THEN
    RAISE EXCEPTION 'Dispatch reservation requires the exact selectively governed canary writer release.'
      USING ERRCODE = '23514';
  END IF;
  IF runtime_control.outbound_kill_switch THEN
    RAISE EXCEPTION 'The global outbound kill switch is engaged.'
      USING ERRCODE = '23514';
  END IF;
  IF p_requested_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Gate 3D.1 reservations are limited to exactly one recipient.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id
  FOR SHARE;
  IF version.id IS NULL
    OR version.status <> 'active'
    OR version.execution_mode <> 'approved_live'
    OR version.external_send_cap <> 1 THEN
    RAISE EXCEPTION 'Gate 3D.1 reservation requires the active cap-one canary version.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO strategy_control
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = version.operating_strategy_id
  FOR SHARE;
  IF strategy_control.operating_strategy_id IS NULL OR strategy_control.paused THEN
    RAISE EXCEPTION 'The operating strategy outbound control is paused.'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT *
  FROM private.gate3c_reserve_operating_strategy_dispatch_unchecked(
    p_operating_strategy_version_id,
    p_operating_contract_fingerprint,
    p_channel,
    p_requested_count,
    p_idempotency_key,
    p_writer_release,
    p_ttl_seconds,
    p_fallback_channels
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) TO service_role;

-- A founder can engage either stop control at any time. Releasing a control is
-- allowed only for the exact governed writer. Strategy release must happen
-- while the global switch is still engaged; global release then requires one
-- and only one unpaused, active cap-one canary.
CREATE OR REPLACE FUNCTION public.set_operating_strategy_outbound_control(
  p_operating_strategy_id UUID,
  p_blocked BOOLEAN,
  p_actor_user_id UUID,
  p_reason TEXT,
  p_writer_release TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_user_id UUID;
  runtime_control public.operating_strategy_runtime_controls;
  strategy_control public.operating_strategy_outbound_controls;
  open_canary_count INTEGER;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the outbound-control actor.'
      USING ERRCODE = '42501';
  END IF;
  IF p_blocked IS NULL
    OR length(btrim(COALESCE(p_reason, ''))) < 12
    OR NULLIF(btrim(p_writer_release), '') IS NULL THEN
    RAISE EXCEPTION 'Outbound-control state, reason, and writer release are required.'
      USING ERRCODE = '23514';
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
  WHERE controls.control_key = 'canonical_binding'
  FOR UPDATE;

  IF NOT p_blocked AND (
    runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
    OR runtime_control.app_release_status <> 'deployed_compatibility'
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR NULLIF(btrim(runtime_control.canary_required_writer_release), '') IS NULL
    OR p_writer_release IS DISTINCT FROM runtime_control.canary_required_writer_release
  ) THEN
    RAISE EXCEPTION 'Releasing an outbound control requires the exact governed writer release.'
      USING ERRCODE = '23514';
  END IF;

  IF p_operating_strategy_id IS NULL THEN
    IF NOT p_blocked THEN
      SELECT COUNT(*)::INTEGER INTO open_canary_count
      FROM public.operating_strategy_outbound_controls controls
      JOIN public.operating_strategy_versions version
        ON version.operating_strategy_id = controls.operating_strategy_id
       AND version.status = 'active'
       AND version.execution_mode = 'approved_live'
       AND version.external_send_cap = 1
      WHERE NOT controls.paused;
      IF open_canary_count <> 1 THEN
        RAISE EXCEPTION 'Global outbound release requires exactly one unpaused cap-one canary.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    UPDATE public.operating_strategy_runtime_controls
    SET outbound_kill_switch = p_blocked,
        outbound_control_reason = btrim(p_reason),
        outbound_control_writer_release = p_writer_release,
        outbound_control_updated_by_user_id = p_actor_user_id,
        outbound_control_updated_at = statement_timestamp(),
        updated_at = statement_timestamp()
    WHERE control_key = 'canonical_binding';

    RETURN jsonb_build_object(
      'scope', 'global',
      'blocked', p_blocked,
      'actorUserId', p_actor_user_id,
      'writerRelease', p_writer_release
    );
  END IF;

  SELECT controls.* INTO strategy_control
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = p_operating_strategy_id
  FOR UPDATE;
  IF strategy_control.operating_strategy_id IS NULL THEN
    RAISE EXCEPTION 'Operating strategy outbound control not found.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT p_blocked THEN
    IF NOT runtime_control.outbound_kill_switch THEN
      RAISE EXCEPTION 'A strategy can only be unpaused while the global kill switch is engaged.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.operating_strategy_versions version
      WHERE version.operating_strategy_id = p_operating_strategy_id
        AND version.id = runtime_control.canary_operating_strategy_version_id
        AND version.status = 'active'
        AND version.execution_mode = 'approved_live'
        AND version.external_send_cap = 1
        AND version.approved_by_user_id = p_actor_user_id
    ) THEN
      RAISE EXCEPTION 'Strategy release requires the founder-approved active cap-one canary.'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.operating_strategy_outbound_controls controls
      WHERE controls.operating_strategy_id <> p_operating_strategy_id
        AND NOT controls.paused
    ) THEN
      RAISE EXCEPTION 'Only one strategy may be unpaused during Gate 3D.1.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.operating_strategy_outbound_controls
  SET paused = p_blocked,
      pause_reason = btrim(p_reason),
      writer_release = p_writer_release,
      updated_by_user_id = p_actor_user_id,
      updated_at = statement_timestamp()
  WHERE operating_strategy_id = p_operating_strategy_id;

  RETURN jsonb_build_object(
    'scope', 'strategy',
    'operatingStrategyId', p_operating_strategy_id,
    'blocked', p_blocked,
    'actorUserId', p_actor_user_id,
    'writerRelease', p_writer_release
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_operating_strategy_outbound_control(
  UUID, BOOLEAN, UUID, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_operating_strategy_outbound_control(
  UUID, BOOLEAN, UUID, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_inbound_reply_continuation_authorization(
  p_operating_strategy_version_id UUID,
  p_lead_id UUID,
  p_inbound_message_id TEXT,
  p_inbound_conversation_id TEXT,
  p_inbound_internet_message_id TEXT,
  p_property_reference_key TEXT,
  p_purpose_key TEXT,
  p_expires_at TIMESTAMPTZ,
  p_actor_user_id UUID,
  p_rationale TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_user_id UUID;
  runtime_control public.operating_strategy_runtime_controls;
  version public.operating_strategy_versions;
  existing_authorization private.inbound_reply_continuation_authorizations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the continuation-review actor.'
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
    RAISE EXCEPTION 'The authenticated user is not an active founder continuation reviewer.'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_inbound_message_id), '') IS NULL
    OR NULLIF(btrim(p_inbound_conversation_id), '') IS NULL
    OR NULLIF(btrim(p_inbound_internet_message_id), '') IS NULL
    OR NULLIF(btrim(p_property_reference_key), '') IS NULL
    OR p_purpose_key !~ '^[a-z0-9][a-z0-9_.:-]*$'
    OR length(btrim(COALESCE(p_rationale, ''))) < 20
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Exact inbound thread, property, purpose, rationale, and idempotency evidence are required.'
      USING ERRCODE = '23514';
  END IF;
  IF p_expires_at <= statement_timestamp()
    OR p_expires_at > statement_timestamp() + INTERVAL '7 days' THEN
    RAISE EXCEPTION 'Continuation authorization must expire within seven days.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  IF runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id
    OR runtime_control.canary_required_writer_release IS DISTINCT FROM p_writer_release
    OR runtime_control.canary_approved_by_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Continuation authorization requires the exact reviewed canary posture and writer.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id;
  IF version.id IS NULL
    OR version.status <> 'active'
    OR version.execution_mode <> 'approved_live'
    OR version.external_send_cap <> 1
    OR version.approved_by_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Continuation authorization requires the founder-approved active cap-one version.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads lead WHERE lead.id = p_lead_id) THEN
    RAISE EXCEPTION 'Continuation lead not found.' USING ERRCODE = '23514';
  END IF;

  SELECT authz.* INTO existing_authorization
  FROM private.inbound_reply_continuation_authorizations authz
  WHERE authz.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_authorization.operating_strategy_version_id
        IS DISTINCT FROM p_operating_strategy_version_id
      OR existing_authorization.lead_id IS DISTINCT FROM p_lead_id
      OR existing_authorization.inbound_message_id IS DISTINCT FROM btrim(p_inbound_message_id)
      OR existing_authorization.inbound_conversation_id
        IS DISTINCT FROM btrim(p_inbound_conversation_id)
      OR existing_authorization.inbound_internet_message_id
        IS DISTINCT FROM btrim(p_inbound_internet_message_id)
      OR existing_authorization.property_reference_key
        IS DISTINCT FROM btrim(p_property_reference_key)
      OR existing_authorization.purpose_key IS DISTINCT FROM p_purpose_key
      OR existing_authorization.expires_at IS DISTINCT FROM p_expires_at
      OR existing_authorization.approved_by_user_id IS DISTINCT FROM p_actor_user_id
      OR existing_authorization.rationale IS DISTINCT FROM btrim(p_rationale)
      OR existing_authorization.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'Continuation authorization replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_authorization.id;
  END IF;

  result_id := gen_random_uuid();
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'authorizationId', result_id,
    'operatingStrategyVersionId', p_operating_strategy_version_id,
    'leadId', p_lead_id,
    'authorizationBasis', 'positive_inbound_reply_continuation',
    'inboundProvider', 'outlook_graph',
    'inboundMessageId', btrim(p_inbound_message_id),
    'inboundConversationId', btrim(p_inbound_conversation_id),
    'inboundInternetMessageId', btrim(p_inbound_internet_message_id),
    'propertyReferenceKey', btrim(p_property_reference_key),
    'purposeKey', p_purpose_key,
    'approvedByUserId', p_actor_user_id,
    'expiresAt', p_expires_at,
    'rationale', btrim(p_rationale),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));

  INSERT INTO private.inbound_reply_continuation_authorizations(
    id,
    operating_strategy_version_id,
    lead_id,
    inbound_provider,
    inbound_message_id,
    inbound_conversation_id,
    inbound_internet_message_id,
    property_reference_key,
    purpose_key,
    approved_by_user_id,
    expires_at,
    rationale,
    writer_release,
    idempotency_key,
    authorization_fingerprint
  ) VALUES (
    result_id,
    p_operating_strategy_version_id,
    p_lead_id,
    'outlook_graph',
    btrim(p_inbound_message_id),
    btrim(p_inbound_conversation_id),
    btrim(p_inbound_internet_message_id),
    btrim(p_property_reference_key),
    p_purpose_key,
    p_actor_user_id,
    p_expires_at,
    btrim(p_rationale),
    p_writer_release,
    p_idempotency_key,
    result_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inbound_reply_continuation_authorization(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_inbound_reply_continuation_authorization(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_inbound_reply_continuation_authorization(
  p_authorization_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_user_id UUID;
  existing_revocation private.inbound_reply_continuation_revocations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the revocation actor.'
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
    RAISE EXCEPTION 'The authenticated user is not an active founder continuation reviewer.'
      USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 12
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'A revocation reason and idempotency key are required.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.inbound_reply_continuation_authorizations authz
    WHERE authz.id = p_authorization_id
  ) THEN
    RAISE EXCEPTION 'Continuation authorization not found.' USING ERRCODE = '23514';
  END IF;

  SELECT revocation.* INTO existing_revocation
  FROM private.inbound_reply_continuation_revocations revocation
  WHERE revocation.authorization_id = p_authorization_id
     OR revocation.idempotency_key = p_idempotency_key
  ORDER BY revocation.authorization_id = p_authorization_id DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing_revocation.authorization_id IS DISTINCT FROM p_authorization_id
      OR existing_revocation.revoked_by_user_id IS DISTINCT FROM p_actor_user_id
      OR existing_revocation.reason IS DISTINCT FROM btrim(p_reason)
      OR existing_revocation.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Continuation revocation replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_revocation.id;
  END IF;

  result_id := gen_random_uuid();
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'revocationId', result_id,
    'authorizationId', p_authorization_id,
    'revokedByUserId', p_actor_user_id,
    'reason', btrim(p_reason),
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.inbound_reply_continuation_revocations(
    id,
    authorization_id,
    revoked_by_user_id,
    reason,
    idempotency_key,
    revocation_fingerprint
  ) VALUES (
    result_id,
    p_authorization_id,
    p_actor_user_id,
    btrim(p_reason),
    p_idempotency_key,
    result_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_inbound_reply_continuation_authorization(
  UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_inbound_reply_continuation_authorization(
  UUID, UUID, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_inbound_reply_continuation_authorized(
  p_authorization_id UUID,
  p_operating_strategy_version_id UUID,
  p_lead_id UUID,
  p_inbound_message_id TEXT,
  p_inbound_conversation_id TEXT,
  p_inbound_internet_message_id TEXT,
  p_property_reference_key TEXT,
  p_purpose_key TEXT,
  p_writer_release TEXT
)
RETURNS TABLE (
  authorization_id UUID,
  expires_at TIMESTAMPTZ,
  authorization_fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT authz.id, authz.expires_at, authz.authorization_fingerprint
  FROM private.inbound_reply_continuation_authorizations authz
  JOIN public.operating_strategy_runtime_controls runtime_control
    ON runtime_control.control_key = 'canonical_binding'
  WHERE authz.id = p_authorization_id
    AND authz.operating_strategy_version_id = p_operating_strategy_version_id
    AND authz.lead_id = p_lead_id
    AND authz.authorization_basis = 'positive_inbound_reply_continuation'
    AND authz.inbound_provider = 'outlook_graph'
    AND authz.inbound_message_id = btrim(p_inbound_message_id)
    AND authz.inbound_conversation_id = btrim(p_inbound_conversation_id)
    AND authz.inbound_internet_message_id = btrim(p_inbound_internet_message_id)
    AND authz.property_reference_key = btrim(p_property_reference_key)
    AND authz.purpose_key = p_purpose_key
    AND authz.writer_release = p_writer_release
    AND authz.expires_at > statement_timestamp()
    AND runtime_control.canary_enforcement_status = 'reviewed_cap_one'
    AND runtime_control.canary_operating_strategy_version_id = p_operating_strategy_version_id
    AND runtime_control.canary_required_writer_release = p_writer_release
    AND NOT EXISTS (
      SELECT 1
      FROM private.inbound_reply_continuation_revocations revocation
      WHERE revocation.authorization_id = authz.id
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact inbound-reply continuation authorization is missing, expired, revoked, or mismatched.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_inbound_reply_continuation_authorized(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_inbound_reply_continuation_authorized(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_exchange_application_rbac_attestation(
  p_tenant_id UUID,
  p_client_id UUID,
  p_mailbox_object_id UUID,
  p_mailbox_address TEXT,
  p_rbac_role_set_json JSONB,
  p_in_scope_test_fingerprint TEXT,
  p_out_of_scope_test_fingerprint TEXT,
  p_expires_at TIMESTAMPTZ,
  p_actor_user_id UUID,
  p_rationale TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_user_id UUID;
  runtime_control public.operating_strategy_runtime_controls;
  normalized_roles JSONB;
  existing_attestation private.exchange_application_rbac_attestations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the RBAC attestation actor.'
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
    RAISE EXCEPTION 'The authenticated user is not an active founder RBAC reviewer.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(role_name ORDER BY role_name), '[]'::JSONB)
    INTO normalized_roles
  FROM (
    SELECT DISTINCT btrim(role.value #>> '{}') AS role_name
    FROM jsonb_array_elements(COALESCE(p_rbac_role_set_json, '[]'::JSONB)) role(value)
    WHERE jsonb_typeof(role.value) = 'string'
      AND NULLIF(btrim(role.value #>> '{}'), '') IS NOT NULL
  ) normalized;
  IF jsonb_array_length(normalized_roles) = 0
    OR lower(btrim(COALESCE(p_mailbox_address, '')))
      !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR lower(COALESCE(p_in_scope_test_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_out_of_scope_test_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR lower(p_in_scope_test_fingerprint) = lower(p_out_of_scope_test_fingerprint)
    OR length(btrim(COALESCE(p_rationale, ''))) < 20
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Exact RBAC role, mailbox, dual test fingerprints, rationale, and idempotency evidence are required.'
      USING ERRCODE = '23514';
  END IF;
  IF p_expires_at <= statement_timestamp()
    OR p_expires_at > statement_timestamp() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Exchange Application RBAC attestation must expire within 24 hours.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  IF runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_required_writer_release IS DISTINCT FROM p_writer_release
    OR runtime_control.canary_approved_by_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'RBAC attestation requires the exact reviewed canary writer and founder.'
      USING ERRCODE = '23514';
  END IF;

  SELECT attestation.* INTO existing_attestation
  FROM private.exchange_application_rbac_attestations attestation
  WHERE attestation.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_attestation.tenant_id IS DISTINCT FROM p_tenant_id
      OR existing_attestation.client_id IS DISTINCT FROM p_client_id
      OR existing_attestation.mailbox_object_id IS DISTINCT FROM p_mailbox_object_id
      OR existing_attestation.mailbox_address
        IS DISTINCT FROM lower(btrim(p_mailbox_address))
      OR existing_attestation.rbac_role_set_json IS DISTINCT FROM normalized_roles
      OR existing_attestation.in_scope_test_fingerprint
        IS DISTINCT FROM lower(p_in_scope_test_fingerprint)
      OR existing_attestation.out_of_scope_test_fingerprint
        IS DISTINCT FROM lower(p_out_of_scope_test_fingerprint)
      OR existing_attestation.expires_at IS DISTINCT FROM p_expires_at
      OR existing_attestation.recorded_by_user_id IS DISTINCT FROM p_actor_user_id
      OR existing_attestation.rationale IS DISTINCT FROM btrim(p_rationale)
      OR existing_attestation.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'RBAC attestation replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_attestation.id;
  END IF;

  result_id := gen_random_uuid();
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'attestationId', result_id,
    'tenantId', p_tenant_id,
    'clientId', p_client_id,
    'mailboxObjectId', p_mailbox_object_id,
    'mailboxAddress', lower(btrim(p_mailbox_address)),
    'rbacRoleSet', normalized_roles,
    'inScopeAuthorized', TRUE,
    'inScopeTestFingerprint', lower(p_in_scope_test_fingerprint),
    'outOfScopeDenied', TRUE,
    'outOfScopeTestFingerprint', lower(p_out_of_scope_test_fingerprint),
    'recordedByUserId', p_actor_user_id,
    'expiresAt', p_expires_at,
    'rationale', btrim(p_rationale),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));

  INSERT INTO private.exchange_application_rbac_attestations(
    id,
    tenant_id,
    client_id,
    mailbox_object_id,
    mailbox_address,
    rbac_role_set_json,
    in_scope_authorized,
    in_scope_test_fingerprint,
    out_of_scope_denied,
    out_of_scope_test_fingerprint,
    recorded_by_user_id,
    expires_at,
    rationale,
    writer_release,
    idempotency_key,
    attestation_fingerprint
  ) VALUES (
    result_id,
    p_tenant_id,
    p_client_id,
    p_mailbox_object_id,
    lower(btrim(p_mailbox_address)),
    normalized_roles,
    TRUE,
    lower(p_in_scope_test_fingerprint),
    TRUE,
    lower(p_out_of_scope_test_fingerprint),
    p_actor_user_id,
    p_expires_at,
    btrim(p_rationale),
    p_writer_release,
    p_idempotency_key,
    result_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_exchange_application_rbac_attestation(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_exchange_application_rbac_attestation(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_exchange_application_rbac_attestation(
  p_attestation_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_user_id UUID;
  existing_revocation private.exchange_application_rbac_attestation_revocations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  caller_user_id := auth.uid();
  IF caller_user_id IS NULL OR caller_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the RBAC revocation actor.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.operating_strategy_reviewer_authorities authority
    WHERE authority.user_id = p_actor_user_id
      AND authority.authority_role = 'founder_reviewer'
      AND authority.can_activate_operating_versions
      AND authority.valid_from <= statement_timestamp()
      AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
  ) THEN
    RAISE EXCEPTION 'The authenticated user is not an active founder RBAC reviewer.'
      USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 12
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'An RBAC revocation reason and idempotency key are required.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.exchange_application_rbac_attestations attestation
    WHERE attestation.id = p_attestation_id
  ) THEN
    RAISE EXCEPTION 'RBAC attestation not found.' USING ERRCODE = '23514';
  END IF;

  SELECT revocation.* INTO existing_revocation
  FROM private.exchange_application_rbac_attestation_revocations revocation
  WHERE revocation.attestation_id = p_attestation_id
     OR revocation.idempotency_key = p_idempotency_key
  ORDER BY revocation.attestation_id = p_attestation_id DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing_revocation.attestation_id IS DISTINCT FROM p_attestation_id
      OR existing_revocation.revoked_by_user_id IS DISTINCT FROM p_actor_user_id
      OR existing_revocation.reason IS DISTINCT FROM btrim(p_reason)
      OR existing_revocation.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'RBAC revocation replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_revocation.id;
  END IF;

  result_id := gen_random_uuid();
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'revocationId', result_id,
    'attestationId', p_attestation_id,
    'revokedByUserId', p_actor_user_id,
    'reason', btrim(p_reason),
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.exchange_application_rbac_attestation_revocations(
    id,
    attestation_id,
    revoked_by_user_id,
    reason,
    idempotency_key,
    revocation_fingerprint
  ) VALUES (
    result_id,
    p_attestation_id,
    p_actor_user_id,
    btrim(p_reason),
    p_idempotency_key,
    result_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_exchange_application_rbac_attestation(
  UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_exchange_application_rbac_attestation(
  UUID, UUID, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_exchange_application_rbac_attested(
  p_tenant_id UUID,
  p_client_id UUID,
  p_mailbox_object_id UUID,
  p_mailbox_address TEXT,
  p_rbac_role_set_json JSONB,
  p_writer_release TEXT
)
RETURNS TABLE (
  attestation_id UUID,
  expires_at TIMESTAMPTZ,
  attestation_fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_roles JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(role_name ORDER BY role_name), '[]'::JSONB)
    INTO normalized_roles
  FROM (
    SELECT DISTINCT btrim(role.value #>> '{}') AS role_name
    FROM jsonb_array_elements(COALESCE(p_rbac_role_set_json, '[]'::JSONB)) role(value)
    WHERE jsonb_typeof(role.value) = 'string'
      AND NULLIF(btrim(role.value #>> '{}'), '') IS NOT NULL
  ) normalized;

  RETURN QUERY
  SELECT attestation.id, attestation.expires_at, attestation.attestation_fingerprint
  FROM private.exchange_application_rbac_attestations attestation
  JOIN public.operating_strategy_runtime_controls runtime_control
    ON runtime_control.control_key = 'canonical_binding'
  WHERE attestation.tenant_id = p_tenant_id
    AND attestation.client_id = p_client_id
    AND attestation.mailbox_object_id = p_mailbox_object_id
    AND attestation.mailbox_address = lower(btrim(p_mailbox_address))
    AND attestation.rbac_role_set_json = normalized_roles
    AND attestation.in_scope_authorized
    AND attestation.out_of_scope_denied
    AND attestation.expires_at > statement_timestamp()
    AND attestation.writer_release = p_writer_release
    AND runtime_control.canary_enforcement_status = 'reviewed_cap_one'
    AND runtime_control.canary_required_writer_release = p_writer_release
    AND NOT EXISTS (
      SELECT 1
      FROM private.exchange_application_rbac_attestation_revocations revocation
      WHERE revocation.attestation_id = attestation.id
    )
  ORDER BY attestation.recorded_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact Exchange Application RBAC attestation is missing, expired, revoked, or mismatched.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_exchange_application_rbac_attested(
  UUID, UUID, UUID, TEXT, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_exchange_application_rbac_attested(
  UUID, UUID, UUID, TEXT, JSONB, TEXT
) TO service_role;

-- Call this immediately before every external provider mutation. It is
-- intentionally read-only and idempotent so Graph may call it before
-- createReply and again immediately before send. The exact canonical
-- enrollment and continuation authorization must already exist.
CREATE OR REPLACE FUNCTION public.assert_operating_strategy_dispatch_authorized(
  p_reservation_id UUID,
  p_operating_strategy_version_id UUID,
  p_channel TEXT,
  p_writer_release TEXT
)
RETURNS TABLE (
  reservation_id UUID,
  operating_strategy_version_id UUID,
  channel TEXT,
  expires_at TIMESTAMPTZ,
  authorization_fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  version public.operating_strategy_versions;
  strategy_control public.operating_strategy_outbound_controls;
  reservation public.operating_strategy_dispatch_reservations;
  activity public.operating_strategy_activities;
  enrollment public.command_center_outbound_enrollments;
  continuation private.inbound_reply_continuation_authorizations;
  matching_activity_count INTEGER;
  continuation_id UUID;
  result_expires_at TIMESTAMPTZ;
  result_fingerprint TEXT;
BEGIN
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding'
  FOR SHARE;
  IF runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
    OR runtime_control.app_release_status <> 'deployed_compatibility'
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id
    OR runtime_control.canary_required_writer_release IS DISTINCT FROM p_writer_release
    OR runtime_control.outbound_kill_switch THEN
    RAISE EXCEPTION 'Pre-provider dispatch is blocked by canary posture, writer release, or global kill switch.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id;
  IF version.id IS NULL
    OR version.status <> 'active'
    OR version.execution_mode <> 'approved_live'
    OR version.external_send_cap <> 1 THEN
    RAISE EXCEPTION 'Pre-provider dispatch requires the selected active cap-one canary.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO strategy_control
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = version.operating_strategy_id
  FOR SHARE;
  IF strategy_control.operating_strategy_id IS NULL OR strategy_control.paused THEN
    RAISE EXCEPTION 'Pre-provider dispatch is blocked by the strategy pause.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = p_reservation_id
    AND candidate.operating_strategy_version_id = p_operating_strategy_version_id;
  IF reservation.id IS NULL
    OR reservation.requested_count <> 1
    OR reservation.channel IS DISTINCT FROM p_channel
    OR reservation.writer_release IS DISTINCT FROM p_writer_release
    OR statement_timestamp() >= reservation.expires_at THEN
    RAISE EXCEPTION 'Pre-provider dispatch reservation is missing, expired, or mismatched.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)::INTEGER,
    (array_agg(candidate.id ORDER BY candidate.id))[1]
    INTO matching_activity_count, activity.id
  FROM public.operating_strategy_activities candidate
  WHERE candidate.dispatch_reservation_id = reservation.id
    AND candidate.activity_type = 'enrollment';
  IF matching_activity_count <> 1 THEN
    RAISE EXCEPTION 'Pre-provider dispatch requires exactly one canonical enrollment activity.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = activity.id;
  IF activity.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR activity.dispatch_channel IS DISTINCT FROM p_channel
    OR activity.writer_release IS DISTINCT FROM p_writer_release
    OR activity.suppression_snapshot_json -> 'suppressionCleared' IS DISTINCT FROM 'true'::JSONB
    OR activity.consent_basis_snapshot_json ->> 'basis'
      IS DISTINCT FROM 'positive_inbound_reply_continuation' THEN
    RAISE EXCEPTION 'Canonical enrollment evidence does not authorize this provider dispatch.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO enrollment
  FROM public.command_center_outbound_enrollments candidate
  WHERE candidate.id = activity.outbound_enrollment_id
    AND candidate.operating_strategy_version_id = p_operating_strategy_version_id
    AND candidate.dispatch_reservation_id = reservation.id
    AND candidate.canonical_activity_id = activity.id
    AND candidate.strategy_binding_mode = 'governed_v1'
    AND candidate.governed_stage = 'dispatch_intent'
    AND candidate.dispatch_channel = p_channel;
  IF enrollment.id IS NULL
    OR enrollment.consent_basis_snapshot_json IS DISTINCT FROM activity.consent_basis_snapshot_json
    OR enrollment.suppression_snapshot_json IS DISTINCT FROM activity.suppression_snapshot_json THEN
    RAISE EXCEPTION 'Governed enrollment and canonical activity evidence do not match.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(activity.consent_basis_snapshot_json ->> 'authorizationId', '')
      !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'Continuation authorization ID is missing from the immutable consent snapshot.'
      USING ERRCODE = '23514';
  END IF;
  continuation_id :=
    (activity.consent_basis_snapshot_json ->> 'authorizationId')::UUID;

  SELECT authz.* INTO continuation
  FROM private.inbound_reply_continuation_authorizations authz
  WHERE authz.id = continuation_id
    AND authz.operating_strategy_version_id = p_operating_strategy_version_id
    AND authz.authorization_basis = 'positive_inbound_reply_continuation'
    AND authz.writer_release = p_writer_release
    AND authz.expires_at > statement_timestamp()
    AND authz.lead_id::TEXT = activity.subject_key
    AND authz.lead_id::TEXT = activity.consent_basis_snapshot_json ->> 'leadId'
    AND authz.inbound_provider = activity.consent_basis_snapshot_json ->> 'inboundProvider'
    AND authz.inbound_message_id = activity.consent_basis_snapshot_json ->> 'inboundMessageId'
    AND authz.inbound_conversation_id = activity.consent_basis_snapshot_json ->> 'inboundConversationId'
    AND authz.inbound_internet_message_id = activity.consent_basis_snapshot_json ->> 'inboundInternetMessageId'
    AND authz.property_reference_key = activity.consent_basis_snapshot_json ->> 'propertyReferenceKey'
    AND authz.purpose_key = activity.consent_basis_snapshot_json ->> 'purposeKey'
    AND NOT EXISTS (
      SELECT 1
      FROM private.inbound_reply_continuation_revocations revocation
      WHERE revocation.authorization_id = authz.id
    );
  IF continuation.id IS NULL THEN
    RAISE EXCEPTION 'Exact inbound-reply continuation evidence is missing, expired, revoked, or mismatched.'
      USING ERRCODE = '23514';
  END IF;

  result_expires_at := LEAST(reservation.expires_at, continuation.expires_at);
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'reservationId', reservation.id,
    'reservationFingerprint', reservation.reservation_fingerprint,
    'operatingStrategyVersionId', version.id,
    'operatingContractFingerprint', reservation.operating_contract_fingerprint,
    'channel', p_channel,
    'writerRelease', p_writer_release,
    'canonicalActivityId', activity.id,
    'activityFingerprint', activity.activity_fingerprint,
    'continuationAuthorizationId', continuation.id,
    'continuationAuthorizationFingerprint', continuation.authorization_fingerprint,
    'globalControlUpdatedAt', runtime_control.outbound_control_updated_at,
    'strategyControlUpdatedAt', strategy_control.updated_at,
    'expiresAt', result_expires_at
  ));

  RETURN QUERY SELECT
    reservation.id,
    version.id,
    p_channel,
    result_expires_at,
    result_fingerprint;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_operating_strategy_dispatch_authorized(
  UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_operating_strategy_dispatch_authorized(
  UUID, UUID, TEXT, TEXT
) TO service_role;

-- Preserve Gate 3C's authenticated/fingerprint-reviewed activation path, and
-- bind the accepted manifest to the exact required writer plus engaged stop
-- controls. No service role receives activation authority.
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
  strategy_control public.operating_strategy_outbound_controls;
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
  WHERE controls.control_key = 'canonical_binding'
  FOR SHARE;
  IF runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.schema_status <> 'app_deployed_pending_cutover'
    OR runtime_control.app_release_status <> 'deployed_compatibility'
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id IS DISTINCT FROM p_version_id
    OR NULLIF(btrim(runtime_control.canary_required_writer_release), '') IS NULL
    OR runtime_control.canary_approved_by_user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Operating-version activation requires the exact selectively governed canary posture.'
      USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_version_id
  FOR UPDATE;
  IF NOT FOUND OR candidate.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a draft operating version can be activated.'
      USING ERRCODE = '23514';
  END IF;
  IF candidate.contract_json #>> '{activationReadiness,status}' <> 'ready'
    OR jsonb_array_length(COALESCE(
      candidate.contract_json #> '{activationReadiness,blockers}',
      '[]'::JSONB
    )) <> 0 THEN
    RAISE EXCEPTION 'The operating contract still has activation-readiness blockers.'
      USING ERRCODE = '23514';
  END IF;
  IF candidate.execution_mode = 'approved_live' THEN
    IF candidate.external_send_cap <> 1
      OR candidate.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application'
      OR NOT runtime_control.outbound_kill_switch THEN
      RAISE EXCEPTION 'The live candidate must be a cap-one VestBlock canary activated under the engaged global kill switch.'
        USING ERRCODE = '23514';
    END IF;
    SELECT controls.* INTO strategy_control
    FROM public.operating_strategy_outbound_controls controls
    WHERE controls.operating_strategy_id = candidate.operating_strategy_id
    FOR SHARE;
    IF strategy_control.operating_strategy_id IS NULL OR NOT strategy_control.paused THEN
      RAISE EXCEPTION 'The canary strategy must remain paused during activation.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  candidate_fingerprint := private.gate3b_operating_contract_fingerprint(candidate);
  SELECT manifest.* INTO activation_manifest
  FROM public.operating_strategy_review_manifests manifest
  JOIN public.operating_strategy_review_decisions decision
    ON decision.manifest_id = manifest.id
  WHERE manifest.operating_strategy_version_id = candidate.id
    AND manifest.review_type = 'activation_review'
    AND manifest.apply_status = 'pending_human_review'
    AND manifest.operating_contract_fingerprint = candidate_fingerprint
    AND manifest.proposed_change_json ->> 'targetStatus' = 'active'
    AND manifest.writer_release = runtime_control.canary_required_writer_release
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
    RAISE EXCEPTION 'No exact founder-approved activation manifest exists for this contract and writer release.'
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
    RAISE EXCEPTION 'Operating strategy versions must activate sequentially.'
      USING ERRCODE = '23514';
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
      'draftContractFingerprint', candidate_fingerprint,
      'requiredWriterRelease', runtime_control.canary_required_writer_release,
      'globalKillSwitchEngagedAtActivation', runtime_control.outbound_kill_switch,
      'strategyPausedAtActivation', strategy_control.paused
    )
  );
  RETURN NEXT activated;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_operating_strategy_version(UUID, UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.activate_operating_strategy_version(UUID, UUID)
  TO authenticated;

-- Applying this migration alone remains a complete no-send operation.
DO $gate3d1_postconditions$
DECLARE
  strategy_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO strategy_count FROM public.operating_strategies;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.schema_status = 'staged_pending_app_deployment'
      AND controls.app_release_status = 'not_deployed'
      AND controls.required_writer_release IS NULL
      AND controls.canary_enforcement_status = 'disabled'
      AND controls.canary_operating_strategy_version_id IS NULL
      AND controls.canary_required_writer_release IS NULL
      AND controls.outbound_kill_switch
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 did not preserve the fail-closed compatibility watermark.';
  END IF;
  IF (SELECT COUNT(*) FROM public.operating_strategy_outbound_controls) <> strategy_count
    OR EXISTS (
      SELECT 1 FROM public.operating_strategy_outbound_controls WHERE NOT paused
    ) THEN
    RAISE EXCEPTION 'Every strategy must begin with its outbound control paused.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_versions
    WHERE status <> 'draft'
       OR execution_mode IN ('internal_test', 'approved_live')
       OR external_send_cap <> 0
       OR approved_at IS NOT NULL
       OR activated_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 changed strategy activation or send capacity.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities) THEN
    RAISE EXCEPTION 'Gate 3D.1 unexpectedly seeded reviewer authority.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 changed n8n live-send state.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'operating_strategy_outbound_controls'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 outbound controls must force RLS.';
  END IF;
  IF has_table_privilege(
      'service_role',
      'public.operating_strategy_outbound_controls',
      'UPDATE'
    ) OR has_table_privilege(
      'authenticated',
      'public.operating_strategy_outbound_controls',
      'UPDATE'
    ) THEN
    RAISE EXCEPTION 'Outbound controls expose direct mutation privilege.';
  END IF;
  IF has_function_privilege(
      'service_role',
      'private.gate3c_reserve_operating_strategy_dispatch_unchecked(uuid,text,text,integer,text,text,integer,text[])',
      'EXECUTE'
    ) OR NOT has_function_privilege(
      'service_role',
      'public.reserve_operating_strategy_dispatch(uuid,text,text,integer,text,text,integer,text[])',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'The reservation wrapper is not the exclusive service-role entry point.';
  END IF;
  IF has_function_privilege(
      'service_role',
      'public.set_operating_strategy_outbound_control(uuid,boolean,uuid,text,text)',
      'EXECUTE'
    ) OR NOT has_function_privilege(
      'authenticated',
      'public.set_operating_strategy_outbound_control(uuid,boolean,uuid,text,text)',
      'EXECUTE'
    ) OR has_function_privilege(
      'service_role',
      'public.activate_operating_strategy_version(uuid,uuid)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'Founder-only outbound control or activation authority is misgranted.';
  END IF;
END
$gate3d1_postconditions$;
