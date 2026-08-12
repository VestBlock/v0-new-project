-- Reconcile application tables that were referenced by production code but
-- never applied to the live project, and close legacy Data API exposure.

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_code TEXT UNIQUE NOT NULL CHECK (char_length(affiliate_code) BETWEEN 6 AND 20),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  website_url TEXT,
  paypal_email TEXT,
  commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1000,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10, 2) NOT NULL,
  payout_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method_used TEXT,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reverted')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  conversion_type TEXT NOT NULL DEFAULT 'signup',
  conversion_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT,
  commission_amount NUMERIC(10, 2),
  commission_status TEXT NOT NULL DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid', 'rejected', 'voided')),
  payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.real_estate_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  property_condition TEXT,
  timeline_to_sell TEXT,
  mortgage_balance TEXT,
  reason_for_selling TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.aeo_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL,
  site_url TEXT NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  score_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  critical_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  route_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  robots_audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  sitemap_audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_audits JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_improvement_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_report_id UUID NOT NULL REFERENCES public.credit_reports(id) ON DELETE CASCADE,
  roadmap_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (credit_report_id)
);

CREATE TABLE IF NOT EXISTS public.extracted_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  text_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON public.referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_commission_status ON public.referrals(commission_status);
CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON public.payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_leads_created_at ON public.real_estate_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_estate_leads_status ON public.real_estate_leads(status);
CREATE INDEX IF NOT EXISTS idx_aeo_audit_reports_run_at ON public.aeo_audit_reports(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_improvement_roadmaps_user ON public.credit_improvement_roadmaps(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_texts_user ON public.extracted_texts(user_id, created_at DESC);

DROP TRIGGER IF EXISTS affiliates_touch_updated_at ON public.affiliates;
CREATE TRIGGER affiliates_touch_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS real_estate_leads_touch_updated_at ON public.real_estate_leads;
CREATE TRIGGER real_estate_leads_touch_updated_at
  BEFORE UPDATE ON public.real_estate_leads
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS credit_improvement_roadmaps_touch_updated_at ON public.credit_improvement_roadmaps;
CREATE TRIGGER credit_improvement_roadmaps_touch_updated_at
  BEFORE UPDATE ON public.credit_improvement_roadmaps
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS extracted_texts_touch_updated_at ON public.extracted_texts;
CREATE TRIGGER extracted_texts_touch_updated_at
  BEFORE UPDATE ON public.extracted_texts
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aeo_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_improvement_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_texts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliates_select_own_or_admin ON public.affiliates;
CREATE POLICY affiliates_select_own_or_admin ON public.affiliates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS affiliates_insert_own ON public.affiliates;
CREATE POLICY affiliates_insert_own ON public.affiliates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS affiliates_admin_manage ON public.affiliates;
CREATE POLICY affiliates_admin_manage ON public.affiliates
  FOR ALL TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS referrals_select_own_or_admin ON public.referrals;
CREATE POLICY referrals_select_own_or_admin ON public.referrals
  FOR SELECT TO authenticated
  USING (
    private.vestblock_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.affiliates
      WHERE affiliates.id = referrals.affiliate_id
        AND affiliates.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS referrals_admin_manage ON public.referrals;
CREATE POLICY referrals_admin_manage ON public.referrals
  FOR ALL TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS payouts_select_own_or_admin ON public.payouts;
CREATE POLICY payouts_select_own_or_admin ON public.payouts
  FOR SELECT TO authenticated
  USING (
    private.vestblock_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.affiliates
      WHERE affiliates.id = payouts.affiliate_id
        AND affiliates.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payouts_admin_manage ON public.payouts;
CREATE POLICY payouts_admin_manage ON public.payouts
  FOR ALL TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS real_estate_leads_admin_manage ON public.real_estate_leads;
CREATE POLICY real_estate_leads_admin_manage ON public.real_estate_leads
  FOR ALL TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS aeo_audit_reports_admin_select ON public.aeo_audit_reports;
CREATE POLICY aeo_audit_reports_admin_select ON public.aeo_audit_reports
  FOR SELECT TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS credit_improvement_roadmaps_select_own_or_admin ON public.credit_improvement_roadmaps;
CREATE POLICY credit_improvement_roadmaps_select_own_or_admin ON public.credit_improvement_roadmaps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS credit_improvement_roadmaps_admin_manage ON public.credit_improvement_roadmaps;
CREATE POLICY credit_improvement_roadmaps_admin_manage ON public.credit_improvement_roadmaps
  FOR ALL TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS extracted_texts_manage_own ON public.extracted_texts;
CREATE POLICY extracted_texts_manage_own ON public.extracted_texts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin())
  WITH CHECK (user_id = auth.uid() OR private.vestblock_is_admin());

REVOKE ALL ON public.affiliates, public.referrals, public.payouts,
  public.real_estate_leads, public.aeo_audit_reports,
  public.credit_improvement_roadmaps, public.extracted_texts FROM anon, authenticated;
GRANT SELECT, INSERT ON public.affiliates TO authenticated;
GRANT SELECT ON public.referrals, public.payouts, public.aeo_audit_reports TO authenticated;
GRANT SELECT, UPDATE ON public.real_estate_leads TO authenticated;
GRANT SELECT ON public.credit_improvement_roadmaps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extracted_texts TO authenticated;
GRANT ALL ON public.affiliates, public.referrals, public.payouts,
  public.real_estate_leads, public.aeo_audit_reports,
  public.credit_improvement_roadmaps, public.extracted_texts TO service_role;

-- Legacy tables were exposed to anon with RLS disabled. Preserve service
-- access while restricting user-facing reads to the row owner or an admin.
ALTER TABLE public.api_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_processing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_verification_logs, public.credit_scores,
  public.openai_connection_logs, public.openai_logs,
  public.openai_processing_queue, public.pdf_processing_logs,
  public.pdf_processing_metrics, public.report_analyses FROM anon, authenticated;

DROP POLICY IF EXISTS api_verification_logs_select_owner_admin ON public.api_verification_logs;
CREATE POLICY api_verification_logs_select_owner_admin ON public.api_verification_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS credit_scores_select_owner_admin ON public.credit_scores;
CREATE POLICY credit_scores_select_owner_admin ON public.credit_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS openai_connection_logs_select_admin ON public.openai_connection_logs;
CREATE POLICY openai_connection_logs_select_admin ON public.openai_connection_logs
  FOR SELECT TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS openai_logs_select_owner_admin ON public.openai_logs;
CREATE POLICY openai_logs_select_owner_admin ON public.openai_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS openai_processing_queue_select_owner_admin ON public.openai_processing_queue;
CREATE POLICY openai_processing_queue_select_owner_admin ON public.openai_processing_queue
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS pdf_processing_logs_select_owner_admin ON public.pdf_processing_logs;
CREATE POLICY pdf_processing_logs_select_owner_admin ON public.pdf_processing_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS pdf_processing_metrics_select_owner_admin ON public.pdf_processing_metrics;
CREATE POLICY pdf_processing_metrics_select_owner_admin ON public.pdf_processing_metrics
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

DROP POLICY IF EXISTS report_analyses_select_owner_admin ON public.report_analyses;
CREATE POLICY report_analyses_select_owner_admin ON public.report_analyses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.vestblock_is_admin());

GRANT SELECT ON public.api_verification_logs, public.credit_scores,
  public.openai_connection_logs, public.openai_logs,
  public.openai_processing_queue, public.pdf_processing_logs,
  public.pdf_processing_metrics, public.report_analyses TO authenticated;
GRANT ALL ON public.api_verification_logs, public.credit_scores,
  public.openai_connection_logs, public.openai_logs,
  public.openai_processing_queue, public.pdf_processing_logs,
  public.pdf_processing_metrics, public.report_analyses TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE(table_name TEXT)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, information_schema
AS $$
  SELECT tables.table_name::TEXT
  FROM information_schema.tables
  WHERE tables.table_schema = 'public'
    AND tables.table_type = 'BASE TABLE'
    AND has_table_privilege(
      current_user,
      format('%I.%I', tables.table_schema, tables.table_name),
      'SELECT'
    )
  ORDER BY tables.table_name;
$$;

REVOKE ALL ON FUNCTION public.get_public_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated;
