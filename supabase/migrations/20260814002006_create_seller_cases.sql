-- Gate 4E.1: private, owned seller cases with auditable operator review.
-- Guest and account access is mediated by same-origin server routes. Direct
-- browser access to both tables is intentionally denied.

CREATE TABLE IF NOT EXISTS public.seller_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  public_token_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'needs_information', 'under_review',
    'options_review', 'declined', 'withdrawn', 'closed'
  )),
  seller_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  property_address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL DEFAULT '',
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  property_condition TEXT NOT NULL DEFAULT '',
  occupancy_status TEXT NOT NULL DEFAULT '',
  timeline_to_sell TEXT NOT NULL DEFAULT '',
  reason_for_selling TEXT NOT NULL DEFAULT '',
  preferred_sale_path TEXT NOT NULL DEFAULT 'not_sure',
  estimated_value NUMERIC,
  asking_price NUMERIC,
  mortgage_balance NUMERIC,
  liens_or_taxes TEXT NOT NULL DEFAULT '',
  best_time_to_contact TEXT NOT NULL DEFAULT '',
  communication_preference TEXT NOT NULL DEFAULT 'either' CHECK (
    communication_preference IN ('email', 'phone', 'either')
  ),
  analysis_consent BOOLEAN NOT NULL DEFAULT FALSE,
  contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  seller_notes TEXT NOT NULL DEFAULT '',
  source_path TEXT NOT NULL DEFAULT '/sell',
  source TEXT NOT NULL DEFAULT 'seller_case',
  attribution JSONB NOT NULL DEFAULT '{}'::JSONB,
  completeness_score INTEGER NOT NULL DEFAULT 0 CHECK (completeness_score BETWEEN 0 AND 100),
  completeness_gaps TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  dedupe_key TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  operator_task_id UUID REFERENCES public.admin_tasks(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_status_note TEXT,
  submitted_at TIMESTAMPTZ,
  last_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_case_id UUID NOT NULL REFERENCES public.seller_cases(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_cases_user_updated
  ON public.seller_cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_cases_queue
  ON public.seller_cases(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_cases_property
  ON public.seller_cases(lower(property_address), lower(city), lower(state));
CREATE INDEX IF NOT EXISTS idx_seller_cases_email
  ON public.seller_cases(lower(email), updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_case_events_case_created
  ON public.seller_case_events(seller_case_id, created_at DESC);

DROP TRIGGER IF EXISTS seller_cases_touch_updated_at ON public.seller_cases;
CREATE TRIGGER seller_cases_touch_updated_at
  BEFORE UPDATE ON public.seller_cases
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.seller_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_case_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.seller_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.seller_case_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.seller_cases TO service_role;
GRANT ALL ON public.seller_case_events TO service_role;

COMMENT ON TABLE public.seller_cases IS
  'Private seller intake and lifecycle records. Ownership and high-entropy guest resume tokens are enforced by same-origin server routes.';
COMMENT ON COLUMN public.seller_cases.marketing_consent IS
  'Optional marketing permission, stored separately from required analysis and case-contact permissions.';
COMMENT ON COLUMN public.seller_cases.assigned_to IS
  'VestBlock operator responsible for review; separate from customer ownership in user_id.';
COMMENT ON TABLE public.seller_case_events IS
  'Append-only seller case lifecycle and status history.';
