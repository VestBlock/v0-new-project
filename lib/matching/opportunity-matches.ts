import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'
import { getParticipantProfile, type ParticipantProfileRecord } from '@/lib/participant-profiles/server'

export type OpportunityMatchStatus = 'proposed' | 'approved' | 'dismissed' | 'deferred' | 'needs_information' | 'archived'

function stableMatchKey(profileId: string, targetType: string, targetId: string, strategyVersionId: string | null) {
  return createHash('sha256').update([profileId, targetType, targetId, strategyVersionId || 'unversioned'].join('|')).digest('hex')
}

export function participantMatchingEligibility(profile: ParticipantProfileRecord, now = Date.now()) {
  const reasons: string[] = []
  if (profile.status !== 'active') reasons.push(`Profile status is ${profile.status}, not active.`)
  if (!profile.matching_consent || !profile.matching_consent_at) reasons.push('Matching consent is not active.')
  if (!profile.last_verified_at) reasons.push('Profile criteria have not been verified.')
  const verifiedAt = Date.parse(profile.last_verified_at || '')
  if (Number.isFinite(verifiedAt) && now - verifiedAt > 180 * 86_400_000) reasons.push('Profile verification is more than 180 days old.')
  if (['withdrawn', 'archived', 'declined', 'paused'].includes(profile.status)) reasons.push('Lifecycle state excludes matching.')
  return { eligible: reasons.length === 0, reasons }
}

