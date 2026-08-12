import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type EnrollmentStatus =
  | 'queued'
  | 'needs_review'
  | 'approved'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

export async function recordOutboundEnrollment(input: {
  strategyKey: string
  channel: 'email' | 'sms' | 'task'
  status: EnrollmentStatus
  messageId: string
  campaignRunId?: string | null
  recipient?: string | null
  leadId?: string | null
  market?: string | null
  propertyAddress?: string | null
  suppressionReason?: string | null
  nextActionAt?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const recipient = String(input.recipient || '').trim().toLowerCase() || null
  const recipientHash = recipient ? createHash('sha256').update(recipient).digest('hex') : null
  const payload = {
    campaign_run_id: input.campaignRunId || null,
    lead_id: input.leadId || null,
    strategy_key: input.strategyKey,
    channel: input.channel,
    recipient,
    recipient_hash: recipientHash,
    market: input.market || null,
    property_address: input.propertyAddress || null,
    status: input.status,
    suppression_reason: input.suppressionReason || null,
    next_action_at: input.nextActionAt || null,
    last_message_id: input.messageId,
    metadata_json: input.metadata || {},
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: lookupError } = await admin
    .from('command_center_outbound_enrollments')
    .select('id')
    .eq('channel', input.channel)
    .eq('last_message_id', input.messageId)
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (existing?.id) {
    const { data, error } = await admin
      .from('command_center_outbound_enrollments')
      .update(payload)
      .eq('id', existing.id)
      .select('id,status')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await admin
    .from('command_center_outbound_enrollments')
    .insert(payload)
    .select('id,status')
    .single()
  if (error) throw error
  return data
}
