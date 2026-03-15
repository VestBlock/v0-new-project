-- Add the financial_goal column to user_profiles if it doesn't exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS financial_goal JSONB;

-- Add an index for the financial_goal column if it doesn't exist
-- This is optional but can be beneficial if you query by this column often.
-- GIN indexes are good for JSONB.
CREATE INDEX IF NOT EXISTS idx_user_profiles_financial_goal ON public.user_profiles USING GIN (financial_goal);

COMMENT ON COLUMN public.user_profiles.financial_goal IS 'Stores the user''s selected primary financial goal and its details as a JSON object.';

-- Example of how you might update an existing user's financial_goal (optional, for testing)
-- UPDATE public.user_profiles
-- SET financial_goal = '{
--   "id": "buy_home",
--   "title": "Buy a Home",
--   "description": "Save for a down payment and secure a mortgage for a new home.",
--   "icon": "Home",
--   "customDetails": "Looking for a 3-bedroom house in the suburbs within 2 years."
-- }'
-- WHERE id = 'your-user-id'; -- Replace 'your-user-id' with an actual user ID
