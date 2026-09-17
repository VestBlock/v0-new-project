-- The canonical 1,000-output plan allocates 80% to 16 seller lanes, which is
-- exactly 50 slots per seller lane. The original database guard rejected any
-- target above 44, so the strategy engine failed on its first reservation and
-- left otherwise-qualified seller runs stranded in `running`.

CREATE OR REPLACE FUNCTION public.reserve_strategy_daily_lane_membership(
  p_business_date DATE,
  p_lane_target INTEGER,
  p_lead_id UUID,
  p_campaign_run_id UUID,
  p_strategy_key TEXT,
  p_market TEXT,
  p_source_provider TEXT,
  p_recipient_key TEXT,
  p_qualification_score INTEGER,
  p_qualification_reasons JSONB DEFAULT '[]'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_count INTEGER := 0;
  v_membership_id UUID;
  v_run_strategy_key TEXT;
  v_run_key TEXT;
BEGIN
  IF p_business_date IS NULL OR
     -- The weighted application plan clamps total daily output to 1,000 and
     -- currently assigns at most 50 slots to any canonical lane.
     p_lane_target IS NULL OR p_lane_target < 1 OR p_lane_target > 50 OR
     p_lead_id IS NULL OR p_campaign_run_id IS NULL OR
     p_strategy_key IS NULL OR BTRIM(p_strategy_key) = '' OR
     p_source_provider IS NULL OR BTRIM(p_source_provider) = '' OR
     p_recipient_key IS NULL OR BTRIM(p_recipient_key) = '' THEN
    RETURN jsonb_build_object('reserved', FALSE, 'reason', 'invalid_daily_lane_reservation');
  END IF;

  SELECT run.strategy_key, run.run_key
  INTO v_run_strategy_key, v_run_key
  FROM public.command_center_strategy_runs AS run
  WHERE run.id = p_campaign_run_id;

  IF NOT FOUND OR
     v_run_strategy_key <> p_strategy_key OR
     v_run_key IS NULL OR
     v_run_key NOT LIKE p_business_date::TEXT || ':' || p_strategy_key || ':%' THEN
    RETURN jsonb_build_object('reserved', FALSE, 'reason', 'strategy_run_identity_mismatch');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    2086227403,
    pg_catalog.hashtext(p_business_date::TEXT || ':' || p_strategy_key)
  );

  SELECT COUNT(*)::INTEGER
  INTO v_existing_count
  FROM public.strategy_lead_memberships AS membership
  JOIN public.command_center_strategy_runs AS run
    ON run.id = membership.campaign_run_id
  WHERE run.run_key LIKE p_business_date::TEXT || ':%'
    AND membership.strategy_key = p_strategy_key
    AND membership.status NOT IN ('rejected', 'failed')
    AND (
      membership.status <> 'qualified' OR
      membership.created_at >= pg_catalog.clock_timestamp() - INTERVAL '15 minutes' OR
      EXISTS (
        SELECT 1
        FROM public.outreach_messages AS message
        WHERE message.lead_id = membership.lead_id
          AND message.channel = 'email'
          AND message.generated_with = 'strategy_engine:' || membership.strategy_key
      )
    );

  IF v_existing_count >= p_lane_target THEN
    RETURN jsonb_build_object(
      'reserved', FALSE,
      'reason', 'daily_lane_allocation_exhausted',
      'existingCount', v_existing_count,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.strategy_lead_memberships (
    lead_id,
    campaign_run_id,
    strategy_key,
    market,
    source_provider,
    recipient_key,
    qualification_score,
    qualification_reasons,
    email_verification_status,
    status,
    metadata_json
  ) VALUES (
    p_lead_id,
    p_campaign_run_id,
    p_strategy_key,
    p_market,
    p_source_provider,
    LOWER(BTRIM(p_recipient_key)),
    p_qualification_score,
    COALESCE(p_qualification_reasons, '[]'::jsonb),
    'unverified',
    'qualified',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_membership_id;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'reserved', FALSE,
      'reason', 'lead_or_recipient_already_enrolled',
      'existingCount', v_existing_count,
      'remaining', GREATEST(0, p_lane_target - v_existing_count)
    );
  END IF;

  RETURN jsonb_build_object(
    'reserved', TRUE,
    'reason', NULL,
    'membershipId', v_membership_id,
    'existingCount', v_existing_count + 1,
    'remaining', GREATEST(0, p_lane_target - v_existing_count - 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_strategy_daily_lane_membership(
  DATE, INTEGER, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_strategy_daily_lane_membership(
  DATE, INTEGER, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB
) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_strategy_daily_lane_membership(
  DATE, INTEGER, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_strategy_daily_lane_membership(
  DATE, INTEGER, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, JSONB
) TO service_role;
