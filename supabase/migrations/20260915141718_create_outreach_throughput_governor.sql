-- Atomic, server-only throughput accounting for VestBlock's production
-- outreach lanes. Every provider attempt is reserved before the provider is
-- called, so concurrent cron invocations cannot exceed either the rolling
-- global ceiling or the current lane allocation.

CREATE TABLE IF NOT EXISTS outreach_sender_ramp_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'hold' CHECK (
    stage IN ('hold', 'recovery', 'prove_25', 'prove_100', 'prove_250', 'prove_500', 'full_1000')
  ),
  target_cap INTEGER NOT NULL DEFAULT 1000 CHECK (target_cap BETWEEN 1 AND 1000),
  effective_cap INTEGER NOT NULL DEFAULT 0 CHECK (effective_cap BETWEEN 0 AND 1000),
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_conservative_decision_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hold_reason TEXT,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_watermark BIGINT NOT NULL DEFAULT 0 CHECK (evidence_watermark >= 0),
  evidence_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE outreach_sender_ramp_state
  ADD COLUMN IF NOT EXISTS evidence_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE outreach_sender_ramp_state
  ADD COLUMN IF NOT EXISTS evidence_watermark BIGINT NOT NULL DEFAULT 0;
ALTER TABLE outreach_sender_ramp_state
  ADD COLUMN IF NOT EXISTS last_conservative_decision_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE SEQUENCE IF NOT EXISTS public.outreach_delivery_evidence_version_seq AS BIGINT;

CREATE TABLE IF NOT EXISTS outreach_daily_strategy_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date DATE NOT NULL,
  strategy_key TEXT NOT NULL,
  target_count INTEGER NOT NULL CHECK (target_count BETWEEN 0 AND 1000),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  delivered_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  replied_count INTEGER NOT NULL DEFAULT 0 CHECK (replied_count >= 0),
  bounced_count INTEGER NOT NULL DEFAULT 0 CHECK (bounced_count >= 0),
  suppressed_count INTEGER NOT NULL DEFAULT 0 CHECK (suppressed_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_date, strategy_key)
);

CREATE TABLE IF NOT EXISTS outreach_attempt_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date DATE NOT NULL,
  strategy_key TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  reservation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  attempt_kind TEXT NOT NULL DEFAULT 'first_touch' CHECK (
    attempt_kind IN ('first_touch', 'follow_up', 'buyer_packet')
  ),
  state TEXT NOT NULL DEFAULT 'reserved' CHECK (
    state IN ('reserved', 'accepted', 'delivered', 'replied', 'bounced', 'complained', 'suppressed', 'failed', 'cancelled')
  ),
  provider_message_id TEXT,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_version BIGINT NOT NULL DEFAULT pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE outreach_attempt_reservations
  ADD COLUMN IF NOT EXISTS reservation_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE outreach_attempt_reservations
  ADD COLUMN IF NOT EXISTS owner_lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes');
ALTER TABLE outreach_attempt_reservations
  ADD COLUMN IF NOT EXISTS evidence_version BIGINT;
UPDATE public.outreach_attempt_reservations
SET evidence_version = pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass)
WHERE evidence_version IS NULL;
ALTER TABLE outreach_attempt_reservations
  ALTER COLUMN evidence_version SET DEFAULT pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass),
  ALTER COLUMN evidence_version SET NOT NULL;

ALTER TABLE public.property_buyer_packet_sends
  ADD COLUMN IF NOT EXISTS send_claim_token UUID;
ALTER TABLE public.property_buyer_packet_sends
  ADD COLUMN IF NOT EXISTS send_claim_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS outreach_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  stage TEXT NOT NULL,
  effective_cap INTEGER NOT NULL CHECK (effective_cap BETWEEN 0 AND 1000),
  sample_size INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  bad_count INTEGER NOT NULL DEFAULT 0,
  bad_rate NUMERIC(8, 6) NOT NULL DEFAULT 0,
  complaint_count INTEGER NOT NULL DEFAULT 0,
  provider_failure_rate NUMERIC(8, 6) NOT NULL DEFAULT 0,
  mailbox_fresh BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_ready BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_attempt_reservations_rolling
  ON outreach_attempt_reservations(reserved_at DESC)
  WHERE state <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_outreach_attempt_reservations_lane_day
  ON outreach_attempt_reservations(business_date, strategy_key, reserved_at DESC)
  WHERE state <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_outreach_attempt_reservations_provider_message
  ON outreach_attempt_reservations(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_attempt_reservations_recipient_time
  ON outreach_attempt_reservations(recipient_hash, reserved_at DESC)
  WHERE state <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_property_buyer_packet_sends_claim
  ON public.property_buyer_packet_sends(send_claim_expires_at)
  WHERE status = 'queued' AND send_claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_health_snapshots_sender_time
  ON outreach_health_snapshots(sender_key, observed_at DESC);

-- Delivery webhook events need a database-enforced identity. The historical
-- metadata-only lookup allowed concurrent workers to insert the same event.
ALTER TABLE public.outreach_send_events
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT;

ALTER TABLE public.provider_delivery_events
  ADD COLUMN IF NOT EXISTS sender_email TEXT;
ALTER TABLE public.provider_delivery_events
  ADD COLUMN IF NOT EXISTS evidence_version BIGINT;

-- A sequence-backed watermark gives every delivery-evidence mutation a
-- database-monotonic identity. Client timestamps cannot safely order evidence
-- queries whose completion order is inverted.
UPDATE public.provider_delivery_events
SET evidence_version = pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass)
WHERE evidence_version IS NULL;
ALTER TABLE public.provider_delivery_events
  ALTER COLUMN evidence_version SET DEFAULT pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass),
  ALTER COLUMN evidence_version SET NOT NULL;

-- Historical outreach on the production account used VestBlock's canonical
-- acquisitions sender. Preserve that evidence for this sender only; future
-- senders begin with their own controlled trial and cannot inherit it.
UPDATE public.provider_delivery_events
SET sender_email = 'acquisitions@vestblock.io'
WHERE sender_email IS NULL
  AND NULLIF(metadata_json->>'outreachRecordType', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_delivery_events_sender_time
  ON public.provider_delivery_events(provider, sender_email, occurred_at DESC)
  WHERE sender_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_delivery_events_evidence_watermark
  ON public.provider_delivery_events(provider, evidence_version DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_attempt_evidence_watermark
  ON public.outreach_attempt_reservations(provider, evidence_version DESC);

UPDATE public.outreach_send_events
SET provider_event_id = NULLIF(metadata_json->>'providerEventId', '')
WHERE provider_event_id IS NULL
  AND NULLIF(metadata_json->>'providerEventId', '') IS NOT NULL;

WITH duplicated AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY provider, provider_event_id
           ORDER BY created_at ASC, id ASC
         ) AS duplicate_rank
  FROM public.outreach_send_events
  WHERE provider_event_id IS NOT NULL
)
UPDATE public.outreach_send_events AS event
SET provider_event_id = NULL
FROM duplicated
WHERE event.id = duplicated.id
  AND duplicated.duplicate_rank > 1;

