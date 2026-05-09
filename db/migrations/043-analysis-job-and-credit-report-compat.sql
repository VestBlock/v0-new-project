ALTER TABLE public.credit_reports
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE public.credit_reports
SET created_at = COALESCE(created_at, uploaded_at, updated_at, NOW())
WHERE created_at IS NULL;

ALTER TABLE public.credit_reports
  ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_credit_reports_created_at
  ON public.credit_reports(created_at DESC);

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS financial_goal_title TEXT,
  ADD COLUMN IF NOT EXISTS financial_goal_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS original_file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS is_likely_credit_report BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_detailed_analysis JSONB,
  ADD COLUMN IF NOT EXISTS ai_credit_card_recommendations JSONB,
  ADD COLUMN IF NOT EXISTS ai_side_hustle_recommendations JSONB,
  ADD COLUMN IF NOT EXISTS ai_roadmap_data JSONB,
  ADD COLUMN IF NOT EXISTS text_extraction_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_analysis_completed_at TIMESTAMPTZ;

UPDATE public.analysis_jobs
SET
  financial_goal_title = COALESCE(financial_goal_title, financial_goal_json->>'title'),
  financial_goal_details = CASE
    WHEN financial_goal_details = '{}'::jsonb AND financial_goal_json IS NOT NULL THEN financial_goal_json
    ELSE financial_goal_details
  END,
  uploaded_at = COALESCE(uploaded_at, created_at),
  error_message = COALESCE(error_message, error_details_json->>'message')
WHERE
  financial_goal_title IS NULL
  OR financial_goal_details = '{}'::jsonb
  OR uploaded_at IS NULL
  OR error_message IS NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_uploaded_at
  ON public.analysis_jobs(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_updated_at
  ON public.analysis_jobs(status, updated_at DESC);
