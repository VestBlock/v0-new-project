-- VestBlock Funding Assistant
-- Adds funding profile, recommendation, sequence, payment-plan, and event tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.vestblock_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE (user_profiles.user_id = auth.uid() OR user_profiles.id = auth.uid())
      AND COALESCE(user_profiles.role, 'user') = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.vestblock_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.vestblock_is_admin() TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE IF NOT EXISTS funding_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('business', 'personal', 'hybrid')),
  funding_goal_amount NUMERIC,
  funding_goal_reason TEXT,
  fico_estimate INTEGER,
  income_range TEXT,
  monthly_debt_payments NUMERIC,
  credit_utilization NUMERIC,
  recent_inquiries_count INTEGER,
  new_accounts_24_months INTEGER,
  has_llc BOOLEAN DEFAULT FALSE,
  business_name TEXT,
  business_start_date DATE,
  business_revenue_range TEXT,
  business_industry TEXT,
  ein_available BOOLEAN DEFAULT FALSE,
  risk_level TEXT,
  readiness_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS funding_profiles_user_id_key
  ON funding_profiles(user_id);
CREATE INDEX IF NOT EXISTS funding_profiles_mode_idx
  ON funding_profiles(mode);
CREATE INDEX IF NOT EXISTS funding_profiles_readiness_idx
  ON funding_profiles(readiness_score DESC);

CREATE TABLE IF NOT EXISTS funding_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'business_card',
    'personal_card',
    'secured_card',
    'credit_builder',
    'personal_loan',
    'business_line',
    'real_estate_funding',
    'grant_or_program'
  )),
  issuer TEXT NOT NULL,
  product_name TEXT NOT NULL,
  application_url TEXT,
  affiliate_url TEXT,
  min_fico INTEGER,
  recommended_fico INTEGER,
  requires_business BOOLEAN DEFAULT FALSE,
  requires_ein BOOLEAN DEFAULT FALSE,
  reports_to_personal BOOLEAN,
  reports_to_business BOOLEAN,
  intro_apr_months INTEGER,
  annual_fee NUMERIC,
  estimated_limit_min NUMERIC,
  estimated_limit_max NUMERIC,
  bureau_notes TEXT,
  velocity_rules TEXT,
  risk_notes TEXT,
  truthful_application_notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funding_products_type_idx
  ON funding_products(type);
CREATE INDEX IF NOT EXISTS funding_products_active_idx
  ON funding_products(active);
CREATE INDEX IF NOT EXISTS funding_products_recommended_fico_idx
  ON funding_products(recommended_fico);

CREATE TABLE IF NOT EXISTS funding_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES funding_profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('business', 'personal', 'hybrid')),
  recommended_path TEXT NOT NULL CHECK (recommended_path IN (
    'apply_now',
    'build_first',
    'repair_first',
    'business_first',
    'personal_first',
    'hybrid_sequence'
  )),
  readiness_score INTEGER,
  estimated_funding_min NUMERIC,
  estimated_funding_max NUMERIC,
  strategy_summary TEXT,
  warnings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funding_recommendations_user_id_idx
  ON funding_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS funding_recommendations_profile_id_idx
  ON funding_recommendations(profile_id);
CREATE INDEX IF NOT EXISTS funding_recommendations_path_idx
  ON funding_recommendations(recommended_path);

CREATE TABLE IF NOT EXISTS funding_sequence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES funding_recommendations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES funding_products(id) ON DELETE SET NULL,
  sequence_order INTEGER NOT NULL,
  recommended_day INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started',
    'opened',
    'applied',
    'pending',
    'approved',
    'denied',
    'skipped'
  )),
  opened_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  approved_limit NUMERIC,
  user_notes TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funding_sequence_items_recommendation_idx
  ON funding_sequence_items(recommendation_id, sequence_order);
CREATE INDEX IF NOT EXISTS funding_sequence_items_user_id_idx
  ON funding_sequence_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS funding_sequence_items_status_idx
  ON funding_sequence_items(status);