ALTER TABLE public.outreach_send_events
  DROP CONSTRAINT IF EXISTS outreach_send_events_provider_event_unique;
ALTER TABLE public.outreach_send_events
  ADD CONSTRAINT outreach_send_events_provider_event_unique
  UNIQUE (provider, provider_event_id);

-- Every evidence mutation takes the same short transaction lock as ramp
-- persistence and attempt reservation. A promotion can therefore compare its
-- pre-read watermark with the current database watermark without an event
-- slipping into the check/update gap.
CREATE OR REPLACE FUNCTION public.stamp_outreach_delivery_evidence_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(2086227401);
  NEW.evidence_version := pg_catalog.nextval('public.outreach_delivery_evidence_version_seq'::regclass);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_delivery_evidence_insert_version
  ON public.provider_delivery_events;
CREATE TRIGGER provider_delivery_evidence_insert_version
BEFORE INSERT ON public.provider_delivery_events
FOR EACH ROW
EXECUTE FUNCTION public.stamp_outreach_delivery_evidence_version();

DROP TRIGGER IF EXISTS provider_delivery_evidence_update_version
  ON public.provider_delivery_events;
CREATE TRIGGER provider_delivery_evidence_update_version
BEFORE UPDATE OF provider, sender_email, delivery_status
ON public.provider_delivery_events
FOR EACH ROW
EXECUTE FUNCTION public.stamp_outreach_delivery_evidence_version();

DROP TRIGGER IF EXISTS outreach_attempt_evidence_insert_version
  ON public.outreach_attempt_reservations;
CREATE TRIGGER outreach_attempt_evidence_insert_version
BEFORE INSERT ON public.outreach_attempt_reservations
FOR EACH ROW
EXECUTE FUNCTION public.stamp_outreach_delivery_evidence_version();

DROP TRIGGER IF EXISTS outreach_attempt_evidence_update_version
  ON public.outreach_attempt_reservations;
CREATE TRIGGER outreach_attempt_evidence_update_version
BEFORE UPDATE OF state, provider, sender_email, provider_message_id, reserved_at
ON public.outreach_attempt_reservations
FOR EACH ROW
EXECUTE FUNCTION public.stamp_outreach_delivery_evidence_version();

CREATE OR REPLACE FUNCTION public.get_outreach_delivery_evidence_watermark(
  p_provider TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_provider TEXT := LOWER(BTRIM(COALESCE(p_provider, '')));
  v_evidence_watermark BIGINT := 0;
BEGIN
  IF v_provider = '' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason', 'missing_delivery_evidence_provider'
    );
  END IF;

  SELECT COALESCE(MAX(evidence.evidence_version), 0)
  INTO v_evidence_watermark
  FROM (
    SELECT event.evidence_version
    FROM public.provider_delivery_events AS event
    WHERE event.provider = v_provider
    UNION ALL
    SELECT attempt.evidence_version
    FROM public.outreach_attempt_reservations AS attempt
    WHERE attempt.provider = v_provider
  ) AS evidence;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'provider', v_provider,
    'evidenceWatermark', v_evidence_watermark,
    'observedAt', pg_catalog.clock_timestamp()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hard_stop_outreach_sender(
  p_provider TEXT,
  p_sender_email TEXT,
  p_reason TEXT,
  p_evidence_watermark BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_sender_key TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_provider, '')), '') IS NULL OR
     NULLIF(BTRIM(COALESCE(p_sender_email, '')), '') IS NULL OR
     p_evidence_watermark IS NULL OR p_evidence_watermark < 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(2086227401);
  v_now := pg_catalog.clock_timestamp();
  v_sender_key := LOWER(BTRIM(p_provider)) || ':' || LOWER(BTRIM(p_sender_email));

  UPDATE public.outreach_sender_ramp_state
  SET stage = 'hold',
      effective_cap = 0,
      stage_entered_at = v_now,
      last_transition_at = v_now,
      last_conservative_decision_at = v_now,
      hold_reason = COALESCE(NULLIF(BTRIM(p_reason), ''), 'live_delivery_hard_stop'),
      evidence_json = COALESCE(evidence_json, '{}'::jsonb) || jsonb_build_object(
        'liveHardStop', TRUE,
        'liveHardStopReason', COALESCE(NULLIF(BTRIM(p_reason), ''), 'live_delivery_hard_stop'),
        'liveHardStopAt', v_now
      ),
      evidence_watermark = GREATEST(evidence_watermark, p_evidence_watermark),
      evidence_observed_at = GREATEST(evidence_observed_at, v_now),
      version = version + 1,
      updated_at = v_now
  WHERE sender_key = v_sender_key;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.hard_stop_outreach_sender_on_complaint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF LOWER(NEW.delivery_status) = 'complained' AND
     NULLIF(BTRIM(COALESCE(NEW.sender_email, '')), '') IS NOT NULL THEN
    PERFORM public.hard_stop_outreach_sender(
      NEW.provider,
      NEW.sender_email,
      'live_provider_complaint',
      NEW.evidence_version
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_delivery_complaint_hard_stop
  ON public.provider_delivery_events;
CREATE TRIGGER provider_delivery_complaint_hard_stop
AFTER INSERT OR UPDATE OF delivery_status, sender_email
ON public.provider_delivery_events
FOR EACH ROW
EXECUTE FUNCTION public.hard_stop_outreach_sender_on_complaint();

ALTER TABLE outreach_sender_ramp_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_daily_strategy_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_attempt_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_health_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON outreach_sender_ramp_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON outreach_daily_strategy_budgets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON outreach_attempt_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON outreach_health_snapshots FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_sender_ramp_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_daily_strategy_budgets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_attempt_reservations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON outreach_health_snapshots TO service_role;

-- Serialize live mailbox ingestion across cron, admin, and retry invocations.
-- The lease is longer than the route timeout; a crashed worker leaves the last
-- safe pagination cursor untouched and the next cron can reclaim it.
CREATE OR REPLACE FUNCTION claim_outlook_mailbox_sync(
  p_job_key TEXT,
  p_claim_token TEXT,
  p_lease_seconds INTEGER DEFAULT 600
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_metrics JSONB;
  v_existing_expires_at TIMESTAMPTZ;
  v_existing_expires_text TEXT;
  v_lease_seconds INTEGER := LEAST(3600, GREATEST(60, COALESCE(p_lease_seconds, 600)));
BEGIN
  IF p_job_key IS NULL OR p_job_key <> 'reply-memory-sync' OR
     p_claim_token IS NULL OR BTRIM(p_claim_token) = '' THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'invalid_mailbox_sync_claim');
  END IF;

  SELECT metrics_json INTO v_metrics
  FROM public.command_center_jobs
  WHERE job_key = p_job_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'mailbox_sync_job_not_found');
  END IF;

  v_existing_expires_text := v_metrics #>> '{syncLease,expiresAt}';
  IF v_existing_expires_text IS NOT NULL THEN
    BEGIN
      v_existing_expires_at := v_existing_expires_text::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      v_existing_expires_at := NULL;
    END;
  END IF;
  IF v_existing_expires_at IS NOT NULL AND v_existing_expires_at > v_now THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'reason', 'mailbox_sync_claim_active',
      'leaseExpiresAt', v_existing_expires_at
    );
  END IF;

  v_metrics := jsonb_set(
    COALESCE(v_metrics, '{}'::jsonb),
    '{syncLease}',
    jsonb_build_object(
      'claimToken', p_claim_token,
      'claimedAt', v_now,
      'expiresAt', v_now + make_interval(secs => v_lease_seconds),
      'leaseSeconds', v_lease_seconds
    ),
    TRUE
  );

  UPDATE public.command_center_jobs
  SET status = 'active',
      last_status = 'running',
      last_error = NULL,
      last_run_at = v_now,
      metrics_json = v_metrics,
      updated_at = v_now
  WHERE job_key = p_job_key;

  RETURN jsonb_build_object(
    'claimed', TRUE,
    'reason', NULL,
    'claimToken', p_claim_token,
    'metrics', v_metrics
  );
