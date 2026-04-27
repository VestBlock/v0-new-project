-- VestBlock business credit card funding strategy workflow.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS paypal_order_product TEXT;

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL,
  paypal_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'vestblock_pro',
  ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_paypal_transaction_id_idx
  ON payments(paypal_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_product_type ON payments(product_type);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;
CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT ON payments TO authenticated;
GRANT ALL ON payments TO service_role;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lead_type TEXT NOT NULL CHECK (lead_type IN (
    'sell_house',
    'real_estate',
    'ai_assistant',
    'business_funding',
    'credit_card_funding_strategy'
  )),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  contact_info JSONB NOT NULL DEFAULT '{}',
  form_data JSONB NOT NULL DEFAULT '{}',
  name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
CREATE POLICY "Admins can view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update leads" ON leads;
CREATE POLICY "Admins can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, UPDATE ON leads TO authenticated;
GRANT ALL ON leads TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'lead_type'
  ) THEN
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;
    ALTER TABLE leads
      ADD CONSTRAINT leads_lead_type_check
      CHECK (lead_type IN (
        'sell_house',
        'real_estate',
        'ai_assistant',
        'business_funding',
        'credit_card_funding_strategy'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS funding_strategy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  full_name TEXT,
  phone TEXT,
  business_name TEXT,
  business_stage TEXT NOT NULL,
  business_age_months INTEGER DEFAULT 0,
  monthly_revenue NUMERIC DEFAULT 0,
  personal_credit_score TEXT NOT NULL,
  current_utilization TEXT NOT NULL,
  recent_inquiries TEXT NOT NULL,
  has_ein BOOLEAN DEFAULT FALSE,
  has_business_bank BOOLEAN DEFAULT FALSE,
  has_business_credit_card BOOLEAN DEFAULT FALSE,
  requested_funding_amount NUMERIC DEFAULT 0,
  use_of_funds TEXT,
  readiness_score INTEGER DEFAULT 0,
  readiness_tier TEXT NOT NULL DEFAULT 'needs_prep'
    CHECK (readiness_tier IN ('needs_prep', 'review_ready', 'strong_candidate')),
  readiness_summary TEXT,
  strengths_json JSONB DEFAULT '[]',
  risks_json JSONB DEFAULT '[]',
  next_steps_json JSONB DEFAULT '[]',
  consent_hard_inquiries BOOLEAN DEFAULT FALSE,
  consent_no_guarantee BOOLEAN DEFAULT FALSE,
  consent_terms_review BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN (
      'submitted',
      'awaiting_payment',
      'paid',
      'in_review',
      'strategy_ready',
      'needs_prep',
      'closed'
    )),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  paypal_order_id TEXT,
  payment_id UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_funding_strategy_user_id
  ON funding_strategy_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_funding_strategy_status
  ON funding_strategy_requests(status);
CREATE INDEX IF NOT EXISTS idx_funding_strategy_payment_status
  ON funding_strategy_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_funding_strategy_created_at
  ON funding_strategy_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_strategy_paypal_order
  ON funding_strategy_requests(paypal_order_id);

ALTER TABLE funding_strategy_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own funding strategy requests"
  ON funding_strategy_requests;
CREATE POLICY "Users can view their own funding strategy requests"
  ON funding_strategy_requests FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding strategy requests"
  ON funding_strategy_requests;
CREATE POLICY "Users can insert their own funding strategy requests"
  ON funding_strategy_requests FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all funding strategy requests"
  ON funding_strategy_requests;
CREATE POLICY "Admins can view all funding strategy requests"
  ON funding_strategy_requests FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update funding strategy requests"
  ON funding_strategy_requests;
CREATE POLICY "Admins can update funding strategy requests"
  ON funding_strategy_requests FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT ON funding_strategy_requests TO authenticated;
GRANT SELECT, UPDATE ON funding_strategy_requests TO authenticated;
GRANT ALL ON funding_strategy_requests TO service_role;
