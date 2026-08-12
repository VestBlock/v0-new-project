-- Remove a legacy arbitrary-SQL RPC and restrict execution of operational
-- helpers that were granted to the Data API roles.

DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

REVOKE ALL ON FUNCTION public.get_public_tables() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_openai_usage_by_user(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_openai_usage_by_user(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.dealvault_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_roadmap_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_chat_history_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_documents_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vestblock_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    full_name = CASE
      WHEN COALESCE(public.user_profiles.full_name, '') = '' THEN EXCLUDED.full_name
      ELSE public.user_profiles.full_name
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

DROP FUNCTION IF EXISTS public.handle_new_user();
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
