import 'server-only'

import { getDeliveryCircuitBreaker, type DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import {
  acquireOutreachDeliveryPermit,
  releaseOutreachDeliveryPermit,
  type OutreachDeliveryPermit,
} from '@/lib/outreach/deliveryBudget'
import type { OutboundEmailProvider } from '@/lib/outreach/provider-preference'

export type GuardedDeliveryAttempt = {
  allowed: boolean
  breaker: DeliveryCircuitBreaker
  permit: OutreachDeliveryPermit
  reason?: string
}

export async function acquireGuardedDeliveryAttempt(input: {
  provider: OutboundEmailProvider
  scope: string
  messageId: string
  recoveryCanary?: boolean
}): Promise<GuardedDeliveryAttempt> {
  const breaker = await getDeliveryCircuitBreaker({
    provider: input.provider,
    allowControlledTrial: true,
    allowRecoveryCanary: input.recoveryCanary === true,
  })
  if (!breaker.allowed) {
    return {
      allowed: false,
      breaker,
      permit: { allowed: false, counted: false, reason: breaker.reason || 'delivery_circuit_blocked' },
      reason: breaker.reason || 'delivery_circuit_blocked',
    }
  }

  const permit = await acquireOutreachDeliveryPermit({
    mode: breaker.mode,
    scope: input.scope,
    messageId: input.messageId,
  })
  return {
    allowed: permit.allowed,
    breaker,
    permit,
    reason: permit.allowed ? undefined : permit.reason || 'global_delivery_budget_blocked',
  }
}

export async function releaseGuardedDeliveryAttempt(
  attempt: GuardedDeliveryAttempt,
  outcome: 'accepted' | 'failed' | 'not_sent'
) {
  await releaseOutreachDeliveryPermit(attempt.permit, outcome)
}
