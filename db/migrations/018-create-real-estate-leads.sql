-- Migration: Create real_estate_leads table for house seller landing page
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the real_estate_leads table
CREATE TABLE IF NOT EXISTS real_estate_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  property_condition TEXT,
  timeline_to_sell TEXT,
  mortgage_balance TEXT,
  reason_for_selling TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_real_estate_leads_created_at ON real_estate_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_estate_leads_status ON real_estate_leads(status);

-- Enable Row Level Security (RLS)
ALTER TABLE real_estate_leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert/read/update
CREATE POLICY "Service role can manage real_estate_leads"
ON real_estate_leads
FOR ALL
USING (true)
WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_real_estate_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS real_estate_leads_updated_at ON real_estate_leads;
CREATE TRIGGER real_estate_leads_updated_at
  BEFORE UPDATE ON real_estate_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_real_estate_leads_updated_at();

-- Grant permissions
GRANT ALL ON real_estate_leads TO service_role;
GRANT SELECT, INSERT ON real_estate_leads TO anon;
GRANT SELECT, INSERT ON real_estate_leads TO authenticated;

-- Comment on table
COMMENT ON TABLE real_estate_leads IS 'Stores leads from the Sell Your House landing page at /sell';
