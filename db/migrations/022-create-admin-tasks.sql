-- Durable admin task queue for VestBlock operations.
-- Run after 020-vestblock-ops-automation.sql.

CREATE TABLE IF NOT EXISTS admin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'admin_followup',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'completed', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  user_id UUID,
  user_email TEXT,
  entity_type TEXT,
  entity_id TEXT,
  source_event_id UUID,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata_json JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON admin_tasks(status);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON admin_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_due_at ON admin_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_user_id ON admin_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_entity ON admin_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON admin_tasks(created_at DESC);

CREATE OR REPLACE FUNCTION public.vestblock_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_admin_tasks_updated ON admin_tasks;
CREATE TRIGGER on_admin_tasks_updated
  BEFORE UPDATE ON admin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin tasks" ON admin_tasks;
CREATE POLICY "Admins can view admin tasks"
  ON admin_tasks FOR SELECT
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert admin tasks" ON admin_tasks;
CREATE POLICY "Admins can insert admin tasks"
  ON admin_tasks FOR INSERT
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update admin tasks" ON admin_tasks;
CREATE POLICY "Admins can update admin tasks"
  ON admin_tasks FOR UPDATE
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can delete admin tasks" ON admin_tasks;
CREATE POLICY "Admins can delete admin tasks"
  ON admin_tasks FOR DELETE
  USING (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON admin_tasks TO authenticated;
GRANT ALL ON admin_tasks TO service_role;

INSERT INTO admin_tasks (
  title,
  description,
  task_type,
  status,
  priority,
  entity_type,
  due_at,
  metadata_json
)
SELECT
  'Review restored credit report backlog',
  'Restored credit report rows were imported from the legacy backup. Confirm which reports still need files, analysis, or customer follow-up.',
  'restored_report_backlog',
  'open',
  'high',
  'credit_report',
  NOW() + INTERVAL '2 days',
  jsonb_build_object(
    'restored_uploaded_reports',
    (SELECT COUNT(*) FROM credit_reports WHERE status = 'uploaded')
  )
WHERE EXISTS (
  SELECT 1 FROM credit_reports WHERE status = 'uploaded'
)
AND NOT EXISTS (
  SELECT 1 FROM admin_tasks WHERE task_type = 'restored_report_backlog'
);
