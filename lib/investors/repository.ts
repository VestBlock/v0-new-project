import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildInvestorFollowupMessage,
  buildInvestorOutreachMessage,
  inferFollowUpTasks,
  INVESTOR_OUTREACH_TEMPLATE_VERSION,
} from '@/lib/investors/outreach'
import {
  buildInvestorPipelineMetadata,
  buildInvestorPipelineSnapshot,
  buildInvestorPipelineSnapshotFromRecord,
} from '@/lib/investors/pipeline'
import { calculateInvestorScore, scoreExistingInvestor } from '@/lib/investors/scoring'
import { companyWebsiteDomain } from '@/lib/email/companyDomain'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { hashHunterVerificationEmail } from '@/lib/outreach/hunterSendVerificationCore'
import { isMessageGenerationProtected } from '@/lib/outreach/messageState'
import type {
  InvestorDashboardSummary,
  InvestorOutreachMessageRecord,
  InvestorOutreachStatus,
  InvestorProfileRecord,
  InvestorRelationshipStage,
  NormalizedInvestorInput,
} from '@/lib/investors/types'

function cleanArray(values?: string[] | null) {
  return Array.from(new Set((values || []).map((value) => value.trim()).filter(Boolean)))
}

function mergeArrays(existing?: string[] | null, incoming?: string[] | null) {
  return cleanArray([...(existing || []), ...(incoming || [])])
}

function nonBlank(value?: string | null) {
  const cleaned = value?.trim()
  return cleaned || null
}

function usableEmail(value?: string | null) {
  return isUsableContactEmail(value) ? normalizeEmailAddress(value) : null
}

function hasBuyBoxData(value?: NormalizedInvestorInput['estimatedBuyBox'] | null) {
  return Boolean(value && Object.values(value).some((entry) => Array.isArray(entry) ? entry.length > 0 : entry !== null && entry !== undefined && entry !== ''))
}

export function mergeInvestorRediscoveryInput(
  input: NormalizedInvestorInput,
  existing: InvestorProfileRecord | null
): NormalizedInvestorInput {
  if (!existing) {
    return {
      ...input,
      displayName: nonBlank(input.displayName) || input.displayName,
      personName: nonBlank(input.personName),
      llcName: nonBlank(input.llcName),
      companyName: nonBlank(input.companyName),
      contactEmail: usableEmail(input.contactEmail),
      contactPhone: nonBlank(input.contactPhone),
      website: nonBlank(input.website),
      linkedinUrl: nonBlank(input.linkedinUrl),
      facebookUrl: nonBlank(input.facebookUrl),
      classificationTags: cleanArray(input.classificationTags),
      markets: cleanArray(input.markets),
      propertyTypes: cleanArray(input.propertyTypes),
      financingIndicators: cleanArray(input.financingIndicators),
      sourceNames: cleanArray(input.sourceNames),
    }
  }

  return {
    ...input,
    displayName: nonBlank(input.displayName) || existing.display_name,
    personName: nonBlank(input.personName) || existing.person_name,
    llcName: nonBlank(input.llcName) || existing.llc_name,
    companyName: nonBlank(input.companyName) || existing.company_name,
    primaryInvestorType: input.primaryInvestorType || existing.primary_investor_type,
    classificationTags: mergeArrays(existing.classification_tags, input.classificationTags),
    // Discovery is additive. Preserve a verified usable contact, but allow an
    // invalid placeholder or generic inbox to be repaired by new evidence.
    contactEmail: usableEmail(existing.contact_email) || usableEmail(input.contactEmail),
    contactPhone: nonBlank(existing.contact_phone) || nonBlank(input.contactPhone),
    website: nonBlank(input.website) || existing.website,
    linkedinUrl: nonBlank(input.linkedinUrl) || existing.linkedin_url,
    facebookUrl: nonBlank(input.facebookUrl) || existing.facebook_url,
    markets: mergeArrays(existing.markets, input.markets),
    propertyTypes: mergeArrays(existing.property_types, input.propertyTypes),
    estimatedBuyBox: hasBuyBoxData(input.estimatedBuyBox)
      ? { ...(existing.estimated_buy_box || {}), ...(input.estimatedBuyBox || {}) }
      : existing.estimated_buy_box,
    financingIndicators: mergeArrays(existing.financing_indicators, input.financingIndicators),
    sourceNames: mergeArrays(existing.source_names, input.sourceNames),
    notes: nonBlank(input.notes) || existing.notes,
    metadata: {
      ...((existing.metadata_json || {}) as Record<string, unknown>),
      ...(input.metadata || {}),
    },
  }
}

function sourceConfidenceFor(input: NormalizedInvestorInput, existing: InvestorProfileRecord | null) {
  if (!input.evidence?.length) return Number(existing?.source_confidence_score || 0)
  const observed = Math.round(
    input.evidence.reduce((sum, row) => sum + (row.confidenceScore ?? 50), 0) / input.evidence.length
  )
  return Math.max(Number(existing?.source_confidence_score || 0), Math.max(0, Math.min(100, observed)))
}

function sourceIdentityFor(input: NormalizedInvestorInput) {
  if (input.sourceIdentity) return input.sourceIdentity
  if (input.contactEmail) return `email:${input.contactEmail.toLowerCase()}`
  if (input.website) return `website:${input.website.toLowerCase()}`
  return null
}

export const INVESTOR_HUNTER_LOOKUP_COOLDOWN_DAYS = 30
export const INVESTOR_HUNTER_ERROR_RETRY_HOURS = 6
export const INVESTOR_HUNTER_STALE_CLAIM_HOURS = 2

const COMMON_INVALID_CONTACT_PREFIXES = [
  'admin',
  'billing',
  'contact',
  'contact-us',
  'contactus',
  'hello',
  'info',
  'leasing',
  'mail',
  'main',
  'office',
  'operations',
  'sales',
  'service',
  'support',
  'team',
]

export function investorWebsiteDomain(website?: string | null) {
  return companyWebsiteDomain(website)
}

