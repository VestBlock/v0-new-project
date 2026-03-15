-- Fix analysis_jobs table schema to match the actual usage
-- Remove references to columns that don't exist and ensure proper structure

-- First, let's see what columns actually exist and add any missing ones
DO $$ 
BEGIN
    -- Add file_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analysis_jobs' AND column_name = 'file_type') THEN
        ALTER TABLE analysis_jobs ADD COLUMN file_type TEXT;
    END IF;
    
    -- Add file_size_bytes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analysis_jobs' AND column_name = 'file_size_bytes') THEN
        ALTER TABLE analysis_jobs ADD COLUMN file_size_bytes BIGINT;
    END IF;
    
    -- Add uploaded_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analysis_jobs' AND column_name = 'uploaded_at') THEN
        ALTER TABLE analysis_jobs ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add text_extraction_completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analysis_jobs' AND column_name = 'text_extraction_completed_at') THEN
        ALTER TABLE analysis_jobs ADD COLUMN text_extraction_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add ai_analysis_completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analysis_jobs' AND column_name = 'ai_analysis_completed_at') THEN
        ALTER TABLE analysis_jobs ADD COLUMN ai_analysis_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update any existing records that might have null status
UPDATE analysis_jobs 
SET status = 'pending' 
WHERE status IS NULL;

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_status ON analysis_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);

-- Add a comment to the table
COMMENT ON TABLE analysis_jobs IS 'Stores credit report analysis jobs and their processing status';
