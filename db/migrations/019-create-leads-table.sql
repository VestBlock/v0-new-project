-- Create leads table for unified lead management
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Lead classification
  lead_type TEXT NOT NULL CHECK (lead_type IN ('sell_house', 'real_estate', 'ai_assistant')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),

  -- Contact information (stored as JSON for flexibility)
  contact_info JSONB NOT NULL DEFAULT '{}',
  -- Expected structure: { name, email, phone }

  -- Full form data (stored as JSON)
  form_data JSONB NOT NULL DEFAULT '{}',

  -- Denormalized fields for easy querying/filtering
  name TEXT,
  email TEXT,
  phone TEXT,

  -- Notes for internal use
  notes TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can access leads
-- Note: You may need to adjust this based on your admin role setup
CREATE POLICY "Admins can view all leads" ON leads
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'contact@vestblock.io'
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert leads" ON leads
  FOR INSERT
  WITH CHECK (true);  -- Allow API to insert

CREATE POLICY "Admins can update leads" ON leads
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = 'contact@vestblock.io'
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- Grant necessary permissions
GRANT ALL ON leads TO authenticated;
GRANT ALL ON leads TO service_role;
