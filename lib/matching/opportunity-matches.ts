import 'server-only'

import { createHash } from 'node:crypto'

import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'
import { getParticipantProfile, type ParticipantProfileRecord } from '@/lib/participant-profiles/server'
import {
  recordOperatingStrategyActivity,
  resolveOperatingStrategyBinding,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'

export type OpportunityMatchStatus = 'proposed' | 'approved' | 'dismissed' | 'deferred' | 'needs_information' | 'archived'

function stableMatchKey(
  profileId: string,
  targetType: string,
  targetId: string,
  binding: OperatingStrategyBinding
) {
  return createHash('sha256')
    .update([
      profileId,
      targetType,
      targetId,
      binding.operatingStrategyVersionId,
      binding.contractFingerprint,
    ].join('|'))
    .digest('hex')
}

const MATCH_STRATEGY_BY_ROLE: Partial<Record<ParticipantProfileRecord['role'], string>> = {
  buyer: 'buyer_buy_box_activation',
  lender: 'lender_provider_criteria',
  investor: 'investor_capital_relationships',
  service_provider: 'service_provider_network',
  real_estate_agent: 'service_provider_network',
  wholesaler: 'buyer_buy_box_activation',
  builder: 'service_provider_network',
  developer: 'service_provider_network',
  business_buyer: 'business_acquisition_network',
  business_seller: 'business_acquisition_network',
}

type CanonicalMatchRow = {
  id: string
  created_at?: string | null
  updated_at?: string | null
  canonical_activity_id?: string | null
  operating_strategy_version_id?: string | null
  operating_contract_fingerprint?: string | null
  [key: string]: unknown
}

type MatchEventRow = {
  id: string
  match_id: string
  actor_user_id: string | null
  actor_kind: 'operator' | 'customer' | 'system'
  event_type: string
  from_status: string | null
  to_status: string | null
  note: string | null
  customer_visible: boolean
  metadata_json: Record<string, unknown> | null
  created_at: string
}

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalJsonValue(item)])
    )
  }
  return value ?? null
}

function stableEvidenceDigest(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJsonValue(value)))
    .digest('hex')
}

function stableEventId(evidenceKey: string) {
  const hex = createHash('sha256')
    .update(`participant-opportunity-match-event:${evidenceKey}`)
    .digest('hex')
    .slice(0, 32)
    .split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4]
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function assertExactMatchEvent(
  event: MatchEventRow,
  input: {
    eventId: string
    matchId: string
    actorUserId: string | null
    actorKind: MatchEventRow['actor_kind']
    eventType: string
    toStatus: string
    note: string | null
    customerVisible: boolean
    evidenceKey: string
  }
) {
  if (
    event.id !== input.eventId ||
    event.match_id !== input.matchId ||
    event.actor_user_id !== input.actorUserId ||
    event.actor_kind !== input.actorKind ||
    event.event_type !== input.eventType ||
    event.to_status !== input.toStatus ||
    event.note !== input.note ||
    event.customer_visible !== input.customerVisible ||
    String(event.metadata_json?.evidenceKey || '') !== input.evidenceKey
  ) {
    throw new Error('Opportunity-match event identity conflicts with immutable review evidence.')
  }
  return event
}

