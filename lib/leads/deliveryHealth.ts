import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  evaluateDeliveryCircuitBreaker,
  providerHasDeliveryTelemetry,
  type DeliveryCircuitBreaker,
} from '@/lib/leads/deliveryHealthCore'
import { getConfiguredOutboundProvider } from '@/lib/outreach/provider-preference'

export * from '@/lib/leads/deliveryHealthCore'

function envNumber(name: string, fallback: number) {
  const parsed = Number.parseFloat(process.env[name] || '')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function getDeliveryCircuitBreaker(options: {
  provider?: string
  allowControlledTrial?: boolean
  allowRecoveryCanary?: boolean
} = {}): Promise<DeliveryCircuitBreaker> {
  const admin = createAdminClient()
  const provider = String(options.provider || getConfiguredOutboundProvider()).trim().toLowerCase()
  const allowControlledTrial = options.allowControlledTrial !== false
  const trialBatchSize = Math.max(1, Math.round(envNumber('OUTREACH_CONTROLLED_TRIAL_BATCH_SIZE', 5)))
  const windowDays = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_WINDOW_DAYS', 7)))
  const threshold = Math.min(1, envNumber('OUTREACH_MAX_BAD_DELIVERY_RATE', 0.05))
  const minimumSample = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_MIN_SAMPLE', 20)))
  const globalFailureThreshold = Math.min(1, envNumber('OUTREACH_PROVIDER_MAX_FAILURE_RATE', 0.2))
  const globalMinimumSample = Math.max(1, Math.round(envNumber('OUTREACH_PROVIDER_MIN_SAMPLE', minimumSample)))
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const unavailable = (reason: string): DeliveryCircuitBreaker => ({
    allowed: false,
    broadSendingAllowed: false,
    recoveryCanaryAllowed: false,
    reason,
    mode: 'unavailable',
    provider,
    maxBatchSize: null,
    windowDays,
    threshold,
    sampleSize: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    suppressed: 0,
    failed: 0,
    badRate: 0,
    globalSampleSize: 0,
    globalFailed: 0,
    globalFailureRate: 0,
    providerGlobalHealthBlocked: false,
  })

  if (!providerHasDeliveryTelemetry(provider)) {
    return unavailable(
      provider === 'gmail'
        ? 'delivery_telemetry_unavailable: Gmail outbound has no final delivery, bounce, or complaint telemetry.'
        : `delivery_telemetry_unavailable: no telemetry integration exists for provider ${provider || 'none'}.`
    )
  }

  const [outreachResult, globalResult] = await Promise.all([
    admin
      .from('provider_delivery_events')
      .select('provider_message_id,delivery_status,occurred_at')
      .eq('provider', provider)
      .not('metadata_json->>outreachRecordType', 'is', null)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(10000),
    admin
      .from('provider_delivery_events')
      .select('provider_message_id,delivery_status,occurred_at')
      .eq('provider', provider)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(10000),
  ])

  if (outreachResult.error || globalResult.error) {
    return unavailable(
      `delivery_evidence_unavailable: ${outreachResult.error?.message || globalResult.error?.message || 'unknown provider evidence error'}`
    )
  }

  return evaluateDeliveryCircuitBreaker(outreachResult.data || [], {
    provider,
    windowDays,
    threshold,
    minimumSample,
    trialBatchSize,
    allowControlledTrial,
    allowRecoveryCanary: options.allowRecoveryCanary,
    globalRows: globalResult.data || [],
    globalFailureThreshold,
    globalMinimumSample,
  })
}
