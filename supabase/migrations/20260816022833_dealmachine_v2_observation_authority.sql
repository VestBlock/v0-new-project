-- DealMachine v2 observation authority.
--
-- This migration is deliberately additive and fail-closed. It creates the
-- durable request, cost, raw-observation, normalization-link, strategy-source,
-- and operator-review boundaries needed before DealMachine can become a live
-- source. It does not enable the integration, activate a strategy, backfill a
-- historical DealMachine row, authorize outreach, or grant a paid-data budget.

DO $dealmachine_v2_preconditions$
BEGIN
  IF to_regclass('public.operating_strategy_versions') IS NULL
    OR to_regclass('public.operating_strategy_activities') IS NULL
    OR to_regprocedure(
      'public.resolve_operating_strategy_runtime(text,text,timestamp with time zone)'
    ) IS NULL
    OR to_regprocedure(
      'public.record_operating_strategy_activity(uuid,text,text,text,text,text,text,text,timestamp with time zone,uuid,text,text,uuid,uuid,uuid,text,timestamp with time zone,text,text,text,jsonb,jsonb,text,jsonb,jsonb)'
    ) IS NULL THEN
    RAISE EXCEPTION 'DealMachine v2 authority requires the Gate 3C governed-learning schema.';
  END IF;

  IF to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'DealMachine v2 authority requires pgcrypto digest(bytea,text) in the extensions schema.';
  END IF;
END
$dealmachine_v2_preconditions$;

CREATE SCHEMA IF NOT EXISTS private;

-- One privileged control row. The application service role can read but not
-- modify it. A later reviewed migration may increment control_version and
-- enable free count-only discovery or a tightly capped property sample.
CREATE TABLE public.dealmachine_v2_runtime_controls (
  control_key TEXT PRIMARY KEY DEFAULT 'primary' CHECK (control_key = 'primary'),
  control_version BIGINT NOT NULL DEFAULT 1 CHECK (control_version > 0),
  required_writer_release TEXT NOT NULL DEFAULT 'dealmachine_v2_observation_v1'
    CHECK (required_writer_release = 'dealmachine_v2_observation_v1'),
  integration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  maximum_operation TEXT NOT NULL DEFAULT 'count_only'
    CHECK (maximum_operation IN ('schema_read', 'count_only', 'property_sample')),
  allowed_operations_json JSONB NOT NULL DEFAULT
    '["schema_read","count_only"]'::JSONB
    CHECK (jsonb_typeof(allowed_operations_json) = 'array'),
  allowed_field_groups_json JSONB NOT NULL DEFAULT
    '["property","ownership","equity","listing","preforeclosure","tax","lien","lot","condition"]'::JSONB
    CHECK (jsonb_typeof(allowed_field_groups_json) = 'array'),
  denied_field_groups_json JSONB NOT NULL DEFAULT
    '["people","contacts","phone","email","demographics","income","wealth","credit","credit_behavior","health","insurance","politics","lifestyle","protected_class","protected_class_proxy"]'::JSONB
    CHECK (
      jsonb_typeof(denied_field_groups_json) = 'array'
      AND denied_field_groups_json @>
        '["people","contacts","demographics","credit","politics","protected_class","protected_class_proxy"]'::JSONB
    ),
  max_credits_per_run INTEGER NOT NULL DEFAULT 0 CHECK (max_credits_per_run >= 0),
  max_credits_per_day INTEGER NOT NULL DEFAULT 0 CHECK (max_credits_per_day >= 0),
  max_credits_per_month INTEGER NOT NULL DEFAULT 0 CHECK (max_credits_per_month >= 0),
  reservation_ttl_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (reservation_ttl_minutes BETWEEN 1 AND 60),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 365),
  change_reason TEXT NOT NULL DEFAULT 'Migration default: disabled, count-only, zero paid credits.'
    CHECK (NULLIF(btrim(change_reason), '') IS NOT NULL),
  changed_by_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT dealmachine_v2_controls_free_mode_budget_check CHECK (
    maximum_operation = 'property_sample'
    OR (
      max_credits_per_run = 0
      AND max_credits_per_day = 0
      AND max_credits_per_month = 0
      AND NOT (allowed_operations_json ? 'property_sample')
    )
  ),
  CONSTRAINT dealmachine_v2_controls_paid_budget_order_check CHECK (
    max_credits_per_run <= max_credits_per_day
    AND max_credits_per_day <= max_credits_per_month
  )
);

INSERT INTO public.dealmachine_v2_runtime_controls(control_key)
VALUES ('primary');

-- Credit reservations are immutable holds. Expired, released, consumed, and
-- ambiguous outcomes are represented by an append-only settlement ledger.
CREATE TABLE public.dealmachine_v2_credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key TEXT NOT NULL CHECK (NULLIF(btrim(run_key), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  operation TEXT NOT NULL CHECK (operation = 'property_sample'),
  reserved_credits INTEGER NOT NULL CHECK (reserved_credits > 0),
  control_version BIGINT NOT NULL CHECK (control_version > 0),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > reserved_at)
);

CREATE INDEX dealmachine_v2_credit_reservations_run_idx
  ON public.dealmachine_v2_credit_reservations(run_key, reserved_at DESC);
CREATE INDEX dealmachine_v2_credit_reservations_budget_window_idx
  ON public.dealmachine_v2_credit_reservations(reserved_at DESC);

CREATE TABLE public.dealmachine_v2_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE REFERENCES public.dealmachine_v2_credit_reservations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  control_version BIGINT NOT NULL CHECK (control_version > 0),
  run_key TEXT NOT NULL CHECK (NULLIF(btrim(run_key), '') IS NOT NULL),
  operation TEXT NOT NULL CHECK (operation IN ('schema_read', 'count_only', 'property_sample')),
  http_method TEXT NOT NULL CHECK (http_method IN ('GET', 'POST')),
  endpoint_path TEXT NOT NULL CHECK (endpoint_path ~ '^/[a-z0-9_/-]+$'),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  estimated_credits INTEGER NOT NULL DEFAULT 0 CHECK (estimated_credits >= 0),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  requested_at TIMESTAMPTZ NOT NULL,
  provider_call_claim_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  provider_call_claimed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (provider_call_claimed_at = recorded_at),
  CONSTRAINT dealmachine_v2_requests_credit_shape_check CHECK (
    (operation = 'property_sample' AND estimated_credits > 0 AND reservation_id IS NOT NULL)
    OR (operation <> 'property_sample' AND estimated_credits = 0 AND reservation_id IS NULL)
  )
);

CREATE INDEX dealmachine_v2_requests_run_idx
  ON public.dealmachine_v2_requests(run_key, recorded_at DESC);
CREATE INDEX dealmachine_v2_requests_operation_idx
  ON public.dealmachine_v2_requests(operation, recorded_at DESC);

CREATE TABLE public.dealmachine_v2_request_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.dealmachine_v2_requests(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'provider_response', 'provider_rejected', 'provider_ambiguous',
    'call_abandoned', 'schema_drift_blocked', 'policy_blocked', 'reconciled'
  )),
  provider_request_id TEXT,
  response_hash TEXT CHECK (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$'),
  actual_credits INTEGER CHECK (actual_credits IS NULL OR actual_credits >= 0),
  rate_limit_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(rate_limit_json) = 'object'),
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(evidence_json) = 'object'),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT dealmachine_v2_request_evidence_success_check CHECK (
    event_type <> 'provider_response'
    OR (
      NULLIF(btrim(provider_request_id), '') IS NOT NULL
      AND response_hash IS NOT NULL
      AND actual_credits IS NOT NULL
    )
  ),
  CONSTRAINT dealmachine_v2_request_evidence_provider_shape_check CHECK (
    provider_request_id IS NULL OR NULLIF(btrim(provider_request_id), '') IS NOT NULL
  )
);

CREATE UNIQUE INDEX dealmachine_v2_request_evidence_provider_request_uidx
  ON public.dealmachine_v2_request_evidence(provider_request_id)
  WHERE provider_request_id IS NOT NULL;
CREATE INDEX dealmachine_v2_request_evidence_request_idx
  ON public.dealmachine_v2_request_evidence(request_id, recorded_at DESC);
CREATE UNIQUE INDEX dealmachine_v2_request_evidence_one_terminal_uidx
  ON public.dealmachine_v2_request_evidence(request_id)
  WHERE event_type IN (
    'provider_response', 'provider_rejected', 'provider_ambiguous',
    'call_abandoned', 'schema_drift_blocked', 'policy_blocked'
  );

CREATE TABLE public.dealmachine_v2_credit_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL UNIQUE REFERENCES public.dealmachine_v2_credit_reservations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  request_id UUID NOT NULL UNIQUE REFERENCES public.dealmachine_v2_requests(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  disposition TEXT NOT NULL CHECK (disposition IN ('consumed', 'released', 'ambiguous')),
  actual_credits INTEGER,
  budgeted_credits INTEGER NOT NULL CHECK (budgeted_credits >= 0),
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(evidence_json) = 'object'),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT dealmachine_v2_credit_settlements_shape_check CHECK (
    (disposition = 'consumed' AND actual_credits IS NOT NULL AND budgeted_credits = actual_credits)
    OR (disposition = 'released' AND actual_credits = 0 AND budgeted_credits = 0)
    OR (disposition = 'ambiguous' AND actual_credits IS NULL AND budgeted_credits > 0)
  )
);

-- The immutable observation envelope contains provider identity, timing,
-- freshness, confidence, and payload hash. Raw JSON is isolated one-to-one so
-- a service-only retention RPC can physically erase it while keeping the
-- observation/evidence lineage append-only.
CREATE TABLE public.dealmachine_v2_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.dealmachine_v2_requests(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  provider_entity_type TEXT NOT NULL CHECK (provider_entity_type = 'property'),
  provider_entity_id TEXT NOT NULL CHECK (NULLIF(btrim(provider_entity_id), '') IS NOT NULL),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  schema_version TEXT NOT NULL CHECK (NULLIF(btrim(schema_version), '') IS NOT NULL),
  provider_updated_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  field_freshness_json JSONB NOT NULL CHECK (jsonb_typeof(field_freshness_json) = 'object'),
  confidence NUMERIC(6,5) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  retention_expires_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  UNIQUE (request_id, provider_entity_type, provider_entity_id, payload_hash),
  CHECK (provider_updated_at IS NULL OR provider_updated_at <= observed_at + INTERVAL '5 minutes'),
  CHECK (retention_expires_at > observed_at)
);

