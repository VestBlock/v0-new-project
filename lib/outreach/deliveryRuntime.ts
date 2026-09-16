import {
  routeDeliveryPurpose,
  type DeliveryPurposeDecision,
  type DeliveryPurposeInput,
} from '@/lib/outreach/deliveryPurposeCore'

export type PurposeBoundProviderAvailability = {
  gmail: boolean
  resend: boolean
  outlook?: boolean
}

export const PURPOSE_BOUND_EMAIL_PROVIDER = 'outlook' as const

export type PurposeBoundDeliveryAction =
  | 'send_outlook'
  | 'hold_non_email'
  | 'hold_provider_unavailable'

export type PurposeBoundDeliveryDecision = {
  allowed: boolean
  action: PurposeBoundDeliveryAction
  provider: 'outlook' | 'none'
  deferredScope: 'lane' | 'infrastructure'
  error: string | null
  policy: DeliveryPurposeDecision
}

export function assertPurposeBoundBreakerProvider(
  provider: string,
  breaker?: { provider?: string | null } | null
) {
  if (!breaker) return

  const expectedProvider = String(provider || '').trim().toLowerCase()
  const breakerProvider = String(breaker.provider || '').trim().toLowerCase()
  if (expectedProvider && breakerProvider === expectedProvider) return

  throw new Error(
    `delivery_circuit_provider_mismatch: expected ${expectedProvider || 'none'}, received ${breakerProvider || 'none'}`
  )
}

/**
 * Binds the delivery-purpose policy to the providers the current application
 * can actually execute. Outlook is the only active email provider. Resend and
 * Gmail may remain configured as dormant infrastructure but are never an
 * automatic fallback when Outlook is unavailable or acceptance is ambiguous.
 */
export function resolvePurposeBoundOutboundProvider(
  input: DeliveryPurposeInput,
  availability: PurposeBoundProviderAvailability
): PurposeBoundDeliveryDecision {
  const policy = routeDeliveryPurpose(input)

  if (policy.disposition === 'hold_non_email') {
    return {
      allowed: false,
      action: 'hold_non_email',
      provider: 'none',
      deferredScope: 'lane',
      error: `Email delivery held by purpose policy (${policy.reason}).`,
      policy,
    }
  }

  if (!availability.outlook) {
    return {
      allowed: false,
      action: 'hold_provider_unavailable',
      provider: 'none',
      deferredScope: 'infrastructure',
      error: 'Outlook is required by delivery-purpose policy but Microsoft Graph is not configured.',
      policy,
    }
  }

  return {
    allowed: true,
    action: 'send_outlook',
    provider: PURPOSE_BOUND_EMAIL_PROVIDER,
    deferredScope: 'infrastructure',
    error: null,
    policy,
  }
}
