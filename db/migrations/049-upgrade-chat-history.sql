ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS assistant_type TEXT NOT NULL DEFAULT 'vestbot',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.chat_history
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_history_user_updated_at
  ON public.chat_history(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_chat_history_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_history_touch_updated_at ON public.chat_history;
CREATE TRIGGER chat_history_touch_updated_at
  BEFORE UPDATE ON public.chat_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_chat_history_updated_at();

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update their own chat history" ON public.chat_history;
CREATE POLICY "Users can update their own chat history"
  ON public.chat_history FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.chat_history TO authenticated;
GRANT ALL ON public.chat_history TO service_role;
