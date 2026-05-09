import { createAdminClient } from '@/lib/supabase/admin'
import { isLegacyGooglePlacesPhaseOutEnabled } from '@/lib/leads/autopilot'
import { getLeadRevenueFitIssue, getRevenueCampaignPriority } from '@/lib/leads/revenueCampaigns'
import { isSourceInFamily } from '@/lib/leads/source-keys'
import type {
  LeadSuppressionRecord,
  LeadNoteRecord,
  LeadRecord,
  LeadScoreBreakdown,
  NormalizedLeadInput,
  OutreachSendEventRecord,
  OutreachMessageRecord,
  ScrapeRunRecord,
  TargetMarketRecord,
} from '@/lib/leads/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

type ScrapeRunCreate = {
  sourceKey: string
  runType: string
  requestParams?: Record<string, unknown>
  sourceDefinition?: {
    name: string
    category: string
    sourceType: string
    baseUrl?: string | null
    city?: string | null
    state?: string | null
    configJson?: Record<string, unknown>
    isActive?: boolean
  }
}

function pickIncomingString(nextValue: string | null | undefined, existingValue: string | null | undefined) {
  if (typeof nextValue === 'string' && nextValue.trim()) return nextValue
  if (typeof existingValue === 'string' && existingValue.trim()) return existingValue
  return null
}

function pickIncomingBoolean(nextValue: boolean | null | undefined, existingValue: boolean | null | undefined) {
  return typeof nextValue === 'boolean' ? nextValue : typeof existingValue === 'boolean' ? existingValue : null
}

function pickIncomingNumber(nextValue: number | null | undefined, existingValue: number | null | undefined) {
  return Number.isFinite(nextValue as number) ? nextValue : Number.isFinite(existingValue as number) ? existingValue : null
}

function getLeadContactFormCount(lead: LeadRecord) {
  const urls = lead.contact_info?.contactFormUrls
  return Array.isArray(urls) ? urls.filter((value) => typeof value === 'string' && value.trim()).length : 0
}

