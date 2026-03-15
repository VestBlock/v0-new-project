-- Enable pgcrypto extension if not already enabled (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- Create the 'analysis_results' table
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  summary TEXT,
  detailed_analysis_json JSONB,
  credit_card_recommendations_json JSONB,
  side_hustle_recommendations_json JSONB,
  letter_content_text TEXT,
  raw_ai_response_json JSONB, -- For debugging or advanced use
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments to describe the table and columns
COMMENT ON TABLE public.analysis_results IS 'Stores the detailed results of completed credit analysis jobs.';
COMMENT ON COLUMN public.analysis_results.id IS 'Unique identifier for the analysis result.';
COMMENT ON COLUMN public.analysis_results.job_id IS 'Foreign key referencing the analysis_jobs table.';
COMMENT ON COLUMN public.analysis_results.summary IS 'AI-generated summary of the analysis.';
COMMENT ON COLUMN public.analysis_results.detailed_analysis_json IS 'JSON object containing the full structured analysis from the AI.';
COMMENT ON COLUMN public.analysis_results.credit_card_recommendations_json IS 'JSON array of credit card recommendations.';
COMMENT ON COLUMN public.analysis_results.side_hustle_recommendations_json IS 'JSON array of side hustle recommendations.';
COMMENT ON COLUMN public.analysis_results.letter_content_text IS 'Generated content for dispute letters, if applicable.';
COMMENT ON COLUMN public.analysis_results.raw_ai_response_json IS 'The raw JSON response from the AI model, for debugging or logging.';

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_analysis_results_job_id ON public.analysis_results(job_id);

-- You will need to add RLS policies separately based on your app's logic.
-- Example:
-- CREATE POLICY "Users can select results for their own analysis jobs"
-- ON public.analysis_results FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.analysis_jobs aj
--     WHERE aj.id = job_id AND aj.user_id = auth.uid()
--   )
-- );