function hunterEnrichmentState(metadata?: Record<string, unknown> | null) {
  const value = metadata?.hunterContactEnrichment
  if (!value || typeof value !== 'object') return { checkedAt: null, status: null }
  const record = value as Record<string, unknown>
  const checkedAt = record.checkedAt
  return {
    checkedAt: typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)) ? checkedAt : null,
    status: typeof record.status === 'string' ? record.status : null,
  }
}

export function isInvestorHunterEnrichmentEligible(
  investor: Pick<InvestorProfileRecord, 'contact_email' | 'website' | 'metadata_json'>,
  now = new Date(),
  cooldownDays = INVESTOR_HUNTER_LOOKUP_COOLDOWN_DAYS
) {
  if (isUsableContactEmail(investor.contact_email)) return false
  if (!investorWebsiteDomain(investor.website)) return false

  const { checkedAt, status } = hunterEnrichmentState(investor.metadata_json)
  if (!checkedAt) return true
  const ageMs = now.getTime() - Date.parse(checkedAt)
  if (ageMs < 0) return false
  if (status === 'checking') return ageMs >= INVESTOR_HUNTER_STALE_CLAIM_HOURS * 3600000
  if (status === 'error' || status === 'skipped') return ageMs >= INVESTOR_HUNTER_ERROR_RETRY_HOURS * 3600000
  // Legacy rows without a status and terminal found/not_found results keep the
  // long cooldown so paid credits are not repeatedly consumed.
  return ageMs >= cooldownDays * 86400000
}

type InvestorHunterCandidateForPersistence = {
  email: string
  fullName?: string | null
  confidence: number
  verificationStatus?: string | null
}

type InvestorHunterEnrichmentForPersistence = {
  status: string
  domain?: string | null
  organization?: string | null
  checkedAt: string
  claimId?: string | null
  reservationId?: string | null
  budgetReason?: string | null
  candidate?: InvestorHunterCandidateForPersistence | null
  topCandidateConfidence?: number | null
  topCandidateVerificationStatus?: string | null
}

function safeHunterStatus(value: string) {
  return ['found', 'not_found', 'skipped', 'error', 'checking'].includes(value) ? value : 'error'
}

function safeMetadataText(value?: string | null, maximumLength = 160) {
  return value?.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximumLength) || null
}

function safeHunterOpaqueId(value?: string | null) {
  const normalized = value?.trim() || ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized.toLowerCase()
    : null
}

function safeHunterBudgetReason(value?: string | null) {
  return [
    'investor_hunter_daily_budget_exhausted',
    'investor_hunter_claim_already_reserved',
    'investor_hunter_budget_contention',
    'investor_hunter_budget_reservation_failed',
    'budget_date_is_missing_or_invalid',
    'budget_date_is_in_the_future',
    'budget_state_is_invalid',
    'budget_marker_date_is_invalid',
  ].includes(value || '')
    ? value
    : null
}

export function buildSanitizedInvestorHunterMetadata(input: InvestorHunterEnrichmentForPersistence) {
  const checkedTime = Date.parse(input.checkedAt)
  const checkedAt = Number.isFinite(checkedTime) ? new Date(checkedTime).toISOString() : new Date().toISOString()
  const confidence = Number(input.candidate?.confidence)
  const normalizedEmail = normalizeEmailAddress(input.candidate?.email)
  const candidateAccepted = Boolean(
    normalizedEmail &&
      isUsableContactEmail(normalizedEmail) &&
      input.candidate?.verificationStatus === 'valid' &&
      Number.isFinite(confidence) &&
      confidence >= 90
  )

  return {
    metadata: {
      provider: 'hunter',
      status: safeHunterStatus(input.status),
      domain: investorWebsiteDomain(input.domain) || safeMetadataText(input.domain, 120),
      organization: safeMetadataText(input.organization),
      checkedAt,
      claimId: safeHunterOpaqueId(input.claimId),
      reservationId: safeHunterOpaqueId(input.reservationId),
      budgetReason: safeHunterBudgetReason(input.budgetReason),
      accepted: candidateAccepted,
      acceptedRecipientHash: candidateAccepted
        ? hashHunterVerificationEmail(normalizedEmail)
        : null,
      acceptedConfidence: candidateAccepted ? confidence : null,
      acceptedVerificationStatus: candidateAccepted ? 'valid' : null,
      topCandidateConfidence: Number.isFinite(Number(input.topCandidateConfidence))
        ? Number(input.topCandidateConfidence)
        : null,
      topCandidateVerificationStatus: safeMetadataText(input.topCandidateVerificationStatus, 40),
    },
    candidate: candidateAccepted
      ? {
          email: normalizedEmail,
          fullName: safeMetadataText(input.candidate?.fullName, 120),
          confidence,
          verificationStatus: 'valid' as const,
        }
      : null,
  }
}

