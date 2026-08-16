-- Gate 3D.1 one-shot provider-dispatch successor.
--
-- This migration remains inert by default: it seeds no reviewer, continuation,
-- Exchange permission proof, claim, reservation, activation, control release,
-- provider draft, or send. It narrows the selected canary to one exact positive
-- inbound Outlook thread and makes every provider mutation a one-shot state
-- transition with immutable evidence and founder-only reconciliation.

DO $gate3d1_one_shot_preconditions$
BEGIN
  IF to_regclass('private.gate3d1_canary_dispatch_claims') IS NOT NULL THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot controls already exist.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.inbound_reply_continuation_authorizations
  ) OR EXISTS (
    SELECT 1 FROM private.inbound_reply_continuation_revocations
  ) OR EXISTS (
    SELECT 1 FROM private.exchange_application_rbac_attestations
  ) OR EXISTS (
    SELECT 1 FROM private.exchange_application_rbac_attestation_revocations
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot migration will not rewrite existing authorization evidence.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.canary_enforcement_status = 'disabled'
      AND controls.canary_operating_strategy_version_id IS NULL
      AND controls.canary_required_writer_release IS NULL
      AND controls.outbound_kill_switch
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot migration requires the untouched fail-closed selective posture.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_outbound_controls WHERE NOT paused
  ) OR EXISTS (
    SELECT 1 FROM public.operating_strategy_dispatch_reservations
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot migration requires paused strategies and no reservation history.';
  END IF;
END
$gate3d1_one_shot_preconditions$;

-- Remove the provisional, reusable continuation surface. The underlying
-- tables are empty by precondition, so no evidence is lost.
DROP FUNCTION public.assert_operating_strategy_dispatch_authorized(UUID, UUID, TEXT, TEXT);
DROP FUNCTION public.assert_inbound_reply_continuation_authorized(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);
DROP FUNCTION public.revoke_inbound_reply_continuation_authorization(UUID, UUID, TEXT, TEXT);
DROP FUNCTION public.record_inbound_reply_continuation_authorization(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
);
DROP TABLE private.inbound_reply_continuation_revocations;
DROP TABLE private.inbound_reply_continuation_authorizations;

DROP FUNCTION public.assert_exchange_application_rbac_attested(
  UUID, UUID, UUID, TEXT, JSONB, TEXT
);
DROP FUNCTION public.record_exchange_application_rbac_attestation(
  UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
);
ALTER TABLE private.exchange_application_rbac_attestations
  ADD COLUMN out_of_scope_mailbox_object_id UUID NOT NULL,
  ADD CONSTRAINT exchange_application_rbac_attestations_scope_separation_check CHECK (
    out_of_scope_mailbox_object_id <> mailbox_object_id
  );

CREATE OR REPLACE FUNCTION private.gate3d1_sha256_text(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_value, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION private.gate3d1_sha256_text(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_canonical_authored_body(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(p_value, '^[[:space:]]+', '', 'g'),
    '[[:space:]]+$', '', 'g'
  );
$$;

REVOKE ALL ON FUNCTION private.gate3d1_canonical_authored_body(TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_dispatch_evaluation_time()
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT statement_timestamp();
$$;

REVOKE ALL ON FUNCTION private.gate3d1_dispatch_evaluation_time()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_assert_founder_actor(p_actor_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'The authenticated founder identity must match the requested actor.'
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
    RAISE EXCEPTION 'The authenticated user is not an active founder reviewer.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_assert_founder_actor(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bootstrap_gate3d1_founder_reviewer(
  p_actor_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expected_founder_id CONSTANT UUID := 'db0e9822-637b-4038-bc18-2a4b020cedce';
BEGIN
  IF auth.uid() IS NULL
    OR auth.uid() IS DISTINCT FROM p_actor_user_id
    OR p_actor_user_id IS DISTINCT FROM expected_founder_id THEN
    RAISE EXCEPTION 'Only the exact authenticated verified VestBlock founder may bootstrap reviewer authority.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users founder
    WHERE founder.id = expected_founder_id
      AND lower(founder.email) = 'contact@vestblock.io'
      AND founder.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The exact verified VestBlock founder Auth identity is unavailable.'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_reviewer_authorities authority
    WHERE authority.user_id = expected_founder_id
      AND authority.authority_role = 'founder_reviewer'
      AND authority.can_activate_operating_versions
      AND authority.valid_from <= statement_timestamp()
      AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
  ) THEN
    RETURN expected_founder_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.operating_strategy_reviewer_authorities) THEN
    RAISE EXCEPTION 'Reviewer authority already exists; one-time founder bootstrap refuses to overwrite it.'
      USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.operating_strategy_reviewer_authorities(
    user_id, authority_role, can_review_learning,
    can_activate_operating_versions, valid_from, source_provenance_json,
    authority_fingerprint
  ) VALUES (
    expected_founder_id, 'founder_reviewer', TRUE, TRUE, statement_timestamp(),
    jsonb_build_array(jsonb_build_object(
      'source', 'Gate 3D.1 exact verified founder authenticated bootstrap',
      'authUserId', expected_founder_id,
      'authEmail', 'contact@vestblock.io',
      'recordedAt', statement_timestamp()
    )),
    '00000000000000000000000000000000'
  );
  RETURN expected_founder_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_gate3d1_founder_reviewer(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_gate3d1_founder_reviewer(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_gate3d1_founder_actor(
  p_actor_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  RETURN p_actor_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_gate3d1_founder_actor(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.assert_gate3d1_founder_actor(UUID)
  TO authenticated;

CREATE TABLE private.inbound_reply_continuation_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_version_id UUID NOT NULL
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reply_memory_id UUID NOT NULL UNIQUE
    REFERENCES public.command_center_reply_memory(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  outreach_message_id UUID NOT NULL UNIQUE
    REFERENCES public.outreach_messages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  exchange_rbac_attestation_id UUID NOT NULL
    REFERENCES private.exchange_application_rbac_attestations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  authorization_basis TEXT NOT NULL DEFAULT 'positive_inbound_reply_continuation'
    CHECK (authorization_basis = 'positive_inbound_reply_continuation'),
  permission_semantics TEXT NOT NULL DEFAULT 'reply_continuation_not_marketing_consent'
    CHECK (permission_semantics = 'reply_continuation_not_marketing_consent'),
  inbound_provider TEXT NOT NULL DEFAULT 'outlook_graph'
    CHECK (inbound_provider = 'outlook_graph'),
  graph_identifier_semantics TEXT NOT NULL DEFAULT 'case_sensitive_immutable'
    CHECK (graph_identifier_semantics = 'case_sensitive_immutable'),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  mailbox_object_id UUID NOT NULL,
  mailbox_address TEXT NOT NULL CHECK (
    mailbox_address = lower(btrim(mailbox_address))
    AND mailbox_address ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  inbound_message_id TEXT NOT NULL CHECK (NULLIF(btrim(inbound_message_id), '') IS NOT NULL),
  inbound_conversation_id TEXT NOT NULL CHECK (
    NULLIF(btrim(inbound_conversation_id), '') IS NOT NULL
  ),
  inbound_internet_message_id TEXT NOT NULL CHECK (
    NULLIF(btrim(inbound_internet_message_id), '') IS NOT NULL
  ),
  normalized_sender_hash TEXT NOT NULL CHECK (normalized_sender_hash ~ '^[0-9a-f]{64}$'),
  normalized_recipient_hash TEXT NOT NULL CHECK (normalized_recipient_hash ~ '^[0-9a-f]{64}$'),
  property_reference_key TEXT NOT NULL CHECK (
    NULLIF(btrim(property_reference_key), '') IS NOT NULL
    AND length(property_reference_key) <= 500
  ),
  purpose_key TEXT NOT NULL DEFAULT 'seller_reply_followup'
    CHECK (purpose_key = 'seller_reply_followup'),
  approved_content_fingerprint TEXT NOT NULL CHECK (
    approved_content_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  draft_version_key TEXT NOT NULL CHECK (
    draft_version_key ~ '^[a-z0-9][a-z0-9_.:-]{2,127}$'
  ),
  positive_classification TEXT NOT NULL DEFAULT 'hot_seller_lead'
    CHECK (positive_classification = 'hot_seller_lead'),
  positive_classification_evidence_fingerprint TEXT NOT NULL CHECK (
    positive_classification_evidence_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  authorized_reply_received_at TIMESTAMPTZ NOT NULL,
  local_timezone TEXT NOT NULL CHECK (NULLIF(btrim(local_timezone), '') IS NOT NULL),
  allowed_local_start TIME NOT NULL,
  allowed_local_end TIME NOT NULL,
  allowed_iso_weekdays SMALLINT[] NOT NULL CHECK (
    cardinality(allowed_iso_weekdays) BETWEEN 1 AND 5
    AND allowed_iso_weekdays <@ ARRAY[1,2,3,4,5]::SMALLINT[]
  ),
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
  CONSTRAINT inbound_reply_continuation_authorizations_time_check CHECK (
    expires_at > approved_at
    AND expires_at <= approved_at + INTERVAL '7 days'
    AND authorized_reply_received_at <= approved_at
    AND allowed_local_start < allowed_local_end
    AND allowed_local_start >= '10:30'::TIME
    AND allowed_local_end <= '16:30'::TIME
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

CREATE TABLE private.gate3d1_canary_dispatch_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_strategy_id UUID NOT NULL REFERENCES public.operating_strategies(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  operating_strategy_version_id UUID NOT NULL UNIQUE
    REFERENCES public.operating_strategy_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  authorization_id UUID NOT NULL UNIQUE
    REFERENCES private.inbound_reply_continuation_authorizations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  exchange_rbac_attestation_id UUID NOT NULL
    REFERENCES private.exchange_application_rbac_attestations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reply_memory_id UUID NOT NULL REFERENCES public.command_center_reply_memory(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel = 'outlook_graph'),
  approved_content_fingerprint TEXT NOT NULL CHECK (
    approved_content_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  draft_version_key TEXT NOT NULL CHECK (
    draft_version_key ~ '^[a-z0-9][a-z0-9_.:-]{2,127}$'
  ),
  reservation_idempotency_key TEXT NOT NULL UNIQUE CHECK (
    NULLIF(btrim(reservation_idempotency_key), '') IS NOT NULL
  ),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > claimed_at),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  claim_fingerprint TEXT NOT NULL CHECK (claim_fingerprint ~ '^[0-9a-f]{32}$'),
  consent_basis_snapshot_json JSONB NOT NULL CHECK (
    jsonb_typeof(consent_basis_snapshot_json) = 'object'
  ),
  CONSTRAINT gate3d1_canary_dispatch_claims_strategy_version_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE TABLE private.gate3d1_canary_dispatch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES private.gate3d1_canary_dispatch_claims(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'claimed',
    'reservation_bound',
    'intent_ready',
    'graph_draft_attempted',
    'graph_draft_created',
    'send_attempted',
    'accepted',
    'ambiguous',
    'reconciled_accepted',
    'reconciled_not_sent',
    'dead_lettered'
  )),
  reservation_id UUID REFERENCES public.operating_strategy_dispatch_reservations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  outbound_enrollment_id UUID REFERENCES public.command_center_outbound_enrollments(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  canonical_activity_id UUID REFERENCES public.operating_strategy_activities(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_draft_id_hash TEXT CHECK (
    provider_draft_id_hash IS NULL OR provider_draft_id_hash ~ '^[0-9a-f]{64}$'
  ),
  provider_conversation_id_hash TEXT CHECK (
    provider_conversation_id_hash IS NULL OR provider_conversation_id_hash ~ '^[0-9a-f]{64}$'
  ),
  provider_internet_message_id_hash TEXT CHECK (
    provider_internet_message_id_hash IS NULL
    OR provider_internet_message_id_hash ~ '^[0-9a-f]{64}$'
  ),
  provider_evidence_fingerprint TEXT CHECK (
    provider_evidence_fingerprint IS NULL
    OR provider_evidence_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('migration', 'service_role', 'founder')),
  actor_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason TEXT CHECK (reason IS NULL OR length(btrim(reason)) >= 12),
  writer_release TEXT NOT NULL CHECK (NULLIF(btrim(writer_release), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  event_fingerprint TEXT NOT NULL CHECK (event_fingerprint ~ '^[0-9a-f]{32}$'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (claim_id, sequence_number),
  UNIQUE (claim_id, event_type),
  CONSTRAINT gate3d1_canary_dispatch_events_actor_check CHECK (
    (actor_type = 'founder' AND actor_user_id IS NOT NULL)
    OR (actor_type <> 'founder' AND actor_user_id IS NULL)
  )
);

CREATE TABLE private.gate3d1_outbound_control_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_scope TEXT NOT NULL CHECK (control_scope IN ('global', 'strategy')),
  operating_strategy_id UUID REFERENCES public.operating_strategies(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  claim_id UUID REFERENCES private.gate3d1_canary_dispatch_claims(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  blocked_before BOOLEAN,
  blocked_after BOOLEAN NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 12),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('migration', 'service_role', 'founder')),
  actor_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  writer_release TEXT,
  evidence_fingerprint TEXT CHECK (
    evidence_fingerprint IS NULL OR evidence_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  event_fingerprint TEXT NOT NULL CHECK (event_fingerprint ~ '^[0-9a-f]{32}$'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT gate3d1_outbound_control_events_scope_check CHECK (
    (control_scope = 'global' AND operating_strategy_id IS NULL)
    OR (control_scope = 'strategy' AND operating_strategy_id IS NOT NULL)
  ),
  CONSTRAINT gate3d1_outbound_control_events_actor_check CHECK (
    (actor_type = 'founder' AND actor_user_id IS NOT NULL)
    OR (actor_type <> 'founder' AND actor_user_id IS NULL)
  )
);

CREATE INDEX gate3d1_canary_dispatch_events_latest_idx
  ON private.gate3d1_canary_dispatch_events(claim_id, sequence_number DESC);
CREATE INDEX gate3d1_outbound_control_events_scope_idx
  ON private.gate3d1_outbound_control_events(control_scope, operating_strategy_id, recorded_at DESC);

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
CREATE TRIGGER gate3d1_canary_dispatch_claims_append_only_guard
BEFORE UPDATE OR DELETE ON private.gate3d1_canary_dispatch_claims
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER gate3d1_canary_dispatch_claims_truncate_guard
BEFORE TRUNCATE ON private.gate3d1_canary_dispatch_claims
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER gate3d1_canary_dispatch_events_append_only_guard
BEFORE UPDATE OR DELETE ON private.gate3d1_canary_dispatch_events
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER gate3d1_canary_dispatch_events_truncate_guard
BEFORE TRUNCATE ON private.gate3d1_canary_dispatch_events
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER gate3d1_outbound_control_events_append_only_guard
BEFORE UPDATE OR DELETE ON private.gate3d1_outbound_control_events
FOR EACH ROW EXECUTE FUNCTION private.gate3c_reject_append_only_change();
CREATE TRIGGER gate3d1_outbound_control_events_truncate_guard
BEFORE TRUNCATE ON private.gate3d1_outbound_control_events
FOR EACH STATEMENT EXECUTE FUNCTION private.gate3c_reject_append_only_change();

ALTER TABLE private.inbound_reply_continuation_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_authorizations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_revocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.inbound_reply_continuation_revocations FORCE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_canary_dispatch_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_canary_dispatch_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_canary_dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_canary_dispatch_events FORCE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_outbound_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.gate3d1_outbound_control_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.inbound_reply_continuation_authorizations,
  private.inbound_reply_continuation_revocations,
  private.gate3d1_canary_dispatch_claims,
  private.gate3d1_canary_dispatch_events,
  private.gate3d1_outbound_control_events
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_current_claim_state(p_claim_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT event.event_type
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
  ORDER BY event.sequence_number DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_current_claim_state(UUID)
  FROM PUBLIC, anon, authenticated, service_role;

-- Recovery may inspect immutable state after the stop controls have engaged,
-- but it may not grant authority or mutate provider state. Raw mailbox/thread
-- identifiers remain confined to the separately guarded execution manifest;
-- this view returns only governed IDs and provider identity hashes.
CREATE OR REPLACE FUNCTION public.get_gate3d1_canary_dispatch_state(
  p_claim_id UUID,
  p_authorization_id UUID,
  p_writer_release TEXT
)
RETURNS TABLE (
  claim_id UUID,
  authorization_id UUID,
  operating_strategy_version_id UUID,
  dispatch_state TEXT,
  sequence_number INTEGER,
  reservation_id UUID,
  outbound_enrollment_id UUID,
  canonical_activity_id UUID,
  provider_draft_id_hash TEXT,
  provider_conversation_id_hash TEXT,
  provider_internet_message_id_hash TEXT,
  provider_evidence_fingerprint TEXT,
  claim_expires_at TIMESTAMPTZ,
  event_recorded_at TIMESTAMPTZ,
  global_stop_engaged BOOLEAN,
  strategy_stop_engaged BOOLEAN,
  automatic_provider_retry_allowed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  latest private.gate3d1_canary_dispatch_events;
  strategy_paused BOOLEAN;
  global_blocked BOOLEAN;
  resolved_reservation_id UUID;
  resolved_enrollment_id UUID;
  resolved_activity_id UUID;
  resolved_draft_hash TEXT;
  resolved_conversation_hash TEXT;
  resolved_internet_hash TEXT;
  resolved_evidence_hash TEXT;
BEGIN
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
    AND candidate.authorization_id = p_authorization_id
    AND candidate.writer_release = p_writer_release;
  IF claim.id IS NULL THEN
    RAISE EXCEPTION 'Exact Gate 3D.1 claim, authorization, and writer state was not found.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO latest
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id
  ORDER BY event.sequence_number DESC
  LIMIT 1;
  IF latest.id IS NULL THEN
    RAISE EXCEPTION 'Gate 3D.1 claim has no immutable state event.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.reservation_id INTO resolved_reservation_id
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.reservation_id IS NOT NULL
  ORDER BY event.sequence_number DESC LIMIT 1;
  SELECT event.outbound_enrollment_id, event.canonical_activity_id
    INTO resolved_enrollment_id, resolved_activity_id
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id
    AND event.outbound_enrollment_id IS NOT NULL
    AND event.canonical_activity_id IS NOT NULL
  ORDER BY event.sequence_number DESC LIMIT 1;
  SELECT event.provider_draft_id_hash, event.provider_conversation_id_hash,
      event.provider_internet_message_id_hash
    INTO resolved_draft_hash, resolved_conversation_hash, resolved_internet_hash
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.provider_draft_id_hash IS NOT NULL
  ORDER BY event.sequence_number DESC LIMIT 1;
  SELECT event.provider_evidence_fingerprint INTO resolved_evidence_hash
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id
    AND event.provider_evidence_fingerprint IS NOT NULL
  ORDER BY event.sequence_number DESC LIMIT 1;
  SELECT controls.outbound_kill_switch INTO global_blocked
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  SELECT controls.paused INTO strategy_paused
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = claim.operating_strategy_id;
  RETURN QUERY SELECT
    claim.id, claim.authorization_id, claim.operating_strategy_version_id,
    latest.event_type, latest.sequence_number, resolved_reservation_id,
    resolved_enrollment_id, resolved_activity_id, resolved_draft_hash,
    resolved_conversation_hash, resolved_internet_hash, resolved_evidence_hash,
    claim.expires_at, latest.recorded_at, COALESCE(global_blocked, TRUE),
    COALESCE(strategy_paused, TRUE),
    latest.event_type IN ('claimed', 'reservation_bound', 'intent_ready', 'graph_draft_created');
END;
$$;

REVOKE ALL ON FUNCTION public.get_gate3d1_canary_dispatch_state(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gate3d1_canary_dispatch_state(UUID, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_assert_open_canary_controls(
  p_operating_strategy_version_id UUID,
  p_writer_release TEXT
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  candidate public.operating_strategy_versions;
  strategy_control public.operating_strategy_outbound_controls;
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
    OR runtime_control.outbound_control_writer_release IS DISTINCT FROM p_writer_release
    OR runtime_control.outbound_kill_switch THEN
    RAISE EXCEPTION 'The selected canary is blocked by posture, writer release, or global kill switch.'
      USING ERRCODE = '23514';
  END IF;

  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_operating_strategy_version_id
  FOR SHARE;
  IF candidate.id IS NULL
    OR candidate.status <> 'active'
    OR candidate.execution_mode <> 'approved_live'
    OR candidate.external_send_cap <> 1
    OR candidate.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application'
    OR candidate.contract_json -> 'activationReadiness' ->> 'status' <> 'ready' THEN
    RAISE EXCEPTION 'The selected canary is not the active ready cap-one application version.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO strategy_control
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = candidate.operating_strategy_id
  FOR SHARE;
  IF strategy_control.operating_strategy_id IS NULL
    OR strategy_control.paused
    OR strategy_control.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'The selected canary strategy remains paused or has a mismatched writer.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_assert_open_canary_controls(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_assert_continuation_safe(
  p_authorization_id UUID,
  p_check_quiet_hours BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  authz private.inbound_reply_continuation_authorizations;
  reply_memory public.command_center_reply_memory;
  lead_record public.leads;
  outreach_record public.outreach_messages;
  local_dispatch_time TIMESTAMP;
BEGIN
  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = p_authorization_id;
  IF authz.id IS NULL
    OR authz.expires_at <= statement_timestamp()
    OR EXISTS (
      SELECT 1
      FROM private.inbound_reply_continuation_revocations revocation
      WHERE revocation.authorization_id = authz.id
    ) THEN
    RAISE EXCEPTION 'The exact continuation authorization is missing, expired, or revoked.'
      USING ERRCODE = '23514';
  END IF;

  SELECT memory.* INTO reply_memory
  FROM public.command_center_reply_memory memory
  WHERE memory.id = authz.reply_memory_id;
  IF reply_memory.id IS NULL
    OR reply_memory.lead_id IS DISTINCT FROM authz.lead_id
    OR reply_memory.classification <> 'hot_seller_lead'
    OR reply_memory.mailbox IS DISTINCT FROM authz.mailbox_address
    OR reply_memory.message_id IS DISTINCT FROM authz.inbound_message_id
    OR reply_memory.thread_id IS DISTINCT FROM authz.inbound_conversation_id
    OR reply_memory.metadata_json ->> 'internetMessageId'
      IS DISTINCT FROM authz.inbound_internet_message_id
    OR lower(btrim(COALESCE(
      reply_memory.metadata_json ->> 'observedTenantId', ''
    ))) IS DISTINCT FROM authz.tenant_id::TEXT
    OR lower(btrim(COALESCE(
      reply_memory.metadata_json ->> 'observedMailboxObjectId', ''
    ))) IS DISTINCT FROM authz.mailbox_object_id::TEXT
    OR NULLIF(btrim(reply_memory.reply_summary), '') IS NULL
    OR lower(btrim(reply_memory.reply_summary)) = ANY(ARRAY[
      '-', '--', '.', 'n/a', 'na', 'none', 'null', 'unknown', 'pending',
      'placeholder', '[placeholder]', 'test', 'sample', 'todo', 'tbd',
      'not provided', 'not available', 'no summary', 'no reply summary',
      'no response', 'no message preview was returned by outlook.', 'lorem ipsum'
    ]::TEXT[])
    OR private.gate3d1_sha256_text(reply_memory.reply_summary)
      IS DISTINCT FROM authz.positive_classification_evidence_fingerprint
    OR (
      NULLIF(btrim(reply_memory.property_address), '') IS NOT NULL
      AND btrim(reply_memory.property_address) IS DISTINCT FROM authz.property_reference_key
    )
    OR private.gate3d1_sha256_text(lower(btrim(COALESCE(reply_memory.from_email, ''))))
      IS DISTINCT FROM authz.normalized_sender_hash
    OR private.gate3d1_sha256_text(lower(btrim(COALESCE(reply_memory.to_email, ''))))
      IS DISTINCT FROM authz.normalized_recipient_hash
    OR reply_memory.received_at IS DISTINCT FROM authz.authorized_reply_received_at
    OR reply_memory.metadata_json -> 'explicitOptOut' IS NOT DISTINCT FROM 'true'::JSONB THEN
    RAISE EXCEPTION 'The immutable positive inbound reply evidence is missing, changed, or opted out.'
      USING ERRCODE = '23514';
  END IF;

  SELECT lead.* INTO lead_record
  FROM public.leads lead
  WHERE lead.id = authz.lead_id;
  SELECT message.* INTO outreach_record
  FROM public.outreach_messages message
  WHERE message.id = authz.outreach_message_id;
  IF lead_record.id IS NULL
    OR NULLIF(btrim(lead_record.email), '') IS NULL
    OR private.gate3d1_sha256_text(lower(btrim(lead_record.email)))
      IS DISTINCT FROM authz.normalized_sender_hash
    OR NULLIF(btrim(lead_record.property_address), '') IS NULL
    OR btrim(lead_record.property_address) IS DISTINCT FROM authz.property_reference_key
    OR outreach_record.id IS NULL
    OR outreach_record.lead_id IS DISTINCT FROM authz.lead_id
    OR outreach_record.channel <> 'email'
    OR outreach_record.status <> 'approved'
    OR outreach_record.variant_key IS DISTINCT FROM authz.draft_version_key
    OR outreach_record.approved_by_user_id IS DISTINCT FROM authz.approved_by_user_id
    OR outreach_record.approved_at IS NULL
    OR private.gate3d1_sha256_text(
      private.gate3d1_canonical_authored_body(outreach_record.body)
    )
      IS DISTINCT FROM authz.approved_content_fingerprint THEN
    RAISE EXCEPTION 'Canonical lead property or founder-approved outreach content changed after authorization.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.command_center_reply_memory newer
    WHERE newer.mailbox = reply_memory.mailbox
      AND newer.thread_id = reply_memory.thread_id
      AND newer.lead_id = reply_memory.lead_id
      AND (newer.received_at, newer.id) > (reply_memory.received_at, reply_memory.id)
  ) THEN
    RAISE EXCEPTION 'A newer inbound reply requires a new founder review before continuation.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.lead_suppressions suppression
    WHERE suppression.status = 'active'
      AND suppression.email IS NOT NULL
      AND lower(btrim(suppression.email)) = lower(btrim(reply_memory.from_email))
  ) OR lower(COALESCE(lead_record.status, ''))
      IN ('bounced', 'complained', 'suppressed', 'do_not_contact', 'failed')
    OR lower(COALESCE(lead_record.outreach_status, ''))
      IN ('bounced', 'complained', 'suppressed', 'do_not_contact', 'failed')
    OR lower(COALESCE(lead_record.delivery_status, ''))
      IN ('bounced', 'complained', 'suppressed', 'do_not_contact', 'failed')
    OR NULLIF(btrim(lead_record.suppression_reason), '') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.command_center_outbound_enrollments enrollment
      WHERE enrollment.lead_id = authz.lead_id
        AND enrollment.created_at > authz.approved_at
        AND (
          lower(enrollment.status) IN ('bounced', 'complained', 'suppressed', 'do_not_contact', 'failed')
          OR NULLIF(btrim(enrollment.suppression_reason), '') IS NOT NULL
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.outreach_send_events send_event
      WHERE send_event.lead_id = authz.lead_id
        AND send_event.created_at > authz.approved_at
        AND (
          lower(send_event.status) IN ('bounced', 'complained', 'suppressed', 'do_not_contact', 'failed')
          OR lower(COALESCE(send_event.metadata_json ->> 'deliveryStatus', ''))
            IN ('bounced', 'complained', 'suppressed', 'do_not_contact')
          OR lower(COALESCE(send_event.metadata_json ->> 'eventType', ''))
            IN ('bounce', 'bounced', 'complaint', 'complained', 'suppressed')
        )
    ) THEN
    RAISE EXCEPTION 'The continuation recipient is suppressed.' USING ERRCODE = '23514';
  END IF;

  IF p_check_quiet_hours THEN
    local_dispatch_time :=
      private.gate3d1_dispatch_evaluation_time() AT TIME ZONE authz.local_timezone;
    IF NOT (EXTRACT(ISODOW FROM local_dispatch_time)::SMALLINT = ANY(authz.allowed_iso_weekdays))
      OR local_dispatch_time::TIME < authz.allowed_local_start
      OR local_dispatch_time::TIME >= authz.allowed_local_end THEN
      RAISE EXCEPTION 'The continuation is outside the founder-approved local dispatch window.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_assert_continuation_safe(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.gate3d1_record_runtime_control_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim_value TEXT := NULLIF(current_setting('gate3d1.control_event_claim_id', TRUE), '');
  event_claim_id UUID;
  event_actor_type TEXT;
  event_actor_user_id UUID;
  event_evidence_fingerprint TEXT :=
    NULLIF(current_setting('gate3d1.control_event_evidence_fingerprint', TRUE), '');
  event_fingerprint TEXT;
BEGIN
  IF NEW.outbound_kill_switch IS NOT DISTINCT FROM OLD.outbound_kill_switch
    AND NEW.outbound_control_reason IS NOT DISTINCT FROM OLD.outbound_control_reason
    AND NEW.outbound_control_writer_release IS NOT DISTINCT FROM OLD.outbound_control_writer_release
    AND NEW.outbound_control_updated_by_user_id IS NOT DISTINCT FROM OLD.outbound_control_updated_by_user_id THEN
    RETURN NEW;
  END IF;
  IF claim_value IS NOT NULL THEN event_claim_id := claim_value::UUID; END IF;
  IF auth.uid() IS NOT NULL
    AND auth.uid() IS NOT DISTINCT FROM NEW.outbound_control_updated_by_user_id THEN
    event_actor_type := 'founder';
    event_actor_user_id := auth.uid();
  ELSE
    event_actor_type := 'service_role';
    event_actor_user_id := NULL;
  END IF;
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'scope', 'global',
    'claimId', event_claim_id,
    'blockedBefore', OLD.outbound_kill_switch,
    'blockedAfter', NEW.outbound_kill_switch,
    'reason', NEW.outbound_control_reason,
    'actorType', event_actor_type,
    'actorUserId', event_actor_user_id,
    'writerRelease', NEW.outbound_control_writer_release,
    'evidenceFingerprint', event_evidence_fingerprint,
    'recordedAt', NEW.outbound_control_updated_at
  ));
  INSERT INTO private.gate3d1_outbound_control_events(
    control_scope, claim_id, blocked_before, blocked_after, reason,
    actor_type, actor_user_id, writer_release, evidence_fingerprint,
    event_fingerprint, recorded_at
  ) VALUES (
    'global', event_claim_id, OLD.outbound_kill_switch, NEW.outbound_kill_switch,
    NEW.outbound_control_reason, event_actor_type, event_actor_user_id,
    NEW.outbound_control_writer_release, event_evidence_fingerprint,
    event_fingerprint, NEW.outbound_control_updated_at
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.gate3d1_record_strategy_control_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim_value TEXT := NULLIF(current_setting('gate3d1.control_event_claim_id', TRUE), '');
  event_claim_id UUID;
  event_actor_type TEXT;
  event_actor_user_id UUID;
  event_evidence_fingerprint TEXT :=
    NULLIF(current_setting('gate3d1.control_event_evidence_fingerprint', TRUE), '');
  event_fingerprint TEXT;
BEGIN
  IF NEW.paused IS NOT DISTINCT FROM OLD.paused
    AND NEW.pause_reason IS NOT DISTINCT FROM OLD.pause_reason
    AND NEW.writer_release IS NOT DISTINCT FROM OLD.writer_release
    AND NEW.updated_by_user_id IS NOT DISTINCT FROM OLD.updated_by_user_id THEN
    RETURN NEW;
  END IF;
  IF claim_value IS NOT NULL THEN event_claim_id := claim_value::UUID; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS NOT DISTINCT FROM NEW.updated_by_user_id THEN
    event_actor_type := 'founder';
    event_actor_user_id := auth.uid();
  ELSE
    event_actor_type := 'service_role';
    event_actor_user_id := NULL;
  END IF;
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'scope', 'strategy',
    'operatingStrategyId', NEW.operating_strategy_id,
    'claimId', event_claim_id,
    'blockedBefore', OLD.paused,
    'blockedAfter', NEW.paused,
    'reason', NEW.pause_reason,
    'actorType', event_actor_type,
    'actorUserId', event_actor_user_id,
    'writerRelease', NEW.writer_release,
    'evidenceFingerprint', event_evidence_fingerprint,
    'recordedAt', NEW.updated_at
  ));
  INSERT INTO private.gate3d1_outbound_control_events(
    control_scope, operating_strategy_id, claim_id, blocked_before, blocked_after,
    reason, actor_type, actor_user_id, writer_release, evidence_fingerprint,
    event_fingerprint, recorded_at
  ) VALUES (
    'strategy', NEW.operating_strategy_id, event_claim_id, OLD.paused, NEW.paused,
    NEW.pause_reason, event_actor_type, event_actor_user_id, NEW.writer_release,
    event_evidence_fingerprint, event_fingerprint, NEW.updated_at
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_record_runtime_control_transition()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.gate3d1_record_strategy_control_transition()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER operating_strategy_runtime_controls_gate3d1_transition_audit
AFTER UPDATE OF outbound_kill_switch, outbound_control_reason,
  outbound_control_writer_release, outbound_control_updated_by_user_id
ON public.operating_strategy_runtime_controls
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_record_runtime_control_transition();

CREATE TRIGGER operating_strategy_outbound_controls_gate3d1_transition_audit
AFTER UPDATE OF paused, pause_reason, writer_release, updated_by_user_id
ON public.operating_strategy_outbound_controls
FOR EACH ROW EXECUTE FUNCTION private.gate3d1_record_strategy_control_transition();

INSERT INTO private.gate3d1_outbound_control_events(
  control_scope, blocked_before, blocked_after, reason, actor_type,
  writer_release, event_fingerprint, recorded_at
)
SELECT
  'global', NULL, controls.outbound_kill_switch, controls.outbound_control_reason,
  'migration', controls.outbound_control_writer_release,
  private.gate3c_canonical_fingerprint(jsonb_build_object(
    'scope', 'global',
    'blockedBefore', NULL,
    'blockedAfter', controls.outbound_kill_switch,
    'reason', controls.outbound_control_reason,
    'actorType', 'migration',
    'writerRelease', controls.outbound_control_writer_release,
    'recordedAt', controls.outbound_control_updated_at
  )),
  controls.outbound_control_updated_at
FROM public.operating_strategy_runtime_controls controls
WHERE controls.control_key = 'canonical_binding';

INSERT INTO private.gate3d1_outbound_control_events(
  control_scope, operating_strategy_id, blocked_before, blocked_after, reason,
  actor_type, writer_release, event_fingerprint, recorded_at
)
SELECT
  'strategy', controls.operating_strategy_id, NULL, controls.paused,
  controls.pause_reason, 'migration', controls.writer_release,
  private.gate3c_canonical_fingerprint(jsonb_build_object(
    'scope', 'strategy',
    'operatingStrategyId', controls.operating_strategy_id,
    'blockedBefore', NULL,
    'blockedAfter', controls.paused,
    'reason', controls.pause_reason,
    'actorType', 'migration',
    'writerRelease', controls.writer_release,
    'recordedAt', controls.updated_at
  )),
  controls.updated_at
FROM public.operating_strategy_outbound_controls controls;

CREATE OR REPLACE FUNCTION private.gate3d1_engage_stops(
  p_claim_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  runtime_control public.operating_strategy_runtime_controls;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) < 12 THEN
    RAISE EXCEPTION 'A durable stop reason is required.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL THEN
    RAISE EXCEPTION 'Canary dispatch claim not found.' USING ERRCODE = '23514';
  END IF;
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding'
  FOR UPDATE;
  PERFORM set_config('gate3d1.control_event_claim_id', claim.id::TEXT, TRUE);
  UPDATE public.operating_strategy_runtime_controls
  SET outbound_kill_switch = TRUE,
      outbound_control_reason = btrim(p_reason),
      outbound_control_writer_release = claim.writer_release,
      outbound_control_updated_by_user_id = runtime_control.canary_approved_by_user_id,
      outbound_control_updated_at = statement_timestamp()
  WHERE control_key = 'canonical_binding';
  UPDATE public.operating_strategy_outbound_controls
  SET paused = TRUE,
      pause_reason = btrim(p_reason),
      writer_release = claim.writer_release,
      updated_by_user_id = runtime_control.canary_approved_by_user_id,
      updated_at = statement_timestamp()
  WHERE operating_strategy_id = claim.operating_strategy_id;
END;
$$;

REVOKE ALL ON FUNCTION private.gate3d1_engage_stops(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.engage_gate3d1_canary_stop(
  p_operating_strategy_version_id UUID,
  p_writer_release TEXT,
  p_reason TEXT,
  p_evidence_fingerprint TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  candidate public.operating_strategy_versions;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) < 20
    OR lower(COALESCE(p_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Emergency stop requires a reason, SHA-256 evidence, and idempotency key.'
      USING ERRCODE = '23514';
  END IF;
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding'
  FOR UPDATE;
  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_operating_strategy_version_id;
  IF candidate.id IS NULL
    OR runtime_control.canary_enforcement_status <> 'reviewed_cap_one'
    OR runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id
    OR runtime_control.canary_required_writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Emergency stop must target the exact selected canary and writer.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM set_config('gate3d1.control_event_claim_id', '', TRUE);
  PERFORM set_config(
    'gate3d1.control_event_evidence_fingerprint',
    lower(p_evidence_fingerprint),
    TRUE
  );
  UPDATE public.operating_strategy_runtime_controls
  SET outbound_kill_switch = TRUE,
      outbound_control_reason = btrim(p_reason),
      outbound_control_writer_release = p_writer_release,
      outbound_control_updated_by_user_id = runtime_control.canary_approved_by_user_id,
      outbound_control_updated_at = statement_timestamp()
  WHERE control_key = 'canonical_binding'
    AND (
      NOT outbound_kill_switch
      OR outbound_control_reason IS DISTINCT FROM btrim(p_reason)
    );
  UPDATE public.operating_strategy_outbound_controls
  SET paused = TRUE,
      pause_reason = btrim(p_reason),
      writer_release = p_writer_release,
      updated_by_user_id = runtime_control.canary_approved_by_user_id,
      updated_at = statement_timestamp()
  WHERE operating_strategy_id = candidate.operating_strategy_id
    AND (NOT paused OR pause_reason IS DISTINCT FROM btrim(p_reason));
  RETURN jsonb_build_object(
    'operatingStrategyVersionId', candidate.id,
    'blocked', TRUE,
    'evidenceFingerprint', lower(p_evidence_fingerprint),
    'idempotencyKey', p_idempotency_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.engage_gate3d1_canary_stop(
  UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engage_gate3d1_canary_stop(
  UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_exchange_application_rbac_attestation(
  p_tenant_id UUID,
  p_client_id UUID,
  p_mailbox_object_id UUID,
  p_out_of_scope_mailbox_object_id UUID,
  p_mailbox_address TEXT,
  p_rbac_role_set_json JSONB,
  p_in_scope_proof_fingerprint TEXT,
  p_out_of_scope_deny_proof_fingerprint TEXT,
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
  runtime_control public.operating_strategy_runtime_controls;
  normalized_roles JSONB;
  existing_attestation private.exchange_application_rbac_attestations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  SELECT COALESCE(jsonb_agg(role_name ORDER BY role_name), '[]'::JSONB)
    INTO normalized_roles
  FROM (
    SELECT DISTINCT btrim(role.value #>> '{}') AS role_name
    FROM jsonb_array_elements(COALESCE(p_rbac_role_set_json, '[]'::JSONB)) role(value)
    WHERE jsonb_typeof(role.value) = 'string'
      AND NULLIF(btrim(role.value #>> '{}'), '') IS NOT NULL
  ) normalized;
  IF normalized_roles IS DISTINCT FROM
      '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB
    OR p_out_of_scope_mailbox_object_id IS NULL
    OR p_out_of_scope_mailbox_object_id = p_mailbox_object_id
    OR lower(btrim(COALESCE(p_mailbox_address, '')))
      !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR lower(COALESCE(p_in_scope_proof_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_out_of_scope_deny_proof_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR lower(p_in_scope_proof_fingerprint)
      = lower(p_out_of_scope_deny_proof_fingerprint)
    OR length(btrim(COALESCE(p_rationale, ''))) < 20
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Exact two-role Exchange RBAC, separated mailbox scope, dual SHA-256 proofs, and founder rationale are required.'
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
  SELECT proof.* INTO existing_attestation
  FROM private.exchange_application_rbac_attestations proof
  WHERE proof.idempotency_key = p_idempotency_key;
  result_id := COALESCE(existing_attestation.id, gen_random_uuid());
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'attestationId', result_id,
    'tenantId', p_tenant_id,
    'clientId', p_client_id,
    'mailboxObjectId', p_mailbox_object_id,
    'outOfScopeMailboxObjectId', p_out_of_scope_mailbox_object_id,
    'mailboxAddress', lower(btrim(p_mailbox_address)),
    'rbacRoleSet', normalized_roles,
    'inScopeAuthorized', TRUE,
    'inScopeProofFingerprint', lower(p_in_scope_proof_fingerprint),
    'outOfScopeDenied', TRUE,
    'outOfScopeDenyProofFingerprint', lower(p_out_of_scope_deny_proof_fingerprint),
    'recordedByUserId', p_actor_user_id,
    'expiresAt', p_expires_at,
    'rationale', btrim(p_rationale),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  IF existing_attestation.id IS NOT NULL THEN
    IF existing_attestation.attestation_fingerprint IS DISTINCT FROM result_fingerprint THEN
      RAISE EXCEPTION 'RBAC attestation replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_attestation.id;
  END IF;
  INSERT INTO private.exchange_application_rbac_attestations(
    id, tenant_id, client_id, mailbox_object_id, out_of_scope_mailbox_object_id,
    mailbox_address, rbac_role_set_json, in_scope_authorized,
    in_scope_test_fingerprint, out_of_scope_denied,
    out_of_scope_test_fingerprint, recorded_by_user_id, expires_at, rationale,
    writer_release, idempotency_key, attestation_fingerprint
  ) VALUES (
    result_id, p_tenant_id, p_client_id, p_mailbox_object_id,
    p_out_of_scope_mailbox_object_id, lower(btrim(p_mailbox_address)),
    normalized_roles, TRUE, lower(p_in_scope_proof_fingerprint), TRUE,
    lower(p_out_of_scope_deny_proof_fingerprint), p_actor_user_id, p_expires_at,
    btrim(p_rationale), p_writer_release, p_idempotency_key, result_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_exchange_application_rbac_attestation(
  UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_exchange_application_rbac_attestation(
  UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_gate3d1_graph_rbac_attestation_current(
  p_tenant_id UUID,
  p_client_id UUID,
  p_mailbox_object_id UUID,
  p_mailbox_address TEXT
)
RETURNS TABLE (
  attestation_id UUID,
  tenant_id UUID,
  client_id UUID,
  mailbox_object_id UUID,
  mailbox_address TEXT,
  rbac_role_set_json JSONB,
  rbac_roles TEXT[],
  out_of_scope_mailbox_object_id UUID,
  founder_reviewer_user_id UUID,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  in_scope_proof_fingerprint TEXT,
  out_of_scope_deny_proof_fingerprint TEXT,
  attestation_fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT proof.id, proof.tenant_id, proof.client_id, proof.mailbox_object_id,
    proof.mailbox_address, proof.rbac_role_set_json,
    ARRAY(
      SELECT jsonb_array_elements_text(proof.rbac_role_set_json)
      ORDER BY 1
    )::TEXT[],
    proof.out_of_scope_mailbox_object_id, proof.recorded_by_user_id,
    proof.recorded_at, proof.expires_at, proof.in_scope_test_fingerprint,
    proof.out_of_scope_test_fingerprint, proof.attestation_fingerprint
  FROM private.exchange_application_rbac_attestations proof
  JOIN public.operating_strategy_runtime_controls runtime_control
    ON runtime_control.control_key = 'canonical_binding'
  WHERE proof.tenant_id = p_tenant_id
    AND proof.client_id = p_client_id
    AND proof.mailbox_object_id = p_mailbox_object_id
    AND proof.mailbox_address = lower(btrim(p_mailbox_address))
    AND proof.rbac_role_set_json =
      '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB
    AND proof.in_scope_authorized
    AND proof.out_of_scope_denied
    AND proof.out_of_scope_mailbox_object_id <> proof.mailbox_object_id
    AND proof.expires_at > statement_timestamp()
    AND proof.writer_release = runtime_control.canary_required_writer_release
    AND runtime_control.canary_enforcement_status = 'reviewed_cap_one'
    AND NOT EXISTS (
      SELECT 1
      FROM private.exchange_application_rbac_attestation_revocations revocation
      WHERE revocation.attestation_id = proof.id
    )
    AND EXISTS (
      SELECT 1
      FROM public.operating_strategy_reviewer_authorities authority
      WHERE authority.user_id = proof.recorded_by_user_id
        AND authority.authority_role = 'founder_reviewer'
        AND authority.can_activate_operating_versions
        AND authority.valid_from <= statement_timestamp()
        AND (authority.valid_to IS NULL OR authority.valid_to > statement_timestamp())
    )
  ORDER BY proof.recorded_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact current Gate 3D.1 Graph RBAC attestation is missing, expired, revoked, or mismatched.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_gate3d1_graph_rbac_attestation_current(
  UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_gate3d1_graph_rbac_attestation_current(
  UUID, UUID, UUID, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.stage_gate3d1_canary_review(
  p_operating_strategy_version_id UUID,
  p_expected_operating_contract_fingerprint TEXT,
  p_actor_user_id UUID,
  p_writer_release TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  candidate public.operating_strategy_versions;
  strategy_key TEXT;
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  IF p_expected_operating_contract_fingerprint
      IS DISTINCT FROM 'b321ad591bffc099f3197a84c5c38028'
    OR p_writer_release IS DISTINCT FROM 'gate3d1_graph_reply_v1'
    OR length(btrim(COALESCE(p_reason, ''))) < 20 THEN
    RAISE EXCEPTION 'Canary staging requires the frozen candidate fingerprint, exact Graph writer, and founder reason.'
      USING ERRCODE = '23514';
  END IF;
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding'
  FOR UPDATE;
  SELECT version.* INTO candidate
  FROM public.operating_strategy_versions version
  WHERE version.id = p_operating_strategy_version_id
  FOR SHARE;
  SELECT strategy.strategy_key INTO strategy_key
  FROM public.operating_strategies strategy
  WHERE strategy.id = candidate.operating_strategy_id;
  IF candidate.id IS NULL
    OR strategy_key <> 'seller_options_intake'
    OR candidate.status <> 'draft'
    OR candidate.execution_mode <> 'approved_live'
    OR candidate.external_send_cap <> 1
    OR candidate.owner_contract_json ->> 'dispatchAuthority' <> 'vestblock_application'
    OR candidate.contract_json #>> '{activationReadiness,status}' <> 'ready'
    OR jsonb_array_length(COALESCE(
      candidate.contract_json #> '{activationReadiness,blockers}', '[]'::JSONB
    )) <> 0
    OR candidate.contract_json #>> '{canaryScope,manifestKey}'
      <> 'gate3d1-seller-positive-inbound-reply-v1'
    OR candidate.contract_json #>> '{canaryScope,purpose}' <> 'seller_reply_followup'
    OR candidate.contract_json #>> '{canaryScope,provider}' <> 'outlook_graph'
    OR candidate.contract_json #>> '{canaryScope,writerRelease}'
      <> 'gate3d1_graph_reply_v1'
    OR candidate.contract_json #>> '{canaryScope,maximumLifetimeRecipients}' <> '1'
    OR candidate.contract_json #>> '{canaryScope,maximumLifetimeSends}' <> '1'
    OR candidate.contract_json #>> '{canaryScope,providerFallbackAllowed}' <> 'false'
    OR candidate.contract_json #>> '{canaryScope,newThreadAllowed}' <> 'false'
    OR candidate.contract_json #>> '{canaryScope,automaticSequenceAllowed}' <> 'false'
    OR private.gate3b_operating_contract_fingerprint(candidate)
      IS DISTINCT FROM p_expected_operating_contract_fingerprint THEN
    RAISE EXCEPTION 'Only the exact prepared seller same-thread cap-one draft may enter canary review.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT runtime_control.outbound_kill_switch
    OR EXISTS (SELECT 1 FROM public.operating_strategy_outbound_controls WHERE NOT paused)
    OR EXISTS (SELECT 1 FROM public.operating_strategy_versions WHERE status = 'active')
    OR EXISTS (SELECT 1 FROM public.operating_strategy_dispatch_reservations)
    OR EXISTS (SELECT 1 FROM private.gate3d1_canary_dispatch_claims) THEN
    RAISE EXCEPTION 'Canary review can be staged only while every stop is engaged and no activation or claim exists.'
      USING ERRCODE = '23514';
  END IF;
  IF runtime_control.canary_enforcement_status = 'reviewed_cap_one' THEN
    IF runtime_control.canary_operating_strategy_version_id
        IS DISTINCT FROM candidate.id
      OR runtime_control.canary_required_writer_release IS DISTINCT FROM p_writer_release
      OR runtime_control.canary_approved_by_user_id IS DISTINCT FROM p_actor_user_id THEN
      RAISE EXCEPTION 'A different immutable canary review is already staged.'
        USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'operatingStrategyVersionId', candidate.id,
      'canaryEnforcementStatus', 'reviewed_cap_one',
      'writerRelease', p_writer_release,
      'blocked', TRUE
    );
  END IF;
  IF runtime_control.canary_enforcement_status <> 'disabled'
    OR runtime_control.enforcement_mode <> 'compatibility'
    OR runtime_control.required_writer_release IS NOT NULL THEN
    RAISE EXCEPTION 'The runtime watermark is not eligible for selective canary review.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.operating_strategy_runtime_controls
  SET schema_status = 'app_deployed_pending_cutover',
      app_release_status = 'deployed_compatibility',
      canary_enforcement_status = 'reviewed_cap_one',
      canary_operating_strategy_version_id = candidate.id,
      canary_required_writer_release = p_writer_release,
      canary_approved_by_user_id = p_actor_user_id,
      canary_approved_at = statement_timestamp(),
      outbound_kill_switch = TRUE,
      outbound_control_reason = btrim(p_reason),
      outbound_control_writer_release = p_writer_release,
      outbound_control_updated_by_user_id = p_actor_user_id,
      outbound_control_updated_at = statement_timestamp(),
      updated_at = statement_timestamp()
  WHERE control_key = 'canonical_binding';
  RETURN jsonb_build_object(
    'operatingStrategyVersionId', candidate.id,
    'canaryEnforcementStatus', 'reviewed_cap_one',
    'writerRelease', p_writer_release,
    'blocked', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stage_gate3d1_canary_review(
  UUID, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.stage_gate3d1_canary_review(
  UUID, TEXT, UUID, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_inbound_reply_continuation_authorization(
  p_operating_strategy_version_id UUID,
  p_lead_id UUID,
  p_reply_memory_id UUID,
  p_outreach_message_id UUID,
  p_exchange_rbac_attestation_id UUID,
  p_tenant_id UUID,
  p_client_id UUID,
  p_mailbox_object_id UUID,
  p_mailbox_address TEXT,
  p_inbound_message_id TEXT,
  p_inbound_conversation_id TEXT,
  p_inbound_internet_message_id TEXT,
  p_normalized_sender_hash TEXT,
  p_normalized_recipient_hash TEXT,
  p_property_reference_key TEXT,
  p_purpose_key TEXT,
  p_approved_content_fingerprint TEXT,
  p_draft_version_key TEXT,
  p_positive_classification_evidence_fingerprint TEXT,
  p_local_timezone TEXT,
  p_allowed_local_start TIME,
  p_allowed_local_end TIME,
  p_allowed_iso_weekdays SMALLINT[],
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
  runtime_control public.operating_strategy_runtime_controls;
  version public.operating_strategy_versions;
  reply_memory public.command_center_reply_memory;
  lead_record public.leads;
  outreach_record public.outreach_messages;
  attestation private.exchange_application_rbac_attestations;
  existing_authz private.inbound_reply_continuation_authorizations;
  normalized_weekdays SMALLINT[];
  result_id UUID;
  result_fingerprint TEXT;
  resolved_positive_evidence_fingerprint TEXT;
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  IF p_purpose_key IS DISTINCT FROM 'seller_reply_followup'
    OR lower(COALESCE(p_normalized_sender_hash, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_normalized_recipient_hash, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_approved_content_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_positive_classification_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR COALESCE(p_draft_version_key, '') !~ '^[a-z0-9][a-z0-9_.:-]{2,127}$'
    OR length(btrim(COALESCE(p_rationale, ''))) < 20
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL
    OR NULLIF(btrim(p_property_reference_key), '') IS NULL
    OR NULLIF(btrim(p_inbound_message_id), '') IS NULL
    OR NULLIF(btrim(p_inbound_conversation_id), '') IS NULL
    OR NULLIF(btrim(p_inbound_internet_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'Exact positive-reply, content, purpose, property, and review evidence are required.'
      USING ERRCODE = '23514';
  END IF;
  IF p_allowed_local_start IS NULL
    OR p_allowed_local_end IS NULL
    OR p_allowed_local_start >= p_allowed_local_end
    OR p_allowed_local_start < '10:30'::TIME
    OR p_allowed_local_end > '16:30'::TIME
    OR NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names zone
      WHERE zone.name = p_local_timezone
    ) THEN
    RAISE EXCEPTION 'A valid non-overnight IANA local dispatch window is required.'
      USING ERRCODE = '23514';
  END IF;
  SELECT pg_catalog.array_agg(day_value ORDER BY day_value)
    INTO normalized_weekdays
  FROM (
    SELECT DISTINCT value::SMALLINT AS day_value
    FROM pg_catalog.unnest(COALESCE(p_allowed_iso_weekdays, ARRAY[]::SMALLINT[])) value
    WHERE value BETWEEN 1 AND 5
  ) days;
  IF normalized_weekdays IS NULL
    OR normalized_weekdays IS DISTINCT FROM p_allowed_iso_weekdays THEN
    RAISE EXCEPTION 'Allowed ISO weekdays must be a unique sorted weekday subset of 1 through 5.'
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
    RAISE EXCEPTION 'Continuation review requires the exact founder-reviewed selective canary.'
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
    RAISE EXCEPTION 'Continuation review requires the founder-approved active cap-one version.'
      USING ERRCODE = '23514';
  END IF;

  SELECT memory.* INTO reply_memory
  FROM public.command_center_reply_memory memory
  WHERE memory.id = p_reply_memory_id;
  resolved_positive_evidence_fingerprint :=
    private.gate3d1_sha256_text(reply_memory.reply_summary);
  IF reply_memory.id IS NULL
    OR reply_memory.lead_id IS DISTINCT FROM p_lead_id
    OR reply_memory.classification <> 'hot_seller_lead'
    OR lower(btrim(reply_memory.mailbox)) IS DISTINCT FROM lower(btrim(p_mailbox_address))
    OR reply_memory.message_id IS DISTINCT FROM btrim(p_inbound_message_id)
    OR reply_memory.thread_id IS DISTINCT FROM btrim(p_inbound_conversation_id)
    OR reply_memory.metadata_json ->> 'internetMessageId'
      IS DISTINCT FROM btrim(p_inbound_internet_message_id)
    OR lower(btrim(COALESCE(
      reply_memory.metadata_json ->> 'observedTenantId', ''
    ))) IS DISTINCT FROM p_tenant_id::TEXT
    OR lower(btrim(COALESCE(
      reply_memory.metadata_json ->> 'observedMailboxObjectId', ''
    ))) IS DISTINCT FROM p_mailbox_object_id::TEXT
    OR NULLIF(btrim(reply_memory.reply_summary), '') IS NULL
    OR lower(btrim(reply_memory.reply_summary)) = ANY(ARRAY[
      '-', '--', '.', 'n/a', 'na', 'none', 'null', 'unknown', 'pending',
      'placeholder', '[placeholder]', 'test', 'sample', 'todo', 'tbd',
      'not provided', 'not available', 'no summary', 'no reply summary',
      'no response', 'no message preview was returned by outlook.', 'lorem ipsum'
    ]::TEXT[])
    OR resolved_positive_evidence_fingerprint
      IS DISTINCT FROM lower(p_positive_classification_evidence_fingerprint)
    OR (
      NULLIF(btrim(reply_memory.property_address), '') IS NOT NULL
      AND btrim(reply_memory.property_address)
        IS DISTINCT FROM btrim(p_property_reference_key)
    )
    OR private.gate3d1_sha256_text(lower(btrim(COALESCE(reply_memory.from_email, ''))))
      IS DISTINCT FROM lower(p_normalized_sender_hash)
    OR private.gate3d1_sha256_text(lower(btrim(COALESCE(reply_memory.to_email, ''))))
      IS DISTINCT FROM lower(p_normalized_recipient_hash)
    OR reply_memory.metadata_json -> 'explicitOptOut' IS NOT DISTINCT FROM 'true'::JSONB THEN
    RAISE EXCEPTION 'The reviewed Graph identifiers, mailbox, participant hashes, property, or positive reply do not match reply memory.'
      USING ERRCODE = '23514';
  END IF;

  SELECT lead.* INTO lead_record
  FROM public.leads lead
  WHERE lead.id = p_lead_id;
  SELECT message.* INTO outreach_record
  FROM public.outreach_messages message
  WHERE message.id = p_outreach_message_id
  FOR UPDATE;
  IF lead_record.id IS NULL
    OR NULLIF(btrim(lead_record.email), '') IS NULL
    OR private.gate3d1_sha256_text(lower(btrim(lead_record.email)))
      IS DISTINCT FROM lower(p_normalized_sender_hash)
    OR NULLIF(btrim(lead_record.property_address), '') IS NULL
    OR btrim(lead_record.property_address) IS DISTINCT FROM btrim(p_property_reference_key)
    OR outreach_record.id IS NULL
    OR outreach_record.lead_id IS DISTINCT FROM p_lead_id
    OR outreach_record.channel <> 'email'
    OR outreach_record.variant_key IS DISTINCT FROM p_draft_version_key
    OR outreach_record.status NOT IN ('needs_review', 'approved')
    OR (
      outreach_record.status = 'needs_review'
      AND (outreach_record.approved_by_user_id IS NOT NULL OR outreach_record.approved_at IS NOT NULL)
    )
    OR (
      outreach_record.status = 'approved'
      AND (
        outreach_record.approved_by_user_id IS DISTINCT FROM p_actor_user_id
        OR outreach_record.approved_at IS NULL
      )
    )
    OR private.gate3d1_sha256_text(
      private.gate3d1_canonical_authored_body(outreach_record.body)
    )
      IS DISTINCT FROM lower(p_approved_content_fingerprint) THEN
    RAISE EXCEPTION 'Authorization requires the exact canonical lead property and founder-approved outreach body.'
      USING ERRCODE = '23514';
  END IF;

  SELECT proof.* INTO attestation
  FROM private.exchange_application_rbac_attestations proof
  WHERE proof.id = p_exchange_rbac_attestation_id;
  IF attestation.id IS NULL
    OR attestation.tenant_id IS DISTINCT FROM p_tenant_id
    OR attestation.client_id IS DISTINCT FROM p_client_id
    OR attestation.mailbox_object_id IS DISTINCT FROM p_mailbox_object_id
    OR attestation.mailbox_address IS DISTINCT FROM lower(btrim(p_mailbox_address))
    OR attestation.writer_release IS DISTINCT FROM p_writer_release
    OR attestation.expires_at <= statement_timestamp()
    OR attestation.expires_at < p_expires_at
    OR NOT attestation.in_scope_authorized
    OR NOT attestation.out_of_scope_denied
    OR attestation.rbac_role_set_json IS DISTINCT FROM
      '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB
    OR EXISTS (
      SELECT 1
      FROM private.exchange_application_rbac_attestation_revocations revocation
      WHERE revocation.attestation_id = attestation.id
    ) THEN
    RAISE EXCEPTION 'The exact short-lived Exchange Application RBAC proof is missing, revoked, mismatched, or too short.'
      USING ERRCODE = '23514';
  END IF;

  -- The authenticated founder approval and the continuation authorization are
  -- one transaction. A failed authorization can never strand a generic
  -- approved email row for a legacy sender to discover.
  IF outreach_record.status = 'needs_review' THEN
    UPDATE public.outreach_messages message
    SET status = 'approved',
        approved_by_user_id = p_actor_user_id,
        approved_at = statement_timestamp(),
        updated_at = statement_timestamp()
    WHERE message.id = outreach_record.id
      AND message.status = 'needs_review'
      AND message.approved_by_user_id IS NULL
      AND message.approved_at IS NULL
      AND message.variant_key = p_draft_version_key
      AND private.gate3d1_sha256_text(
        private.gate3d1_canonical_authored_body(message.body)
      )
        = lower(p_approved_content_fingerprint)
    RETURNING message.* INTO outreach_record;
    IF outreach_record.id IS NULL OR outreach_record.status <> 'approved' THEN
      RAISE EXCEPTION 'The exact Gate 3D.1 outreach draft could not be atomically approved.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT candidate.* INTO existing_authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.idempotency_key = p_idempotency_key;
  result_id := COALESCE(existing_authz.id, gen_random_uuid());
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'authorizationId', result_id,
    'operatingStrategyVersionId', p_operating_strategy_version_id,
    'leadId', p_lead_id,
    'replyMemoryId', p_reply_memory_id,
    'outreachMessageId', p_outreach_message_id,
    'exchangeRbacAttestationId', p_exchange_rbac_attestation_id,
    'authorizationBasis', 'positive_inbound_reply_continuation',
    'permissionSemantics', 'reply_continuation_not_marketing_consent',
    'inboundProvider', 'outlook_graph',
    'graphIdentifierSemantics', 'case_sensitive_immutable',
    'tenantId', p_tenant_id,
    'clientId', p_client_id,
    'mailboxObjectId', p_mailbox_object_id,
    'mailboxAddress', lower(btrim(p_mailbox_address)),
    'inboundMessageId', btrim(p_inbound_message_id),
    'inboundConversationId', btrim(p_inbound_conversation_id),
    'inboundInternetMessageId', btrim(p_inbound_internet_message_id),
    'normalizedSenderHash', lower(p_normalized_sender_hash),
    'normalizedRecipientHash', lower(p_normalized_recipient_hash),
    'propertyReferenceKey', btrim(p_property_reference_key),
    'purposeKey', 'seller_reply_followup',
    'approvedContentFingerprint', lower(p_approved_content_fingerprint),
    'draftVersionKey', p_draft_version_key,
    'positiveClassification', 'hot_seller_lead',
    'positiveClassificationEvidenceFingerprint', resolved_positive_evidence_fingerprint,
    'authorizedReplyReceivedAt', reply_memory.received_at,
    'localTimezone', p_local_timezone,
    'allowedLocalStart', p_allowed_local_start,
    'allowedLocalEnd', p_allowed_local_end,
    'allowedIsoWeekdays', normalized_weekdays,
    'approvedByUserId', p_actor_user_id,
    'expiresAt', p_expires_at,
    'rationale', btrim(p_rationale),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  IF existing_authz.id IS NOT NULL THEN
    IF existing_authz.authorization_fingerprint IS DISTINCT FROM result_fingerprint THEN
      RAISE EXCEPTION 'Continuation authorization replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    PERFORM private.gate3d1_assert_continuation_safe(existing_authz.id, FALSE);
    RETURN existing_authz.id;
  END IF;

  INSERT INTO private.inbound_reply_continuation_authorizations(
    id, operating_strategy_version_id, lead_id, reply_memory_id, outreach_message_id,
    exchange_rbac_attestation_id, tenant_id, client_id, mailbox_object_id,
    mailbox_address, inbound_message_id, inbound_conversation_id,
    inbound_internet_message_id, normalized_sender_hash,
    normalized_recipient_hash, property_reference_key, purpose_key,
    approved_content_fingerprint, draft_version_key,
    positive_classification_evidence_fingerprint, authorized_reply_received_at,
    local_timezone, allowed_local_start, allowed_local_end, allowed_iso_weekdays,
    approved_by_user_id, expires_at, rationale, writer_release, idempotency_key,
    authorization_fingerprint
  ) VALUES (
    result_id, p_operating_strategy_version_id, p_lead_id, p_reply_memory_id,
    p_outreach_message_id,
    p_exchange_rbac_attestation_id, p_tenant_id, p_client_id, p_mailbox_object_id,
    lower(btrim(p_mailbox_address)), btrim(p_inbound_message_id),
    btrim(p_inbound_conversation_id), btrim(p_inbound_internet_message_id),
    lower(p_normalized_sender_hash), lower(p_normalized_recipient_hash),
    btrim(p_property_reference_key), 'seller_reply_followup',
    lower(p_approved_content_fingerprint), p_draft_version_key,
    resolved_positive_evidence_fingerprint, reply_memory.received_at,
    p_local_timezone, p_allowed_local_start, p_allowed_local_end, normalized_weekdays,
    p_actor_user_id, p_expires_at, btrim(p_rationale), p_writer_release,
    p_idempotency_key, result_fingerprint
  );
  PERFORM private.gate3d1_assert_continuation_safe(result_id, FALSE);
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inbound_reply_continuation_authorization(
  UUID, UUID, UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIME, TIME, SMALLINT[],
  TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_inbound_reply_continuation_authorization(
  UUID, UUID, UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIME, TIME, SMALLINT[],
  TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT
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
  existing_revocation private.inbound_reply_continuation_revocations;
  result_id UUID;
  result_fingerprint TEXT;
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  IF length(btrim(COALESCE(p_reason, ''))) < 12
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'A revocation reason and idempotency key are required.'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.inbound_reply_continuation_authorizations candidate
    WHERE candidate.id = p_authorization_id
  ) THEN
    RAISE EXCEPTION 'Continuation authorization not found.' USING ERRCODE = '23514';
  END IF;
  SELECT revocation.* INTO existing_revocation
  FROM private.inbound_reply_continuation_revocations revocation
  WHERE revocation.authorization_id = p_authorization_id
     OR revocation.idempotency_key = p_idempotency_key
  ORDER BY revocation.authorization_id = p_authorization_id DESC
  LIMIT 1;
  IF existing_revocation.id IS NOT NULL THEN
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
    id, authorization_id, revoked_by_user_id, reason, idempotency_key,
    revocation_fingerprint
  ) VALUES (
    result_id, p_authorization_id, p_actor_user_id, btrim(p_reason),
    p_idempotency_key, result_fingerprint
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
  p_reply_memory_id UUID,
  p_approved_content_fingerprint TEXT,
  p_draft_version_key TEXT,
  p_writer_release TEXT
)
RETURNS TABLE (
  authorization_id UUID,
  exchange_rbac_attestation_id UUID,
  expires_at TIMESTAMPTZ,
  authorization_fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.gate3d1_assert_continuation_safe(p_authorization_id, TRUE);
  RETURN QUERY
  SELECT authz.id, authz.exchange_rbac_attestation_id, authz.expires_at,
    authz.authorization_fingerprint
  FROM private.inbound_reply_continuation_authorizations authz
  WHERE authz.id = p_authorization_id
    AND authz.operating_strategy_version_id = p_operating_strategy_version_id
    AND authz.lead_id = p_lead_id
    AND authz.reply_memory_id = p_reply_memory_id
    AND authz.approved_content_fingerprint = lower(p_approved_content_fingerprint)
    AND authz.draft_version_key = p_draft_version_key
    AND authz.writer_release = p_writer_release;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exact continuation authorization content, lead, reply, version, or writer mismatched.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_inbound_reply_continuation_authorized(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_inbound_reply_continuation_authorized(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_gate3d1_canary_execution_manifest(
  p_authorization_id UUID,
  p_outreach_message_id UUID,
  p_writer_release TEXT
)
RETURNS TABLE (
  authorization_id UUID,
  exchange_rbac_attestation_id UUID,
  reply_memory_id UUID,
  lead_id UUID,
  outreach_message_id UUID,
  recipient_email TEXT,
  property_reference_key TEXT,
  local_timezone TEXT,
  allowed_local_start TIME,
  allowed_local_end TIME,
  allowed_iso_weekdays SMALLINT[],
  tenant_id UUID,
  client_id UUID,
  mailbox_object_id UUID,
  mailbox_address TEXT,
  inbound_message_id TEXT,
  inbound_conversation_id TEXT,
  inbound_internet_message_id TEXT,
  approved_subject TEXT,
  approved_comment TEXT,
  draft_version_key TEXT,
  approved_content_fingerprint TEXT,
  operating_strategy_version_id UUID,
  operating_contract_fingerprint TEXT,
  authorization_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  authz private.inbound_reply_continuation_authorizations;
  reply_memory public.command_center_reply_memory;
  outreach_record public.outreach_messages;
  version public.operating_strategy_versions;
BEGIN
  PERFORM private.gate3d1_assert_continuation_safe(p_authorization_id, TRUE);
  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = p_authorization_id
    AND candidate.outreach_message_id = p_outreach_message_id
    AND candidate.writer_release = p_writer_release;
  IF authz.id IS NULL THEN
    RAISE EXCEPTION 'Execution manifest authorization, outreach message, or writer mismatched.'
      USING ERRCODE = '23514';
  END IF;
  SELECT memory.* INTO reply_memory
  FROM public.command_center_reply_memory memory
  WHERE memory.id = authz.reply_memory_id;
  SELECT message.* INTO outreach_record
  FROM public.outreach_messages message
  WHERE message.id = authz.outreach_message_id;
  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = authz.operating_strategy_version_id;
  IF outreach_record.id IS NULL
    OR outreach_record.status <> 'approved'
    OR private.gate3d1_sha256_text(
      private.gate3d1_canonical_authored_body(outreach_record.body)
    )
      IS DISTINCT FROM authz.approved_content_fingerprint
    OR version.id IS NULL THEN
    RAISE EXCEPTION 'Execution manifest content or operating version is no longer exact.'
      USING ERRCODE = '23514';
  END IF;
  RETURN QUERY SELECT
    authz.id, authz.exchange_rbac_attestation_id, authz.reply_memory_id,
    authz.lead_id, authz.outreach_message_id, lower(btrim(reply_memory.from_email)),
    authz.property_reference_key, authz.local_timezone, authz.allowed_local_start,
    authz.allowed_local_end, authz.allowed_iso_weekdays, authz.tenant_id,
    authz.client_id, authz.mailbox_object_id, authz.mailbox_address,
    authz.inbound_message_id, authz.inbound_conversation_id,
    authz.inbound_internet_message_id, outreach_record.subject,
    private.gate3d1_canonical_authored_body(outreach_record.body),
    authz.draft_version_key,
    authz.approved_content_fingerprint, authz.operating_strategy_version_id,
    private.gate3b_operating_contract_fingerprint(version), authz.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_gate3d1_canary_execution_manifest(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_gate3d1_canary_execution_manifest(
  UUID, UUID, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_gate3d1_canary_dispatch(
  p_authorization_id UUID,
  p_exchange_rbac_attestation_id UUID,
  p_operating_strategy_version_id UUID,
  p_lead_id UUID,
  p_channel TEXT,
  p_approved_content_fingerprint TEXT,
  p_draft_version_key TEXT,
  p_reservation_idempotency_key TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE (
  claim_id UUID,
  authorization_id UUID,
  exchange_rbac_attestation_id UUID,
  expires_at TIMESTAMPTZ,
  claim_fingerprint TEXT,
  consent_basis_snapshot_json JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  authz private.inbound_reply_continuation_authorizations;
  attestation private.exchange_application_rbac_attestations;
  version public.operating_strategy_versions;
  existing_claim private.gate3d1_canary_dispatch_claims;
  result_id UUID;
  result_expires_at TIMESTAMPTZ;
  result_fingerprint TEXT;
  result_snapshot JSONB;
  quiet_hours_fingerprint TEXT;
BEGIN
  IF p_channel IS DISTINCT FROM 'outlook_graph'
    OR lower(COALESCE(p_approved_content_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR COALESCE(p_draft_version_key, '') !~ '^[a-z0-9][a-z0-9_.:-]{2,127}$'
    OR NULLIF(btrim(p_reservation_idempotency_key), '') IS NULL
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'The one-shot claim requires Outlook, exact content, draft version, and idempotency evidence.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_open_canary_controls(
    p_operating_strategy_version_id,
    p_writer_release
  );
  PERFORM private.gate3d1_assert_continuation_safe(p_authorization_id, TRUE);

  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = p_authorization_id;
  IF authz.id IS NULL
    OR authz.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR authz.lead_id IS DISTINCT FROM p_lead_id
    OR authz.exchange_rbac_attestation_id IS DISTINCT FROM p_exchange_rbac_attestation_id
    OR authz.approved_content_fingerprint IS DISTINCT FROM lower(p_approved_content_fingerprint)
    OR authz.draft_version_key IS DISTINCT FROM p_draft_version_key
    OR authz.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Claim inputs do not match the immutable founder-reviewed continuation.'
      USING ERRCODE = '23514';
  END IF;
  SELECT proof.* INTO attestation
  FROM private.exchange_application_rbac_attestations proof
  WHERE proof.id = p_exchange_rbac_attestation_id;
  IF attestation.id IS NULL
    OR attestation.tenant_id IS DISTINCT FROM authz.tenant_id
    OR attestation.client_id IS DISTINCT FROM authz.client_id
    OR attestation.mailbox_object_id IS DISTINCT FROM authz.mailbox_object_id
    OR attestation.mailbox_address IS DISTINCT FROM authz.mailbox_address
    OR attestation.writer_release IS DISTINCT FROM p_writer_release
    OR attestation.expires_at <= statement_timestamp()
    OR NOT attestation.in_scope_authorized
    OR NOT attestation.out_of_scope_denied
    OR attestation.rbac_role_set_json IS DISTINCT FROM
      '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB
    OR EXISTS (
      SELECT 1
      FROM private.exchange_application_rbac_attestation_revocations revocation
      WHERE revocation.attestation_id = attestation.id
    ) THEN
    RAISE EXCEPTION 'The claim lacks the exact unexpired Exchange Application RBAC proof.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id
  FOR UPDATE;
  IF version.id IS NULL THEN
    RAISE EXCEPTION 'Canary operating version not found.' USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO existing_claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.idempotency_key = p_idempotency_key
     OR candidate.operating_strategy_version_id = p_operating_strategy_version_id
     OR candidate.authorization_id = p_authorization_id
  ORDER BY candidate.idempotency_key = p_idempotency_key DESC
  LIMIT 1
  FOR UPDATE;
  result_id := COALESCE(existing_claim.id, gen_random_uuid());
  result_expires_at := LEAST(authz.expires_at, attestation.expires_at);
  quiet_hours_fingerprint := private.gate3d1_sha256_text(jsonb_build_object(
    'localTimezone', authz.local_timezone,
    'allowedLocalStart', authz.allowed_local_start,
    'allowedLocalEnd', authz.allowed_local_end,
    'allowedIsoWeekdays', authz.allowed_iso_weekdays
  )::TEXT);
  result_snapshot := jsonb_build_object(
    'dispatchAuthorized', TRUE,
    'basis', 'positive_inbound_reply_continuation',
    'permissionSemantics', 'reply_continuation_not_marketing_consent',
    'evidenceKey', 'gate3d1-continuation:' || authz.id::TEXT || ':claim:' || result_id::TEXT,
    'provenance', jsonb_build_array(jsonb_build_object(
      'source', 'founder_reviewed_positive_inbound_reply_continuation',
      'authorizationId', authz.id,
      'claimId', result_id,
      'exchangeRbacAttestationId', attestation.id
    )),
    'authorizationId', authz.id,
    'claimId', result_id,
    'leadId', authz.lead_id,
    'replyMemoryId', authz.reply_memory_id,
    'outreachMessageId', authz.outreach_message_id,
    'authorizationFingerprint', authz.authorization_fingerprint,
    'inboundProvider', 'outlook_graph',
    'graphIdentifierSemantics', 'case_sensitive_immutable',
    'tenantId', authz.tenant_id,
    'clientId', authz.client_id,
    'mailboxObjectId', authz.mailbox_object_id,
    'mailboxAddressHash', private.gate3d1_sha256_text(authz.mailbox_address),
    'inboundMessageIdHash', private.gate3d1_sha256_text(authz.inbound_message_id),
    'inboundConversationIdHash', private.gate3d1_sha256_text(authz.inbound_conversation_id),
    'inboundInternetMessageIdHash', private.gate3d1_sha256_text(authz.inbound_internet_message_id),
    'normalizedSenderHash', authz.normalized_sender_hash,
    'normalizedRecipientHash', authz.normalized_recipient_hash,
    'propertyReferenceHash', private.gate3d1_sha256_text(authz.property_reference_key),
    'purposeKey', authz.purpose_key,
    'approvedContentFingerprint', authz.approved_content_fingerprint,
    'draftVersionKey', authz.draft_version_key,
    'positiveClassificationEvidenceFingerprint',
      authz.positive_classification_evidence_fingerprint,
    'exchangeRbacAttestationId', attestation.id,
    'exchangeRbacAttestationFingerprint', attestation.attestation_fingerprint,
    'quietHoursEvidenceFingerprint', quiet_hours_fingerprint
  );
  result_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'claimId', result_id,
    'operatingStrategyId', version.operating_strategy_id,
    'operatingStrategyVersionId', version.id,
    'authorizationId', authz.id,
    'exchangeRbacAttestationId', attestation.id,
    'leadId', authz.lead_id,
    'replyMemoryId', authz.reply_memory_id,
    'channel', 'outlook_graph',
    'approvedContentFingerprint', authz.approved_content_fingerprint,
    'draftVersionKey', authz.draft_version_key,
    'reservationIdempotencyKey', p_reservation_idempotency_key,
    'writerRelease', p_writer_release,
    'expiresAt', result_expires_at,
    'idempotencyKey', p_idempotency_key,
    'consentBasisSnapshot', result_snapshot
  ));
  IF existing_claim.id IS NOT NULL THEN
    IF existing_claim.claim_fingerprint IS DISTINCT FROM result_fingerprint
      OR existing_claim.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'A lifetime canary claim already exists or this replay conflicts.'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO private.gate3d1_canary_dispatch_claims(
      id, operating_strategy_id, operating_strategy_version_id, authorization_id,
      exchange_rbac_attestation_id, lead_id, reply_memory_id, channel,
      approved_content_fingerprint, draft_version_key,
      reservation_idempotency_key, writer_release, expires_at, idempotency_key,
      claim_fingerprint, consent_basis_snapshot_json
    ) VALUES (
      result_id, version.operating_strategy_id, version.id, authz.id,
      attestation.id, authz.lead_id, authz.reply_memory_id, 'outlook_graph',
      authz.approved_content_fingerprint, authz.draft_version_key,
      p_reservation_idempotency_key, p_writer_release, result_expires_at,
      p_idempotency_key, result_fingerprint, result_snapshot
    );
    INSERT INTO private.gate3d1_canary_dispatch_events(
      claim_id, sequence_number, event_type, actor_type, writer_release,
      idempotency_key, event_fingerprint
    ) VALUES (
      result_id, 1, 'claimed', 'service_role', p_writer_release,
      p_idempotency_key || ':claimed',
      private.gate3c_canonical_fingerprint(jsonb_build_object(
        'claimId', result_id,
        'sequenceNumber', 1,
        'eventType', 'claimed',
        'claimFingerprint', result_fingerprint,
        'writerRelease', p_writer_release,
        'idempotencyKey', p_idempotency_key || ':claimed'
      ))
    );
  END IF;
  RETURN QUERY SELECT result_id, authz.id, attestation.id, result_expires_at,
    result_fingerprint, result_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gate3d1_canary_dispatch(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gate3d1_canary_dispatch(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

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
  runtime_control public.operating_strategy_runtime_controls;
  version public.operating_strategy_versions;
  claim private.gate3d1_canary_dispatch_claims;
  reservation_result RECORD;
  stored_reservation public.operating_strategy_dispatch_reservations;
  claim_state TEXT;
BEGIN
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  IF runtime_control.canary_operating_strategy_version_id
      IS DISTINCT FROM p_operating_strategy_version_id THEN
    RETURN QUERY
    SELECT *
    FROM private.gate3c_reserve_operating_strategy_dispatch_unchecked(
      p_operating_strategy_version_id, p_operating_contract_fingerprint,
      p_channel, p_requested_count, p_idempotency_key, p_writer_release,
      p_ttl_seconds, p_fallback_channels
    );
    RETURN;
  END IF;

  IF p_channel IS DISTINCT FROM 'outlook_graph'
    OR p_requested_count IS DISTINCT FROM 1
    OR COALESCE(cardinality(p_fallback_channels), 0) <> 0 THEN
    RAISE EXCEPTION 'Gate 3D.1 permits exactly one Outlook recipient and no fallback channel.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_open_canary_controls(
    p_operating_strategy_version_id,
    p_writer_release
  );
  SELECT candidate.* INTO version
  FROM public.operating_strategy_versions candidate
  WHERE candidate.id = p_operating_strategy_version_id
  FOR UPDATE;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.operating_strategy_version_id = p_operating_strategy_version_id
    AND candidate.reservation_idempotency_key = p_idempotency_key
    AND candidate.writer_release = p_writer_release
  FOR UPDATE;
  claim_state := private.gate3d1_current_claim_state(claim.id);
  IF claim.id IS NULL
    OR claim.expires_at <= statement_timestamp()
    OR claim_state NOT IN ('claimed', 'reservation_bound') THEN
    RAISE EXCEPTION 'A live one-shot claim must precede the exact reservation.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_continuation_safe(claim.authorization_id, TRUE);
  IF EXISTS (
    SELECT 1
    FROM public.operating_strategy_dispatch_reservations prior
    WHERE prior.operating_strategy_version_id = p_operating_strategy_version_id
      AND prior.idempotency_key IS DISTINCT FROM p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'The lifetime one-recipient canary has already reserved its only unit.'
      USING ERRCODE = '23514';
  END IF;

  SELECT result.* INTO reservation_result
  FROM private.gate3c_reserve_operating_strategy_dispatch_unchecked(
    p_operating_strategy_version_id, p_operating_contract_fingerprint,
    p_channel, p_requested_count, p_idempotency_key, p_writer_release,
    p_ttl_seconds, p_fallback_channels
  ) result;
  SELECT candidate.* INTO stored_reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = reservation_result.reservation_id;
  IF stored_reservation.id IS NULL
    OR stored_reservation.channel <> 'outlook_graph'
    OR stored_reservation.channel_candidates IS DISTINCT FROM ARRAY['outlook_graph']::TEXT[]
    OR stored_reservation.requested_count <> 1
    OR stored_reservation.idempotency_key IS DISTINCT FROM claim.reservation_idempotency_key THEN
    RAISE EXCEPTION 'The stored reservation escaped the Outlook-only one-shot contract.'
      USING ERRCODE = '23514';
  END IF;
  RETURN QUERY SELECT
    reservation_result.reservation_id::UUID,
    reservation_result.reserved_count::INTEGER,
    reservation_result.remaining_daily_capacity::INTEGER,
    reservation_result.expires_at::TIMESTAMPTZ,
    reservation_result.capacity_window_ends_at::TIMESTAMPTZ;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_operating_strategy_dispatch(
  UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT[]
) TO service_role;

CREATE OR REPLACE FUNCTION public.bind_gate3d1_canary_reservation(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_operating_strategy_version_id UUID,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  reservation public.operating_strategy_dispatch_reservations;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  event_fingerprint TEXT;
BEGIN
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Reservation binding idempotency is required.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL
    OR claim.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR claim.writer_release IS DISTINCT FROM p_writer_release
    OR claim.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'The exact unexpired claim is required for reservation binding.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = 'reservation_bound' OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = 'reservation_bound' DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type <> 'reservation_bound'
      OR existing_event.reservation_id IS DISTINCT FROM p_reservation_id
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Reservation-binding replay conflicts with immutable claim history.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'claimed' THEN
    RAISE EXCEPTION 'Reservation binding must immediately follow the one-shot claim.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = p_reservation_id
    AND candidate.operating_strategy_version_id = p_operating_strategy_version_id;
  IF reservation.id IS NULL
    OR reservation.channel <> 'outlook_graph'
    OR reservation.channel_candidates IS DISTINCT FROM ARRAY['outlook_graph']::TEXT[]
    OR reservation.requested_count <> 1
    OR reservation.writer_release IS DISTINCT FROM p_writer_release
    OR reservation.idempotency_key IS DISTINCT FROM claim.reservation_idempotency_key
    OR reservation.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'Reservation does not match the exact live Outlook-only claim.'
      USING ERRCODE = '23514';
  END IF;
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 2,
    'eventType', 'reservation_bound',
    'reservationId', reservation.id,
    'reservationFingerprint', reservation.reservation_fingerprint,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id, actor_type,
    writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 2, 'reservation_bound', reservation.id, 'service_role',
    p_writer_release, p_idempotency_key, event_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_gate3d1_canary_reservation(
  UUID, UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_gate3d1_canary_reservation(
  UUID, UUID, UUID, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_gate3d1_canary_dispatch_intent(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_outbound_enrollment_id UUID,
  p_canonical_activity_id UUID,
  p_approved_content_fingerprint TEXT,
  p_draft_version_key TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  authz private.inbound_reply_continuation_authorizations;
  reservation public.operating_strategy_dispatch_reservations;
  enrollment public.command_center_outbound_enrollments;
  activity public.operating_strategy_activities;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  event_fingerprint TEXT;
  suppression_checked_at TIMESTAMPTZ;
BEGIN
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Intent confirmation idempotency is required.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL
    OR claim.writer_release IS DISTINCT FROM p_writer_release
    OR claim.approved_content_fingerprint IS DISTINCT FROM lower(p_approved_content_fingerprint)
    OR claim.draft_version_key IS DISTINCT FROM p_draft_version_key
    OR claim.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'Intent confirmation does not match the exact live claim.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = 'intent_ready' OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = 'intent_ready' DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type <> 'intent_ready'
      OR existing_event.reservation_id IS DISTINCT FROM p_reservation_id
      OR existing_event.outbound_enrollment_id IS DISTINCT FROM p_outbound_enrollment_id
      OR existing_event.canonical_activity_id IS DISTINCT FROM p_canonical_activity_id
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Intent confirmation replay conflicts with immutable claim history.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'reservation_bound' THEN
    RAISE EXCEPTION 'Canonical intent must follow the reservation binding exactly once.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = claim.authorization_id;
  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = p_reservation_id
    AND candidate.operating_strategy_version_id = claim.operating_strategy_version_id;
  SELECT candidate.* INTO enrollment
  FROM public.command_center_outbound_enrollments candidate
  WHERE candidate.id = p_outbound_enrollment_id;
  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = p_canonical_activity_id;
  BEGIN
    suppression_checked_at :=
      (enrollment.suppression_snapshot_json ->> 'checkedAt')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Suppression checkedAt must be a valid timestamp.' USING ERRCODE = '23514';
  END;
  IF reservation.id IS NULL
    OR reservation.expires_at <= statement_timestamp()
    OR enrollment.id IS NULL
    OR enrollment.operating_strategy_version_id IS DISTINCT FROM claim.operating_strategy_version_id
    OR enrollment.dispatch_reservation_id IS DISTINCT FROM reservation.id
    OR enrollment.canonical_activity_id IS DISTINCT FROM activity.id
    OR enrollment.strategy_binding_mode <> 'governed_v1'
    OR enrollment.governed_stage <> 'dispatch_intent'
    OR enrollment.dispatch_channel <> 'outlook_graph'
    OR enrollment.status <> 'queued'
    OR enrollment.provider IS NOT NULL
    OR enrollment.provider_message_id IS NOT NULL
    OR enrollment.outreach_purpose <> 'seller_reply_followup'
    OR enrollment.strategy_writer_release IS DISTINCT FROM p_writer_release
    OR enrollment.last_message_id IS DISTINCT FROM authz.outreach_message_id::TEXT
    OR enrollment.recipient_hash IS DISTINCT FROM authz.normalized_sender_hash
    OR enrollment.message_version_key IS DISTINCT FROM claim.draft_version_key
    OR enrollment.consent_basis_snapshot_json IS DISTINCT FROM claim.consent_basis_snapshot_json
    OR enrollment.suppression_snapshot_json -> 'suppressionCleared' IS DISTINCT FROM 'true'::JSONB
    OR enrollment.suppression_snapshot_json ->> 'recipientHash'
      IS DISTINCT FROM authz.normalized_sender_hash
    OR NULLIF(btrim(enrollment.suppression_snapshot_json ->> 'evidenceKey'), '') IS NULL
    OR suppression_checked_at IS NULL
    OR suppression_checked_at < statement_timestamp() - INTERVAL '15 minutes'
    OR suppression_checked_at > statement_timestamp() + INTERVAL '1 minute'
    OR activity.id IS NULL
    OR activity.activity_type <> 'enrollment'
    OR activity.activity_namespace <> 'command_center_outbound_enrollment'
    OR activity.activity_key IS DISTINCT FROM enrollment.id::TEXT
    OR activity.subject_namespace <> 'lead'
    OR activity.operating_strategy_version_id IS DISTINCT FROM claim.operating_strategy_version_id
    OR activity.outbound_enrollment_id IS DISTINCT FROM enrollment.id
    OR activity.dispatch_reservation_id IS DISTINCT FROM reservation.id
    OR activity.dispatch_channel <> 'outlook_graph'
    OR activity.provider IS NOT NULL
    OR activity.provider_message_id IS NOT NULL
    OR activity.outreach_purpose <> 'seller_reply_followup'
    OR activity.subject_key IS DISTINCT FROM claim.lead_id::TEXT
    OR activity.writer_release IS DISTINCT FROM p_writer_release
    OR activity.message_version_key IS DISTINCT FROM claim.draft_version_key
    OR activity.consent_basis_snapshot_json IS DISTINCT FROM claim.consent_basis_snapshot_json
    OR activity.suppression_snapshot_json IS DISTINCT FROM enrollment.suppression_snapshot_json THEN
    RAISE EXCEPTION 'Canonical enrollment, activity, content, recipient, consent, or suppression intent mismatched.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_continuation_safe(claim.authorization_id, TRUE);
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 3,
    'eventType', 'intent_ready',
    'reservationId', reservation.id,
    'outboundEnrollmentId', enrollment.id,
    'canonicalActivityId', activity.id,
    'activityFingerprint', activity.activity_fingerprint,
    'approvedContentFingerprint', claim.approved_content_fingerprint,
    'draftVersionKey', claim.draft_version_key,
    'suppressionCheckedAt', suppression_checked_at,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id,
    outbound_enrollment_id, canonical_activity_id, actor_type, writer_release,
    idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 3, 'intent_ready', reservation.id, enrollment.id,
    activity.id, 'service_role', p_writer_release, p_idempotency_key,
    event_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_gate3d1_canary_dispatch_intent(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_gate3d1_canary_dispatch_intent(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.abort_gate3d1_canary_before_send(
  p_claim_id UUID,
  p_reason TEXT,
  p_provider_evidence_fingerprint TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  existing_event private.gate3d1_canary_dispatch_events;
  draft_event private.gate3d1_canary_dispatch_events;
  bound_reservation_id UUID;
  current_state TEXT;
  next_sequence INTEGER;
  result_id UUID;
  event_fingerprint TEXT;
BEGIN
  IF length(btrim(COALESCE(p_reason, ''))) < 20
    OR lower(COALESCE(p_provider_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Pre-send abort requires a reason, SHA-256 evidence, and idempotency key.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Pre-send abort does not match the exact claim writer.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id
    AND (event.event_type = 'dead_lettered' OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = 'dead_lettered' DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type <> 'dead_lettered'
      OR existing_event.provider_evidence_fingerprint
        IS DISTINCT FROM lower(p_provider_evidence_fingerprint)
      OR existing_event.reason IS DISTINCT FROM btrim(p_reason)
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Pre-send abort replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  current_state := private.gate3d1_current_claim_state(claim.id);
  IF current_state NOT IN (
    'claimed', 'reservation_bound', 'intent_ready',
    'graph_draft_attempted', 'graph_draft_created'
  ) THEN
    RAISE EXCEPTION 'Only an unconsumed pre-send claim may be safely aborted.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.reservation_id INTO bound_reservation_id
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.reservation_id IS NOT NULL
  ORDER BY event.sequence_number DESC
  LIMIT 1;
  SELECT event.* INTO draft_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.event_type = 'graph_draft_created';
  SELECT COALESCE(MAX(event.sequence_number), 0) + 1 INTO next_sequence
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id;
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', next_sequence,
    'eventType', 'dead_lettered',
    'priorState', current_state,
    'reservationId', bound_reservation_id,
    'providerEvidenceFingerprint', lower(p_provider_evidence_fingerprint),
    'reason', btrim(p_reason),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id,
    provider_draft_id_hash, provider_conversation_id_hash,
    provider_internet_message_id_hash, provider_evidence_fingerprint,
    actor_type, reason, writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, next_sequence, 'dead_lettered', bound_reservation_id,
    draft_event.provider_draft_id_hash, draft_event.provider_conversation_id_hash,
    draft_event.provider_internet_message_id_hash,
    lower(p_provider_evidence_fingerprint), 'service_role', btrim(p_reason),
    p_writer_release, p_idempotency_key, event_fingerprint
  );
  PERFORM set_config(
    'gate3d1.control_event_evidence_fingerprint',
    lower(p_provider_evidence_fingerprint),
    TRUE
  );
  PERFORM private.gate3d1_engage_stops(
    claim.id,
    'Gate 3D.1 stopped after a pre-send execution failure.'
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.abort_gate3d1_canary_before_send(
  UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_gate3d1_canary_before_send(
  UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Read-only, idempotent provider assertion. The adapter calls this immediately
-- before createReply and again immediately before beginning the one-shot send.
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
  authorization_fingerprint TEXT,
  claim_id UUID,
  authorization_id UUID,
  exchange_rbac_attestation_id UUID,
  dispatch_state TEXT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  runtime_control public.operating_strategy_runtime_controls;
  strategy_control public.operating_strategy_outbound_controls;
  reservation public.operating_strategy_dispatch_reservations;
  claim private.gate3d1_canary_dispatch_claims;
  authz private.inbound_reply_continuation_authorizations;
  attestation private.exchange_application_rbac_attestations;
  intent_event private.gate3d1_canary_dispatch_events;
  enrollment public.command_center_outbound_enrollments;
  activity public.operating_strategy_activities;
  current_state TEXT;
  matching_claims INTEGER;
  result_expires_at TIMESTAMPTZ;
  result_fingerprint TEXT;
BEGIN
  IF p_channel IS DISTINCT FROM 'outlook_graph' THEN
    RAISE EXCEPTION 'Gate 3D.1 provider dispatch is Outlook-only.' USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_open_canary_controls(
    p_operating_strategy_version_id,
    p_writer_release
  );
  SELECT controls.* INTO runtime_control
  FROM public.operating_strategy_runtime_controls controls
  WHERE controls.control_key = 'canonical_binding';
  SELECT candidate.* INTO reservation
  FROM public.operating_strategy_dispatch_reservations candidate
  WHERE candidate.id = p_reservation_id
    AND candidate.operating_strategy_version_id = p_operating_strategy_version_id;
  IF reservation.id IS NULL
    OR reservation.channel <> 'outlook_graph'
    OR reservation.channel_candidates IS DISTINCT FROM ARRAY['outlook_graph']::TEXT[]
    OR reservation.requested_count <> 1
    OR reservation.writer_release IS DISTINCT FROM p_writer_release
    OR reservation.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'The exact live Outlook-only reservation is missing, expired, or mismatched.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*)::INTEGER, (pg_catalog.array_agg(candidate.id))[1]
    INTO matching_claims, claim.id
  FROM private.gate3d1_canary_dispatch_claims candidate
  JOIN private.gate3d1_canary_dispatch_events bound
    ON bound.claim_id = candidate.id
    AND bound.event_type = 'reservation_bound'
    AND bound.reservation_id = reservation.id
  WHERE candidate.operating_strategy_version_id = p_operating_strategy_version_id;
  IF matching_claims <> 1 THEN
    RAISE EXCEPTION 'Provider dispatch requires exactly one claim bound to the reservation.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = claim.id;
  current_state := private.gate3d1_current_claim_state(claim.id);
  IF current_state NOT IN ('intent_ready', 'graph_draft_created')
    OR claim.expires_at <= statement_timestamp()
    OR claim.channel <> 'outlook_graph'
    OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Provider dispatch is not at an eligible one-shot state.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM private.gate3d1_assert_continuation_safe(claim.authorization_id, TRUE);

  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = claim.authorization_id;
  SELECT proof.* INTO attestation
  FROM private.exchange_application_rbac_attestations proof
  WHERE proof.id = claim.exchange_rbac_attestation_id;
  IF attestation.id IS NULL
    OR attestation.tenant_id IS DISTINCT FROM authz.tenant_id
    OR attestation.client_id IS DISTINCT FROM authz.client_id
    OR attestation.mailbox_object_id IS DISTINCT FROM authz.mailbox_object_id
    OR attestation.mailbox_address IS DISTINCT FROM authz.mailbox_address
    OR attestation.writer_release IS DISTINCT FROM p_writer_release
    OR attestation.expires_at <= statement_timestamp()
    OR NOT attestation.in_scope_authorized
    OR NOT attestation.out_of_scope_denied
    OR attestation.rbac_role_set_json IS DISTINCT FROM
      '["Application Mail.ReadWrite","Application Mail.Send"]'::JSONB
    OR EXISTS (
      SELECT 1
      FROM private.exchange_application_rbac_attestation_revocations revocation
      WHERE revocation.attestation_id = attestation.id
    ) THEN
    RAISE EXCEPTION 'The exact Exchange Application RBAC proof is missing, expired, revoked, or mismatched.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO intent_event
  FROM private.gate3d1_canary_dispatch_events candidate
  WHERE candidate.claim_id = claim.id
    AND candidate.event_type = 'intent_ready';
  SELECT candidate.* INTO enrollment
  FROM public.command_center_outbound_enrollments candidate
  WHERE candidate.id = intent_event.outbound_enrollment_id;
  SELECT candidate.* INTO activity
  FROM public.operating_strategy_activities candidate
  WHERE candidate.id = intent_event.canonical_activity_id;
  IF intent_event.id IS NULL
    OR intent_event.reservation_id IS DISTINCT FROM reservation.id
    OR enrollment.id IS NULL
    OR enrollment.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR enrollment.dispatch_reservation_id IS DISTINCT FROM reservation.id
    OR enrollment.canonical_activity_id IS DISTINCT FROM activity.id
    OR enrollment.strategy_binding_mode <> 'governed_v1'
    OR enrollment.governed_stage <> 'dispatch_intent'
    OR enrollment.dispatch_channel <> 'outlook_graph'
    OR enrollment.status <> 'queued'
    OR enrollment.provider IS NOT NULL
    OR enrollment.provider_message_id IS NOT NULL
    OR enrollment.outreach_purpose <> 'seller_reply_followup'
    OR enrollment.strategy_writer_release IS DISTINCT FROM p_writer_release
    OR enrollment.last_message_id IS DISTINCT FROM authz.outreach_message_id::TEXT
    OR enrollment.recipient_hash IS DISTINCT FROM authz.normalized_sender_hash
    OR enrollment.message_version_key IS DISTINCT FROM claim.draft_version_key
    OR enrollment.consent_basis_snapshot_json IS DISTINCT FROM claim.consent_basis_snapshot_json
    OR enrollment.suppression_snapshot_json -> 'suppressionCleared' IS DISTINCT FROM 'true'::JSONB
    OR enrollment.suppression_snapshot_json ->> 'recipientHash'
      IS DISTINCT FROM authz.normalized_sender_hash
    OR NULLIF(btrim(enrollment.suppression_snapshot_json ->> 'evidenceKey'), '') IS NULL
    OR enrollment.suppression_snapshot_json ->> 'checkedAt' IS NULL
    OR (enrollment.suppression_snapshot_json ->> 'checkedAt')::TIMESTAMPTZ
      < statement_timestamp() - INTERVAL '15 minutes'
    OR (enrollment.suppression_snapshot_json ->> 'checkedAt')::TIMESTAMPTZ
      > statement_timestamp() + INTERVAL '1 minute'
    OR activity.id IS NULL
    OR activity.activity_type <> 'enrollment'
    OR activity.activity_namespace <> 'command_center_outbound_enrollment'
    OR activity.activity_key IS DISTINCT FROM enrollment.id::TEXT
    OR activity.subject_namespace <> 'lead'
    OR activity.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR activity.outbound_enrollment_id IS DISTINCT FROM enrollment.id
    OR activity.dispatch_reservation_id IS DISTINCT FROM reservation.id
    OR activity.dispatch_channel <> 'outlook_graph'
    OR activity.provider IS NOT NULL
    OR activity.provider_message_id IS NOT NULL
    OR activity.outreach_purpose <> 'seller_reply_followup'
    OR activity.subject_key IS DISTINCT FROM claim.lead_id::TEXT
    OR activity.writer_release IS DISTINCT FROM p_writer_release
    OR activity.message_version_key IS DISTINCT FROM claim.draft_version_key
    OR activity.consent_basis_snapshot_json IS DISTINCT FROM claim.consent_basis_snapshot_json
    OR activity.suppression_snapshot_json IS DISTINCT FROM enrollment.suppression_snapshot_json THEN
    RAISE EXCEPTION 'The immutable canonical intent no longer matches the exact claim.'
      USING ERRCODE = '23514';
  END IF;

  SELECT controls.* INTO strategy_control
  FROM public.operating_strategy_outbound_controls controls
  WHERE controls.operating_strategy_id = claim.operating_strategy_id;
  result_expires_at := LEAST(reservation.expires_at, claim.expires_at, authz.expires_at,
    attestation.expires_at);
  result_fingerprint := private.gate3d1_sha256_text(jsonb_build_object(
    'reservationId', reservation.id,
    'reservationFingerprint', reservation.reservation_fingerprint,
    'operatingStrategyVersionId', p_operating_strategy_version_id,
    'claimId', claim.id,
    'claimFingerprint', claim.claim_fingerprint,
    'authorizationId', authz.id,
    'authorizationFingerprint', authz.authorization_fingerprint,
    'exchangeRbacAttestationId', attestation.id,
    'exchangeRbacAttestationFingerprint', attestation.attestation_fingerprint,
    'canonicalActivityId', activity.id,
    'activityFingerprint', activity.activity_fingerprint,
    'dispatchState', current_state,
    'channel', 'outlook_graph',
    'writerRelease', p_writer_release,
    'globalControlUpdatedAt', runtime_control.outbound_control_updated_at,
    'strategyControlUpdatedAt', strategy_control.updated_at,
    'expiresAt', result_expires_at
  )::TEXT);
  RETURN QUERY SELECT reservation.id, p_operating_strategy_version_id,
    'outlook_graph'::TEXT, result_expires_at, result_fingerprint, claim.id,
    authz.id, attestation.id, current_state;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_operating_strategy_dispatch_authorized(
  UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_operating_strategy_dispatch_authorized(
  UUID, UUID, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_gate3d1_canary_graph_draft_attempt(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_operating_strategy_version_id UUID,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE (
  claim_id UUID,
  provider_mutation_permit_fingerprint TEXT,
  expires_at TIMESTAMPTZ,
  mailbox_address TEXT,
  inbound_message_id TEXT,
  inbound_conversation_id TEXT,
  inbound_internet_message_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  authz private.inbound_reply_continuation_authorizations;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  permit_fingerprint TEXT;
  event_fingerprint TEXT;
BEGIN
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Graph draft-attempt idempotency is required.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL
    OR claim.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Graph draft attempt does not match the exact claim.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = 'graph_draft_attempted' OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = 'graph_draft_attempted' DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    RAISE EXCEPTION 'A Graph draft mutation was already attempted; reconcile the provider state and never create another draft.'
      USING ERRCODE = '23514';
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'intent_ready' THEN
    RAISE EXCEPTION 'Graph createReply may begin only from the exact intent-ready state.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM 1
  FROM public.assert_operating_strategy_dispatch_authorized(
    p_reservation_id, p_operating_strategy_version_id, 'outlook_graph', p_writer_release
  );
  SELECT candidate.* INTO authz
  FROM private.inbound_reply_continuation_authorizations candidate
  WHERE candidate.id = claim.authorization_id;
  result_id := gen_random_uuid();
  permit_fingerprint := private.gate3d1_sha256_text(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 4,
    'eventType', 'graph_draft_attempted',
    'reservationId', p_reservation_id,
    'authorizationFingerprint', authz.authorization_fingerprint,
    'inboundMessageIdHash', private.gate3d1_sha256_text(authz.inbound_message_id),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  )::TEXT);
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 4,
    'eventType', 'graph_draft_attempted',
    'reservationId', p_reservation_id,
    'permitFingerprint', permit_fingerprint,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id, actor_type,
    writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 4, 'graph_draft_attempted', p_reservation_id,
    'service_role', p_writer_release, p_idempotency_key, event_fingerprint
  );
  RETURN QUERY SELECT claim.id, permit_fingerprint, claim.expires_at,
    authz.mailbox_address, authz.inbound_message_id, authz.inbound_conversation_id,
    authz.inbound_internet_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_gate3d1_canary_graph_draft_attempt(
  UUID, UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_gate3d1_canary_graph_draft_attempt(
  UUID, UUID, UUID, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_gate3d1_canary_graph_draft_result(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_outcome TEXT,
  p_provider_draft_id_hash TEXT,
  p_provider_conversation_id_hash TEXT,
  p_provider_internet_message_id_hash TEXT,
  p_provider_evidence_fingerprint TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  attempt_event private.gate3d1_canary_dispatch_events;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  event_fingerprint TEXT;
BEGIN
  IF p_outcome NOT IN ('graph_draft_created', 'ambiguous', 'dead_lettered')
    OR lower(COALESCE(p_provider_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'A supported draft outcome, provider evidence, and idempotency key are required.'
      USING ERRCODE = '23514';
  END IF;
  IF p_outcome = 'graph_draft_created' AND (
    lower(COALESCE(p_provider_draft_id_hash, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_provider_conversation_id_hash, '')) !~ '^[0-9a-f]{64}$'
    OR lower(COALESCE(p_provider_internet_message_id_hash, '')) !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'A created Graph draft requires all exact immutable identity hashes.'
      USING ERRCODE = '23514';
  END IF;
  IF p_outcome IN ('ambiguous', 'dead_lettered') AND NOT (
    (
      NULLIF(btrim(COALESCE(p_provider_draft_id_hash, '')), '') IS NULL
      AND NULLIF(btrim(COALESCE(p_provider_conversation_id_hash, '')), '') IS NULL
      AND NULLIF(btrim(COALESCE(p_provider_internet_message_id_hash, '')), '') IS NULL
    )
    OR (
      lower(COALESCE(p_provider_draft_id_hash, '')) ~ '^[0-9a-f]{64}$'
      AND lower(COALESCE(p_provider_conversation_id_hash, '')) ~ '^[0-9a-f]{64}$'
      AND lower(COALESCE(p_provider_internet_message_id_hash, '')) ~ '^[0-9a-f]{64}$'
    )
  ) THEN
    RAISE EXCEPTION 'An uncertain Graph draft result must provide either no identity hashes or the complete exact identity set.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Draft result does not match the exact claim writer.' USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = p_outcome OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = p_outcome DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type IS DISTINCT FROM p_outcome
      OR existing_event.reservation_id IS DISTINCT FROM p_reservation_id
      OR existing_event.provider_draft_id_hash
        IS DISTINCT FROM NULLIF(lower(btrim(p_provider_draft_id_hash)), '')
      OR existing_event.provider_conversation_id_hash
        IS DISTINCT FROM NULLIF(lower(btrim(p_provider_conversation_id_hash)), '')
      OR existing_event.provider_internet_message_id_hash
        IS DISTINCT FROM NULLIF(lower(btrim(p_provider_internet_message_id_hash)), '')
      OR existing_event.provider_evidence_fingerprint
        IS DISTINCT FROM lower(p_provider_evidence_fingerprint)
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Draft-result replay conflicts with immutable provider evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'graph_draft_attempted' THEN
    RAISE EXCEPTION 'Draft result must immediately follow the one-shot Graph draft attempt.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO attempt_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.event_type = 'graph_draft_attempted';
  IF attempt_event.reservation_id IS DISTINCT FROM p_reservation_id THEN
    RAISE EXCEPTION 'Draft result reservation does not match the immutable draft attempt.'
      USING ERRCODE = '23514';
  END IF;
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 5,
    'eventType', p_outcome,
    'reservationId', p_reservation_id,
    'providerDraftIdHash', NULLIF(lower(btrim(p_provider_draft_id_hash)), ''),
    'providerConversationIdHash', NULLIF(lower(btrim(p_provider_conversation_id_hash)), ''),
    'providerInternetMessageIdHash', NULLIF(lower(btrim(p_provider_internet_message_id_hash)), ''),
    'providerEvidenceFingerprint', lower(p_provider_evidence_fingerprint),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id,
    provider_draft_id_hash, provider_conversation_id_hash,
    provider_internet_message_id_hash, provider_evidence_fingerprint,
    actor_type, reason, writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 5, p_outcome, p_reservation_id,
    NULLIF(lower(btrim(p_provider_draft_id_hash)), ''),
    NULLIF(lower(btrim(p_provider_conversation_id_hash)), ''),
    NULLIF(lower(btrim(p_provider_internet_message_id_hash)), ''),
    lower(p_provider_evidence_fingerprint),
    'service_role',
    CASE WHEN p_outcome = 'graph_draft_created' THEN NULL
         ELSE 'Graph createReply did not reach a safely reusable state.' END,
    p_writer_release, p_idempotency_key, event_fingerprint
  );
  IF p_outcome IN ('ambiguous', 'dead_lettered') THEN
    PERFORM private.gate3d1_engage_stops(
      claim.id,
      'Gate 3D.1 stopped after an uncertain or failed Graph draft mutation.'
    );
  END IF;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_gate3d1_canary_graph_draft_result(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_gate3d1_canary_graph_draft_result(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_gate3d1_canary_send_attempt(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_operating_strategy_version_id UUID,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE (
  claim_id UUID,
  provider_mutation_permit_fingerprint TEXT,
  provider_draft_id_hash TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  draft_event private.gate3d1_canary_dispatch_events;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  permit_fingerprint TEXT;
  event_fingerprint TEXT;
BEGIN
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Send-attempt idempotency is required.' USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL
    OR claim.operating_strategy_version_id IS DISTINCT FROM p_operating_strategy_version_id
    OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Send attempt does not match the exact claim.' USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = 'send_attempted' OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = 'send_attempted' DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    RAISE EXCEPTION 'The one-shot send permit was already consumed; reconcile and never resend.'
      USING ERRCODE = '23514';
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'graph_draft_created' THEN
    RAISE EXCEPTION 'Graph send may begin only from the exact persisted draft-created state.'
      USING ERRCODE = '23514';
  END IF;
  PERFORM 1
  FROM public.assert_operating_strategy_dispatch_authorized(
    p_reservation_id, p_operating_strategy_version_id, 'outlook_graph', p_writer_release
  );
  SELECT event.* INTO draft_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.event_type = 'graph_draft_created';
  IF draft_event.reservation_id IS DISTINCT FROM p_reservation_id THEN
    RAISE EXCEPTION 'Send attempt reservation does not match the immutable Graph draft.'
      USING ERRCODE = '23514';
  END IF;
  result_id := gen_random_uuid();
  permit_fingerprint := private.gate3d1_sha256_text(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 6,
    'eventType', 'send_attempted',
    'reservationId', p_reservation_id,
    'providerDraftIdHash', draft_event.provider_draft_id_hash,
    'draftEvidenceFingerprint', draft_event.provider_evidence_fingerprint,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  )::TEXT);
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 6,
    'eventType', 'send_attempted',
    'reservationId', p_reservation_id,
    'permitFingerprint', permit_fingerprint,
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id,
    provider_draft_id_hash, provider_conversation_id_hash,
    provider_internet_message_id_hash, provider_evidence_fingerprint,
    actor_type, writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 6, 'send_attempted', p_reservation_id,
    draft_event.provider_draft_id_hash, draft_event.provider_conversation_id_hash,
    draft_event.provider_internet_message_id_hash,
    draft_event.provider_evidence_fingerprint, 'service_role', p_writer_release,
    p_idempotency_key, event_fingerprint
  );
  -- Consuming the permit atomically re-engages both stops. A lost RPC response
  -- therefore cannot yield a second permit or an automatic resend.
  PERFORM private.gate3d1_engage_stops(
    claim.id,
    'Gate 3D.1 one-shot send permit consumed; founder reconciliation required.'
  );
  RETURN QUERY SELECT claim.id, permit_fingerprint,
    draft_event.provider_draft_id_hash, claim.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_gate3d1_canary_send_attempt(
  UUID, UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_gate3d1_canary_send_attempt(
  UUID, UUID, UUID, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_gate3d1_canary_send_result(
  p_claim_id UUID,
  p_reservation_id UUID,
  p_outcome TEXT,
  p_provider_evidence_fingerprint TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  attempt_event private.gate3d1_canary_dispatch_events;
  existing_event private.gate3d1_canary_dispatch_events;
  result_id UUID;
  event_fingerprint TEXT;
BEGIN
  IF p_outcome NOT IN ('accepted', 'ambiguous')
    OR lower(COALESCE(p_provider_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Send result requires accepted or ambiguous provider evidence.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Send result does not match the exact claim writer.' USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = p_outcome OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = p_outcome DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type IS DISTINCT FROM p_outcome
      OR existing_event.reservation_id IS DISTINCT FROM p_reservation_id
      OR existing_event.provider_evidence_fingerprint
        IS DISTINCT FROM lower(p_provider_evidence_fingerprint)
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Send-result replay conflicts with immutable provider evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  IF private.gate3d1_current_claim_state(p_claim_id) <> 'send_attempted' THEN
    RAISE EXCEPTION 'Send result must immediately follow the consumed one-shot permit.'
      USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO attempt_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id AND event.event_type = 'send_attempted';
  IF attempt_event.reservation_id IS DISTINCT FROM p_reservation_id THEN
    RAISE EXCEPTION 'Send result reservation does not match the consumed one-shot permit.'
      USING ERRCODE = '23514';
  END IF;
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', 7,
    'eventType', p_outcome,
    'reservationId', p_reservation_id,
    'providerDraftIdHash', attempt_event.provider_draft_id_hash,
    'providerEvidenceFingerprint', lower(p_provider_evidence_fingerprint),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, reservation_id,
    provider_draft_id_hash, provider_conversation_id_hash,
    provider_internet_message_id_hash, provider_evidence_fingerprint,
    actor_type, reason, writer_release, idempotency_key, event_fingerprint
  ) VALUES (
    result_id, claim.id, 7, p_outcome, p_reservation_id,
    attempt_event.provider_draft_id_hash, attempt_event.provider_conversation_id_hash,
    attempt_event.provider_internet_message_id_hash,
    lower(p_provider_evidence_fingerprint), 'service_role',
    CASE WHEN p_outcome = 'ambiguous'
      THEN 'Graph send outcome is uncertain and requires founder reconciliation.'
      ELSE NULL END,
    p_writer_release, p_idempotency_key, event_fingerprint
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_gate3d1_canary_send_result(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_gate3d1_canary_send_result(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_gate3d1_canary_dispatch(
  p_claim_id UUID,
  p_resolution TEXT,
  p_provider_evidence_fingerprint TEXT,
  p_actor_user_id UUID,
  p_reason TEXT,
  p_writer_release TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim private.gate3d1_canary_dispatch_claims;
  existing_event private.gate3d1_canary_dispatch_events;
  current_state TEXT;
  next_sequence INTEGER;
  result_id UUID;
  event_fingerprint TEXT;
BEGIN
  PERFORM private.gate3d1_assert_founder_actor(p_actor_user_id);
  IF p_resolution NOT IN ('reconciled_accepted', 'reconciled_not_sent', 'dead_lettered')
    OR lower(COALESCE(p_provider_evidence_fingerprint, '')) !~ '^[0-9a-f]{64}$'
    OR length(btrim(COALESCE(p_reason, ''))) < 20
    OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'Founder reconciliation requires a terminal resolution and exact provider evidence.'
      USING ERRCODE = '23514';
  END IF;
  SELECT candidate.* INTO claim
  FROM private.gate3d1_canary_dispatch_claims candidate
  WHERE candidate.id = p_claim_id
  FOR UPDATE;
  IF claim.id IS NULL OR claim.writer_release IS DISTINCT FROM p_writer_release THEN
    RAISE EXCEPTION 'Reconciliation does not match the exact claim writer.' USING ERRCODE = '23514';
  END IF;
  SELECT event.* INTO existing_event
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = p_claim_id
    AND (event.event_type = p_resolution OR event.idempotency_key = p_idempotency_key)
  ORDER BY event.event_type = p_resolution DESC
  LIMIT 1;
  IF existing_event.id IS NOT NULL THEN
    IF existing_event.event_type IS DISTINCT FROM p_resolution
      OR existing_event.provider_evidence_fingerprint
        IS DISTINCT FROM lower(p_provider_evidence_fingerprint)
      OR existing_event.actor_user_id IS DISTINCT FROM p_actor_user_id
      OR existing_event.reason IS DISTINCT FROM btrim(p_reason)
      OR existing_event.idempotency_key IS DISTINCT FROM p_idempotency_key THEN
      RAISE EXCEPTION 'Founder reconciliation replay conflicts with immutable evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_event.id;
  END IF;
  current_state := private.gate3d1_current_claim_state(p_claim_id);
  IF current_state NOT IN ('graph_draft_attempted', 'send_attempted', 'ambiguous') THEN
    RAISE EXCEPTION 'Only an uncertain provider state may enter founder reconciliation.'
      USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(MAX(event.sequence_number), 0) + 1 INTO next_sequence
  FROM private.gate3d1_canary_dispatch_events event
  WHERE event.claim_id = claim.id;
  result_id := gen_random_uuid();
  event_fingerprint := private.gate3c_canonical_fingerprint(jsonb_build_object(
    'eventId', result_id,
    'claimId', claim.id,
    'sequenceNumber', next_sequence,
    'eventType', p_resolution,
    'priorState', current_state,
    'providerEvidenceFingerprint', lower(p_provider_evidence_fingerprint),
    'actorUserId', p_actor_user_id,
    'reason', btrim(p_reason),
    'writerRelease', p_writer_release,
    'idempotencyKey', p_idempotency_key
  ));
  INSERT INTO private.gate3d1_canary_dispatch_events(
    id, claim_id, sequence_number, event_type, provider_evidence_fingerprint,
    actor_type, actor_user_id, reason, writer_release, idempotency_key,
    event_fingerprint
  ) VALUES (
    result_id, claim.id, next_sequence, p_resolution,
    lower(p_provider_evidence_fingerprint), 'founder', p_actor_user_id,
    btrim(p_reason), p_writer_release, p_idempotency_key, event_fingerprint
  );
  PERFORM private.gate3d1_engage_stops(
    claim.id,
    'Gate 3D.1 remains stopped after founder provider-state reconciliation.'
  );
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_gate3d1_canary_dispatch(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_gate3d1_canary_dispatch(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON TABLE private.inbound_reply_continuation_authorizations IS
  'Founder-reviewed, short-lived same-thread positive-reply continuation evidence; never marketing consent.';
COMMENT ON TABLE private.gate3d1_canary_dispatch_claims IS
  'Immutable lifetime one-recipient Gate 3D.1 dispatch claims.';
COMMENT ON TABLE private.gate3d1_canary_dispatch_events IS
  'Append-only one-shot dispatch state, provider evidence, and reconciliation ledger.';
COMMENT ON FUNCTION public.assert_operating_strategy_dispatch_authorized(
  UUID, UUID, TEXT, TEXT
) IS 'Service-only read-only fail-closed assertion immediately before each Graph provider mutation.';

DO $gate3d1_one_shot_postconditions$
BEGIN
  IF EXISTS (SELECT 1 FROM private.inbound_reply_continuation_authorizations)
    OR EXISTS (SELECT 1 FROM private.inbound_reply_continuation_revocations)
    OR EXISTS (SELECT 1 FROM private.exchange_application_rbac_attestations)
    OR EXISTS (SELECT 1 FROM private.exchange_application_rbac_attestation_revocations)
    OR EXISTS (SELECT 1 FROM private.gate3d1_canary_dispatch_claims)
    OR EXISTS (SELECT 1 FROM private.gate3d1_canary_dispatch_events) THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot migration must seed no authority or dispatch evidence.';
  END IF;
  IF (SELECT COUNT(*) FROM private.gate3d1_outbound_control_events) <> 18
    OR (SELECT COUNT(*) FROM private.gate3d1_outbound_control_events
        WHERE actor_type = 'migration' AND blocked_after) <> 18 THEN
    RAISE EXCEPTION 'Gate 3D.1 must preserve immutable fail-closed baseline events for one global and 17 strategy controls.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.operating_strategy_runtime_controls controls
    WHERE controls.control_key = 'canonical_binding'
      AND controls.enforcement_mode = 'compatibility'
      AND controls.canary_enforcement_status = 'disabled'
      AND controls.outbound_kill_switch
  ) OR EXISTS (
    SELECT 1 FROM public.operating_strategy_outbound_controls WHERE NOT paused
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 one-shot migration must leave every outbound stop engaged.';
  END IF;
  IF has_table_privilege('service_role', 'private.gate3d1_canary_dispatch_claims', 'SELECT')
    OR has_table_privilege('authenticated', 'private.inbound_reply_continuation_authorizations', 'SELECT')
    OR has_table_privilege('anon', 'private.gate3d1_canary_dispatch_events', 'SELECT') THEN
    RAISE EXCEPTION 'Gate 3D.1 private PII and claim ledgers must not be browser-readable.';
  END IF;
  IF NOT has_function_privilege(
      'service_role',
      'public.claim_gate3d1_canary_dispatch(uuid,uuid,uuid,uuid,text,text,text,text,text,text)',
      'EXECUTE'
    )
    OR NOT has_function_privilege(
      'service_role',
      'public.assert_operating_strategy_dispatch_authorized(uuid,uuid,text,text)',
      'EXECUTE'
    )
    OR NOT has_function_privilege(
      'service_role',
      'public.begin_gate3d1_canary_send_attempt(uuid,uuid,uuid,text,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'service_role',
      'public.record_inbound_reply_continuation_authorization(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,time without time zone,time without time zone,smallint[],timestamp with time zone,uuid,text,text,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'service_role',
      'public.reconcile_gate3d1_canary_dispatch(uuid,text,text,uuid,text,text,text)',
      'EXECUTE'
    ) THEN
    RAISE EXCEPTION 'Gate 3D.1 service and founder RPC grants are not least-privilege.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3D.1 must not enable n8n live sending.';
  END IF;
END
$gate3d1_one_shot_postconditions$;
