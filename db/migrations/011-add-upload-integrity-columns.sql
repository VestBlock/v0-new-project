-- Add columns for file upload integrity tracking
ALTER TABLE analysis_jobs 
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_checksum TEXT,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_file_checksum ON analysis_jobs(file_checksum);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_uploaded_at ON analysis_jobs(uploaded_at);

-- Update existing records to have proper status
UPDATE analysis_jobs 
SET status = 'pending_review' 
WHERE status = 'uploaded' AND uploaded_at IS NULL;
