-- Keep buyer packet activity honest: provider acceptance is not delivery.

ALTER TABLE property_buyer_packets
  DROP CONSTRAINT IF EXISTS property_buyer_packets_status_check;

ALTER TABLE property_buyer_packets
  ADD CONSTRAINT property_buyer_packets_status_check
  CHECK (status IN ('draft', 'ready', 'sending', 'accepted', 'sent', 'partial', 'failed', 'archived'));

ALTER TABLE property_buyer_packet_sends
  DROP CONSTRAINT IF EXISTS property_buyer_packet_sends_status_check;

ALTER TABLE property_buyer_packet_sends
  ADD CONSTRAINT property_buyer_packet_sends_status_check
  CHECK (status IN (
    'queued',
    'accepted',
    'sent',
    'delivered',
    'delivery_delayed',
    'opened',
    'replied',
    'interested',
    'rejected',
    'bounced',
    'complained',
    'suppressed',
    'failed'
  ));
