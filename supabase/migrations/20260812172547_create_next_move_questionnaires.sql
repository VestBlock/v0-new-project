-- Gate 3 public Next-Move intake and privacy lifecycle.
-- All customer writes go through a server-only Supabase client. No public role
-- receives direct access to questionnaire data.

CREATE TABLE IF NOT EXISTS public.next_move_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  phone TEXT,
  focus TEXT NOT NULL CHECK (focus IN (
    'business-funding', 'real-estate-funding', 'grants', 'business-credit',
    'sell-property', 'buy-property', 'fund-deal', 'business-acquisition',
    'builder-developer', 'improve-credit', 'increase-income', 'start-business',
    'grow-business', 'visibility'
  )),
  primary_path TEXT NOT NULL CHECK (primary_path IN ('Capital', 'Deals', 'Opportunity')),
  timeline TEXT NOT NULL CHECK (timeline IN ('now', '30-days', '90-days', 'exploring')),
  current_position TEXT NOT NULL CHECK (current_position IN ('starting', 'preparing', 'active', 'stalled')),
  credit_range TEXT NOT NULL CHECK (credit_range IN (
    'unknown', 'below-580', '580-669', '670-739', '740-plus', 'prefer-not-to-say'
  )),
  weekly_time TEXT NOT NULL CHECK (weekly_time IN ('under-3', '3-7', '8-plus')),
  main_obstacle TEXT NOT NULL,
  goal_details TEXT,
  analysis_consent BOOLEAN NOT NULL CHECK (analysis_consent = TRUE),
  analysis_consented_at TIMESTAMPTZ NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consented_at TIMESTAMPTZ,
  follow_up_requested BOOLEAN NOT NULL DEFAULT FALSE,
  operator_task_status TEXT NOT NULL DEFAULT 'not_required' CHECK (operator_task_status IN ('not_required', 'created', 'failed')),
  operator_task_id UUID REFERENCES public.admin_tasks(id) ON DELETE SET NULL,
  attribution_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  roadmap_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  roadmap_model TEXT NOT NULL DEFAULT 'deterministic' CHECK (roadmap_model IN ('deterministic', 'ai-refined')),
  ai_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (ai_status IN ('not_requested', 'completed', 'fallback')),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  confirmation_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (confirmation_status IN ('not_requested', 'accepted', 'failed', 'skipped')),
  confirmation_provider TEXT,
  confirmation_message_id TEXT,
  export_count INTEGER NOT NULL DEFAULT 0,
  last_exported_at TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_next_move_questionnaires_email_created
  ON public.next_move_questionnaires(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_next_move_questionnaires_path_created
  ON public.next_move_questionnaires(primary_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_next_move_questionnaires_lead
  ON public.next_move_questionnaires(lead_id);

DROP TRIGGER IF EXISTS next_move_questionnaires_touch_updated_at ON public.next_move_questionnaires;
CREATE TRIGGER next_move_questionnaires_touch_updated_at
  BEFORE UPDATE ON public.next_move_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.vestblock_touch_updated_at();

ALTER TABLE public.next_move_questionnaires ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.next_move_questionnaires FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.next_move_questionnaires TO service_role;

COMMENT ON TABLE public.next_move_questionnaires IS
  'Private public-intake records. Access is server-side only; public export and deletion require the high-entropy token whose hash is stored here.';
COMMENT ON COLUMN public.next_move_questionnaires.public_token_hash IS
  'SHA-256 hash of the one-time public lifecycle token. Plaintext is returned once and never persisted.';
