-- Gate 4D: one owned, auditable case layer for every VestBlock Capital path.
-- Customer and guest access is mediated by same-origin server routes. The
-- service-role key remains server-only and direct public table access is denied.

CREATE TABLE IF NOT EXISTS public.capital_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  public_token_hash TEXT UNIQUE,
  case_type TEXT NOT NULL CHECK (case_type IN (
    'business_funding',
    'real_estate_funding',
    'business_acquisition',
    'business_credit',
    'grants_programs',
    'capital_provider'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'submitted',
    'needs_information',
    'under_review',
    'readiness_plan',
    'ready_for_provider_review',
    'provider_review',
    'approved',
    'declined',
    'withdrawn',
    'closed'
  )),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  organization_name TEXT,
  amount_requested NUMERIC,
  purpose TEXT,
  timing TEXT,
  geography TEXT,
  communication_preference TEXT NOT NULL DEFAULT 'email' CHECK (
    communication_preference IN ('email', 'phone', 'either')
  ),
  analysis_consent BOOLEAN NOT NULL DEFAULT FALSE,
  provider_sharing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  intake_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  readiness_score INTEGER NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  readiness_tier TEXT NOT NULL DEFAULT 'incomplete' CHECK (readiness_tier IN (
    'incomplete', 'preparing', 'developing', 'review_ready', 'strong_file'
  )),
  readiness_feedback JSONB NOT NULL DEFAULT '{}'::JSONB,
  required_documents TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  available_documents TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  missing_documents TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  provider_criteria JSONB NOT NULL DEFAULT '{}'::JSONB,
  dedupe_key TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL,
  operator_task_id UUID REFERENCES public.admin_tasks(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_status_note TEXT,
  submitted_at TIMESTAMPTZ,
  last_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.capital_case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capital_case_id UUID NOT NULL REFERENCES public.capital_cases(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_cases_user_updated
  ON public.capital_cases(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_capital_cases_queue
  ON public.capital_cases(status, case_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_capital_cases_email_type
  ON public.capital_cases(lower(email), case_type);
CREATE INDEX IF NOT EXISTS idx_capital_case_events_case_created
  ON public.capital_case_events(capital_case_id, created_at DESC);

DROP TRIGGER IF EXISTS capital_cases_touch_updated_at ON public.capital_cases;
CREATE TRIGGER capital_cases_touch_updated_at
  BEFORE UPDATE ON public.capital_cases
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.capital_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_case_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.capital_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.capital_case_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.capital_cases TO service_role;
GRANT ALL ON public.capital_case_events TO service_role;

COMMENT ON TABLE public.capital_cases IS
  'Private Capital intake and lifecycle records. User ownership and high-entropy guest resume tokens are enforced by same-origin server routes.';
COMMENT ON COLUMN public.capital_cases.assigned_to IS
  'VestBlock operator responsible for review; this is separate from customer record ownership in user_id.';
COMMENT ON COLUMN public.capital_cases.provider_sharing_consent IS
  'Permission to consider the case for controlled provider review. It never makes the record public and does not promise submission or approval.';
COMMENT ON TABLE public.capital_case_events IS
  'Append-only status and lifecycle history for Capital cases.';
