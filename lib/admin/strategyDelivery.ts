import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

type StrategyDeliveryStatus =
  | 'accepted'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

const POSITIVE_OUTCOMES = new Set(['accepted', 'delivered', 'opened', 'clicked', 'replied'])

function shouldAdvanceMembership(currentStatus: string | null | undefined, nextStatus: StrategyDeliveryStatus) {
  const current = String(currentStatus || '')
  if (nextStatus === 'accepted' && ['delivered', 'opened', 'clicked', 'replied'].includes(current)) return false
  if (['failed', 'bounced', 'complained', 'suppressed'].includes(nextStatus) && POSITIVE_OUTCOMES.has(current)) {
    return nextStatus !== 'failed'
  }
  return current !== nextStatus
}

export async function recordStrategyDeliveryOutcome(input: {
  leadId: string
  messageId: string
  status: StrategyDeliveryStatus
  occurredAt?: string
}) {
  const admin = createAdminClient()
  const occurredAt = input.occurredAt || new Date().toISOString()
  const { data: membership, error: lookupError } = await admin
    .from('strategy_lead_memberships')
    .select('id,campaign_run_id,status,strategy_key,market,source_provider')
    .eq('lead_id', input.leadId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (!membership) return { updated: false, reason: 'no_strategy_membership' }

  if (shouldAdvanceMembership(membership.status, input.status)) {
    const { error: membershipError } = await admin
      .from('strategy_lead_memberships')
      .update({
        status: input.status,
        last_outcome_at: occurredAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id)
    if (membershipError) throw membershipError
  }

  const { error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq('channel', 'email')
    .eq('last_message_id', input.messageId)
  if (enrollmentError) throw enrollmentError

  if (!membership.campaign_run_id) return { updated: true, runId: null }

  const { data: runMemberships, error: countError } = await admin
    .from('strategy_lead_memberships')
    .select('status')
    .eq('campaign_run_id', membership.campaign_run_id)
  if (countError) throw countError

  const statuses = (runMemberships || []).map((row) => String(row.status || ''))
  const acceptedCount = statuses.filter((status) => POSITIVE_OUTCOMES.has(status)).length
  const deliveredCount = statuses.filter((status) => ['delivered', 'opened', 'clicked', 'replied'].includes(status)).length
  const replyCount = statuses.filter((status) => status === 'replied').length
  const bounceCount = statuses.filter((status) => ['bounced', 'complained'].includes(status)).length
  const lifecycleStatus = replyCount
    ? 'replied'
    : deliveredCount
      ? 'delivered'
      : acceptedCount
        ? 'provider_accepted'
        : bounceCount === statuses.length && statuses.length
          ? 'failed'
          : 'drafted'
  const { error: runError } = await admin
    .from('command_center_strategy_runs')
    .update({
      status: lifecycleStatus,
      sent_count: acceptedCount,
      accepted_count: acceptedCount,
      delivered_count: deliveredCount,
      reply_count: replyCount,
      bounce_count: bounceCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.campaign_run_id)
  if (runError) throw runError

  if (membership.strategy_key && membership.market && membership.source_provider) {
    const timestamps: Record<string, string> = { updated_at: new Date().toISOString() }
    if (POSITIVE_OUTCOMES.has(input.status)) timestamps.last_provider_accept_at = occurredAt
    if (input.status === 'replied') timestamps.last_reply_at = occurredAt
    const { error: stateError } = await admin
      .from('strategy_market_state')
      .update(timestamps)
      .eq('strategy_key', membership.strategy_key)
      .eq('market', membership.market)
      .eq('source_provider', membership.source_provider)
    if (stateError) throw stateError
  }

  return { updated: true, runId: membership.campaign_run_id }
}
