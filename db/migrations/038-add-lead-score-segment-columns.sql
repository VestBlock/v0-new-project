ALTER TABLE lead_scores
  ADD COLUMN IF NOT EXISTS urgency_level TEXT,
  ADD COLUMN IF NOT EXISTS contactability_level TEXT,
  ADD COLUMN IF NOT EXISTS language_segment TEXT,
  ADD COLUMN IF NOT EXISTS outreach_angle TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value_label TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_scores_language_segment
  ON lead_scores(language_segment);
