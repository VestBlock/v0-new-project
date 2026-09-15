import { createHash } from 'node:crypto'

export type OutboundSendIdentity = {
  idempotencyKey: string
  correlationId: string
  scope: string
  entityId: string
  messageId: string
  sequenceStep: number
}

export type ResendOutreachTag = {
  name: string
  value: string
}

function stablePart(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function buildOutboundSendIdentity(input: {
  scope: string
  entityId: string
  messageId: string
  sequenceStep?: number
}): OutboundSendIdentity {
  const scope = stablePart(input.scope) || 'outreach'
  const sequenceStep = Math.max(1, Math.trunc(input.sequenceStep || 1))
  const digest = createHash('sha256')
    .update(['vestblock-outbound-v1', scope, stablePart(input.entityId), stablePart(input.messageId), sequenceStep].join(':'))
    .digest('hex')

  return {
    idempotencyKey: `vestblock-${digest}`,
    correlationId: `vbo_${digest.slice(0, 32)}`,
    scope,
    entityId: stablePart(input.entityId),
    messageId: stablePart(input.messageId),
    sequenceStep,
  }
}

function resendTagValue(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 256)
  return normalized || fallback
}

function resendTagReference(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url').slice(0, 256) || 'dW5rbm93bg'
}

/**
 * Resend copies these tags into delivery webhooks. They provide a durable
 * identity fallback when a provider webhook wins the race against the local
 * post-send database update.
 */
export function buildResendOutreachTags(identity: OutboundSendIdentity): ResendOutreachTag[] {
  return [
    { name: 'vb_scope', value: resendTagValue(identity.scope, 'outreach') },
    { name: 'vb_entity', value: resendTagValue(identity.entityId, 'unknown') },
    { name: 'vb_message', value: resendTagReference(identity.messageId) },
    { name: 'vb_correlation', value: resendTagValue(identity.correlationId, 'unknown') },
    { name: 'vb_idempotency', value: resendTagValue(identity.idempotencyKey, 'unknown') },
    { name: 'vb_step', value: resendTagValue(identity.sequenceStep, '1') },
  ]
}

export function outboundIdentityMetadata(identity: OutboundSendIdentity) {
  return {
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    sendScope: identity.scope,
    entityId: identity.entityId,
    sourceMessageId: identity.messageId,
    sequenceStep: identity.sequenceStep,
  }
}
