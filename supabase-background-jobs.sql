-- Create the background_jobs table
CREATE TABLE IF NOT EXISTS background_jobs (
  job_id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  text_content TEXT,
  progress INTEGER DEFAULT 0,
  message TEXT,
  result JSONB,
  error TEXT,
  processing_time BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add RLS policies
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own jobs
CREATE POLICY "Users can view their own jobs"
  ON background_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own jobs
CREATE POLICY "Users can insert their own jobs"
  ON background_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for service role to manage all jobs
CREATE POLICY "Service role can manage all jobs"
  ON background_jobs
  USING (auth.role() = 'service_role');

-- Create storage bucket for document processing
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-processing', 'document-processing', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Users can upload their own documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'document-processing' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'document-processing' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role can manage all documents"
  ON storage.objects
  USING (bucket_id = 'document-processing' AND auth.role() = 'service_role');
