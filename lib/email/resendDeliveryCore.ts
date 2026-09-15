export type ResendDeliveryIdentitySource = {
  id?: string | null
  recordType?: string | null
  metadata_json?: Record<string, unknown> | null
}

export type ResendProjectionStatus =
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'
  | 'opened'
  | 'clicked'

export type ResendProjectionEvent = {
  provider_event_id: string
  delivery_status: ResendProjectionStatus
  reason?: string | null
  occurred_at: string
  created_at?: string | null
}

export type ResendOutreachIdentityTags = {
  scope: string
  entityId: string
  messageId: string
  correlationId: string
  idempotencyKey: string
  sequenceStep: number
  recordType: 'lead_outreach' | 'buyer_outreach' | 'lender_outreach' | 'investor_outreach' | 'buyer_packet_outreach'
}

const RESEND_SCOPE_RECORD_TYPES: Record<string, ResendOutreachIdentityTags['recordType']> = {
  lead: 'lead_outreach',
  buyer: 'buyer_outreach',
  lender: 'lender_outreach',
  investor: 'investor_outreach',
  'buyer-packet': 'buyer_packet_outreach',
}

const RESEND_PROJECTION_PRECEDENCE: Record<ResendProjectionStatus, number> = {
  queued: 10,
  accepted: 20,
  delivery_delayed: 25,
  delivered: 30,
  opened: 40,
  clicked: 45,
  failed: 70,
  bounced: 80,
  suppressed: 90,
  complained: 100,
}

const PERSISTED_OUTREACH_STATUS_PRECEDENCE: Record<string, number> = {
  new: 0,
  qualified: 0,
  needs_review: 0,
  approved: 5,
  queued: 10,
  accepted: 20,
  sent: 20,
  contacted: 20,
  delivery_delayed: 25,
  delivered: 30,
  opened: 40,
  clicked: 45,
  responded: 60,
  replied: 60,
  interested: 65,
  failed: 70,
  bounced: 80,
  suppressed: 90,
  complained: 100,
  do_not_contact: 100,
  cancelled: 1_000,
}

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function decodeTagReference(value: string) {
  try {
    return Buffer.from(value, 'base64url').toString('utf8').trim()
  } catch {
    return ''
  }
}

/** Parses only tags emitted by VestBlock's guarded outbound senders. */
export function parseResendOutreachIdentityTags(tags: unknown): ResendOutreachIdentityTags | null {
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return null
  const values = tags as Record<string, unknown>
  const scope = String(values.vb_scope || '').trim().toLowerCase()
  const entityId = String(values.vb_entity || '').trim().toLowerCase()
  const messageId = decodeTagReference(String(values.vb_message || '').trim()).toLowerCase()
  const correlationId = String(values.vb_correlation || '').trim()
  const idempotencyKey = String(values.vb_idempotency || '').trim()
  const sequenceStep = Number.parseInt(String(values.vb_step || ''), 10)
  const recordType = RESEND_SCOPE_RECORD_TYPES[scope]

  if (
    !recordType ||
    !entityId ||
    !messageId ||
    !/^vbo_[a-f0-9]{32}$/i.test(correlationId) ||
    !/^vestblock-[a-f0-9]{64}$/i.test(idempotencyKey) ||
    !Number.isFinite(sequenceStep) ||
    sequenceStep < 1
  ) return null

  return {
    scope,
    entityId,
    messageId,
    correlationId,
    idempotencyKey,
    sequenceStep,
    recordType,
  }
}

/**
 * Selects the canonical projection for an email. Negative terminal outcomes
 * always win; otherwise the most advanced delivery state wins. Event time is
 * the tie-breaker so late retries cannot regress command-center truth.
 */
export function selectResendDeliveryProjection(events: ResendProjectionEvent[]) {
  return [...events].sort((left, right) => {
    const precedence =
      RESEND_PROJECTION_PRECEDENCE[right.delivery_status] -
      RESEND_PROJECTION_PRECEDENCE[left.delivery_status]
    if (precedence !== 0) return precedence
    const occurred = timestamp(right.occurred_at) - timestamp(left.occurred_at)
    if (occurred !== 0) return occurred
    return timestamp(right.created_at) - timestamp(left.created_at)
  })[0] || null
}

/**
 * Returns the persisted states that a webhook projection may safely replace.
 * Every projection write uses this as a compare-and-set predicate, so two
 * concurrent webhook workers cannot let a lower-ranked delivery event erase a
 * bounce, complaint, suppression, or reply written by the other worker.
 */
export function deliveryProjectionAllowedCurrentStatuses(next: ResendProjectionStatus) {
  const nextRank = RESEND_PROJECTION_PRECEDENCE[next]
  return Object.entries(PERSISTED_OUTREACH_STATUS_PRECEDENCE)
    .filter(([, rank]) => rank <= nextRank)
    .map(([status]) => status)
}

export function buildResendDeliveryIdentityMetadata(input: {
  leadOutreach?: ResendDeliveryIdentitySource | null
  partnerOutreach?: ResendDeliveryIdentitySource | null
  buyerPacketSend?: ResendDeliveryIdentitySource | null
  webhookTags?: ResendOutreachIdentityTags | null
}) {
  const source = input.leadOutreach?.id
    ? { ...input.leadOutreach, recordType: 'lead_outreach' }
    : input.partnerOutreach?.id
      ? input.partnerOutreach
      : input.buyerPacketSend?.id
        ? { ...input.buyerPacketSend, recordType: 'buyer_packet_outreach' }
        : null
  const idempotencyKey = String(source?.metadata_json?.idempotencyKey || input.webhookTags?.idempotencyKey || '').trim()
  const correlationId = String(source?.metadata_json?.correlationId || input.webhookTags?.correlationId || '').trim()
  const recordType = source?.recordType || input.webhookTags?.recordType
  const recordId = source?.id || input.webhookTags?.messageId

  return {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(correlationId ? { correlationId } : {}),
    ...(recordType ? { outreachRecordType: recordType } : {}),
    ...(recordId ? { outreachRecordId: recordId } : {}),
    ...(input.webhookTags?.scope ? { outreachScope: input.webhookTags.scope } : {}),
    ...(input.webhookTags?.entityId ? { outreachEntityId: input.webhookTags.entityId } : {}),
  }
}
