import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import type { DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealthCore'
import {
  configuredDailyStrategyOutputTarget,
  getDailyStrategyOutputLane,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'
import {
  evaluateOutreachThroughputGovernor,
  type OutreachThroughputGovernorDecision,
} from '@/lib/outreach/throughputGovernorCore'
import { createAdminClient } from '@/lib/supabase/admin'

export type OutreachThroughputAttemptKind = 'first_touch' | 'follow_up' | 'buyer_packet'
export type OutreachThroughputOutcome =
  | 'reserved'
  | 'accepted'
  | 'delivered'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'
  | 'cancelled'

export type OutreachThroughputReservation = {
  allowed: boolean
  reason: string | null
  reservationId?: string
  reservationToken?: string
  ownsReservation?: boolean
  cancellableByOwner?: boolean
  ownerLeaseExpiresAt?: string
  strategyKey: DailyStrategyOutputLaneKey
  laneTarget: number
  globalLimit: number
  decision: OutreachThroughputGovernorDecision
  globalAttemptCount?: number
  globalRemaining?: number
  laneAttemptCount?: number
  laneRemaining?: number
}

type StaleReservationRow = {
  id: string
  state: 'reserved'
  provider: string
  provider_message_id?: string | null
  idempotency_key: string
  reserved_at: string
  owner_lease_expires_at?: string | null
  metadata_json?: Record<string, unknown> | null
}

const RECONCILABLE_MESSAGE_TABLES = {
  lead: 'outreach_messages',
  buyer: 'buyer_outreach_messages',
  lender: 'lender_outreach_messages',
  investor: 'investor_outreach_messages',
} as const

type ReservationRpcResult = {
  allowed?: boolean
  reason?: string | null
  reservationId?: string
  ownsReservation?: boolean
  cancellableByOwner?: boolean
  ownerLeaseExpiresAt?: string
  authoritativeGlobalLimit?: number
  authoritativeLaneTarget?: number
  globalAttemptCount?: number
  globalRemaining?: number
  laneAttemptCount?: number
  laneRemaining?: number
}

type RampDecisionRpcResult = {
  applied?: boolean
  changed?: boolean
  reason?: string | null
  effectiveCap?: number
  evidenceWatermark?: number
  evidenceObservedAt?: string
  version?: number
}

function recipientHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function senderKey(provider: string, senderEmail: string) {
  return `${provider.trim().toLowerCase()}:${senderEmail.trim().toLowerCase()}`
}

function decisionFromBreaker(breaker: DeliveryCircuitBreaker, now: Date) {
  return evaluateOutreachThroughputGovernor({
    mode: breaker.mode,
    sampleSize: breaker.sampleSize,
    complained: breaker.complained,
    badRate: breaker.badRate,
    globalFailureRate: breaker.globalFailureRate,
    terminalCompleteness: breaker.terminalCompleteness,
    requestedDailyTarget: configuredDailyStrategyOutputTarget(),
    now,
  })
}

async function persistRampDecision(input: {
  provider: string
  senderEmail: string
  breaker: DeliveryCircuitBreaker
  decision: OutreachThroughputGovernorDecision
  mailboxFresh: boolean
  replyCaptureOperational: boolean
  lastSuccessfulMailboxSyncAt?: string | null
  now: Date
}) {
  const admin = createAdminClient()
  const key = senderKey(input.provider, input.senderEmail)
  const nowIso = input.now.toISOString()
  const evidenceObservedAt = input.breaker.evaluatedAt || nowIso
  const evidence = {
    evidenceWatermark: input.breaker.evidenceWatermark ?? null,
    deliveryMode: input.breaker.mode,
    sampleSize: input.breaker.sampleSize,
    delivered: input.breaker.delivered,
    bounced: input.breaker.bounced,
    complained: input.breaker.complained,
    suppressed: input.breaker.suppressed,
    failed: input.breaker.failed,
    badRate: input.breaker.badRate,
    globalSampleSize: input.breaker.globalSampleSize,
    globalFailureRate: input.breaker.globalFailureRate,
    terminalCompleteness: input.breaker.terminalCompleteness,
    mailboxFresh: input.mailboxFresh,
    replyCaptureOperational: input.replyCaptureOperational,
    lastSuccessfulMailboxSyncAt: input.lastSuccessfulMailboxSyncAt || null,
    decisionReason: input.decision.reason,
    businessDate: input.decision.allocationPlan.businessDate,
    allocationByKey: input.decision.allocationPlan.byKey,
  }
  const { data, error } = await admin.rpc('record_outreach_sender_ramp_decision', {
    p_sender_key: key,
    p_provider: input.provider,
    p_sender_email: input.senderEmail,
    p_stage: input.decision.stage,
    p_target_cap: Math.max(1, input.decision.requestedDailyTarget),
    p_effective_cap: input.decision.effectiveDailyCap,
    p_hold_reason: input.decision.effectiveDailyCap === 0 ? input.decision.reason : null,
    p_evidence: evidence,
    p_evidence_watermark: input.breaker.evidenceWatermark ?? null,
    p_evidence_observed_at: evidenceObservedAt,
  })
  if (error) throw error
  const result = (data || {}) as RampDecisionRpcResult
  const expectedConservativeRejection =
    result.reason === 'stale_or_non_conservative_ramp_decision' ||
    String(result.reason || '').startsWith('outreach_ramp_promotion_')
  if (result.applied !== true && !expectedConservativeRejection) {
    throw new Error(`Outreach ramp decision was not persisted: ${result.reason || 'unknown_reason'}`)
  }

  if (result.applied === true && result.changed === true) {
    const badCount =
      input.breaker.bounced +
      input.breaker.complained +
      input.breaker.suppressed +
      input.breaker.failed
    const { error: snapshotError } = await admin.from('outreach_health_snapshots').insert({
      sender_key: key,
      provider: input.provider,
      stage: input.decision.stage,
      effective_cap: input.decision.effectiveDailyCap,
      sample_size: input.breaker.sampleSize,
      delivered_count: input.breaker.delivered,
      bad_count: badCount,
      bad_rate: input.breaker.badRate,
      complaint_count: input.breaker.complained,
      provider_failure_rate: input.breaker.globalFailureRate,
      mailbox_fresh: input.mailboxFresh,
      suppression_ready: true,
      evidence_json: {
        deliveryMode: input.breaker.mode,
        reason: input.decision.reason,
        evidenceWatermark: input.breaker.evidenceWatermark ?? null,
        evidenceObservedAt,
        mailboxFreshnessMeasured: true,
        replyCaptureOperational: input.replyCaptureOperational,
        lastSuccessfulMailboxSyncAt: input.lastSuccessfulMailboxSyncAt || null,
      },
      observed_at: evidenceObservedAt,
    })
    if (snapshotError) throw snapshotError
  }

  return result
}

export async function reserveOutreachThroughputAttempt(input: {
  breaker: DeliveryCircuitBreaker
  strategyKey: DailyStrategyOutputLaneKey
  messageId: string
  idempotencyKey: string
  recipientEmail: string
  provider: string
  senderEmail: string
  attemptKind: OutreachThroughputAttemptKind
  mailboxFresh: boolean
  replyCaptureOperational: boolean
  lastSuccessfulMailboxSyncAt?: string | null
  metadata?: Record<string, unknown>
  now?: Date
}): Promise<OutreachThroughputReservation> {
  const now = input.now || new Date()
  const lane = getDailyStrategyOutputLane(input.strategyKey)
  if (!lane) {
    throw new Error(`Unknown canonical outreach strategy: ${input.strategyKey}`)
  }

  const decision = decisionFromBreaker(input.breaker, now)
  const laneTarget = decision.allocationPlan.byKey[input.strategyKey]
  const denied = (reason: string): OutreachThroughputReservation => ({
    allowed: false,
    reason,
    strategyKey: input.strategyKey,
    laneTarget,
    globalLimit: decision.effectiveDailyCap,
    decision,
  })

  await persistRampDecision({
    provider: input.provider,
    senderEmail: input.senderEmail,
    breaker: input.breaker,
    decision,
    mailboxFresh: input.mailboxFresh,
    replyCaptureOperational: input.replyCaptureOperational,
    lastSuccessfulMailboxSyncAt: input.lastSuccessfulMailboxSyncAt,
    now,
  })

  if (decision.effectiveDailyCap < 1) return denied(`outreach_throughput_hold: ${decision.reason}`)
  if (laneTarget < 1) {
    return denied(
      `outreach_strategy_not_scheduled_today: ${input.strategyKey} has no slot at the current ${decision.effectiveDailyCap}/day ramp stage`
    )
  }

  const admin = createAdminClient()
  const reservationToken = randomUUID()
  const { data, error } = await admin.rpc('reserve_outreach_throughput_attempt', {
    p_strategy_key: input.strategyKey,
    p_lane_target: laneTarget,
    p_global_rolling_limit: decision.effectiveDailyCap,
    p_message_id: input.messageId,
    p_idempotency_key: input.idempotencyKey,
    p_recipient_hash: recipientHash(input.recipientEmail),
    p_provider: input.provider,
    p_sender_email: input.senderEmail,
    p_reservation_token: reservationToken,
    p_attempt_kind: input.attemptKind,
    p_metadata: {
      ...(input.metadata || {}),
      businessDate: decision.allocationPlan.businessDate,
      dailyTarget: decision.requestedDailyTarget,
      rampStage: decision.stage,
      globalLimit: decision.effectiveDailyCap,
      laneTarget,
    },
  })
  if (error) throw error
  const result = (data || {}) as ReservationRpcResult
  const authoritativeLaneTarget = Number.isFinite(Number(result.authoritativeLaneTarget))
    ? Math.max(0, Number(result.authoritativeLaneTarget))
    : laneTarget
  const authoritativeGlobalLimit = Number.isFinite(Number(result.authoritativeGlobalLimit))
    ? Math.max(0, Number(result.authoritativeGlobalLimit))
    : decision.effectiveDailyCap
  const ownsReservation = result.ownsReservation === true
  const allowed = result.allowed === true && ownsReservation
  return {
    allowed,
    reason:
      result.allowed === true && !ownsReservation
        ? 'outreach_reservation_ownership_not_confirmed'
        : result.reason || null,
    reservationId: result.reservationId,
    reservationToken: allowed ? reservationToken : undefined,
    ownsReservation,
    cancellableByOwner: result.cancellableByOwner === true,
    ownerLeaseExpiresAt: result.ownerLeaseExpiresAt,
    strategyKey: input.strategyKey,
    laneTarget: authoritativeLaneTarget,
    globalLimit: authoritativeGlobalLimit,
    decision,
    globalAttemptCount: result.globalAttemptCount,
    globalRemaining: result.globalRemaining,
    laneAttemptCount: result.laneAttemptCount,
    laneRemaining: result.laneRemaining,
  }
}

export async function recordOutreachThroughputOutcome(input: {
  reservationId: string
  reservationToken?: string
  state: OutreachThroughputOutcome
  providerMessageId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_outreach_throughput_outcome', {
    p_reservation_id: input.reservationId,
    p_reservation_token: input.reservationToken || null,
    p_state: input.state,
    p_provider_message_id: input.providerMessageId || null,
    p_metadata: input.metadata || {},
  })
  if (error) throw error
  return data
}

export async function recordOutreachThroughputProviderOutcome(input: {
  provider: string
  providerMessageId: string
  state: OutreachThroughputOutcome
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data: reservation, error } = await admin
    .from('outreach_attempt_reservations')
    .select('id')
    .eq('provider', input.provider)
    .eq('provider_message_id', input.providerMessageId)
    .maybeSingle()
  if (error) throw error
  if (!reservation?.id) return { updated: false, reason: 'outreach_attempt_not_found' }
  return recordOutreachThroughputOutcome({
    reservationId: reservation.id,
    state: input.state,
    providerMessageId: input.providerMessageId,
    metadata: input.metadata,
  })
}

/**
 * Repairs the narrow crash window after a message is claimed and throughput is
 * reserved but before the provider result is persisted. Within Resend's
 * idempotency window the original message is safely re-opened with the same
 * identity. Ambiguous attempts older than that window are quarantined instead
 * of risking a duplicate send.
 */
export async function reconcileStaleOutreachReservations(input: {
  now?: Date
  staleAfterMinutes?: number
  limit?: number
} = {}) {
  const now = input.now || new Date()
  const staleAfterMinutes = Math.max(5, Math.floor(input.staleAfterMinutes || 15))
  const limit = Math.min(500, Math.max(1, Math.floor(input.limit || 250)))
  const staleBefore = new Date(now.getTime() - staleAfterMinutes * 60_000).toISOString()
  const idempotencyDeadline = now.getTime() - 23 * 60 * 60 * 1_000
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_attempt_reservations')
    .select('id,state,provider,provider_message_id,idempotency_key,reserved_at,owner_lease_expires_at,metadata_json')
    .eq('state', 'reserved')
    .lt('reserved_at', staleBefore)
    .lt('owner_lease_expires_at', now.toISOString())
    .order('reserved_at', { ascending: true })
    .limit(limit)
  if (error) throw error

  const summary = {
    inspected: 0,
    restored: 0,
    alreadyRetriable: 0,
    acceptedRecovered: 0,
    quarantined: 0,
    unresolved: 0,
  }

  for (const reservation of (data || []) as StaleReservationRow[]) {
    summary.inspected += 1
    const metadata = reservation.metadata_json || {}
    const scope = String(metadata.scope || '').trim()
    const sourceMessageId = String(metadata.sourceMessageId || '').trim()
    const insideIdempotencyWindow = Date.parse(reservation.reserved_at) >= idempotencyDeadline

    if (reservation.provider_message_id) {
      await recordOutreachThroughputOutcome({
        reservationId: reservation.id,
        state: 'accepted',
        providerMessageId: reservation.provider_message_id,
        metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'provider_message_present' },
      })
      summary.acceptedRecovered += 1
      continue
    }

    if (scope === 'buyer-packet') {
      const { data: packetSend, error: packetError } = await admin
        .from('property_buyer_packet_sends')
        .select('id,status,sent_at,provider_message_id')
        .contains('metadata_json', { idempotencyKey: reservation.idempotency_key })
        .limit(1)
        .maybeSingle()
      if (packetError) throw packetError
      if (packetSend?.provider_message_id || packetSend?.sent_at) {
        await recordOutreachThroughputOutcome({
          reservationId: reservation.id,
          state: 'accepted',
          providerMessageId: packetSend.provider_message_id || null,
          metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'buyer_packet_accepted' },
        })
        summary.acceptedRecovered += 1
      } else if (insideIdempotencyWindow) {
        summary.alreadyRetriable += 1
      } else {
        if (packetSend?.id) {
          const { error: quarantineError } = await admin
            .from('property_buyer_packet_sends')
            .update({
              status: 'failed',
              send_error: 'Ambiguous provider attempt exceeded the safe idempotency retry window.',
              updated_at: now.toISOString(),
            })
            .eq('id', packetSend.id)
            .eq('status', 'queued')
          if (quarantineError) throw quarantineError
        }
        await recordOutreachThroughputOutcome({
          reservationId: reservation.id,
          state: 'failed',
          metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'idempotency_window_expired' },
        })
        summary.quarantined += 1
      }
      continue
    }

    const table = RECONCILABLE_MESSAGE_TABLES[scope as keyof typeof RECONCILABLE_MESSAGE_TABLES]
    if (!table || !sourceMessageId) {
      if (!insideIdempotencyWindow) {
        await recordOutreachThroughputOutcome({
          reservationId: reservation.id,
          state: 'failed',
          metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'source_identity_missing' },
        })
        summary.quarantined += 1
      } else {
        summary.unresolved += 1
      }
      continue
    }

    const { data: message, error: messageError } = await admin
      .from(table)
      .select('id,status,sent_at,metadata_json')
      .eq('id', sourceMessageId)
      .maybeSingle()
    if (messageError) throw messageError

    const messageMetadata = (message?.metadata_json || {}) as Record<string, unknown>
    const providerMessageId = String(messageMetadata.providerMessageId || messageMetadata.resendId || '').trim()
    if (message?.sent_at || ['sent', 'accepted', 'delivered'].includes(String(message?.status || ''))) {
      await recordOutreachThroughputOutcome({
        reservationId: reservation.id,
        state: 'accepted',
        providerMessageId: providerMessageId || null,
        metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'source_message_accepted' },
      })
      summary.acceptedRecovered += 1
      continue
    }

    if (insideIdempotencyWindow) {
      if (message?.status === 'queued') {
        const { data: restored, error: restoreError } = await admin
          .from(table)
          .update({
            status: 'approved',
            send_error: 'Recovered an interrupted provider attempt; retry retains the original idempotency key.',
            updated_at: now.toISOString(),
          })
          .eq('id', sourceMessageId)
          .eq('status', 'queued')
          .is('sent_at', null)
          .select('id')
          .maybeSingle()
        if (restoreError) throw restoreError
        if (restored?.id) summary.restored += 1
        else summary.unresolved += 1
      } else if (message?.status === 'approved') {
        summary.alreadyRetriable += 1
      } else {
        summary.unresolved += 1
      }
      continue
    }

    if (message?.id && ['queued', 'approved'].includes(String(message.status || ''))) {
      const { error: quarantineError } = await admin
        .from(table)
        .update({
          status: 'needs_review',
          send_error: 'Ambiguous provider attempt exceeded the safe idempotency retry window; generate a new message before retrying.',
          updated_at: now.toISOString(),
        })
        .eq('id', sourceMessageId)
        .in('status', ['queued', 'approved'])
        .is('sent_at', null)
      if (quarantineError) throw quarantineError
    }
    await recordOutreachThroughputOutcome({
      reservationId: reservation.id,
      state: 'failed',
      metadata: { staleReservationReconciledAt: now.toISOString(), reconciliation: 'idempotency_window_expired' },
    })
    summary.quarantined += 1
  }

  return summary
}