CREATE TABLE IF NOT EXISTS funding_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES funding_recommendations(id) ON DELETE CASCADE,
  payment_plan TEXT,
  standard_fee NUMERIC,
  discounted_fee NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  amount_due NUMERIC DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funding_payments_user_id_idx
  ON funding_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS funding_payments_recommendation_idx
  ON funding_payments(recommendation_id);
CREATE INDEX IF NOT EXISTS funding_payments_status_idx
  ON funding_payments(status);

CREATE TABLE IF NOT EXISTS funding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS funding_events_user_id_idx
  ON funding_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS funding_events_type_idx
  ON funding_events(event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.vestblock_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_profiles_touch_updated_at ON funding_profiles;
CREATE TRIGGER funding_profiles_touch_updated_at
BEFORE UPDATE ON funding_profiles
FOR EACH ROW
EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS funding_products_touch_updated_at ON funding_products;
CREATE TRIGGER funding_products_touch_updated_at
BEFORE UPDATE ON funding_products
FOR EACH ROW
EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS funding_recommendations_touch_updated_at ON funding_recommendations;
CREATE TRIGGER funding_recommendations_touch_updated_at
BEFORE UPDATE ON funding_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS funding_sequence_items_touch_updated_at ON funding_sequence_items;
CREATE TRIGGER funding_sequence_items_touch_updated_at
BEFORE UPDATE ON funding_sequence_items
FOR EACH ROW
EXECUTE FUNCTION public.vestblock_touch_updated_at();

DROP TRIGGER IF EXISTS funding_payments_touch_updated_at ON funding_payments;
CREATE TRIGGER funding_payments_touch_updated_at
BEFORE UPDATE ON funding_payments
FOR EACH ROW
EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE funding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_sequence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own funding profiles" ON funding_profiles;
CREATE POLICY "Users can view their own funding profiles"
  ON funding_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding profiles" ON funding_profiles;
CREATE POLICY "Users can insert their own funding profiles"
  ON funding_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own funding profiles" ON funding_profiles;
CREATE POLICY "Users can update their own funding profiles"
  ON funding_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage funding profiles" ON funding_profiles;
CREATE POLICY "Admins can manage funding profiles"
  ON funding_profiles FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Authenticated users can read funding products" ON funding_products;
CREATE POLICY "Authenticated users can read funding products"
  ON funding_products FOR SELECT
  TO authenticated
  USING (active = TRUE);

DROP POLICY IF EXISTS "Admins can manage funding products" ON funding_products;
CREATE POLICY "Admins can manage funding products"
  ON funding_products FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Users can view their own funding recommendations" ON funding_recommendations;
CREATE POLICY "Users can view their own funding recommendations"
  ON funding_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding recommendations" ON funding_recommendations;
CREATE POLICY "Users can insert their own funding recommendations"
  ON funding_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own funding recommendations" ON funding_recommendations;
CREATE POLICY "Users can update their own funding recommendations"
  ON funding_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage funding recommendations" ON funding_recommendations;
CREATE POLICY "Admins can manage funding recommendations"
  ON funding_recommendations FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Users can view their own funding sequence items" ON funding_sequence_items;
CREATE POLICY "Users can view their own funding sequence items"
  ON funding_sequence_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding sequence items" ON funding_sequence_items;
CREATE POLICY "Users can insert their own funding sequence items"
  ON funding_sequence_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own funding sequence items" ON funding_sequence_items;
CREATE POLICY "Users can update their own funding sequence items"
  ON funding_sequence_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage funding sequence items" ON funding_sequence_items;
CREATE POLICY "Admins can manage funding sequence items"
  ON funding_sequence_items FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Users can view their own funding payments" ON funding_payments;
CREATE POLICY "Users can view their own funding payments"
  ON funding_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding payments" ON funding_payments;
CREATE POLICY "Users can insert their own funding payments"
  ON funding_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own funding payments" ON funding_payments;
CREATE POLICY "Users can update their own funding payments"
  ON funding_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage funding payments" ON funding_payments;
CREATE POLICY "Admins can manage funding payments"
  ON funding_payments FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Users can view their own funding events" ON funding_events;
CREATE POLICY "Users can view their own funding events"
  ON funding_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own funding events" ON funding_events;
CREATE POLICY "Users can insert their own funding events"
  ON funding_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage funding events" ON funding_events;
CREATE POLICY "Admins can manage funding events"
  ON funding_events FOR ALL
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON funding_profiles TO authenticated;
GRANT SELECT ON funding_products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON funding_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON funding_sequence_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON funding_payments TO authenticated;
GRANT SELECT, INSERT ON funding_events TO authenticated;
GRANT ALL ON funding_profiles TO service_role;
GRANT ALL ON funding_products TO service_role;
GRANT ALL ON funding_recommendations TO service_role;
GRANT ALL ON funding_sequence_items TO service_role;
GRANT ALL ON funding_payments TO service_role;
GRANT ALL ON funding_events TO service_role;

INSERT INTO funding_products (
  type,
  issuer,
  product_name,
  application_url,
  affiliate_url,
  min_fico,
  recommended_fico,
  requires_business,
  requires_ein,
  reports_to_personal,
  reports_to_business,
  intro_apr_months,
  annual_fee,
  estimated_limit_min,
  estimated_limit_max,
  bureau_notes,
  velocity_rules,
  risk_notes,
  truthful_application_notes,
  active
)
SELECT *
FROM (
  VALUES
    (
      'business_card',
      'VestBlock Partner Bank Network',
      'Business Rewards Card Option',
      NULL,
      NULL,
      680,
      720,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      12,
      0,
      5000,
      25000,
      'Issuer bureau usage varies by market, file, and timing.',
      'Avoid clustering multiple issuer applications without a reviewed sequence.',
      'May require personal guarantee and recent truthful business records.',
      'Use only accurate owner, revenue, and business formation details.',
      TRUE
    ),
    (
      'business_card',
      'VestBlock Partner Bank Network',
      'Business Cash Flow Card Option',
      NULL,
      NULL,
      700,
      730,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      15,
      95,
      8000,
      35000,
      'Business underwriters may review both owner and business file.',
      'Space applications based on real readiness and recent inquiry count.',
      'Not ideal for thin files, high utilization, or missing entity setup.',
      'Document business use, revenue support, and repayment plan truthfully.',
      TRUE
    ),
    (
      'business_line',
      'VestBlock Funding Partner',
      'Business Line of Credit Partner Option',
      'https://thefundingplaybook.com/homepage?am_id=VestBlock',
      'https://thefundingplaybook.com/homepage?am_id=VestBlock',
      660,
      700,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      0,
      0,
      10000,
      75000,
      'Line availability and review depth vary by lender and file quality.',
      'Use after entity, EIN, and bank account readiness are in place.',
      'Revenue consistency and debt load matter as much as score.',
      'Only submit documented business revenue and business purpose.',
      TRUE
    ),
    (
      'personal_card',
      'Major Issuer Set',
      'Personal 0% APR Card Option',
      NULL,
      NULL,
      680,
      720,
      FALSE,
      FALSE,
      TRUE,
      FALSE,
      15,
      0,
      3000,
      20000,
      'Issuer pulls and bureau preferences can vary by geography and profile.',
      'Do not compress multiple personal applications into a weak inquiry window.',
      'High utilization or many new accounts may reduce approvals and limits.',
      'Use truthful income, housing, and repayment information only.',
      TRUE
    ),
    (
      'personal_card',
      'Major Issuer Set',
      'Personal Cash Flow Card Option',
      NULL,
      NULL,
      700,
      730,
      FALSE,
      FALSE,
      TRUE,
      FALSE,
      18,
      95,
      5000,
      25000,
      'Intro offers and eligibility shift by issuer and current market terms.',
      'Reserve for stronger utilization and inquiry profiles.',
      'Multiple recent approvals can quickly reduce additional approvals.',
      'Submit only information you can verify with current documents.',
      TRUE
    ),
    (
      'secured_card',
      'Credit Builder Provider',
      'Secured Credit Builder Card',
      NULL,
      NULL,
      580,
      620,
      FALSE,
      FALSE,
      TRUE,
      FALSE,
      0,
      0,
      200,
      2500,
      'Useful when approvals should be approached conservatively.',
      'Best used as a build-first step, not a rush-application tactic.',
      'Capital is tied to the security deposit and results take time.',
      'Open only if the deposit, timeline, and reporting structure fit your plan.',
      TRUE
    ),
    (
      'credit_builder',
      'VestBlock Readiness',
      'Funding Readiness Checklist',
      NULL,
      NULL,
      0,
      0,
      FALSE,
      FALSE,
      FALSE,
      FALSE,
      0,
      0,
      0,
      0,
      'Use before any sequence when utilization, inquiries, or file age need work.',
      'Complete utilization reduction, inquiry cooling, and document prep first.',
      'Applying before this step is complete may create avoidable denials.',
      'Gather truthful supporting documents before moving into applications.',
      TRUE
    ),
    (
      'credit_builder',
      'Credit Builder Provider',
      'Credit Builder Loan',
      NULL,
      NULL,
      560,
      620,
      FALSE,
      FALSE,
      TRUE,
      FALSE,
      0,
      0,
      300,
      3000,
      'May support file depth when used carefully and paid as agreed.',
      'Allow reporting time before pursuing a larger sequence.',
      'Not a shortcut to immediate funding.',
      'Review fees, reporting cadence, and cash-flow fit honestly.',
      TRUE
    ),
    (
      'personal_loan',
      'Installment Lender Network',
      'Debt Consolidation Review Path',
      NULL,
      NULL,
      620,
      660,
      FALSE,
      FALSE,
      TRUE,
      FALSE,
      0,
      0,
      2000,
      15000,
      'Use carefully when utilization cleanup may improve later readiness.',
      'Compare total cost and repayment burden before moving forward.',
      'Wrong-fit installment debt can worsen cash flow.',
      'Do not use for cosmetic application optics alone.',
      TRUE
    ),
    (
      'real_estate_funding',
      'VestBlock Real Estate Network',
      'Real Estate Investor Funding Partner',
      '/real-estate-funding',
      NULL,
      680,
      720,
      TRUE,
      FALSE,
      TRUE,
      FALSE,
      0,
      0,
      25000,
      250000,
      'Project fit, collateral, reserves, and experience matter heavily.',
      'Use after business and property strategy are clearly documented.',
      'Terms can vary widely by deal structure.',
      'Submit only accurate project budgets, timelines, and financials.',
      TRUE
    ),
    (
      'grant_or_program',
      'VestBlock Research Desk',
      'Grant and Program Research Path',
      '/tools/grants',
      NULL,
      0,
      0,
      TRUE,
      FALSE,
      FALSE,
      FALSE,
      0,
      0,
      1000,
      25000,
      'Not a revolving credit option, but useful when debt should stay limited.',
      'Use as a parallel research lane, not an approval guarantee.',
      'Grant timelines can be slow and documentation-heavy.',
      'Keep business purpose, use of funds, and eligibility claims documented.',
      TRUE
    )
) AS seed (
  type,
  issuer,
  product_name,
  application_url,
  affiliate_url,
  min_fico,
  recommended_fico,
  requires_business,
  requires_ein,
  reports_to_personal,
  reports_to_business,
  intro_apr_months,
  annual_fee,
  estimated_limit_min,
  estimated_limit_max,
  bureau_notes,
  velocity_rules,
  risk_notes,
  truthful_application_notes,
  active
)
WHERE NOT EXISTS (
  SELECT 1
  FROM funding_products existing
  WHERE existing.product_name = seed.product_name
);
