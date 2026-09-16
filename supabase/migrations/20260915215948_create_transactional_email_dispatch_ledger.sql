-- Durable, privacy-preserving idempotency for Microsoft Graph transactional
-- mail. A claim becomes reconciliation-required before the provider call, so
-- a crash after Graph accepts a request can never cause an automatic retry.

CREATE TABLE IF NOT EXISTS public.transactional_email_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'outlook' CHECK (provider = 'outlook'),
  idempotency_key_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  recipient_hash TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 160),
  key_source TEXT NOT NULL CHECK (key_source IN ('caller', 'payload_fingerprint')),
  state TEXT NOT NULL DEFAULT 'dispatching' CHECK (state IN (
    'dispatching',
    'accepted',
    'acceptance_unknown',
    'failed_pre_dispatch',
    'failed_dispatch',
    'reconciled_accepted',
    'reconciled_not_sent'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  dispatch_token UUID,
  graph_message_id TEXT,
  internet_message_id TEXT,
  draft_recorded_at TIMESTAMPTZ,
  last_error_hash TEXT,
  accepted_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  reconciliation_note_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactional_email_dispatch_hash_shapes CHECK (
    idempotency_key_hash ~ '^[0-9a-f]{64}$' AND
    payload_hash ~ '^[0-9a-f]{64}$' AND
    recipient_hash ~ '^[0-9a-f]{64}$' AND
    (last_error_hash IS NULL OR last_error_hash ~ '^[0-9a-f]{64}$') AND
    (reconciliation_note_hash IS NULL OR reconciliation_note_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT transactional_email_dispatch_correlation_shape CHECK (
    correlation_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  CONSTRAINT transactional_email_dispatch_token_shape CHECK (
    (state = 'dispatching' AND dispatch_token IS NOT NULL) OR
    (state <> 'dispatching' AND dispatch_token IS NULL)
  ),
  CONSTRAINT transactional_email_dispatch_acceptance_shape CHECK (
    (state IN ('accepted', 'reconciled_accepted') AND accepted_at IS NOT NULL) OR
    (state NOT IN ('accepted', 'reconciled_accepted') AND accepted_at IS NULL)
  ),
  CONSTRAINT transactional_email_dispatch_graph_identity_shape CHECK (
    (graph_message_id IS NULL AND internet_message_id IS NULL AND draft_recorded_at IS NULL) OR
    (graph_message_id IS NOT NULL AND char_length(graph_message_id) BETWEEN 1 AND 1000 AND
     internet_message_id IS NOT NULL AND char_length(internet_message_id) BETWEEN 3 AND 1000 AND
     draft_recorded_at IS NOT NULL)
  ),
  CONSTRAINT transactional_email_dispatch_idempotency_unique
    UNIQUE (provider, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_transactional_email_dispatches_reconciliation
  ON public.transactional_email_dispatches(updated_at, id)
  WHERE state IN ('dispatching', 'acceptance_unknown', 'failed_dispatch');

CREATE INDEX IF NOT EXISTS idx_transactional_email_dispatches_correlation
  ON public.transactional_email_dispatches(correlation_id);

CREATE INDEX IF NOT EXISTS idx_transactional_email_dispatches_internet_message
  ON public.transactional_email_dispatches(internet_message_id)
  WHERE internet_message_id IS NOT NULL;

ALTER TABLE public.transactional_email_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_email_dispatches FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.transactional_email_dispatches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transactional_email_dispatches TO service_role;

CREATE OR REPLACE FUNCTION public.guard_transactional_email_dispatch_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'dispatching' OR NEW.attempt_count <> 1 OR NEW.dispatch_token IS NULL THEN
      RAISE EXCEPTION 'Transactional email dispatch must begin with one owned attempt'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state IN ('accepted', 'reconciled_accepted') THEN
    RAISE EXCEPTION 'Accepted transactional email dispatches are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.state = 'dispatching' AND NEW.state = 'dispatching' THEN
    IF NEW.attempt_count <> OLD.attempt_count OR
       NEW.dispatch_token IS DISTINCT FROM OLD.dispatch_token OR
       NEW.idempotency_key_hash IS DISTINCT FROM OLD.idempotency_key_hash OR
       NEW.payload_hash IS DISTINCT FROM OLD.payload_hash OR
       NEW.recipient_hash IS DISTINCT FROM OLD.recipient_hash OR
       NEW.correlation_id IS DISTINCT FROM OLD.correlation_id OR
       NEW.event_type IS DISTINCT FROM OLD.event_type OR
       NEW.graph_message_id IS NULL OR NEW.internet_message_id IS NULL OR
       (OLD.graph_message_id IS NOT NULL AND NEW.graph_message_id IS DISTINCT FROM OLD.graph_message_id) OR
       (OLD.internet_message_id IS NOT NULL AND NEW.internet_message_id IS DISTINCT FROM OLD.internet_message_id) THEN
      RAISE EXCEPTION 'Transactional email draft identity update is invalid'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state = 'dispatching' AND NEW.state IN (
    'accepted', 'acceptance_unknown', 'failed_pre_dispatch', 'failed_dispatch',
    'reconciled_accepted'
  ) THEN
    IF NEW.attempt_count <> OLD.attempt_count OR NEW.dispatch_token IS NOT NULL THEN
      RAISE EXCEPTION 'Transactional email finalization must release the owned token'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state IN ('failed_pre_dispatch', 'reconciled_not_sent') AND NEW.state = 'dispatching' THEN
    IF NEW.attempt_count <> OLD.attempt_count + 1 OR
       NEW.dispatch_token IS NULL OR NEW.dispatch_token = OLD.dispatch_token THEN
      RAISE EXCEPTION 'Transactional email retry must create a new owned attempt'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.state IN ('acceptance_unknown', 'failed_dispatch') AND
     NEW.state IN ('reconciled_accepted', 'reconciled_not_sent') THEN
    IF NEW.attempt_count <> OLD.attempt_count OR NEW.dispatch_token IS NOT NULL THEN
      RAISE EXCEPTION 'Transactional email reconciliation cannot change attempt ownership'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid transactional email dispatch transition: % to %', OLD.state, NEW.state
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS transactional_email_dispatch_transition_guard
  ON public.transactional_email_dispatches;
CREATE TRIGGER transactional_email_dispatch_transition_guard
BEFORE INSERT OR UPDATE ON public.transactional_email_dispatches
FOR EACH ROW
EXECUTE FUNCTION public.guard_transactional_email_dispatch_transition();

CREATE OR REPLACE FUNCTION public.claim_outlook_transactional_dispatch(
  p_idempotency_key_hash TEXT,
  p_payload_hash TEXT,
  p_recipient_hash TEXT,
  p_correlation_id TEXT,
  p_event_type TEXT,
  p_key_source TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row public.transactional_email_dispatches%ROWTYPE;
  v_token UUID := gen_random_uuid();
BEGIN
  IF p_idempotency_key_hash IS NULL OR p_idempotency_key_hash !~ '^[0-9a-f]{64}$' OR
     p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$' OR
     p_recipient_hash IS NULL OR p_recipient_hash !~ '^[0-9a-f]{64}$' OR
     p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9._:-]{1,200}$' OR
     nullif(btrim(coalesce(p_event_type, '')), '') IS NULL OR char_length(p_event_type) > 160 OR
     p_key_source IS NULL OR p_key_source NOT IN ('caller', 'payload_fingerprint') THEN
    RETURN jsonb_build_object('action', 'identity_conflict', 'reason', 'invalid_identity');
  END IF;

  INSERT INTO public.transactional_email_dispatches (
    idempotency_key_hash,
    payload_hash,
    recipient_hash,
    correlation_id,
    event_type,
    key_source,
    dispatch_token
  ) VALUES (
    p_idempotency_key_hash,
    p_payload_hash,
    p_recipient_hash,
    p_correlation_id,
    p_event_type,
    p_key_source,
    v_token
  )
  ON CONFLICT (provider, idempotency_key_hash) DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'action', 'send',
      'dispatchId', v_row.id,
      'dispatchToken', v_row.dispatch_token,
      'graphMessageId', v_row.graph_message_id,
      'internetMessageId', v_row.internet_message_id,
      'state', v_row.state
    );
  END IF;

  SELECT candidate.*
  INTO v_row
  FROM public.transactional_email_dispatches AS candidate
  WHERE candidate.provider = 'outlook'
    AND candidate.idempotency_key_hash = p_idempotency_key_hash
  FOR UPDATE;

  IF NOT FOUND OR
     v_row.payload_hash IS DISTINCT FROM p_payload_hash OR
     v_row.recipient_hash IS DISTINCT FROM p_recipient_hash OR
     v_row.event_type IS DISTINCT FROM p_event_type OR
     v_row.correlation_id IS DISTINCT FROM p_correlation_id THEN
    RETURN jsonb_build_object(
      'action', 'identity_conflict',
      'dispatchId', v_row.id,
      'graphMessageId', v_row.graph_message_id,
      'internetMessageId', v_row.internet_message_id,
      'state', v_row.state
    );
  END IF;

  IF v_row.state IN ('accepted', 'reconciled_accepted') THEN
    RETURN jsonb_build_object(
      'action', 'deduplicated_accepted',
      'dispatchId', v_row.id,
      'graphMessageId', v_row.graph_message_id,
      'internetMessageId', v_row.internet_message_id,
      'state', v_row.state
    );
  END IF;

  IF v_row.state IN ('dispatching', 'acceptance_unknown', 'failed_dispatch') THEN
    RETURN jsonb_build_object(
      'action', 'reconciliation_required',
      'dispatchId', v_row.id,
      'graphMessageId', v_row.graph_message_id,
      'internetMessageId', v_row.internet_message_id,
      'state', v_row.state
    );
  END IF;

  IF v_row.state IN ('failed_pre_dispatch', 'reconciled_not_sent') THEN
    v_token := gen_random_uuid();
    UPDATE public.transactional_email_dispatches
    SET state = 'dispatching',
        attempt_count = attempt_count + 1,
        dispatch_token = v_token,
        last_error_hash = NULL,
        reconciled_at = NULL,
        reconciliation_note_hash = NULL,
        graph_message_id = NULL,
        internet_message_id = NULL,
        draft_recorded_at = NULL,
        updated_at = v_now
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
      'action', 'send',
      'dispatchId', v_row.id,
      'dispatchToken', v_row.dispatch_token,
      'graphMessageId', v_row.graph_message_id,
      'internetMessageId', v_row.internet_message_id,
      'state', v_row.state
    );
  END IF;

  RETURN jsonb_build_object(
    'action', 'identity_conflict',
    'dispatchId', v_row.id,
    'graphMessageId', v_row.graph_message_id,
    'internetMessageId', v_row.internet_message_id,
    'state', v_row.state
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_outlook_transactional_draft(
  p_dispatch_id UUID,
  p_dispatch_token UUID,
  p_graph_message_id TEXT,
  p_internet_message_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row public.transactional_email_dispatches%ROWTYPE;
BEGIN
  IF p_dispatch_id IS NULL OR p_dispatch_token IS NULL OR
     nullif(btrim(coalesce(p_graph_message_id, '')), '') IS NULL OR
     char_length(p_graph_message_id) > 1000 OR
     nullif(btrim(coalesce(p_internet_message_id, '')), '') IS NULL OR
     char_length(p_internet_message_id) > 1000 THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'invalid_draft_identity');
  END IF;

  UPDATE public.transactional_email_dispatches
  SET graph_message_id = btrim(p_graph_message_id),
      internet_message_id = btrim(p_internet_message_id),
      draft_recorded_at = v_now,
      updated_at = v_now
  WHERE id = p_dispatch_id
    AND state = 'dispatching'
    AND dispatch_token = p_dispatch_token
    AND (graph_message_id IS NULL OR graph_message_id = btrim(p_graph_message_id))
    AND (internet_message_id IS NULL OR internet_message_id = btrim(p_internet_message_id))
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'claim_not_owned_or_identity_conflict');
  END IF;

  RETURN jsonb_build_object(
    'recorded', TRUE,
    'reason', NULL,
    'dispatchId', v_row.id,
    'graphMessageId', v_row.graph_message_id,
    'internetMessageId', v_row.internet_message_id,
    'state', v_row.state
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_outlook_transactional_dispatch(
  p_dispatch_id UUID,
  p_dispatch_token UUID,
  p_outcome TEXT,
  p_error_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row public.transactional_email_dispatches%ROWTYPE;
BEGIN
  IF p_dispatch_id IS NULL OR p_dispatch_token IS NULL OR
     p_outcome IS NULL OR
     p_outcome NOT IN ('accepted', 'acceptance_unknown', 'failed_pre_dispatch', 'failed_dispatch') OR
     (p_error_hash IS NOT NULL AND p_error_hash !~ '^[0-9a-f]{64}$') THEN
    RETURN jsonb_build_object('finalized', FALSE, 'reason', 'invalid_finalization');
  END IF;

  UPDATE public.transactional_email_dispatches
  SET state = p_outcome,
      dispatch_token = NULL,
      last_error_hash = p_error_hash,
      accepted_at = CASE WHEN p_outcome = 'accepted' THEN v_now ELSE NULL END,
      updated_at = v_now
  WHERE id = p_dispatch_id
    AND state = 'dispatching'
    AND dispatch_token = p_dispatch_token
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('finalized', FALSE, 'reason', 'claim_not_owned');
  END IF;

  RETURN jsonb_build_object(
    'finalized', TRUE,
    'reason', NULL,
    'dispatchId', v_row.id,
    'state', v_row.state
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_outlook_transactional_dispatch(
  p_dispatch_id UUID,
  p_resolution TEXT,
  p_note_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_next_state TEXT;
  v_row public.transactional_email_dispatches%ROWTYPE;
BEGIN
  IF p_dispatch_id IS NULL OR p_resolution IS NULL OR
     p_resolution NOT IN ('accepted', 'not_sent') OR
     (p_note_hash IS NOT NULL AND p_note_hash !~ '^[0-9a-f]{64}$') THEN
    RETURN jsonb_build_object('reconciled', FALSE, 'reason', 'invalid_reconciliation');
  END IF;

  v_next_state := CASE
    WHEN p_resolution = 'accepted' THEN 'reconciled_accepted'
    ELSE 'reconciled_not_sent'
  END;

  UPDATE public.transactional_email_dispatches
  SET state = v_next_state,
      dispatch_token = NULL,
      accepted_at = CASE WHEN p_resolution = 'accepted' THEN v_now ELSE NULL END,
      reconciled_at = v_now,
      reconciliation_note_hash = p_note_hash,
      updated_at = v_now
  WHERE id = p_dispatch_id
    AND state IN ('acceptance_unknown', 'failed_dispatch')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reconciled', FALSE, 'reason', 'state_not_reconcilable');
  END IF;

  RETURN jsonb_build_object(
    'reconciled', TRUE,
    'reason', NULL,
    'dispatchId', v_row.id,
    'graphMessageId', v_row.graph_message_id,
    'internetMessageId', v_row.internet_message_id,
    'state', v_row.state
  );
END;
$$;

-- Exact inbound References/In-Reply-To evidence can safely close an ambiguous
-- or actively owned dispatch as accepted. The persisted internet-message ID
-- is checked inside the same update; a generic operator reconciliation cannot
-- use `not_sent` to steal an active dispatch token and reopen a duplicate.
CREATE OR REPLACE FUNCTION public.reconcile_outlook_dispatch_from_inbound(
  p_dispatch_id UUID,
  p_internet_message_id TEXT,
  p_inbound_message_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_row public.transactional_email_dispatches%ROWTYPE;
BEGIN
  IF p_dispatch_id IS NULL OR
     nullif(btrim(coalesce(p_internet_message_id, '')), '') IS NULL OR
     char_length(p_internet_message_id) > 1000 OR
     nullif(btrim(coalesce(p_inbound_message_id, '')), '') IS NULL OR
     char_length(p_inbound_message_id) > 1000 THEN
    RETURN jsonb_build_object('reconciled', FALSE, 'reason', 'invalid_inbound_evidence');
  END IF;

  UPDATE public.transactional_email_dispatches
  SET state = 'reconciled_accepted',
      dispatch_token = NULL,
      accepted_at = v_now,
      reconciled_at = v_now,
      reconciliation_note_hash = encode(
        extensions.digest(convert_to(p_inbound_message_id, 'UTF8'), 'sha256'),
        'hex'
      ),
      updated_at = v_now
  WHERE id = p_dispatch_id
    AND state IN ('dispatching', 'acceptance_unknown', 'failed_dispatch')
    AND internet_message_id = btrim(p_internet_message_id)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('reconciled', FALSE, 'reason', 'inbound_identity_or_state_mismatch');
  END IF;

  RETURN jsonb_build_object(
    'reconciled', TRUE,
    'reason', NULL,
    'dispatchId', v_row.id,
    'graphMessageId', v_row.graph_message_id,
    'internetMessageId', v_row.internet_message_id,
    'state', v_row.state
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outlook_transactional_dispatch(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_outlook_transactional_dispatch(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_outlook_transactional_dispatch(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_outlook_transactional_draft(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_outlook_dispatch_from_inbound(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_outlook_transactional_dispatch(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_outlook_transactional_dispatch(UUID, UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_outlook_transactional_dispatch(UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_outlook_transactional_draft(UUID, UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_outlook_dispatch_from_inbound(UUID, TEXT, TEXT)
  TO service_role;
