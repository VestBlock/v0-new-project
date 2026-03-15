-- Create payments table for tracking user payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL,
  report_id UUID REFERENCES credit_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries by user_id
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);

-- Add index for faster queries by status
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);

-- Add RLS policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy for users to see only their own payments
CREATE POLICY "Users can view their own payments"
  ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own payments
CREATE POLICY "Users can insert their own payments"
  ON payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for service role to manage all payments
CREATE POLICY "Service role can manage all payments"
  ON payments
  FOR ALL
  USING (auth.role() = 'service_role');
