import 'server-only'

import { randomBytes } from 'node:crypto'
import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { isConfiguredAdminEmail } from '@/lib/auth/admin-emails'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  PARTICIPANT_ROLE_DEFINITIONS,
  rolePublicKeys,
  type ParticipantRole,
  type ParticipantStatus,
} from '@/lib/participant-profiles/config'

export type ParticipantProfileRecord = {
  id: string
  owner_user_id: string
  role: ParticipantRole
  origin: 'customer' | 'operator' | 'imported' | 'discovered' | 'legacy'
  status: ParticipantStatus
  identity_type: 'individual' | 'organization'
  display_name: string
  organization_name: string
  contact_email: string
  contact_phone: string
  summary: string
  criteria_json: Record<string, unknown>
  communication_preferences_json: { email?: boolean; phone?: boolean }
  marketing_consent: boolean
  marketing_consent_at: string | null
  matching_consent: boolean
  matching_consent_at: string | null
  outreach_consent: boolean
  outreach_consent_at: string | null
  public_visibility_consent: boolean
  public_visibility_consented_at: string | null
  public_visibility_consent_version: string | null
  public_slug: string | null
  public_field_keys: string[]
  consent_version: string
  consent_recorded_at: string
  last_verified_at: string | null
  operator_verified_at: string | null
  operator_verification_note: string | null
  assigned_to: string | null
  account_profile_id: string | null
  crm_lead_id: string | null
  operator_task_id: string | null
  legacy_entity_type: string | null
  legacy_entity_id: string | null
  legacy_claim_status: string
  idempotency_key: string | null
  profile_version: number
  safe_failure_state: string | null
  safe_failure_message: string | null
  last_review_reason: string | null
  submitted_at: string | null
  activated_at: string | null
  paused_at: string | null
  withdrawn_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ParticipantEventRecord = {
  id: string
  participant_profile_id: string
  actor_user_id: string | null
  actor_kind: 'customer' | 'operator' | 'system'
  event_type: string
  from_status: string | null
  to_status: string | null
  note: string | null
  customer_visible: boolean
  metadata_json: Record<string, unknown>
  created_at: string
}

export function makePublicSlug(role: ParticipantRole) {
  return role.replaceAll('_', '-') + '-' + randomBytes(8).toString('hex')
}

export function consentUpdate(input: {
  previous: ParticipantProfileRecord | null
  marketingConsent?: boolean
  matchingConsent?: boolean
  outreachConsent?: boolean
  publicVisibilityConsent?: boolean
}) {
  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}
  const fields = [
    ['marketing_consent', 'marketing_consent_at', input.marketingConsent],
    ['matching_consent', 'matching_consent_at', input.matchingConsent],
    ['outreach_consent', 'outreach_consent_at', input.outreachConsent],
    ['public_visibility_consent', 'public_visibility_consented_at', input.publicVisibilityConsent],
  ] as const
  for (const [column, timestampColumn, value] of fields) {
    if (typeof value !== 'boolean') continue
    update[column] = value
    const previousValue = input.previous ? Boolean(input.previous[column as keyof ParticipantProfileRecord]) : false
    update[timestampColumn] = value ? (previousValue ? input.previous?.[timestampColumn as keyof ParticipantProfileRecord] || now : now) : null
  }
  if (typeof input.publicVisibilityConsent === 'boolean') {
    update.public_visibility_consent_version = input.publicVisibilityConsent ? 'gate-4e2-public-v1' : null
  }
  return update
}