async function findMatchEvent(evidenceKey: string) {
  const admin = createAdminClient()
  const eventId = stableEventId(evidenceKey)
  const { data, error } = await admin
    .from('participant_opportunity_match_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return { eventId, event: (data || null) as MatchEventRow | null }
}

async function ensureMatchEvent(input: {
  evidenceKey: string
  matchId: string
  actorUserId: string | null
  actorKind: MatchEventRow['actor_kind']
  eventType: string
  fromStatus: string | null
  toStatus: string
  note: string | null
  customerVisible: boolean
  occurredAt: string
  metadata?: Record<string, unknown>
}) {
  const expected = {
    eventId: stableEventId(input.evidenceKey),
    matchId: input.matchId,
    actorUserId: input.actorUserId,
    actorKind: input.actorKind,
    eventType: input.eventType,
    toStatus: input.toStatus,
    note: input.note,
    customerVisible: input.customerVisible,
    evidenceKey: input.evidenceKey,
  }
  const existing = await findMatchEvent(input.evidenceKey)
  if (existing.event) return assertExactMatchEvent(existing.event, expected)

  const admin = createAdminClient()
  const payload = {
    id: expected.eventId,
    match_id: input.matchId,
    actor_user_id: input.actorUserId,
    actor_kind: input.actorKind,
    event_type: input.eventType,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note,
    customer_visible: input.customerVisible,
    metadata_json: { ...(input.metadata || {}), evidenceKey: input.evidenceKey },
    created_at: input.occurredAt,
  }
  const inserted = await admin
    .from('participant_opportunity_match_events')
    .insert(payload)
    .select('*')
    .single()
  if (!inserted.error) return assertExactMatchEvent(inserted.data as MatchEventRow, expected)
  if (inserted.error.code !== '23505') throw inserted.error

  const concurrent = await findMatchEvent(input.evidenceKey)
  if (!concurrent.event) throw inserted.error
  return assertExactMatchEvent(concurrent.event, expected)
}

function assertMatchStrategyRole(profile: ParticipantProfileRecord, binding: OperatingStrategyBinding) {
  const expected = MATCH_STRATEGY_BY_ROLE[profile.role]
  if (!expected || binding.strategyKey !== expected) {
    throw new Error(
      `Profile role ${profile.role} cannot be matched through operating strategy ${binding.strategyKey}.`
    )
  }
}

async function ensureCanonicalMatchActivity(input: {
  match: CanonicalMatchRow
  binding: OperatingStrategyBinding
  participantProfileId: string
  targetEntityType: string
  targetEntityId: string
  sourceProvenance: Array<Record<string, unknown>>
  sourceObservedAt?: string | null
  stableKey: string
}) {
  if (input.match.canonical_activity_id) return input.match.canonical_activity_id as string
  const occurredAt = String(
    input.match.created_at || input.sourceObservedAt || new Date().toISOString()
  )
  const activityId = await recordOperatingStrategyActivity({
    binding: input.binding,
    activityType: 'domain_event',
    activityNamespace: 'participant_opportunity_match',
    activityKey: String(input.match.id),
    subjectNamespace: 'participant_profile',
    subjectKey: input.participantProfileId,
    idempotencyKey: `opportunity-match:${input.binding.operatingStrategyVersionId}:${input.match.id}:proposed`,
    occurredAt,
    provenance: input.sourceProvenance,
    metadata: {
      matchId: input.match.id,
      stableKey: input.stableKey,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      sourceObservedAt: input.sourceObservedAt || null,
      lifecycleEvent: 'match_proposed',
    },
  })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_opportunity_matches')
    .update({ canonical_activity_id: activityId, updated_at: new Date().toISOString() })
    .eq('id', input.match.id)
    .eq('operating_strategy_version_id', input.binding.operatingStrategyVersionId)
    .is('canonical_activity_id', null)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const current = await admin
      .from('participant_opportunity_matches')
      .select('*')
      .eq('id', input.match.id)
      .eq('canonical_activity_id', activityId)
      .maybeSingle()
    if (current.error) throw current.error
    if (!current.data) throw new Error('Canonical match activity could not be linked exactly once.')
    return activityId
  }
  Object.assign(input.match, data)
  return activityId
}

