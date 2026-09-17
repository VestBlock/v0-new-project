-- Lead outreach delivery finalization persists provider identifiers on the
-- message row. Partner outreach tables already have this JSONB column, but the
-- original lead outreach table predates it. Without the column, Outlook can
-- accept a message while the post-send update fails and leaves the message in
-- `queued`, even though durable acceptance evidence exists.

ALTER TABLE public.outreach_messages
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.outreach_messages.metadata_json IS
  'Non-secret delivery identity and reconciliation metadata for the lead outreach message.';

-- Repair only rows with authoritative Outlook acceptance evidence. This is a
-- state projection, not another provider attempt, so it cannot resend mail.
WITH latest_acceptance AS (
  SELECT DISTINCT ON (event.outreach_message_id)
    event.outreach_message_id,
    event.lead_id,
    event.provider,
    event.created_at AS accepted_at,
    COALESCE(event.metadata_json, '{}'::jsonb) AS metadata_json
  FROM public.outreach_send_events AS event
  WHERE event.status = 'accepted'
    AND event.provider = 'outlook'
    AND event.outreach_message_id IS NOT NULL
  ORDER BY event.outreach_message_id, event.created_at DESC, event.id DESC
)
UPDATE public.outreach_messages AS message
SET status = 'sent',
    sent_at = COALESCE(message.sent_at, acceptance.accepted_at),
    send_provider = COALESCE(message.send_provider, acceptance.provider),
    send_error = NULL,
    metadata_json = COALESCE(message.metadata_json, '{}'::jsonb) ||
      jsonb_build_object(
        'deliveryReconciledFrom', 'outreach_send_events',
        'deliveryReconciledAt', pg_catalog.clock_timestamp(),
        'providerMessageId', acceptance.metadata_json->'providerMessageId',
        'internetMessageId', acceptance.metadata_json->'internetMessageId',
        'dispatchId', acceptance.metadata_json->'dispatchId',
        'correlationId', acceptance.metadata_json->'correlationId',
        'acceptanceStatus', acceptance.metadata_json->'acceptanceStatus',
        'ledgerFinalized', acceptance.metadata_json->'ledgerFinalized'
      ),
    updated_at = pg_catalog.clock_timestamp()
FROM latest_acceptance AS acceptance
WHERE message.id = acceptance.outreach_message_id
  AND message.status = 'queued'
  AND message.sent_at IS NULL;

-- Project the same durable acceptance into strategy membership state. Only
-- pre-acceptance states advance; later delivery/reply/failure evidence wins.
WITH accepted_strategy_leads AS (
  SELECT DISTINCT ON (event.lead_id)
    event.lead_id,
    event.created_at AS accepted_at
  FROM public.outreach_send_events AS event
  JOIN public.outreach_messages AS message
    ON message.id = event.outreach_message_id
  WHERE event.status = 'accepted'
    AND event.provider = 'outlook'
    AND message.generated_with LIKE 'strategy_engine:%'
  ORDER BY event.lead_id, event.created_at DESC, event.id DESC
)
UPDATE public.strategy_lead_memberships AS membership
SET status = 'accepted',
    last_outcome_at = acceptance.accepted_at,
    updated_at = pg_catalog.clock_timestamp()
FROM accepted_strategy_leads AS acceptance
WHERE membership.lead_id = acceptance.lead_id
  AND membership.status IN ('qualified', 'needs_review', 'approved');

-- Recompute affected run counters after the membership projection. This avoids
-- stale aggregates when two accepted sends finalize concurrently.
WITH affected_runs AS (
  SELECT DISTINCT membership.campaign_run_id
  FROM public.strategy_lead_memberships AS membership
  JOIN public.outreach_messages AS message
    ON message.lead_id = membership.lead_id
  JOIN public.outreach_send_events AS event
    ON event.outreach_message_id = message.id
  WHERE event.status = 'accepted'
    AND event.provider = 'outlook'
    AND message.generated_with LIKE 'strategy_engine:%'
    AND membership.campaign_run_id IS NOT NULL
), run_totals AS (
  SELECT
    membership.campaign_run_id,
    COUNT(*) FILTER (
      WHERE membership.status IN ('accepted', 'delivered', 'opened', 'clicked', 'replied')
    )::INTEGER AS accepted_count,
    COUNT(*) FILTER (
      WHERE membership.status IN ('delivered', 'opened', 'clicked', 'replied')
    )::INTEGER AS delivered_count,
    COUNT(*) FILTER (WHERE membership.status = 'replied')::INTEGER AS reply_count,
    COUNT(*) FILTER (WHERE membership.status IN ('bounced', 'complained'))::INTEGER AS bounce_count,
    COUNT(*)::INTEGER AS membership_count
  FROM public.strategy_lead_memberships AS membership
  WHERE membership.campaign_run_id IN (SELECT campaign_run_id FROM affected_runs)
  GROUP BY membership.campaign_run_id
)
UPDATE public.command_center_strategy_runs AS run
SET status = CASE
      WHEN totals.reply_count > 0 THEN 'replied'
      WHEN totals.delivered_count > 0 THEN 'delivered'
      WHEN totals.accepted_count > 0 THEN 'provider_accepted'
      WHEN totals.bounce_count = totals.membership_count AND totals.membership_count > 0 THEN 'failed'
      ELSE run.status
    END,
    sent_count = totals.accepted_count,
    accepted_count = totals.accepted_count,
    delivered_count = totals.delivered_count,
    reply_count = totals.reply_count,
    bounce_count = totals.bounce_count,
    updated_at = pg_catalog.clock_timestamp()
FROM run_totals AS totals
WHERE run.id = totals.campaign_run_id;
