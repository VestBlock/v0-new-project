INSERT INTO public.user_profiles (id, user_id, email, full_name)
SELECT
  users.id,
  users.id,
  users.email,
  COALESCE(users.raw_user_meta_data ->> 'full_name', '')
FROM auth.users AS users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_profiles AS profiles
  WHERE profiles.id = users.id OR profiles.user_id = users.id
)
ON CONFLICT (id) DO NOTHING;
