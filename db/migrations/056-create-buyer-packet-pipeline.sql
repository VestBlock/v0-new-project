CREATE TABLE IF NOT EXISTS property_buyer_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_analysis_run_id UUID REFERENCES property_analysis_runs(id) ON DELETE SET NULL,
  property_address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  packet_type TEXT NOT NULL DEFAULT 'buyer_disposition'
    CHECK (packet_type IN ('buyer_disposition', 'builder_disposition', 'lender_review')),
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('draft', 'ready', 'sending', 'sent', 'partial', 'failed', 'archived')),
  title TEXT NOT NULL DEFAULT 'VestBlock Buyer Packet',
  summary TEXT,
  file_name TEXT,
  selected_buyer_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  opportunity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_buyer_packet_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_packet_id UUID NOT NULL REFERENCES property_buyer_packets(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id) ON DELETE SET NULL,
  buyer_match_id UUID REFERENCES buyer_matches(id) ON DELETE SET NULL,
  buyer_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'opened', 'replied', 'interested', 'rejected', 'failed')),
  send_provider TEXT,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  send_error TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_pipeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_analysis_run_id UUID REFERENCES property_analysis_runs(id) ON DELETE SET NULL,
  buyer_packet_id UUID REFERENCES property_buyer_packets(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  current_stage TEXT NOT NULL DEFAULT 'analyzed'
    CHECK (
      current_stage IN (
        'new_lead',
        'contacted',
        'replied',
        'analyzed',
        'offer_sent',
        'under_contract',
        'buyer_packet_sent',
        'buyer_interested',
        'assignment_drafted',
        'closed_won',
        'closed_lost',
        'archived'
      )
    ),
  stage_label TEXT NOT NULL DEFAULT 'Analyzed',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deal_grade TEXT,
  deal_strength_score INTEGER,
  buyer_packet_sent_count INTEGER NOT NULL DEFAULT 0,
  buyer_reply_count INTEGER NOT NULL DEFAULT 0,
  estimated_assignment_fee NUMERIC,
  expected_profit NUMERIC,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_buyer_packets_status
  ON property_buyer_packets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_buyer_packets_analysis
  ON property_buyer_packets(property_analysis_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_buyer_packet_sends_packet
  ON property_buyer_packet_sends(buyer_packet_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_buyer_packet_sends_buyer
  ON property_buyer_packet_sends(buyer_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_buyer_packet_sends_unique_buyer
  ON property_buyer_packet_sends(buyer_packet_id, buyer_id)
  WHERE buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_items_stage
  ON deal_pipeline_items(current_stage, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_items_packet
  ON deal_pipeline_items(buyer_packet_id);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_items_analysis
  ON deal_pipeline_items(property_analysis_run_id);

CREATE TRIGGER property_buyer_packets_touch_updated_at
  BEFORE UPDATE ON property_buyer_packets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER property_buyer_packet_sends_touch_updated_at
  BEFORE UPDATE ON property_buyer_packet_sends
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER deal_pipeline_items_touch_updated_at
  BEFORE UPDATE ON deal_pipeline_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE property_buyer_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_buyer_packet_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_pipeline_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN
    SELECT unnest(ARRAY[
      'property_buyer_packets',
      'property_buyer_packet_sends',
      'deal_pipeline_items'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can view %s" ON public.%I FOR SELECT TO authenticated USING (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can insert %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can update %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Admins can update %s" ON public.%I FOR UPDATE TO authenticated USING (private.vestblock_is_admin()) WITH CHECK (private.vestblock_is_admin())', table_name, table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON property_buyer_packets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON property_buyer_packet_sends TO authenticated;
GRANT SELECT, INSERT, UPDATE ON deal_pipeline_items TO authenticated;
GRANT ALL ON property_buyer_packets TO service_role;
GRANT ALL ON property_buyer_packet_sends TO service_role;
GRANT ALL ON deal_pipeline_items TO service_role;
