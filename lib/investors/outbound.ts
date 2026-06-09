import { sendEmail } from '@/lib/email/sendEmail'
import type { InvestorProfileRecord } from '@/lib/investors/types'

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

function renderInvestorEmail(message: InvestorOutreachMessage) {
  const body = escapeHtml(message.body).replace(/\n/g, '<br />')
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
  const to = input.investor.contact_email
  if (!to) return { ok: false, skipped: true, provider: 'resend', error: 'Missing investor contact email.' }

  const result = await sendEmail({
    to,
    subject: input.message.subject || 'Strategic investor partnership with VestBlock',
    html: renderInvestorEmail(input.message),
    eventType: 'admin_lead_followup',
  })

  return {
    ok: Boolean(result.ok),
    skipped: Boolean(result.skipped),
    provider: 'resend',
    error: result.error || null,
  }
}
