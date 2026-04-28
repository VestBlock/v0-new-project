-- Dispute-letter follow-up automation.
-- Adds workflow dates used by /api/cron/dispute-letter-monitor.

ALTER TABLE public.dispute_letters
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS source_report_path TEXT,
  ADD COLUMN IF NOT EXISTS bureau TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS num_items INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS html TEXT,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS mailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_mail_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_mail_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS secondary_bureau_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS secondary_bureau_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bureau_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bureau_response_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automation_metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.dispute_letters
SET
  workflow_stage = COALESCE(workflow_stage, 'generated'),
  first_mail_due_at = COALESCE(first_mail_due_at, created_at + INTERVAL '24 hours'),
  secondary_bureau_due_at = COALESCE(secondary_bureau_due_at, created_at + INTERVAL '7 days'),
  next_action_at = COALESCE(next_action_at, created_at + INTERVAL '24 hours'),
  automation_metadata = COALESCE(automation_metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'firstMailReminderHours', 24,
      'secondaryBureauReminderDays', 7,
      'bureauResponseReviewDays', 35
    )
WHERE
  first_mail_due_at IS NULL
  OR secondary_bureau_due_at IS NULL
  OR next_action_at IS NULL
  OR workflow_stage IS NULL
  OR automation_metadata IS NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_letters_user_id
  ON public.dispute_letters(user_id);

CREATE INDEX IF NOT EXISTS idx_dispute_letters_status
  ON public.dispute_letters(status);

CREATE INDEX IF NOT EXISTS idx_dispute_letters_next_action
  ON public.dispute_letters(next_action_at)
  WHERE next_action_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_letters_first_mail_due
  ON public.dispute_letters(first_mail_due_at)
  WHERE first_mail_reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_letters_secondary_due
  ON public.dispute_letters(secondary_bureau_due_at)
  WHERE secondary_bureau_reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dispute_letters_response_due
  ON public.dispute_letters(bureau_response_due_at)
  WHERE bureau_response_reminder_sent_at IS NULL;

ALTER TABLE public.dispute_letters ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispute_letters TO authenticated;
GRANT ALL ON public.dispute_letters TO service_role;
