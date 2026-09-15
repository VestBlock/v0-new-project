import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  evaluateDeliveryCircuitBreaker,
  providerHasDeliveryTelemetry,
  type DeliveryCircuitBreaker,
} from '@/lib/leads/deliveryHealthCore'
import {
  getConfiguredOutboundProvider,
  getConfiguredOutboundSender,
} from '@/lib/outreach/provider-preference'

export * from '@/lib/leads/deliveryHealthCore'

function envNumber(name: string, fallback: number) {
  const parsed = Number.parseFloat(process.env[name] || '')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function getDeliveryCircuitBreaker(options: {
  provider?: string
  senderEmail?: string
  allowControlledTrial?: boolean
  allowRecoveryCanary?: boolean
} = {}): Promise<DeliveryCircuitBreaker> {
  const admin = createAdminClient()
  const provider = String(options.provider || getConfiguredOutboundProvider()).trim().toLowerCase()
  const senderEmail = String(options.senderEmail || getConfiguredOutboundSender()).trim().toLowerCase()
  let evaluatedAt = new Date().toISOString()
  let evidenceWatermark: number | null = null
  const allowControlledTrial = options.allowControlledTrial !== false
  const trialBatchSize = Math.max(1, Math.round(envNumber('OUTREACH_CONTROLLED_TRIAL_BATCH_SIZE', 5)))
  const windowDays = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_WINDOW_DAYS', 7)))
  const threshold = Math.min(1, envNumber('OUTREACH_MAX_BAD_DELIVERY_RATE', 0.05))
  const minimumSample = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_MIN_SAMPLE', 20)))
  const globalFailureThreshold = Math.min(1, envNumber('OUTREACH_PROVIDER_MAX_FAILURE_RATE', 0.2))
  const globalMinimumSample = Math.max(1, Math.round(envNumber('OUTREACH_PROVIDER_MIN_SAMPLE', minimumSample)))
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

  const unavailable = (reason: string): DeliveryCircuitBreaker => ({
    evaluatedAt,
    evidenceWatermark,
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
    terminalCompleteness: null,
  })

  if (!providerHasDeliveryTelemetry(provider)) {
    return unavailable(
      provider === 'gmail'
        ? 'delivery_telemetry_unavailable: Gmail outbound has no final delivery, bounce, or complaint telemetry.'
        : `delivery_telemetry_unavailable: no telemetry integration exists for provider ${provider || 'none'}.`
    )
  }

  // Capture a database clock + monotonic evidence watermark before any of the
  // independent evidence reads begin. The persistence RPC later verifies that
  // this watermark is still current while holding the same advisory lock used
  // by evidence writers. An event committed anywhere in the read/persist gap
  // therefore makes a promotion fail closed instead of looking newer merely
  // because its worker completed later.
  const watermarkResult = await admin.rpc('get_outreach_delivery_evidence_watermark', {
    p_provider: provider,
  })
  if (watermarkResult.error) {
    return unavailable(`delivery_evidence_watermark_unavailable: ${watermarkResult.error.message}`)
  }
  const watermarkPayload = (watermarkResult.data || {}) as {
    ok?: boolean
    evidenceWatermark?: number
    observedAt?: string
  }
  const parsedWatermark = Number(watermarkPayload.evidenceWatermark)
  const parsedObservedAt = Date.parse(String(watermarkPayload.observedAt || ''))
  if (
    watermarkPayload.ok !== true ||
    !Number.isSafeInteger(parsedWatermark) ||
    parsedWatermark < 0 ||
    !Number.isFinite(parsedObservedAt)
  ) {
    return unavailable('delivery_evidence_watermark_unavailable: invalid database watermark response')
  }
  evidenceWatermark = parsedWatermark
  evaluatedAt = new Date(parsedObservedAt).toISOString()

  const matureBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const [outreachResult, globalResult, attemptResult, globalAttemptResult] = await Promise.all([
    admin
      .from('provider_delivery_events')
      .select('provider_message_id,delivery_status,occurred_at')
      .eq('provider', provider)
      .eq('sender_email', senderEmail)
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
    admin
      .from('outreach_attempt_reservations')
      .select('id,state,provider_message_id,reserved_at')
      .eq('provider', provider)
      .eq('sender_email', senderEmail)
      .neq('state', 'cancelled')
      .gte('reserved_at', since)
      .limit(10000),
    admin
      .from('outreach_attempt_reservations')
      .select('id,state,provider_message_id,reserved_at')
      .eq('provider', provider)
      .neq('state', 'cancelled')
      .gte('reserved_at', since)
      .limit(10000),
  ])

  if (outreachResult.error || globalResult.error || attemptResult.error || globalAttemptResult.error) {
    return unavailable(
      `delivery_evidence_unavailable: ${outreachResult.error?.message || globalResult.error?.message || attemptResult.error?.message || globalAttemptResult.error?.message || 'unknown provider evidence error'}`
    )
  }

  const failedReservationEvidence = (attemptResult.data || [])
    .filter((row) => String(row.state || '') === 'failed')
    .map((row) => ({
      provider_message_id: String(row.provider_message_id || `reservation:${row.id}`),
      delivery_status: 'failed',
      occurred_at: String(row.reserved_at || matureBefore),
    }))
  const outreachEvidence = [...(outreachResult.data || []), ...failedReservationEvidence]
  const globalFailedReservationEvidence = (globalAttemptResult.data || [])
    .filter((row) => String(row.state || '') === 'failed')
    .map((row) => ({
      provider_message_id: String(row.provider_message_id || `reservation:${row.id}`),
      delivery_status: 'failed',
      occurred_at: String(row.reserved_at || matureBefore),
    }))
  const globalEvidence = [...(globalResult.data || []), ...globalFailedReservationEvidence]
  const decision = evaluateDeliveryCircuitBreaker(outreachEvidence, {
    provider,
    windowDays,
    threshold,
    minimumSample,
    trialBatchSize,
    allowControlledTrial,
    allowRecoveryCanary: options.allowRecoveryCanary,
    globalRows: globalEvidence,
    globalFailureThreshold,
    globalMinimumSample,
  })
  const matureAttemptIds = new Set(
    (attemptResult.data || [])
      .filter((row) => Date.parse(String(row.reserved_at || '')) <= Date.parse(matureBefore))
      .map((row) => String(row.provider_message_id || `reservation:${row.id}`).trim())
      .filter(Boolean)
  )
  const terminalAttemptIds = new Set(
    globalEvidence
      .filter((row) => ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed'].includes(String(row.delivery_status || '')))
      .map((row) => String(row.provider_message_id || '').trim())
      .filter((messageId) => matureAttemptIds.has(messageId))
  )
  return {
    ...decision,
    evaluatedAt,
    evidenceWatermark,
    terminalCompleteness:
      matureAttemptIds.size >= minimumSample
        ? terminalAttemptIds.size / matureAttemptIds.size
        : null,
  }
}