function leadCreatedAtMs(lead: LeadRecord) {
  const createdAt = typeof lead.created_at === 'string' ? Date.parse(lead.created_at) : Number.NaN
  return Number.isNaN(createdAt) ? 0 : createdAt
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function allowSecondaryRevenueOutreach() {
  return envBool('LEADS_INCLUDE_SECONDARY_CAMPAIGNS_IN_OUTREACH', false)
}

function allowSecondaryRevenueSendQueue() {
  return envBool(
    'LEADS_ALLOW_SECONDARY_CAMPAIGNS_FOR_AUTO_SEND',
    allowSecondaryRevenueOutreach()
  )
}

function shouldIncludeInRevenueOutreach(lead: LeadRecord | null | undefined, allowSecondaryCampaigns: boolean) {
  return !getLeadRevenueFitIssue(lead, { allowSecondaryCampaigns })
}

function leadOutreachPriorityScore(lead: LeadRecord) {
  const createdAtMs = leadCreatedAtMs(lead)
  const ageMs = createdAtMs ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY
  const hasFreshEmail = isUsableContactEmail(lead.email)
  const contactFormCount = getLeadContactFormCount(lead)
  const isFresh = ageMs <= 3 * 24 * 60 * 60 * 1000
  const isPriorityDirectorySource =
    isSourceInFamily(lead.source, 'outscraper_google_maps_businesses') ||
    isSourceInFamily(lead.source, 'apify_yelp_businesses')

  return (
    Number(lead.lead_score || 0) +
    getRevenueCampaignPriority(lead) +
    (hasFreshEmail ? 300 : 0) +
    (contactFormCount > 0 ? 120 : 0) +
    (isFresh ? 80 : 0) +
    (isPriorityDirectorySource ? 160 : 0)
  )
}

function sortLeadsForOutreach(leads: LeadRecord[]) {
  return [...leads].sort((left, right) => {
    const scoreDelta = leadOutreachPriorityScore(right) - leadOutreachPriorityScore(left)
    if (scoreDelta !== 0) return scoreDelta
    return leadCreatedAtMs(right) - leadCreatedAtMs(left)
  })
}

function messageQueuedAtMs(message: OutreachMessageRecord) {
  const approvedAt = typeof message.approved_at === 'string' ? Date.parse(message.approved_at) : Number.NaN
  if (!Number.isNaN(approvedAt)) return approvedAt
  const generatedAt = typeof message.last_generated_at === 'string' ? Date.parse(message.last_generated_at) : Number.NaN
  return Number.isNaN(generatedAt) ? 0 : generatedAt
}

function extractEmailDomain(email: string | null | undefined) {
  const normalized = String(email || '').trim().toLowerCase()
  const parts = normalized.split('@')
  return parts.length === 2 ? parts[1] : null
}

function extractWebsiteHost(website: string | null | undefined) {
  if (!website) return null
  try {
    return new URL(website).host.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function domainsLookAligned(emailDomain: string, websiteHost: string) {
  return (
    emailDomain === websiteHost ||
    emailDomain.endsWith(`.${websiteHost}`) ||
    websiteHost.endsWith(`.${emailDomain}`)
  )
}

function hasDirectBusinessEmail(lead: LeadRecord | null | undefined) {
  if (!lead || !isUsableContactEmail(lead.email)) return false
  const emailDomain = extractEmailDomain(lead.email)
  const websiteHost = extractWebsiteHost(lead.website)
  if (!emailDomain || !websiteHost) return false
  return domainsLookAligned(emailDomain, websiteHost)
}

function messageSendPriorityScore(message: OutreachMessageRecord & { leads: LeadRecord | null }) {
  const lead = message.leads
  const approvedAgeHours = Math.max(0, (Date.now() - messageQueuedAtMs(message)) / (60 * 60 * 1000))

  return (
    (lead ? leadOutreachPriorityScore(lead) : 0) +
    (message.status === 'approved' ? 500 : 0) +
    (hasDirectBusinessEmail(lead) ? 240 : 0) +
    (isUsableContactEmail(lead?.email) ? 160 : 0) +
    Math.min(approvedAgeHours, 96)
  )
}

function sortMessagesForSendQueue(rows: Array<OutreachMessageRecord & { leads: LeadRecord | null }>) {
  return [...rows].sort((left, right) => {
    const leftLead = left.leads
    const rightLead = right.leads
    const leftApproved = left.status === 'approved'
    const rightApproved = right.status === 'approved'
    if (leftApproved !== rightApproved) return leftApproved ? -1 : 1

    const leftUsableEmail = leftLead ? isUsableContactEmail(leftLead.email) : false
    const rightUsableEmail = rightLead ? isUsableContactEmail(rightLead.email) : false
    if (leftUsableEmail !== rightUsableEmail) return leftUsableEmail ? -1 : 1

    const leftDirectBusinessEmail = hasDirectBusinessEmail(leftLead)
    const rightDirectBusinessEmail = hasDirectBusinessEmail(rightLead)
    if (leftDirectBusinessEmail !== rightDirectBusinessEmail) return leftDirectBusinessEmail ? -1 : 1

    const priorityDelta = messageSendPriorityScore(right) - messageSendPriorityScore(left)
    if (priorityDelta !== 0) return priorityDelta

    return messageQueuedAtMs(left) - messageQueuedAtMs(right)
  })
}

export async function startScrapeRun(input: ScrapeRunCreate) {
  const admin = createAdminClient()
  let sourceId: string | null = null
  if (input.sourceDefinition) {
    const { data: source, error: sourceError } = await admin
      .from('lead_sources')
      .upsert(
        {
          source_key: input.sourceKey,
          name: input.sourceDefinition.name,
          category: input.sourceDefinition.category,
          source_type: input.sourceDefinition.sourceType,
          base_url: input.sourceDefinition.baseUrl || null,
          city: input.sourceDefinition.city || null,
          state: input.sourceDefinition.state || null,
          config_json: input.sourceDefinition.configJson || {},
          is_active: input.sourceDefinition.isActive ?? true,
          last_run_at: new Date().toISOString(),
        },
        { onConflict: 'source_key' }
      )
      .select('id')
      .single()

    if (sourceError) throw sourceError
    sourceId = source?.id || null
  } else {
    const { data: source } = await admin
      .from('lead_sources')
      .select('id')
      .eq('source_key', input.sourceKey)
      .maybeSingle()
    sourceId = source?.id || null
    if (sourceId) {
      await admin
        .from('lead_sources')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', sourceId)
    }
  }

  const { data, error } = await admin
    .from('scrape_runs')
    .insert({
      source_id: sourceId,
      source_key: input.sourceKey,
      run_type: input.runType,
      status: 'running',
      request_params: input.requestParams || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as ScrapeRunRecord
}

export async function finishScrapeRun(
  id: string,
  input: { status: ScrapeRunRecord['status']; resultCount?: number; errorMessage?: string | null }
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('scrape_runs')
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
  return data as ScrapeRunRecord
}

export async function upsertLead(input: NormalizedLeadInput) {
  const admin = createAdminClient()
  const existingLead =
    input.externalId
      ? await admin
          .from('leads')
          .select('*')
          .eq('source', input.source)
          .eq('external_id', input.externalId)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw error
            return (data || null) as LeadRecord | null
          })
      : null

  const payload = {
    lead_type: input.leadType,
    owner_user_id: input.ownerUserId || null,
    source: input.source,
    source_url: input.sourceUrl || null,
    category: input.category || null,
    external_id: input.externalId || null,
    name: pickIncomingString(input.name, existingLead?.name),
    business_name: pickIncomingString(input.businessName, existingLead?.business_name),
    property_address: pickIncomingString(input.propertyAddress, existingLead?.property_address),
    mailing_address: pickIncomingString(input.mailingAddress, existingLead?.mailing_address),
    phone: pickIncomingString(input.phone, existingLead?.phone),
    email: pickIncomingString(input.email, existingLead?.email),
    website: pickIncomingString(input.website, existingLead?.website),
    city: pickIncomingString(input.city, existingLead?.city),
    state: pickIncomingString(input.state, existingLead?.state),
    zip: pickIncomingString(input.zip, existingLead?.zip),
    language_signal: pickIncomingString(input.languageSignal, existingLead?.language_signal),
    pain_signal: pickIncomingString(input.painSignal, existingLead?.pain_signal),
    best_offer: input.bestOffer || existingLead?.best_offer || null,
    niche: pickIncomingString(input.niche, existingLead?.niche),
    target_market_id: input.targetMarketId || null,
    expansion_batch_id: input.expansionBatchId || null,
    campaign_name: input.campaignName || existingLead?.campaign_name || null,
    email_valid: pickIncomingBoolean(input.emailValid, existingLead?.email_valid),
    bounce_risk_score: pickIncomingNumber(input.bounceRiskScore, existingLead?.bounce_risk_score) ?? 0,
    delivery_status: input.deliveryStatus || existingLead?.delivery_status || 'not_sent',
    suppression_reason: input.suppressionReason || null,
    imported_at: input.importedAt || null,
    outreach_angle: input.outreachAngle || existingLead?.outreach_angle || null,
    market_segment: input.marketSegment || existingLead?.market_segment || null,
    next_follow_up_at: input.nextFollowUpAt || existingLead?.next_follow_up_at || null,
    website_audit_json: {
      ...(existingLead?.website_audit_json || {}),
      ...(input.websiteAudit || {}),
    },
    mailing_matches_property: input.mailingMatchesProperty ?? null,
    status: input.status || existingLead?.status || 'new',
    notes: input.notes || existingLead?.notes || null,
    contact_info: {
      ...(existingLead?.contact_info || {}),
      ...(input.contactInfo || {}),
    },
    form_data: {
      ...(existingLead?.form_data || {}),
      ...(input.formData || {}),
    },
    metadata_json: {
      ...(existingLead?.metadata_json || {}),
      ...(input.metadata || {}),
    },
  }

  let query = admin.from('leads').upsert(payload, {
    onConflict: input.externalId ? 'source,external_id' : undefined,
  })

  if (!input.externalId) {
    query = admin.from('leads').insert(payload)
  }

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data as LeadRecord
}

export async function saveLeadScore(leadId: string, score: LeadScoreBreakdown) {
  const admin = createAdminClient()
  const payload = {
    lead_id: leadId,
    score: score.score,
    urgency_score: score.urgencyScore,
    business_age_score: score.businessAgeScore,
    funding_need_score: score.fundingNeedScore,
    website_weakness_score: score.websiteWeaknessScore,
    language_niche_score: score.languageNicheScore,
    distress_signal_score: score.distressSignalScore,
    contract_fit_score: score.contractFitScore,
    contactability_score: score.contactabilityScore,
    estimated_value_score: score.estimatedValueScore,
    best_offer: score.bestOffer,
    reasoning: score.reasoning,
    urgency_level: score.urgencyLevel,
    contactability_level: score.contactabilityLevel,
    language_segment: score.languageSegment,
    outreach_angle: score.outreachAngle,
    estimated_value_label: score.estimatedValueLabel,
    breakdown_json: score.breakdown,
  }

  const [{ data, error }, { error: leadError }] = await Promise.all([
    admin
      .from('lead_scores')
      .upsert(payload, { onConflict: 'lead_id' })
      .select('*')
      .single(),
    admin
      .from('leads')
      .update({
        lead_score: score.score,
        best_offer: score.bestOffer,
        urgency_level: score.urgencyLevel,
        contactability_level: score.contactabilityLevel,
        language_segment: score.languageSegment,
        outreach_angle: score.outreachAngle,
        estimated_value_label: score.estimatedValueLabel,
        best_offer_reason: score.reasoning,
        website_audit_json: score.breakdown.website || {},
        status: 'scored',
        outreach_status: 'not_started',
        last_scored_at: new Date().toISOString(),
      })
      .eq('id', leadId),
  ])

  if (error) throw error
  if (leadError) throw leadError
  return data
}

export async function saveOutreachMessages(
  leadId: string,
  rows: Array<{
    channel: string
    subject?: string | null
    body: string
    cta?: string | null
    language?: string | null
    complianceNote?: string | null
    generatedWith?: string
  }>
) {
  const admin = createAdminClient()
  const payload = rows.map((row) => ({
    lead_id: leadId,
      channel: row.channel,
      subject: row.subject || null,
      body: row.body,
      cta: row.cta || null,
      language: row.language || 'en',
      compliance_note: row.complianceNote || null,
      generated_with: row.generatedWith || 'template',
      status: 'needs_review',
      last_generated_at: new Date().toISOString(),
    }))

  const [{ data, error }, { error: leadError }] = await Promise.all([
    admin
      .from('outreach_messages')
      .upsert(payload, { onConflict: 'lead_id,channel' })
      .select('*'),
    admin
      .from('leads')
      .update({
        status: 'outreach_ready',
        outreach_status: 'needs_review',
        last_outreach_generated_at: new Date().toISOString(),
      })
      .eq('id', leadId),
  ])

  if (error) throw error
  if (leadError) throw leadError
  return (data || []) as OutreachMessageRecord[]
}

export async function updateLeadRecord(
  leadId: string,
  updates: Record<string, unknown>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .select('*')
    .single()

  if (error) throw error
  return data as LeadRecord
}

export async function deleteLeads(leadIds: string[]) {
  const admin = createAdminClient()
  const { error } = await admin.from('leads').delete().in('id', leadIds)
  if (error) throw error
}

export async function updateOutreachMessage(
  messageId: string,
  updates: Record<string, unknown>
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_messages')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select('*')
    .single()

  if (error) throw error
  return data as OutreachMessageRecord
}

export async function insertOutreachSendEvent(input: {
  leadId: string
  outreachMessageId?: string | null
  channel: string
  provider?: string | null
  status: 'approved' | 'queued' | 'sent' | 'failed' | 'skipped'
  recipient?: string | null
  subject?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_send_events')
    .insert({
      lead_id: input.leadId,
      outreach_message_id: input.outreachMessageId || null,
      channel: input.channel,
      provider: input.provider || null,
      status: input.status,
      recipient: input.recipient || null,
      subject: input.subject || null,
      error_message: input.errorMessage || null,
      metadata_json: input.metadata || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return data as OutreachSendEventRecord
}

export async function listLeadsForScoring(limit = 200) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .in('status', ['new', 'scored'])
    .not('status', 'in', '(closed,closed_won,closed_lost,disqualified,do_not_contact)')
    .order('last_scored_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as LeadRecord[]
}

export async function listLeadsForEmailEnrichment(limit = 60) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .is('email', null)
    .not('website', 'is', null)
    .not('status', 'in', '(closed,closed_won,closed_lost,disqualified,do_not_contact)')
    .order('lead_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit * 6)

  if (error) throw error

  const filtered = ((data || []) as LeadRecord[]).filter((lead) => {
    const enrichment =
      typeof lead.automation_flags_json?.emailEnrichment === 'object' && lead.automation_flags_json.emailEnrichment
        ? (lead.automation_flags_json.emailEnrichment as Record<string, unknown>)
        : null

    if (!enrichment) return true

    const checkedAt = typeof enrichment.checkedAt === 'string' ? enrichment.checkedAt : null
    if (!checkedAt) return true

    const checkedMs = Date.parse(checkedAt)
    if (Number.isNaN(checkedMs)) return true

    return Date.now() - checkedMs >= 14 * 24 * 60 * 60 * 1000
  })

  return filtered.slice(0, limit)
}

export async function listLeadsNeedingOutreach(limit = 100) {
  const admin = createAdminClient()
  const allowSecondaryCampaigns = allowSecondaryRevenueOutreach()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .in('status', ['scored', 'outreach_ready'])
    .in('outreach_status', ['not_started', 'failed'])
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit * 4)

  if (error) throw error
  const filtered = ((data || []) as LeadRecord[]).filter(
    (lead) =>
      !(isLegacyGooglePlacesPhaseOutEnabled() && isSourceInFamily(lead.source, 'google_places_businesses')) &&
      shouldIncludeInRevenueOutreach(lead, allowSecondaryCampaigns)
  )
  return sortLeadsForOutreach(filtered).slice(0, limit)
}

export async function listApprovedEmailOutreach(limit = 50) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('outreach_messages')
    .select('*, leads(*)')
    .eq('channel', 'email')
    .eq('status', 'approved')
    .order('approved_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as Array<OutreachMessageRecord & { leads: LeadRecord | null }>
}

export async function listEmailOutreachForSendQueue(limit = 75) {
  const admin = createAdminClient()
  const allowSecondaryCampaigns = allowSecondaryRevenueSendQueue()
  const { data, error } = await admin
    .from('outreach_messages')
    .select('*, leads(*)')
    .eq('channel', 'email')
    .in('status', ['approved', 'needs_review'])
    .order('approved_at', { ascending: true, nullsFirst: false })
    .order('last_generated_at', { ascending: true, nullsFirst: false })
    .limit(limit * 4)

  if (error) throw error
  const filtered = ((data || []) as Array<OutreachMessageRecord & { leads: LeadRecord | null }>).filter(
    (row) =>
      !(isLegacyGooglePlacesPhaseOutEnabled() && isSourceInFamily(row.leads?.source, 'google_places_businesses')) &&
      shouldIncludeInRevenueOutreach(row.leads, allowSecondaryCampaigns)
  )
  return sortMessagesForSendQueue(filtered).slice(0, limit)
}

export async function listLeadsNeedingFollowup(limit = 100) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .or(`next_follow_up_at.lte.${now},outreach_status.eq.followup_due`)
    .not('status', 'in', '(closed,closed_won,closed_lost,disqualified,do_not_contact)')
    .order('next_follow_up_at', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as LeadRecord[]
}

export async function getLeadById(id: string) {
  const admin = createAdminClient()
  const { data: lead, error } = await admin.from('leads').select('*').eq('id', id).single()

  if (error) throw error
  const [{ data: score }, { data: outreach }, { data: notes }, { data: sendEvents }, { data: market }] =
    await Promise.all([
      admin.from('lead_scores').select('*').eq('lead_id', id).maybeSingle(),
      admin
        .from('outreach_messages')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: true }),
      admin
        .from('lead_notes')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('outreach_send_events')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      lead.target_market_id
        ? admin.from('target_markets').select('*').eq('id', lead.target_market_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

  return {
    lead: lead as LeadRecord,
    score,
    outreach: (outreach || []) as OutreachMessageRecord[],
    notes: (notes || []) as LeadNoteRecord[],
    sendEvents: (sendEvents || []) as OutreachSendEventRecord[],
    market: (market || null) as TargetMarketRecord | null,
  }
}

export async function addLeadNote(leadId: string, authorUserId: string | null, note: string, isInternal = true) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_notes')
    .insert({
      lead_id: leadId,
      author_user_id: authorUserId,
      note,
      is_internal: isInternal,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LeadNoteRecord
}

export async function listTargetMarkets(limit = 50) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('target_markets')
    .select('*')
    .order('final_score', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as TargetMarketRecord[]
}

export async function listSuppressions() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_suppressions')
    .select('*')
    .eq('status', 'active')

  if (error) throw error
  return (data || []) as LeadSuppressionRecord[]
}

export async function upsertSuppression(input: {
  email?: string | null
  phone?: string | null
  website?: string | null
  businessName?: string | null
  city?: string | null
  state?: string | null
  reason: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lead_suppressions')
    .insert({
      email: input.email || null,
      phone: input.phone || null,
      website: input.website || null,
      business_name: input.businessName || null,
      city: input.city || null,
      state: input.state || null,
      reason: input.reason,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as LeadSuppressionRecord
}
