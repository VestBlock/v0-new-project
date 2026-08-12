ALTER TABLE strategy_lead_memberships
  ADD COLUMN IF NOT EXISTS recipient_key TEXT;

UPDATE strategy_lead_memberships AS membership
SET recipient_key = LOWER(TRIM(lead.email))
FROM leads AS lead
WHERE lead.id = membership.lead_id
  AND membership.recipient_key IS NULL;

WITH ranked_memberships AS (
  SELECT
    id,
    lead_id,
    ROW_NUMBER() OVER (
      PARTITION BY recipient_key
      ORDER BY created_at ASC, id ASC
    ) AS recipient_rank
  FROM strategy_lead_memberships
  WHERE recipient_key IS NOT NULL
)
UPDATE outreach_messages AS message
SET
  status = 'archived',
  updated_at = NOW()
FROM ranked_memberships AS membership
WHERE membership.recipient_rank > 1
  AND message.lead_id = membership.lead_id
  AND message.status <> 'sent';

DELETE FROM strategy_lead_memberships AS later
USING strategy_lead_memberships AS earlier
WHERE later.recipient_key = earlier.recipient_key
  AND later.recipient_key IS NOT NULL
  AND (
    later.created_at > earlier.created_at
    OR (later.created_at = earlier.created_at AND later.id::text > earlier.id::text)
  );

ALTER TABLE strategy_lead_memberships
  ALTER COLUMN recipient_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_lead_memberships_recipient
  ON strategy_lead_memberships(recipient_key);
