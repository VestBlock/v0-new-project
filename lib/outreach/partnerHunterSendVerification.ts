import 'server-only'

import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import type { DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealthCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import {
  ensureFreshHunterSendVerificationForEntity,
  type HunterSendVerificationResult,
} from '@/lib/outreach/hunterSendVerification'
import {
  classifyHunterVerificationFailureScope,
  deriveHunterSendVerificationLimits,
  hashHunterVerificationEmail,
} from '@/lib/outreach/hunterSendVerificationCore'
import { readOutreachDispatchCapacity } from '@/lib/outreach/outreachDispatchCapacity'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { getOutreachRecipientGuard, type OutreachRecipientScope } from '@/lib/outreach/suppression'
import { configuredDailyStrategyOutputTarget, type DailyStrategyOutputLaneKey } from '@/lib/outreach/dailyStrategyOutputCore'
import { evaluateOutreachThroughputGovernor } from '@/lib/outreach/throughputGovernorCore'
import { getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import type { OutboundEmailProvider } from '@/lib/outreach/provider-preference'
import { createAdminClient } from '@/lib/supabase/admin'

export type PartnerHunterVerificationScope = Exclude<OutreachRecipientScope, 'lead'>
export type HunterVerificationDeferredScope = 'record' | 'lane' | 'global' | 'infrastructure'

type PartnerHunterEntity = {
  id: string
  contact_email: string | null | undefined
  metadata_json: Record<string, unknown> | null | undefined
}

export type PartnerHunterSendPreflightResult = {
  allowed: boolean
  status: HunterSendVerificationResult['status'] | 'not_required'
  source: HunterSendVerificationResult['source'] | 'followup_evidence'
  reason: string
  deferredScope?: HunterVerificationDeferredScope
  creditReserved: boolean
  dailyBudgetRemaining?: number
  cache?: HunterSendVerificationResult['cache']
}

const PARTNER_MESSAGE_STORAGE = {
  buyer: {
    table: 'buyer_outreach_messages',
    entityColumn: 'buyer_id',
    emailChannelColumn: 'channel',
    emailChannelValue: ['email_intro', 'email_followup', 'spanish_email'],
  },
  lender: {
    table: 'lender_outreach_messages',
    entityColumn: 'lender_id',
    emailChannelColumn: 'channel',
    emailChannelValue: ['email_intro', 'email_followup', 'spanish_email'],
  },
  investor: {
    table: 'investor_outreach_messages',
    entityColumn: 'investor_profile_id',
    emailChannelColumn: 'channel',
    emailChannelValue: ['email'],
  },
} as const

function envNonNegativeInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

async function hasPriorAcceptedPartnerEmail(input: {
  scope: PartnerHunterVerificationScope
  entityId: string
  messageId: string
  email: string
}) {
  const storage = PARTNER_MESSAGE_STORAGE[input.scope]
  const admin = createAdminClient()
  const recipientHash = hashHunterVerificationEmail(input.email)
  const entityMetadataKey = input.scope === 'buyer'
    ? 'buyerId'
    : input.scope === 'lender'
      ? 'lenderId'
      : 'investorId'
  const [messageResult, enrollmentResult, packetResult] = await Promise.all([
    admin
      .from(storage.table)
      .select('id')
      .eq(storage.entityColumn, input.entityId)
      .in(storage.emailChannelColumn, [...storage.emailChannelValue])
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .neq('id', input.messageId)
      .contains('metadata_json', { acceptedRecipientHash: recipientHash })
      .limit(1)
      .maybeSingle(),
    admin
      .from('command_center_outbound_enrollments')
      .select('id')
      .eq('channel', 'email')
      .eq('recipient_hash', recipientHash)
      .contains('metadata_json', { [entityMetadataKey]: input.entityId })
      .in('status', ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
      .limit(1)
      .maybeSingle(),
    input.scope === 'buyer'
      ? admin
          .from('property_buyer_packet_sends')
          .select('buyer_email')
          .eq('buyer_id', input.entityId)
          .in('status', ['accepted', 'sent', 'delivered', 'opened', 'replied', 'interested'])
          .not('sent_at', 'is', null)
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (messageResult.error) throw messageResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (packetResult.error) throw packetResult.error
  const packetRecipientMatches = (packetResult.data || []).some(
    (row) => hashHunterVerificationEmail(String(row.buyer_email || '')) === recipientHash
  )
  return Boolean(messageResult.data?.id || enrollmentResult.data?.id || packetRecipientMatches)
}

function blocked(input: {
  reason: string
  deferredScope: HunterVerificationDeferredScope
  status?: PartnerHunterSendPreflightResult['status']
  source?: PartnerHunterSendPreflightResult['source']
  creditReserved?: boolean
  dailyBudgetRemaining?: number
  cache?: HunterSendVerificationResult['cache']
}): PartnerHunterSendPreflightResult {
  return {
    allowed: false,
    status: input.status || 'unverified',
    source: input.source || 'blocked',
    reason: input.reason,
    deferredScope: input.deferredScope,
    creditReserved: Boolean(input.creditReserved),
    dailyBudgetRemaining: input.dailyBudgetRemaining,
    cache: input.cache,
  }
}

export async function preflightPartnerHunterSendVerification(input: {
  scope: PartnerHunterVerificationScope
  entity: PartnerHunterEntity
  messageId: string
  strategyKey: Extract<DailyStrategyOutputLaneKey, 'buyers' | 'lenders' | 'investors'>
  provider: OutboundEmailProvider
  isFollowup: boolean
  deliveryCircuitBreaker?: DeliveryCircuitBreaker
  allowNetwork?: boolean
  now?: Date
}): Promise<PartnerHunterSendPreflightResult> {
  try {
    const replyCapture = await getOperationalReplyCaptureReadiness({ now: input.now })
    if (!replyCapture.ready) {
      return blocked({ reason: 'hunter_preflight_reply_capture_not_operational', deferredScope: 'infrastructure' })
    }
    if (!getCommercialOutreachMailingAddress()) {
      return blocked({ reason: 'hunter_preflight_mailing_address_missing', deferredScope: 'infrastructure' })
    }
    if (input.provider === 'none') {
      return blocked({ reason: 'hunter_preflight_provider_unavailable', deferredScope: 'infrastructure' })
    }
    if (!isUsableContactEmail(input.entity.contact_email)) {
      return blocked({ reason: 'hunter_verification_email_unusable', deferredScope: 'record' })
    }

    const recipientGuard = await getOutreachRecipientGuard({
      scope: input.scope,
      entityId: input.entity.id,
      email: input.entity.contact_email,
    })
    if (!recipientGuard.allowed) {
      return blocked({ reason: recipientGuard.reason, deferredScope: 'record' })
    }

    if (input.isFollowup && await hasPriorAcceptedPartnerEmail({
      scope: input.scope,
      entityId: input.entity.id,
      messageId: input.messageId,
      email: input.entity.contact_email || '',
    })) {
      return {
        allowed: true,
        status: 'not_required',
        source: 'followup_evidence',
        reason: 'prior_accepted_partner_email',
        creditReserved: false,
      }
    }

    const cached = await ensureFreshHunterSendVerificationForEntity({
      scope: input.scope,
      entity: {
        id: input.entity.id,
        email: input.entity.contact_email,
        metadata_json: input.entity.metadata_json,
      },
      messageId: input.messageId,
      allowNetwork: false,
      dailyLimit: 0,
      now: input.now,
    })
    if (cached.source === 'cache') {
      return cached.sendable && cached.status === 'valid'
        ? { ...cached, allowed: true }
        : blocked({
            reason: cached.reason,
            deferredScope: 'record',
            status: cached.status,
            source: cached.source,
            cache: cached.cache,
          })
    }
    if (input.allowNetwork === false) {
      return blocked({ reason: 'hunter_verification_run_budget_exhausted', deferredScope: 'lane' })
    }

    const breaker = input.deliveryCircuitBreaker || await getDeliveryCircuitBreaker({
      provider: input.provider,
      allowControlledTrial: true,
    })
    const throughput = evaluateOutreachThroughputGovernor({
      mode: breaker.mode,
      sampleSize: breaker.sampleSize,
      complained: breaker.complained,
      badRate: breaker.badRate,
      globalFailureRate: breaker.globalFailureRate,
      terminalCompleteness: breaker.terminalCompleteness,
      requestedDailyTarget: configuredDailyStrategyOutputTarget(),
      now: input.now,
    })
    if (!breaker.allowed || throughput.effectiveDailyCap < 1) {
      return blocked({
        reason: breaker.reason || throughput.reason || 'hunter_preflight_delivery_gate_closed',
        deferredScope: breaker.mode === 'unavailable' ? 'infrastructure' : 'global',
      })
    }

    const capacity = await readOutreachDispatchCapacity(throughput, input.now)
    const laneRemaining = Math.max(0, Number(capacity.remainingByLane[input.strategyKey] || 0))
    const limits = deriveHunterSendVerificationLimits({
      effectiveDailyCap: throughput.effectiveDailyCap,
      requestedSendLimit: 1,
      globalRemaining: capacity.globalRemaining,
      leadLaneRemaining: laneRemaining,
      configuredDailyLimit: envNonNegativeInt(
        'HUNTER_SEND_VERIFICATION_DAILY_LIMIT',
        throughput.effectiveDailyCap
      ),
      configuredPerRunLimit: 1,
    })
    if (limits.perRunLimit < 1) {
      return blocked({
        reason: capacity.globalRemaining < 1
          ? 'hunter_verification_global_capacity_exhausted'
          : 'hunter_verification_lane_capacity_exhausted',
        deferredScope: capacity.globalRemaining < 1 ? 'global' : 'lane',
      })
    }

    const verification = await ensureFreshHunterSendVerificationForEntity({
      scope: input.scope,
      entity: {
        id: input.entity.id,
        email: input.entity.contact_email,
        metadata_json: input.entity.metadata_json,
      },
      messageId: input.messageId,
      allowNetwork: true,
      dailyLimit: limits.dailyLimit,
      now: input.now,
    })
    if (verification.sendable && verification.status === 'valid') {
      return { ...verification, allowed: true }
    }

    const reason = verification.reason || `hunter_${verification.status}_blocked`
    const deferredScope = classifyHunterVerificationFailureScope(reason)
    return blocked({
      reason,
      deferredScope,
      status: verification.status,
      source: verification.source,
      creditReserved: verification.creditReserved,
      dailyBudgetRemaining: verification.dailyBudgetRemaining,
      cache: verification.cache,
    })
  } catch {
    return blocked({ reason: 'hunter_verification_safety_unavailable', deferredScope: 'infrastructure' })
  }
}
