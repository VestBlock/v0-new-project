-- Gate 4E.2: authenticated, multi-role participant profiles.
--
-- The existing buyers, lenders, and investor_profiles tables remain the
-- operator/discovery network. They intentionally are not auto-claimed by
-- matching an email address. This table is the owned account profile layer and
-- may link to a legacy record only after explicit operator verification.

CREATE TABLE IF NOT EXISTS public.participant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'buyer',
    'investor',
    'lender',
    'builder',
    'developer',
    'real_estate_agent',
    'wholesaler',
    'business_buyer',
    'business_seller',
    'service_provider'
  )),
  origin TEXT NOT NULL DEFAULT 'customer' CHECK (origin IN (
    'customer', 'operator', 'imported', 'discovered', 'legacy'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'active', 'paused', 'needs_information',
    'declined', 'withdrawn', 'archived'
  )),
  identity_type TEXT NOT NULL DEFAULT 'individual' CHECK (
    identity_type IN ('individual', 'organization')
  ),
  display_name TEXT NOT NULL DEFAULT '',
  organization_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  criteria_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  communication_preferences_json JSONB NOT NULL DEFAULT '{"email":true,"phone":false}'::JSONB,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_at TIMESTAMPTZ,
  matching_consent BOOLEAN NOT NULL DEFAULT FALSE,
  matching_consent_at TIMESTAMPTZ,
  outreach_consent BOOLEAN NOT NULL DEFAULT FALSE,
  outreach_consent_at TIMESTAMPTZ,
  public_visibility_consent BOOLEAN NOT NULL DEFAULT FALSE,
  public_visibility_consented_at TIMESTAMPTZ,
  public_visibility_consent_version TEXT,
  public_slug TEXT UNIQUE,
  public_field_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  consent_version TEXT NOT NULL DEFAULT 'gate-4e2-v1',
  consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  operator_verified_at TIMESTAMPTZ,
  operator_verification_note TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_profile_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  crm_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  operator_task_id UUID REFERENCES public.admin_tasks(id) ON DELETE SET NULL,
  legacy_entity_type TEXT CHECK (
    legacy_entity_type IS NULL OR legacy_entity_type IN ('buyers', 'lenders', 'investor_profiles')
  ),
  legacy_entity_id UUID,
  legacy_claim_status TEXT NOT NULL DEFAULT 'none' CHECK (
    legacy_claim_status IN ('none', 'pending_verification', 'verified', 'rejected')
  ),
  idempotency_key TEXT,
  profile_version INTEGER NOT NULL DEFAULT 1 CHECK (profile_version > 0),
  safe_failure_state TEXT,
  safe_failure_message TEXT,
  last_review_reason TEXT,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, role),
  UNIQUE (owner_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.participant_profile_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_profile_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'operator', 'system')),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  customer_visible BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.participant_profile_normalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_profile_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  proposed_json JSONB,
  provider_model TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    status IN ('proposed', 'approved', 'rejected', 'failed')
  ),
  user_corrections_json JSONB,
  approved_json JSONB,
  failure_code TEXT,
  failure_message TEXT,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_profiles_owner_updated
  ON public.participant_profiles(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_operator_queue
  ON public.participant_profiles(status, role, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_assignment
  ON public.participant_profiles(assigned_to, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_legacy
  ON public.participant_profiles(legacy_entity_type, legacy_entity_id)
  WHERE legacy_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participant_profile_events_profile_created
  ON public.participant_profile_events(participant_profile_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_participant_profile_normalizations_profile_created
  ON public.participant_profile_normalizations(participant_profile_id, created_at DESC);

DROP TRIGGER IF EXISTS participant_profiles_touch_updated_at ON public.participant_profiles;
CREATE TRIGGER participant_profiles_touch_updated_at
  BEFORE UPDATE ON public.participant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_profile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_profile_normalizations ENABLE ROW LEVEL SECURITY;

-- Every access path is mediated by an authenticated, same-origin server route
-- that re-checks ownership or admin authorization. Browser roles receive no
-- direct table privileges, matching the approved Gate 4E.1 pattern.
REVOKE ALL ON public.participant_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.participant_profile_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.participant_profile_normalizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.participant_profiles TO service_role;
GRANT ALL ON public.participant_profile_events TO service_role;
GRANT ALL ON public.participant_profile_normalizations TO service_role;

COMMENT ON TABLE public.participant_profiles IS
  'Owned VestBlock account profiles. Legacy prospect records are linked only after explicit operator verification and never by email matching.';
COMMENT ON COLUMN public.participant_profiles.public_visibility_consent IS
  'Independent public-display permission. It does not authorize marketing, matching, or outreach.';
COMMENT ON COLUMN public.participant_profiles.matching_consent IS
  'Stored separately for a later gate. Gate 4E.2 does not run matching.';
COMMENT ON COLUMN public.participant_profiles.outreach_consent IS
  'Stored separately for a later gate. Gate 4E.2 does not run outreach.';
COMMENT ON TABLE public.participant_profile_events IS
  'Append-only lifecycle history. Customer routes expose only rows marked customer_visible.';
COMMENT ON TABLE public.participant_profile_normalizations IS
  'AI-proposed criteria with original text, explicit approval, corrections, and recoverable failure state.';

CREATE OR REPLACE FUNCTION public.approve_participant_normalization(
  p_normalization_id UUID,
  p_profile_id UUID,
  p_owner_user_id UUID,
  p_expected_version INTEGER,
  p_approved_json JSONB,
  p_corrections_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_row public.participant_profiles%ROWTYPE;
  normalization_row public.participant_profile_normalizations%ROWTYPE;
  approved_at_value TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO profile_row
  FROM public.participant_profiles
  WHERE id = p_profile_id
    AND owner_user_id = p_owner_user_id
    AND origin = 'customer'
  FOR UPDATE;

  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF profile_row.profile_version <> p_expected_version THEN
    RAISE EXCEPTION 'stale_version' USING ERRCODE = 'P0001';
  END IF;

  IF profile_row.status IN ('withdrawn', 'archived') THEN
    RAISE EXCEPTION 'profile_not_editable' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO normalization_row
  FROM public.participant_profile_normalizations
  WHERE id = p_normalization_id
    AND participant_profile_id = p_profile_id
    AND owner_user_id = p_owner_user_id
  FOR UPDATE;

  IF normalization_row.id IS NULL OR normalization_row.status <> 'proposed' THEN
    RAISE EXCEPTION 'proposal_not_available' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.participant_profile_normalizations
  SET status = 'approved',
      user_corrections_json = COALESCE(p_corrections_json, '{}'::JSONB),
      approved_json = COALESCE(p_approved_json, '{}'::JSONB),
      approved_at = approved_at_value
  WHERE id = p_normalization_id;

  UPDATE public.participant_profiles
  SET criteria_json = COALESCE(p_approved_json, '{}'::JSONB),
      profile_version = profile_version + 1,
      last_verified_at = NULL,
      safe_failure_state = NULL,
      safe_failure_message = NULL
  WHERE id = p_profile_id;

  INSERT INTO public.participant_profile_events (
    participant_profile_id,
    actor_user_id,
    actor_kind,
    event_type,
    from_status,
    to_status,
    note,
    customer_visible
  ) VALUES (
    p_profile_id,
    p_owner_user_id,
    'customer',
    'normalization_approved',
    profile_row.status,
    profile_row.status,
    'The customer approved the structured proposal. No matching or outreach started.',
    TRUE
  );

  RETURN jsonb_build_object(
    'id', p_normalization_id,
    'status', 'approved',
    'approvedAt', approved_at_value,
    'profileVersion', profile_row.profile_version + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_participant_normalization(
  UUID, UUID, UUID, INTEGER, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_participant_normalization(
  UUID, UUID, UUID, INTEGER, JSONB, JSONB
) TO service_role;
