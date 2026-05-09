CREATE TABLE IF NOT EXISTS service_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  package_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'completed', 'failed')),
  title text,
  summary text,
  preview_text text,
  deliverable_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  deliverable_markdown text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_service_deliverables_package_key
  ON service_deliverables(package_key);

CREATE INDEX IF NOT EXISTS idx_service_deliverables_status
  ON service_deliverables(status);

CREATE INDEX IF NOT EXISTS idx_service_deliverables_generated_at
  ON service_deliverables(generated_at DESC);

DROP TRIGGER IF EXISTS on_service_deliverables_updated ON service_deliverables;
CREATE TRIGGER on_service_deliverables_updated
  BEFORE UPDATE ON service_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE service_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view service deliverables" ON service_deliverables;
CREATE POLICY "Admins can view service deliverables"
  ON service_deliverables FOR SELECT
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert service deliverables" ON service_deliverables;
CREATE POLICY "Admins can insert service deliverables"
  ON service_deliverables FOR INSERT
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update service deliverables" ON service_deliverables;
CREATE POLICY "Admins can update service deliverables"
  ON service_deliverables FOR UPDATE
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

GRANT SELECT, INSERT, UPDATE ON service_deliverables TO authenticated;
GRANT ALL ON service_deliverables TO service_role;
