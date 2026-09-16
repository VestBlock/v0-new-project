import type { LenderOutreachMessageRecord, LenderRecord } from '@/lib/lenders/types'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { buildOutboundSendIdentity, type OutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import type { DeliveryPurpose } from '@/lib/outreach/deliveryPurposeCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { ensureFreshHunterSendVerificationForEntity } from '@/lib/outreach/hunterSendVerification'
import { sendGuardedOutlookEmail } from '@/lib/outreach/outlookDelivery'

type SendLenderEmailInput = {
  lender: LenderRecord
  message: LenderOutreachMessageRecord
  identity?: OutboundSendIdentity
  deliveryMode?: 'standard' | 'recovery_canary'
  deliveryPurpose?: DeliveryPurpose
  hasExplicitOptIn?: boolean
  isBusinessContact?: boolean
  businessContactEvidence?: unknown
  marketingConsentEvidence?: unknown
  invocationId?: string
}

export type SendLenderEmailResult = {
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

function buildOutreachHtml(message: LenderOutreachMessageRecord) {
  const body = buildCommercialOutreachBody({
    body: message.body,
    complianceNote: message.compliance_note,
    mailingAddress: getCommercialOutreachMailingAddress(),
  })
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#172027">${escapeHtml(body).replace(/\n/g, '<br />')}</div>`
}

export async function sendLenderOutreachEmail(
  input: SendLenderEmailInput
): Promise<SendLenderEmailResult> {
  const isFollowup = input.message.channel === 'email_followup'
  const identity = input.identity || buildOutboundSendIdentity({
    scope: 'lender',
    entityId: input.lender.id,
    messageId: input.message.id,
    sequenceStep: isFollowup ? 2 : 1,
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
  if (!isUsableContactEmail(input.lender.contact_email)) {
    return { ...base, ok: false, provider: 'none', error: 'Lender does not have a usable contact email.' }
  }
  const purpose = input.deliveryPurpose || 'cold_outreach'
  let lender = input.lender
  if (purpose === 'cold_outreach') {
    const hunter = await ensureFreshHunterSendVerificationForEntity({
      scope: 'lender',
      entity: { id: lender.id, email: lender.contact_email, metadata_json: lender.metadata_json },
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
    lender = { ...lender, metadata_json: { ...(lender.metadata_json || {}), hunterSendVerification: hunter.cache } }
  }

  const result = await sendGuardedOutlookEmail({
    strategyKey: 'lenders',
    purpose,
    entity: {
      scope: 'lender',
      id: lender.id,
      recipientEmail: lender.contact_email || '',
      metadataJson: lender.metadata_json,
      contactInfo: lender.contact_info,
      website: lender.website,
    },
    subject: input.message.subject || 'VestBlock partnership note',
    html: buildOutreachHtml(input.message),
    eventType: 'lender_outreach',
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
