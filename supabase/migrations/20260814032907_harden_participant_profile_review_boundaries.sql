-- Gate 4E.2: material criteria approved by a customer must be re-reviewed
-- before an already-active profile can remain publicly discoverable.
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
  next_status TEXT;
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

  next_status := CASE
    WHEN profile_row.status = 'active' THEN 'pending_review'
    ELSE profile_row.status
  END;

  UPDATE public.participant_profile_normalizations
  SET status = 'approved',
      user_corrections_json = COALESCE(p_corrections_json, '{}'::JSONB),
      approved_json = COALESCE(p_approved_json, '{}'::JSONB),
      approved_at = approved_at_value
  WHERE id = p_normalization_id;

  UPDATE public.participant_profiles
  SET criteria_json = COALESCE(p_approved_json, '{}'::JSONB),
      status = next_status,
      submitted_at = CASE
        WHEN next_status = 'pending_review' THEN approved_at_value
        ELSE submitted_at
      END,
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
    next_status,
    CASE
      WHEN next_status = 'pending_review'
        THEN 'The customer approved the structured proposal. The changed criteria returned to operator review; no matching or outreach started.'
      ELSE 'The customer approved the structured proposal. No matching or outreach started.'
    END,
    TRUE
  );

  RETURN jsonb_build_object(
    'id', p_normalization_id,
    'status', 'approved',
    'approvedAt', approved_at_value,
    'profileStatus', next_status,
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