export async function upsertInvestorProfile(input: NormalizedInvestorInput) {
  const admin = createAdminClient()
  const sourceIdentity = sourceIdentityFor(input)
  let existing: InvestorProfileRecord | null = null

  if (sourceIdentity) {
    const { data } = await admin
      .from('investor_profiles')
      .select('*')
      .eq('metadata_json->>sourceIdentity', sourceIdentity)
      .maybeSingle()
    existing = (data as InvestorProfileRecord | null) || null
  }

  const mergedInput = mergeInvestorRediscoveryInput(input, existing)
  const score = calculateInvestorScore(mergedInput)
  const sourceConfidenceScore = sourceConfidenceFor(input, existing)
  const mergedMetadata = {
    ...(mergedInput.metadata || {}),
    ...(sourceIdentity ? { sourceIdentity } : {}),
  }
  const pipeline = buildInvestorPipelineSnapshot({
    relationshipStage: existing?.relationship_stage,
    outreachStatus: existing?.outreach_status,
    contactEmail: mergedInput.contactEmail,
    contactPhone: mergedInput.contactPhone,
    website: mergedInput.website,
    markets: mergedInput.markets,
    propertyTypes: mergedInput.propertyTypes,
    classificationTags: mergedInput.classificationTags,
    estimatedBuyBox: mergedInput.estimatedBuyBox,
    metadata: mergedMetadata,
    sourceConfidenceScore,
    sourceNames: mergedInput.sourceNames,
    sourceEvidenceCount: input.evidence?.length,
    displayName: mergedInput.displayName,
    primaryInvestorType: mergedInput.primaryInvestorType,
    notes: mergedInput.notes,
  })
  const preserveRelationshipStage =
    existing?.relationship_stage &&
    ['contacted', 'followup_due', 'responded', 'qualified', 'active_buyer', 'active_borrower', 'active_seller', 'active_partner', 'revenue_opportunity', 'paused', 'not_a_fit'].includes(
      existing.relationship_stage
    )
      ? existing.relationship_stage
      : null
  const preserveOutreachStatus =
    existing?.outreach_status &&
    ['queued', 'sent', 'responded', 'followup_due', 'failed', 'do_not_contact'].includes(existing.outreach_status)
      ? existing.outreach_status
      : null
  const relationshipStage =
    preserveRelationshipStage ||
    (pipeline.stage === 'discovered'
      ? 'discovered'
      : pipeline.stage === 'outreach_ready'
        ? 'outreach_ready'
        : 'researched')
  const outreachStatus = preserveOutreachStatus || (pipeline.outreachReady ? 'draft_ready' : 'not_started')
  const payload = {
    display_name: mergedInput.displayName,
    person_name: mergedInput.personName || null,
    llc_name: mergedInput.llcName || null,
    company_name: mergedInput.companyName || null,
    primary_investor_type: mergedInput.primaryInvestorType || 'fix_and_flip',
    classification_tags: cleanArray(mergedInput.classificationTags),
    contact_email: mergedInput.contactEmail || null,
    contact_phone: mergedInput.contactPhone || null,
    website: mergedInput.website || null,
    linkedin_url: mergedInput.linkedinUrl || null,
    facebook_url: mergedInput.facebookUrl || null,
    markets: cleanArray(mergedInput.markets),
    property_types: cleanArray(mergedInput.propertyTypes),
    estimated_buy_box: mergedInput.estimatedBuyBox || {},
    financing_indicators: cleanArray(mergedInput.financingIndicators),
    source_names: cleanArray(mergedInput.sourceNames),
    source_confidence_score: sourceConfidenceScore,
    recent_activity_score: score.recentActivity,
    transaction_volume_score: score.transactionVolume,
    geographic_fit_score: score.geographicFit,
    financing_need_score: score.financingNeed,
    disposition_need_score: score.dispositionNeed,
    partnership_potential_score: score.partnershipPotential,
    partnership_score: score.partnershipScore,
    deal_flow_fit: score.dealFlowFit,
    disposition_fit: score.dispositionFit,
    financing_fit: score.financingFit,
    partnership_fit: score.partnershipFit,
    assigned_sequence: score.assignedSequence,
    outreach_status: outreachStatus,
    relationship_stage: relationshipStage,
    notes: mergedInput.notes || score.fitSummary,
    last_scored_at: new Date().toISOString(),
    metadata_json: buildInvestorPipelineMetadata(
      {
        relationshipStage,
        outreachStatus,
        contactEmail: mergedInput.contactEmail,
        contactPhone: mergedInput.contactPhone,
        website: mergedInput.website,
        markets: mergedInput.markets,
        propertyTypes: mergedInput.propertyTypes,
        classificationTags: mergedInput.classificationTags,
        estimatedBuyBox: mergedInput.estimatedBuyBox,
        metadata: mergedMetadata,
        sourceConfidenceScore,
        sourceNames: mergedInput.sourceNames,
        sourceEvidenceCount: input.evidence?.length,
        displayName: mergedInput.displayName,
        primaryInvestorType: mergedInput.primaryInvestorType,
        notes: mergedInput.notes,
      },
      {
        ...(sourceIdentity ? { sourceIdentity } : {}),
        scoreSummary: score.fitSummary,
      }
    ),
    automation_flags_json: {
      ...((existing?.automation_flags_json || {}) as Record<string, unknown>),
      researchGate: {
        ready: pipeline.researchReady,
        outreachReady: pipeline.outreachReady,
        blockedReasons: pipeline.blockedReasons,
        nextAction: pipeline.nextAction,
      },
    },
  }

  let investor: InvestorProfileRecord
  if (existing?.id) {
    const { data, error } = existing?.id
      ? await admin
          .from('investor_profiles')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single()
      : await admin.from('investor_profiles').insert(payload).select('*').single()
    if (error) throw error
    investor = data as InvestorProfileRecord
  } else {
    const { data, error } = await admin.from('investor_profiles').insert(payload).select('*').single()
    if (error) throw error
    investor = data as InvestorProfileRecord
  }

  if (input.transactions?.length) {
    await admin.from('investor_transactions').delete().eq('investor_profile_id', investor.id)
    const { error } = await admin.from('investor_transactions').insert(
      input.transactions.map((transaction) => ({
        investor_profile_id: investor.id,
        property_address: transaction.propertyAddress || null,
        city: transaction.city || null,
        state: transaction.state || null,
        zip_code: transaction.zipCode || null,
        property_type: transaction.propertyType || null,
        transaction_type: transaction.transactionType || 'purchase',
        transaction_date: transaction.transactionDate || null,
        purchase_price: transaction.purchasePrice ?? null,
        sale_price: transaction.salePrice ?? null,
        estimated_rehab: transaction.estimatedRehab ?? null,
        estimated_profit: transaction.estimatedProfit ?? null,
        financing_type: transaction.financingType || null,
        source_type: transaction.sourceType || null,
        source_url: transaction.sourceUrl || null,
        metadata_json: transaction.metadata || {},
      }))
    )
    if (error) throw error
  }

  if (input.evidence?.length) {
    const { error } = await admin.from('investor_source_evidence').insert(
      input.evidence.map((evidence) => ({
        investor_profile_id: investor.id,
        source_type: evidence.sourceType,
        source_name: evidence.sourceName || null,
        source_url: evidence.sourceUrl || null,
        external_id: evidence.externalId || null,
        record_date: evidence.recordDate || null,
        confidence_score: evidence.confidenceScore ?? 50,
        evidence_summary: evidence.evidenceSummary || null,
        raw_payload: evidence.rawPayload || {},
      }))
    )
    if (error) throw error
  }

  if (investor.contact_email || investor.contact_phone || investor.linkedin_url) {
    const contactPayload = {
      investor_profile_id: investor.id,
      name: investor.person_name || investor.display_name,
      email: investor.contact_email,
      phone: investor.contact_phone,
      linkedin_url: investor.linkedin_url,
      is_primary: true,
      confidence_score: investor.contact_email ? 85 : 60,
    }

    if (investor.contact_email) {
      const { data: existingContact } = await admin
        .from('investor_contacts')
        .select('id')
        .eq('investor_profile_id', investor.id)
        .ilike('email', investor.contact_email)
        .maybeSingle()

      if (existingContact?.id) {
        await admin.from('investor_contacts').update(contactPayload).eq('id', existingContact.id)
      } else {
        await admin.from('investor_contacts').insert(contactPayload)
      }
    } else {
      await admin.from('investor_contacts').insert(contactPayload)
    }
  }

  return investor
}

