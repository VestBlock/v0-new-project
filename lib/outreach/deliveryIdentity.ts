import { createHash } from 'node:crypto'

export type OutboundSendIdentity = {
  idempotencyKey: string
  correlationId: string
  scope: string
  sequenceStep: number
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
    sequenceStep,
  }
}

export function outboundIdentityMetadata(identity: OutboundSendIdentity) {
  return {
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    sendScope: identity.scope,
    sequenceStep: identity.sequenceStep,
  }
}
