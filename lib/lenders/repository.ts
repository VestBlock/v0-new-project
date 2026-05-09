import { createAdminClient } from '@/lib/supabase/admin'
import type {
  BorrowerMatchInput,
  LenderContactRecord,
  LenderMatchRecord,
  LenderNoteRecord,
  LenderOutreachMessageRecord,
  LenderOutreachRunRecord,
  LenderPerformanceRecord,
  LenderProductRecord,
  LenderProgramRecord,
  LenderRecord,
  LenderRelationshipEventRecord,
  LenderScoreBreakdown,
  NormalizedLenderInput,
} from '@/lib/lenders/types'

export async function startLenderOutreachRun(input: {
  runType: string
  sourceKey?: string | null
  requestParams?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_runs')
    .insert({
      run_type: input.runType,
      source_key: input.sourceKey || null,
      status: 'running',
      request_params: input.requestParams || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LenderOutreachRunRecord
}

export async function finishLenderOutreachRun(
  id: string,
  input: { status: LenderOutreachRunRecord['status']; resultCount?: number; errorMessage?: string | null }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_runs')
    .update({
      status: input.status,
      result_count: input.resultCount ?? 0,
      error_message: input.errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as LenderOutreachRunRecord
}

export async function upsertLender(input: NormalizedLenderInput) {
  const admin = createAdminClient()

  const payload = {
    name: input.name,
    website: input.website || null,
    lender_type: input.lenderType,
    category: input.category,
    lender_size: input.lenderSize || null,
    headquarters_city: input.headquartersCity || null,
    headquarters_state: input.headquartersState || null,
    states_served: input.statesServed || [],
    national_or_regional: input.nationalOrRegional || 'regional',
    contact_email: input.contactEmail || null,
    contact_phone: input.contactPhone || null,
    contact_name: input.contactName || null,
    source: input.source || null,
    source_url: input.sourceUrl || null,
    external_id: input.externalId || null,
    fit_summary: input.fitSummary || null,
    notes: input.notes || null,
    min_credit_score: input.minCreditScore ?? null,
    min_revenue: input.minRevenue ?? null,
    min_time_in_business: input.minTimeInBusiness ?? null,
    startup_allowed: input.startupAllowed ?? false,
    collateral_required: input.collateralRequired ?? false,
    owner_occupied_allowed: input.ownerOccupiedAllowed ?? false,
    investor_allowed: input.investorAllowed ?? false,
    rehab_tolerance: input.rehabTolerance ?? 0,
    first_time_investor_allowed: input.firstTimeInvestorAllowed ?? false,
    bankruptcy_tolerance: input.bankruptcyTolerance ?? null,
    tax_lien_tolerance: input.taxLienTolerance ?? null,
    low_doc: input.lowDoc ?? false,
    speed_to_close: input.speedToClose ?? null,
    industries_preferred: input.industriesPreferred || [],
    industries_excluded: input.industriesExcluded || [],
    loan_amount_min: input.loanAmountMin ?? null,
    loan_amount_max: input.loanAmountMax ?? null,
    dscr_min: input.dscrMin ?? null,
    seasoning_requirement: input.seasoningRequirement ?? null,
    cash_out_allowed: input.cashOutAllowed ?? false,
    bilingual_support: input.bilingualSupport ?? false,
    spanish_support: input.spanishSupport ?? false,
    contact_info: input.contactInfo || {},
    metadata_json: input.metadata || {},
  }

  if (input.externalId) {
    const { data, error } = await admin
      .from('lenders')
      .upsert(payload, { onConflict: 'source,external_id' })
      .select('*')
      .single()

    if (error) throw error
    return data as LenderRecord
  }

  if (input.website) {
    const { data: existing } = await admin
      .from('lenders')
      .select('*')
      .eq('website', input.website)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await admin
        .from('lenders')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error) throw error
      return data as LenderRecord
    }
  }

  const { data, error } = await admin.from('lenders').insert(payload).select('*').single()
  if (error) throw error
  return data as LenderRecord
}

export async function updateLenderRecord(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lenders')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as LenderRecord
}

export async function saveLenderScore(
  lenderId: string,
  score: LenderScoreBreakdown,
  metadata: Record<string, unknown> = {}
) {
  return updateLenderRecord(lenderId, {
    confidence_score: score.confidenceScore,
    startup_friendliness_score: score.startupFriendlinessScore,
    real_estate_utility_score: score.realEstateUtilityScore,
    business_funding_utility_score: score.businessFundingUtilityScore,
    spanish_market_value_score: score.spanishMarketValueScore,
    market_expansion_value_score: score.marketExpansionValueScore,
    referral_value_score: score.referralMonetizationValueScore,
    fit_summary: score.fitSummary,
    last_scored_at: new Date().toISOString(),
    metadata_json: {
      ...metadata,
      lenderScore: score,
    },
  })
}

export async function replaceLenderProducts(lenderId: string, rows: Array<Partial<LenderProductRecord>>) {
  const admin = createAdminClient()
  await admin.from('lender_products').delete().eq('lender_id', lenderId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('lender_products')
    .insert(
      rows.map((row) => ({
        lender_id: lenderId,
        category: row.category,
        product_name: row.product_name,
        description: row.description || null,
        active: row.active ?? true,
        min_credit_score: row.min_credit_score ?? null,
        min_revenue: row.min_revenue ?? null,
        min_time_in_business: row.min_time_in_business ?? null,
        startup_allowed: row.startup_allowed ?? false,
        owner_occupied_allowed: row.owner_occupied_allowed ?? false,
        investor_allowed: row.investor_allowed ?? false,
        collateral_required: row.collateral_required ?? false,
        loan_amount_min: row.loan_amount_min ?? null,
        loan_amount_max: row.loan_amount_max ?? null,
        dscr_min: row.dscr_min ?? null,
        speed_to_close: row.speed_to_close ?? null,
        truthful_notes: row.truthful_notes ?? null,
        tags: row.tags || [],
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as LenderProductRecord[]
}

export async function replaceLenderPrograms(lenderId: string, rows: Array<Partial<LenderProgramRecord>>) {
  const admin = createAdminClient()
  await admin.from('lender_programs').delete().eq('lender_id', lenderId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('lender_programs')
    .insert(
      rows.map((row) => ({
        lender_id: lenderId,
        program_name: row.program_name,
        program_type: row.program_type,
        description: row.description || null,
        startup_allowed: row.startup_allowed ?? false,
        low_doc: row.low_doc ?? false,
        bilingual_support: row.bilingual_support ?? false,
        spanish_support: row.spanish_support ?? false,
        loan_amount_min: row.loan_amount_min ?? null,
        loan_amount_max: row.loan_amount_max ?? null,
        min_credit_score: row.min_credit_score ?? null,
        min_revenue: row.min_revenue ?? null,
        min_time_in_business: row.min_time_in_business ?? null,
        dscr_min: row.dscr_min ?? null,
        seasoning_requirement: row.seasoning_requirement ?? null,
        truthful_notes: row.truthful_notes ?? null,
        active: row.active ?? true,
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as LenderProgramRecord[]
}

export async function replaceLenderContacts(lenderId: string, rows: Array<Partial<LenderContactRecord>>) {
  const admin = createAdminClient()
  await admin.from('lender_contacts').delete().eq('lender_id', lenderId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('lender_contacts')
    .insert(
      rows.map((row, index) => ({
        lender_id: lenderId,
        name: row.name || null,
        title: row.title || null,
        email: row.email || null,
        phone: row.phone || null,
        linkedin_url: row.linkedin_url || null,
        preferred_channel: row.preferred_channel || 'email',
        is_primary: row.is_primary ?? index === 0,
        confidence_score: row.confidence_score ?? 50,
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as LenderContactRecord[]
}

export async function saveLenderOutreachMessages(
  lenderId: string,
  rows: Array<{
    channel: string
    subject?: string | null
    body: string
    cta?: string | null
    partnershipAngle?: string | null
    borrowerReferralAngle?: string | null
    complianceNote?: string | null
    language?: string | null
    generatedWith?: string | null
    metadata?: Record<string, unknown>
  }>
) {
  const admin = createAdminClient()
  const payload = rows.map((row) => ({
    lender_id: lenderId,
    channel: row.channel,
    subject: row.subject || null,
    body: row.body,
    cta: row.cta || null,
    partnership_angle: row.partnershipAngle || null,
    borrower_referral_angle: row.borrowerReferralAngle || null,
    compliance_note: row.complianceNote || null,
    status: 'needs_review',
    language: row.language || 'en',
    generated_with: row.generatedWith || 'template',
    last_generated_at: new Date().toISOString(),
    metadata_json: row.metadata || {},
  }))

  const [{ data, error }, { error: lenderError }] = await Promise.all([
    admin
      .from('lender_outreach_messages')
      .upsert(payload, { onConflict: 'lender_id,channel' })
      .select('*'),
    admin
      .from('lenders')
      .update({
        relationship_stage: 'outreach_ready',
        outreach_status: 'needs_review',
        last_outreach_generated_at: new Date().toISOString(),
      })
      .eq('id', lenderId),
  ])

  if (error) throw error
  if (lenderError) throw lenderError
  return (data || []) as LenderOutreachMessageRecord[]
}

export async function updateLenderOutreachMessage(messageId: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select('*')
    .single()

  if (error) throw error
  return data as LenderOutreachMessageRecord
}

export async function insertLenderRelationshipEvent(input: {
  lenderId: string
  eventType: string
  actorUserId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_relationship_events')
    .insert({
      lender_id: input.lenderId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId || null,
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LenderRelationshipEventRecord
}

export async function addLenderNote(lenderId: string, authorUserId: string | null, note: string, isInternal = true) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_notes')
    .insert({
      lender_id: lenderId,
      author_user_id: authorUserId,
      note,
      is_internal: isInternal,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LenderNoteRecord
}

export async function upsertLenderMatch(input: {
  lenderId: string
  borrower: BorrowerMatchInput
  confidenceScore: number
  fitSummary: string
  fitExplanation: string
  nextDocsNeeded: string[]
  fallbackOptions: string[]
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const payload = {
    lender_id: input.lenderId,
    user_id: input.borrower.userId || null,
    lead_id: input.borrower.leadId || null,
    funding_profile_id: input.borrower.fundingProfileId || null,
    funding_recommendation_id: input.borrower.fundingRecommendationId || null,
    service_type: input.borrower.serviceType || null,
    borrower_state: input.borrower.borrowerState || null,
    borrower_industry: input.borrower.businessIndustry || null,
    deal_type: input.borrower.dealType || null,
    confidence_score: input.confidenceScore,
    fit_summary: input.fitSummary,
    fit_explanation: input.fitExplanation,
    next_docs_needed: input.nextDocsNeeded,
    fallback_options: input.fallbackOptions,
    metadata_json: input.metadata || {},
  }

  let existingQuery = admin
    .from('lender_matches')
    .select('id')
    .eq('lender_id', input.lenderId)
    .limit(1)

  if (input.borrower.userId) {
    existingQuery = existingQuery.eq('user_id', input.borrower.userId)
  } else {
    existingQuery = existingQuery.is('user_id', null)
  }

  if (input.borrower.leadId) {
    existingQuery = existingQuery.eq('lead_id', input.borrower.leadId)
  } else {
    existingQuery = existingQuery.is('lead_id', null)
  }

  if (input.borrower.fundingRecommendationId) {
    existingQuery = existingQuery.eq('funding_recommendation_id', input.borrower.fundingRecommendationId)
  } else {
    existingQuery = existingQuery.is('funding_recommendation_id', null)
  }

  if (input.borrower.serviceType) {
    existingQuery = existingQuery.eq('service_type', input.borrower.serviceType)
  } else {
    existingQuery = existingQuery.is('service_type', null)
  }

  const { data: existing } = await existingQuery.maybeSingle()

  if (existing?.id) {
    const { data, error } = await admin
      .from('lender_matches')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return data as LenderMatchRecord
  }

  const { data, error } = await admin
    .from('lender_matches')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return data as LenderMatchRecord
}

export async function listLendersForScoring(limit = 150) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lenders')
    .select('*')
    .not('relationship_stage', 'in', '(paused,not_a_fit)')
    .order('last_scored_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw error
  return (data || []) as LenderRecord[]
}

export async function listLendersNeedingOutreach(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lenders')
    .select('*')
    .in('outreach_status', ['not_started', 'failed'])
    .not('relationship_stage', 'in', '(paused,not_a_fit,active_partner)')
    .order('confidence_score', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as LenderRecord[]
}

export async function listApprovedLenderEmailOutreach(limit = 30) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_outreach_messages')
    .select('*, lenders(*)')
    .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
    .eq('status', 'approved')
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Array<LenderOutreachMessageRecord & { lenders: LenderRecord | null }>
}

export async function listLendersNeedingFollowup(limit = 100) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('lenders')
    .select('*')
    .or(`next_follow_up_at.lte.${now},relationship_stage.eq.followup_due,outreach_status.eq.followup_due`)
    .not('relationship_stage', 'in', '(paused,not_a_fit,active_partner)')
    .order('next_follow_up_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as LenderRecord[]
}

export async function getLenderById(id: string) {
  const admin = createAdminClient()
  const { data: lender, error } = await admin.from('lenders').select('*').eq('id', id).single()
  if (error) throw error

  const [{ data: products }, { data: programs }, { data: contacts }, { data: outreach }, { data: notes }, { data: matches }, { data: performance }, { data: events }] =
    await Promise.all([
      admin.from('lender_products').select('*').eq('lender_id', id).order('created_at', { ascending: true }),
      admin.from('lender_programs').select('*').eq('lender_id', id).order('created_at', { ascending: true }),
      admin.from('lender_contacts').select('*').eq('lender_id', id).order('is_primary', { ascending: false }),
      admin.from('lender_outreach_messages').select('*').eq('lender_id', id).order('created_at', { ascending: true }),
      admin.from('lender_notes').select('*').eq('lender_id', id).order('created_at', { ascending: false }),
      admin.from('lender_matches').select('*').eq('lender_id', id).order('created_at', { ascending: false }).limit(25),
      admin.from('lender_performance').select('*').eq('lender_id', id).maybeSingle(),
      admin.from('lender_relationship_events').select('*').eq('lender_id', id).order('created_at', { ascending: false }).limit(25),
    ])

  return {
    lender: lender as LenderRecord,
    products: (products || []) as LenderProductRecord[],
    programs: (programs || []) as LenderProgramRecord[],
    contacts: (contacts || []) as LenderContactRecord[],
    outreach: (outreach || []) as LenderOutreachMessageRecord[],
    notes: (notes || []) as LenderNoteRecord[],
    matches: (matches || []) as LenderMatchRecord[],
    performance: (performance || null) as LenderPerformanceRecord | null,
    events: (events || []) as LenderRelationshipEventRecord[],
  }
}

export async function updateLenderPerformance(lenderId: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_performance')
    .upsert(
      {
        lender_id: lenderId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lender_id' }
    )
    .select('*')
    .single()

  if (error) throw error
  return data as LenderPerformanceRecord
}
