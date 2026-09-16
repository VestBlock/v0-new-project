import type { InvestorProfileRecord } from '@/lib/investors/types'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { buildOutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import type { DeliveryPurpose } from '@/lib/outreach/deliveryPurposeCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { ensureFreshHunterSendVerificationForEntity } from '@/lib/outreach/hunterSendVerification'
import { classifyHunterVerificationFailureScope } from '@/lib/outreach/hunterSendVerificationCore'
import { sendGuardedOutlookEmail } from '@/lib/outreach/outlookDelivery'
import { deriveRecipientBoundBusinessContactEvidence } from '@/lib/outreach/verifiedBusinessColdEmail'

type InvestorOutreachMessage = {
  id: string
  subject?: string | null
  body: string
  cta?: string | null
  channel?: string | null
  step_number?: number
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderInvestorEmail(message: InvestorOutreachMessage, mailingAddress: string) {
  const rawBody = buildCommercialOutreachBody({
    body: message.body,
    complianceNote: 'If this is not relevant, reply opt out and we will not contact you again.',
    mailingAddress,
  })
  const body = escapeHtml(rawBody).replace(/\n/g, '<br />')
  return `
    <div style="margin:0;padding:0;background:#071016;font-family:Arial,sans-serif;color:#e8f4f7;">
      <div style="max-width:640px;margin:0 auto;padding:28px;">
        <p style="margin:0 0 18px;color:#67e8f9;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">VestBlock</p>
        <div style="font-size:15px;line-height:1.65;color:#d7e6ea;">${body}</div>
        <p style="margin-top:28px;color:#8aa4ad;font-size:12px;line-height:1.5;">VestBlock helps coordinate real estate deal flow, disposition support, and capital relationships. Any transaction, funding, or partnership opportunity is subject to diligence, underwriting, availability, and final agreement by the parties involved.</p>
      </div>
    </div>
  `
}

export async function sendInvestorOutreachEmail(input: {
  investor: InvestorProfileRecord
  message: InvestorOutreachMessage
  deliveryPurpose?: DeliveryPurpose
  hasExplicitOptIn?: boolean
  isBusinessContact?: boolean
  businessContactEvidence?: unknown
  marketingConsentEvidence?: unknown
  invocationId?: string
}) {
  const sequenceStep = Number(input.message.step_number || 1)
  const identity = buildOutboundSendIdentity({
    scope: 'investor',
    entityId: input.investor.id,
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
  if (!isUsableContactEmail(input.investor.contact_email)) {
    return {
      ...base,
      ok: false,
      skipped: true,
      provider: 'none' as const,
      error: 'Missing investor contact email.',
    }
  }
  const purpose = input.deliveryPurpose || 'cold_outreach'
  let investor = input.investor
  if (purpose === 'cold_outreach') {
    const businessContactEvidence = deriveRecipientBoundBusinessContactEvidence({
      metadataJson: investor.metadata_json,
      recipientEmail: investor.contact_email,
      website: investor.website,
    })
    if (!businessContactEvidence) {
      return {
        ...base,
        ok: false,
        deferred: true,
        deferredScope: 'record' as const,
        skipped: true,
        provider: 'none' as const,
        error: 'Verified B2B cold email admission failed (business_contact_evidence_required).',
      }
    }
    const hunter = await ensureFreshHunterSendVerificationForEntity({
      scope: 'investor',
      entity: { id: investor.id, email: investor.contact_email, metadata_json: investor.metadata_json },
      messageId: input.message.id,
      allowNetwork: true,
      dailyLimit: Number.parseInt(process.env.OUTLOOK_COLD_HUNTER_DAILY_LIMIT || '25', 10) || 25,
    })
    if (!hunter.sendable || hunter.status !== 'valid' || !hunter.cache) {
      return {
        ...base,
        ok: false,
        deferred: true,
        deferredScope: classifyHunterVerificationFailureScope(hunter.reason),
        skipped: true,
        provider: 'none' as const,
        error: `Verified B2B Outlook admission requires fresh Hunter status=valid (${hunter.reason}).`,
      }
    }
    investor = { ...investor, metadata_json: { ...(investor.metadata_json || {}), hunterSendVerification: hunter.cache } }
  }
  const mailingAddress = getCommercialOutreachMailingAddress()
  const result = await sendGuardedOutlookEmail({
    strategyKey: 'investors',
    purpose,
    entity: {
      scope: 'investor',
      id: investor.id,
      recipientEmail: investor.contact_email || '',
      metadataJson: investor.metadata_json,
      website: investor.website,
    },
    subject: input.message.subject || 'Strategic investor partnership with VestBlock',
    html: renderInvestorEmail(input.message, mailingAddress),
    eventType: 'investor_outreach',
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    invocationId: input.invocationId,
    marketingConsentEvidence: input.marketingConsentEvidence,
  })

  return {
    ok: result.ok,
    deferred: result.deferred || undefined,
    deferredScope: result.deferredScope || undefined,
    skipped: !result.ok,
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
