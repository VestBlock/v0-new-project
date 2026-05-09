ALTER TABLE public.content_assets
  ADD COLUMN IF NOT EXISTS indexed_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS priority_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refresh_suggested_at TIMESTAMPTZ;

ALTER TABLE public.content_assets
  DROP CONSTRAINT IF EXISTS content_assets_indexed_status_check;

ALTER TABLE public.content_assets
  ADD CONSTRAINT content_assets_indexed_status_check
  CHECK (indexed_status IN ('unknown', 'submitted', 'indexed', 'not_indexed', 'refresh_needed'));

ALTER TABLE public.service_deliverables
  ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_response_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS customer_upgraded_at TIMESTAMPTZ;

ALTER TABLE public.service_deliverables
  DROP CONSTRAINT IF EXISTS service_deliverables_customer_response_status_check;

ALTER TABLE public.service_deliverables
  ADD CONSTRAINT service_deliverables_customer_response_status_check
  CHECK (customer_response_status IN ('unknown', 'viewed', 'responded', 'upgraded', 'no_response'));

CREATE TABLE IF NOT EXISTS public.improvement_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN (
    'daily_review',
    'research_digest',
    'outreach_optimization',
    'market_optimization',
    'content_optimization',
    'credit_funding_optimization'
  )),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  window_started_at TIMESTAMPTZ,
  window_ended_at TIMESTAMPTZ,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_applied_count INTEGER NOT NULL DEFAULT 0,
  queued_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.improvement_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.improvement_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'watch', 'action')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  supporting_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  auto_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'curated',
  source_url TEXT,
  source_title TEXT,
  brief_title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  created_by_run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.strategy_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  approval_status TEXT NOT NULL DEFAULT 'queued' CHECK (approval_status IN ('queued', 'approved', 'rejected', 'auto_applied')),
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  proposed_change_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_change_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_admin_review BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  experiment_key TEXT NOT NULL,
  category TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  baseline_key TEXT,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface TEXT NOT NULL,
  segment_key TEXT NOT NULL,
  version_label TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by_run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.score_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'city_state', 'niche', 'category', 'best_offer', 'language_segment')),
  scope_key TEXT NOT NULL,
  score_delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'archived')),
  source_run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outreach_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_type TEXT NOT NULL CHECK (segment_type IN ('city_state', 'niche', 'best_offer', 'language', 'category')),
  segment_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'facebook_dm', 'instagram_dm', 'phone_script')),
  language TEXT NOT NULL DEFAULT 'en',
  opener TEXT,
  body_guidance TEXT,
  cta TEXT,
  performance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'active', 'archived')),
  source_run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.market_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  target_market_id UUID REFERENCES public.target_markets(id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  niche TEXT,
  leads_found INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  booked_count INTEGER NOT NULL DEFAULT 0,
  bounce_count INTEGER NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.method_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  method_type TEXT NOT NULL,
  method_key TEXT NOT NULL,
  assigned_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  stalled_count INTEGER NOT NULL DEFAULT 0,
  response_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_operator_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.improvement_runs(id) ON DELETE SET NULL,
  report_date DATE NOT NULL UNIQUE,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_digest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_improvement_runs_type_created_at ON public.improvement_runs(run_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_improvement_insights_run_category ON public.improvement_insights(run_id, category, severity);
CREATE INDEX IF NOT EXISTS idx_research_briefs_theme_status ON public.research_briefs(theme, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_updates_status_risk ON public.strategy_updates(approval_status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_results_category_key ON public.experiment_results(category, experiment_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_surface_segment ON public.prompt_versions(surface, segment_key, status);
CREATE INDEX IF NOT EXISTS idx_score_adjustments_scope_status ON public.score_adjustments(scope_type, scope_key, status);
CREATE INDEX IF NOT EXISTS idx_outreach_variants_segment_status ON public.outreach_variants(segment_type, segment_key, channel, status);
CREATE INDEX IF NOT EXISTS idx_market_performance_snapshots_date ON public.market_performance_snapshots(snapshot_date DESC, city, state);
CREATE INDEX IF NOT EXISTS idx_method_performance_snapshots_date ON public.method_performance_snapshots(snapshot_date DESC, method_type, method_key);
CREATE INDEX IF NOT EXISTS idx_daily_operator_reports_date ON public.daily_operator_reports(report_date DESC);

DROP TRIGGER IF EXISTS on_improvement_runs_updated ON public.improvement_runs;
CREATE TRIGGER on_improvement_runs_updated
  BEFORE UPDATE ON public.improvement_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_improvement_insights_updated ON public.improvement_insights;
CREATE TRIGGER on_improvement_insights_updated
  BEFORE UPDATE ON public.improvement_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_research_briefs_updated ON public.research_briefs;
CREATE TRIGGER on_research_briefs_updated
  BEFORE UPDATE ON public.research_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_strategy_updates_updated ON public.strategy_updates;
CREATE TRIGGER on_strategy_updates_updated
  BEFORE UPDATE ON public.strategy_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_experiment_results_updated ON public.experiment_results;
CREATE TRIGGER on_experiment_results_updated
  BEFORE UPDATE ON public.experiment_results
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_prompt_versions_updated ON public.prompt_versions;
CREATE TRIGGER on_prompt_versions_updated
  BEFORE UPDATE ON public.prompt_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_score_adjustments_updated ON public.score_adjustments;
CREATE TRIGGER on_score_adjustments_updated
  BEFORE UPDATE ON public.score_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_outreach_variants_updated ON public.outreach_variants;
CREATE TRIGGER on_outreach_variants_updated
  BEFORE UPDATE ON public.outreach_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_market_performance_snapshots_updated ON public.market_performance_snapshots;
CREATE TRIGGER on_market_performance_snapshots_updated
  BEFORE UPDATE ON public.market_performance_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_method_performance_snapshots_updated ON public.method_performance_snapshots;
CREATE TRIGGER on_method_performance_snapshots_updated
  BEFORE UPDATE ON public.method_performance_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_daily_operator_reports_updated ON public.daily_operator_reports;
CREATE TRIGGER on_daily_operator_reports_updated
  BEFORE UPDATE ON public.daily_operator_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.improvement_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_operator_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'improvement_runs',
    'improvement_insights',
    'research_briefs',
    'strategy_updates',
    'experiment_results',
    'prompt_versions',
    'score_adjustments',
    'outreach_variants',
    'market_performance_snapshots',
    'method_performance_snapshots',
    'daily_operator_reports'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT TO authenticated USING (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE TO authenticated USING (private.vestblock_is_admin()) WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.improvement_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.improvement_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.research_briefs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.strategy_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.experiment_results TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prompt_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.score_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outreach_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_performance_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_performance_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_operator_reports TO authenticated;

GRANT ALL ON public.improvement_runs TO service_role;
GRANT ALL ON public.improvement_insights TO service_role;
GRANT ALL ON public.research_briefs TO service_role;
GRANT ALL ON public.strategy_updates TO service_role;
GRANT ALL ON public.experiment_results TO service_role;
GRANT ALL ON public.prompt_versions TO service_role;
GRANT ALL ON public.score_adjustments TO service_role;
GRANT ALL ON public.outreach_variants TO service_role;
GRANT ALL ON public.market_performance_snapshots TO service_role;
GRANT ALL ON public.method_performance_snapshots TO service_role;
GRANT ALL ON public.daily_operator_reports TO service_role;
