CREATE TABLE IF NOT EXISTS daily_growth_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  leads_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  lenders_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  buyers_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  users_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_niches JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_offers JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_growth_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_growth_reports(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, section_key)
);

CREATE TABLE IF NOT EXISTS entity_seo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('daily_scan', 'manual_publish', 'manual_refresh', 'performance_snapshot')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial')),
  result_count INTEGER NOT NULL DEFAULT 0,
  auto_published_count INTEGER NOT NULL DEFAULT 0,
  request_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_seo_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead_segment', 'lender_segment', 'buyer_segment', 'city', 'niche', 'service')),
  entity_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  cluster_type TEXT NOT NULL,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  suggested_title TEXT NOT NULL,
  suggested_slug TEXT NOT NULL,
  suggested_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  suggested_service_focus TEXT,
  source_reason TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'suggested' CHECK (approval_status IN ('draft', 'suggested', 'ready', 'needs_review', 'approved', 'published', 'rejected')),
  publish_status TEXT NOT NULL DEFAULT 'not_started' CHECK (publish_status IN ('not_started', 'queued', 'published', 'failed', 'skipped')),
  content_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  created_by_run_id UUID REFERENCES entity_seo_runs(id) ON DELETE SET NULL,
  source_signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_seo_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES entity_seo_opportunities(id) ON DELETE CASCADE,
  content_asset_id UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  indexed_status TEXT,
  publish_status TEXT,
  performance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_growth_reports_report_date ON daily_growth_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_growth_report_sections_report_id ON daily_growth_report_sections(report_id, section_key);
CREATE INDEX IF NOT EXISTS idx_entity_seo_runs_status ON entity_seo_runs(status, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_seo_opportunities_slug_unique ON entity_seo_opportunities(suggested_slug);
CREATE INDEX IF NOT EXISTS idx_entity_seo_opportunities_city_state ON entity_seo_opportunities(city, state);
CREATE INDEX IF NOT EXISTS idx_entity_seo_opportunities_entity_type ON entity_seo_opportunities(entity_type, cluster_type);
CREATE INDEX IF NOT EXISTS idx_entity_seo_opportunities_approval_status ON entity_seo_opportunities(approval_status, publish_status);
CREATE INDEX IF NOT EXISTS idx_entity_seo_performance_snapshots_opportunity ON entity_seo_performance_snapshots(opportunity_id, snapshot_date DESC);

CREATE TRIGGER daily_growth_reports_touch_updated_at
  BEFORE UPDATE ON daily_growth_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER daily_growth_report_sections_touch_updated_at
  BEFORE UPDATE ON daily_growth_report_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER entity_seo_opportunities_touch_updated_at
  BEFORE UPDATE ON entity_seo_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE daily_growth_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_growth_report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_seo_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_seo_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_seo_performance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'daily_growth_reports',
      'daily_growth_report_sections',
      'entity_seo_runs',
      'entity_seo_opportunities',
      'entity_seo_performance_snapshots'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT USING (private.vestblock_is_admin())',
      tbl,
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT WITH CHECK (private.vestblock_is_admin())',
      tbl,
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE USING (private.vestblock_is_admin()) WITH CHECK (private.vestblock_is_admin())',
      tbl,
      tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON daily_growth_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON daily_growth_report_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON entity_seo_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON entity_seo_opportunities TO authenticated;
GRANT SELECT, INSERT, UPDATE ON entity_seo_performance_snapshots TO authenticated;

GRANT ALL ON daily_growth_reports TO service_role;
GRANT ALL ON daily_growth_report_sections TO service_role;
GRANT ALL ON entity_seo_runs TO service_role;
GRANT ALL ON entity_seo_opportunities TO service_role;
GRANT ALL ON entity_seo_performance_snapshots TO service_role;
