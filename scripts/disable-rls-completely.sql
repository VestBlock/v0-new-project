-- Disable RLS completely for easier setup
-- This removes all security restrictions for development

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Disable RLS on tables
ALTER TABLE analysis_jobs DISABLE ROW LEVEL SECURITY;

-- Create or update the credit-reports storage bucket
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
  allowed_mime_types = ARRAY['application/pdf']::text[],
  public = false;

-- Create simple storage policies that allow all authenticated users to upload to credit-reports bucket
CREATE POLICY "Allow authenticated uploads to credit-reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'credit-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated reads from credit-reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'credit-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated deletes from credit-reports"
ON storage.objects FOR DELETE
USING (bucket_id = 'credit-reports' AND auth.role() = 'authenticated');

-- Ensure analysis_jobs table exists with basic structure
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_name TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);

-- Verify the credit-reports bucket exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'credit-reports') THEN
    RAISE NOTICE 'Creating credit-reports bucket...';
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'credit-reports',
      'credit-reports',
      false,
      26214400,
      ARRAY['application/pdf']::text[]
    );
  ELSE
    RAISE NOTICE 'credit-reports bucket already exists';
  END IF;
END $$;
