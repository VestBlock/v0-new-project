import { createAdminClient } from '@/lib/supabase/admin'
import type {
  BuyerBuyBoxRecord,
  BuyerContactRecord,
  BuyerMarketRecord,
  BuyerMatchRecord,
  BuyerNoteRecord,
  BuyerOutreachMessageRecord,
  BuyerOutreachRunRecord,
  BuyerPerformanceRecord,
  BuyerRecord,
  BuyerRelationshipEventRecord,
  BuyerScoreBreakdown,
  NormalizedBuyerInput,
  PropertyBuyerMatchInput,
} from '@/lib/buyers/types'

export async function startBuyerOutreachRun(input: {
  runType: string
  sourceKey?: string | null
  requestParams?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_runs')
    .insert({
      run_type: input.runType,
      source_key: input.sourceKey || null,
      status: 'running',
      request_params: input.requestParams || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as BuyerOutreachRunRecord
}

export async function finishBuyerOutreachRun(
  id: string,
  input: { status: BuyerOutreachRunRecord['status']; resultCount?: number; errorMessage?: string | null }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_runs')
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
  return data as BuyerOutreachRunRecord
}

export async function upsertBuyer(input: NormalizedBuyerInput) {
  const admin = createAdminClient()
  const payload = {
    name: input.name,
    website: input.website || null,
    buyer_type: input.buyerType,
    category: input.category,
    buyer_size: input.buyerSize || null,
    headquarters_city: input.headquartersCity || null,
    headquarters_state: input.headquartersState || null,
    markets_served: input.marketsServed || [],
    national_or_regional: input.nationalOrRegional || 'regional',
    contact_email: input.contactEmail || null,
    contact_phone: input.contactPhone || null,
    contact_name: input.contactName || null,
    source: input.source || null,
    source_url: input.sourceUrl || null,
    external_id: input.externalId || null,
    fit_summary: input.fitSummary || null,
    notes: input.notes || null,
    bilingual_support: input.bilingualSupport ?? false,
    spanish_support: input.spanishSupport ?? false,
    proof_of_funds_status: input.proofOfFundsStatus ?? null,
    closing_speed: input.closingSpeed ?? null,
    contact_info: input.contactInfo || {},
    metadata_json: input.metadata || {},
  }

  if (input.externalId) {
    const { data, error } = await admin
      .from('buyers')
      .upsert(payload, { onConflict: 'source,external_id' })
      .select('*')
      .single()

    if (error) throw error
    return data as BuyerRecord
  }

  if (input.website) {
    const { data: existing } = await admin.from('buyers').select('*').eq('website', input.website).maybeSingle()
    if (existing?.id) {
      const { data, error } = await admin
        .from('buyers')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error) throw error
      return data as BuyerRecord
    }
  }

  const { data, error } = await admin.from('buyers').insert(payload).select('*').single()
  if (error) throw error
  return data as BuyerRecord
}

export async function updateBuyerRecord(id: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as BuyerRecord
}

export async function saveBuyerScore(
  buyerId: string,
  score: BuyerScoreBreakdown,
  metadata: Record<string, unknown> = {}
) {
  return updateBuyerRecord(buyerId, {
    confidence_score: score.confidenceScore,
    distress_utility_score: score.distressedPropertyUtilityScore,
    code_violation_utility_score: score.codeViolationUtilityScore,
    seller_lead_utility_score: score.sellerLeadUtilityScore,
    market_expansion_value_score: score.marketCoverageScore,
    institutional_fit_value_score: score.institutionalFitValueScore,
    referral_value_score: score.referralMonetizationValueScore,
    fit_summary: score.fitSummary,
    last_scored_at: new Date().toISOString(),
    metadata_json: {
      ...metadata,
      buyerScore: score,
    },
  })
}

export async function replaceBuyerBuyBoxes(buyerId: string, rows: Array<Partial<BuyerBuyBoxRecord>>) {
  const admin = createAdminClient()
  await admin.from('buyer_buy_boxes').delete().eq('buyer_id', buyerId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('buyer_buy_boxes')
    .insert(
      rows.map((row, index) => ({
        buyer_id: buyerId,
        buy_box_name: row.buy_box_name || `Primary buy box ${index + 1}`,
        asset_types: row.asset_types || [],
        states: row.states || [],
        cities: row.cities || [],
        zip_codes: row.zip_codes || [],
        metros: row.metros || [],
        occupancy_preference: row.occupancy_preference || null,
        distressed_tolerance: row.distressed_tolerance ?? 0,
        code_violation_tolerance: row.code_violation_tolerance ?? 0,
        tenant_occupied_allowed: row.tenant_occupied_allowed ?? false,
        section8_allowed: row.section8_allowed ?? false,
        price_min: row.price_min ?? null,
        price_max: row.price_max ?? null,
        arv_min: row.arv_min ?? null,
        arv_max: row.arv_max ?? null,
        rehab_budget_max: row.rehab_budget_max ?? null,
        minimum_equity_percent: row.minimum_equity_percent ?? null,
        minimum_discount_percent: row.minimum_discount_percent ?? null,
        preferred_deal_types: row.preferred_deal_types || [],
        closing_speed: row.closing_speed || null,
        proof_of_funds_status: row.proof_of_funds_status || null,
        creative_finance_open: row.creative_finance_open ?? false,
        portfolio_size_preference: row.portfolio_size_preference || null,
        institutional_criteria: row.institutional_criteria || null,
        bilingual_support: row.bilingual_support ?? false,
        spanish_support: row.spanish_support ?? false,
        active: row.active ?? true,
        notes: row.notes || null,
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as BuyerBuyBoxRecord[]
}

export async function replaceBuyerMarkets(buyerId: string, rows: Array<Partial<BuyerMarketRecord>>) {
  const admin = createAdminClient()
  await admin.from('buyer_markets').delete().eq('buyer_id', buyerId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('buyer_markets')
    .insert(
      rows.map((row) => ({
        buyer_id: buyerId,
        city: row.city || null,
        state: row.state || null,
        metro_area: row.metro_area || null,
        market_type: row.market_type || 'target',
        active: row.active ?? true,
        notes: row.notes || null,
        metadata_json: row.metadata_json || {},
      }))
    )
    .select('*')

  if (error) throw error
  return (data || []) as BuyerMarketRecord[]
}

export async function replaceBuyerContacts(buyerId: string, rows: Array<Partial<BuyerContactRecord>>) {
  const admin = createAdminClient()
  await admin.from('buyer_contacts').delete().eq('buyer_id', buyerId)
  if (!rows.length) return []
  const { data, error } = await admin
    .from('buyer_contacts')
    .insert(
      rows.map((row, index) => ({
        buyer_id: buyerId,
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
  return (data || []) as BuyerContactRecord[]
}

export async function saveBuyerOutreachMessages(
  buyerId: string,
  rows: Array<{
    channel: string
    subject?: string | null
    body: string
    cta?: string | null
    partnershipAngle?: string | null
    propertyReferralAngle?: string | null
    complianceNote?: string | null
    language?: string | null
    generatedWith?: string | null
    metadata?: Record<string, unknown>
  }>
) {
  const admin = createAdminClient()
  const payload = rows.map((row) => ({
    buyer_id: buyerId,
    channel: row.channel,
    subject: row.subject || null,
    body: row.body,
    cta: row.cta || null,
    partnership_angle: row.partnershipAngle || null,
    property_referral_angle: row.propertyReferralAngle || null,
    compliance_note: row.complianceNote || null,
    status: 'needs_review',
    language: row.language || 'en',
    generated_with: row.generatedWith || 'template',
    last_generated_at: new Date().toISOString(),
    metadata_json: row.metadata || {},
  }))

  const [{ data, error }, { error: buyerError }] = await Promise.all([
    admin.from('buyer_outreach_messages').upsert(payload, { onConflict: 'buyer_id,channel' }).select('*'),
    admin
      .from('buyers')
      .update({
        relationship_stage: 'outreach_ready',
        outreach_status: 'needs_review',
        last_outreach_generated_at: new Date().toISOString(),
      })
      .eq('id', buyerId),
  ])

  if (error) throw error
  if (buyerError) throw buyerError
  return (data || []) as BuyerOutreachMessageRecord[]
}

export async function updateBuyerOutreachMessage(messageId: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_messages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .select('*')
    .single()

  if (error) throw error
  return data as BuyerOutreachMessageRecord
}

export async function insertBuyerRelationshipEvent(input: {
  buyerId: string
  eventType: string
  actorUserId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_relationship_events')
    .insert({
      buyer_id: input.buyerId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId || null,
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()
  if (error) throw error
  return data as BuyerRelationshipEventRecord
}

export async function addBuyerNote(buyerId: string, authorUserId: string | null, note: string, isInternal = true) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_notes')
    .insert({
      buyer_id: buyerId,
      author_user_id: authorUserId,
      note,
      is_internal: isInternal,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as BuyerNoteRecord
}

export async function upsertBuyerMatch(input: {
  buyerId: string
  lead: PropertyBuyerMatchInput
  confidenceScore: number
  fitSummary: string
  fitExplanation: string
  nextInfoNeeded: string[]
  fallbackBuyerCategories: string[]
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const payload = {
    buyer_id: input.buyerId,
    lead_id: input.lead.leadId || null,
    property_address: input.lead.propertyAddress || null,
    city: input.lead.city || null,
    state: input.lead.state || null,
    zip_code: input.lead.zipCode || null,
    asset_type: input.lead.assetType || null,
    occupancy: input.lead.occupancy || null,
    deal_type: input.lead.serviceType || null,
    confidence_score: input.confidenceScore,
    fit_summary: input.fitSummary,
    fit_explanation: input.fitExplanation,
    next_info_needed: input.nextInfoNeeded,
    fallback_buyer_categories: input.fallbackBuyerCategories,
    metadata_json: input.metadata || {},
  }

  let existingQuery = admin.from('buyer_matches').select('id').eq('buyer_id', input.buyerId).limit(1)
  if (input.lead.leadId) existingQuery = existingQuery.eq('lead_id', input.lead.leadId)
  else existingQuery = existingQuery.is('lead_id', null)
  if (input.lead.propertyAddress) existingQuery = existingQuery.eq('property_address', input.lead.propertyAddress)
  else existingQuery = existingQuery.is('property_address', null)

  const { data: existing } = await existingQuery.maybeSingle()
  if (existing?.id) {
    const { data, error } = await admin
      .from('buyer_matches')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data as BuyerMatchRecord
  }

  const { data, error } = await admin.from('buyer_matches').insert(payload).select('*').single()
  if (error) throw error
  return data as BuyerMatchRecord
}

export async function listBuyersForScoring(limit = 150) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyers')
    .select('*')
    .not('relationship_stage', 'in', '(paused,not_a_fit)')
    .order('last_scored_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw error
  return (data || []) as BuyerRecord[]
}

export async function listBuyersNeedingOutreach(limit = 100) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyers')
    .select('*')
    .in('outreach_status', ['not_started', 'failed'])
    .not('relationship_stage', 'in', '(paused,not_a_fit,active_buyer)')
    .order('confidence_score', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as BuyerRecord[]
}

export async function listApprovedBuyerEmailOutreach(limit = 30) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_outreach_messages')
    .select('*, buyers(*)')
    .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
    .eq('status', 'approved')
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as Array<BuyerOutreachMessageRecord & { buyers: BuyerRecord | null }>
}

export async function listBuyersNeedingFollowup(limit = 100) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('buyers')
    .select('*')
    .or(`next_follow_up_at.lte.${now},relationship_stage.eq.followup_due,outreach_status.eq.followup_due`)
    .not('relationship_stage', 'in', '(paused,not_a_fit,active_buyer)')
    .order('next_follow_up_at', { ascending: true, nullsFirst: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as BuyerRecord[]
}

export async function listActiveBuyersWithBuyBoxes(limit = 250) {
  const admin = createAdminClient()
  const [{ data: buyers, error: buyersError }, { data: buyBoxes, error: buyBoxesError }] = await Promise.all([
    admin
      .from('buyers')
      .select('*')
      .in('relationship_stage', ['discovered', 'researched', 'outreach_ready', 'contacted', 'responded', 'active_buyer'])
      .order('confidence_score', { ascending: false })
      .limit(limit),
    admin.from('buyer_buy_boxes').select('*').eq('active', true),
  ])

  if (buyersError) throw buyersError
  if (buyBoxesError) throw buyBoxesError

  return {
    buyers: (buyers || []) as BuyerRecord[],
    buyBoxes: (buyBoxes || []) as BuyerBuyBoxRecord[],
  }
}

export async function getBuyerById(id: string) {
  const admin = createAdminClient()
  const { data: buyer, error } = await admin.from('buyers').select('*').eq('id', id).single()
  if (error) throw error

  const [{ data: buyBoxes }, { data: markets }, { data: contacts }, { data: outreach }, { data: notes }, { data: matches }, { data: performance }, { data: events }] =
    await Promise.all([
      admin.from('buyer_buy_boxes').select('*').eq('buyer_id', id).order('created_at', { ascending: true }),
      admin.from('buyer_markets').select('*').eq('buyer_id', id).order('created_at', { ascending: true }),
      admin.from('buyer_contacts').select('*').eq('buyer_id', id).order('is_primary', { ascending: false }),
      admin.from('buyer_outreach_messages').select('*').eq('buyer_id', id).order('created_at', { ascending: true }),
      admin.from('buyer_notes').select('*').eq('buyer_id', id).order('created_at', { ascending: false }),
      admin.from('buyer_matches').select('*').eq('buyer_id', id).order('created_at', { ascending: false }).limit(25),
      admin.from('buyer_performance').select('*').eq('buyer_id', id).maybeSingle(),
      admin.from('buyer_relationship_events').select('*').eq('buyer_id', id).order('created_at', { ascending: false }).limit(25),
    ])

  return {
    buyer: buyer as BuyerRecord,
    buyBoxes: (buyBoxes || []) as BuyerBuyBoxRecord[],
    markets: (markets || []) as BuyerMarketRecord[],
    contacts: (contacts || []) as BuyerContactRecord[],
    outreach: (outreach || []) as BuyerOutreachMessageRecord[],
    notes: (notes || []) as BuyerNoteRecord[],
    matches: (matches || []) as BuyerMatchRecord[],
    performance: (performance || null) as BuyerPerformanceRecord | null,
    events: (events || []) as BuyerRelationshipEventRecord[],
  }
}

export async function updateBuyerPerformance(buyerId: string, updates: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('buyer_performance')
    .upsert(
      {
        buyer_id: buyerId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'buyer_id' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data as BuyerPerformanceRecord
}
