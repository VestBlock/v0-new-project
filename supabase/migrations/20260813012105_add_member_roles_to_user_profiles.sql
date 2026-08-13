ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS member_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.user_profiles AS profiles
SET member_roles = COALESCE(
  (
    SELECT ARRAY(
      SELECT DISTINCT role_value
      FROM jsonb_array_elements_text(
        COALESCE(users.raw_user_meta_data -> 'member_roles', '[]'::JSONB)
      ) AS role_value
      WHERE role_value = ANY (ARRAY[
        'business_owner',
        'capital_seeker',
        'real_estate_buyer',
        'property_seller',
        'investor',
        'lender',
        'developer_operator',
        'service_provider'
      ]::TEXT[])
    )
    FROM auth.users AS users
    WHERE users.id = profiles.id OR users.id = profiles.user_id
    LIMIT 1
  ),
  ARRAY[]::TEXT[]
)
WHERE cardinality(profiles.member_roles) = 0;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_member_roles_allowed;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_member_roles_allowed CHECK (
    member_roles <@ ARRAY[
      'business_owner',
      'capital_seeker',
      'real_estate_buyer',
      'property_seller',
      'investor',
      'lender',
      'developer_operator',
      'service_provider'
    ]::TEXT[]
  );

GRANT SELECT (member_roles) ON public.user_profiles TO authenticated;
GRANT UPDATE (member_roles) ON public.user_profiles TO authenticated;
GRANT ALL (member_roles) ON public.user_profiles TO service_role;

COMMENT ON COLUMN public.user_profiles.member_roles IS
  'Self-selected VestBlock participation paths. Never use this column for administrative authorization.';
