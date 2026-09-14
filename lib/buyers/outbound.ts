import { Resend } from 'resend'
import type { BuyerOutreachMessageRecord, BuyerRecord } from '@/lib/buyers/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  getOutboundProviderAvailability,
  getPreferredOutboundProvider,
  shouldPreferResend,
} from '@/lib/outreach/provider-preference'
import { buildOutboundSendIdentity, type OutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { acquireGuardedDeliveryAttempt, releaseGuardedDeliveryAttempt } from '@/lib/outreach/deliveryGate'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'

type SendBuyerEmailInput = {
  buyer: BuyerRecord
  message: BuyerOutreachMessageRecord
  attachments?: BuyerEmailAttachment[]
}

type SendBuyerPacketEmailInput = {
  buyer: BuyerRecord
  messageId: string
  subject: string
  body: string
  attachments: BuyerEmailAttachment[]
}

type BuyerEmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

type SendBuyerEmailResult = {
  ok: boolean
  provider: 'gmail' | 'resend' | 'none'
  providerMessageId?: string | null
  idempotencyKey?: string
  correlationId?: string
  error?: string
}

type BuyerEmailEnvelope = {
  buyer: BuyerRecord
  subject: string
  body: string
  attachments?: BuyerEmailAttachment[]
  identity?: OutboundSendIdentity
}

const DEFAULT_OUTREACH_SENDER = 'acquisitions@vestblock.io'
const BUYER_PACKET_COMPLIANCE_NOTE =
  'If you do not want property opportunities from VestBlock, reply opt out and we will stop.'

function getSender() {
  return (
    process.env.OUTREACH_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    process.env.RESEND_EMAIL ||
    process.env.GOOGLE_WORKSPACE_SENDER ||
    DEFAULT_OUTREACH_SENDER
  )
}

function getResendSender() {
  return process.env.OUTREACH_FROM_EMAIL || process.env.FROM_EMAIL || process.env.RESEND_EMAIL || DEFAULT_OUTREACH_SENDER
}

function getReplyToEmail() {
  return process.env.OUTREACH_REPLY_TO_EMAIL || DEFAULT_OUTREACH_SENDER
}

function buildOutreachBody(message: BuyerOutreachMessageRecord) {
  return buildCommercialOutreachBody({
    body: message.body,
    complianceNote: message.compliance_note,
    mailingAddress: getCommercialOutreachMailingAddress(),
  })
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
  if (!data.access_token) throw new Error('Google token refresh did not return an access token.')
  return data.access_token as string
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function buildGmailMime(input: BuyerEmailEnvelope) {
  const recipient = input.buyer.contact_email?.trim() || ''
  const headers = [
    `From: VestBlock <${getSender()}>`,
    `Reply-To: ${getReplyToEmail()}`,
    `To: ${recipient}`,
    `Subject: ${input.subject}`,
    ...(input.identity
      ? [`Message-ID: <${input.identity.correlationId}@vestblock.io>`, `X-VestBlock-Correlation-ID: ${input.identity.correlationId}`]
      : []),
    'MIME-Version: 1.0',
  ]

  if (!input.attachments?.length) {
    return [...headers, 'Content-Type: text/plain; charset=UTF-8', '', input.body].join('\r\n')
  }

  const boundary = `vestblock_${Date.now().toString(36)}`
  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    input.body,
  ]

  for (const attachment of input.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content.toString('base64').replace(/.{1,76}/g, '$&\r\n').trim()
    )
  }

  parts.push(`--${boundary}--`)
  return parts.join('\r\n')
}

