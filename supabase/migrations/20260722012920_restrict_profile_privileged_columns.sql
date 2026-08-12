REVOKE ALL ON public.user_profiles, public.profiles FROM anon, authenticated;

GRANT SELECT ON public.user_profiles, public.profiles TO authenticated;
GRANT INSERT (id, user_id, email, full_name) ON public.user_profiles TO authenticated;
GRANT UPDATE (
  full_name,
  credit_score,
  address_street,
  address_city,
  address_state,
  address_zip,
  phone_number,
  financial_goal,
  updated_at
) ON public.user_profiles TO authenticated;

GRANT INSERT (id, email, full_name, phone) ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

GRANT ALL ON public.user_profiles, public.profiles TO service_role;

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_safe_columns ON public.user_profiles;

CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR user_id = auth.uid());

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(user_id, id) = auth.uid()
    AND COALESCE(role, 'user') = 'user'
    AND is_subscribed = FALSE
    AND paypal_order_id IS NULL
    AND paypal_order_product IS NULL
  );

CREATE POLICY user_profiles_update_safe_columns ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR user_id = auth.uid())
  WITH CHECK (id = auth.uid() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_safe_columns ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND COALESCE(role, 'user') = 'user'
    AND COALESCE(is_pro, FALSE) = FALSE
  );

CREATE POLICY profiles_update_safe_columns ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