END;
$$;

-- Claim reply/opt-out side effects before mutating CRM, suppression, or task
-- records. This prevents overlapping cron/manual invocations from acting on
-- the same inbound message concurrently while allowing a stale lease to be
-- retried after a worker crash.
CREATE OR REPLACE FUNCTION claim_outlook_mailbox_side_effects(
  p_mailbox TEXT,
  p_message_id TEXT,
  p_claim_token TEXT,
  p_lease_seconds INTEGER DEFAULT 600
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_metadata JSONB;
  v_status TEXT;
  v_claimed_at TIMESTAMPTZ;
  v_claimed_at_text TEXT;
  v_lease_seconds INTEGER := LEAST(3600, GREATEST(60, COALESCE(p_lease_seconds, 600)));
BEGIN
  IF p_mailbox IS NULL OR BTRIM(p_mailbox) = '' OR
     p_message_id IS NULL OR BTRIM(p_message_id) = '' OR
     p_claim_token IS NULL OR BTRIM(p_claim_token) = '' THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'invalid_mailbox_side_effect_claim');
  END IF;

  SELECT metadata_json INTO v_metadata
  FROM public.command_center_reply_memory
  WHERE mailbox = p_mailbox
    AND message_id = p_message_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'mailbox_message_not_found');
  END IF;

  v_status := COALESCE(v_metadata #>> '{mailboxSideEffects,status}', '');
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'mailbox_side_effects_already_completed');
  END IF;

  v_claimed_at_text := v_metadata #>> '{mailboxSideEffects,claimedAt}';
  IF v_status = 'processing' AND v_claimed_at_text IS NOT NULL THEN
    BEGIN
      v_claimed_at := v_claimed_at_text::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      v_claimed_at := NULL;
    END;
    IF v_claimed_at IS NOT NULL AND
       v_claimed_at > v_now - make_interval(secs => v_lease_seconds) THEN
      RETURN jsonb_build_object('claimed', FALSE, 'reason', 'mailbox_side_effects_claim_active');
    END IF;
  END IF;

  UPDATE public.command_center_reply_memory
  SET metadata_json = jsonb_set(
        COALESCE(metadata_json, '{}'::jsonb),
        '{mailboxSideEffects}',
        jsonb_build_object(
          'status', 'processing',
          'claimToken', p_claim_token,
          'claimedAt', v_now,
          'leaseSeconds', v_lease_seconds,
          'version', 1
        ),
        TRUE
      ),
      updated_at = v_now
  WHERE mailbox = p_mailbox
    AND message_id = p_message_id;

  RETURN jsonb_build_object('claimed', TRUE, 'reason', NULL, 'claimToken', p_claim_token);
END;
$$;

