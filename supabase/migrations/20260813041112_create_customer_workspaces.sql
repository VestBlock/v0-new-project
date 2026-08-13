CREATE TABLE IF NOT EXISTS public.customer_workspaces (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_lane TEXT CHECK (active_lane IS NULL OR active_lane IN ('capital', 'real-estate', 'opportunity', 'dealvault')),
  selected_scenario TEXT CHECK (selected_scenario IS NULL OR selected_scenario IN ('business', 'property', 'sell', 'readiness', 'participate')),
  criteria_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  questionnaire_progress_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  roadmap_status_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  profile_visibility TEXT NOT NULL DEFAULT 'private' CHECK (profile_visibility IN ('private', 'eligible-partners')),
  last_status_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS customer_workspaces_touch_updated_at ON public.customer_workspaces;
CREATE TRIGGER customer_workspaces_touch_updated_at
  BEFORE UPDATE ON public.customer_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.customer_workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_workspaces FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_workspaces TO service_role;

COMMENT ON TABLE public.customer_workspaces IS
  'Authenticated VestBlock customer workspace state. Customer access is mediated by authenticated same-origin server routes that always scope records to auth.uid().';
COMMENT ON COLUMN public.customer_workspaces.profile_visibility IS
  'Controls whether criteria may be considered for eligible partner routing. It never makes a profile public.';

ALTER TABLE public.next_move_questionnaires
  DROP CONSTRAINT IF EXISTS next_move_questionnaires_primary_path_check;

UPDATE public.next_move_questionnaires
SET primary_path = 'Real Estate'
WHERE primary_path = 'Deals';

ALTER TABLE public.next_move_questionnaires
  ADD CONSTRAINT next_move_questionnaires_primary_path_check
  CHECK (primary_path IN ('Capital', 'Real Estate', 'Opportunity'));
