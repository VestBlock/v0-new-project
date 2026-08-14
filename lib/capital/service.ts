import type { User } from '@supabase/supabase-js'
import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { capitalPathCatalog } from '@/lib/capital/catalog'
import { assessCapitalReadiness } from '@/lib/capital/readiness'
import type { CapitalCaseRecord, CapitalCaseStatus, CapitalCaseType } from '@/lib/capital/types'
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation'
import { upsertLender, updateLenderRecord, insertLenderRelationshipEvent } from '@/lib/lenders/repository'
import type { LenderCategory, LenderType } from '@/lib/lenders/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

type Intake = {
  caseType: CapitalCaseType
  fullName: string
  email: string
  phone?: string
  organizationName?: string
  amountRequested?: number | null
  purpose?: string
  timing?: string
  geography?: string
  communicationPreference: 'email' | 'phone' | 'either'
  analysisConsent: boolean
  providerSharingConsent: boolean
  marketingConsent: boolean
  intakeData: Record<string, unknown>
  availableDocuments: string[]
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseStates(value: unknown) {
  return Array.from(new Set(stringValue(value).split(/[,;\n]/).map((item) => item.trim().toUpperCase()).filter(Boolean))).slice(0, 60)
}

function providerMapping(value: unknown): { lenderType: LenderType; category: LenderCategory } {
  if (value === 'business') return { lenderType: 'business', category: 'line_of_credit' }
  if (value === 'cdfi') return { lenderType: 'specialty', category: 'cdfi' }
  if (value === 'broker') return { lenderType: 'specialty', category: 'creative_finance_partner' }
  if (value === 'hard_money') return { lenderType: 'real_estate', category: 'hard_money' }
  if (value === 'dscr') return { lenderType: 'real_estate', category: 'dscr' }
  if (value === 'commercial') return { lenderType: 'real_estate', category: 'commercial' }
  return { lenderType: 'real_estate', category: 'private_lender' }
}

function leadTypeFor(caseType: CapitalCaseType) {
  if (caseType === 'real_estate_funding') return 'real_estate'
  return 'business_funding'
}

export async function recordCapitalCaseEvent(input: {
  caseId: string
  actorUserId?: string | null
  eventType: string
  fromStatus?: CapitalCaseStatus | null
  toStatus?: CapitalCaseStatus | null
  note?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('capital_case_events').insert({
    capital_case_id: input.caseId,
    actor_user_id: input.actorUserId || null,
    event_type: input.eventType,
    from_status: input.fromStatus || null,
    to_status: input.toStatus || null,
    note: input.note || null,
    metadata_json: input.metadata || {},
  })
  if (error) throw error
}

async function ensureCapitalLead(caseRecord: CapitalCaseRecord, intake: Intake) {
  if (caseRecord.case_type === 'capital_provider' || caseRecord.lead_id) return caseRecord.lead_id
  const admin = createAdminClient()
  const path = capitalPathCatalog[caseRecord.case_type]
  const externalId = `capital-case:${caseRecord.id}`
  const leadPayload = {
    lead_type: leadTypeFor(caseRecord.case_type),
    status: 'new',
    source: 'capital_case',
    source_url: `/capital?path=${path.slug}`,
    external_id: externalId,
    category: caseRecord.case_type,
    name: intake.fullName,
    business_name: intake.organizationName || null,
    email: intake.email,
    phone: intake.phone || null,
    state: intake.geography || null,
    best_offer: path.title,
    pain_signal: `${path.title}: ${intake.purpose || 'Capital objective'}; requested ${intake.amountRequested || 'not stated'}.`,
    contact_info: {
      name: intake.fullName,
      email: intake.email,
      phone: intake.phone || null,
      communicationPreference: intake.communicationPreference,
    },
    form_data: {
      capitalCaseId: caseRecord.id,
      intake: intake.intakeData,
      readinessScore: caseRecord.readiness_score,
      readinessTier: caseRecord.readiness_tier,
      missingDocuments: caseRecord.missing_documents,
      providerSharingConsent: intake.providerSharingConsent,
      disclaimer: path.boundary,
    },
    metadata_json: {
      capitalCaseId: caseRecord.id,
      capitalCaseType: caseRecord.case_type,
      responsibleUse: true,
    },
    market_segment: caseRecord.case_type,
    outreach_angle: 'Customer-requested Capital review',
    outreach_status: 'needs_review',
    owner_user_id: caseRecord.user_id,
    notes: caseRecord.readiness_feedback?.summary || path.after,
  }

  const { data: existing } = await admin.from('leads').select('id').eq('source', 'capital_case').eq('external_id', externalId).maybeSingle()
  const result = existing?.id
    ? await admin.from('leads').update(leadPayload).eq('id', existing.id).select('id').single()
    : await admin.from('leads').insert(leadPayload).select('id').single()
  if (result.error || !result.data?.id) throw result.error || new Error('Capital CRM record was not created.')
  return result.data.id as string
}

async function ensureCapitalProvider(caseRecord: CapitalCaseRecord, intake: Intake) {
  if (caseRecord.case_type !== 'capital_provider') return caseRecord.lender_id
  const provider = providerMapping(intake.intakeData.providerType)
  const states = parseStates(intake.intakeData.statesServed || intake.geography)
  const lender = await upsertLender({
    name: intake.organizationName || intake.fullName,
    lenderType: provider.lenderType,
    category: provider.category,
    statesServed: states,
    nationalOrRegional: states.length > 8 ? 'national' : states.length > 1 ? 'multi_state' : 'local',
    contactEmail: intake.email,
    contactPhone: intake.phone || null,
    contactName: intake.fullName,
    source: 'capital_case',
    sourceUrl: '/capital?path=capital-provider',
    externalId: `capital-case:${caseRecord.id}`,
    fitSummary: stringValue(intake.intakeData.preferredProfiles),
    notes: [stringValue(intake.intakeData.preferredProfiles), stringValue(intake.intakeData.noGoItems)].filter(Boolean).join('\n\n'),
    loanAmountMin: numberValue(intake.intakeData.minimumAmount),
    loanAmountMax: numberValue(intake.intakeData.maximumAmount),
    speedToClose: stringValue(intake.intakeData.turnaround) || null,
    investorAllowed: provider.lenderType === 'real_estate',
    contactInfo: { name: intake.fullName, email: intake.email, phone: intake.phone || null },
    metadata: {
      capitalCaseId: caseRecord.id,
      partnerProfile: {
        preferredBorrowers: stringValue(intake.intakeData.preferredProfiles),
        noGoItems: stringValue(intake.intakeData.noGoItems),
        submissionNotes: stringValue(intake.intakeData.requiredDocs),
        partnerProcessOwner: intake.fullName,
        relationshipModel: stringValue(intake.intakeData.relationshipModel),
        criteriaVerifiedAt: stringValue(intake.intakeData.criteriaVerifiedAt),
        referralProgramStatus: 'capital_case_submitted',
      },
    },
  })
  await updateLenderRecord(lender.id, {
    relationship_stage: 'reviewing',
    outreach_status: 'responded',
    owner_user_id: caseRecord.user_id,
  })
  await insertLenderRelationshipEvent({
    lenderId: lender.id,
    eventType: 'capital_provider_profile_submitted',
    actorUserId: caseRecord.user_id,
    metadata: { capitalCaseId: caseRecord.id },
  })
  return lender.id
}

export async function submitCapitalCase(caseRecord: CapitalCaseRecord, intake: Intake, actor: User | null) {
  const admin = createAdminClient()
  const path = capitalPathCatalog[caseRecord.case_type]
  const [leadId, lenderId] = await Promise.all([
    ensureCapitalLead(caseRecord, intake),
    ensureCapitalProvider(caseRecord, intake),
  ])
  const task = await createAdminTask({
    title: `Review ${path.title.toLowerCase()} case`,
    description: [
      `${intake.fullName} submitted a ${path.title.toLowerCase()} case for VestBlock review.`,
      `Readiness: ${caseRecord.readiness_score}/100 (${caseRecord.readiness_tier.replaceAll('_', ' ')}).`,
      caseRecord.missing_documents.length ? `Documents still needed: ${caseRecord.missing_documents.join('; ')}.` : 'The stated document checklist is complete.',
      'Confirm facts, request missing information when needed, and do not represent a provider decision as a VestBlock decision.',
    ].join('\n\n'),
    taskType: 'capital_case_review',
    priority: caseRecord.readiness_tier === 'incomplete' ? 'normal' : 'high',
    userId: caseRecord.user_id,
    userEmail: intake.email,
    entityType: 'capital_case',
    entityId: caseRecord.id,
    dueAt: adminTaskDueDates.days(1),
    metadata: {
      caseType: caseRecord.case_type,
      readinessScore: caseRecord.readiness_score,
      readinessTier: caseRecord.readiness_tier,
      leadId,
      lenderId,
      nextAction: 'Review intake, assign owner, and update the Capital case status.',
    },
  })
  if (!task.ok || !task.task?.id) {
    throw new Error(task.error || 'Capital operator task was not created.')
  }
  const taskId = task.ok && task.task?.id ? task.task.id : null
  const { data, error } = await admin.from('capital_cases').update({
    lead_id: leadId || null,
    lender_id: lenderId || null,
    operator_task_id: taskId,
  }).eq('id', caseRecord.id).select('*').single()
  if (error) throw error

  if (leadId) {
    await runNewLeadAutomation({
      leadId,
      leadType: leadTypeFor(caseRecord.case_type),
      name: intake.fullName,
      email: intake.email,
      phone: intake.phone || null,
      ownerUserId: caseRecord.user_id,
      sourcePath: `/capital?path=${path.slug}`,
      summary: caseRecord.readiness_feedback?.summary || path.after,
      metadata: { capitalCaseId: caseRecord.id, readinessScore: caseRecord.readiness_score },
    })
  }
  await logEvent({
    eventType: 'funding_strategy_submitted',
    actorUserId: actor?.id || caseRecord.user_id,
    entityType: 'capital_case',
    entityId: caseRecord.id,
    metadata: { caseType: caseRecord.case_type, leadId, lenderId, taskId },
  })
  return data as CapitalCaseRecord
}

export function capitalCasePayload(intake: Intake) {
  const readiness = assessCapitalReadiness({
    caseType: intake.caseType,
    fullName: intake.fullName,
    email: intake.email,
    phone: intake.phone,
    organizationName: intake.organizationName,
    amountRequested: intake.amountRequested,
    purpose: intake.purpose,
    timing: intake.timing,
    geography: intake.geography,
    intakeData: intake.intakeData,
    availableDocuments: intake.availableDocuments,
  })
  return { readiness, payload: {
    case_type: intake.caseType,
    full_name: intake.fullName,
    email: intake.email.toLowerCase(),
    phone: intake.phone || null,
    organization_name: intake.organizationName || null,
    amount_requested: intake.amountRequested ?? null,
    purpose: intake.purpose || null,
    timing: intake.timing || null,
    geography: intake.geography || null,
    communication_preference: intake.communicationPreference,
    analysis_consent: intake.analysisConsent,
    provider_sharing_consent: intake.providerSharingConsent,
    marketing_consent: intake.marketingConsent,
    intake_data: intake.intakeData,
    readiness_score: readiness.score,
    readiness_tier: readiness.tier,
    readiness_feedback: readiness.feedback,
    required_documents: readiness.requiredDocuments,
    available_documents: intake.availableDocuments,
    missing_documents: readiness.missingDocuments,
    provider_criteria: readiness.providerCriteria,
  } }
}
