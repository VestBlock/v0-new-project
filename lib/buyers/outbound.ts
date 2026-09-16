import type { BuyerOutreachMessageRecord, BuyerRecord } from '@/lib/buyers/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { buildOutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import type { DeliveryPurpose } from '@/lib/outreach/deliveryPurposeCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { ensureFreshHunterSendVerificationForEntity } from '@/lib/outreach/hunterSendVerification'
import { sendGuardedOutlookEmail } from '@/lib/outreach/outlookDelivery'

type BuyerEmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

type SendBuyerEmailInput = {
  buyer: BuyerRecord
  message: BuyerOutreachMessageRecord
  attachments?: BuyerEmailAttachment[]
  deliveryPurpose?: DeliveryPurpose
  hasExplicitOptIn?: boolean
  isBusinessContact?: boolean
  businessContactEvidence?: unknown
  marketingConsentEvidence?: unknown
  invocationId?: string
}

type SendBuyerPacketEmailInput = {
  buyer: BuyerRecord
  messageId: string
  subject: string
  body: string
  attachments: BuyerEmailAttachment[]
  deliveryPurpose?: DeliveryPurpose
  hasExplicitOptIn?: boolean
  isBusinessContact?: boolean
  marketingConsentEvidence?: unknown
  invocationId?: string
}

