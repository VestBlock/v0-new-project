-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can upload files to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can view their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can update their own analysis jobs" ON analysis_jobs;

-- Ensure the storage bucket exists
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

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policies for credit-reports bucket
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Ensure analysis_jobs table has RLS enabled
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Analysis jobs policies
CREATE POLICY "Users can insert their own analysis jobs"
ON analysis_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analysis jobs"
ON analysis_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own analysis jobs"
ON analysis_jobs FOR UPDATE
USING (auth.uid() = user_id);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add file_path column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_jobs' AND column_name = 'file_path') THEN
    ALTER TABLE analysis_jobs ADD COLUMN file_path TEXT;
  END IF;
  
  -- Add notes column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_jobs' AND column_name = 'notes') THEN
    ALTER TABLE analysis_jobs ADD COLUMN notes TEXT;
  END IF;
  
  -- Add uploaded_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analysis_jobs' AND column_name = 'uploaded_at') THEN
    ALTER TABLE analysis_jobs ADD COLUMN uploaded_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
