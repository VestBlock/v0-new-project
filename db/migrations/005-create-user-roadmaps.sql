-- Create user_roadmaps table
CREATE TABLE IF NOT EXISTS public.user_roadmaps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- financial_goal_id TEXT, -- Optional: if you want to link to a specific goal from a goals table
    -- For simplicity, the goal details can be part of the context when roadmap was generated
    -- or stored within roadmap_data if needed.
    roadmap_data jsonb NOT NULL, -- Stores the array of roadmap steps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_roadmaps ENABLE ROW LEVEL SECURITY;

-- Policies for user_roadmaps
CREATE POLICY "Users can view their own roadmaps"
ON public.user_roadmaps
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roadmaps"
ON public.user_roadmaps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own roadmaps"
ON public.user_roadmaps
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roadmaps"
ON public.user_roadmaps
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update "updated_at" timestamp
CREATE OR REPLACE FUNCTION handle_roadmap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_roadmaps_update
BEFORE UPDATE ON public.user_roadmaps
FOR EACH ROW
EXECUTE FUNCTION handle_roadmap_updated_at();

COMMENT ON TABLE public.user_roadmaps IS 'Stores personalized financial roadmaps generated for users.';
COMMENT ON COLUMN public.user_roadmaps.roadmap_data IS 'JSONB containing an array of roadmap steps, each with title, description, etc.';
