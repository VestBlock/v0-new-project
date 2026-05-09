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
