-- Gate 3: durable, reviewable public-web research evidence. The worker may
-- collect only allowlisted public evidence; this schema intentionally does not
-- provide a path from research collection to CRM enrollment or outreach send.

CREATE TABLE IF NOT EXISTS research_domain_policies (
  domain TEXT PRIMARY KEY CHECK (domain = lower(domain) AND domain !~ '[/:@]'),
  display_name TEXT,
  source_tier TEXT NOT NULL DEFAULT 'public' CHECK (source_tier IN ('primary', 'trusted', 'public')),
  source_type TEXT NOT NULL DEFAULT 'public_web',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_scrapling BOOLEAN NOT NULL DEFAULT FALSE,
  robots_policy TEXT NOT NULL DEFAULT 'honor_required' CHECK (robots_policy IN ('honor_required', 'manual_only', 'not_applicable')),
  terms_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (terms_status IN ('approved', 'pending_review', 'restricted', 'prohibited')),
  rate_limit_per_day INTEGER NOT NULL DEFAULT 25 CHECK (rate_limit_per_day >= 0 AND rate_limit_per_day <= 1000),
  review_required BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'blocked', 'failed', 'duplicate')),
  strategy_lane TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('crm_research', 'content_research', 'market_research', 'outreach_qualification')),
  extraction_template TEXT NOT NULL CHECK (extraction_template IN ('company_profile', 'lender_criteria', 'investor_criteria', 'business_presence', 'local_intelligence', 'seo_research')),
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL REFERENCES research_domain_policies(domain) ON UPDATE CASCADE ON DELETE RESTRICT,
  terms_policy TEXT NOT NULL DEFAULT 'approved' CHECK (terms_policy = 'approved'),
  requested_by TEXT,
  worker_request_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  callback_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_worker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_event_id TEXT NOT NULL UNIQUE,
  research_job_id UUID NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  signature_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'duplicate', 'blocked', 'failed')),
  error_message TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS research_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_job_id UUID NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  worker_event_id TEXT NOT NULL REFERENCES research_worker_events(worker_event_id) ON DELETE RESTRICT,
  source_url TEXT NOT NULL,
  source_domain TEXT NOT NULL REFERENCES research_domain_policies(domain) ON UPDATE CASCADE ON DELETE RESTRICT,
  retrieved_at TIMESTAMPTZ NOT NULL,
  robots_decision TEXT NOT NULL CHECK (robots_decision IN ('robots_allowed', 'robots_not_found_allowed')),
  terms_policy TEXT NOT NULL CHECK (terms_policy = 'approved'),
  extraction_method TEXT NOT NULL,
  title TEXT,
  headings JSONB NOT NULL DEFAULT '[]'::jsonb,
  text_excerpt TEXT NOT NULL CHECK (char_length(text_excerpt) <= 20000),
  content_risk_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_summary TEXT NOT NULL,
  evidence_hash TEXT NOT NULL UNIQUE,
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'reviewed', 'approved', 'rejected')),
  eligible_for_crm BOOLEAN NOT NULL DEFAULT FALSE,
  eligible_for_content BOOLEAN NOT NULL DEFAULT FALSE,
  eligible_for_outreach_qualification BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(research_job_id)
);

CREATE INDEX IF NOT EXISTS idx_research_jobs_status_requested
  ON research_jobs(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_jobs_domain_status
  ON research_jobs(source_domain, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_worker_events_job_received
  ON research_worker_events(research_job_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_evidence_domain_retrieved
  ON research_evidence(source_domain, retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_evidence_review_status
  ON research_evidence(review_status, created_at DESC);

ALTER TABLE research_domain_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_worker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage research domain policies" ON research_domain_policies;
CREATE POLICY "Admins can manage research domain policies"
  ON research_domain_policies FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can manage research jobs" ON research_jobs;
CREATE POLICY "Admins can manage research jobs"
  ON research_jobs FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can manage research worker events" ON research_worker_events;
CREATE POLICY "Admins can manage research worker events"
  ON research_worker_events FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can manage research evidence" ON research_evidence;
CREATE POLICY "Admins can manage research evidence"
  ON research_evidence FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON research_domain_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_worker_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_evidence TO authenticated;

GRANT ALL ON research_domain_policies TO service_role;
GRANT ALL ON research_jobs TO service_role;
GRANT ALL ON research_worker_events TO service_role;
GRANT ALL ON research_evidence TO service_role;