export type SendBuyerEmailResult = {
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

const BUYER_PACKET_COMPLIANCE_NOTE =
  'If you do not want property opportunities from VestBlock, reply opt out and we will stop.'
const CONFIRMED_PACKET_RELATIONSHIP_STAGES = ['responded', 'reviewing', 'active_buyer'] as const

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderBody(body: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#172027">${escapeHtml(body).replace(/\n/g, '<br />')}</div>`
}

function outlookAttachments(attachments?: BuyerEmailAttachment[]) {
  return attachments?.map((attachment) => ({
    filename: attachment.filename,
    contentBase64: attachment.content.toString('base64'),
    contentType: attachment.contentType,
  }))
}

async function hasConfirmedBuyerPacketRelationship(buyerId: string) {
  const admin = createAdminClient()
  const [buyerResult, buyBoxResult] = await Promise.all([
    admin
      .from('buyers')
      .select('relationship_stage,outreach_status')
      .eq('id', buyerId)
      .maybeSingle(),
    admin
      .from('buyer_buy_boxes')
      .select('buyer_id')
      .eq('buyer_id', buyerId)
      .eq('active', true)
      .limit(1)
      .maybeSingle(),
  ])
  if (buyerResult.error) throw buyerResult.error
  if (buyBoxResult.error) throw buyBoxResult.error
  const relationshipStage = String(buyerResult.data?.relationship_stage || '')
  return Boolean(
    buyerResult.data &&
      buyerResult.data.outreach_status !== 'do_not_contact' &&
      CONFIRMED_PACKET_RELATIONSHIP_STAGES.includes(
        relationshipStage as (typeof CONFIRMED_PACKET_RELATIONSHIP_STAGES)[number]
      ) &&
      buyBoxResult.data?.buyer_id
  )
}

function mapResult(
  result: Awaited<ReturnType<typeof sendGuardedOutlookEmail>>,
  identity: ReturnType<typeof buildOutboundSendIdentity>
): SendBuyerEmailResult {
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

function invalidResult(
  identity: ReturnType<typeof buildOutboundSendIdentity>,
  error: string
): SendBuyerEmailResult {
  return {
    ok: false,
    provider: 'none',
    providerMessageId: null,
    internetMessageId: null,
    dispatchId: null,
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    accepted: false,
    deduplicated: false,
    acceptanceStatus: 'not_accepted',
    ledgerFinalized: false,
    reconciliationRequired: false,
    retrySafe: true,
    error,
  }
}

export async function sendBuyerOutreachEmail(
  input: SendBuyerEmailInput
): Promise<SendBuyerEmailResult> {
  const isFollowup = input.message.channel === 'email_followup'
  const identity = buildOutboundSendIdentity({
    scope: 'buyer',
    entityId: input.buyer.id,
    messageId: input.message.id,
    sequenceStep: isFollowup ? 2 : 1,
  })
  if (!isUsableContactEmail(input.buyer.contact_email)) {
    return invalidResult(identity, 'Buyer does not have a usable contact email.')
  }
  const purpose = input.deliveryPurpose || 'cold_outreach'
  let buyer = input.buyer
  if (purpose === 'cold_outreach') {
    const hunter = await ensureFreshHunterSendVerificationForEntity({
      scope: 'buyer',
      entity: { id: buyer.id, email: buyer.contact_email, metadata_json: buyer.metadata_json },
      messageId: input.message.id,
      allowNetwork: true,
      dailyLimit: Number.parseInt(process.env.OUTLOOK_COLD_HUNTER_DAILY_LIMIT || '25', 10) || 25,
    })
    if (!hunter.sendable || hunter.status !== 'valid' || !hunter.cache) {
      return {
        ...invalidResult(identity, `Verified B2B Outlook admission requires fresh Hunter status=valid (${hunter.reason}).`),
        deferred: true,
        deferredScope: hunter.reason.includes('budget') ? 'global' : 'record',
      }
    }
    buyer = { ...buyer, metadata_json: { ...(buyer.metadata_json || {}), hunterSendVerification: hunter.cache } }
  }
  const body = buildCommercialOutreachBody({
    body: input.message.body,
    complianceNote: input.message.compliance_note,
    mailingAddress: getCommercialOutreachMailingAddress(),
  })
  const result = await sendGuardedOutlookEmail({
    strategyKey: 'buyers',
    purpose,
    entity: {
      scope: 'buyer',
      id: buyer.id,
      recipientEmail: buyer.contact_email || '',
      metadataJson: buyer.metadata_json,
      contactInfo: buyer.contact_info,
      website: buyer.website,
    },
    subject: input.message.subject || 'VestBlock partnership note',
    html: renderBody(body),
    attachments: outlookAttachments(input.attachments),
    eventType: 'buyer_outreach',
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    invocationId: input.invocationId,
    marketingConsentEvidence: input.marketingConsentEvidence,
  })
  return mapResult(result, identity)
}

export async function sendBuyerPacketEmail(
  input: SendBuyerPacketEmailInput
): Promise<SendBuyerEmailResult> {
  const identity = buildOutboundSendIdentity({
    scope: 'buyer-packet',
    entityId: input.buyer.id,
    messageId: input.messageId,
    sequenceStep: 1,
  })
  if (!isUsableContactEmail(input.buyer.contact_email)) {
    return invalidResult(identity, 'Buyer does not have a usable contact email.')
  }
  const requestedPurpose = input.deliveryPurpose || 'cold_outreach'
  const confirmedTransactionalRelationship = requestedPurpose === 'transactional'
    ? await hasConfirmedBuyerPacketRelationship(input.buyer.id)
    : false
  const effectivePurpose = requestedPurpose === 'transactional' && !confirmedTransactionalRelationship
    ? 'cold_outreach'
    : requestedPurpose
  let buyer = input.buyer
  if (effectivePurpose === 'cold_outreach') {
    const hunter = await ensureFreshHunterSendVerificationForEntity({
      scope: 'buyer',
      entity: { id: buyer.id, email: buyer.contact_email, metadata_json: buyer.metadata_json },
      messageId: input.messageId,
      allowNetwork: true,
      dailyLimit: Number.parseInt(process.env.OUTLOOK_COLD_HUNTER_DAILY_LIMIT || '25', 10) || 25,
    })
    if (!hunter.sendable || hunter.status !== 'valid' || !hunter.cache) {
      return {
        ...invalidResult(identity, `Verified B2B Outlook admission requires fresh Hunter status=valid (${hunter.reason}).`),
        deferred: true,
        deferredScope: hunter.reason.includes('budget') ? 'global' : 'record',
      }
    }
    buyer = { ...buyer, metadata_json: { ...(buyer.metadata_json || {}), hunterSendVerification: hunter.cache } }
  }
  const body = buildCommercialOutreachBody({
    body: input.body,
    complianceNote: BUYER_PACKET_COMPLIANCE_NOTE,
    mailingAddress: getCommercialOutreachMailingAddress(),
  })
  const result = await sendGuardedOutlookEmail({
    strategyKey: 'buyers',
    purpose: effectivePurpose,
    entity: {
      scope: 'buyer',
      id: buyer.id,
      recipientEmail: buyer.contact_email || '',
      metadataJson: buyer.metadata_json,
      contactInfo: buyer.contact_info,
      website: buyer.website,
    },
    subject: input.subject,
    html: renderBody(body),
    attachments: outlookAttachments(input.attachments),
    eventType: 'buyer_packet',
    idempotencyKey: identity.idempotencyKey,
    correlationId: identity.correlationId,
    invocationId: input.invocationId,
    marketingConsentEvidence: input.marketingConsentEvidence,
  })
  return mapResult(result, identity)
}
