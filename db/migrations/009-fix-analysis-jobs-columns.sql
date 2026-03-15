-- Fix analysis_jobs table to remove file_size_bytes column reference
-- and ensure all necessary columns exist

-- Add any missing columns that might be needed
ALTER TABLE analysis_jobs 
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_analysis_completed_at TIMESTAMP WITH TIME ZONE;

-- Update any existing records that might have null status
UPDATE analysis_jobs 
SET status = 'pending' 
WHERE status IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_status ON analysis_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);