-- Only the owner of the current whole-sync lease may publish cursor/status
-- results. This prevents an expired worker from erasing a successor's cursor
-- or marking reply capture complete while that successor is still running.
CREATE OR REPLACE FUNCTION finalize_outlook_mailbox_sync(
  p_job_key TEXT,
  p_claim_token TEXT,
  p_status TEXT,
  p_last_status TEXT,
  p_error TEXT,
  p_metrics JSONB,
  p_replace_metrics BOOLEAN,
  p_next_run_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_current_metrics JSONB;
  v_next_metrics JSONB;
BEGIN
  IF p_job_key <> 'reply-memory-sync' OR
     p_claim_token IS NULL OR BTRIM(p_claim_token) = '' OR
     p_status NOT IN ('active', 'blocked', 'failed') OR
     p_last_status IS NULL OR BTRIM(p_last_status) = '' THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'invalid_mailbox_sync_finalization');
  END IF;

  SELECT metrics_json INTO v_current_metrics
  FROM public.command_center_jobs
  WHERE job_key = p_job_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'mailbox_sync_job_not_found');
  END IF;
  IF COALESCE(v_current_metrics #>> '{syncLease,claimToken}', '') <> p_claim_token THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'mailbox_sync_lease_not_owned');
  END IF;

  v_next_metrics := CASE
    WHEN p_replace_metrics THEN COALESCE(p_metrics, '{}'::jsonb) - 'syncLease'
    ELSE COALESCE(v_current_metrics, '{}'::jsonb) - 'syncLease'
  END;

  UPDATE public.command_center_jobs
  SET status = p_status,
      last_status = p_last_status,
      last_error = NULLIF(p_error, ''),
      last_run_at = v_now,
      next_run_at = p_next_run_at,
      metrics_json = v_next_metrics,
      updated_at = v_now
  WHERE job_key = p_job_key;

  RETURN jsonb_build_object('updated', TRUE, 'reason', NULL);
END;
$$;

-- Remove the pre-watermark signature so a partially reapplied migration cannot
-- leave a timestamp-only promotion path callable.
DROP FUNCTION IF EXISTS public.record_outreach_sender_ramp_decision(
  TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, TIMESTAMPTZ
);

-- Holds and downshifts always win, regardless of worker completion order. A
-- cap/stage increase is different: its database watermark must still match,
-- its snapshot must have begun after the lower state was committed, and the
-- lower state must have survived a database-time cooldown. Evidence writers
-- take the same advisory lock, closing the final compare/update race.
CREATE OR REPLACE FUNCTION record_outreach_sender_ramp_decision(
  p_sender_key TEXT,
  p_provider TEXT,
  p_sender_email TEXT,
  p_stage TEXT,
  p_target_cap INTEGER,
  p_effective_cap INTEGER,
  p_hold_reason TEXT,
  p_evidence JSONB,
  p_evidence_watermark BIGINT,
  p_evidence_observed_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_existing public.outreach_sender_ramp_state%ROWTYPE;
  v_changed BOOLEAN := FALSE;
  v_is_promotion BOOLEAN := FALSE;
  v_existing_stage_rank INTEGER := 0;
  v_proposed_stage_rank INTEGER := 0;
  v_current_evidence_watermark BIGINT := 0;
  v_promotion_eligible_at TIMESTAMPTZ;
  v_latest_lower_decision_at TIMESTAMPTZ;
BEGIN
  IF p_sender_key IS NULL OR BTRIM(p_sender_key) = '' OR
     p_provider IS NULL OR BTRIM(p_provider) = '' OR
     p_sender_email IS NULL OR BTRIM(p_sender_email) = '' OR
     p_sender_key <> (LOWER(BTRIM(p_provider)) || ':' || LOWER(BTRIM(p_sender_email))) OR
     p_stage NOT IN ('hold', 'recovery', 'prove_25', 'prove_100', 'prove_250', 'prove_500', 'full_1000') OR
     p_target_cap < 1 OR p_target_cap > 1000 OR
     p_effective_cap < 0 OR p_effective_cap > p_target_cap OR
     p_evidence_observed_at IS NULL OR
     p_evidence_observed_at > v_now + INTERVAL '5 minutes' THEN
    RETURN jsonb_build_object('applied', FALSE, 'changed', FALSE, 'reason', 'invalid_ramp_decision');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(2086227401);
  v_now := pg_catalog.clock_timestamp();

  SELECT COALESCE(MAX(evidence.evidence_version), 0)
  INTO v_current_evidence_watermark
  FROM (
    SELECT event.evidence_version
    FROM public.provider_delivery_events AS event
    WHERE event.provider = LOWER(BTRIM(p_provider))
    UNION ALL
    SELECT attempt.evidence_version
    FROM public.outreach_attempt_reservations AS attempt
    WHERE attempt.provider = LOWER(BTRIM(p_provider))
  ) AS evidence;

  SELECT * INTO v_existing
  FROM public.outreach_sender_ramp_state
  WHERE sender_key = p_sender_key
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Even the first non-zero state must describe a stable read. If evidence
    -- changed between that read and this transaction, establish an
    -- authoritative hold instead of bootstrapping from a stale healthy view.
    IF p_effective_cap > 0 AND (
      p_evidence_watermark IS NULL OR
      p_evidence_watermark < 0 OR
      p_evidence_watermark <> v_current_evidence_watermark
    ) THEN
      INSERT INTO public.outreach_sender_ramp_state (
        sender_key,
        provider,
        sender_email,
        stage,
        target_cap,
        effective_cap,
        stage_entered_at,
        last_transition_at,
        last_conservative_decision_at,
        hold_reason,
        evidence_json,
        evidence_watermark,
        evidence_observed_at,
        version,
        updated_at
      ) VALUES (
        p_sender_key,
        p_provider,
        p_sender_email,
        'hold',
        p_target_cap,
        0,
        v_now,
        v_now,
        v_now,
        'initial_delivery_evidence_changed_during_evaluation',
        COALESCE(p_evidence, '{}'::jsonb),
        v_current_evidence_watermark,
        v_now,
        1,
        v_now
      );
      RETURN jsonb_build_object(
        'applied', FALSE,
        'changed', TRUE,
        'reason', 'outreach_ramp_promotion_evidence_changed',
        'effectiveCap', 0,
        'evidenceWatermark', v_current_evidence_watermark,
        'evidenceObservedAt', v_now,
        'promotionEligibleAt', v_now + INTERVAL '15 minutes',
        'version', 1
      );
    END IF;

    INSERT INTO public.outreach_sender_ramp_state (
      sender_key,
      provider,
      sender_email,
      stage,
      target_cap,
      effective_cap,
      stage_entered_at,
      last_transition_at,
      last_conservative_decision_at,
      hold_reason,
      evidence_json,
      evidence_watermark,
      evidence_observed_at,
      version,
      updated_at
    ) VALUES (
      p_sender_key,
      p_provider,
      p_sender_email,
      p_stage,
      p_target_cap,
      p_effective_cap,
      v_now,
      v_now,
      v_now,
      CASE WHEN p_effective_cap = 0 THEN p_hold_reason ELSE NULL END,
      COALESCE(p_evidence, '{}'::jsonb),
      v_current_evidence_watermark,
      GREATEST(p_evidence_observed_at, v_now),
      1,
      v_now
    );
    RETURN jsonb_build_object(
      'applied', TRUE,
      'changed', TRUE,
      'effectiveCap', p_effective_cap,
      'evidenceWatermark', v_current_evidence_watermark,
      'evidenceObservedAt', GREATEST(p_evidence_observed_at, v_now),
      'version', 1
    );
  END IF;

  v_existing_stage_rank := CASE v_existing.stage
    WHEN 'hold' THEN 0
    WHEN 'recovery' THEN 1
    WHEN 'prove_25' THEN 2
    WHEN 'prove_100' THEN 3
    WHEN 'prove_250' THEN 4
    WHEN 'prove_500' THEN 5
    WHEN 'full_1000' THEN 6
    ELSE 0
  END;
  v_proposed_stage_rank := CASE p_stage
    WHEN 'hold' THEN 0
    WHEN 'recovery' THEN 1
    WHEN 'prove_25' THEN 2
    WHEN 'prove_100' THEN 3
    WHEN 'prove_250' THEN 4
    WHEN 'prove_500' THEN 5
    WHEN 'full_1000' THEN 6
    ELSE 0
  END;
  v_is_promotion :=
    p_effective_cap > v_existing.effective_cap OR (
      p_effective_cap = v_existing.effective_cap AND
      v_proposed_stage_rank > v_existing_stage_rank
    );
  v_promotion_eligible_at := v_existing.last_transition_at + INTERVAL '15 minutes';
  v_latest_lower_decision_at := GREATEST(
    v_existing.last_transition_at,
    v_existing.last_conservative_decision_at
  );

  IF v_is_promotion AND (p_evidence_watermark IS NULL OR p_evidence_watermark < 0) THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'changed', FALSE,
      'reason', 'outreach_ramp_promotion_evidence_watermark_missing',
      'effectiveCap', v_existing.effective_cap,
      'evidenceWatermark', v_existing.evidence_watermark,
      'evidenceObservedAt', v_existing.evidence_observed_at,
      'promotionEligibleAt', v_promotion_eligible_at,
      'version', v_existing.version
    );
  END IF;

  IF v_is_promotion AND p_evidence_watermark <> v_current_evidence_watermark THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'changed', FALSE,
      'reason', 'outreach_ramp_promotion_evidence_changed',
      'effectiveCap', v_existing.effective_cap,
      'evidenceWatermark', v_current_evidence_watermark,
      'evidenceObservedAt', v_existing.evidence_observed_at,
      'promotionEligibleAt', v_promotion_eligible_at,
      'version', v_existing.version
    );
  END IF;

  IF v_is_promotion AND p_evidence_observed_at <= v_latest_lower_decision_at THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'changed', FALSE,
      'reason', 'outreach_ramp_promotion_evidence_predates_lower_state',
      'effectiveCap', v_existing.effective_cap,
      'evidenceWatermark', v_existing.evidence_watermark,
      'evidenceObservedAt', v_existing.evidence_observed_at,
      'promotionEligibleAt', v_promotion_eligible_at,
      'version', v_existing.version
    );
  END IF;

  IF v_is_promotion AND v_now < v_promotion_eligible_at THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'changed', FALSE,
      'reason', 'outreach_ramp_promotion_cooldown_active',
      'effectiveCap', v_existing.effective_cap,
      'evidenceWatermark', v_existing.evidence_watermark,
      'evidenceObservedAt', v_existing.evidence_observed_at,
      'promotionEligibleAt', v_promotion_eligible_at,
      'version', v_existing.version
    );
  END IF;

  v_changed :=
    v_existing.stage IS DISTINCT FROM p_stage OR
    v_existing.target_cap IS DISTINCT FROM p_target_cap OR
    v_existing.effective_cap IS DISTINCT FROM p_effective_cap OR
    v_existing.hold_reason IS DISTINCT FROM CASE WHEN p_effective_cap = 0 THEN p_hold_reason ELSE NULL END;

  UPDATE public.outreach_sender_ramp_state
  SET provider = p_provider,
      sender_email = p_sender_email,
      stage = p_stage,
      target_cap = p_target_cap,
      effective_cap = p_effective_cap,
      stage_entered_at = CASE WHEN v_changed THEN v_now ELSE stage_entered_at END,
      last_transition_at = CASE WHEN v_changed THEN v_now ELSE last_transition_at END,
      last_conservative_decision_at = CASE
        WHEN NOT v_is_promotion THEN v_now
        ELSE last_conservative_decision_at
      END,
      hold_reason = CASE WHEN p_effective_cap = 0 THEN p_hold_reason ELSE NULL END,
      evidence_json = COALESCE(p_evidence, '{}'::jsonb),
      evidence_watermark = GREATEST(evidence_watermark, v_current_evidence_watermark),
      evidence_observed_at = GREATEST(evidence_observed_at, p_evidence_observed_at),
      version = version + CASE WHEN v_changed OR NOT v_is_promotion THEN 1 ELSE 0 END,
      updated_at = v_now
  WHERE id = v_existing.id;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'changed', v_changed,
    'effectiveCap', p_effective_cap,
    'evidenceWatermark', GREATEST(v_existing.evidence_watermark, v_current_evidence_watermark),
    'evidenceObservedAt', GREATEST(v_existing.evidence_observed_at, p_evidence_observed_at),
    'version', v_existing.version + CASE WHEN v_changed OR NOT v_is_promotion THEN 1 ELSE 0 END
  );