export async function createOpportunityMatch(input: {
  participantProfileId: string
  strategyVersionId: string | null
  targetEntityType: 'seller_case' | 'capital_case' | 'dealvault_opportunity' | 'crm_lead' | 'participant_profile' | 'business_opportunity' | 'roadmap_action'
  targetEntityId: string
  score: number
  scoreExplanation: Record<string, unknown>
  exclusions?: string[]
  sourceProvenance: Array<Record<string, unknown>>
  sourceObservedAt?: string | null
  uncertainty: 'low' | 'medium' | 'high'
  customerSafeSummary: string
  operatorOwnerUserId?: string | null
}) {
  const profile = await getParticipantProfile(input.participantProfileId)
  if (!profile) throw new Error('Participant profile not found.')
  const eligibility = participantMatchingEligibility(profile)
  if (!eligibility.eligible) throw new Error(`Profile is not eligible for matching: ${eligibility.reasons.join(' ')}`)
  if (!input.sourceProvenance.length) throw new Error('A match requires source provenance.')
  const stableKey = stableMatchKey(profile.id, input.targetEntityType, input.targetEntityId, input.strategyVersionId)
  const admin = createAdminClient()
  const existing = await admin.from('participant_opportunity_matches').select('*').eq('stable_key', stableKey).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return { match: existing.data, created: false }

  const task = await createAdminTask({
    title: `Review ${profile.role.replaceAll('_', ' ')} opportunity match`,
    description: 'Review fit, source freshness, uncertainty, consent boundaries, and customer-safe wording. Approval does not authorize outreach.',
    taskType: 'opportunity_match_review',
    priority: input.uncertainty === 'high' ? 'high' : 'normal',
    userId: profile.owner_user_id,
    userEmail: profile.contact_email,
    entityType: 'participant_profile',
    entityId: profile.id,
    dueAt: adminTaskDueDates.days(1),
    metadata: { targetEntityType: input.targetEntityType, targetEntityId: input.targetEntityId, stableKey },
    createdBy: 'gate-4e3-matching',
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'Match review task could not be created.')
  const { data, error } = await admin.from('participant_opportunity_matches').insert({
    participant_profile_id: profile.id,
    strategy_version_id: input.strategyVersionId,
    target_entity_type: input.targetEntityType,
    target_entity_id: input.targetEntityId,
    stable_key: stableKey,
    status: 'proposed',
    score: input.score,
    score_explanation_json: input.scoreExplanation,
    exclusion_reasons_json: input.exclusions || [],
    source_provenance_json: input.sourceProvenance,
    source_observed_at: input.sourceObservedAt || null,
    uncertainty: input.uncertainty,
    customer_safe_summary: input.customerSafeSummary,
    operator_owner_user_id: input.operatorOwnerUserId || null,
    crm_lead_id: profile.crm_lead_id,
    admin_task_id: task.task.id,
    outreach_eligible: false,
  }).select('*').single()
  if (error) throw error
  await admin.from('participant_opportunity_match_events').insert({
    match_id: data.id,
    actor_kind: 'system',
    event_type: 'match_proposed',
    to_status: 'proposed',
    customer_visible: false,
    metadata_json: { strategyVersionId: input.strategyVersionId, stableKey },
  })
  return { match: data, created: true }
}

export async function reviewOpportunityMatch(input: {
  matchId: string
  status: Exclude<OpportunityMatchStatus, 'proposed' | 'archived'>
  actorUserId: string
  note?: string
  correction?: Record<string, unknown>
}) {
  if (input.status === 'needs_information' && (!input.note || input.note.trim().length < 10)) {
    throw new Error('A customer-safe question is required when requesting information.')
  }
  const admin = createAdminClient()
  const existing = await admin.from('participant_opportunity_matches').select('*').eq('id', input.matchId).maybeSingle()
  if (existing.error) throw existing.error
  if (!existing.data) throw new Error('Opportunity match not found.')
  if (!['proposed', 'deferred', 'needs_information', 'approved'].includes(existing.data.status)) {
    throw new Error('This match is no longer reviewable.')
  }
  const now = new Date().toISOString()
  const updated = await admin.from('participant_opportunity_matches').update({
    status: input.status,
    reviewed_by_user_id: input.actorUserId,
    reviewed_at: now,
    updated_at: now,
    outreach_eligible: false,
    score_explanation_json: input.correction
      ? { ...(existing.data.score_explanation_json || {}), operatorCorrection: input.correction }
      : existing.data.score_explanation_json,
  }).eq('id', input.matchId).eq('status', existing.data.status).select('*').single()
  if (updated.error) throw updated.error
  const event = await admin.from('participant_opportunity_match_events').insert({
    match_id: input.matchId,
    actor_user_id: input.actorUserId,
    actor_kind: 'operator',
    event_type: `match_${input.status}`,
    from_status: existing.data.status,
    to_status: input.status,
    note: input.note || null,
    customer_visible: input.status === 'approved' || input.status === 'needs_information',
    metadata_json: input.correction ? { correction: input.correction } : {},
  })
  if (event.error) throw event.error
  return updated.data
}

export async function listAdminOpportunityMatches(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('participant_opportunity_matches')
    .select('*, participant_profiles!inner(id,role,status,display_name,organization_name,matching_consent,outreach_consent,last_verified_at,owner_user_id), strategy_lane_versions(id,lane_key,version,title)')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data || []
}

export async function listCustomerOpportunityMatches(userId: string) {
  const admin = createAdminClient()
  const profiles = await admin.from('participant_profiles').select('id')
    .eq('owner_user_id', userId).eq('origin', 'customer').eq('status', 'active').eq('matching_consent', true)
  if (profiles.error) throw profiles.error
  const ids = (profiles.data || []).map((row) => row.id)
  if (!ids.length) return []
  const matches = await admin.from('participant_opportunity_matches')
    .select('id,participant_profile_id,status,customer_safe_summary,uncertainty,source_observed_at,reviewed_at,created_at,updated_at,strategy_lane_versions(title)')
    .in('participant_profile_id', ids).in('status', ['approved', 'needs_information']).order('created_at', { ascending: false }).limit(100)
  if (matches.error) throw matches.error
  const rows = matches.data || []
  if (!rows.length) return []
  const events = await admin.from('participant_opportunity_match_events')
    .select('match_id,event_type,note,created_at').in('match_id', rows.map((row) => row.id))
    .eq('customer_visible', true).order('created_at', { ascending: false })
  if (events.error) throw events.error
  const latestNotes = new Map<string, { note: string | null; created_at: string }>()
  for (const event of events.data || []) {
    if (!latestNotes.has(event.match_id)) latestNotes.set(event.match_id, { note: event.note, created_at: event.created_at })
  }
  return rows.map((row) => ({
    ...row,
    customer_note: latestNotes.get(row.id)?.note || null,
    next_action_href: `/workspace/profiles/${row.participant_profile_id}`,
  }))
}
