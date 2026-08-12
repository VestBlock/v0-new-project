-- Prevent authenticated clients from promoting themselves or granting paid access.
-- Review and apply through the normal Supabase migration process; this file is not
-- executed by the release-candidate build.

CREATE OR REPLACE FUNCTION private.vestblock_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

REVOKE ALL ON FUNCTION private.vestblock_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.vestblock_is_admin() TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_user_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_subscribed IS DISTINCT FROM OLD.is_subscribed
    OR NEW.paypal_order_id IS DISTINCT FROM OLD.paypal_order_id
    OR NEW.paypal_order_product IS DISTINCT FROM OLD.paypal_order_product
  THEN
    RAISE EXCEPTION 'Privileged profile fields can only be changed by VestBlock server operations'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_profile_privileges ON public.user_profiles;
CREATE TRIGGER protect_user_profile_privileges
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_profile_privileges();

REVOKE ALL ON FUNCTION public.protect_user_profile_privileges() FROM PUBLIC;

COMMENT ON FUNCTION private.vestblock_is_admin() IS
  'Returns true only for a Supabase Auth app_metadata admin role; user_profiles.role is not an authorization source.';
COMMENT ON FUNCTION public.protect_user_profile_privileges() IS
  'Rejects client changes to role, subscription, and PayPal entitlement fields.';

-- Run the pre-migration duplicate check from the release notes before applying.
CREATE UNIQUE INDEX IF NOT EXISTS payments_paypal_transaction_unique_idx
  ON public.payments(paypal_transaction_id)
  WHERE paypal_transaction_id IS NOT NULL;
