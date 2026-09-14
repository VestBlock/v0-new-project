import { sendEmail } from '@/lib/email/sendEmail'
import type { InvestorProfileRecord } from '@/lib/investors/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import {
  getOutboundProviderAvailability,
  getPreferredOutboundProvider,
} from '@/lib/outreach/provider-preference'
import { buildOutboundSendIdentity } from '@/lib/outreach/deliveryIdentity'
import { buildCommercialOutreachBody, getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { acquireGuardedDeliveryAttempt, releaseGuardedDeliveryAttempt } from '@/lib/outreach/deliveryGate'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'

type InvestorOutreachMessage = {
  id: string
  subject?: string | null
  body: string
  cta?: string | null
  channel?: string | null
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
}) {
  const identity = buildOutboundSendIdentity({
    scope: 'investor',
    entityId: input.investor.id,
    messageId: input.message.id,
    sequenceStep: Number((input.message as { step_number?: number }).step_number || 1),
  })
  const replyCapture = getReplyCaptureReadiness()
  if (!replyCapture.ready) {
    return {
      ok: false,
      skipped: true,
      provider: 'none' as const,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: replyCapture.reason || 'Reply capture is disconnected.',
    }
  }

  const mailingAddress = getCommercialOutreachMailingAddress()
  if (!mailingAddress) {
    return {
      ok: false,
      skipped: true,
      provider: 'none' as const,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'Investor outreach is blocked until OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS is configured.',
    }
  }

  const to = input.investor.contact_email
  if (!isUsableContactEmail(to)) {
    return {
      ok: false,
      skipped: true,
      provider: 'none' as const,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'Missing investor contact email.',
    }
  }

  const provider = getPreferredOutboundProvider(getOutboundProviderAvailability())
  if (provider === 'none') {
    return {
      ok: false,
      skipped: true,
      provider,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: 'No outbound provider configured. Add Google Workspace OAuth credentials or Resend sender settings.',
    }
  }

  let deliveryAttempt: Awaited<ReturnType<typeof acquireGuardedDeliveryAttempt>>
  try {
    const recipientGuard = await getOutreachRecipientGuard({
      scope: 'investor',
      entityId: input.investor.id,
      email: to,
    })
    if (!recipientGuard.allowed) {
      return {
        ok: false,
        skipped: true,
        provider: 'none' as const,
        providerMessageId: null,
        idempotencyKey: identity.idempotencyKey,
        correlationId: identity.correlationId,
        error: `Investor outreach blocked before send: ${recipientGuard.reason}.`,
      }
    }
    deliveryAttempt = await acquireGuardedDeliveryAttempt({
      provider,
      scope: 'investor',
      messageId: input.message.id,
    })
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      provider: 'none' as const,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Investor outreach safety checks unavailable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
  if (!deliveryAttempt.allowed) {
    return {
      ok: false,
      skipped: true,
      provider: 'none' as const,
      providerMessageId: null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: `Investor outreach blocked by delivery safety gate: ${deliveryAttempt.reason}.`,
    }
  }

  let outcome: 'accepted' | 'failed' | 'not_sent' = 'not_sent'
  try {
    const result = await sendEmail({
      to,
      subject: input.message.subject || 'Strategic investor partnership with VestBlock',
      html: renderInvestorEmail(input.message, mailingAddress),
      eventType: 'admin_lead_followup',
      providerPreference: provider === 'resend' ? 'resend' : 'google',
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      disableProviderFallback: true,
    })
    outcome = result.ok ? 'accepted' : 'failed'
    return {
      ok: Boolean(result.ok),
      skipped: Boolean(result.skipped),
      provider: result.provider || ('none' as const),
      providerMessageId: result.id || null,
      idempotencyKey: identity.idempotencyKey,
      correlationId: identity.correlationId,
      error: result.error || null,
    }
  } finally {
    await releaseGuardedDeliveryAttempt(deliveryAttempt, outcome).catch((error) => {
      console.error('[outreach] failed to release global investor delivery permit', error)
    })
  }
}
