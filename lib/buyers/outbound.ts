import { Resend } from 'resend'
import type { BuyerOutreachMessageRecord, BuyerRecord } from '@/lib/buyers/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'

type SendBuyerEmailInput = {
  buyer: BuyerRecord
  message: BuyerOutreachMessageRecord
  attachments?: BuyerEmailAttachment[]
  provider?: 'gmail' | 'resend'
  disableFallback?: boolean
}

type SendBuyerPacketEmailInput = {
  buyer: BuyerRecord
  subject: string
  body: string
  attachments: BuyerEmailAttachment[]
  provider?: 'gmail' | 'resend'
  disableFallback?: boolean
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
  error?: string
}

type BuyerEmailEnvelope = {
  buyer: BuyerRecord
  subject: string
  body: string
  attachments?: BuyerEmailAttachment[]
  provider?: 'gmail' | 'resend'
  disableFallback?: boolean
}

const DEFAULT_OUTREACH_SENDER = 'acquisitions@vestblock.io'

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
  const body = String(message.body || '').trim()
  const compliance = String(
    message.compliance_note || 'If this is not relevant, reply and we will not contact you again.'
  ).trim()
  return body.toLowerCase().includes(compliance.toLowerCase()) ? body : `${body}\n\n${compliance}`
}

function hasGmailConfig() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  )
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL)
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
    return { ok: false, provider: 'gmail', error: 'Buyer does not have a usable contact email.' }
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
    }
  }

  return { ok: true, provider: 'gmail', providerMessageId: data.id || null }
}

async function sendWithResend(input: BuyerEmailEnvelope): Promise<SendBuyerEmailResult> {
  const recipient = input.buyer.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return { ok: false, provider: 'resend', error: 'Buyer does not have a usable contact email.' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: getResendSender(),
    to: recipient,
    subject: input.subject,
    text: input.body,
    replyTo: getReplyToEmail(),
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  })

  if (error) {
    return { ok: false, provider: 'resend', error: error.message || 'Resend send failed.' }
  }

  return { ok: true, provider: 'resend', providerMessageId: data?.id || null }
}

async function sendBuyerEnvelope(input: BuyerEmailEnvelope): Promise<SendBuyerEmailResult> {
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return { ok: false, provider: 'none', error: replyCapture.reason || 'Reply capture is disconnected.' }
  }
  if (!isUsableContactEmail(input.buyer.contact_email)) {
    return { ok: false, provider: 'none', error: 'Buyer does not have a usable contact email.' }
  }
  if (input.provider === 'gmail') {
    if (!hasGmailConfig()) {
      return { ok: false, provider: 'gmail', error: 'The selected Google Workspace provider is not configured.' }
    }
    try {
      return await sendWithGmail(input)
    } catch (error) {
      return {
        ok: false,
        provider: 'gmail',
        error: error instanceof Error ? error.message : 'Google Workspace sender failed.',
      }
    }
  }
  if (input.provider === 'resend') {
    if (!hasResendConfig()) {
      return { ok: false, provider: 'resend', error: 'The selected Resend provider is not configured.' }
    }
    return sendWithResend(input)
  }
  if (hasGmailConfig()) {
    try {
      const gmailResult = await sendWithGmail(input)
      if (gmailResult.ok || input.disableFallback || !hasResendConfig()) return gmailResult
    } catch (error) {
      if (input.disableFallback || !hasResendConfig()) {
        return {
          ok: false,
          provider: 'gmail',
          error: error instanceof Error ? error.message : 'Google Workspace sender failed.',
        }
      }
    }
  }

  if (hasResendConfig()) {
    return sendWithResend(input)
  }

  return {
    ok: false,
    provider: 'none',
    error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
  }
}

export async function sendBuyerOutreachEmail(input: SendBuyerEmailInput): Promise<SendBuyerEmailResult> {
  return sendBuyerEnvelope({
    buyer: input.buyer,
    subject: input.message.subject || 'VestBlock partnership note',
    body: buildOutreachBody(input.message),
    attachments: input.attachments,
    provider: input.provider,
    disableFallback: input.disableFallback,
  })
}

export async function sendBuyerPacketEmail(input: SendBuyerPacketEmailInput): Promise<SendBuyerEmailResult> {
  return sendBuyerEnvelope({
    buyer: input.buyer,
    subject: input.subject,
    body: input.body,
    attachments: input.attachments,
    provider: input.provider,
    disableFallback: input.disableFallback,
  })
}
