import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type DeliveryCircuitBreaker = {
  allowed: boolean
  reason: string | null
  mode: 'healthy' | 'controlled_trial' | 'blocked' | 'unavailable'
  provider: string
  maxBatchSize: number | null
  windowDays: number
  threshold: number
  sampleSize: number
  delivered: number
  bounced: number
  complained: number
  suppressed: number
  failed: number
  badRate: number
}

function envNumber(name: string, fallback: number) {
  const parsed = Number.parseFloat(process.env[name] || '')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function getDeliveryCircuitBreaker(options: {
  provider?: string
  allowControlledTrial?: boolean
} = {}): Promise<DeliveryCircuitBreaker> {
  const admin = createAdminClient()
  const provider = String(options.provider || process.env.OUTREACH_DELIVERY_PROVIDER || 'resend').trim().toLowerCase()
  const allowControlledTrial = options.allowControlledTrial !== false
  const trialBatchSize = Math.max(1, Math.round(envNumber('OUTREACH_CONTROLLED_TRIAL_BATCH_SIZE', 5)))
  const windowDays = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_WINDOW_DAYS', 7)))
  const threshold = Math.min(1, envNumber('OUTREACH_MAX_BAD_DELIVERY_RATE', 0.05))
  const minimumSample = Math.max(1, Math.round(envNumber('OUTREACH_DELIVERY_MIN_SAMPLE', 20)))
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('provider_delivery_events')
    .select('provider_message_id,delivery_status,occurred_at')
    .eq('provider', provider)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(10000)

  if (error) {
    return {
      allowed: false,
      reason: `delivery_evidence_unavailable: ${error.message}`,
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
    }
  }

  const latestByMessage = new Map<string, string>()
  for (const row of data || []) {
    if (!latestByMessage.has(row.provider_message_id)) {
      latestByMessage.set(row.provider_message_id, row.delivery_status)
    }
  }

  const terminal = Array.from(latestByMessage.values()).filter((status) =>
    ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'suppressed', 'failed'].includes(status)
  )
  const count = (status: string) => terminal.filter((value) => value === status).length
  const delivered = terminal.filter((status) => ['delivered', 'opened', 'clicked'].includes(status)).length
  const bounced = count('bounced')
  const complained = count('complained')
  const suppressed = count('suppressed')
  const failed = count('failed')
  const bad = bounced + complained + suppressed + failed
  const badRate = terminal.length ? bad / terminal.length : 0
  const hasEvidence = terminal.length >= minimumSample
  const qualityBlocked = bad > 0 && badRate > threshold
  const controlledTrial = !hasEvidence && !qualityBlocked && allowControlledTrial
  const allowed = !qualityBlocked && (hasEvidence || controlledTrial)
  const mode: DeliveryCircuitBreaker['mode'] = qualityBlocked
    ? 'blocked'
    : hasEvidence
      ? 'healthy'
      : controlledTrial
        ? 'controlled_trial'
        : 'blocked'

  return {
    allowed,
    reason: qualityBlocked
      ? `bad_delivery_rate: ${(badRate * 100).toFixed(1)}% exceeds ${(threshold * 100).toFixed(1)}%`
      : controlledTrial
        ? `controlled_trial: ${terminal.length}/${minimumSample} finalized messages; cap each run at ${trialBatchSize}`
        : hasEvidence
          ? null
          : `insufficient_delivery_evidence: ${terminal.length}/${minimumSample}`,
    mode,
    provider,
    maxBatchSize: controlledTrial ? trialBatchSize : null,
    windowDays,
    threshold,
    sampleSize: terminal.length,
    delivered,
    bounced,
    complained,
    suppressed,
    failed,
    badRate,
  }
}
