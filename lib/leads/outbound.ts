import { getStrategyDeliveryAttribution } from '@/lib/admin/strategyDelivery'
import { hasMicrosoftGraphApplicationCredentials } from '@/lib/email/microsoftGraphSend'
import { evaluateOutreachV2Lead } from '@/lib/leads/outreachV2'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { buildOutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import { isLeadColdEmailProhibited, type DeliveryPurpose } from '@/lib/outreach/deliveryPurposeCore'
import {
  getDailyStrategyOutputLane,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { ensureFreshHunterSendVerification } from '@/lib/outreach/hunterSendVerification'
import { sendGuardedOutlookEmail } from '@/lib/outreach/outlookDelivery'

type SendLeadEmailInput = {
  lead: LeadRecord
  message: OutreachMessageRecord
  sequenceStep?: number
  deliveryPurpose?: DeliveryPurpose
  hasExplicitOptIn?: boolean
  isBusinessContact?: boolean
  businessContactEvidence?: unknown
  marketingConsentEvidence?: unknown
  /** Stable across every cold-email attempt made by one scheduler invocation. */
  invocationId?: string
}

export type SendLeadEmailResult = {
  ok: boolean
  deferred?: boolean
  deferredScope?: 'record' | 'lane' | 'global' | 'infrastructure'
  provider: 'outlook' | 'none'
  providerMessageId: string | null
  internetMessageId: string | null
  dispatchId: string | null
  idempotencyKey: string
  correlationId: string
  accepted: boolean
  deduplicated: boolean
  acceptanceStatus: 'accepted' | 'not_accepted' | 'unknown'
  ledgerFinalized: boolean
  reconciliationRequired: boolean
  retrySafe: boolean
  error?: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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

function buildEmailBodyWithComplianceNote(message: OutreachMessageRecord) {
  const body = String(message.body || '').trim()
  const complianceNote = buildLeadOutreachComplianceBlock(message)
  if (!complianceNote || body.toLowerCase().includes(complianceNote.toLowerCase())) return body
  return body ? `${body}\n\n${complianceNote}` : complianceNote
}

function renderLeadEmail(message: OutreachMessageRecord) {
  const body = escapeHtml(buildEmailBodyWithComplianceNote(message)).replace(/\n/g, '<br />')
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#172027">${body}</div>`
}

async function resolveLeadStrategy(
  lead: LeadRecord,
  message: OutreachMessageRecord
): Promise<DailyStrategyOutputLaneKey | null> {
  const attribution = await getStrategyDeliveryAttribution(lead.id).catch(() => null)
  const evaluation = evaluateOutreachV2Lead(lead, message.subject || '')
  for (const candidate of [attribution?.strategy_key, lead.market_segment, evaluation.segmentKey]) {
    const lane = getDailyStrategyOutputLane(String(candidate || ''))
    if (lane) return lane.key
  }
  return null
}

/** Compatibility surface used by Command Center diagnostics. */
export function getOutboundProviderReadiness() {
  const outlook = hasMicrosoftGraphApplicationCredentials()
  return {
    gmail: false,
    resend: false,
    outlook,
    defaultProvider: outlook ? 'outlook' as const : 'none' as const,
    sender: String(process.env.OUTLOOK_ACQUISITIONS_MAILBOX || '').trim(),
    mailingAddressConfigured: Boolean(getOutreachMailingAddress()),
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
  const base = {
    providerMessageId: null,
    internetMessageId: null,
    dispatchId: null,
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    accepted: false,
    deduplicated: false,
    acceptanceStatus: 'not_accepted' as const,
    ledgerFinalized: false,
    reconciliationRequired: false,
    retrySafe: true,
  }

  if (!isUsableContactEmail(input.lead.email)) {
    return { ...base, ok: false, provider: 'none', error: 'Lead does not have a usable email address.' }
  }
  const qualityIssue = validateOutreachMessageQuality(input)
  if (qualityIssue) {
    return { ...base, ok: false, provider: 'none', error: `Outreach copy blocked before send: ${qualityIssue}.` }
  }
  const strategyKey = await resolveLeadStrategy(input.lead, input.message)
  if (!strategyKey) {
    return {
      ...base,
      ok: false,
      provider: 'none',
      error: 'Outreach blocked before send: no canonical VestBlock strategy attribution was found.',
    }
  }

  const purpose = input.deliveryPurpose || 'cold_outreach'
  if (
    purpose === 'cold_outreach' &&
    isLeadColdEmailProhibited({ strategyKey, lead: input.lead })
  ) {
    return {
      ...base,
      ok: false,
      deferred: true,
      deferredScope: 'lane',
      provider: 'none',
      error: 'Seller and consumer cold email is prohibited; route this record to a permitted non-email or permissioned follow-up channel.',
    }
  }
  let lead = input.lead
  if (purpose === 'cold_outreach') {
    const hunter = await ensureFreshHunterSendVerification({
      lead,
      messageId: input.message.id,
      allowNetwork: true,
      dailyLimit: Number.parseInt(process.env.OUTLOOK_COLD_HUNTER_DAILY_LIMIT || '25', 10) || 25,
    })
    if (!hunter.sendable || hunter.status !== 'valid' || !hunter.cache) {
      return {
        ...base,
        ok: false,
        deferred: true,
        deferredScope: hunter.reason.includes('budget') ? 'global' : 'record',
        provider: 'none',
        error: `Verified B2B Outlook admission requires fresh Hunter status=valid (${hunter.reason}).`,
      }
    }
    lead = {
      ...lead,
      metadata_json: { ...(lead.metadata_json || {}), hunterSendVerification: hunter.cache },
    }
  }

  const result = await sendGuardedOutlookEmail({
    strategyKey,
    purpose,
    entity: {
      scope: 'lead',
      id: lead.id,
      recipientEmail: lead.email || '',
      metadataJson: lead.metadata_json,
      contactInfo: lead.contact_info,
      website: lead.website,
    },
    subject: input.message.subject || 'VestBlock follow-up',
    html: renderLeadEmail(input.message),
    eventType: 'lead_outreach',
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    invocationId: input.invocationId,
    marketingConsentEvidence: input.marketingConsentEvidence,
  })

  return {
    ok: result.ok,
    deferred: result.deferred || undefined,
    deferredScope: result.deferredScope || undefined,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    internetMessageId: result.internetMessageId,
    dispatchId: result.dispatchId,
    idempotencyKey: identity.idempotencyKey,
    correlationId: result.correlationId,
    accepted: result.accepted,
    deduplicated: result.deduplicated,
    acceptanceStatus: result.acceptanceStatus,
    ledgerFinalized: result.ledgerFinalized,
    reconciliationRequired: result.reconciliationRequired,
    retrySafe: result.retrySafe,
    error: result.error,
  }
}
