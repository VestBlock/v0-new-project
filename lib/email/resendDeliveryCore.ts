export type ResendDeliveryIdentitySource = {
  id?: string | null
  recordType?: string | null
  metadata_json?: Record<string, unknown> | null
}

export function buildResendDeliveryIdentityMetadata(input: {
  leadOutreach?: ResendDeliveryIdentitySource | null
  partnerOutreach?: ResendDeliveryIdentitySource | null
  buyerPacketSend?: ResendDeliveryIdentitySource | null
}) {
  const source = input.leadOutreach?.id
    ? { ...input.leadOutreach, recordType: 'lead_outreach' }
    : input.partnerOutreach?.id
      ? input.partnerOutreach
      : input.buyerPacketSend?.id
        ? { ...input.buyerPacketSend, recordType: 'buyer_packet_outreach' }
        : null
  const idempotencyKey = String(source?.metadata_json?.idempotencyKey || '').trim()
  const correlationId = String(source?.metadata_json?.correlationId || '').trim()

  return {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(source?.recordType ? { outreachRecordType: source.recordType } : {}),
    ...(source?.id ? { outreachRecordId: source.id } : {}),
  }
}