export async function findAccountProfile(userId: string) {
  const admin = createAdminClient()
  const byUserId = await admin.from('user_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (byUserId.data?.id) return byUserId.data.id as string
  const byId = await admin.from('user_profiles').select('id').eq('id', userId).maybeSingle()
  return (byId.data?.id as string | undefined) || null
}

export async function getOwnedParticipantProfile(profileId: string, userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('owner_user_id', userId)
    .eq('origin', 'customer')
    .maybeSingle()
  if (error) throw error
  return data as ParticipantProfileRecord | null
}

export async function getParticipantProfile(profileId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('participant_profiles').select('*').eq('id', profileId).maybeSingle()
  if (error) throw error
  return data as ParticipantProfileRecord | null
}

export async function recordParticipantEvent(input: {
  profileId: string
  actorUserId?: string | null
  actorKind: 'customer' | 'operator' | 'system'
  eventType: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  customerVisible?: boolean
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('participant_profile_events').insert({
    participant_profile_id: input.profileId,
    actor_user_id: input.actorUserId || null,
    actor_kind: input.actorKind,
    event_type: input.eventType,
    from_status: input.fromStatus || null,
    to_status: input.toStatus || null,
    note: input.note || null,
    customer_visible: input.customerVisible ?? true,
    metadata_json: input.metadata || {},
  })
  if (error) throw error
}

export async function loadParticipantEvents(profileId: string, customerOnly: boolean) {
  const admin = createAdminClient()
  let query = admin
    .from('participant_profile_events')
    .select('*')
    .eq('participant_profile_id', profileId)
    .order('created_at', { ascending: true })
  if (customerOnly) query = query.eq('customer_visible', true)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ParticipantEventRecord[]
}

export function customerParticipantProfile(profile: ParticipantProfileRecord) {
  const {
    owner_user_id: _ownerUserId,
    origin: _origin,
    assigned_to: _assignedTo,
    account_profile_id: _accountProfileId,
    crm_lead_id: _crmLeadId,
    operator_task_id: _operatorTaskId,
    legacy_entity_id: _legacyEntityId,
    legacy_entity_type: _legacyEntityType,
    legacy_claim_status: _legacyClaimStatus,
    idempotency_key: _idempotencyKey,
    operator_verification_note: _operatorVerificationNote,
    safe_failure_message: _safeFailureMessage,
    ...customer
  } = profile
  return customer
}

export function customerParticipantEvent(event: ParticipantEventRecord) {
  const {
    actor_user_id: _actorUserId,
    metadata_json: _metadata,
    customer_visible: _customerVisible,
    ...customer
  } = event
  return customer
}

export async function ensureParticipantReviewTask(profile: ParticipantProfileRecord) {
  const task = await createAdminTask({
    title: 'Review ' + PARTICIPANT_ROLE_DEFINITIONS[profile.role].shortLabel.toLowerCase() + ' participant profile',
    description: 'Review the customer-approved criteria, consent boundaries, verification needs, and requested next status. Matching and outreach remain disabled.',
    taskType: 'participant_profile_review',
    priority: 'normal',
    userId: profile.owner_user_id,
    userEmail: profile.contact_email,
    entityType: 'participant_profile',
    entityId: profile.id,
    dueAt: adminTaskDueDates.days(1),
    metadata: { role: profile.role, origin: profile.origin, gate: '4E.2' },
    createdBy: 'gate-4e2-participant-profile',
  })
  if (!task.ok || !task.task?.id) throw new Error(task.error || 'The operator review task could not be created.')
  const admin = createAdminClient()
  const { error } = await admin.from('participant_profiles').update({
    operator_task_id: task.task.id,
    safe_failure_state: null,
    safe_failure_message: null,
  }).eq('id', profile.id)
  if (error) throw error
  return task.task.id as string
}

export function publicParticipantProfile(profile: ParticipantProfileRecord) {
  const eligible = new Set(rolePublicKeys(profile.role))
  const approved = new Set(profile.public_field_keys.filter((key) => eligible.has(key)))
  const criteria = Object.fromEntries(
    Object.entries(profile.criteria_json || {}).filter(([key]) => approved.has(key))
  )
  return {
    slug: profile.public_slug,
    role: profile.role,
    roleLabel: PARTICIPANT_ROLE_DEFINITIONS[profile.role].label,
    displayName: profile.display_name,
    organizationName: profile.organization_name || null,
    summary: profile.summary || null,
    criteria,
    lastVerifiedAt: profile.last_verified_at,
    providerSuppliedBoundary: profile.role === 'lender'
      ? 'Provider-supplied information is subject to underwriting, verification, availability, and change. It is not an approval, quote, or commitment.'
      : PARTICIPANT_ROLE_DEFINITIONS[profile.role].boundary,
    updatedAt: profile.updated_at,
  }
}

export function canCustomerEdit(status: ParticipantStatus) {
  return !['withdrawn', 'archived'].includes(status)
}

export function customerLifecycleTarget(profile: ParticipantProfileRecord, action: 'submit' | 'pause' | 'reactivate' | 'withdraw') {
  if (action === 'submit') {
    if (!['draft', 'needs_information', 'pending_review', 'declined'].includes(profile.status)) return null
    return 'pending_review' as ParticipantStatus
  }
  if (action === 'pause') {
    if (!['draft', 'pending_review', 'active', 'needs_information'].includes(profile.status)) return null
    return 'paused' as ParticipantStatus
  }
  if (action === 'reactivate') {
    if (profile.status !== 'paused') return null
    return (profile.activated_at && profile.last_verified_at ? 'active' : 'pending_review') as ParticipantStatus
  }
  if (action === 'withdraw') {
    if (['withdrawn', 'archived'].includes(profile.status)) return null
    return 'withdrawn' as ParticipantStatus
  }
  return null
}

export type OperatorDirectoryEntry = {
  id: string
  email: string
  name: string
}

export async function listOperatorDirectory() {
  const admin = createAdminClient()
  const [{ data: adminProfiles }, usersResult] = await Promise.all([
    admin.from('user_profiles').select('id,user_id,email,full_name,role').eq('role', 'admin').limit(500),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  if (usersResult.error) throw usersResult.error
  const adminIds = new Set<string>()
  const profileById = new Map<string, { full_name?: string | null; email?: string | null }>()
  for (const profile of adminProfiles || []) {
    if (profile.id) {
      adminIds.add(profile.id)
      profileById.set(profile.id, profile)
    }
    if (profile.user_id) {
      adminIds.add(profile.user_id)
      profileById.set(profile.user_id, profile)
    }
  }
  return usersResult.data.users.flatMap((user) => {
    const email = user.email?.trim().toLowerCase() || ''
    if (!email || (!adminIds.has(user.id) && !isConfiguredAdminEmail(email))) return []
    const profile = profileById.get(user.id)
    return [{
      id: user.id,
      email,
      name: profile?.full_name?.trim() || user.user_metadata?.full_name || email,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name))
}
