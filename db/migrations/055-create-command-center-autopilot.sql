CREATE TABLE IF NOT EXISTS command_center_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL CHECK (
    job_type IN (
      'daily_strategy_plan',
      'source_rotation',
      'seller_outreach_batch',
      'reply_memory_sync',
      'suppression_sync',
      'followup_router',
      'deal_routing_sync'
    )
  ),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'running', 'blocked', 'failed')),
  cadence TEXT NOT NULL DEFAULT 'hourly',
  priority INTEGER NOT NULL DEFAULT 50,
  strategy_key TEXT,
  source_provider TEXT,
  market TEXT,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_center_strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES command_center_jobs(id) ON DELETE SET NULL,
  strategy_key TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (
    status IN ('planned', 'dry_run', 'running', 'completed', 'blocked', 'failed')
  ),
  source_provider TEXT NOT NULL DEFAULT 'dealmachine',
  market TEXT,
  target_email_count INTEGER NOT NULL DEFAULT 0,
  target_sms_count INTEGER NOT NULL DEFAULT 0,
  lead_count INTEGER NOT NULL DEFAULT 0,
  draft_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  sms_review_count INTEGER NOT NULL DEFAULT 0,
  suppression_blocked_count INTEGER NOT NULL DEFAULT 0,
  cost_guardrail_status TEXT NOT NULL DEFAULT 'allowed',
  artifact_path TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_center_outbound_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_run_id UUID REFERENCES command_center_strategy_runs(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  strategy_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'task')),
  recipient TEXT,
  recipient_hash TEXT,
  market TEXT,
  property_address TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'needs_review', 'approved', 'sent', 'replied', 'suppressed', 'failed')
  ),
  suppression_reason TEXT,
  next_action_at TIMESTAMPTZ,
  last_message_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_center_reply_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_center_event_id UUID REFERENCES command_center_events(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_run_id UUID REFERENCES command_center_strategy_runs(id) ON DELETE SET NULL,
  strategy_key TEXT,
  mailbox TEXT NOT NULL DEFAULT 'acquisitions@vestblock.io',
  thread_id TEXT,
  message_id TEXT,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  property_address TEXT,
  market TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classification TEXT NOT NULL DEFAULT 'low_priority' CHECK (
    classification IN ('hot_seller_lead', 'partner_reply', 'spam_noise', 'operational_alert', 'low_priority')
  ),
  next_step TEXT,
  reply_summary TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_center_suppression_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suppression_id UUID REFERENCES lead_suppressions(id) ON DELETE SET NULL,
  campaign_run_id UUID REFERENCES command_center_strategy_runs(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  strategy_key TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'task')),
  matched_value TEXT,
  decision TEXT NOT NULL DEFAULT 'blocked' CHECK (decision IN ('blocked', 'suppressed', 'released', 'manual_review')),
  reason TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_center_jobs_due
  ON command_center_jobs(status, next_run_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_jobs_strategy
  ON command_center_jobs(strategy_key, market);
CREATE INDEX IF NOT EXISTS idx_command_center_strategy_runs_strategy_time
  ON command_center_strategy_runs(strategy_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_strategy_runs_status
  ON command_center_strategy_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_outbound_enrollments_strategy_status
  ON command_center_outbound_enrollments(strategy_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_outbound_enrollments_lead
  ON command_center_outbound_enrollments(lead_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_command_center_outbound_enrollments_run_recipient
  ON command_center_outbound_enrollments(campaign_run_id, channel, recipient_hash)
  WHERE recipient_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_command_center_reply_memory_received
  ON command_center_reply_memory(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_command_center_reply_memory_strategy
  ON command_center_reply_memory(strategy_key, classification, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_command_center_reply_memory_mailbox_message
  ON command_center_reply_memory(mailbox, message_id);
CREATE INDEX IF NOT EXISTS idx_command_center_suppression_decisions_strategy
  ON command_center_suppression_decisions(strategy_key, decision, created_at DESC);

INSERT INTO command_center_jobs (
  job_key,
  job_type,
  title,
  status,
  cadence,
  priority,
  next_run_at,
  config_json,
  updated_at
)
VALUES
  (
    'daily-strategy-plan',
    'daily_strategy_plan',
    'Choose daily focus and challenger strategy',
    'active',
    'daily morning',
    100,
    NOW(),
    '{"localHour":8,"output":"strategy plan + source blockers + send target"}'::jsonb,
    NOW()
  ),
  (
    'source-rotation',
    'source_rotation',
    'Rotate markets and sources before scraping',
    'active',
    'every 6 hours',
    90,
    NOW(),
    '{"avoidRepeatHours":18,"preferOwnedFreeSources":true}'::jsonb,
    NOW()
  ),
  (
    'seller-outreach-batch',
    'seller_outreach_batch',
    'Prepare strategy-specific seller batches',
    'active',
    'hourly while slots remain',
    85,
    NOW(),
    '{"channel":"email","sms":"review_only","maxPerStrategy":100}'::jsonb,
    NOW()
  ),
  (
    'reply-memory-sync',
    'reply_memory_sync',
    'Attach replies to campaign, property, and next step',
    'active',
    'hourly',
    95,
    NOW(),
    '{"mailbox":"acquisitions@vestblock.io","fallbackMailbox":"contact@vestblock.io"}'::jsonb,
    NOW()
  ),
  (
    'suppression-sync',
    'suppression_sync',
    'Apply opt-out, bounce, wrong-owner, and spam suppressions',
    'active',
    'before every send',
    110,
    NOW(),
    '{"blockAcrossStrategies":true,"channels":["email","sms"]}'::jsonb,
    NOW()
  ),
  (
    'followup-router',
    'followup_router',
    'Route due seller and partner follow-ups',
    'active',
    'hourly',
    80,
    NOW(),
    '{"staleHours":[24,48,72]}'::jsonb,
    NOW()
  ),
  (
    'deal-routing-sync',
    'deal_routing_sync',
    'Turn analyses into buyer, lender, builder, or creative routes',
    'active',
    'after every saved analysis',
    75,
    NOW(),
    '{"rankingEngine":"disabled_until_more_data"}'::jsonb,
    NOW()
  )
ON CONFLICT (job_key) DO UPDATE SET
  job_type = EXCLUDED.job_type,
  title = EXCLUDED.title,
  status = CASE WHEN command_center_jobs.status = 'paused' THEN command_center_jobs.status ELSE EXCLUDED.status END,
  cadence = EXCLUDED.cadence,
  priority = EXCLUDED.priority,
  config_json = EXCLUDED.config_json,
  updated_at = NOW();

ALTER TABLE command_center_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center_strategy_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center_outbound_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center_reply_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_center_suppression_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view command center jobs" ON command_center_jobs;
CREATE POLICY "Admins can view command center jobs"
  ON command_center_jobs FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center jobs" ON command_center_jobs;
CREATE POLICY "Admins can insert command center jobs"
  ON command_center_jobs FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update command center jobs" ON command_center_jobs;
CREATE POLICY "Admins can update command center jobs"
  ON command_center_jobs FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view command center strategy runs" ON command_center_strategy_runs;
CREATE POLICY "Admins can view command center strategy runs"
  ON command_center_strategy_runs FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center strategy runs" ON command_center_strategy_runs;
CREATE POLICY "Admins can insert command center strategy runs"
  ON command_center_strategy_runs FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update command center strategy runs" ON command_center_strategy_runs;
CREATE POLICY "Admins can update command center strategy runs"
  ON command_center_strategy_runs FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view command center outbound enrollments" ON command_center_outbound_enrollments;
CREATE POLICY "Admins can view command center outbound enrollments"
  ON command_center_outbound_enrollments FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center outbound enrollments" ON command_center_outbound_enrollments;
CREATE POLICY "Admins can insert command center outbound enrollments"
  ON command_center_outbound_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update command center outbound enrollments" ON command_center_outbound_enrollments;
CREATE POLICY "Admins can update command center outbound enrollments"
  ON command_center_outbound_enrollments FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view command center reply memory" ON command_center_reply_memory;
CREATE POLICY "Admins can view command center reply memory"
  ON command_center_reply_memory FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center reply memory" ON command_center_reply_memory;
CREATE POLICY "Admins can insert command center reply memory"
  ON command_center_reply_memory FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update command center reply memory" ON command_center_reply_memory;
CREATE POLICY "Admins can update command center reply memory"
  ON command_center_reply_memory FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can view command center suppression decisions" ON command_center_suppression_decisions;
CREATE POLICY "Admins can view command center suppression decisions"
  ON command_center_suppression_decisions FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert command center suppression decisions" ON command_center_suppression_decisions;
CREATE POLICY "Admins can insert command center suppression decisions"
  ON command_center_suppression_decisions FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON command_center_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON command_center_strategy_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON command_center_outbound_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON command_center_reply_memory TO authenticated;
GRANT SELECT, INSERT ON command_center_suppression_decisions TO authenticated;
GRANT ALL ON command_center_jobs TO service_role;
GRANT ALL ON command_center_strategy_runs TO service_role;
GRANT ALL ON command_center_outbound_enrollments TO service_role;
GRANT ALL ON command_center_reply_memory TO service_role;
GRANT ALL ON command_center_suppression_decisions TO service_role;