export async function listInvestorProfiles(filters: {
  search?: string | null
  market?: string | null
  investorType?: string | null
  relationshipStage?: string | null
  outreachStatus?: string | null
  sequence?: string | null
  lane?: string | null
  page?: number
  limit?: number
}) {
  const admin = createAdminClient()
  const page = filters.page || 1
  const limit = filters.limit || 100
  const offset = (page - 1) * limit

  let query = admin.from('investor_profiles').select('*', { count: 'exact' })
  if (filters.market && filters.market !== 'all') query = query.contains('markets', [filters.market])
  if (filters.investorType && filters.investorType !== 'all') query = query.eq('primary_investor_type', filters.investorType)
  if (filters.relationshipStage && filters.relationshipStage !== 'all') query = query.eq('relationship_stage', filters.relationshipStage)
  if (filters.outreachStatus && filters.outreachStatus !== 'all') query = query.eq('outreach_status', filters.outreachStatus)
  if (filters.sequence && filters.sequence !== 'all') query = query.eq('assigned_sequence', filters.sequence)
  if (filters.lane === 'builder') {
    query = query.overlaps('classification_tags', ['builder_partner', 'developer_partner', 'construction_company'])
  }
  if (filters.search) {
    const cleaned = filters.search.replace(/[,%()]/g, ' ').trim()
    if (cleaned) {
      query = query.or(
        [
          `display_name.ilike.%${cleaned}%`,
          `person_name.ilike.%${cleaned}%`,
          `llc_name.ilike.%${cleaned}%`,
          `company_name.ilike.%${cleaned}%`,
          `contact_email.ilike.%${cleaned}%`,
          `contact_phone.ilike.%${cleaned}%`,
          `website.ilike.%${cleaned}%`,
        ].join(',')
      )
    }
  }

  const [{ data, error, count }, summary] = await Promise.all([
    query.order('partnership_score', { ascending: false }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1),
    getInvestorDashboardSummary(),
  ])

  if (error) throw error
  return {
    investors: (data || []) as InvestorProfileRecord[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    summary,
  }
}

export async function getInvestorDashboardSummary(): Promise<InvestorDashboardSummary> {
  const admin = createAdminClient()
  const [{ data: investors }, { data: opportunities }, { data: events }] = await Promise.all([
    admin
      .from('investor_profiles')
      .select(
        'partnership_score,relationship_stage,outreach_status,markets,classification_tags,source_confidence_score,estimated_buy_box,metadata_json,contact_email,contact_phone,website,property_types,display_name,primary_investor_type,notes'
      )
      .limit(2000),
    admin.from('investor_opportunities').select('opportunity_type,status').neq('status', 'archived').limit(2000),
    admin.from('investor_engagement_events').select('event_type').limit(2000),
  ])

  const rows = investors || []
  const opportunityRows = opportunities || []
  const eventRows = events || []
  const pipelineRows = rows.map((row) => ({
    row,
    pipeline: buildInvestorPipelineSnapshot({
      relationshipStage: row.relationship_stage,
      outreachStatus: row.outreach_status,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      website: row.website,
      markets: row.markets,
      propertyTypes: row.property_types,
      classificationTags: row.classification_tags,
      estimatedBuyBox: row.estimated_buy_box,
      metadata: row.metadata_json,
      sourceConfidenceScore: row.source_confidence_score,
      displayName: row.display_name,
      primaryInvestorType: row.primary_investor_type,
      notes: row.notes,
    }),
  }))
  const countBy = (items: string[]) =>
    Object.entries(
      items.reduce<Record<string, number>>((acc, item) => {
        acc[item] = (acc[item] || 0) + 1
        return acc
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }))

  return {
    total: rows.length,
    averageScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.partnership_score || 0), 0) / rows.length) : 0,
    activeBuyers: rows.filter((row) => row.relationship_stage === 'active_buyer').length,
    activeBorrowers: rows.filter((row) => row.relationship_stage === 'active_borrower').length,
    activeSellers: rows.filter((row) => row.relationship_stage === 'active_seller').length,
    lendingOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'lending_opportunity' || row.opportunity_type === 'funding_request').length,
    partnershipOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'partnership_opportunity').length,
    revenueOpportunities: opportunityRows.filter((row) => row.opportunity_type === 'revenue_opportunity').length,
    outreachReady: pipelineRows.filter((item) => item.pipeline.outreachReady).length,
    researchReady: pipelineRows.filter((item) => item.pipeline.researchReady).length,
    buyBoxInferred: pipelineRows.filter((item) => item.pipeline.buyBoxInferred).length,
    buyBoxConfirmed: pipelineRows.filter((item) => item.pipeline.buyBoxConfirmed).length,
    builderPartners: pipelineRows.filter((item) => item.pipeline.builderLane).length,
    dealMachineAligned: pipelineRows.filter((item) => item.pipeline.dealMachineAligned).length,
    replies: eventRows.filter((row) => row.event_type === 'reply').length,
    callsBooked: eventRows.filter((row) => row.event_type === 'call_booked').length,
    fundingClosed: eventRows.filter((row) => row.event_type === 'funding_closed').length,
    markets: countBy(rows.flatMap((row) => row.markets || [])),
    classifications: countBy(rows.flatMap((row) => row.classification_tags || [])),
  }
}