CREATE INDEX dealmachine_v2_observations_provider_entity_idx
  ON public.dealmachine_v2_observations(
    provider_entity_type, provider_entity_id, observed_at DESC
  );
CREATE INDEX dealmachine_v2_observations_retention_idx
  ON public.dealmachine_v2_observations(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL;

CREATE TABLE public.dealmachine_v2_observation_payloads (
  observation_id UUID PRIMARY KEY REFERENCES public.dealmachine_v2_observations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  raw_payload_json JSONB CHECK (
    raw_payload_json IS NULL OR jsonb_typeof(raw_payload_json) = 'object'
  ),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  retention_expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  deletion_evidence_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT dealmachine_v2_observation_payload_state_check CHECK (
    (raw_payload_json IS NOT NULL AND deleted_at IS NULL AND deletion_evidence_id IS NULL)
    OR (raw_payload_json IS NULL AND deleted_at IS NOT NULL AND deletion_evidence_id IS NOT NULL)
  )
);

CREATE TABLE public.dealmachine_v2_observation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.dealmachine_v2_observations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'retention_assigned', 'deletion_requested', 'deletion_completed',
    'legal_hold_applied', 'legal_hold_released', 'quality_quarantined'
  )),
  evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(evidence_json) = 'object'),
  actor_user_id UUID REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.dealmachine_v2_observation_payloads
  ADD CONSTRAINT dealmachine_v2_observation_payload_deletion_evidence_fkey
  FOREIGN KEY (deletion_evidence_id)
  REFERENCES public.dealmachine_v2_observation_evidence(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX dealmachine_v2_observation_evidence_observation_idx
  ON public.dealmachine_v2_observation_evidence(observation_id, recorded_at DESC);

CREATE TABLE public.dealmachine_v2_observation_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES public.dealmachine_v2_observations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  entity_namespace TEXT NOT NULL CHECK (entity_namespace = 'property'),
  entity_key TEXT NOT NULL CHECK (NULLIF(btrim(entity_key), '') IS NOT NULL),
  link_type TEXT NOT NULL CHECK (link_type IN (
    'provider_property_id', 'parcel', 'normalized_address'
  )),
  confidence NUMERIC(6,5) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(evidence_json) = 'object'),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (observation_id, entity_namespace, entity_key, link_type)
);

CREATE INDEX dealmachine_v2_observation_entity_links_entity_idx
  ON public.dealmachine_v2_observation_entity_links(
    entity_namespace, entity_key, linked_at DESC
  );

