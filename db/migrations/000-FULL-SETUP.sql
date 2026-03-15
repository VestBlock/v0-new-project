-- ============================================
-- VESTBLOCK - COMPLETE DATABASE SETUP
-- Run this ONCE on a new Supabase project
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. USER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    full_name TEXT,
    email TEXT UNIQUE,
    credit_score INTEGER,
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    phone_number TEXT,
    financial_goal JSONB,
    is_subscribed BOOLEAN DEFAULT false,
    role TEXT DEFAULT 'user',
    paypal_order_id TEXT,
    CONSTRAINT check_credit_score CHECK (credit_score IS NULL OR (credit_score >= 300 AND credit_score <= 850))
);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_profiles_updated
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- RLS for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. CREDIT REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  analysis_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_reports_user_id_idx ON credit_reports(user_id);
CREATE INDEX IF NOT EXISTS credit_reports_created_at_idx ON credit_reports(created_at);

ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports"
  ON credit_reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
  ON credit_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON credit_reports FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
  ON credit_reports FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. ANALYSIS JOBS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_file_name TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at);

ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own analysis jobs"
ON analysis_jobs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. ANALYSIS RESULTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  summary TEXT,
  detailed_analysis_json JSONB,
  credit_card_recommendations_json JSONB,
  side_hustle_recommendations_json JSONB,
  letter_content_text TEXT,
  raw_ai_response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_job_id ON public.analysis_results(job_id);

ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their analysis results"
ON public.analysis_results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.analysis_jobs aj
    WHERE aj.id = job_id AND aj.user_id = auth.uid()
  )
);

-- ============================================
-- 5. DISPUTE LETTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dispute_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    letter_type TEXT NOT NULL,
    creditor_name TEXT,
    account_number TEXT,
    letter_content TEXT NOT NULL,
    bureau TEXT,
    pdf_path TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_letters ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER on_dispute_letters_updated
BEFORE UPDATE ON public.dispute_letters
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE POLICY "Users can view their own dispute letters"
ON public.dispute_letters FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dispute letters"
ON public.dispute_letters FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dispute letters"
ON public.dispute_letters FOR UPDATE
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dispute letters"
ON public.dispute_letters FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL,
  report_id UUID REFERENCES credit_reports(id) ON DELETE SET NULL,
  paypal_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_paypal_transaction_id_idx ON payments(paypal_transaction_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. GRANT RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS grant_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT,
  grant_content TEXT,
  pdf_path TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grant_runs_user_id_idx ON grant_runs(user_id);

ALTER TABLE grant_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own grant runs"
ON grant_runs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 8. BUSINESS ROADMAPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS business_roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT,
  roadmap_content TEXT,
  pdf_path TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS business_roadmaps_user_id_idx ON business_roadmaps(user_id);

ALTER TABLE business_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own business roadmaps"
ON business_roadmaps FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. REAL ESTATE LEADS TABLE (for /sell page)
-- ============================================
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'new',
  notes TEXT,
  assigned_to TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_estate_leads_created_at ON real_estate_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_real_estate_leads_status ON real_estate_leads(status);

ALTER TABLE real_estate_leads ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for API)
CREATE POLICY "Service role can manage real_estate_leads"
ON real_estate_leads FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- 10. STORAGE BUCKETS
-- ============================================

-- Credit Reports Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-reports',
  'credit-reports',
  false,
  26214400,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Dispute Letters Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'dispute-letters',
  'dispute-letters',
  false,
  10485760
)
ON CONFLICT (id) DO NOTHING;

-- Grant Letters Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'grant-letters',
  'grant-letters',
  false,
  10485760
)
ON CONFLICT (id) DO NOTHING;

-- Business Roadmaps Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'biz-roadmaps',
  'biz-roadmaps',
  false,
  10485760
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 11. STORAGE POLICIES
-- ============================================

-- Credit Reports Storage Policies
CREATE POLICY "Users can upload to their folder in credit-reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their files in credit-reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can delete their files in credit-reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'credit-reports' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Dispute Letters Storage Policies
CREATE POLICY "Users can upload to dispute-letters"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dispute-letters' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their dispute-letters"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dispute-letters' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Grant Letters Storage Policies
CREATE POLICY "Users can upload to grant-letters"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'grant-letters' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their grant-letters"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'grant-letters' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- Biz Roadmaps Storage Policies
CREATE POLICY "Users can upload to biz-roadmaps"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'biz-roadmaps' AND
  auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can view their biz-roadmaps"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'biz-roadmaps' AND
  auth.uid()::text = split_part(name, '/', 1)
);

-- ============================================
-- SETUP COMPLETE!
-- ============================================
