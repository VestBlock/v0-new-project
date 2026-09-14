import { normalizeEmailAddress } from '@/lib/outreach/email-quality'

export type OutreachRecipientSnapshot = {
  exists: boolean
  expectedEmail?: string | null
  currentEmail?: string | null
  status?: string | null
  outreachStatus?: string | null
  relationshipStage?: string | null
  deliveryStatus?: string | null
  suppressed?: boolean
}

const BLOCKED_ENTITY_STATUSES = new Set([
  'do_not_contact',
  'paused',
  'not_a_fit',
  'closed_lost',
  'disqualified',
])

export function evaluateOutreachRecipientSnapshot(snapshot: OutreachRecipientSnapshot) {
  if (!snapshot.exists) return { allowed: false as const, reason: 'recipient_record_missing' }
  const expectedEmail = normalizeEmailAddress(snapshot.expectedEmail)
  const currentEmail = normalizeEmailAddress(snapshot.currentEmail)
  if (!expectedEmail || !currentEmail || expectedEmail !== currentEmail) {
    return { allowed: false as const, reason: 'recipient_email_changed_or_missing' }
  }
  if (snapshot.suppressed) return { allowed: false as const, reason: 'recipient_suppressed' }
  if (
    [snapshot.status, snapshot.outreachStatus, snapshot.relationshipStage, snapshot.deliveryStatus]
      .map((value) => String(value || '').trim().toLowerCase())
      .some((value) => BLOCKED_ENTITY_STATUSES.has(value))
  ) {
    return { allowed: false as const, reason: 'recipient_do_not_contact' }
  }
  if (['bounced', 'complained', 'suppressed'].includes(String(snapshot.deliveryStatus || '').toLowerCase())) {
    return { allowed: false as const, reason: 'recipient_delivery_blocked' }
  }
  return { allowed: true as const, reason: null }
}
