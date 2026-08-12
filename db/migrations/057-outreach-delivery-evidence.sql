-- Provider-backed outreach delivery evidence.

ALTER TABLE email_events
  DROP CONSTRAINT IF EXISTS email_events_status_check;

ALTER TABLE email_events
  ADD CONSTRAINT email_events_status_check
  CHECK (status IN (
    'queued',
    'accepted',
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'suppressed',
    'failed',
    'skipped'
  ));

ALTER TABLE outreach_send_events
  DROP CONSTRAINT IF EXISTS outreach_send_events_status_check;

ALTER TABLE outreach_send_events
  ADD CONSTRAINT outreach_send_events_status_check
  CHECK (status IN (
    'approved',
    'queued',
    'accepted',
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'suppressed',
    'failed',
    'skipped',
    'opened',
    'clicked',
    'replied'
  ));

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_delivery_status_check;

ALTER TABLE leads
  ADD CONSTRAINT leads_delivery_status_check
  CHECK (delivery_status IN (
    'not_sent',
    'queued',
    'accepted',
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'replied',
    'booked',
    'suppressed',
    'failed'
  ));

CREATE TABLE IF NOT EXISTS provider_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_delivery_events_message
  ON provider_delivery_events(provider, provider_message_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_delivery_events_status
  ON provider_delivery_events(delivery_status, occurred_at DESC);

ALTER TABLE provider_delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view provider delivery events" ON provider_delivery_events;
CREATE POLICY "Admins can view provider delivery events"
  ON provider_delivery_events FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

GRANT SELECT ON provider_delivery_events TO authenticated;
GRANT ALL ON provider_delivery_events TO service_role;
