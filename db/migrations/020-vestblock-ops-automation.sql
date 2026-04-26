-- VestBlock operating platform automation tables and credit workflow columns.
-- Run in Supabase SQL Editor after the existing migrations.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

ALTER TABLE credit_reports
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS analysis_json JSONB,
  ADD COLUMN IF NOT EXISTS dispute_letters_json JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS email_alert_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credit_reports_status_check'
  ) THEN
    ALTER TABLE credit_reports
      ADD CONSTRAINT credit_reports_status_check
      CHECK (status IN (
        'uploaded',
        'extracting_text',
        'text_extracted',
        'analyzing',
        'completed',
        'failed',
        'needs_review'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  event_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_reports_status ON credit_reports(status);
CREATE INDEX IF NOT EXISTS idx_credit_reports_user_id ON credit_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reports_uploaded_at ON credit_reports(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_status ON email_events(status);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action_type ON admin_activity(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity(created_at DESC);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.vestblock_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE (user_profiles.user_id = auth.uid() OR user_profiles.id = auth.uid())
      AND user_profiles.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.vestblock_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.vestblock_is_admin() TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

DROP POLICY IF EXISTS "Admins can view all credit reports" ON credit_reports;
CREATE POLICY "Admins can view all credit reports"
  ON credit_reports FOR SELECT
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update all credit reports" ON credit_reports;
CREATE POLICY "Admins can update all credit reports"
  ON credit_reports FOR UPDATE
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Users can view their own credit reports" ON credit_reports;
CREATE POLICY "Users can view their own credit reports"
  ON credit_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own credit reports" ON credit_reports;
CREATE POLICY "Users can insert their own credit reports"
  ON credit_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view email events" ON email_events;
CREATE POLICY "Admins can view email events"
  ON email_events FOR SELECT
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view activity" ON admin_activity;
CREATE POLICY "Admins can view activity"
  ON admin_activity FOR SELECT
  USING (private.vestblock_is_admin());

GRANT SELECT ON email_events TO authenticated;
GRANT SELECT ON admin_activity TO authenticated;
GRANT ALL ON email_events TO service_role;
GRANT ALL ON admin_activity TO service_role;
