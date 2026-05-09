import { Resend } from 'resend'
import type { LenderOutreachMessageRecord, LenderRecord } from '@/lib/lenders/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

type SendLenderEmailInput = {
  lender: LenderRecord
  message: LenderOutreachMessageRecord
}

type SendLenderEmailResult = {
  ok: boolean
  provider: 'gmail' | 'resend' | 'none'
  providerMessageId?: string | null
  error?: string
}

function getSender() {
  return process.env.GOOGLE_WORKSPACE_SENDER || process.env.FROM_EMAIL || 'contact@vestblock.io'
}

function getResendSender() {
  return process.env.FROM_EMAIL || 'contact@vestblock.io'
}

function hasGmailConfig() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_WORKSPACE_SENDER
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

async function sendWithGmail(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  const accessToken = await getGoogleAccessToken()
  const recipient = input.lender.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return { ok: false, provider: 'gmail', error: 'Lender does not have a usable contact email.' }
  }

  const mime = [
    `From: VestBlock <${getSender()}>`,
    `To: ${recipient}`,
    `Subject: ${input.message.subject || 'VestBlock partnership note'}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    input.message.body,
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(mime) }),
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

async function sendWithResend(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  const recipient = input.lender.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return { ok: false, provider: 'resend', error: 'Lender does not have a usable contact email.' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: getResendSender(),
    to: recipient,
    subject: input.message.subject || 'VestBlock partnership note',
    text: input.message.body,
  })

  if (error) {
    return { ok: false, provider: 'resend', error: error.message || 'Resend send failed.' }
  }

  return { ok: true, provider: 'resend', providerMessageId: data?.id || null }
}

export async function sendLenderOutreachEmail(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  if (!isUsableContactEmail(input.lender.contact_email)) {
    return { ok: false, provider: 'none', error: 'Lender does not have a usable contact email.' }
  }
  if (hasGmailConfig()) {
    try {
      return await sendWithGmail(input)
    } catch (error) {
      if (!hasResendConfig()) {
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
