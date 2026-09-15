import { Resend } from 'resend'
import { getStrategyDeliveryAttribution } from '@/lib/admin/strategyDelivery'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { evaluateOutreachV2Lead } from '@/lib/leads/outreachV2'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  getOutboundProviderAvailability,
  getOutboundSenderForProvider,
  getPreferredOutboundProvider,
} from '@/lib/outreach/provider-preference'
import {
  buildOutboundSendIdentity,
  buildResendOutreachTags,
  type OutboundSendIdentity,
} from '@/lib/outreach/deliveryIdentity'
import { acquireGuardedDeliveryAttempt, releaseGuardedDeliveryAttempt } from '@/lib/outreach/deliveryGate'
import {
  configuredDailyStrategyOutputTarget,
  getDailyStrategyOutputLane,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import type { DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealthCore'
import { ensureFreshHunterSendVerification } from '@/lib/outreach/hunterSendVerification'
import {
  classifyHunterVerificationFailureScope,
  deriveHunterSendVerificationLimits,
} from '@/lib/outreach/hunterSendVerificationCore'
import { readOutreachDispatchCapacity } from '@/lib/outreach/outreachDispatchCapacity'
import { evaluateOutreachThroughputGovernor } from '@/lib/outreach/throughputGovernorCore'
import { createAdminClient } from '@/lib/supabase/admin'

type SendLeadEmailInput = {
  lead: LeadRecord
  message: OutreachMessageRecord
  sequenceStep?: number
  deliveryCircuitBreaker?: DeliveryCircuitBreaker
}

type PreparedLeadEmailInput = SendLeadEmailInput & { identity: OutboundSendIdentity }

type SendLeadEmailResult = {
  ok: boolean
  deferred?: boolean
  deferredScope?: 'record' | 'lane' | 'global' | 'infrastructure'
  provider: 'gmail' | 'resend' | 'none'
  providerMessageId?: string | null
  idempotencyKey?: string
  correlationId?: string
  error?: string
}

const DEFAULT_OUTREACH_SENDER = 'acquisitions@vestblock.io'

function envNonNegativeInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function buildEmailBodyWithComplianceNote(message: OutreachMessageRecord) {
  const body = String(message.body || '').trim()
  const complianceNote = buildLeadOutreachComplianceBlock(message)
  if (!complianceNote) return body

  const normalizedBody = body.toLowerCase()
  const normalizedNote = complianceNote.toLowerCase()
  if (normalizedBody.includes(normalizedNote)) return body

  return body ? `${body}\n\n${complianceNote}` : complianceNote
}

function getOutreachMailingAddress() {
  return (
    process.env.OUTREACH_MAILING_ADDRESS ||
    process.env.BUSINESS_MAILING_ADDRESS ||
    process.env.COMPANY_MAILING_ADDRESS ||
    process.env.PUBLIC_BUSINESS_ADDRESS ||
    ''
  ).trim()
}

function buildLeadOutreachComplianceBlock(message: OutreachMessageRecord) {
  const note = String(message.compliance_note || '').trim()
  const mailingAddress = getOutreachMailingAddress()
  const parts = [note || 'If this is not relevant, reply and we will not contact you again.']
  if (mailingAddress) parts.push(`VestBlock mailing address: ${mailingAddress}`)

  return parts.filter(Boolean).join('\n')
}

function getWorkspaceSender() {
  return getOutboundSenderForProvider('gmail')
}

function getReplyToEmail() {
  return process.env.OUTREACH_REPLY_TO_EMAIL || DEFAULT_OUTREACH_SENDER
}

function getResendSender() {
  return getOutboundSenderForProvider('resend')
}

async function resolveLeadThroughputStrategy(
  lead: LeadRecord,
  message: OutreachMessageRecord
): Promise<DailyStrategyOutputLaneKey | null> {
  const attribution = await getStrategyDeliveryAttribution(lead.id).catch(() => null)
  const evaluation = evaluateOutreachV2Lead(lead, message.subject || '')
  const candidates = [
    attribution?.strategy_key,
    lead.market_segment,
    evaluation.segmentKey,
  ]

  for (const candidate of candidates) {
    const lane = getDailyStrategyOutputLane(String(candidate || ''))
    if (lane && lane.group !== 'partner') return lane.key
  }
  return null
}

async function hasPriorAcceptedLeadEmailEvidence(leadId: string, email: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_send_events')
    .select('recipient,status')
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .in('status', ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'suppressed'])
    .limit(500)
  if (error) throw error

  const currentRecipient = normalizeEmailAddress(email)
  const recipientEvents = (data || []).filter(
    (event) => normalizeEmailAddress(event.recipient) === currentRecipient
  )
  const terminalBlock = recipientEvents.some((event) =>
    ['bounced', 'complained', 'suppressed'].includes(String(event.status || ''))
  )
  return !terminalBlock && recipientEvents.some((event) =>
    ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'].includes(String(event.status || ''))
  )
}

export function getOutboundProviderReadiness() {
  const availability = getOutboundProviderAvailability()
  const defaultProvider = getPreferredOutboundProvider(availability)
  return {
    ...availability,
    defaultProvider,
    sender: getOutboundSenderForProvider(defaultProvider),
    mailingAddressConfigured: Boolean(getOutreachMailingAddress()),
  }
}

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token refresh failed with ${response.status}.`)
  }

  const data = await response.json()
  if (!data.access_token) {
    throw new Error('Google token refresh did not return an access token.')
  }

  return data.access_token as string
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sendWithGmail(input: PreparedLeadEmailInput): Promise<SendLeadEmailResult> {
  const accessToken = await getGoogleAccessToken()
  const from = getWorkspaceSender()
  const to = input.lead.email
  const body = buildEmailBodyWithComplianceNote(input.message)

  if (!isUsableContactEmail(to)) {
    return {
      ok: false,
      provider: 'gmail',
      error: 'Lead does not have a usable email address.',
      idempotencyKey: input.identity.idempotencyKey,
      correlationId: input.identity.correlationId,
    }
  }

  const mime = [
    `From: VestBlock <${from}>`,
    `Reply-To: ${getReplyToEmail()}`,
    `To: ${to}`,
    `Subject: ${input.message.subject || 'VestBlock follow-up'}`,
    `Message-ID: <${input.identity.correlationId}@vestblock.io>`,
    `X-VestBlock-Correlation-ID: ${input.identity.correlationId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodeBase64Url(mime),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'gmail',
      error: typeof data?.error?.message === 'string' ? data.error.message : `Gmail send failed with ${response.status}.`,
      idempotencyKey: input.identity.idempotencyKey,
      correlationId: input.identity.correlationId,
    }
  }

  return {
    ok: true,
    provider: 'gmail',
    providerMessageId: data.id || null,
    idempotencyKey: input.identity.idempotencyKey,
    correlationId: input.identity.correlationId,
  }
}

