import type { InvestorOutreachMessageRecord, InvestorProfileRecord } from '@/lib/investors/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

export function evaluateInvestorAutoApproval(input: {
  investor: InvestorProfileRecord | null
  message: InvestorOutreachMessageRecord
  templateVersion: string
  minimumScore: number
}) {
  const { investor, message, templateVersion, minimumScore } = input
  if (!investor?.id) return { approved: false, reason: 'missing_investor' }
  if (investor.outreach_status === 'do_not_contact') return { approved: false, reason: 'do_not_contact' }
  if (['paused', 'not_a_fit', 'dormant'].includes(investor.relationship_stage)) {
    return { approved: false, reason: `relationship_${investor.relationship_stage}` }
  }
  if (!isUsableContactEmail(investor.contact_email)) return { approved: false, reason: 'invalid_email' }
  if (Number(investor.partnership_score || 0) < minimumScore) return { approved: false, reason: 'score_below_threshold' }
  if (message.channel !== 'email') return { approved: false, reason: 'channel_not_allowed' }
  if ((message.metadata_json || {}).templateVersion !== templateVersion) {
    return { approved: false, reason: 'stale_template' }
  }
  const subject = String(message.subject || '').trim()
  const body = String(message.body || '').trim()
  if (subject.length < 8 || subject.length > 120) return { approved: false, reason: 'subject_quality' }
  if (body.length < 120 || body.length > 2800) return { approved: false, reason: 'body_quality' }
  if (!body.includes('acquisitions@vestblock.io')) return { approved: false, reason: 'missing_identity' }
  if (!/not relevant|do not contact|opt out/i.test(body)) return { approved: false, reason: 'missing_opt_out' }
  return { approved: true, reason: 'approved' }
}