async function ensureProposedMatchEvidence(input: {
  match: CanonicalMatchRow
  binding: OperatingStrategyBinding
}) {
  const occurredAt = String(input.match.created_at || '').trim()
  if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) {
    throw new Error('A governed opportunity match requires a stable creation timestamp.')
  }
  const participantProfileId = String(input.match.participant_profile_id || '')
  const targetEntityType = String(input.match.target_entity_type || '')
  const targetEntityId = String(input.match.target_entity_id || '')
  const stableKey = String(input.match.stable_key || '')
  const sourceProvenance = Array.isArray(input.match.source_provenance_json)
    ? input.match.source_provenance_json as Array<Record<string, unknown>>
    : []
  if (!participantProfileId || !targetEntityType || !targetEntityId || !stableKey || !sourceProvenance.length) {
    throw new Error('A governed opportunity match is missing immutable proposed-event evidence.')
  }
  const evidenceKey = `opportunity-match-proposed:${input.binding.operatingStrategyVersionId}:${input.match.id}`
  await ensureMatchEvent({
    evidenceKey,
    matchId: input.match.id,
    actorUserId: null,
    actorKind: 'system',
    eventType: 'match_proposed',
    fromStatus: null,
    toStatus: 'proposed',
    note: null,
    customerVisible: false,
    occurredAt,
    metadata: {
      legacyStrategyVersionId: input.match.strategy_version_id || null,
      operatingStrategyVersionId: input.binding.operatingStrategyVersionId,
      operatingContractFingerprint: input.binding.contractFingerprint,
      stableKey,
    },
  })
  return ensureCanonicalMatchActivity({
    match: input.match,
    binding: input.binding,
    participantProfileId,
    targetEntityType,
    targetEntityId,
    sourceProvenance,
    sourceObservedAt: String(input.match.source_observed_at || '') || null,
    stableKey,
  })
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
  strategyIdentifierNamespace: string
  strategyIdentifier: string
  legacyStrategyVersionId?: string | null
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
  const binding = await resolveOperatingStrategyBinding({
    namespace: input.strategyIdentifierNamespace,
    sourceIdentifier: input.strategyIdentifier,
  })
  const profile = await getParticipantProfile(input.participantProfileId)
  if (!profile) throw new Error('Participant profile not found.')
  assertMatchStrategyRole(profile, binding)
  const eligibility = participantMatchingEligibility(profile)
  if (!eligibility.eligible) throw new Error(`Profile is not eligible for matching: ${eligibility.reasons.join(' ')}`)
  if (!input.sourceProvenance.length) throw new Error('A match requires source provenance.')
  const stableKey = stableMatchKey(profile.id, input.targetEntityType, input.targetEntityId, binding)
  const admin = createAdminClient()
  const existing = await admin.from('participant_opportunity_matches').select('*').eq('stable_key', stableKey).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    if (
      existing.data.operating_strategy_version_id !== binding.operatingStrategyVersionId ||
      existing.data.operating_contract_fingerprint !== binding.contractFingerprint
    ) {
      throw new Error('The existing opportunity match is bound to a different operating contract.')
    }
    await ensureProposedMatchEvidence({ match: existing.data, binding })
    return { match: existing.data, created: false }
  }

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
    metadata: {
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      stableKey,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      operatingContractFingerprint: binding.contractFingerprint,
    },
    createdBy: 'gate-4e3-matching',
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'Match review task could not be created.')
  const createdAt = new Date().toISOString()
  const inserted = await admin.from('participant_opportunity_matches').insert({
    participant_profile_id: profile.id,
    strategy_version_id: input.legacyStrategyVersionId || null,
    strategy_key: binding.sourceIdentifier,
    strategy_identifier_namespace: binding.namespace,
    operating_strategy_id: binding.operatingStrategyId,
    operating_strategy_version_id: binding.operatingStrategyVersionId,
    strategy_binding_mode: 'governed_v1',
    strategy_binding_recorded_at: createdAt,
    strategy_writer_release: 'gate_3c',
    destination_mode_snapshot: binding.destinationMode,
    destination_path_snapshot: binding.destinationPath,
    cta_label_snapshot: binding.ctaLabel,
    operating_contract_fingerprint: binding.contractFingerprint,
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
    created_at: createdAt,
    updated_at: createdAt,
  }).select('*').single()
  let match = inserted.data as CanonicalMatchRow | null
  let created = true
  if (inserted.error) {
    if (inserted.error.code !== '23505') throw inserted.error
    const concurrent = await admin
      .from('participant_opportunity_matches')
      .select('*')
      .eq('stable_key', stableKey)
      .maybeSingle()
    if (concurrent.error) throw concurrent.error
    if (!concurrent.data) throw inserted.error
    match = concurrent.data
    created = false
  }
  if (!match) throw new Error('Opportunity match was not persisted.')
  if (
    match.operating_strategy_version_id !== binding.operatingStrategyVersionId ||
    match.operating_contract_fingerprint !== binding.contractFingerprint
  ) {
    throw new Error('The persisted opportunity match conflicts with the resolved operating contract.')
  }
  await ensureProposedMatchEvidence({ match, binding })
  return { match, created }
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
  if (
    existing.data.strategy_binding_mode !== 'governed_v1' ||
    !existing.data.strategy_identifier_namespace ||
    !existing.data.strategy_key ||
    !existing.data.operating_strategy_version_id ||
    !existing.data.operating_contract_fingerprint
  ) {
    throw new Error('Legacy opportunity matches are historical-only and cannot enter the governed review flow.')
  }
  const binding = await resolveOperatingStrategyBinding({
    namespace: existing.data.strategy_identifier_namespace,
    sourceIdentifier: existing.data.strategy_key,
  })
  if (
    binding.operatingStrategyVersionId !== existing.data.operating_strategy_version_id ||
    binding.contractFingerprint !== existing.data.operating_contract_fingerprint
  ) {
    throw new Error('The opportunity match is not bound to the currently active operating contract.')
  }
  const parentActivityId = await ensureProposedMatchEvidence({ match: existing.data, binding })
  const note = input.note || null
  const correction = input.correction || null
  const requestDigest = stableEvidenceDigest({
    matchId: input.matchId,
    status: input.status,
    actorUserId: input.actorUserId,
    note,
    correction,
  })
  const evidenceKey = `opportunity-match-review:${binding.operatingStrategyVersionId}:${input.matchId}:${requestDigest}`
  const expectedEvent = {
    eventId: stableEventId(evidenceKey),
    matchId: input.matchId,
    actorUserId: input.actorUserId,
    actorKind: 'operator' as const,
    eventType: `match_${input.status}`,
    toStatus: input.status,
    note,
    customerVisible: input.status === 'approved' || input.status === 'needs_information',
    evidenceKey,
  }
  const priorEvent = await findMatchEvent(evidenceKey)
  const alreadyApplied = existing.data.status === input.status
  if (
    !priorEvent.event &&
    !alreadyApplied &&
    !['proposed', 'deferred', 'needs_information', 'approved'].includes(existing.data.status)
  ) {
    throw new Error('This match is no longer reviewable.')
  }
  const recoveredAt = String(existing.data.reviewed_at || '')
  const occurredAt = alreadyApplied && Number.isFinite(Date.parse(recoveredAt))
    ? recoveredAt
    : new Date().toISOString()
  const event = priorEvent.event
    ? assertExactMatchEvent(priorEvent.event, expectedEvent)
    : await ensureMatchEvent({
        evidenceKey,
        matchId: input.matchId,
        actorUserId: input.actorUserId,
        actorKind: 'operator',
        eventType: expectedEvent.eventType,
        fromStatus: existing.data.status,
        toStatus: input.status,
        note,
        customerVisible: expectedEvent.customerVisible,
        occurredAt,
        metadata: {
          correction,
          requestDigest,
          recoveredFromAppliedState: alreadyApplied,
        },
      })

  let reviewedMatch = existing.data
  if (reviewedMatch.status !== input.status) {
    if (reviewedMatch.status !== event.from_status) {
      throw new Error('Opportunity-match state changed after this review evidence was recorded.')
    }
    const updated = await admin.from('participant_opportunity_matches').update({
      status: input.status,
      reviewed_by_user_id: input.actorUserId,
      reviewed_at: event.created_at,
      updated_at: event.created_at,
      outreach_eligible: false,
      score_explanation_json: correction
        ? { ...(reviewedMatch.score_explanation_json || {}), operatorCorrection: correction }
        : reviewedMatch.score_explanation_json,
    }).eq('id', input.matchId).eq('status', event.from_status).select('*').maybeSingle()
    if (updated.error) throw updated.error
    if (updated.data) {
      reviewedMatch = updated.data
    } else {
      const current = await admin
        .from('participant_opportunity_matches')
        .select('*')
        .eq('id', input.matchId)
        .maybeSingle()
      if (current.error) throw current.error
      if (!current.data || current.data.status !== input.status) {
        throw new Error('Opportunity-match review did not apply exactly once.')
      }
      reviewedMatch = current.data
    }
  }
  await recordOperatingStrategyActivity({
    binding,
    activityType: 'operator_review',
    activityNamespace: 'participant_opportunity_match_review',
    activityKey: event.id,
    subjectNamespace: 'participant_profile',
    subjectKey: existing.data.participant_profile_id,
    parentActivityId,
    idempotencyKey: `opportunity-match-review:${binding.operatingStrategyVersionId}:${event.id}`,
    occurredAt: event.created_at,
    provenance: [
      {
        kind: 'operator_review',
        actorUserId: input.actorUserId,
        eventType: `match_${input.status}`,
        matchEventId: event.id,
      },
    ],
    metadata: {
      matchId: input.matchId,
      matchEventId: event.id,
      requestDigest,
      fromStatus: event.from_status,
      toStatus: input.status,
      noteRecorded: Boolean(input.note),
      correctionRecorded: Boolean(input.correction),
      outreachAuthorized: false,
    },
  })
  return reviewedMatch
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
