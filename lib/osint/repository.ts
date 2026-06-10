import { createAdminClient } from '@/lib/supabase/admin'
import { inputWithCalculatedScore } from '@/lib/osint/scoring'
import type {
  NormalizedResearchChecklistInput,
  ResearchChecklistRecord,
  ResearchChecklistSummary,
  ResearchOutreachStatus,
} from '@/lib/osint/types'

function nullIfBlank(value?: string | null) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function payloadFor(input: NormalizedResearchChecklistInput) {
  const scored = inputWithCalculatedScore(input)
  return {
    entity_type: scored.entityType,
    entity_id: scored.entityId || null,
    source_type: nullIfBlank(scored.sourceType),
    source_id: nullIfBlank(scored.sourceId),
    property_address: nullIfBlank(scored.propertyAddress),
    city: nullIfBlank(scored.city),
    state: nullIfBlank(scored.state)?.toUpperCase() || null,
    zip_code: nullIfBlank(scored.zipCode),
    owner_name: nullIfBlank(scored.ownerName),
    company_name: nullIfBlank(scored.companyName),
    contact_email: nullIfBlank(scored.contactEmail)?.toLowerCase() || null,
    contact_phone: nullIfBlank(scored.contactPhone),
    website: nullIfBlank(scored.website),
    checklist_json: scored.checklist || {},
    source_links_json: scored.sourceLinks || [],
    risk_flags_json: scored.riskFlags || [],
    opportunity_flags_json: scored.opportunityFlags || [],
    recommended_lane: scored.recommendedLane || null,
    outreach_status: scored.outreachStatus || 'not_ready',
    confidence_score: scored.confidenceScore || 0,
    research_summary: nullIfBlank(scored.researchSummary),
    next_action: nullIfBlank(scored.nextAction),
    assigned_owner: nullIfBlank(scored.assignedOwner),
    follow_up_at: nullIfBlank(scored.followUpAt),
    reviewed_at: nullIfBlank(scored.reviewedAt),
  }
}

function sourceIdentity(input: NormalizedResearchChecklistInput) {
  if (input.id) return null
  if (input.sourceType && input.sourceId) return { column: 'source_id', value: input.sourceId, sourceType: input.sourceType }
  if (input.entityId) return { column: 'entity_id', value: input.entityId }
  return null
}

export async function upsertResearchChecklist(input: NormalizedResearchChecklistInput) {
  const admin = createAdminClient()
  const payload = payloadFor(input)

  if (input.id) {
    const { data, error } = await admin
      .from('osint_research_checklists')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return data as ResearchChecklistRecord
  }

  const identity = sourceIdentity(input)
  if (identity) {
    let existingQuery = admin
      .from('osint_research_checklists')
      .select('id')
      .eq('entity_type', input.entityType)
      .eq(identity.column, identity.value)
    if ('sourceType' in identity) existingQuery = existingQuery.eq('source_type', identity.sourceType)
    const { data: existing } = await existingQuery.maybeSingle()

    if (existing?.id) {
      const { data, error } = await admin
        .from('osint_research_checklists')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) throw error
      return data as ResearchChecklistRecord
    }
  }

  const { data, error } = await admin.from('osint_research_checklists').insert(payload).select('*').single()
  if (error) throw error
  return data as ResearchChecklistRecord
}

export async function listResearchChecklists(filters: {
  search?: string | null
  entityType?: string | null
  city?: string | null
  state?: string | null
  recommendedLane?: string | null
  outreachStatus?: string | null
  minConfidence?: number | null
  page?: number
  limit?: number
}) {
  const admin = createAdminClient()
  const page = filters.page || 1
  const limit = filters.limit || 100
  const offset = (page - 1) * limit

  let query = admin.from('osint_research_checklists').select('*', { count: 'exact' })
  if (filters.entityType && filters.entityType !== 'all') query = query.eq('entity_type', filters.entityType)
  if (filters.city) query = query.ilike('city', `%${filters.city.trim()}%`)
  if (filters.state) query = query.ilike('state', filters.state.trim())
  if (filters.recommendedLane && filters.recommendedLane !== 'all') query = query.eq('recommended_lane', filters.recommendedLane)
  if (filters.outreachStatus && filters.outreachStatus !== 'all') query = query.eq('outreach_status', filters.outreachStatus)
  if (typeof filters.minConfidence === 'number') query = query.gte('confidence_score', filters.minConfidence)
  if (filters.search) {
    const cleaned = filters.search.replace(/[,%()]/g, ' ').trim()
    if (cleaned) {
      query = query.or(
        [
          `property_address.ilike.%${cleaned}%`,
          `owner_name.ilike.%${cleaned}%`,
          `company_name.ilike.%${cleaned}%`,
          `contact_email.ilike.%${cleaned}%`,
          `contact_phone.ilike.%${cleaned}%`,
          `website.ilike.%${cleaned}%`,
          `research_summary.ilike.%${cleaned}%`,
        ].join(',')
      )
    }
  }

  const [{ data, error, count }, summary] = await Promise.all([
    query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1),
    getResearchChecklistSummary(),
  ])

  if (error) throw error
  return {
    checklists: (data || []) as ResearchChecklistRecord[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
    summary,
  }
}