async function sendWithGmail(input: BuyerEmailEnvelope): Promise<SendBuyerEmailResult> {
  const accessToken = await getGoogleAccessToken()
  const recipient = input.buyer.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return {
      ok: false,
      provider: 'gmail',
      error: 'Buyer does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(buildGmailMime(input)) }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'gmail',
      error: typeof data?.error?.message === 'string' ? data.error.message : `Gmail send failed with ${response.status}.`,
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  return {
    ok: true,
    provider: 'gmail',
    providerMessageId: data.id || null,
    idempotencyKey: input.identity?.idempotencyKey,
    correlationId: input.identity?.correlationId,
  }
}

async function sendWithResend(input: BuyerEmailEnvelope): Promise<SendBuyerEmailResult> {
  const recipient = input.buyer.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return {
      ok: false,
      provider: 'resend',
      error: 'Buyer does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send(
    {
      from: getResendSender(),
      to: recipient,
      subject: input.subject,
      text: input.body,
      replyTo: getReplyToEmail(),
      headers: input.identity ? { 'X-VestBlock-Correlation-ID': input.identity.correlationId } : undefined,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    },
    input.identity ? { idempotencyKey: input.identity.idempotencyKey } : undefined
  )

  if (error) {
    return {
      ok: false,
      provider: 'resend',
      error: error.message || 'Resend send failed.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  return {
    ok: true,
    provider: 'resend',
    providerMessageId: data?.id || null,
    idempotencyKey: input.identity?.idempotencyKey,
    correlationId: input.identity?.correlationId,
  }
}

async function sendBuyerEnvelope(input: BuyerEmailEnvelope): Promise<SendBuyerEmailResult> {
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return {
      ok: false,
      provider: 'none',
      error: replyCapture.reason || 'Reply capture is disconnected.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }
  if (!isUsableContactEmail(input.buyer.contact_email)) {
    return {
      ok: false,
      provider: 'none',
      error: 'Buyer does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }
  const availability = getOutboundProviderAvailability()
  const preferResend = shouldPreferResend(availability)

  if (availability.resend && preferResend) {
    return sendWithResend(input)
  }

  if (availability.gmail) {
    try {
      return await sendWithGmail(input)
    } catch (error) {
      const gmailError = error instanceof Error ? error.message : 'Google Workspace sender failed.'
      return {
        ok: false,
        provider: 'gmail',
        error: gmailError,
        idempotencyKey: input.identity?.idempotencyKey,
        correlationId: input.identity?.correlationId,
      }
    }
  }

  if (availability.resend && !preferResend) {
    return sendWithResend(input)
  }

  return {
    ok: false,
    provider: 'none',
    error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
    idempotencyKey: input.identity?.idempotencyKey,
    correlationId: input.identity?.correlationId,
  }
}

export async function sendBuyerOutreachEmail(input: SendBuyerEmailInput): Promise<SendBuyerEmailResult> {
  const identity = buildOutboundSendIdentity({
    scope: 'buyer',
    entityId: input.buyer.id,
    messageId: input.message.id,
    sequenceStep: input.message.channel === 'email_followup' ? 2 : 1,
  })
  if (!getCommercialOutreachMailingAddress()) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'Buyer outreach is blocked until OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS is configured.',
    }
  }
  const provider = getPreferredOutboundProvider(getOutboundProviderAvailability())
  if (provider === 'none') {
    return {
      ok: false,
      provider,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
    }
  }
  let deliveryAttempt: Awaited<ReturnType<typeof acquireGuardedDeliveryAttempt>>
  try {
    const recipientGuard = await getOutreachRecipientGuard({
      scope: 'buyer',
      entityId: input.buyer.id,
      email: input.buyer.contact_email,
    })
    if (!recipientGuard.allowed) {
      return {
        ok: false,
        provider: 'none',
        idempotencyKey: identity.idempotencyKey,
        correlationId: identity.correlationId,
        error: `Buyer outreach blocked before send: ${recipientGuard.reason}.`,
      }
    }
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      scope: 'buyer',
      messageId: input.message.id,
    })
  } catch (error) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Buyer outreach safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (!deliveryAttempt.allowed) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Buyer outreach blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
  try {
    const result = await sendBuyerEnvelope({
      buyer: input.buyer,
      subject: input.message.subject || 'VestBlock partnership note',
      body: buildOutreachBody(input.message),
      attachments: input.attachments,
      identity,
    })
    outcome = result.ok ? 'accepted' : 'failed'
    return result
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome).catch((error) => {
      console.error('[outreach] failed to release global buyer delivery permit', error)
    })
  }
}

export async function sendBuyerPacketEmail(input: SendBuyerPacketEmailInput): Promise<SendBuyerEmailResult> {
  const identity = buildOutboundSendIdentity({
    scope: 'buyer-packet',
    entityId: input.buyer.id,
    messageId: input.messageId,
    sequenceStep: 1,
  })
  const mailingAddress = getCommercialOutreachMailingAddress()
  if (!mailingAddress) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'Buyer packet delivery is blocked until OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS is configured.',
    }
  }
  const provider = getPreferredOutboundProvider(getOutboundProviderAvailability())
  if (provider === 'none') {
    return {
      ok: false,
      provider,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
    }
  }

  let deliveryAttempt: Awaited<ReturnType<typeof acquireGuardedDeliveryAttempt>>
  try {
    const recipientGuard = await getOutreachRecipientGuard({
      scope: 'buyer',
      entityId: input.buyer.id,
      email: input.buyer.contact_email,
    })
    if (!recipientGuard.allowed) {
      return {
        ok: false,
        provider: 'none',
        idempotencyKey: identity.idempotencyKey,
        correlationId: identity.correlationId,
        error: `Buyer packet delivery blocked before send: ${recipientGuard.reason}.`,
      }
    }
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      scope: 'buyer-packet',
      messageId: input.messageId,
    })
  } catch (error) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Buyer packet safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (!deliveryAttempt.allowed) {
    return {
      ok: false,
      provider: 'none',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Buyer packet delivery blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
  try {
    const result = await sendBuyerEnvelope({
      buyer: input.buyer,
      subject: input.subject,
      body: buildCommercialOutreachBody({
        body: input.body,
        complianceNote: BUYER_PACKET_COMPLIANCE_NOTE,
        mailingAddress,
      }),
      attachments: input.attachments,
      identity,
    })
    outcome = result.ok ? 'accepted' : 'failed'
    return result
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome).catch((error) => {
      console.error('[outreach] failed to release global buyer-packet delivery permit', error)
    })
  }
}
