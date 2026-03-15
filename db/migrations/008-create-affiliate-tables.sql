-- 008-create-affiliate-tables.sql

-- Drop tables if they exist (for re-runnability during development)
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.affiliates CASCADE;

-- Table to store affiliate information
CREATE TABLE public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL, -- An affiliate can be an existing platform user
    affiliate_code TEXT UNIQUE NOT NULL CHECK (char_length(affiliate_code) >= 6 AND char_length(affiliate_code) <= 20), -- e.g., "VESTROCK15"
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    website_url TEXT,
    paypal_email TEXT, -- Example payment detail, consider more robust JSONB for multiple options
    commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.1000, -- e.g., 0.1000 for 10.00%
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    notes TEXT, -- For admin use
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.affiliates IS 'Stores information about affiliate partners.';
COMMENT ON COLUMN public.affiliates.affiliate_code IS 'Unique code for referral links, e.g., mysite.com?ref=CODE.';
COMMENT ON COLUMN public.affiliates.commission_rate IS 'Default commission rate for this affiliate (e.g., 0.10 for 10%). Can be overridden per product/service.';
COMMENT ON COLUMN public.affiliates.status IS 'Status of the affiliate application/account.';

-- Table to track referrals made by affiliates
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, -- The user who signed up via referral
    referral_code_used TEXT NOT NULL,
    ip_address TEXT, -- Store for analytics, consider privacy
    user_agent TEXT, -- Store for analytics
    conversion_type TEXT NOT NULL DEFAULT 'signup', -- e.g., 'signup', 'first_payment', 'subscription_renewal'
    conversion_timestamp TIMESTAMPTZ DEFAULT NOW(),
    source_url TEXT, -- The URL the user clicked the referral link on
    commission_amount DECIMAL(10, 2), -- Amount of commission earned for this specific referral event
    commission_status TEXT NOT NULL DEFAULT 'pending' CHECK (commission_status IN ('pending', 'approved', 'paid', 'rejected', 'voided')),
    payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL, -- Link to the payout batch if this commission was paid
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.referrals IS 'Tracks users referred by affiliates and their conversion events.';
COMMENT ON COLUMN public.referrals.referred_user_id IS 'The platform user who was successfully referred.';
COMMENT ON COLUMN public.referrals.commission_status IS 'Status of the commission for this referral.';


-- Table to track payouts made to affiliates
CREATE TABLE public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payout_date TIMESTAMPTZ DEFAULT NOW(),
    payment_method_used TEXT, -- e.g., 'PayPal', 'Bank Transfer'
    transaction_id TEXT, -- Transaction ID from the payment processor
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reverted')),
    notes TEXT, -- e.g., "Q1 2024 Payout"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.payouts IS 'Records payouts made to affiliates.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON public.affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON public.affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON public.referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code_used ON public.referrals(referral_code_used);
CREATE INDEX IF NOT EXISTS idx_referrals_commission_status ON public.referrals(commission_status);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON public.payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);


-- RLS Policies for affiliates table
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own approved profile."
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id AND status = 'approved');

CREATE POLICY "Users can apply to be affiliates (insert their own record)."
  ON public.affiliates FOR INSERT
  WITH CHECK (auth.uid() = user_id); -- Or allow anonymous application if user_id is nullable and set later

CREATE POLICY "Affiliates can update their own profile details."
  ON public.affiliates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'approved')); -- Allow updates only if pending or approved

-- RLS Policies for referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own referrals."
  ON public.referrals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid()));

-- RLS Policies for payouts table
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can view their own payouts."
  ON public.payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid()));


-- Admin access (service_role bypasses RLS by default)
-- For more granular admin control, you might create specific admin roles and policies.

-- Function to generate a unique affiliate code (simple example)
CREATE OR REPLACE FUNCTION generate_affiliate_code(name_input TEXT)
RETURNS TEXT AS $$
DECLARE
    base_code TEXT;
    final_code TEXT;
    random_suffix TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create a base from the name, uppercase and remove non-alphanumerics
    base_code := UPPER(REGEXP_REPLACE(name_input, '[^A-Za-z0-9]', '', 'g'));
    -- Take first 8 chars, or less if name is shorter
    base_code := SUBSTRING(base_code FROM 1 FOR 8);

    LOOP
        -- Generate a 4-char random alphanumeric suffix
        random_suffix := SUBSTRING(UPPER(REPLACE(gen_random_uuid()::TEXT, '-', '')), 1, 4);
        final_code := base_code || random_suffix;

        -- Ensure it's within length constraints
        IF char_length(final_code) > 20 THEN
            final_code := SUBSTRING(final_code FROM 1 FOR 20);
        END IF;
        IF char_length(final_code) < 6 THEN
            final_code := final_code || LPAD('', 6 - char_length(final_code), random_suffix); -- Pad if too short
        END IF;


        -- Check for uniqueness
        IF NOT EXISTS (SELECT 1 FROM public.affiliates WHERE affiliate_code = final_code) THEN
            RETURN final_code;
        END IF;
        counter := counter + 1;
        IF counter > 10 THEN -- Prevent infinite loop in unlikely collision scenario
            RAISE EXCEPTION 'Could not generate a unique affiliate code after 10 attempts for %', name_input;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION generate_affiliate_code(TEXT) IS 'Generates a somewhat unique affiliate code based on a name.';

-- Trigger to auto-update updated_at timestamp for affiliates
CREATE OR REPLACE FUNCTION public.handle_affiliates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_affiliates_updated
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.handle_affiliates_updated_at();

SELECT 'Affiliate system tables created successfully.';
