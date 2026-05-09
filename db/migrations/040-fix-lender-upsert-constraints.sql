DROP INDEX IF EXISTS idx_lenders_source_external_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lenders_source_external_unique
  ON public.lenders(source, external_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lender_outreach_messages_lender_channel_unique
  ON public.lender_outreach_messages(lender_id, channel);
