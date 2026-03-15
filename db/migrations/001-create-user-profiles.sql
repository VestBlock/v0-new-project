-- Drop existing table and related objects if they exist, to ensure a clean setup
-- This is aggressive for a re-run, but ensures we start fresh if there were partial creations.
-- If you have data you want to keep and are sure the table just needs creation, you can remove these DROP lines.
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Create the user_profiles table
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to auth.users table and ensures PK is user's auth ID
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    full_name TEXT,
    email TEXT UNIQUE, -- Often synced with auth.users.email
    credit_score INTEGER,
    -- Address fields (ensure these match your UserProfile interface in profile/page.tsx)
    address_street TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zip TEXT,
    phone_number TEXT,
    -- The financial_goal column will be added by a separate migration script
    CONSTRAINT check_credit_score CHECK (credit_score IS NULL OR (credit_score >= 300 AND credit_score <= 850))
);

-- Comment on the table and columns
COMMENT ON TABLE public.user_profiles IS 'Stores public profile information for each user, extending auth.users.';
COMMENT ON COLUMN public.user_profiles.id IS 'User ID from auth.users, serves as the primary key.';
COMMENT ON COLUMN public.user_profiles.email IS 'User''s email, should be kept in sync with auth.users.email if possible.';
COMMENT ON COLUMN public.user_profiles.credit_score IS 'User''s self-reported credit score.';

-- Create a trigger function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that uses the function
CREATE TRIGGER on_user_profiles_updated
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for RLS:
-- 1. Users can see their own profile.
CREATE POLICY "Users can view their own profile."
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

-- 2. Users can insert their own profile.
--    Note: This is typically handled by the handle_new_user trigger,
--    but having an explicit insert policy can be useful for direct inserts if needed.
CREATE POLICY "Users can insert their own profile."
ON public.user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile.
CREATE POLICY "Users can update their own profile."
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Function to automatically create a profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name' -- Assumes full_name might be in metadata during signup
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows it to write to user_profiles

-- Trigger to call handle_new_user on new auth.users entry
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
