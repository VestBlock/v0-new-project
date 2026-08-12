-- Separate source observation, execution attempts, contact readiness, and
-- delivery outcomes so a scheduled attempt cannot masquerade as fresh data or
-- successful outreach.

ALTER TABLE strategy_market_state
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_source_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_provider_accept_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

UPDATE strategy_market_state
SET last_source_success_at = last_source_at
WHERE last_source_success_at IS NULL
  AND last_source_at IS NOT NULL
  AND CASE
    WHEN COALESCE(metrics_json ->> 'discoveredPool', '') ~ '^[0-9]+$'
      THEN (metrics_json ->> 'discoveredPool')::INTEGER > 0
    ELSE FALSE
  END;

ALTER TABLE command_center_strategy_runs
  DROP CONSTRAINT IF EXISTS command_center_strategy_runs_status_check;

ALTER TABLE command_center_strategy_runs
  ADD CONSTRAINT command_center_strategy_runs_status_check CHECK (
    status IN (
      'planned',
      'dry_run',
      'running',
      'no_due_work',
      'awaiting_contacts',
      'drafted',
      'send_blocked',
      'provider_accepted',
      'delivered',
      'replied',
      'completed',
      'blocked',
      'failed',
      'source_blocked',
      'quality_blocked'
    )
  );

CREATE INDEX IF NOT EXISTS idx_strategy_market_state_source_success
  ON strategy_market_state(source_provider, last_source_success_at DESC);

COMMENT ON COLUMN strategy_market_state.last_attempt_at IS
  'Last scheduler/worker attempt. This is not source freshness evidence.';
COMMENT ON COLUMN strategy_market_state.last_source_success_at IS
  'Timestamp of the newest successfully persisted source observation.';
COMMENT ON COLUMN strategy_market_state.last_contact_ready_at IS
  'Last time this lane/market had at least one policy-eligible verified contact.';
COMMENT ON COLUMN strategy_market_state.last_provider_accept_at IS
  'Last provider-accepted outbound event attributed to this lane/market.';
COMMENT ON COLUMN strategy_market_state.last_reply_at IS
  'Last attributed inbound reply for this lane/market.';
