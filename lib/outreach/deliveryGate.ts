import 'server-only'

import { getDeliveryCircuitBreaker, type DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import {
  acquireOutreachDeliveryPermit,
  releaseOutreachDeliveryPermit,
  type OutreachDeliveryPermit,
} from '@/lib/outreach/deliveryBudget'
import type { DailyStrategyOutputLaneKey } from '@/lib/outreach/dailyStrategyOutputCore'
import type { OutboundEmailProvider } from '@/lib/outreach/provider-preference'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  recordOutreachThroughputOutcome,
  reserveOutreachThroughputAttempt,
  type OutreachThroughputAttemptKind,
  type OutreachThroughputReservation,
} from '@/lib/outreach/throughputGovernor'

export type GuardedDeliveryAttempt = {
  allowed: boolean
  breaker: DeliveryCircuitBreaker
  permit: OutreachDeliveryPermit
  throughput: OutreachThroughputReservation | null
  reason?: string
}

export async function acquireGuardedDeliveryAttempt(input: {
  provider: OutboundEmailProvider
  breaker?: DeliveryCircuitBreaker
  scope: string
  messageId: string
  idempotencyKey: string
  strategyKey: DailyStrategyOutputLaneKey
  recipientEmail: string
  senderEmail: string
  attemptKind: OutreachThroughputAttemptKind
  recoveryCanary?: boolean
}): Promise<GuardedDeliveryAttempt> {
  const replyCapture = await getOperationalReplyCaptureReadiness()
  if (!replyCapture.ready) {
    throw new Error(
      replyCapture.reason ||
        `Reply capture for ${replyCapture.mailbox} does not have a recent successful inbound sync.`
    )
  }

  const breaker = input.breaker ??
    await getDeliveryCircuitBreaker({
      provider: input.provider,
      senderEmail: input.senderEmail,
      allowControlledTrial: true,
      allowRecoveryCanary: input.recoveryCanary === true,
    })
  const throughput = await reserveOutreachThroughputAttempt({
    breaker,
    strategyKey: input.strategyKey,
    messageId: `${input.scope}:${input.messageId}:${input.attemptKind}`,
    idempotencyKey: input.idempotencyKey,
    recipientEmail: input.recipientEmail,
    provider: input.provider,
    senderEmail: input.senderEmail,
    attemptKind: input.attemptKind,
    mailboxFresh: replyCapture.syncFresh,
    replyCaptureOperational: replyCapture.operational,
    lastSuccessfulMailboxSyncAt: replyCapture.lastSuccessfulSyncAt,
    metadata: {
      scope: input.scope,
      sourceMessageId: input.messageId,
      recoveryCanary: input.recoveryCanary === true,
    },
  })
  if (!throughput.allowed) {
    return {
      allowed: false,
      breaker,
      permit: { allowed: false, counted: false, reason: breaker.reason || 'delivery_circuit_blocked' },
      throughput,
      reason: throughput.reason || breaker.reason || 'delivery_circuit_blocked',
    }
  }

  const permit = await acquireOutreachDeliveryPermit({
    mode: breaker.mode,
    scope: input.scope,
    messageId: input.messageId,
  })
  if (
    !permit.allowed &&
    throughput.reservationId &&
    throughput.reservationToken &&
    throughput.cancellableByOwner
  ) {
    await recordOutreachThroughputOutcome({
      reservationId: throughput.reservationId,
      reservationToken: throughput.reservationToken,
      state: 'cancelled',
      metadata: { reason: permit.reason || 'global_delivery_budget_blocked' },
    })
  }
  return {
    allowed: permit.allowed,
    breaker,
    permit,
    throughput,
    reason: permit.allowed ? undefined : permit.reason || 'global_delivery_budget_blocked',
  }
}

export async function releaseGuardedDeliveryAttempt(
  attempt: GuardedDeliveryAttempt,
  outcome: 'accepted' | 'failed' | 'not_sent',
  providerMessageId?: string | null
) {
  await Promise.all([
    releaseOutreachDeliveryPermit(attempt.permit, outcome),
    attempt.throughput?.reservationId
      ? outcome === 'not_sent'
        ? Promise.resolve()
        : recordOutreachThroughputOutcome({
          reservationId: attempt.throughput.reservationId,
          reservationToken: attempt.throughput.reservationToken,
          state: outcome === 'accepted' ? 'accepted' : 'failed',
          providerMessageId,
          metadata: { deliveryAttemptOutcome: outcome },
        })
      : Promise.resolve(),
  ])
}