export async function generateInvestorOutreach(investorId: string, status: 'needs_review' | 'approved' = 'needs_review') {
  const admin = createAdminClient()
  const { data: investor, error } = await admin.from('investor_profiles').select('*').eq('id', investorId).single()
  if (error) throw error
  const investorRecord = investor as InvestorProfileRecord
  const pipeline = buildInvestorPipelineSnapshotFromRecord(investorRecord)
  if (!pipeline.outreachReady) {
    throw new Error(
      `Partner is not ready for outreach yet: ${pipeline.blockedReasons.join(', ') || 'finish research and confirm criteria first'}.`
    )
  }

  const message = buildInvestorOutreachMessage(investorRecord)
  const { data: existingMessage, error: existingMessageError } = await admin
    .from('investor_outreach_messages')
    .select('*')
    .eq('investor_profile_id', investorId)
    .eq('sequence_code', message.sequenceCode)
    .eq('step_number', 1)
    .eq('channel', 'email')
    .maybeSingle()
  if (existingMessageError) throw existingMessageError
  if (isMessageGenerationProtected(existingMessage)) {
    return existingMessage as InvestorOutreachMessageRecord
  }

  const { data, error: messageError } = await admin
    .from('investor_outreach_messages')
    .upsert(
      {
        investor_profile_id: investorId,
        sequence_code: message.sequenceCode,
        step_number: 1,
        channel: 'email',
        subject: message.subject,
        body: message.body,
        cta: message.cta,
        status,
        generated_with: 'vestblock-investor-engine',
        last_generated_at: new Date().toISOString(),
        metadata_json: { templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION, sequenceStep: 1 },
      },
      { onConflict: 'investor_profile_id,sequence_code,step_number,channel' }
    )
    .select('*')
    .single()

  if (messageError) throw messageError

  await admin
    .from('investor_profiles')
    .update({
      outreach_status: status,
      relationship_stage: ['contacted', 'responded', 'followup_due'].includes(investorRecord.relationship_stage)
        ? investorRecord.relationship_stage
        : 'outreach_ready',
      last_outreach_generated_at: new Date().toISOString(),
      metadata_json: buildInvestorPipelineMetadata(
        {
          relationshipStage: 'outreach_ready',
          outreachStatus: status,
          contactEmail: investorRecord.contact_email,
          contactPhone: investorRecord.contact_phone,
          website: investorRecord.website,
          markets: investorRecord.markets,
          propertyTypes: investorRecord.property_types,
          classificationTags: investorRecord.classification_tags,
          estimatedBuyBox: investorRecord.estimated_buy_box,
          metadata: investorRecord.metadata_json,
          sourceConfidenceScore: investorRecord.source_confidence_score,
          sourceNames: investorRecord.source_names,
          displayName: investorRecord.display_name,
          primaryInvestorType: investorRecord.primary_investor_type,
          notes: investorRecord.notes,
        },
        { lastOutreachGeneratedAt: new Date().toISOString() }
      ),
    })
    .eq('id', investorId)

  return data
}

export async function bulkUpdateInvestors(input: {
  investorIds: string[]
  action: string
  actorUserId?: string | null
}) {
  const admin = createAdminClient()
  const ids = input.investorIds
  if (!ids.length) return { updated: 0 }

  if (input.action === 'generate_outreach') {
    await Promise.all(ids.map((id) => generateInvestorOutreach(id)))
    return { updated: ids.length }
  }

  if (input.action === 'approve_outreach') {
    await Promise.all(ids.map((id) => generateInvestorOutreach(id, 'approved')))
    return { updated: ids.length }
  }

  const updates: Record<string, unknown> = {}
  const now = new Date().toISOString()
  if (input.action === 'mark_researched') updates.relationship_stage = 'researched'
  if (input.action === 'mark_buy_box_inferred') updates.relationship_stage = 'researched'
  if (input.action === 'confirm_buy_box') updates.relationship_stage = 'qualified'
  if (input.action === 'queue_outreach') updates.outreach_status = 'queued'
  if (input.action === 'mark_sent') {
    updates.outreach_status = 'sent'
    updates.relationship_stage = 'contacted'
    updates.last_contacted_at = now
    updates.next_follow_up_at = new Date(Date.now() + 4 * 86400000).toISOString()
  }
  if (input.action === 'mark_responded') {
    updates.outreach_status = 'responded'
    updates.relationship_stage = 'responded'
  }
  if (input.action === 'active_partner') updates.relationship_stage = 'active_partner'
  if (input.action === 'do_not_contact') updates.outreach_status = 'do_not_contact'

  if (!Object.keys(updates).length) throw new Error(`Unsupported investor bulk action: ${input.action}`)

  const { error } = await admin.from('investor_profiles').update(updates).in('id', ids)
  if (error) throw error

  await admin.from('investor_engagement_events').insert(
    ids.map((id) => ({
      investor_profile_id: id,
      event_type: 'manual_status_change',
      event_value: input.action,
      metadata_json: { actorUserId: input.actorUserId || null },
    }))
  )

  return { updated: ids.length }
}

