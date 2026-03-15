-- Create credit_reports table for storing user credit reports
CREATE TABLE IF NOT EXISTS credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries by user_id
CREATE INDEX IF NOT EXISTS credit_reports_user_id_idx ON credit_reports(user_id);

-- Add index for faster queries by creation date
CREATE INDEX IF NOT EXISTS credit_reports_created_at_idx ON credit_reports(created_at);

-- Add RLS policies
ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own reports
CREATE POLICY "Users can view their own reports"
  ON credit_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own reports
CREATE POLICY "Users can insert their own reports"
  ON credit_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own reports
CREATE POLICY "Users can update their own reports"
  ON credit_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for users to delete their own reports
CREATE POLICY "Users can delete their own reports"
  ON credit_reports
  FOR DELETE
  USING (auth.uid() = user_id);