CREATE TABLE public.dealmachine_v2_source_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_entity_link_id UUID NOT NULL
    REFERENCES public.dealmachine_v2_observation_entity_links(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  observation_id UUID NOT NULL REFERENCES public.dealmachine_v2_observations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  operating_strategy_id UUID NOT NULL REFERENCES public.operating_strategies(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  operating_strategy_version_id UUID NOT NULL,
  canonical_activity_id UUID NOT NULL,
  source_namespace TEXT NOT NULL CHECK (source_namespace ~ '^[a-z0-9_]+$'),
  source_identifier TEXT NOT NULL CHECK (NULLIF(btrim(source_identifier), '') IS NOT NULL),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (observation_entity_link_id, operating_strategy_version_id, source_namespace, source_identifier),
  CONSTRAINT dealmachine_v2_source_attributions_version_parent_fkey
    FOREIGN KEY (operating_strategy_version_id, operating_strategy_id)
    REFERENCES public.operating_strategy_versions(id, operating_strategy_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT dealmachine_v2_source_attributions_activity_version_fkey
    FOREIGN KEY (canonical_activity_id, operating_strategy_version_id)
    REFERENCES public.operating_strategy_activities(id, operating_strategy_version_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX dealmachine_v2_source_attributions_observation_idx
  ON public.dealmachine_v2_source_attributions(observation_id, occurred_at DESC);
CREATE INDEX dealmachine_v2_source_attributions_version_idx
  ON public.dealmachine_v2_source_attributions(operating_strategy_version_id, occurred_at DESC);

CREATE TABLE public.dealmachine_v2_operator_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_entity_link_id UUID NOT NULL
    REFERENCES public.dealmachine_v2_observation_entity_links(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN (
    'needs_review', 'accepted_for_attribution', 'rejected',
    'duplicate', 'stale', 'conflict'
  )),
  reason_code TEXT NOT NULL CHECK (reason_code ~ '^[a-z0-9_]+$'),
  notes TEXT,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_json JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(evidence_json) = 'object'),
  outreach_authorized BOOLEAN NOT NULL DEFAULT FALSE CHECK (NOT outreach_authorized),
  customer_workflow_authorized BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (NOT customer_workflow_authorized),
  dispatch_authority TEXT NOT NULL DEFAULT 'none' CHECK (dispatch_authority = 'none'),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (NULLIF(btrim(idempotency_key), '') IS NOT NULL),
  writer_release TEXT NOT NULL CHECK (writer_release = 'dealmachine_v2_observation_v1'),
  reviewed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX dealmachine_v2_operator_reviews_link_idx
  ON public.dealmachine_v2_operator_reviews(observation_entity_link_id, reviewed_at DESC);

-- ---------------------------------------------------------------------------
-- Private validators and row guards.
-- ---------------------------------------------------------------------------

-- Compact recursive JSON canonicalization shared with the application writer:
-- object keys use bytewise C ordering, arrays preserve ordinality, and scalar
-- JSON text is emitted without jsonb's object whitespace. DealMachine field
-- names are ASCII, so C ordering is the same ordering used by the writer's
-- binary string comparison.
CREATE OR REPLACE FUNCTION private.dealmachine_v2_canonical_jsonb(p_value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  value_kind TEXT;
  canonical_value TEXT;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  value_kind := jsonb_typeof(p_value);
  IF value_kind = 'object' THEN
    SELECT '{' || COALESCE(string_agg(
      to_jsonb(member.key)::TEXT || ':' ||
        private.dealmachine_v2_canonical_jsonb(member.value),
      ',' ORDER BY member.key COLLATE "C"
    ), '') || '}'
      INTO canonical_value
    FROM jsonb_each(p_value) member;
    RETURN canonical_value;
  ELSIF value_kind = 'array' THEN
    SELECT '[' || COALESCE(string_agg(
      private.dealmachine_v2_canonical_jsonb(member.value),
      ',' ORDER BY member.ordinality
    ), '') || ']'
      INTO canonical_value
    FROM jsonb_array_elements(p_value) WITH ORDINALITY AS member(value, ordinality);
    RETURN canonical_value;
  ELSIF value_kind IN ('string', 'number', 'boolean', 'null') THEN
    RETURN p_value::TEXT;
  END IF;

  RAISE EXCEPTION 'Unsupported JSON value for DealMachine canonicalization.'
    USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_canonical_jsonb(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dealmachine_v2_canonical_jsonb(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION private.dealmachine_v2_sha256_jsonb(p_value JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT encode(
    extensions.digest(
      pg_catalog.convert_to(private.dealmachine_v2_canonical_jsonb(p_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_sha256_jsonb(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dealmachine_v2_sha256_jsonb(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION private.dealmachine_v2_contains_prohibited_key(p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  item RECORD;
  normalized_key TEXT;
BEGIN
  IF p_value IS NULL THEN
    RETURN FALSE;
  END IF;

  IF jsonb_typeof(p_value) = 'object' THEN
    FOR item IN SELECT key, value FROM jsonb_each(p_value)
    LOOP
      normalized_key := lower(regexp_replace(item.key, '[^a-z0-9]+', '_', 'g'));
      IF normalized_key ~ '(^|_)(phone|phones|mobile|email|emails|contact|contacts|person|persons|people|demographic|demographics|race|ethnicity|religion|gender|sex|marital|household|birth|health|medical|insurance|politic|politics|political|lifestyle|language|occupation|income|wealth|credit|credit_behavior|credit_product|credit_products|credit_score)(_|$)'
        OR normalized_key ~ '(^|_)owner_(1|2)_full_name($|_)'
        OR normalized_key ~ '(^|_)owner_name($|_)'
        OR normalized_key ~ '(^|_)mailing_address($|_)' THEN
        RETURN TRUE;
      END IF;
      IF private.dealmachine_v2_contains_prohibited_key(item.value) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(p_value)
    LOOP
      IF private.dealmachine_v2_contains_prohibited_key(item.value) THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_contains_prohibited_key(JSONB)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dealmachine_v2_contains_prohibited_key(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION private.dealmachine_v2_valid_field_freshness(
  p_value JSONB,
  p_observed_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  item RECORD;
  item_observed_at TIMESTAMPTZ;
  item_expires_at TIMESTAMPTZ;
  item_confidence NUMERIC;
BEGIN
  IF p_observed_at IS NULL
    OR jsonb_typeof(p_value) <> 'object'
    OR p_value = '{}'::JSONB
    OR private.dealmachine_v2_contains_prohibited_key(p_value) THEN
    RETURN FALSE;
  END IF;

  FOR item IN SELECT key, value FROM jsonb_each(p_value)
  LOOP
    IF item.key !~ '^[a-z0-9_]+$'
      OR jsonb_typeof(item.value) <> 'object'
      OR (
        item.value ? 'confidence'
        AND jsonb_typeof(item.value -> 'confidence') <> 'number'
      )
      OR NULLIF(btrim(item.value ->> 'observedAt'), '') IS NULL
      OR NULLIF(btrim(item.value ->> 'expiresAt'), '') IS NULL THEN
      RETURN FALSE;
    END IF;

    BEGIN
      item_observed_at := (item.value ->> 'observedAt')::TIMESTAMPTZ;
      item_expires_at := (item.value ->> 'expiresAt')::TIMESTAMPTZ;
      item_confidence := COALESCE((item.value ->> 'confidence')::NUMERIC, 1);
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;

    IF item_observed_at > p_observed_at + INTERVAL '5 minutes'
      OR item_expires_at <= item_observed_at
      OR item_confidence < 0
      OR item_confidence > 1 THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_valid_field_freshness(JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dealmachine_v2_valid_field_freshness(JSONB, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION private.dealmachine_v2_reject_append_only_change()
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

REVOKE ALL ON FUNCTION private.dealmachine_v2_reject_append_only_change()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_runtime_control_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item TEXT;
  distinct_count INTEGER;
  total_count INTEGER;
BEGIN
  IF NEW.control_key IS DISTINCT FROM OLD.control_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.required_writer_release IS DISTINCT FROM OLD.required_writer_release THEN
    RAISE EXCEPTION 'DealMachine control identity, creation time, and writer contract are immutable.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.control_version IS DISTINCT FROM OLD.control_version + 1 THEN
    RAISE EXCEPTION 'Every DealMachine control change must increment control_version exactly once.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT value)
    INTO total_count, distinct_count
  FROM jsonb_array_elements_text(NEW.allowed_operations_json);
  IF total_count <> distinct_count THEN
    RAISE EXCEPTION 'DealMachine allowed operations cannot contain duplicates.'
      USING ERRCODE = '23514';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements_text(NEW.allowed_operations_json)
  LOOP
    IF item NOT IN ('schema_read', 'count_only', 'property_sample') THEN
      RAISE EXCEPTION 'Unsupported DealMachine operation in allowlist: %', item
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF NEW.maximum_operation = 'property_sample' AND (
    NOT (NEW.allowed_operations_json ? 'property_sample')
    OR NEW.max_credits_per_run < 1
    OR NEW.max_credits_per_day < NEW.max_credits_per_run
    OR NEW.max_credits_per_month < NEW.max_credits_per_day
  ) THEN
    RAISE EXCEPTION 'A paid property sample needs an explicit operation and ordered positive budgets.'
      USING ERRCODE = '23514';
  END IF;

  IF (NEW.maximum_operation = 'schema_read' AND (
      NEW.allowed_operations_json ? 'count_only'
      OR NEW.allowed_operations_json ? 'property_sample'
    ))
    OR (NEW.maximum_operation = 'count_only'
      AND NEW.allowed_operations_json ? 'property_sample') THEN
    RAISE EXCEPTION 'DealMachine operation allowlist exceeds maximum_operation.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (
    NEW.denied_field_groups_json @>
      '["people","contacts","demographics","credit","politics","protected_class","protected_class_proxy"]'::JSONB
  ) THEN
    RAISE EXCEPTION 'Core sensitive DealMachine groups cannot be removed from the denylist.'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_runtime_control_update()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_runtime_controls_update_guard
BEFORE UPDATE ON public.dealmachine_v2_runtime_controls
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_runtime_control_update();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_credit_reservation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controls public.dealmachine_v2_runtime_controls;
  current_run BIGINT;
  current_day BIGINT;
  current_month BIGINT;
  database_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vestblock:dealmachine:v2:credit-reservations', 0)
  );

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';

  IF NOT FOUND
    OR NOT controls.integration_enabled
    OR controls.maximum_operation <> 'property_sample'
    OR NOT (controls.allowed_operations_json ? 'property_sample') THEN
    RAISE EXCEPTION 'Paid DealMachine property search is disabled.'
      USING ERRCODE = '23514';
  END IF;

  NEW.run_key := btrim(NEW.run_key);
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.operation := lower(btrim(NEW.operation));
  NEW.writer_release := btrim(NEW.writer_release);
  NEW.control_version := controls.control_version;
  NEW.reserved_at := database_now;
  NEW.expires_at := database_now + make_interval(mins => controls.reservation_ttl_minutes);

  IF NEW.writer_release IS DISTINCT FROM controls.required_writer_release THEN
    RAISE EXCEPTION 'Unsupported DealMachine writer release.' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(SUM(CASE
      WHEN settlement.id IS NULL
        AND (claimed_request.id IS NOT NULL OR reservation.expires_at > database_now)
        THEN reservation.reserved_credits
      WHEN settlement.disposition = 'consumed' THEN settlement.actual_credits
      WHEN settlement.disposition = 'ambiguous' THEN reservation.reserved_credits
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN (reservation.reserved_at AT TIME ZONE 'UTC')::DATE =
          (database_now AT TIME ZONE 'UTC')::DATE THEN
        CASE
          WHEN settlement.id IS NULL
            AND (claimed_request.id IS NOT NULL OR reservation.expires_at > database_now)
            THEN reservation.reserved_credits
          WHEN settlement.disposition = 'consumed' THEN settlement.actual_credits
          WHEN settlement.disposition = 'ambiguous' THEN reservation.reserved_credits
          ELSE 0
        END
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN date_trunc('month', reservation.reserved_at AT TIME ZONE 'UTC') =
          date_trunc('month', database_now AT TIME ZONE 'UTC') THEN
        CASE
          WHEN settlement.id IS NULL
            AND (claimed_request.id IS NOT NULL OR reservation.expires_at > database_now)
            THEN reservation.reserved_credits
          WHEN settlement.disposition = 'consumed' THEN settlement.actual_credits
          WHEN settlement.disposition = 'ambiguous' THEN reservation.reserved_credits
          ELSE 0
        END
      ELSE 0
    END), 0)
    INTO current_run, current_day, current_month
  FROM public.dealmachine_v2_credit_reservations reservation
  LEFT JOIN public.dealmachine_v2_credit_settlements settlement
    ON settlement.reservation_id = reservation.id
  LEFT JOIN public.dealmachine_v2_requests claimed_request
    ON claimed_request.reservation_id = reservation.id
  WHERE reservation.run_key = NEW.run_key
     OR (reservation.reserved_at AT TIME ZONE 'UTC')::DATE =
        (database_now AT TIME ZONE 'UTC')::DATE
     OR date_trunc('month', reservation.reserved_at AT TIME ZONE 'UTC') =
        date_trunc('month', database_now AT TIME ZONE 'UTC');

  -- The first aggregate above currently includes every row admitted by the
  -- day/month OR predicates. Recompute run scope exactly before enforcing it.
  SELECT COALESCE(SUM(CASE
      WHEN settlement.id IS NULL
        AND (claimed_request.id IS NOT NULL OR reservation.expires_at > database_now)
        THEN reservation.reserved_credits
      WHEN settlement.disposition = 'consumed' THEN settlement.actual_credits
      WHEN settlement.disposition = 'ambiguous' THEN reservation.reserved_credits
      ELSE 0
    END), 0)
    INTO current_run
  FROM public.dealmachine_v2_credit_reservations reservation
  LEFT JOIN public.dealmachine_v2_credit_settlements settlement
    ON settlement.reservation_id = reservation.id
  LEFT JOIN public.dealmachine_v2_requests claimed_request
    ON claimed_request.reservation_id = reservation.id
  WHERE reservation.run_key = NEW.run_key;

  IF NEW.reserved_credits > controls.max_credits_per_run
    OR current_run + NEW.reserved_credits > controls.max_credits_per_run
    OR current_day + NEW.reserved_credits > controls.max_credits_per_day
    OR current_month + NEW.reserved_credits > controls.max_credits_per_month THEN
    RAISE EXCEPTION 'DealMachine credit reservation exceeds a run, UTC-day, or UTC-month budget.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_credit_reservation_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_credit_reservations_insert_guard
BEFORE INSERT ON public.dealmachine_v2_credit_reservations
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_credit_reservation_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  controls public.dealmachine_v2_runtime_controls;
  reservation public.dealmachine_v2_credit_reservations;
  database_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';

  IF NOT FOUND OR NOT controls.integration_enabled THEN
    RAISE EXCEPTION 'DealMachine v2 requests are disabled.' USING ERRCODE = '23514';
  END IF;

  NEW.run_key := btrim(NEW.run_key);
  NEW.operation := lower(btrim(NEW.operation));
  NEW.http_method := upper(btrim(NEW.http_method));
  NEW.endpoint_path := lower(btrim(NEW.endpoint_path));
  NEW.request_hash := lower(btrim(NEW.request_hash));
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);
  NEW.control_version := controls.control_version;
  NEW.recorded_at := database_now;
  NEW.provider_call_claimed_at := database_now;

  IF NEW.writer_release IS DISTINCT FROM controls.required_writer_release
    OR NOT (controls.allowed_operations_json ? NEW.operation)
    OR (NEW.operation = 'schema_read'
      AND controls.maximum_operation NOT IN ('schema_read', 'count_only', 'property_sample'))
    OR (NEW.operation = 'count_only'
      AND controls.maximum_operation NOT IN ('count_only', 'property_sample'))
    OR (NEW.operation = 'property_sample'
      AND controls.maximum_operation <> 'property_sample') THEN
    RAISE EXCEPTION 'DealMachine operation or writer release is not allowed by current controls.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.requested_at < database_now - INTERVAL '24 hours'
    OR NEW.requested_at > database_now + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine request time is outside the accepted recording window.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (
    (
      NEW.operation = 'schema_read'
      AND NEW.http_method = 'GET'
      AND NEW.endpoint_path IN (
        '/account', '/subscription', '/usage', '/filters', '/fields', '/locations'
      )
    )
    OR (
      NEW.operation = 'count_only'
      AND NEW.http_method = 'POST'
      AND NEW.endpoint_path = '/properties/search/count'
    )
    OR (
      NEW.operation = 'property_sample'
      AND NEW.http_method = 'POST'
      AND NEW.endpoint_path = '/properties/search'
    )
  ) THEN
    RAISE EXCEPTION 'DealMachine request does not match the immutable endpoint allowlist.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.operation = 'property_sample' THEN
    IF controls.maximum_operation <> 'property_sample' OR NEW.reservation_id IS NULL THEN
      RAISE EXCEPTION 'Paid property search requires property-sample mode and a reservation.'
        USING ERRCODE = '23514';
    END IF;
    SELECT candidate.* INTO reservation
    FROM public.dealmachine_v2_credit_reservations candidate
    WHERE candidate.id = NEW.reservation_id;
    IF NOT FOUND
      OR reservation.run_key IS DISTINCT FROM NEW.run_key
      OR reservation.operation IS DISTINCT FROM NEW.operation
      OR reservation.reserved_credits IS DISTINCT FROM NEW.estimated_credits
      OR reservation.control_version IS DISTINCT FROM NEW.control_version
      OR reservation.writer_release IS DISTINCT FROM NEW.writer_release
      OR reservation.expires_at <= database_now THEN
      RAISE EXCEPTION 'DealMachine request does not match a current credit reservation.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.estimated_credits <> 0 OR NEW.reservation_id IS NOT NULL THEN
    RAISE EXCEPTION 'Free DealMachine operations cannot reserve or estimate credits.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_request_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_requests_insert_guard
BEFORE INSERT ON public.dealmachine_v2_requests
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_request_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_request_evidence_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_record public.dealmachine_v2_requests;
  reserved_credits INTEGER;
BEGIN
  SELECT candidate.* INTO request_record
  FROM public.dealmachine_v2_requests candidate
  WHERE candidate.id = NEW.request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine request evidence requires a request.'
      USING ERRCODE = '23503';
  END IF;

  NEW.event_type := lower(btrim(NEW.event_type));
  NEW.provider_request_id := NULLIF(btrim(NEW.provider_request_id), '');
  NEW.response_hash := lower(NULLIF(btrim(NEW.response_hash), ''));
  NEW.idempotency_key := btrim(NEW.idempotency_key);

  IF NEW.recorded_at < request_record.recorded_at - INTERVAL '5 minutes'
    OR NEW.recorded_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine request evidence time is inconsistent with its request.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type IN (
    'provider_response', 'provider_rejected', 'provider_ambiguous',
    'call_abandoned', 'schema_drift_blocked', 'policy_blocked'
  ) AND EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_request_evidence prior
    WHERE prior.request_id = NEW.request_id
      AND prior.event_type IN (
        'provider_response', 'provider_rejected', 'provider_ambiguous',
        'call_abandoned', 'schema_drift_blocked', 'policy_blocked'
      )
  ) THEN
    RAISE EXCEPTION 'A DealMachine one-shot provider claim already has terminal evidence.'
      USING ERRCODE = '23505';
  END IF;

  IF NEW.event_type = 'reconciled' AND NOT EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_request_evidence prior
    WHERE prior.request_id = NEW.request_id
      AND prior.event_type = 'provider_ambiguous'
  ) THEN
    RAISE EXCEPTION 'DealMachine reconciliation requires a prior ambiguous provider outcome.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'provider_response' THEN
    IF request_record.reservation_id IS NULL THEN
      IF NEW.actual_credits IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'Free DealMachine operations must report zero actual credits.'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT reservation.reserved_credits INTO reserved_credits
      FROM public.dealmachine_v2_credit_reservations reservation
      WHERE reservation.id = request_record.reservation_id;
      IF NEW.actual_credits > reserved_credits THEN
        RAISE EXCEPTION 'DealMachine actual credits exceed the reserved maximum.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF NEW.event_type = 'reconciled' THEN
    IF NEW.actual_credits IS NULL THEN
      RAISE EXCEPTION 'Reconciled DealMachine evidence requires actual credits.'
        USING ERRCODE = '23514';
    END IF;
    IF request_record.reservation_id IS NULL THEN
      IF NEW.actual_credits <> 0 THEN
        RAISE EXCEPTION 'Free DealMachine reconciliation must report zero actual credits.'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT reservation.reserved_credits INTO reserved_credits
      FROM public.dealmachine_v2_credit_reservations reservation
      WHERE reservation.id = request_record.reservation_id;
      IF NEW.actual_credits > reserved_credits THEN
        RAISE EXCEPTION 'Reconciled DealMachine credits exceed the reserved maximum.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF NEW.event_type = 'provider_ambiguous'
    AND NEW.actual_credits IS NOT NULL THEN
    RAISE EXCEPTION 'Ambiguous provider evidence cannot assert actual credits.'
      USING ERRCODE = '23514';
  ELSIF NEW.event_type IN (
    'provider_rejected', 'call_abandoned', 'schema_drift_blocked', 'policy_blocked'
  )
    AND COALESCE(NEW.actual_credits, 0) <> 0 THEN
    RAISE EXCEPTION 'Definitively blocked DealMachine work must report zero credits.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_request_evidence_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_request_evidence_insert_guard
BEFORE INSERT ON public.dealmachine_v2_request_evidence
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_request_evidence_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_credit_settlement_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_record public.dealmachine_v2_requests;
  reservation public.dealmachine_v2_credit_reservations;
BEGIN
  SELECT candidate.* INTO request_record
  FROM public.dealmachine_v2_requests candidate
  WHERE candidate.id = NEW.request_id;
  IF NOT FOUND OR request_record.reservation_id IS DISTINCT FROM NEW.reservation_id THEN
    RAISE EXCEPTION 'DealMachine settlement does not match its request reservation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO reservation
  FROM public.dealmachine_v2_credit_reservations candidate
  WHERE candidate.id = NEW.reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine settlement requires a reservation.'
      USING ERRCODE = '23503';
  END IF;

  NEW.disposition := lower(btrim(NEW.disposition));
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := request_record.writer_release;

  IF NEW.settled_at < reservation.reserved_at
    OR NEW.settled_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine settlement time is inconsistent with its reservation.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.disposition = 'consumed' THEN
    IF NEW.actual_credits IS NULL OR NEW.actual_credits > reservation.reserved_credits THEN
      RAISE EXCEPTION 'Consumed DealMachine credits must fit within the reservation.'
        USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.dealmachine_v2_request_evidence evidence
      WHERE evidence.request_id = NEW.request_id
        AND evidence.event_type IN ('provider_response', 'reconciled')
        AND evidence.actual_credits = NEW.actual_credits
    ) THEN
      RAISE EXCEPTION 'Consumed credits require matching success or reconciliation evidence.'
        USING ERRCODE = '23514';
    END IF;
    NEW.budgeted_credits := NEW.actual_credits;
  ELSIF NEW.disposition = 'released' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.dealmachine_v2_request_evidence evidence
      WHERE evidence.request_id = NEW.request_id
        AND evidence.event_type IN (
          'provider_rejected', 'call_abandoned', 'schema_drift_blocked', 'policy_blocked'
        )
    ) THEN
      RAISE EXCEPTION 'Released credits require definitive no-charge evidence.'
        USING ERRCODE = '23514';
    END IF;
    NEW.actual_credits := 0;
    NEW.budgeted_credits := 0;
  ELSIF NEW.disposition = 'ambiguous' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.dealmachine_v2_request_evidence evidence
      WHERE evidence.request_id = NEW.request_id
        AND evidence.event_type = 'provider_ambiguous'
    ) THEN
      RAISE EXCEPTION 'Ambiguous credit settlement requires ambiguous-failure evidence.'
        USING ERRCODE = '23514';
    END IF;
    NEW.actual_credits := NULL;
    NEW.budgeted_credits := reservation.reserved_credits;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_credit_settlement_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_credit_settlements_insert_guard
BEFORE INSERT ON public.dealmachine_v2_credit_settlements
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_credit_settlement_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_observation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_record public.dealmachine_v2_requests;
  controls public.dealmachine_v2_runtime_controls;
  database_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT candidate.* INTO request_record
  FROM public.dealmachine_v2_requests candidate
  WHERE candidate.id = NEW.request_id;
  IF NOT FOUND OR request_record.operation <> 'property_sample' THEN
    RAISE EXCEPTION 'A DealMachine property observation requires a paid property-search request.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dealmachine_v2_request_evidence evidence
    WHERE evidence.request_id = NEW.request_id
      AND evidence.event_type = 'provider_response'
  ) THEN
    RAISE EXCEPTION 'A DealMachine observation requires immutable success evidence first.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';

  NEW.provider_entity_type := lower(btrim(NEW.provider_entity_type));
  NEW.provider_entity_id := btrim(NEW.provider_entity_id);
  NEW.payload_hash := lower(btrim(NEW.payload_hash));
  NEW.schema_version := btrim(NEW.schema_version);
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);
  NEW.ingested_at := database_now;

  IF NEW.writer_release IS DISTINCT FROM request_record.writer_release
    OR NEW.writer_release IS DISTINCT FROM controls.required_writer_release THEN
    RAISE EXCEPTION 'DealMachine observation writer does not match the request authority.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.observed_at < request_record.requested_at - INTERVAL '5 minutes'
    OR NEW.observed_at > database_now + INTERVAL '5 minutes'
    OR NEW.retention_expires_at >
      NEW.observed_at + make_interval(days => controls.retention_days) THEN
    RAISE EXCEPTION 'DealMachine observation or retention time is outside its governed window.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT private.dealmachine_v2_valid_field_freshness(
    NEW.field_freshness_json,
    NEW.observed_at
  ) THEN
    RAISE EXCEPTION 'DealMachine field freshness is incomplete, invalid, or sensitive.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_observation_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_observations_insert_guard
BEFORE INSERT ON public.dealmachine_v2_observations
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_observation_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_observation_payload_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  observation public.dealmachine_v2_observations;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT candidate.* INTO observation
    FROM public.dealmachine_v2_observations candidate
    WHERE candidate.id = NEW.observation_id;
    IF NOT FOUND
      OR NEW.payload_hash IS DISTINCT FROM observation.payload_hash
      OR NEW.retention_expires_at IS DISTINCT FROM observation.retention_expires_at
      OR NEW.raw_payload_json IS NULL
      OR private.dealmachine_v2_contains_prohibited_key(NEW.raw_payload_json) THEN
      RAISE EXCEPTION 'DealMachine raw payload does not match a safe immutable observation.'
        USING ERRCODE = '23514';
    END IF;
    NEW.created_at := clock_timestamp();
    RETURN NEW;
  END IF;

  IF OLD.raw_payload_json IS NULL
    OR OLD.deleted_at IS NOT NULL
    OR NEW.raw_payload_json IS NOT NULL
    OR NEW.deleted_at IS NULL
    OR NEW.deletion_evidence_id IS NULL
    OR NEW.observation_id IS DISTINCT FROM OLD.observation_id
    OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
    OR NEW.retention_expires_at IS DISTINCT FROM OLD.retention_expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NOT EXISTS (
      SELECT 1
      FROM public.dealmachine_v2_observation_evidence evidence
      WHERE evidence.id = NEW.deletion_evidence_id
        AND evidence.observation_id = NEW.observation_id
        AND evidence.event_type = 'deletion_completed'
        AND evidence.recorded_at = NEW.deleted_at
    ) THEN
    RAISE EXCEPTION 'DealMachine raw payload permits only an evidenced one-way deletion.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_observation_payload_change()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_observation_payloads_change_guard
BEFORE INSERT OR UPDATE ON public.dealmachine_v2_observation_payloads
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_observation_payload_change();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_observation_evidence_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  observation public.dealmachine_v2_observations;
BEGIN
  SELECT candidate.* INTO observation
  FROM public.dealmachine_v2_observations candidate
  WHERE candidate.id = NEW.observation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine observation evidence requires an observation.'
      USING ERRCODE = '23503';
  END IF;

  NEW.event_type := lower(btrim(NEW.event_type));
  NEW.evidence_hash := lower(btrim(NEW.evidence_hash));
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);

  IF NEW.writer_release IS DISTINCT FROM observation.writer_release
    OR private.dealmachine_v2_sha256_jsonb(NEW.evidence_json) IS DISTINCT FROM NEW.evidence_hash
    OR NEW.recorded_at < observation.ingested_at - INTERVAL '5 minutes'
    OR NEW.recorded_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine observation evidence is inconsistent with its authority.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'retention_assigned' AND (
    (NEW.evidence_json ->> 'retentionExpiresAt')::TIMESTAMPTZ IS DISTINCT FROM
      observation.retention_expires_at
  ) THEN
    RAISE EXCEPTION 'Retention evidence must repeat the immutable expiry timestamp.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'deletion_completed' AND (
    NULLIF(btrim(NEW.evidence_json ->> 'reasonCode'), '') IS NULL
    OR NEW.evidence_json ->> 'payloadDeleted' IS DISTINCT FROM 'true'
  ) THEN
    RAISE EXCEPTION 'Deletion completion requires a reason and physical-payload proof.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_observation_evidence_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_observation_evidence_insert_guard
BEFORE INSERT ON public.dealmachine_v2_observation_evidence
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_observation_evidence_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_observation_entity_link_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  observation public.dealmachine_v2_observations;
BEGIN
  SELECT candidate.* INTO observation
  FROM public.dealmachine_v2_observations candidate
  WHERE candidate.id = NEW.observation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine entity link requires an observation.'
      USING ERRCODE = '23503';
  END IF;

  NEW.entity_namespace := lower(btrim(NEW.entity_namespace));
  NEW.entity_key := btrim(NEW.entity_key);
  NEW.link_type := lower(btrim(NEW.link_type));
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);

  IF NEW.writer_release IS DISTINCT FROM observation.writer_release
    OR NEW.linked_at < observation.observed_at
    OR NEW.linked_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine entity link is inconsistent with its observation.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.entity_namespace <> 'property' THEN
    RAISE EXCEPTION 'DealMachine phase-one observations may link only to a property entity.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_observation_entity_link_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_observation_entity_links_insert_guard
BEFORE INSERT ON public.dealmachine_v2_observation_entity_links
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_observation_entity_link_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_source_attribution_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  link_record public.dealmachine_v2_observation_entity_links;
  activity RECORD;
  latest_review_decision TEXT;
  expected_activity_key TEXT;
BEGIN
  SELECT candidate.* INTO link_record
  FROM public.dealmachine_v2_observation_entity_links candidate
  WHERE candidate.id = NEW.observation_entity_link_id;
  IF NOT FOUND OR link_record.observation_id IS DISTINCT FROM NEW.observation_id THEN
    RAISE EXCEPTION 'DealMachine attribution does not match its observation/entity link.'
      USING ERRCODE = '23514';
  END IF;

  SELECT review.decision INTO latest_review_decision
  FROM public.dealmachine_v2_operator_reviews review
  WHERE review.observation_entity_link_id = link_record.id
    AND review.reviewed_at <= NEW.occurred_at
  ORDER BY review.reviewed_at DESC, review.recorded_at DESC, review.id DESC
  LIMIT 1;
  IF latest_review_decision IS DISTINCT FROM 'accepted_for_attribution' THEN
    RAISE EXCEPTION 'DealMachine source attribution requires the latest prior operator review to accept attribution.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.*, version.status AS version_status
    INTO activity
  FROM public.operating_strategy_activities candidate
  JOIN public.operating_strategy_versions version
    ON version.id = candidate.operating_strategy_version_id
  WHERE candidate.id = NEW.canonical_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine attribution requires canonical Gate 3C source activity.'
      USING ERRCODE = '23503';
  END IF;

  expected_activity_key := NEW.observation_entity_link_id::TEXT || ':' ||
    NEW.source_namespace || ':' || NEW.source_identifier;

  IF activity.version_status <> 'active'
    OR activity.activity_type <> 'source'
    OR activity.activity_namespace <> 'dealmachine_observation_entity'
    OR activity.activity_key IS DISTINCT FROM expected_activity_key
    OR activity.subject_namespace IS DISTINCT FROM link_record.entity_namespace
    OR activity.subject_key IS DISTINCT FROM link_record.entity_key
    OR activity.source_namespace IS DISTINCT FROM NEW.source_namespace
    OR activity.source_identifier IS DISTINCT FROM NEW.source_identifier
    OR activity.operating_strategy_id IS DISTINCT FROM NEW.operating_strategy_id
    OR activity.operating_strategy_version_id IS DISTINCT FROM NEW.operating_strategy_version_id
    OR activity.occurred_at IS DISTINCT FROM NEW.occurred_at
    OR activity.writer_release IS DISTINCT FROM NEW.writer_release THEN
    RAISE EXCEPTION 'DealMachine attribution must bind the exact active Gate 3C source activity.'
      USING ERRCODE = '23514';
  END IF;

  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);
  NEW.recorded_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_source_attribution_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_source_attributions_insert_guard
BEFORE INSERT ON public.dealmachine_v2_source_attributions
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_source_attribution_insert();

CREATE OR REPLACE FUNCTION private.dealmachine_v2_guard_operator_review_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  link_record public.dealmachine_v2_observation_entity_links;
BEGIN
  SELECT candidate.* INTO link_record
  FROM public.dealmachine_v2_observation_entity_links candidate
  WHERE candidate.id = NEW.observation_entity_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine operator review requires an observation/entity link.'
      USING ERRCODE = '23503';
  END IF;

  NEW.decision := lower(btrim(NEW.decision));
  NEW.reason_code := lower(btrim(NEW.reason_code));
  NEW.idempotency_key := btrim(NEW.idempotency_key);
  NEW.writer_release := btrim(NEW.writer_release);

  IF NEW.writer_release IS DISTINCT FROM link_record.writer_release
    OR NEW.reviewed_at < link_record.linked_at
    OR NEW.reviewed_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine review is inconsistent with its normalized entity link.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(NEW.outreach_authorized, FALSE)
    OR COALESCE(NEW.customer_workflow_authorized, FALSE)
    OR NEW.dispatch_authority IS DISTINCT FROM 'none' THEN
    RAISE EXCEPTION 'DealMachine operator review cannot authorize outreach or a customer workflow.'
      USING ERRCODE = '23514';
  END IF;

  NEW.outreach_authorized := FALSE;
  NEW.customer_workflow_authorized := FALSE;
  NEW.dispatch_authority := 'none';
  NEW.recorded_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.dealmachine_v2_guard_operator_review_insert()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER dealmachine_v2_operator_reviews_insert_guard
BEFORE INSERT ON public.dealmachine_v2_operator_reviews
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_guard_operator_review_insert();

-- Immutable ledgers reject UPDATE, DELETE, and TRUNCATE even if a future grant
-- is made accidentally. Raw payload rows use their specialized one-way-delete
-- trigger for UPDATE and the shared guard for DELETE/TRUNCATE.
DO $dealmachine_v2_append_only_triggers$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'dealmachine_v2_credit_reservations',
    'dealmachine_v2_requests',
    'dealmachine_v2_request_evidence',
    'dealmachine_v2_credit_settlements',
    'dealmachine_v2_observations',
    'dealmachine_v2_observation_evidence',
    'dealmachine_v2_observation_entity_links',
    'dealmachine_v2_source_attributions',
    'dealmachine_v2_operator_reviews'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_reject_append_only_change()',
      table_name || '_append_only_guard',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.dealmachine_v2_reject_append_only_change()',
      table_name || '_truncate_guard',
      table_name
    );
  END LOOP;
END
$dealmachine_v2_append_only_triggers$;

CREATE TRIGGER dealmachine_v2_observation_payloads_delete_guard
BEFORE DELETE ON public.dealmachine_v2_observation_payloads
FOR EACH ROW EXECUTE FUNCTION private.dealmachine_v2_reject_append_only_change();
CREATE TRIGGER dealmachine_v2_observation_payloads_truncate_guard
BEFORE TRUNCATE ON public.dealmachine_v2_observation_payloads
FOR EACH STATEMENT EXECUTE FUNCTION private.dealmachine_v2_reject_append_only_change();

-- ---------------------------------------------------------------------------
-- Public service-role RPC contract. Public-schema RPCs remain SECURITY
-- INVOKER; privileged maintenance and hashing implementations live only in
-- the private schema with an empty search_path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_dealmachine_v2_runtime_control()
RETURNS TABLE (
  control_version BIGINT,
  required_writer_release TEXT,
  integration_enabled BOOLEAN,
  maximum_operation TEXT,
  max_credits_per_run INTEGER,
  max_credits_per_day INTEGER,
  max_credits_per_month INTEGER,
  reservation_ttl_minutes INTEGER,
  retention_days INTEGER,
  allowed_operations_json JSONB,
  allowed_field_groups_json JSONB,
  denied_field_groups_json JSONB
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    controls.control_version,
    controls.required_writer_release,
    controls.integration_enabled,
    controls.maximum_operation,
    controls.max_credits_per_run,
    controls.max_credits_per_day,
    controls.max_credits_per_month,
    controls.reservation_ttl_minutes,
    controls.retention_days,
    controls.allowed_operations_json,
    controls.allowed_field_groups_json,
    controls.denied_field_groups_json
  FROM public.dealmachine_v2_runtime_controls controls
  WHERE controls.control_key = 'primary';
$$;

REVOKE ALL ON FUNCTION public.get_dealmachine_v2_runtime_control()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dealmachine_v2_runtime_control() TO service_role;

CREATE OR REPLACE FUNCTION public.begin_dealmachine_v2_request(
  p_run_key TEXT,
  p_idempotency_key TEXT,
  p_operation TEXT,
  p_http_method TEXT,
  p_endpoint_path TEXT,
  p_request_hash TEXT,
  p_estimated_credits INTEGER,
  p_writer_release TEXT,
  p_requested_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  request_id UUID,
  reservation_id UUID,
  control_version BIGINT,
  reserved_credits INTEGER,
  provider_call_claim_id UUID,
  should_execute BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  controls public.dealmachine_v2_runtime_controls;
  existing_request public.dealmachine_v2_requests;
  new_request_id UUID := gen_random_uuid();
  new_reservation_id UUID;
  existing_reserved_credits INTEGER := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('vestblock:dealmachine:v2:requests', 0)
  );

  p_run_key := btrim(p_run_key);
  p_idempotency_key := btrim(p_idempotency_key);
  p_operation := lower(btrim(p_operation));
  p_http_method := upper(btrim(p_http_method));
  p_endpoint_path := lower(btrim(p_endpoint_path));
  p_request_hash := lower(btrim(p_request_hash));
  p_writer_release := btrim(p_writer_release);

  SELECT candidate.* INTO existing_request
  FROM public.dealmachine_v2_requests candidate
  WHERE candidate.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_request.run_key IS DISTINCT FROM p_run_key
      OR existing_request.operation IS DISTINCT FROM p_operation
      OR existing_request.http_method IS DISTINCT FROM p_http_method
      OR existing_request.endpoint_path IS DISTINCT FROM p_endpoint_path
      OR existing_request.request_hash IS DISTINCT FROM p_request_hash
      OR existing_request.estimated_credits IS DISTINCT FROM p_estimated_credits
      OR existing_request.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'DealMachine request idempotency key was reused for different evidence.'
        USING ERRCODE = '23505';
    END IF;

    IF existing_request.reservation_id IS NOT NULL THEN
      SELECT reservation.reserved_credits INTO existing_reserved_credits
      FROM public.dealmachine_v2_credit_reservations reservation
      WHERE reservation.id = existing_request.reservation_id;
    END IF;
    RETURN QUERY SELECT
      existing_request.id,
      existing_request.reservation_id,
      existing_request.control_version,
      existing_reserved_credits,
      existing_request.provider_call_claim_id,
      FALSE;
    RETURN;
  END IF;

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';
  IF NOT FOUND OR NOT controls.integration_enabled THEN
    RAISE EXCEPTION 'DealMachine v2 requests are disabled.' USING ERRCODE = '23514';
  END IF;
  IF p_writer_release IS DISTINCT FROM controls.required_writer_release THEN
    RAISE EXCEPTION 'Unsupported DealMachine writer release.' USING ERRCODE = '23514';
  END IF;

  IF p_estimated_credits > 0 THEN
    INSERT INTO public.dealmachine_v2_credit_reservations(
      id,
      run_key,
      idempotency_key,
      operation,
      reserved_credits,
      control_version,
      writer_release,
      expires_at
    ) VALUES (
      gen_random_uuid(),
      p_run_key,
      'reservation:' || p_idempotency_key,
      p_operation,
      p_estimated_credits,
      controls.control_version,
      p_writer_release,
      clock_timestamp() + INTERVAL '1 minute'
    )
    RETURNING id INTO new_reservation_id;
  END IF;

  INSERT INTO public.dealmachine_v2_requests(
    id,
    reservation_id,
    control_version,
    run_key,
    operation,
    http_method,
    endpoint_path,
    request_hash,
    estimated_credits,
    idempotency_key,
    writer_release,
    requested_at
  ) VALUES (
    new_request_id,
    new_reservation_id,
    controls.control_version,
    p_run_key,
    p_operation,
    p_http_method,
    p_endpoint_path,
    p_request_hash,
    p_estimated_credits,
    p_idempotency_key,
    p_writer_release,
    p_requested_at
  );

  RETURN QUERY SELECT
    new_request_id,
    new_reservation_id,
    controls.control_version,
    COALESCE(p_estimated_credits, 0),
    request_record.provider_call_claim_id,
    TRUE
  FROM public.dealmachine_v2_requests request_record
  WHERE request_record.id = new_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_dealmachine_v2_request(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_dealmachine_v2_request(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.append_dealmachine_v2_request_evidence(
  p_request_id UUID,
  p_idempotency_key TEXT,
  p_event_type TEXT,
  p_provider_request_id TEXT DEFAULT NULL,
  p_response_hash TEXT DEFAULT NULL,
  p_actual_credits INTEGER DEFAULT NULL,
  p_rate_limit_json JSONB DEFAULT '{}'::JSONB,
  p_evidence_json JSONB DEFAULT '{}'::JSONB,
  p_recorded_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result_id UUID;
  existing public.dealmachine_v2_request_evidence;
BEGIN
  p_idempotency_key := btrim(p_idempotency_key);
  p_event_type := lower(btrim(p_event_type));
  p_provider_request_id := NULLIF(btrim(p_provider_request_id), '');
  p_response_hash := lower(NULLIF(btrim(p_response_hash), ''));

  SELECT candidate.* INTO existing
  FROM public.dealmachine_v2_request_evidence candidate
  WHERE candidate.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing.request_id IS DISTINCT FROM p_request_id
      OR existing.event_type IS DISTINCT FROM p_event_type
      OR existing.provider_request_id IS DISTINCT FROM p_provider_request_id
      OR existing.response_hash IS DISTINCT FROM p_response_hash
      OR existing.actual_credits IS DISTINCT FROM p_actual_credits
      OR existing.rate_limit_json IS DISTINCT FROM p_rate_limit_json
      OR existing.evidence_json IS DISTINCT FROM p_evidence_json THEN
      RAISE EXCEPTION 'DealMachine request-evidence idempotency key was reused.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.dealmachine_v2_request_evidence(
    request_id,
    event_type,
    provider_request_id,
    response_hash,
    actual_credits,
    rate_limit_json,
    evidence_json,
    idempotency_key,
    recorded_at
  ) VALUES (
    p_request_id,
    p_event_type,
    p_provider_request_id,
    p_response_hash,
    p_actual_credits,
    p_rate_limit_json,
    p_evidence_json,
    p_idempotency_key,
    p_recorded_at
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT candidate.* INTO existing
    FROM public.dealmachine_v2_request_evidence candidate
    WHERE candidate.idempotency_key = p_idempotency_key;
    IF NOT FOUND
      OR existing.request_id IS DISTINCT FROM p_request_id
      OR existing.event_type IS DISTINCT FROM p_event_type
      OR existing.provider_request_id IS DISTINCT FROM p_provider_request_id
      OR existing.response_hash IS DISTINCT FROM p_response_hash
      OR existing.actual_credits IS DISTINCT FROM p_actual_credits
      OR existing.rate_limit_json IS DISTINCT FROM p_rate_limit_json
      OR existing.evidence_json IS DISTINCT FROM p_evidence_json THEN
      RAISE EXCEPTION 'DealMachine request-evidence idempotency conflict.'
        USING ERRCODE = '23505';
    END IF;
    result_id := existing.id;
  END IF;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_dealmachine_v2_request_evidence(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_dealmachine_v2_request_evidence(
  UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_dealmachine_v2_credit_reservation(
  p_request_id UUID,
  p_idempotency_key TEXT,
  p_disposition TEXT,
  p_actual_credits INTEGER DEFAULT NULL,
  p_evidence_json JSONB DEFAULT '{}'::JSONB,
  p_settled_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  request_record public.dealmachine_v2_requests;
  existing public.dealmachine_v2_credit_settlements;
  result_id UUID;
BEGIN
  p_idempotency_key := btrim(p_idempotency_key);
  p_disposition := lower(btrim(p_disposition));

  SELECT candidate.* INTO request_record
  FROM public.dealmachine_v2_requests candidate
  WHERE candidate.id = p_request_id;
  IF NOT FOUND OR request_record.reservation_id IS NULL THEN
    RAISE EXCEPTION 'Only a reserved DealMachine request can be settled.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO existing
  FROM public.dealmachine_v2_credit_settlements candidate
  WHERE candidate.request_id = p_request_id
     OR candidate.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing.request_id IS DISTINCT FROM p_request_id
      OR existing.disposition IS DISTINCT FROM p_disposition
      OR (
        p_disposition <> 'released'
        AND existing.actual_credits IS DISTINCT FROM p_actual_credits
      )
      OR existing.evidence_json IS DISTINCT FROM p_evidence_json THEN
      RAISE EXCEPTION 'DealMachine settlement idempotency key was reused.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.dealmachine_v2_credit_settlements(
    reservation_id,
    request_id,
    disposition,
    actual_credits,
    budgeted_credits,
    evidence_json,
    idempotency_key,
    writer_release,
    settled_at
  ) VALUES (
    request_record.reservation_id,
    p_request_id,
    p_disposition,
    p_actual_credits,
    CASE
      WHEN p_disposition = 'consumed' THEN COALESCE(p_actual_credits, 0)
      WHEN p_disposition = 'released' THEN 0
      ELSE 1
    END,
    p_evidence_json,
    p_idempotency_key,
    request_record.writer_release,
    p_settled_at
  )
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_dealmachine_v2_credit_reservation(
  UUID, TEXT, TEXT, INTEGER, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_dealmachine_v2_credit_reservation(
  UUID, TEXT, TEXT, INTEGER, JSONB, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.append_dealmachine_v2_observation(
  p_request_id UUID,
  p_provider_entity_type TEXT,
  p_provider_entity_id TEXT,
  p_payload_hash TEXT,
  p_raw_payload_json JSONB,
  p_schema_version TEXT,
  p_provider_updated_at TIMESTAMPTZ,
  p_observed_at TIMESTAMPTZ,
  p_field_freshness_json JSONB,
  p_confidence NUMERIC,
  p_retention_expires_at TIMESTAMPTZ,
  p_idempotency_key TEXT,
  p_writer_release TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing public.dealmachine_v2_observations;
  result_id UUID;
  retention_evidence JSONB;
  retention_recorded_at TIMESTAMPTZ;
BEGIN
  p_provider_entity_type := lower(btrim(p_provider_entity_type));
  p_provider_entity_id := btrim(p_provider_entity_id);
  p_payload_hash := lower(btrim(p_payload_hash));
  p_schema_version := btrim(p_schema_version);
  p_idempotency_key := btrim(p_idempotency_key);
  p_writer_release := btrim(p_writer_release);

  IF jsonb_typeof(p_raw_payload_json) <> 'object'
    OR p_payload_hash !~ '^[0-9a-f]{64}$'
    OR private.dealmachine_v2_sha256_jsonb(p_raw_payload_json) IS DISTINCT FROM p_payload_hash
    OR private.dealmachine_v2_contains_prohibited_key(p_raw_payload_json) THEN
    RAISE EXCEPTION 'DealMachine raw payload is invalid, mismatched, or contains blocked people/contact data.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO existing
  FROM public.dealmachine_v2_observations candidate
  WHERE candidate.idempotency_key = p_idempotency_key
     OR (
       candidate.request_id = p_request_id
       AND candidate.provider_entity_type = p_provider_entity_type
       AND candidate.provider_entity_id = p_provider_entity_id
       AND candidate.payload_hash = p_payload_hash
     )
  ORDER BY (candidate.idempotency_key = p_idempotency_key) DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing.request_id IS DISTINCT FROM p_request_id
      OR existing.provider_entity_type IS DISTINCT FROM p_provider_entity_type
      OR existing.provider_entity_id IS DISTINCT FROM p_provider_entity_id
      OR existing.payload_hash IS DISTINCT FROM p_payload_hash
      OR existing.schema_version IS DISTINCT FROM p_schema_version
      OR existing.provider_updated_at IS DISTINCT FROM p_provider_updated_at
      OR existing.observed_at IS DISTINCT FROM p_observed_at
      OR existing.field_freshness_json IS DISTINCT FROM p_field_freshness_json
      OR existing.confidence IS DISTINCT FROM p_confidence
      OR existing.retention_expires_at IS DISTINCT FROM p_retention_expires_at
      OR existing.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'DealMachine observation idempotency or natural key was reused.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.dealmachine_v2_observations(
    request_id,
    provider_entity_type,
    provider_entity_id,
    payload_hash,
    schema_version,
    provider_updated_at,
    observed_at,
    field_freshness_json,
    confidence,
    retention_expires_at,
    idempotency_key,
    writer_release
  ) VALUES (
    p_request_id,
    p_provider_entity_type,
    p_provider_entity_id,
    p_payload_hash,
    p_schema_version,
    p_provider_updated_at,
    p_observed_at,
    p_field_freshness_json,
    p_confidence,
    p_retention_expires_at,
    p_idempotency_key,
    p_writer_release
  )
  RETURNING id, ingested_at INTO result_id, retention_recorded_at;

  INSERT INTO public.dealmachine_v2_observation_payloads(
    observation_id,
    raw_payload_json,
    payload_hash,
    retention_expires_at
  ) VALUES (
    result_id,
    p_raw_payload_json,
    p_payload_hash,
    p_retention_expires_at
  );

  retention_evidence := jsonb_build_object(
    'policy', 'dealmachine_v2_property_observation',
    'retentionExpiresAt', p_retention_expires_at,
    'payloadHash', p_payload_hash
  );
  INSERT INTO public.dealmachine_v2_observation_evidence(
    observation_id,
    event_type,
    evidence_hash,
    evidence_json,
    idempotency_key,
    writer_release,
    recorded_at
  ) VALUES (
    result_id,
    'retention_assigned',
    private.dealmachine_v2_sha256_jsonb(retention_evidence),
    retention_evidence,
    'retention:' || p_idempotency_key,
    p_writer_release,
    retention_recorded_at
  );

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_dealmachine_v2_observation(
  UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB,
  NUMERIC, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_dealmachine_v2_observation(
  UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, JSONB,
  NUMERIC, TIMESTAMPTZ, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.link_dealmachine_v2_observation_entity(
  p_observation_id UUID,
  p_entity_namespace TEXT,
  p_entity_key TEXT,
  p_link_type TEXT,
  p_confidence NUMERIC,
  p_evidence_json JSONB,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_linked_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing public.dealmachine_v2_observation_entity_links;
  result_id UUID;
BEGIN
  p_entity_namespace := lower(btrim(p_entity_namespace));
  p_entity_key := btrim(p_entity_key);
  p_link_type := lower(btrim(p_link_type));
  p_idempotency_key := btrim(p_idempotency_key);
  p_writer_release := btrim(p_writer_release);

  SELECT candidate.* INTO existing
  FROM public.dealmachine_v2_observation_entity_links candidate
  WHERE candidate.idempotency_key = p_idempotency_key
     OR (
       candidate.observation_id = p_observation_id
       AND candidate.entity_namespace = p_entity_namespace
       AND candidate.entity_key = p_entity_key
       AND candidate.link_type = p_link_type
     )
  ORDER BY (candidate.idempotency_key = p_idempotency_key) DESC
  LIMIT 1;
  IF FOUND THEN
    IF existing.observation_id IS DISTINCT FROM p_observation_id
      OR existing.entity_namespace IS DISTINCT FROM p_entity_namespace
      OR existing.entity_key IS DISTINCT FROM p_entity_key
      OR existing.link_type IS DISTINCT FROM p_link_type
      OR existing.confidence IS DISTINCT FROM p_confidence
      OR existing.evidence_json IS DISTINCT FROM p_evidence_json
      OR existing.writer_release IS DISTINCT FROM p_writer_release THEN
      RAISE EXCEPTION 'DealMachine entity-link idempotency or natural key was reused.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.dealmachine_v2_observation_entity_links(
    observation_id,
    entity_namespace,
    entity_key,
    link_type,
    confidence,
    evidence_json,
    idempotency_key,
    writer_release,
    linked_at
  ) VALUES (
    p_observation_id,
    p_entity_namespace,
    p_entity_key,
    p_link_type,
    p_confidence,
    p_evidence_json,
    p_idempotency_key,
    p_writer_release,
    p_linked_at
  )
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_dealmachine_v2_observation_entity(
  UUID, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_dealmachine_v2_observation_entity(
  UUID, TEXT, TEXT, TEXT, NUMERIC, JSONB, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_dealmachine_v2_source_attribution(
  p_observation_entity_link_id UUID,
  p_source_namespace TEXT,
  p_source_identifier TEXT,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_metadata_json JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  attribution_id UUID,
  operating_strategy_version_id UUID,
  canonical_activity_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  controls public.dealmachine_v2_runtime_controls;
  link_record public.dealmachine_v2_observation_entity_links;
  observation public.dealmachine_v2_observations;
  runtime RECORD;
  latest_review_decision TEXT;
  activity_id UUID;
  result_id UUID;
  activity_key TEXT;
  activity_idempotency_key TEXT;
BEGIN
  p_source_namespace := lower(btrim(p_source_namespace));
  p_source_identifier := btrim(p_source_identifier);
  p_idempotency_key := btrim(p_idempotency_key);
  p_writer_release := btrim(p_writer_release);

  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';
  IF p_writer_release IS DISTINCT FROM controls.required_writer_release THEN
    RAISE EXCEPTION 'Unsupported DealMachine attribution writer release.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO link_record
  FROM public.dealmachine_v2_observation_entity_links candidate
  WHERE candidate.id = p_observation_entity_link_id;
  IF NOT FOUND
    OR link_record.link_type NOT IN ('provider_property_id', 'parcel', 'normalized_address')
    OR p_occurred_at < link_record.linked_at THEN
    RAISE EXCEPTION 'DealMachine source attribution requires a prior normalized entity link.'
      USING ERRCODE = '23514';
  END IF;

  SELECT review.decision INTO latest_review_decision
  FROM public.dealmachine_v2_operator_reviews review
  WHERE review.observation_entity_link_id = link_record.id
    AND review.reviewed_at <= p_occurred_at
  ORDER BY review.reviewed_at DESC, review.recorded_at DESC, review.id DESC
  LIMIT 1;
  IF latest_review_decision IS DISTINCT FROM 'accepted_for_attribution' THEN
    RAISE EXCEPTION 'DealMachine attribution requires a prior accepted operator review.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO observation
  FROM public.dealmachine_v2_observations candidate
  WHERE candidate.id = link_record.observation_id;

  SELECT * INTO runtime
  FROM public.resolve_operating_strategy_runtime(
    p_source_namespace,
    p_source_identifier,
    p_occurred_at
  );

  activity_key := p_observation_entity_link_id::TEXT || ':' ||
    p_source_namespace || ':' || p_source_identifier;
  activity_idempotency_key := 'dealmachine-source:' || p_idempotency_key;

  activity_id := public.record_operating_strategy_activity(
    p_operating_strategy_version_id => runtime.operating_strategy_version_id,
    p_activity_type => 'source',
    p_activity_namespace => 'dealmachine_observation_entity',
    p_activity_key => activity_key,
    p_subject_namespace => link_record.entity_namespace,
    p_subject_key => link_record.entity_key,
    p_idempotency_key => activity_idempotency_key,
    p_writer_release => p_writer_release,
    p_occurred_at => p_occurred_at,
    p_source_namespace => p_source_namespace,
    p_source_identifier => p_source_identifier,
    p_provenance_json => jsonb_build_array(jsonb_build_object(
      'provider', 'dealmachine',
      'observationId', observation.id,
      'payloadHash', observation.payload_hash,
      'providerEntityType', observation.provider_entity_type,
      'providerEntityId', observation.provider_entity_id,
      'observationEntityLinkId', link_record.id
    )),
    p_metadata_json => p_metadata_json || jsonb_build_object(
      'outreachAuthorized', FALSE,
      'customerWorkflowAuthorized', FALSE,
      'dispatchAuthority', 'none',
      'observationId', observation.id,
      'observationEntityLinkId', link_record.id
    )
  );

  INSERT INTO public.dealmachine_v2_source_attributions(
    observation_entity_link_id,
    observation_id,
    operating_strategy_id,
    operating_strategy_version_id,
    canonical_activity_id,
    source_namespace,
    source_identifier,
    idempotency_key,
    writer_release,
    occurred_at
  ) VALUES (
    link_record.id,
    observation.id,
    runtime.operating_strategy_id,
    runtime.operating_strategy_version_id,
    activity_id,
    p_source_namespace,
    p_source_identifier,
    p_idempotency_key,
    p_writer_release,
    p_occurred_at
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO result_id;

  IF result_id IS NULL THEN
    SELECT candidate.id INTO result_id
    FROM public.dealmachine_v2_source_attributions candidate
    WHERE candidate.idempotency_key = p_idempotency_key
      AND candidate.observation_entity_link_id = link_record.id
      AND candidate.operating_strategy_version_id = runtime.operating_strategy_version_id
      AND candidate.canonical_activity_id = activity_id
      AND candidate.source_namespace = p_source_namespace
      AND candidate.source_identifier = p_source_identifier;
    IF result_id IS NULL THEN
      RAISE EXCEPTION 'DealMachine attribution idempotency key was reused.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN QUERY SELECT result_id, runtime.operating_strategy_version_id, activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_dealmachine_v2_source_attribution(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_dealmachine_v2_source_attribution(
  UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.record_dealmachine_v2_operator_review(
  p_observation_entity_link_id UUID,
  p_decision TEXT,
  p_reason_code TEXT,
  p_notes TEXT,
  p_reviewer_user_id UUID,
  p_idempotency_key TEXT,
  p_writer_release TEXT,
  p_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  p_evidence_json JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing public.dealmachine_v2_operator_reviews;
  result_id UUID;
BEGIN
  p_decision := lower(btrim(p_decision));
  p_reason_code := lower(btrim(p_reason_code));
  p_idempotency_key := btrim(p_idempotency_key);
  p_writer_release := btrim(p_writer_release);

  SELECT candidate.* INTO existing
  FROM public.dealmachine_v2_operator_reviews candidate
  WHERE candidate.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing.observation_entity_link_id IS DISTINCT FROM p_observation_entity_link_id
      OR existing.decision IS DISTINCT FROM p_decision
      OR existing.reason_code IS DISTINCT FROM p_reason_code
      OR existing.notes IS DISTINCT FROM p_notes
      OR existing.reviewer_user_id IS DISTINCT FROM p_reviewer_user_id
      OR existing.writer_release IS DISTINCT FROM p_writer_release
      OR existing.evidence_json IS DISTINCT FROM p_evidence_json THEN
      RAISE EXCEPTION 'DealMachine operator-review idempotency key was reused.'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing.id;
  END IF;

  INSERT INTO public.dealmachine_v2_operator_reviews(
    observation_entity_link_id,
    decision,
    reason_code,
    notes,
    reviewer_user_id,
    evidence_json,
    outreach_authorized,
    customer_workflow_authorized,
    dispatch_authority,
    idempotency_key,
    writer_release,
    reviewed_at
  ) VALUES (
    p_observation_entity_link_id,
    p_decision,
    p_reason_code,
    p_notes,
    p_reviewer_user_id,
    p_evidence_json,
    FALSE,
    FALSE,
    'none',
    p_idempotency_key,
    p_writer_release,
    p_reviewed_at
  )
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_dealmachine_v2_operator_review(
  UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_dealmachine_v2_operator_review(
  UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION private.purge_dealmachine_v2_observation_payload(
  p_observation_id UUID,
  p_idempotency_key TEXT,
  p_reason_code TEXT,
  p_evidence_json JSONB,
  p_actor_user_id UUID,
  p_deleted_at TIMESTAMPTZ
)
RETURNS TABLE (
  evidence_id UUID,
  already_deleted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload public.dealmachine_v2_observation_payloads;
  observation public.dealmachine_v2_observations;
  existing_evidence public.dealmachine_v2_observation_evidence;
  deletion_evidence JSONB;
  new_evidence_id UUID;
BEGIN
  p_idempotency_key := btrim(p_idempotency_key);
  p_reason_code := lower(btrim(p_reason_code));

  IF p_reason_code !~ '^[a-z0-9_]+$'
    OR jsonb_typeof(p_evidence_json) <> 'object'
    OR p_deleted_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'DealMachine payload deletion evidence is invalid.'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO payload
  FROM public.dealmachine_v2_observation_payloads candidate
  WHERE candidate.observation_id = p_observation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DealMachine observation payload not found.' USING ERRCODE = '23503';
  END IF;

  SELECT candidate.* INTO observation
  FROM public.dealmachine_v2_observations candidate
  WHERE candidate.id = p_observation_id;

  IF payload.deleted_at IS NOT NULL THEN
    SELECT candidate.* INTO existing_evidence
    FROM public.dealmachine_v2_observation_evidence candidate
    WHERE candidate.id = payload.deletion_evidence_id;
    IF existing_evidence.idempotency_key IS DISTINCT FROM p_idempotency_key
      OR existing_evidence.evidence_json ->> 'reasonCode' IS DISTINCT FROM p_reason_code THEN
      RAISE EXCEPTION 'DealMachine payload was already deleted under different evidence.'
        USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT existing_evidence.id, TRUE;
    RETURN;
  END IF;

  IF p_deleted_at < observation.ingested_at THEN
    RAISE EXCEPTION 'DealMachine payload deletion cannot predate observation ingestion.'
      USING ERRCODE = '23514';
  END IF;

  deletion_evidence := p_evidence_json || jsonb_build_object(
    'reasonCode', p_reason_code,
    'payloadDeleted', TRUE,
    'payloadHash', observation.payload_hash,
    'retentionExpiresAt', observation.retention_expires_at,
    'deletedAt', p_deleted_at
  );

  INSERT INTO public.dealmachine_v2_observation_evidence(
    observation_id,
    event_type,
    evidence_hash,
    evidence_json,
    actor_user_id,
    idempotency_key,
    writer_release,
    recorded_at
  ) VALUES (
    observation.id,
    'deletion_completed',
    private.dealmachine_v2_sha256_jsonb(deletion_evidence),
    deletion_evidence,
    p_actor_user_id,
    p_idempotency_key,
    observation.writer_release,
    p_deleted_at
  )
  RETURNING id INTO new_evidence_id;

  UPDATE public.dealmachine_v2_observation_payloads
  SET raw_payload_json = NULL,
      deleted_at = p_deleted_at,
      deletion_evidence_id = new_evidence_id
  WHERE observation_id = observation.id;

  RETURN QUERY SELECT new_evidence_id, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION private.purge_dealmachine_v2_observation_payload(
  UUID, TEXT, TEXT, JSONB, UUID, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.purge_dealmachine_v2_observation_payload(
  UUID, TEXT, TEXT, JSONB, UUID, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_dealmachine_v2_observation_payload(
  p_observation_id UUID,
  p_idempotency_key TEXT,
  p_reason_code TEXT,
  p_evidence_json JSONB DEFAULT '{}'::JSONB,
  p_actor_user_id UUID DEFAULT NULL,
  p_deleted_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  evidence_id UUID,
  already_deleted BOOLEAN
)
LANGUAGE SQL
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT result.evidence_id, result.already_deleted
  FROM private.purge_dealmachine_v2_observation_payload(
    p_observation_id,
    p_idempotency_key,
    p_reason_code,
    p_evidence_json,
    p_actor_user_id,
    p_deleted_at
  ) result;
$$;

REVOKE ALL ON FUNCTION public.purge_dealmachine_v2_observation_payload(
  UUID, TEXT, TEXT, JSONB, UUID, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_dealmachine_v2_observation_payload(
  UUID, TEXT, TEXT, JSONB, UUID, TIMESTAMPTZ
) TO service_role;

-- ---------------------------------------------------------------------------
-- Data API/RLS and least-privilege grants.
-- ---------------------------------------------------------------------------

DO $dealmachine_v2_enable_rls$
DECLARE
  table_name TEXT;
BEGIN
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
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END
$dealmachine_v2_enable_rls$;

GRANT SELECT ON TABLE public.dealmachine_v2_runtime_controls TO service_role;

GRANT SELECT, INSERT ON TABLE
  public.dealmachine_v2_credit_reservations,
  public.dealmachine_v2_requests,
  public.dealmachine_v2_request_evidence,
  public.dealmachine_v2_credit_settlements,
  public.dealmachine_v2_observations,
  public.dealmachine_v2_observation_payloads,
  public.dealmachine_v2_observation_evidence,
  public.dealmachine_v2_observation_entity_links,
  public.dealmachine_v2_source_attributions,
  public.dealmachine_v2_operator_reviews
TO service_role;

-- The raw payload can be updated only by the private one-way purge function.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.dealmachine_v2_observation_payloads
  FROM service_role;

-- Fail the migration if any public/customer role can reach the new authority,
-- if the service can rewrite append-only evidence, or if default controls
-- accidentally authorize a request or a paid credit.
DO $dealmachine_v2_postconditions$
DECLARE
  table_name TEXT;
  controls public.dealmachine_v2_runtime_controls;
BEGIN
  SELECT candidate.* INTO controls
  FROM public.dealmachine_v2_runtime_controls candidate
  WHERE candidate.control_key = 'primary';

  IF controls.integration_enabled
    OR controls.maximum_operation <> 'count_only'
    OR controls.required_writer_release <> 'dealmachine_v2_observation_v1'
    OR controls.max_credits_per_run <> 0
    OR controls.max_credits_per_day <> 0
    OR controls.max_credits_per_month <> 0
    OR controls.allowed_operations_json IS DISTINCT FROM '["schema_read","count_only"]'::JSONB THEN
    RAISE EXCEPTION 'DealMachine v2 controls did not remain disabled/count-only/zero-budget.';
  END IF;

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
  ]
  LOOP
    IF has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      OR has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
      OR has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      OR has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') THEN
      RAISE EXCEPTION 'DealMachine table public.% is exposed to a customer role.', table_name;
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'dealmachine_v2_credit_reservations',
    'dealmachine_v2_requests',
    'dealmachine_v2_request_evidence',
    'dealmachine_v2_credit_settlements',
    'dealmachine_v2_observations',
    'dealmachine_v2_observation_evidence',
    'dealmachine_v2_observation_entity_links',
    'dealmachine_v2_source_attributions',
    'dealmachine_v2_operator_reviews'
  ]
  LOOP
    IF has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
      OR has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
      OR has_table_privilege('service_role', format('public.%I', table_name), 'TRUNCATE') THEN
      RAISE EXCEPTION 'Service role can rewrite append-only DealMachine table public.%.', table_name;
    END IF;
  END LOOP;
END
$dealmachine_v2_postconditions$;
