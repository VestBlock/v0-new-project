import 'server-only'

import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluateOutreachRecipientSnapshot } from '@/lib/outreach/suppressionCore'

export type OutreachRecipientScope = 'lead' | 'buyer' | 'lender' | 'investor'

const ENTITY_CONFIG = {
  lead: {
    table: 'leads',
    emailColumn: 'email',
    select: 'id,email,status,outreach_status,delivery_status',
  },
  buyer: {
    table: 'buyers',
    emailColumn: 'contact_email',
    select: 'id,contact_email,relationship_stage,outreach_status',
  },
  lender: {
    table: 'lenders',
    emailColumn: 'contact_email',
    select: 'id,contact_email,relationship_stage,outreach_status',
  },
  investor: {
    table: 'investor_profiles',
    emailColumn: 'contact_email',
    select: 'id,contact_email,relationship_stage,outreach_status',
  },
} as const

function ilikeLiteral(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export async function getOutreachRecipientGuard(input: {
  scope: OutreachRecipientScope
  entityId: string
  email: string | null | undefined
}) {
  const normalizedEmail = normalizeEmailAddress(input.email)
  if (!normalizedEmail || !isUsableContactEmail(normalizedEmail)) {
    return { allowed: false as const, reason: 'recipient_email_changed_or_missing' }
  }

  const admin = createAdminClient()
  const config = ENTITY_CONFIG[input.scope]
  const emailPattern = ilikeLiteral(normalizedEmail)
  const [entityResult, suppressionResult] = await Promise.all([
    admin.from(config.table).select(config.select).eq('id', input.entityId).maybeSingle(),
    admin
      .from('lead_suppressions')
      .select('id')
      .ilike('email', emailPattern)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
  ])
  if (entityResult.error) throw entityResult.error
  if (suppressionResult.error) throw suppressionResult.error

  const entity = entityResult.data as Record<string, unknown> | null
  return evaluateOutreachRecipientSnapshot({
    exists: Boolean(entity),
    expectedEmail: normalizedEmail,
    currentEmail: entity ? String(entity[config.emailColumn] || '') : null,
    status: entity ? String(entity.status || '') : null,
    outreachStatus: entity ? String(entity.outreach_status || '') : null,
    relationshipStage: entity ? String(entity.relationship_stage || '') : null,
    deliveryStatus: entity ? String(entity.delivery_status || '') : null,
    suppressed: Boolean(suppressionResult.data?.id),
  })
}

export async function suppressAndCancelPendingOutreach(input: {
  email: string | null | undefined
  reason: string
}) {
  const normalizedEmail = normalizeEmailAddress(input.email)
  if (!normalizedEmail) return { suppressed: false, canceled: 0 }
  const admin = createAdminClient()
  const emailPattern = ilikeLiteral(normalizedEmail)
  const { data: existing, error: lookupError } = await admin
    .from('lead_suppressions')
    .select('id')
    .ilike('email', emailPattern)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError

  if (!existing?.id) {
    const { error: insertError } = await admin.from('lead_suppressions').insert({
      email: normalizedEmail,
      reason: input.reason,
    })
    if (insertError) throw insertError
  }

  const pendingStatuses = ['approved', 'queued', 'needs_review']
  const now = new Date().toISOString()
  const [leads, buyers, lenders, investors] = await Promise.all([
    admin.from('leads').select('id').ilike('email', emailPattern),
    admin.from('buyers').select('id').ilike('contact_email', emailPattern),
    admin.from('lenders').select('id').ilike('contact_email', emailPattern),
    admin.from('investor_profiles').select('id').ilike('contact_email', emailPattern),
  ])
  for (const result of [leads, buyers, lenders, investors]) {
    if (result.error) throw result.error
  }

  const leadIds = (leads.data || []).map((row) => row.id)
  const buyerIds = (buyers.data || []).map((row) => row.id)
  const lenderIds = (lenders.data || []).map((row) => row.id)
  const investorIds = (investors.data || []).map((row) => row.id)
  const updates: Array<PromiseLike<{ data: unknown; error: { message?: string } | null }>> = []

  if (leadIds.length) {
    updates.push(
      admin.from('leads').update({ status: 'do_not_contact', outreach_status: 'do_not_contact', next_follow_up_at: null }).in('id', leadIds),
      admin.from('outreach_messages').update({ status: 'archived', send_error: input.reason, updated_at: now }).in('lead_id', leadIds).in('status', pendingStatuses)
    )
  }
  if (buyerIds.length) {
    updates.push(
      admin.from('buyers').update({ outreach_status: 'do_not_contact', next_follow_up_at: null, updated_at: now }).in('id', buyerIds),
      admin.from('buyer_outreach_messages').update({ status: 'archived', send_error: input.reason, updated_at: now }).in('buyer_id', buyerIds).in('status', pendingStatuses)
    )
  }
  if (lenderIds.length) {
    updates.push(
      admin.from('lenders').update({ outreach_status: 'do_not_contact', next_follow_up_at: null, updated_at: now }).in('id', lenderIds),
      admin.from('lender_outreach_messages').update({ status: 'archived', send_error: input.reason, updated_at: now }).in('lender_id', lenderIds).in('status', pendingStatuses)
    )
  }
  if (investorIds.length) {
    updates.push(
      admin.from('investor_profiles').update({ outreach_status: 'do_not_contact', next_follow_up_at: null, updated_at: now }).in('id', investorIds),
      admin.from('investor_outreach_messages').update({ status: 'archived', send_error: input.reason, updated_at: now }).in('investor_profile_id', investorIds).in('status', pendingStatuses)
    )
  }

  const results = await Promise.all(updates)
  for (const result of results) {
    if (result.error) throw result.error
  }
  return {
    suppressed: true,
    canceled: leadIds.length + buyerIds.length + lenderIds.length + investorIds.length,
  }
}
