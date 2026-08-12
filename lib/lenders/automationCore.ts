import type { LenderOutreachMessageRecord, LenderRecord } from '@/lib/lenders/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

export type LenderAutoApprovalDecision = {
  approved: boolean
  reason: string
}

export function evaluateLenderAutoApproval(input: {
  lender: LenderRecord | null
  message: LenderOutreachMessageRecord
  templateVersion: string
  minimumScore: number
  allowedChannels?: string[]
}): LenderAutoApprovalDecision {
  const { lender, message, templateVersion, minimumScore } = input
  const allowedChannels = input.allowedChannels || ['email_intro']
  if (!lender?.id) return { approved: false, reason: 'missing_lender' }
  if (lender.outreach_status === 'do_not_contact') return { approved: false, reason: 'do_not_contact' }
  if (['paused', 'not_a_fit', 'dormant'].includes(lender.relationship_stage)) {
    return { approved: false, reason: `relationship_${lender.relationship_stage}` }
  }
  if (!isUsableContactEmail(lender.contact_email)) return { approved: false, reason: 'invalid_email' }
  if (Number(lender.confidence_score || 0) < minimumScore) return { approved: false, reason: 'score_below_threshold' }
  if (!allowedChannels.includes(message.channel)) return { approved: false, reason: 'channel_not_allowed' }
  if ((message.metadata_json || {}).templateVersion !== templateVersion) {
    return { approved: false, reason: 'stale_template' }
  }

  const subject = String(message.subject || '').trim()
  const body = String(message.body || '').trim()
  const compliance = String(message.compliance_note || '').trim()
  if (subject.length < 8 || subject.length > 120) return { approved: false, reason: 'subject_quality' }
  if (body.length < 120 || body.length > 2600) return { approved: false, reason: 'body_quality' }
  if (!body.includes('acquisitions@vestblock.io')) return { approved: false, reason: 'missing_identity' }
  if (!/not relevant|do not contact|opt out/i.test(`${body}\n${compliance}`)) {
    return { approved: false, reason: 'missing_opt_out' }
  }

  return { approved: true, reason: 'approved' }
}
