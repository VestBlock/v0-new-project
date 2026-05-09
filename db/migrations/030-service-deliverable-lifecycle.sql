ALTER TABLE service_deliverables
  DROP CONSTRAINT IF EXISTS service_deliverables_status_check;

ALTER TABLE service_deliverables
  ADD CONSTRAINT service_deliverables_status_check
  CHECK (status IN ('requested', 'generating', 'ready_for_review', 'sent_to_client', 'failed'));

ALTER TABLE service_deliverables
  ADD COLUMN IF NOT EXISTS customer_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;
