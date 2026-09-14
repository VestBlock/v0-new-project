import { Resend } from 'resend'
import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  getOutboundProviderAvailability,
  getPreferredOutboundProvider,
} from '@/lib/outreach/provider-preference'
import { buildOutboundSendIdentity, type OutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import { acquireGuardedDeliveryAttempt, releaseGuardedDeliveryAttempt } from '@/lib/outreach/deliveryGate'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'

type SendLeadEmailInput = {
  lead: LeadRecord
  message: OutreachMessageRecord
  sequenceStep?: number
}

type PreparedLeadEmailInput = SendLeadEmailInput & { identity: OutboundSendIdentity }

type SendLeadEmailResult = {
  ok: boolean
  provider: 'gmail' | 'resend' | 'none'
  providerMessageId?: string | null
  idempotencyKey?: string
  correlationId?: string
  error?: string
}

const DEFAULT_OUTREACH_SENDER = 'acquisitions@vestblock.io'

function getPreferredOutboundSender() {
  return (
    process.env.OUTREACH_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    process.env.RESEND_EMAIL ||
    process.env.GOOGLE_WORKSPACE_SENDER ||
    DEFAULT_OUTREACH_SENDER
  )
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
  return getPreferredOutboundSender()
}

function getReplyToEmail() {
  return process.env.OUTREACH_REPLY_TO_EMAIL || DEFAULT_OUTREACH_SENDER
}

function getResendSender() {
  return (
    process.env.OUTREACH_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    process.env.RESEND_EMAIL ||
    DEFAULT_OUTREACH_SENDER
  )
}

export function getOutboundProviderReadiness() {
  const availability = getOutboundProviderAvailability()
  return {
    ...availability,
    defaultProvider: getPreferredOutboundProvider(availability),
    sender: getPreferredOutboundSender(),
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
  const identity = buildOutboundSendIdentity({
    scope: 'lead',
    entityId: input.lead.id,
    messageId: input.message.id,
    sequenceStep: input.sequenceStep,
  })
  const preparedInput: PreparedLeadEmailInput = { ...input, identity }
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return {
      ok: false,
      provider: 'none',
      error: `${replyCapture.reason} Configure Microsoft Graph reply ingestion or set OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE=true for a deliberate temporary override.`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  if (!getOutreachMailingAddress()) {
    return {
      ok: false,
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
      provider,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
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
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      scope: 'lead',
      messageId: input.message.id,
    })
  } catch (error) {
    return {
      ok: false,
      provider: 'none',
      error: `Outreach safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }
  if (!deliveryAttempt.allowed) {
    return {
      ok: false,
      provider: 'none',
      error: `Outreach blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
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
    return result
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome).catch((error) => {
      console.error('[outreach] failed to release global delivery permit', error)
    })
  }
}