export async function updateInvestorProfile(
  id: string,
  updates: {
    relationshipStage?: InvestorRelationshipStage
    outreachStatus?: InvestorOutreachStatus
    notes?: string | null
    routingOwner?: string | null
    nextFollowUpAt?: string | null
  }
) {
  const admin = createAdminClient()
  const payload = {
    relationship_stage: updates.relationshipStage,
    outreach_status: updates.outreachStatus,
    notes: updates.notes,
    routing_owner: updates.routingOwner,
    next_follow_up_at: updates.nextFollowUpAt,
  }
  const { data, error } = await admin
    .from('investor_profiles')
    .update(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as InvestorProfileRecord
}

export async function updateInvestorRecord(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as InvestorProfileRecord
}

export async function listInvestorsNeedingHunterEnrichment(limit = 20) {
  const admin = createAdminClient()
  const effectiveLimit = Math.max(1, Math.floor(limit))
  const now = new Date()
  const selected: InvestorProfileRecord[] = []
  const seen = new Set<string>()
  const collect = (rows: InvestorProfileRecord[]) => {
    for (const investor of rows) {
      if (selected.length >= effectiveLimit) break
      if (seen.has(investor.id)) continue
      seen.add(investor.id)
      if (isInvestorHunterEnrichmentEligible(investor, now)) selected.push(investor)
    }
  }

  // Prioritize the records the database can identify cheaply before scanning
  // for malformed addresses that require the canonical application validator.
  const missing = await admin
    .from('investor_profiles')
    .select('*')
    .is('contact_email', null)
    .not('website', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(effectiveLimit)
  if (missing.error) throw missing.error
  collect((missing.data || []) as InvestorProfileRecord[])

  if (selected.length < effectiveLimit) {
    const commonInvalid = await admin
      .from('investor_profiles')
      .select('*')
      .not('website', 'is', null)
      .or(COMMON_INVALID_CONTACT_PREFIXES.map((prefix) => `contact_email.ilike.${prefix}@%`).join(','))
      .order('updated_at', { ascending: true })
      .limit(Math.max(effectiveLimit * 5, 100))
    if (commonInvalid.error) throw commonInvalid.error
    collect((commonInvalid.data || []) as InvestorProfileRecord[])
  }

  const pageSize = 250
  const maxScanned = Math.max(1_000, effectiveLimit * 100)
  for (let offset = 0; selected.length < effectiveLimit && offset < maxScanned; offset += pageSize) {
    const page = await admin
      .from('investor_profiles')
      .select('*')
      .not('website', 'is', null)
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (page.error) throw page.error
    const rows = (page.data || []) as InvestorProfileRecord[]
    collect(rows)
    if (rows.length < pageSize) break
  }

  return selected
}

export async function claimInvestorForHunterEnrichment(input: {
  investor: InvestorProfileRecord
  checkedAt: string
  claimId: string
}) {
  const { investor, checkedAt, claimId } = input
  if (!isInvestorHunterEnrichmentEligible(investor, new Date(checkedAt))) return null
  const domain = investorWebsiteDomain(investor.website)
  if (!domain) return null

  const admin = createAdminClient()
  let query = admin
    .from('investor_profiles')
    .update({
      metadata_json: {
        ...(investor.metadata_json || {}),
        hunterContactEnrichment: {
          provider: 'hunter',
          status: 'checking',
          domain,
          checkedAt,
          claimId,
          accepted: false,
        },
      },
      updated_at: checkedAt,
    })
    .eq('id', investor.id)

  if (investor.updated_at) query = query.eq('updated_at', investor.updated_at)
  if (nonBlank(investor.contact_email)) {
    query = query.eq('contact_email', investor.contact_email)
  } else {
    query = query.is('contact_email', null)
  }
  const { data, error } = await query.select('*').maybeSingle()
  if (error) throw error
  return (data as InvestorProfileRecord | null) || null
}

export async function saveInvestorHunterEnrichmentResult(input: {
  investorId: string
  enrichment: InvestorHunterEnrichmentForPersistence
}) {
  const sanitized = buildSanitizedInvestorHunterMetadata(input.enrichment)
  const admin = createAdminClient()

  // Retry once if another safe profile update wins between our read and compare-and-set write.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: currentData, error: currentError } = await admin
      .from('investor_profiles')
      .select('*')
      .eq('id', input.investorId)
      .maybeSingle()
    if (currentError) throw currentError
    const current = currentData as InvestorProfileRecord | null
    if (!current) return null

    const expectedClaimId = sanitized.metadata.claimId
    const currentClaimState = current.metadata_json?.hunterContactEnrichment
    const currentClaimId = currentClaimState && typeof currentClaimState === 'object'
      ? (currentClaimState as Record<string, unknown>).claimId
      : null
    if (expectedClaimId && currentClaimId !== expectedClaimId) return null

    const candidateCanFillMissingContact = Boolean(!isUsableContactEmail(current.contact_email) && sanitized.candidate)
    const nextRecord = {
      ...current,
      contact_email: candidateCanFillMissingContact ? sanitized.candidate?.email || null : current.contact_email,
      person_name:
        candidateCanFillMissingContact && !nonBlank(current.person_name)
          ? sanitized.candidate?.fullName || null
          : current.person_name,
      metadata_json: {
        ...(current.metadata_json || {}),
        hunterContactEnrichment: {
          ...sanitized.metadata,
          accepted: candidateCanFillMissingContact,
        },
      },
    } satisfies InvestorProfileRecord
    const score = scoreExistingInvestor(nextRecord)
    const metadata = buildInvestorPipelineMetadata(
      {
        relationshipStage: nextRecord.relationship_stage,
        outreachStatus: nextRecord.outreach_status,
        contactEmail: nextRecord.contact_email,
        contactPhone: nextRecord.contact_phone,
        website: nextRecord.website,
        markets: nextRecord.markets,
        propertyTypes: nextRecord.property_types,
        classificationTags: nextRecord.classification_tags,
        estimatedBuyBox: nextRecord.estimated_buy_box,
        metadata: nextRecord.metadata_json,
        sourceConfidenceScore: nextRecord.source_confidence_score,
        sourceNames: nextRecord.source_names,
        displayName: nextRecord.display_name,
        primaryInvestorType: nextRecord.primary_investor_type,
        notes: nextRecord.notes,
      },
      { scoreSummary: score.fitSummary }
    )
    const pipeline = buildInvestorPipelineSnapshot({
      relationshipStage: nextRecord.relationship_stage,
      outreachStatus: nextRecord.outreach_status,
      contactEmail: nextRecord.contact_email,
      contactPhone: nextRecord.contact_phone,
      website: nextRecord.website,
      markets: nextRecord.markets,
      propertyTypes: nextRecord.property_types,
      classificationTags: nextRecord.classification_tags,
      estimatedBuyBox: nextRecord.estimated_buy_box,
      metadata,
      sourceConfidenceScore: nextRecord.source_confidence_score,
      sourceNames: nextRecord.source_names,
      displayName: nextRecord.display_name,
      primaryInvestorType: nextRecord.primary_investor_type,
      notes: nextRecord.notes,
    })
    const currentUpdatedAt = Date.parse(current.updated_at)
    const completedAt = new Date(
      Math.max(Date.now(), Number.isFinite(currentUpdatedAt) ? currentUpdatedAt + 1 : 0)
    ).toISOString()
    const updates: Record<string, unknown> = {
      person_name: nextRecord.person_name,
      recent_activity_score: score.recentActivity,
      transaction_volume_score: score.transactionVolume,
      geographic_fit_score: score.geographicFit,
      financing_need_score: score.financingNeed,
      disposition_need_score: score.dispositionNeed,
      partnership_potential_score: score.partnershipPotential,
      partnership_score: score.partnershipScore,
      deal_flow_fit: score.dealFlowFit,
      disposition_fit: score.dispositionFit,
      financing_fit: score.financingFit,
      partnership_fit: score.partnershipFit,
      assigned_sequence: score.assignedSequence,
      last_scored_at: completedAt,
      metadata_json: metadata,
      automation_flags_json: {
        ...(current.automation_flags_json || {}),
        researchGate: {
          ready: pipeline.researchReady,
          outreachReady: pipeline.outreachReady,
          blockedReasons: pipeline.blockedReasons,
          nextAction: pipeline.nextAction,
        },
      },
      updated_at: completedAt,
    }
    if (candidateCanFillMissingContact) updates.contact_email = nextRecord.contact_email

    let updateQuery = admin
      .from('investor_profiles')
      .update(updates)
      .eq('id', current.id)
      .eq('updated_at', current.updated_at)
    if (expectedClaimId) {
      updateQuery = updateQuery.contains('metadata_json', {
        hunterContactEnrichment: { claimId: expectedClaimId },
      })
    }
    if (candidateCanFillMissingContact) {
      if (nonBlank(current.contact_email)) {
        updateQuery = updateQuery.eq('contact_email', current.contact_email)
      } else {
        updateQuery = updateQuery.is('contact_email', null)
      }
    }
    const { data: updated, error: updateError } = await updateQuery.select('*').maybeSingle()
    if (updateError?.code === '23505' && candidateCanFillMissingContact) {
      // Another investor profile already owns this address. Treat the lookup
      // as a terminal rejected candidate so duplicate company rows do not keep
      // repurchasing the same Hunter result.
      const duplicateCompletedAt = new Date(Date.parse(completedAt) + 1).toISOString()
      const { data: duplicateRecorded, error: duplicateError } = await admin
        .from('investor_profiles')
        .update({
          metadata_json: {
            ...(current.metadata_json || {}),
            hunterContactEnrichment: {
              ...sanitized.metadata,
              status: 'duplicate_contact',
              accepted: false,
            },
          },
          updated_at: duplicateCompletedAt,
        })
        .eq('id', current.id)
        .eq('updated_at', current.updated_at)
        .select('*')
        .maybeSingle()
      if (duplicateError) throw duplicateError
      if (duplicateRecorded) return duplicateRecorded as InvestorProfileRecord
      continue
    }
    if (updateError) throw updateError
    if (updated) return updated as InvestorProfileRecord
  }

  return null
}

export async function listInvestorsForScoring(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .or('last_scored_at.is.null,last_scored_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as InvestorProfileRecord[]
}

export async function listInvestorsNeedingOutreach(limit = 50) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .in('outreach_status', ['draft_ready', 'not_started', 'needs_review'])
    .not('outreach_status', 'eq', 'do_not_contact')
    .order('partnership_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(Math.max(limit * 4, 100))

  if (error) throw error
  return ((data || []) as InvestorProfileRecord[])
    .filter((investor) => {
      if (['paused', 'not_a_fit'].includes(investor.relationship_stage)) return false
      const pipeline = buildInvestorPipelineSnapshotFromRecord(investor)
      return pipeline.outreachReady
    })
    .slice(0, limit)
}

export async function listInvestorsNeedingFollowup(limit = 30) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('investor_profiles')
    .select('*')
    .in('outreach_status', ['sent', 'responded', 'followup_due'])
    .lte('next_follow_up_at', now)
    .order('next_follow_up_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as InvestorProfileRecord[]
}

export async function listApprovedInvestorEmailOutreach(limit = 25) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .select('*, investor_profiles(*)')
    .eq('status', 'approved')
    .eq('channel', 'email')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as Array<InvestorOutreachMessageRecord & { investor_profiles: InvestorProfileRecord | null }>
}

export async function listInvestorOutreachForAutoApproval(limit = 30) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .select('*, investor_profiles(*)')
    .eq('status', 'needs_review')
    .eq('channel', 'email')
    .order('step_number', { ascending: true })
    .order('last_generated_at', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as Array<InvestorOutreachMessageRecord & { investor_profiles: InvestorProfileRecord | null }>
}

export async function generateInvestorFollowup(investor: InvestorProfileRecord) {
  const admin = createAdminClient()
  const message = buildInvestorFollowupMessage(investor)
  const { data: existingMessage, error: existingMessageError } = await admin
    .from('investor_outreach_messages')
    .select('*')
    .eq('investor_profile_id', investor.id)
    .eq('sequence_code', message.sequenceCode)
    .eq('step_number', 2)
    .eq('channel', 'email')
    .maybeSingle()
  if (existingMessageError) throw existingMessageError
  if (isMessageGenerationProtected(existingMessage)) {
    return existingMessage as InvestorOutreachMessageRecord
  }

  const { data, error } = await admin
    .from('investor_outreach_messages')
    .upsert(
      {
        investor_profile_id: investor.id,
        sequence_code: message.sequenceCode,
        step_number: 2,
        channel: 'email',
        subject: message.subject,
        body: message.body,
        cta: message.cta,
        status: 'needs_review',
        generated_with: 'vestblock-investor-engine',
        last_generated_at: new Date().toISOString(),
        metadata_json: { templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION, sequenceStep: 2 },
      },
      { onConflict: 'investor_profile_id,sequence_code,step_number,channel' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data as InvestorOutreachMessageRecord
}

export async function updateInvestorOutreachMessage(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function claimInvestorOutreachMessageForSend(messageId: string, expectedUpdatedAt?: string) {
  const admin = createAdminClient()
  let query = admin
    .from('investor_outreach_messages')
    .update({ status: 'queued', send_error: null, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('status', 'approved')
    .is('sent_at', null)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data || null) as InvestorOutreachMessageRecord | null
}

export async function restoreInvestorOutreachMessageAfterQuotaDenial(
  messageId: string,
  claimedUpdatedAt: string
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .update({ status: 'approved', send_error: null, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('status', 'queued')
    .eq('updated_at', claimedUpdatedAt)
    .is('sent_at', null)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data || null) as InvestorOutreachMessageRecord | null
}

export async function quarantineInvestorOutreachMessageAfterRecordDeferral(
  messageId: string,
  claimedUpdatedAt: string,
  updates: Record<string, unknown>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .update({
      ...updates,
      status: 'archived',
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('status', 'queued')
    .eq('updated_at', claimedUpdatedAt)
    .is('sent_at', null)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data || null) as InvestorOutreachMessageRecord | null
}

export async function downgradeInvestorOutreachMessageIfApproved(
  messageId: string,
  updates: Record<string, unknown>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_outreach_messages')
    .update({
      ...updates,
      status: 'needs_review',
      approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('status', 'approved')
    .is('sent_at', null)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data || null) as InvestorOutreachMessageRecord | null
}

export async function insertInvestorEngagementEvent(input: {
  investorId: string
  outreachMessageId?: string | null
  eventType: string
  eventValue?: string | null
  eventAmount?: number | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_engagement_events')
    .insert({
      investor_profile_id: input.investorId,
      outreach_message_id: input.outreachMessageId || null,
      event_type: input.eventType,
      event_value: input.eventValue || null,
      event_amount: input.eventAmount ?? null,
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function startInvestorAutomationRun(input: {
  runType: string
  sourceKey?: string | null
  requestParams?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_automation_runs')
    .insert({
      run_type: input.runType,
      source_key: input.sourceKey || null,
      request_params: input.requestParams || {},
      status: 'running',
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function finishInvestorAutomationRun(
  id: string,
  updates: { status: 'completed' | 'failed'; resultCount?: number; errorMessage?: string | null }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('investor_automation_runs')
    .update({
      status: updates.status,
      result_count: updates.resultCount ?? 0,
      error_message: updates.errorMessage || null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function runInvestorFollowUpAgent(input: {
  investorId: string
  inboundMessage: string
  actorUserId?: string | null
}) {
  const admin = createAdminClient()
  const tasks = inferFollowUpTasks(input.inboundMessage)
  const { data: currentInvestor, error: investorError } = await admin
    .from('investor_profiles')
    .select('*')
    .eq('id', input.investorId)
    .single()
  if (investorError) throw investorError
  const summary = `AI follow-up routed ${tasks.map((task) => task.assignedTeam).join(', ')} tasking from reply: ${input.inboundMessage.slice(0, 240)}`

  const { error: eventError } = await admin.from('investor_engagement_events').insert({
    investor_profile_id: input.investorId,
    event_type: 'reply',
    event_value: input.inboundMessage,
    metadata_json: { actorUserId: input.actorUserId || null, routedTasks: tasks.map((task) => task.taskType) },
  })
  if (eventError) throw eventError

  const { error: taskError } = await admin.from('investor_follow_up_tasks').insert(
    tasks.map((task) => ({
      investor_profile_id: input.investorId,
      task_type: task.taskType,
      assigned_team: task.assignedTeam,
      prompt: task.prompt,
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      metadata_json: { inboundMessage: input.inboundMessage },
    }))
  )
  if (taskError) throw taskError

  const opportunityRows = tasks.map((task) => {
    const opportunityType =
      task.taskType === 'collect_lending_requirements'
        ? 'lending_opportunity'
        : task.taskType === 'collect_disposition_requirements'
          ? 'disposition_request'
          : task.taskType === 'assignment_contract_prep'
            ? 'revenue_opportunity'
            : task.taskType === 'collect_builder_buy_box'
              ? 'active_buyer'
          : task.taskType === 'collect_buy_box'
            ? 'active_buyer'
            : 'partnership_opportunity'

    return {
      investor_profile_id: input.investorId,
      opportunity_type: opportunityType,
      title: task.prompt,
      status: 'open',
      priority: task.taskType === 'collect_lending_requirements' ? 'high' : 'medium',
      route_to_team: task.assignedTeam,
      details_json: { inboundMessage: input.inboundMessage },
    }
  })

  const { error: opportunityError } = await admin.from('investor_opportunities').insert(opportunityRows)
  if (opportunityError) throw opportunityError

  const { data, error } = await admin
    .from('investor_profiles')
    .update({
      outreach_status: 'responded',
      relationship_stage: 'followup_due',
      ai_follow_up_summary: summary,
      next_follow_up_at: new Date(Date.now() + 86400000).toISOString(),
      metadata_json: buildInvestorPipelineMetadata(
        {
          relationshipStage: 'followup_due',
          outreachStatus: 'responded',
          contactEmail: currentInvestor.contact_email,
          contactPhone: currentInvestor.contact_phone,
          website: currentInvestor.website,
          markets: currentInvestor.markets,
          propertyTypes: currentInvestor.property_types,
          classificationTags: currentInvestor.classification_tags,
          estimatedBuyBox: currentInvestor.estimated_buy_box,
          metadata: {
            ...(currentInvestor.metadata_json || {}),
            ...(tasks.some((task) => ['collect_buy_box', 'collect_builder_buy_box'].includes(task.taskType))
              ? { lastCriteriaReplyAt: new Date().toISOString() }
              : {}),
          },
          sourceConfidenceScore: currentInvestor.source_confidence_score,
          sourceNames: currentInvestor.source_names,
          displayName: currentInvestor.display_name,
          primaryInvestorType: currentInvestor.primary_investor_type,
          notes: currentInvestor.notes,
        },
        { lastReplyAt: new Date().toISOString() }
      ),
    })
    .eq('id', input.investorId)
    .select('*')
    .single()

  if (error) throw error
  return { investor: data as InvestorProfileRecord, tasksCreated: tasks.length, summary }
}
