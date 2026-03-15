-- Enable pgcrypto extension if not already enabled (for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- Create a function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the 'analysis_jobs' table
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Assuming you use Supabase Auth
  financial_goal_json JSONB,
  file_path TEXT, -- URL or path to the file in Vercel Blob or Supabase Storage
  original_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- e.g., PENDING, PROCESSING, COMPLETED, FAILED, FILE_ERROR, AI_ERROR
  progress_percentage INTEGER DEFAULT 0,
  error_details_json JSONB,
  result_id UUID UNIQUE, -- Will be a foreign key to analysis_results.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments to describe the table and columns
COMMENT ON TABLE public.analysis_jobs IS 'Stores information about credit analysis jobs, their status, and associated data.';
COMMENT ON COLUMN public.analysis_jobs.id IS 'Unique identifier for the analysis job.';
COMMENT ON COLUMN public.analysis_jobs.user_id IS 'Identifier of the user who initiated the job (if authenticated).';
COMMENT ON COLUMN public.analysis_jobs.financial_goal_json IS 'JSON object representing the user''s selected financial goal.';
COMMENT ON COLUMN public.analysis_jobs.file_path IS 'Path or URL to the uploaded credit report file.';
COMMENT ON COLUMN public.analysis_jobs.original_file_name IS 'Original name of the uploaded file.';
COMMENT ON COLUMN public.analysis_jobs.status IS 'Current status of the analysis job.';
COMMENT ON COLUMN public.analysis_jobs.progress_percentage IS 'Optional progress indicator (0-100).';
COMMENT ON COLUMN public.analysis_jobs.error_details_json IS 'JSON object containing error information if the job failed.';
COMMENT ON COLUMN public.analysis_jobs.result_id IS 'Identifier of the corresponding record in analysis_results upon completion.';

-- Create a trigger to automatically update 'updated_at' on row modification
CREATE TRIGGER on_analysis_jobs_updated
  BEFORE UPDATE ON public.analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS) for the table
-- You'll need to define policies based on your application's access control needs.
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON public.analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON public.analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_result_id ON public.analysis_jobs(result_id);

-- You will need to add RLS policies separately based on your app's logic.
-- Example:
-- CREATE POLICY "Users can select their own analysis jobs"
-- ON public.analysis_jobs FOR SELECT
-- USING (auth.uid() = user_id);