export async function getResearchChecklistSummary(): Promise<ResearchChecklistSummary> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('osint_research_checklists')
    .select('outreach_status,confidence_score,follow_up_at')
    .limit(5000)

  if (error) throw error
  const rows = data || []
  const now = Date.now()
  return {
    total: rows.length,
    readyForOutreach: rows.filter((row) => ['ready', 'approved'].includes(String(row.outreach_status))).length,
    needsReview: rows.filter((row) => row.outreach_status === 'needs_review' || row.outreach_status === 'not_ready').length,
    doNotContact: rows.filter((row) => row.outreach_status === 'do_not_contact').length,
    averageConfidence: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.confidence_score || 0), 0) / rows.length) : 0,
    followUpsDue: rows.filter((row) => row.follow_up_at && new Date(row.follow_up_at).getTime() <= now).length,
  }
}

export async function bulkUpdateResearchChecklists(input: {
  checklistIds: string[]
  action: 'needs_review' | 'ready' | 'approved' | 'do_not_contact' | 'assign_owner'
  assignedOwner?: string | null
}) {
  const admin = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.action === 'assign_owner') {
    patch.assigned_owner = nullIfBlank(input.assignedOwner)
  } else {
    patch.outreach_status = input.action as ResearchOutreachStatus
    if (input.action === 'approved') patch.reviewed_at = new Date().toISOString()
  }

  const { data, error } = await admin
    .from('osint_research_checklists')
    .update(patch)
    .in('id', input.checklistIds)
    .select('*')

  if (error) throw error
  return { count: data?.length || 0, checklists: (data || []) as ResearchChecklistRecord[] }
}

export async function createResearchChecklistFromInvestor(investorId: string) {
  const admin = createAdminClient()
  const { data: investor, error } = await admin.from('investor_profiles').select('*').eq('id', investorId).single()
  if (error) throw error

  return upsertResearchChecklist({
    entityType: 'investor',
    entityId: investor.id,
    sourceType: 'investor_profiles',
    sourceId: investor.id,
    ownerName: investor.person_name || investor.display_name,
    companyName: investor.company_name || investor.llc_name || null,
    contactEmail: investor.contact_email || null,
    contactPhone: investor.contact_phone || null,
    website: investor.website || null,
    checklist: {
      ownerEntityVerified: Boolean(investor.company_name || investor.llc_name),
      contactQualityReviewed: Boolean(investor.contact_email || investor.contact_phone),
      fitCriteriaReviewed: Boolean((investor.markets || []).length || (investor.property_types || []).length),
      nextActionSelected: true,
    },
    opportunityFlags: [
      ...(investor.deal_flow_fit ? [{ label: 'Deal flow partner', severity: 'info' as const }] : []),
      ...(investor.financing_fit ? [{ label: 'Financing opportunity', severity: 'info' as const }] : []),
      ...(investor.partnership_fit ? [{ label: 'Strategic partnership fit', severity: 'info' as const }] : []),
    ],
    recommendedLane: 'investor_partnership',
    outreachStatus: investor.outreach_status === 'do_not_contact' ? 'do_not_contact' : 'needs_review',
    researchSummary: investor.notes || `Investor profile imported from partnership engine with ${investor.partnership_score || 0}/100 partnership fit.`,
    nextAction: 'Review contact quality, criteria, and outreach lane before sending.',
  })
}

export async function createResearchChecklistFromProperty(input: {
  entityId?: string | null
  sourceType?: string | null
  sourceId?: string | null
  propertyAddress: string
  city?: string | null
  state?: string | null
  zipCode?: string | null
  ownerName?: string | null
  companyName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
}) {
  return upsertResearchChecklist({
    entityType: 'property',
    entityId: input.entityId || null,
    sourceType: input.sourceType || 'property_import',
    sourceId: input.sourceId || null,
    propertyAddress: input.propertyAddress,
    city: input.city,
    state: input.state,
    zipCode: input.zipCode,
    ownerName: input.ownerName,
    companyName: input.companyName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    website: input.website,
    checklist: {
      propertyVerified: Boolean(input.propertyAddress),
      ownerEntityVerified: Boolean(input.ownerName || input.companyName),
      contactQualityReviewed: Boolean(input.contactEmail || input.contactPhone),
      nextActionSelected: true,
    },
    recommendedLane: 'seller_fast_cash',
    outreachStatus: 'needs_review',
    researchSummary: 'Property checklist created for internal review before seller outreach or routing.',
    nextAction: 'Verify owner/entity, map context, contact quality, and seller path before outreach.',
  })
}