END;
$$;

-- The pre-token signature must not survive an incremental re-application: it
-- could reserve without establishing an owner and would bypass safe release.
DROP FUNCTION IF EXISTS public.reserve_outreach_throughput_attempt(
  TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
);

CREATE OR REPLACE FUNCTION reserve_outreach_throughput_attempt(
  p_strategy_key TEXT,
  p_lane_target INTEGER,
  p_global_rolling_limit INTEGER,
  p_message_id TEXT,
  p_idempotency_key TEXT,
  p_recipient_hash TEXT,
  p_provider TEXT,
  p_sender_email TEXT,
  p_reservation_token UUID,
  p_attempt_kind TEXT DEFAULT 'first_touch',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_business_date DATE := (NOW() AT TIME ZONE 'America/Chicago')::date;
  v_global_count INTEGER := 0;
  v_lane_count INTEGER := 0;
  v_reservation_id UUID;
  v_existing public.outreach_attempt_reservations%ROWTYPE;
  v_ramp public.outreach_sender_ramp_state%ROWTYPE;
  v_reuse_cancelled BOOLEAN := FALSE;
  v_sender_key TEXT;
  v_authoritative_global_limit INTEGER := 0;
  v_authoritative_lane_target INTEGER := 0;
  v_owner_lease_expires_at TIMESTAMPTZ := v_now + INTERVAL '10 minutes';
BEGIN
  IF p_strategy_key IS NULL OR BTRIM(p_strategy_key) = '' THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'missing_strategy_key');
  END IF;
  IF p_lane_target < 1 OR p_lane_target > 1000 THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'invalid_lane_target');
  END IF;
  IF p_global_rolling_limit < 1 OR p_global_rolling_limit > 1000 THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'invalid_global_rolling_limit');
  END IF;
  IF p_message_id IS NULL OR BTRIM(p_message_id) = '' OR
     p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' OR
     p_recipient_hash IS NULL OR BTRIM(p_recipient_hash) = '' OR
     p_provider IS NULL OR BTRIM(p_provider) = '' OR
     p_sender_email IS NULL OR BTRIM(p_sender_email) = '' OR
     p_reservation_token IS NULL OR
     p_attempt_kind NOT IN ('first_touch', 'follow_up', 'buyer_packet') THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'invalid_attempt_identity');
  END IF;

  -- One short transaction lock makes the global rolling count and the daily
  -- lane count a single atomic decision across all server and cron workers.
  PERFORM pg_catalog.pg_advisory_xact_lock(2086227401);

  v_sender_key := LOWER(BTRIM(p_provider)) || ':' || LOWER(BTRIM(p_sender_email));
  SELECT * INTO v_ramp
  FROM public.outreach_sender_ramp_state
  WHERE sender_key = v_sender_key
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_authoritative_ramp_state_missing',
      'authoritativeGlobalLimit', 0,
      'authoritativeLaneTarget', 0
    );
  END IF;

  v_authoritative_global_limit := LEAST(p_global_rolling_limit, v_ramp.effective_cap);
  IF jsonb_typeof(v_ramp.evidence_json->'allocationByKey'->p_strategy_key) = 'number' THEN
    v_authoritative_lane_target := LEAST(
      p_lane_target,
      GREATEST(0, (v_ramp.evidence_json->'allocationByKey'->>p_strategy_key)::INTEGER)
    );
  END IF;

  IF v_authoritative_global_limit < 1 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_authoritative_sender_hold',
      'authoritativeGlobalLimit', v_authoritative_global_limit,
      'authoritativeLaneTarget', v_authoritative_lane_target
    );
  END IF;
  IF v_authoritative_lane_target < 1 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_authoritative_strategy_hold',
      'authoritativeGlobalLimit', v_authoritative_global_limit,
      'authoritativeLaneTarget', v_authoritative_lane_target
    );
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_global_count
  FROM public.outreach_attempt_reservations
  WHERE state <> 'cancelled'
    AND reserved_at >= v_now - INTERVAL '24 hours';

  SELECT COUNT(*)::INTEGER INTO v_lane_count
  FROM public.outreach_attempt_reservations
  WHERE state <> 'cancelled'
    AND business_date = v_business_date
    AND strategy_key = p_strategy_key;

  SELECT * INTO v_existing
  FROM public.outreach_attempt_reservations
  WHERE message_id = p_message_id OR idempotency_key = p_idempotency_key
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.message_id <> p_message_id OR v_existing.idempotency_key <> p_idempotency_key THEN
      RETURN jsonb_build_object(
        'allowed', FALSE,
        'reason', 'outreach_attempt_identity_conflict',
        'reservationId', v_existing.id
      );
    END IF;

    -- A committed reservation can lose its HTTP response before the caller
    -- receives the reservation id. Only its current owner may continue while
    -- the short worker lease is live. Once the lease expires, an exact Resend
    -- identity may atomically take ownership inside Resend's idempotency
    -- window. This prevents concurrent invocations from sharing a row and
    -- then cancelling each other's accounting.
    IF v_existing.state = 'reserved' THEN
      IF LOWER(v_existing.provider) = 'resend' AND
         LOWER(p_provider) = 'resend' AND
         v_existing.strategy_key = p_strategy_key AND
         v_existing.recipient_hash = p_recipient_hash AND
         LOWER(v_existing.sender_email) = LOWER(p_sender_email) AND
         v_existing.attempt_kind = p_attempt_kind AND
         v_existing.business_date = v_business_date AND
         v_global_count <= v_authoritative_global_limit AND
         v_lane_count <= v_authoritative_lane_target AND
         v_existing.reserved_at >= v_now - INTERVAL '23 hours' THEN
        IF v_existing.reservation_token = p_reservation_token THEN
          UPDATE public.outreach_attempt_reservations
          SET owner_lease_expires_at = v_owner_lease_expires_at,
              updated_at = v_now
          WHERE id = v_existing.id
            AND reservation_token = p_reservation_token;

          RETURN jsonb_build_object(
            'allowed', TRUE,
            'reason', 'idempotent_reserved_attempt_owner_retry',
            'reservationId', v_existing.id,
            'businessDate', v_existing.business_date,
            'authoritativeGlobalLimit', v_authoritative_global_limit,
            'authoritativeLaneTarget', v_authoritative_lane_target,
            'globalAttemptCount', v_global_count,
            'laneAttemptCount', v_lane_count,
            'idempotentRetry', TRUE,
            'ownsReservation', TRUE,
            'cancellableByOwner', FALSE,
            'ownerLeaseExpiresAt', v_owner_lease_expires_at
          );
        END IF;

        IF v_existing.owner_lease_expires_at > v_now THEN
          RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'outreach_reserved_attempt_requires_reconciliation',
            'detail', 'reservation_owned_by_active_attempt',
            'reservationId', v_existing.id,
            'businessDate', v_existing.business_date,
            'authoritativeGlobalLimit', v_authoritative_global_limit,
            'authoritativeLaneTarget', v_authoritative_lane_target,
            'globalAttemptCount', v_global_count,
            'laneAttemptCount', v_lane_count,
            'ownsReservation', FALSE,
            'ownerLeaseExpiresAt', v_existing.owner_lease_expires_at
          );
        END IF;

        UPDATE public.outreach_attempt_reservations
        SET reservation_token = p_reservation_token,
            owner_lease_expires_at = v_owner_lease_expires_at,
            metadata_json = COALESCE(metadata_json, '{}'::jsonb) ||
              jsonb_build_object('reservationOwnershipRecoveredAt', v_now),
            updated_at = v_now
        WHERE id = v_existing.id
          AND reservation_token = v_existing.reservation_token
        RETURNING * INTO v_existing;

        RETURN jsonb_build_object(
          'allowed', TRUE,
          'reason', 'idempotent_reserved_attempt_owner_takeover',
          'reservationId', v_existing.id,
          'businessDate', v_existing.business_date,
          'authoritativeGlobalLimit', v_authoritative_global_limit,
          'authoritativeLaneTarget', v_authoritative_lane_target,
          'globalAttemptCount', v_global_count,
          'laneAttemptCount', v_lane_count,
          'idempotentRetry', TRUE,
          'ownsReservation', TRUE,
          'cancellableByOwner', FALSE,
          'ownerLeaseExpiresAt', v_owner_lease_expires_at
        );
      END IF;
      RETURN jsonb_build_object(
        'allowed', FALSE,
        'reason', 'outreach_reserved_attempt_requires_reconciliation',
        'reservationId', v_existing.id
      );
    END IF;

    IF v_existing.state <> 'cancelled' THEN
      RETURN jsonb_build_object(
        'allowed', FALSE,
        'reason', 'outreach_attempt_already_reserved',
        'reservationId', v_existing.id,
        'existingState', v_existing.state
      );
    END IF;
    v_reuse_cancelled := TRUE;
  END IF;

  IF v_global_count >= v_authoritative_global_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_global_rolling_limit_exhausted',
      'authoritativeGlobalLimit', v_authoritative_global_limit,
      'authoritativeLaneTarget', v_authoritative_lane_target,
      'globalAttemptCount', v_global_count,
      'globalRemaining', 0
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.outreach_attempt_reservations
    WHERE recipient_hash = p_recipient_hash
      AND state <> 'cancelled'
      AND reserved_at >= v_now - INTERVAL '24 hours'
  ) THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_recipient_24h_cooldown',
      'globalAttemptCount', v_global_count
    );
  END IF;

  INSERT INTO public.outreach_daily_strategy_budgets (
    business_date,
    strategy_key,
    target_count,
    updated_at
  ) VALUES (
    v_business_date,
    p_strategy_key,
    v_authoritative_lane_target,
    v_now
  )
  ON CONFLICT (business_date, strategy_key) DO UPDATE
    SET target_count = EXCLUDED.target_count,
        updated_at = EXCLUDED.updated_at;

  IF v_lane_count >= v_authoritative_lane_target THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'outreach_strategy_daily_limit_exhausted',
      'authoritativeGlobalLimit', v_authoritative_global_limit,
      'authoritativeLaneTarget', v_authoritative_lane_target,
      'laneAttemptCount', v_lane_count,
      'laneRemaining', 0,
      'globalAttemptCount', v_global_count
    );
  END IF;

  IF v_reuse_cancelled THEN
    UPDATE public.outreach_attempt_reservations
    SET business_date = v_business_date,
        strategy_key = p_strategy_key,
        recipient_hash = p_recipient_hash,
        provider = p_provider,
        sender_email = p_sender_email,
        reservation_token = p_reservation_token,
        owner_lease_expires_at = v_owner_lease_expires_at,
        attempt_kind = p_attempt_kind,
        state = 'reserved',
        provider_message_id = NULL,
        reserved_at = v_now,
        accepted_at = NULL,
        finalized_at = NULL,
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) ||
          COALESCE(p_metadata, '{}'::jsonb) ||
          jsonb_build_object('reopenedCancelledReservationAt', v_now),
        updated_at = v_now
    WHERE id = v_existing.id
    RETURNING id INTO v_reservation_id;
  ELSE
    INSERT INTO public.outreach_attempt_reservations (
      business_date,
      strategy_key,
      message_id,
      idempotency_key,
      recipient_hash,
      provider,
      sender_email,
      reservation_token,
      owner_lease_expires_at,
      attempt_kind,
      metadata_json,
      reserved_at,
      updated_at
    ) VALUES (
      v_business_date,
      p_strategy_key,
      p_message_id,
      p_idempotency_key,
      p_recipient_hash,
      p_provider,
      p_sender_email,
      p_reservation_token,
      v_owner_lease_expires_at,
      p_attempt_kind,
      COALESCE(p_metadata, '{}'::jsonb),
      v_now,
      v_now
    )
    RETURNING id INTO v_reservation_id;
  END IF;

  UPDATE public.outreach_daily_strategy_budgets
  SET reserved_count = v_lane_count + 1,
      updated_at = v_now
  WHERE business_date = v_business_date
    AND strategy_key = p_strategy_key;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'reason', NULL,
    'reservationId', v_reservation_id,
    'businessDate', v_business_date,
    'authoritativeGlobalLimit', v_authoritative_global_limit,
    'authoritativeLaneTarget', v_authoritative_lane_target,
    'globalAttemptCount', v_global_count + 1,
    'globalRemaining', GREATEST(0, v_authoritative_global_limit - v_global_count - 1),
    'laneAttemptCount', v_lane_count + 1,
    'laneRemaining', GREATEST(0, v_authoritative_lane_target - v_lane_count - 1),
    'ownsReservation', TRUE,
    'cancellableByOwner', TRUE,
    'ownerLeaseExpiresAt', v_owner_lease_expires_at
  );
