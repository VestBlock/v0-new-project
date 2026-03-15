-- Enable Row Level Security on analysis_jobs table
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can view their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can update their own analysis jobs" ON analysis_jobs;
DROP POLICY IF EXISTS "Users can delete their own analysis jobs" ON analysis_jobs;

-- Policy: Users can insert their own analysis jobs
CREATE POLICY "Users can insert their own analysis jobs" ON analysis_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own analysis jobs
CREATE POLICY "Users can view their own analysis jobs" ON analysis_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own analysis jobs
CREATE POLICY "Users can update their own analysis jobs" ON analysis_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own analysis jobs
CREATE POLICY "Users can delete their own analysis jobs" ON analysis_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for credit reports if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-reports', 'credit-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Storage policy: Users can upload to their own folder
CREATE POLICY "Users can upload to their own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'credit-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can view their own files
CREATE POLICY "Users can view their own files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'credit-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can update their own files
CREATE POLICY "Users can update their own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'credit-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policy: Users can delete their own files
CREATE POLICY "Users can delete their own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'credit-reports' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);