async function sendWithResend(input: PreparedLeadEmailInput): Promise<SendLeadEmailResult> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const body = buildEmailBodyWithComplianceNote(input.message)
  const { data, error } = await resend.emails.send(
    {
      from: getResendSender(),
      to: input.lead.email!,
      subject: input.message.subject || 'VestBlock follow-up',
      text: body,
      replyTo: getReplyToEmail(),
      headers: { 'X-VestBlock-Correlation-ID': input.identity.correlationId },
      tags: buildResendOutreachTags(input.identity),
    },
    { idempotencyKey: input.identity.idempotencyKey }
  )

  if (error) {
    return {
      ok: false,
      provider: 'resend',
      error: error.message || 'Resend send failed.',
      idempotencyKey: input.identity.idempotencyKey,
      correlationId: input.identity.correlationId,
    }
  }

  return {
    ok: true,
    provider: 'resend',
    providerMessageId: data?.id || null,
    idempotencyKey: input.identity.idempotencyKey,
    correlationId: input.identity.correlationId,
  }
}

export async function sendLeadOutreachEmail(
  input: SendLeadEmailInput
): Promise<SendLeadEmailResult> {
  const requestedSequenceStep = Number(input.sequenceStep || 1)
  const sequenceStep = Number.isFinite(requestedSequenceStep) && requestedSequenceStep > 1
    ? Math.floor(requestedSequenceStep)
    : 1
  const identity = buildOutboundSendIdentity({
    scope: 'lead',
    entityId: input.lead.id,
    messageId: input.message.id,
    sequenceStep,
  })
  const preparedInput: PreparedLeadEmailInput = { ...input, identity }
  const replyCapture = await getOperationalReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return {
      ok: false,
      deferred: true,
      deferredScope: 'infrastructure',
      provider: 'none',
      error: `${replyCapture.reason} Configure Microsoft Graph reply ingestion or set OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE=true for a deliberate temporary override.`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  if (!getOutreachMailingAddress()) {
    return {
      ok: false,
      deferred: true,
      deferredScope: 'infrastructure',
      provider: 'none',
      error:
        'Lead outreach is blocked until OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS is configured.',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  if (!isUsableContactEmail(input.lead.email)) {
    return {
      ok: false,
      provider: 'none',
      error: 'Lead does not have a usable email address.',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  const qualityIssue = validateOutreachMessageQuality(input)
  if (qualityIssue) {
    return {
      ok: false,
      provider: 'none',
      error: `Outreach copy blocked before send: ${qualityIssue}.`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  const availability = getOutboundProviderAvailability()
  const provider = getPreferredOutboundProvider(availability)
  if (provider === 'none') {
    return {
      ok: false,
      deferred: true,
      deferredScope: 'infrastructure',
      provider,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
    }
  }

  const strategyKey = await resolveLeadThroughputStrategy(input.lead, input.message)
  if (!strategyKey) {
    return {
      ok: false,
      provider: 'none',
      error: 'Outreach blocked before send: no canonical VestBlock strategy attribution was found.',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  let deliveryAttempt: Awaited<ReturnType<typeof acquireGuardedDeliveryAttempt>>
  try {
    const recipientGuard = await getOutreachRecipientGuard({
      scope: 'lead',
      entityId: input.lead.id,
      email: input.lead.email,
    })
    if (!recipientGuard.allowed) {
      return {
        ok: false,
        provider: 'none',
        error: `Outreach blocked before send: ${recipientGuard.reason}.`,
        idempotencyKey: identity.idempotencyKey,
        correlationId: identity.correlationId,
      }
    }
    let deliveryCircuitBreaker = input.deliveryCircuitBreaker
    const hasAcceptedFollowupEvidence = sequenceStep > 1
      ? await hasPriorAcceptedLeadEmailEvidence(input.lead.id, input.lead.email || '')
      : false
    if (sequenceStep <= 1 || !hasAcceptedFollowupEvidence) {
      deliveryCircuitBreaker = deliveryCircuitBreaker || await getDeliveryCircuitBreaker({
        provider,
        allowControlledTrial: true,
      })
      const throughputDecision = evaluateOutreachThroughputGovernor({
        mode: deliveryCircuitBreaker.mode,
        sampleSize: deliveryCircuitBreaker.sampleSize,
        complained: deliveryCircuitBreaker.complained,
        badRate: deliveryCircuitBreaker.badRate,
        globalFailureRate: deliveryCircuitBreaker.globalFailureRate,
        terminalCompleteness: deliveryCircuitBreaker.terminalCompleteness,
        requestedDailyTarget: configuredDailyStrategyOutputTarget(),
      })
      const capacity = throughputDecision.effectiveDailyCap > 0
        ? await readOutreachDispatchCapacity(throughputDecision)
        : {
            globalRemaining: 0,
            leadLaneRemaining: 0,
            remainingByLane: {} as Record<string, number>,
          }
      const laneRemaining = Math.max(0, Number(capacity.remainingByLane[strategyKey] || 0))
      const hunterLimits = deriveHunterSendVerificationLimits({
        effectiveDailyCap: throughputDecision.effectiveDailyCap,
        requestedSendLimit: 1,
        globalRemaining: capacity.globalRemaining,
        leadLaneRemaining: Math.min(capacity.leadLaneRemaining, laneRemaining),
        configuredDailyLimit: envNonNegativeInt(
          'LEADS_HUNTER_DAILY_VERIFY_LIMIT',
          throughputDecision.effectiveDailyCap
        ),
        configuredPerRunLimit: 1,
      })
      const hunterVerification = await ensureFreshHunterSendVerification({
        lead: input.lead,
        messageId: input.message.id,
        allowNetwork: deliveryCircuitBreaker.allowed && hunterLimits.perRunLimit > 0,
        dailyLimit: hunterLimits.dailyLimit,
      })
      if (!hunterVerification.sendable || hunterVerification.status !== 'valid') {
        const reason = hunterVerification.reason || `hunter_${hunterVerification.status}_blocked`
        const deferredScope: SendLeadEmailResult['deferredScope'] =
          classifyHunterVerificationFailureScope(reason)
        return {
          ok: false,
          deferred: true,
          deferredScope,
          provider: 'none',
          error: `Outreach blocked before send: fresh Hunter status=valid verification is required (${reason}).`,
          idempotencyKey: identity.idempotencyKey,
          correlationId: identity.correlationId,
        }
      }
    }
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      breaker: deliveryCircuitBreaker,
      scope: 'lead',
      messageId: input.message.id,
      idempotencyKey: identity.idempotencyKey,
      strategyKey,
      recipientEmail: input.lead.email!,
      senderEmail: getOutboundSenderForProvider(provider),
      attemptKind: sequenceStep > 1 ? 'follow_up' : 'first_touch',
    })
  } catch (error) {
    return {
      ok: false,
      deferred: true,
      deferredScope: 'infrastructure',
      provider: 'none',
      error: `Outreach safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }
  if (!deliveryAttempt.allowed) {
    const laneLocal = /outreach_(?:strategy_daily_limit_exhausted|strategy_not_scheduled_today|recipient_24h_cooldown|attempt_already_reserved|reserved_attempt_requires_reconciliation|attempt_identity_conflict)/.test(String(deliveryAttempt.reason || ''))
    return {
      ok: false,
      deferred: true,
      deferredScope: laneLocal ? 'lane' : 'global',
      provider: 'none',
      error: `Outreach blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
  let providerMessageId: string | null | undefined
  try {
    const result = provider === 'resend'
      ? await sendWithResend(preparedInput)
      : await sendWithGmail(preparedInput).catch((error) => ({
          ok: false as const,
          provider: 'gmail' as const,
          error: error instanceof Error ? error.message : 'Google Workspace sender failed.',
          idempotencyKey: identity.idempotencyKey,
          correlationId: identity.correlationId,
        }))
    outcome = result.ok ? 'accepted' : 'failed'
    providerMessageId = 'providerMessageId' in result ? result.providerMessageId : null
    return result
  } catch (error) {
    return {
      ok: false,
      deferred: true,
      deferredScope: 'infrastructure',
      provider,
      error: `Provider response was ambiguous; retry will retain the same idempotency key: ${error instanceof Error ? error.message : String(error)}`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome, providerMessageId).catch((error) => {
      console.error('[outreach] failed to release global delivery permit', error)
    })
  }
}
