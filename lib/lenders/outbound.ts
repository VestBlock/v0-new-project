import { Resend } from 'resend'
import type { LenderOutreachMessageRecord, LenderRecord } from '@/lib/lenders/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
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
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { acquireGuardedDeliveryAttempt, releaseGuardedDeliveryAttempt } from '@/lib/outreach/deliveryGate'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import type { DeliveryCircuitBreaker } from '@/lib/leads/deliveryHealthCore'
import { preflightPartnerHunterSendVerification } from '@/lib/outreach/partnerHunterSendVerification'

type SendLenderEmailInput = {
  lender: LenderRecord
  message: LenderOutreachMessageRecord
  identity?: OutboundSendIdentity
  deliveryMode?: 'standard' | 'recovery_canary'
  deliveryCircuitBreaker?: DeliveryCircuitBreaker
}

type SendLenderEmailResult = {
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

function getSender() {
  return getOutboundSenderForProvider('gmail')
}

function getResendSender() {
  return getOutboundSenderForProvider('resend')
}

function getReplyToEmail() {
  return process.env.OUTREACH_REPLY_TO_EMAIL || DEFAULT_OUTREACH_SENDER
}

function buildOutreachBody(message: LenderOutreachMessageRecord) {
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

async function sendWithGmail(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  const accessToken = await getGoogleAccessToken()
  const recipient = input.lender.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return {
      ok: false,
      provider: 'gmail',
      error: 'Lender does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  const mime = [
    `From: VestBlock <${getSender()}>`,
    `Reply-To: ${getReplyToEmail()}`,
    `To: ${recipient}`,
    `Subject: ${input.message.subject || 'VestBlock partnership note'}`,
    ...(input.identity
      ? [`Message-ID: <${input.identity.correlationId}@vestblock.io>`, `X-VestBlock-Correlation-ID: ${input.identity.correlationId}`]
      : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    buildOutreachBody(input.message),
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

async function sendWithResend(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  const recipient = input.lender.contact_email?.trim() || ''
  if (!isUsableContactEmail(recipient)) {
    return {
      ok: false,
      provider: 'resend',
      error: 'Lender does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send(
    {
      from: getResendSender(),
      to: recipient,
      subject: input.message.subject || 'VestBlock partnership note',
      text: buildOutreachBody(input.message),
      replyTo: getReplyToEmail(),
      headers: input.identity ? { 'X-VestBlock-Correlation-ID': input.identity.correlationId } : undefined,
      tags: input.identity ? buildResendOutreachTags(input.identity) : undefined,
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

export async function sendLenderOutreachEmail(input: SendLenderEmailInput): Promise<SendLenderEmailResult> {
  const isFollowup = input.message.channel === 'email_followup'
  input = {
    ...input,
    identity: buildOutboundSendIdentity({
      scope: 'lender',
      entityId: input.lender.id,
      messageId: input.message.id,
      sequenceStep: isFollowup ? 2 : 1,
    }),
  }
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return {
      ok: false,
      deferred: true,
      provider: 'none',
      error: replyCapture.reason || 'Reply capture is disconnected.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }
  if (!getCommercialOutreachMailingAddress()) {
    return {
      ok: false,
      deferred: true,
      provider: 'none',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
      error: 'Lender outreach is blocked until OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS is configured.',
    }
  }
  if (!isUsableContactEmail(input.lender.contact_email)) {
    return {
      ok: false,
      provider: 'none',
      error: 'Lender does not have a usable contact email.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }
  const provider = getPreferredOutboundProvider(getOutboundProviderAvailability())
  if (provider === 'none') {
    return {
      ok: false,
      deferred: true,
      provider,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  let deliveryAttempt: Awaited<ReturnType<typeof acquireGuardedDeliveryAttempt>>
  try {
    const recipientGuard = await getOutreachRecipientGuard({
      scope: 'lender',
      entityId: input.lender.id,
      email: input.lender.contact_email,
    })
    if (!recipientGuard.allowed) {
      return {
        ok: false,
        provider: 'none',
        error: `Lender outreach blocked before send: ${recipientGuard.reason}.`,
        idempotencyKey: input.identity?.idempotencyKey,
        correlationId: input.identity?.correlationId,
      }
    }
    const hunterPreflight = await preflightPartnerHunterSendVerification({
      scope: 'lender',
      entity: input.lender,
      messageId: input.message.id,
      strategyKey: 'lenders',
      provider,
      isFollowup,
      deliveryCircuitBreaker: input.deliveryCircuitBreaker,
    })
    if (!hunterPreflight.allowed) {
      return {
        ok: false,
        deferred: true,
        deferredScope: hunterPreflight.deferredScope || 'record',
        provider: 'none',
        error: `Lender outreach blocked before send: fresh Hunter status=valid verification is required (${hunterPreflight.reason}).`,
        idempotencyKey: input.identity?.idempotencyKey,
        correlationId: input.identity?.correlationId,
      }
    }
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      breaker: input.deliveryCircuitBreaker,
      scope: 'lender',
      messageId: input.message.id,
      idempotencyKey: input.identity!.idempotencyKey,
      strategyKey: 'lenders',
      recipientEmail: input.lender.contact_email!,
      senderEmail: getOutboundSenderForProvider(provider),
      attemptKind: isFollowup ? 'follow_up' : 'first_touch',
      recoveryCanary: input.deliveryMode === 'recovery_canary',
    })
  } catch (error) {
    return {
      ok: false,
      deferred: true,
      provider: 'none',
      error: `Lender outreach safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }
  if (!deliveryAttempt.allowed) {
    const reason = String(deliveryAttempt.reason || '')
    const deferredScope = /outreach_(?:recipient_24h_cooldown|attempt_already_reserved|reserved_attempt_requires_reconciliation|attempt_identity_conflict)/.test(reason)
      ? 'record'
      : /outreach_(?:strategy_daily_limit_exhausted|strategy_not_scheduled_today)/.test(reason)
        ? 'lane'
        : 'global'
    return {
      ok: false,
      deferred: true,
      deferredScope,
      provider: 'none',
      error: `Lender outreach blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
  let providerMessageId: string | null | undefined
  try {
    const result = provider === 'resend'
      ? await sendWithResend(input)
      : await sendWithGmail(input).catch((error) => ({
          ok: false as const,
          provider: 'gmail' as const,
          error: error instanceof Error ? error.message : 'Google Workspace sender failed.',
          idempotencyKey: input.identity?.idempotencyKey,
          correlationId: input.identity?.correlationId,
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
      idempotencyKey: input.identity?.idempotencyKey,
      correlationId: input.identity?.correlationId,
    }
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome, providerMessageId).catch((error) => {
      console.error('[outreach] failed to release global lender delivery permit', error)
    })
  }
}
