import { createHash } from 'node:crypto'

export const OUTLOOK_TRANSACTIONAL_DISPATCH_STATES = [
  'dispatching',
  'accepted',
  'acceptance_unknown',
  'failed_pre_dispatch',
  'failed_dispatch',
  'reconciled_accepted',
  'reconciled_not_sent',
] as const

export type OutlookTransactionalDispatchState =
  (typeof OUTLOOK_TRANSACTIONAL_DISPATCH_STATES)[number]

export type OutlookTransactionalDispatchIdentity = {
  idempotencyKeyHash: string
  payloadHash: string
  recipientHash: string
  correlationId: string
  effectiveIdempotencyKey: string
  idempotencyKeySource: 'caller' | 'payload_fingerprint'
  eventType: string
}

export type OutlookTransactionalDispatchClaim =
  | {
      action: 'send'
      dispatchId: string
      dispatchToken: string
      state: 'dispatching'
      graphMessageId?: string | null
      internetMessageId?: string | null
    }
  | {
      action: 'deduplicated_accepted'
      dispatchId: string
      dispatchToken: null
      state: 'accepted' | 'reconciled_accepted'
      graphMessageId?: string | null
      internetMessageId?: string | null
    }
  | {
      action: 'reconciliation_required'
      dispatchId: string
      dispatchToken: null
      state: 'dispatching' | 'acceptance_unknown' | 'failed_dispatch'
      graphMessageId?: string | null
      internetMessageId?: string | null
    }
  | {
      action: 'identity_conflict'
      dispatchId: string | null
      dispatchToken: null
      state: OutlookTransactionalDispatchState | null
      graphMessageId?: string | null
      internetMessageId?: string | null
    }

export type OutlookTransactionalDispatchOutcome =
  | 'accepted'
  | 'acceptance_unknown'
  | 'failed_pre_dispatch'
  | 'failed_dispatch'

export type OutlookDispatchFileAttachment = {
  filename: string
  contentBase64: string
  contentType: string
}

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`
}

function normalizedRecipients(to: string) {
  return Array.from(
    new Set(
      String(to || '')
        .split(',')
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort()
}

/**
 * Produces a privacy-preserving, stable identity for one logical message.
 * When an upstream workflow does not supply a key, the exact payload becomes
 * the key. Callers that intentionally repeat identical content must supply a
 * unique business-event key for each intended delivery.
 */
export function buildOutlookTransactionalDispatchIdentity(input: {
  to: string
  subject: string
  html: string
  replyTo: string
  eventType: string
  idempotencyKey?: string | null
  correlationId?: string | null
  attachments?: readonly OutlookDispatchFileAttachment[] | null
}): OutlookTransactionalDispatchIdentity {
  const recipients = normalizedRecipients(input.to)
  if (recipients.length === 0) {
    throw new Error('Outlook transactional dispatch requires at least one recipient.')
  }

  const eventType = String(input.eventType || '').trim()
  if (!eventType || eventType.length > 160) {
    throw new Error('Outlook transactional dispatch requires a valid event type.')
  }

  const payloadHash = sha256(
    canonicalJson({
      recipients,
      subject: String(input.subject || ''),
      html: String(input.html || ''),
      replyTo: String(input.replyTo || '').trim().toLowerCase(),
      eventType,
      attachments: (input.attachments || []).map((attachment) => ({
        filename: String(attachment.filename || ''),
        contentType: String(attachment.contentType || ''),
        contentHash: sha256(String(attachment.contentBase64 || '')),
      })),
    })
  )
  const callerKey = String(input.idempotencyKey || '').trim()
  if (callerKey.length > 500) {
    throw new Error('Outlook transactional idempotency key exceeds 500 characters.')
  }
  const idempotencyKeySource = callerKey ? 'caller' : 'payload_fingerprint'
  const effectiveIdempotencyKey = callerKey || `vestblock-outlook-payload-${payloadHash}`
  const idempotencyKeyHash = sha256(
    `vestblock:outlook:transactional:idempotency:v1:${effectiveIdempotencyKey}`
  )
  const suppliedCorrelationId = String(input.correlationId || '').trim()
  const correlationId = CORRELATION_ID_PATTERN.test(suppliedCorrelationId)
    ? suppliedCorrelationId
    : `vestblock-${idempotencyKeyHash.slice(0, 40)}`

  return {
    idempotencyKeyHash,
    payloadHash,
    recipientHash: sha256(recipients.join(',')),
    correlationId,
    effectiveIdempotencyKey,
    idempotencyKeySource,
    eventType,
  }
}

export function isOutlookTransactionalDispatchState(
  value: unknown
): value is OutlookTransactionalDispatchState {
  return OUTLOOK_TRANSACTIONAL_DISPATCH_STATES.includes(
    String(value || '') as OutlookTransactionalDispatchState
  )
}