END;
$$;

-- Remove the legacy release endpoint because it could cancel a reservation
-- without proving ownership.
DROP FUNCTION IF EXISTS public.record_outreach_throughput_outcome(
  UUID, TEXT, TEXT, JSONB
);

CREATE OR REPLACE FUNCTION record_outreach_throughput_outcome(
  p_reservation_id UUID,
  p_state TEXT,
  p_provider_message_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_reservation_token UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_previous public.outreach_attempt_reservations%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_previous_rank INTEGER := 0;
  v_next_rank INTEGER := 0;
  v_outcome_evidence_watermark BIGINT := 0;
BEGIN
  IF p_state NOT IN ('reserved', 'accepted', 'delivered', 'replied', 'bounced', 'complained', 'suppressed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'invalid_outreach_attempt_state');
  END IF;

  -- Keep lock ordering consistent with ramp persistence and evidence triggers.
  PERFORM pg_catalog.pg_advisory_xact_lock(2086227401);

  SELECT * INTO v_previous
  FROM public.outreach_attempt_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('updated', FALSE, 'reason', 'outreach_attempt_not_found');
  END IF;
  IF p_state = 'cancelled' AND
     (p_reservation_token IS NULL OR p_reservation_token <> v_previous.reservation_token) THEN
    RETURN jsonb_build_object(
      'updated', FALSE,
      'reason', 'outreach_reservation_not_owned',
      'state', v_previous.state
    );
  END IF;
  IF v_previous.state = p_state THEN
    RETURN jsonb_build_object('updated', TRUE, 'unchanged', TRUE, 'state', p_state);
  END IF;

  -- Use the same deterministic precedence as provider-event projection so
  -- out-of-order webhooks can upgrade to a worse terminal outcome but can
  -- never erase it with a later delivery/open retry.
  v_previous_rank := CASE v_previous.state
    WHEN 'reserved' THEN 10
    WHEN 'accepted' THEN 20
    WHEN 'delivered' THEN 40
    WHEN 'replied' THEN 60
    WHEN 'failed' THEN 70
    WHEN 'bounced' THEN 80
    WHEN 'suppressed' THEN 90
    WHEN 'complained' THEN 100
    WHEN 'cancelled' THEN 1000
    ELSE 0
  END;
  v_next_rank := CASE p_state
    WHEN 'reserved' THEN 10
    WHEN 'accepted' THEN 20
    WHEN 'delivered' THEN 40
    WHEN 'replied' THEN 60
    WHEN 'failed' THEN 70
    WHEN 'bounced' THEN 80
    WHEN 'suppressed' THEN 90
    WHEN 'complained' THEN 100
    WHEN 'cancelled' THEN 1000
    ELSE 0
  END;
  IF (p_state = 'cancelled' AND v_previous.state <> 'reserved') OR
     v_previous.state = 'cancelled' OR
     v_previous_rank >= v_next_rank THEN
    RETURN jsonb_build_object(
      'updated', TRUE,
      'unchanged', TRUE,
      'state', v_previous.state,
      'ignoredState', p_state,
      'reason', 'out_of_order_or_terminal_outcome'
    );
  END IF;

  UPDATE public.outreach_attempt_reservations
  SET state = p_state,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      accepted_at = CASE
        WHEN p_state IN ('accepted', 'delivered', 'replied') THEN COALESCE(accepted_at, v_now)
        ELSE accepted_at
      END,
      finalized_at = CASE
        WHEN p_state IN ('delivered', 'replied', 'bounced', 'complained', 'suppressed', 'failed', 'cancelled') THEN v_now
        ELSE finalized_at
      END,
      metadata_json = COALESCE(metadata_json, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
      owner_lease_expires_at = CASE
        WHEN p_state IN ('accepted', 'delivered', 'replied', 'bounced', 'complained', 'suppressed', 'failed', 'cancelled') THEN v_now
        ELSE owner_lease_expires_at
      END,
      updated_at = v_now
  WHERE id = p_reservation_id
  RETURNING evidence_version INTO v_outcome_evidence_watermark;

  -- The provider-event trigger normally performs this stop first. This
  -- reservation-bound fallback also covers a webhook whose sender identity
  -- could only be recovered from its throughput record.
  IF p_state = 'complained' THEN
    PERFORM public.hard_stop_outreach_sender(
      v_previous.provider,
      v_previous.sender_email,
      'live_provider_complaint',
      v_outcome_evidence_watermark
    );
  END IF;

  UPDATE public.outreach_daily_strategy_budgets
  SET reserved_count = GREATEST(
        0,
        reserved_count - CASE WHEN p_state = 'cancelled' AND v_previous.state <> 'cancelled' THEN 1 ELSE 0 END
      ),
      accepted_count = accepted_count + CASE
        WHEN p_state IN ('accepted', 'delivered', 'replied') AND v_previous.state NOT IN ('accepted', 'delivered', 'replied') THEN 1 ELSE 0 END,
      delivered_count = delivered_count + CASE
        WHEN p_state IN ('delivered', 'replied') AND v_previous.state NOT IN ('delivered', 'replied') THEN 1 ELSE 0 END,
      replied_count = replied_count + CASE WHEN p_state = 'replied' AND v_previous.state <> 'replied' THEN 1 ELSE 0 END,
      bounced_count = bounced_count + CASE WHEN p_state = 'bounced' AND v_previous.state <> 'bounced' THEN 1 ELSE 0 END,
      suppressed_count = suppressed_count + CASE WHEN p_state = 'suppressed' AND v_previous.state <> 'suppressed' THEN 1 ELSE 0 END,
      failed_count = failed_count + CASE WHEN p_state IN ('failed', 'complained') AND v_previous.state NOT IN ('failed', 'complained') THEN 1 ELSE 0 END,
      updated_at = v_now
  WHERE business_date = v_previous.business_date
    AND strategy_key = v_previous.strategy_key;

  RETURN jsonb_build_object('updated', TRUE, 'unchanged', FALSE, 'state', p_state);
END;
$$;

DROP FUNCTION IF EXISTS public.claim_buyer_packet_send(
  UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, INTEGER
);

-- Claim one buyer/packet pair before any provider call. The existing partial
-- unique index gives the pair one durable row; this lease gives it one live
-- sender. Duplicate admin and cron invocations therefore cannot both send.
CREATE OR REPLACE FUNCTION claim_buyer_packet_send(
  p_buyer_packet_id UUID,
  p_buyer_id UUID,
  p_buyer_match_id UUID,
  p_buyer_email TEXT,
  p_subject TEXT,
  p_claim_token UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_lease_seconds INTEGER DEFAULT 600
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_lease_seconds INTEGER := LEAST(1800, GREATEST(60, COALESCE(p_lease_seconds, 600)));
  v_claim_expires_at TIMESTAMPTZ;
  v_send public.property_buyer_packet_sends%ROWTYPE;
BEGIN
  IF p_buyer_packet_id IS NULL OR p_buyer_id IS NULL OR p_claim_token IS NULL THEN
    RETURN jsonb_build_object('claimed', FALSE, 'reason', 'invalid_buyer_packet_send_claim');
  END IF;
  v_claim_expires_at := v_now + pg_catalog.make_interval(secs => v_lease_seconds);

  -- The transaction is tiny and packet fanout is bounded, so one advisory
  -- lock is a predictable fail-safe even if a legacy writer races the unique
  -- index during rollout.
  PERFORM pg_catalog.pg_advisory_xact_lock(2086227402);

  SELECT * INTO v_send
  FROM public.property_buyer_packet_sends
  WHERE buyer_packet_id = p_buyer_packet_id
    AND buyer_id = p_buyer_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.property_buyer_packet_sends (
      buyer_packet_id,
      buyer_id,
      buyer_match_id,
      buyer_email,
      subject,
      status,
      send_error,
      metadata_json,
      send_claim_token,
      send_claim_expires_at,
      updated_at
    ) VALUES (
      p_buyer_packet_id,
      p_buyer_id,
      p_buyer_match_id,
      NULLIF(BTRIM(COALESCE(p_buyer_email, '')), ''),
      NULLIF(BTRIM(COALESCE(p_subject, '')), ''),
      'queued',
      NULL,
      COALESCE(p_metadata, '{}'::jsonb),
      p_claim_token,
      v_claim_expires_at,
      v_now
    )
    ON CONFLICT (buyer_packet_id, buyer_id) WHERE buyer_id IS NOT NULL
      DO NOTHING
    RETURNING * INTO v_send;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'claimed', TRUE,
        'reason', 'buyer_packet_send_claim_created',
        'claimExpiresAt', v_claim_expires_at,
        'send', to_jsonb(v_send)
      );
    END IF;

    SELECT * INTO v_send
    FROM public.property_buyer_packet_sends
    WHERE buyer_packet_id = p_buyer_packet_id
      AND buyer_id = p_buyer_id
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'claimed', FALSE,
        'reason', 'buyer_packet_send_claim_race_unresolved'
      );
    END IF;
  END IF;

  IF v_send.status IN (
    'accepted', 'sent', 'delivered', 'delivery_delayed', 'opened', 'replied',
    'interested', 'rejected', 'bounced', 'complained', 'suppressed'
  ) THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'reason', 'buyer_packet_send_already_terminal',
      'send', to_jsonb(v_send)
    );
  END IF;

  IF v_send.status = 'queued' AND
     v_send.send_claim_token IS DISTINCT FROM p_claim_token AND
     v_send.send_claim_expires_at > v_now THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'reason', 'buyer_packet_send_claimed_by_active_attempt',
      'claimExpiresAt', v_send.send_claim_expires_at,
      'send', to_jsonb(v_send)
    );
  END IF;

  UPDATE public.property_buyer_packet_sends
  SET buyer_match_id = COALESCE(p_buyer_match_id, buyer_match_id),
      buyer_email = COALESCE(NULLIF(BTRIM(COALESCE(p_buyer_email, '')), ''), buyer_email),
      subject = COALESCE(NULLIF(BTRIM(COALESCE(p_subject, '')), ''), subject),
      status = 'queued',
      send_provider = NULL,
      provider_message_id = NULL,
      sent_at = NULL,
      send_error = NULL,
      metadata_json = COALESCE(metadata_json, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
      send_claim_token = p_claim_token,
      send_claim_expires_at = v_claim_expires_at,
      updated_at = v_now
  WHERE id = v_send.id
  RETURNING * INTO v_send;

  RETURN jsonb_build_object(
    'claimed', TRUE,
    'reason', 'buyer_packet_send_claim_acquired',
    'claimExpiresAt', v_claim_expires_at,
    'send', to_jsonb(v_send)
  );
END;
$$;

REVOKE ALL ON FUNCTION reserve_outreach_throughput_attempt(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_buyer_packet_send(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_outlook_mailbox_side_effects(TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION claim_outlook_mailbox_sync(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION finalize_outlook_mailbox_sync(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_outreach_delivery_evidence_watermark(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION hard_stop_outreach_sender(TEXT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION hard_stop_outreach_sender_on_complaint()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION stamp_outreach_delivery_evidence_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION record_outreach_sender_ramp_decision(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, BIGINT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION record_outreach_throughput_outcome(UUID, TEXT, TEXT, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.outreach_delivery_evidence_version_seq
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_outreach_throughput_attempt(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION claim_buyer_packet_send(UUID, UUID, UUID, TEXT, TEXT, UUID, JSONB, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION claim_outlook_mailbox_side_effects(TEXT, TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION claim_outlook_mailbox_sync(TEXT, TEXT, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION finalize_outlook_mailbox_sync(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION get_outreach_delivery_evidence_watermark(TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION hard_stop_outreach_sender(TEXT, TEXT, TEXT, BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION hard_stop_outreach_sender_on_complaint()
  TO service_role;
GRANT EXECUTE ON FUNCTION stamp_outreach_delivery_evidence_version()
  TO service_role;
GRANT EXECUTE ON FUNCTION record_outreach_sender_ramp_decision(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, JSONB, BIGINT, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION record_outreach_throughput_outcome(UUID, TEXT, TEXT, JSONB, UUID)
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.outreach_delivery_evidence_version_seq
  TO service_role;
