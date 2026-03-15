-- Create or update analysis_jobs table for credit upload system
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_name TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own analysis jobs"
ON analysis_jobs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);

-- Create storage bucket for credit reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-reports',
  'credit-reports',
  false,
  26214400, -- 25MB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Storage policies
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);
