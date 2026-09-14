export type OutreachMessageState = {
  status?: string | null
  sent_at?: string | null
}

const GENERATION_PROTECTED_STATUSES = new Set(['approved', 'queued', 'sent', 'accepted', 'delivered'])

export const FOLLOWUP_AUTOMATION_REVIEWABLE_STATUSES = ['draft', 'needs_review'] as const

export function isMessageGenerationProtected(message: OutreachMessageState | null | undefined) {
  if (!message) return false
  return Boolean(message.sent_at) || GENERATION_PROTECTED_STATUSES.has(String(message.status || '').trim().toLowerCase())
}

export function canClaimMessageForSend(message: OutreachMessageState | null | undefined) {
  return Boolean(
    message &&
      !message.sent_at &&
      String(message.status || '').trim().toLowerCase() === 'approved'
  )
}

export function canApproveOutreachMessage(message: OutreachMessageState | null | undefined) {
  if (!message || message.sent_at) return false
  return ['draft', 'needs_review', 'approved'].includes(
    String(message.status || '').trim().toLowerCase()
  )
}

export function canAutoApproveFollowupMessage(message: OutreachMessageState | null | undefined) {
  if (!message || message.sent_at) return false
  return FOLLOWUP_AUTOMATION_REVIEWABLE_STATUSES.includes(
    String(message.status || '').trim().toLowerCase() as (typeof FOLLOWUP_AUTOMATION_REVIEWABLE_STATUSES)[number]
  )
}

export function hasActionableReplyEvidence(
  reply: { metadata_json?: Record<string, unknown> | null } | null | undefined
) {
  return reply?.metadata_json?.actionableReply === true
}
