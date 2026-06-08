import { addDays, format } from 'date-fns'

import { sendEmail } from '@/lib/email/sendEmail'
import {
  createEntitySeoRun,
  finishEntitySeoRun,
  insertEntitySeoPerformanceSnapshots,
  listEntitySeoOpportunities,
  upsertEntitySeoOpportunities,
  updateEntitySeoOpportunity,
} from '@/lib/reporting/repository'
import type { EntitySeoOpportunityRecord } from '@/lib/reporting/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

type OpportunityCandidate = {
  entityType: EntitySeoOpportunityRecord['entity_type']
  entityName: string
  city?: string | null
  state?: string | null
  clusterType: string
  opportunityScore: number
  suggestedTitle: string
  suggestedSlug: string
  suggestedKeywords: string[]
  suggestedServiceFocus: string
  sourceReason: string
  approvalStatus: EntitySeoOpportunityRecord['approval_status']
  publishStatus: EntitySeoOpportunityRecord['publish_status']
  sourceSignals: Record<string, unknown>
  safeAutoPublish: boolean
}

type EntitySeoExpansionOptions = {
  dryRun?: boolean
  proactiveCityEnabled?: boolean
  proactiveCityLimit?: number
}

type ProactiveCityMarket = {
  city: string
  state: string
  tier: number
}

type ProactiveCityServiceTemplate = {
  serviceFocus: string
  focusTerm: string
  titlePrefix: string
  slugPrefix: string
  clusterType: string
  keywords: string[]
}

const serviceRouteMap: Record<string, string> = {
  dealvault: '/dealvault',
  business_funding: '/funding',
  business_credit: '/tools/business-credit',
  ai_assistant: '/ai-assistant',
  spanish_business_funding: '/es/vestblock',
  real_estate_funding: '/real-estate-funding',
  sell_property: '/sell',
  grants: '/tools/grants',
  credit_analysis: '/credit-upload',
  credit_dispute_letters: '/tools/my-dispute-letters',
  financial_growth_services: '/services/financial-growth',
  visibility_expansion: '/visibility-expansion',
  business_setup: '/business-setup',
  ai_credit_analysis: '/credit-upload',
}

const serviceLabelMap: Record<string, string> = {
  dealvault: 'DealVault',
  business_funding: 'Business Funding',
  business_credit: 'Business Credit Builder',
  ai_assistant: 'AI Receptionist',
  spanish_business_funding: 'Spanish Business Funding',
  real_estate_funding: 'Real Estate Funding',
  sell_property: 'Sell Property',
  grants: 'Grants',
  credit_analysis: 'Credit Review Tools',
  credit_dispute_letters: 'Credit Dispute Letters',
  financial_growth_services: 'Funding & Business Credit Prep Reviews',
  visibility_expansion: 'Search Visibility',
  business_setup: 'Business Setup',
  ai_credit_analysis: 'Credit Review Tools',
}

const proactiveCityMarkets: ProactiveCityMarket[] = [
  { city: 'Milwaukee', state: 'WI', tier: 1 },
  { city: 'Brookfield', state: 'WI', tier: 1 },
  { city: 'Waukesha', state: 'WI', tier: 1 },
  { city: 'Madison', state: 'WI', tier: 1 },
  { city: 'Chicago', state: 'IL', tier: 1 },
  { city: 'Naperville', state: 'IL', tier: 2 },
  { city: 'Minneapolis', state: 'MN', tier: 2 },
  { city: 'Indianapolis', state: 'IN', tier: 2 },
  { city: 'Detroit', state: 'MI', tier: 2 },
  { city: 'Grand Rapids', state: 'MI', tier: 2 },
  { city: 'Columbus', state: 'OH', tier: 2 },
  { city: 'Cincinnati', state: 'OH', tier: 2 },
  { city: 'St. Louis', state: 'MO', tier: 2 },
  { city: 'Kansas City', state: 'MO', tier: 2 },
  { city: 'Nashville', state: 'TN', tier: 3 },
  { city: 'Atlanta', state: 'GA', tier: 3 },
  { city: 'Charlotte', state: 'NC', tier: 3 },
  { city: 'Tampa', state: 'FL', tier: 3 },
  { city: 'Orlando', state: 'FL', tier: 3 },
  { city: 'Dallas', state: 'TX', tier: 3 },
  { city: 'Houston', state: 'TX', tier: 3 },
  { city: 'Phoenix', state: 'AZ', tier: 3 },
  { city: 'Denver', state: 'CO', tier: 3 },
]

const proactiveCityServiceTemplates: ProactiveCityServiceTemplate[] = [
  {
    serviceFocus: 'ai_assistant',
    focusTerm: 'ai receptionist for home service businesses',
    titlePrefix: 'AI Receptionist for Home Service Businesses',
    slugPrefix: 'ai-receptionist-home-service-businesses',
    clusterType: 'proactive_city_ai_receptionist',
    keywords: ['AI receptionist', 'missed call lead capture', 'website lead capture'],
  },
  {
    serviceFocus: 'ai_assistant',
    focusTerm: 'missed call lead capture service',
    titlePrefix: 'Missed Call Lead Capture Service',
    slugPrefix: 'missed-call-lead-capture-service',
    clusterType: 'proactive_city_ai_receptionist',
    keywords: ['missed call lead capture', 'AI lead capture', 'booking handoff'],
  },
  {
    serviceFocus: 'visibility_expansion',
    focusTerm: 'search visibility for local businesses',
    titlePrefix: 'Search Visibility for Local Businesses',
    slugPrefix: 'search-visibility-local-businesses',
    clusterType: 'proactive_city_visibility',
    keywords: ['search visibility', 'ChatGPT visibility', 'answer engine optimization'],
  },
  {
    serviceFocus: 'visibility_expansion',
    focusTerm: 'chatgpt visibility service for small business',
    titlePrefix: 'ChatGPT Visibility Service for Small Business',
    slugPrefix: 'chatgpt-visibility-service-small-business',
    clusterType: 'proactive_city_visibility',
    keywords: ['ChatGPT visibility service', 'AI search visibility', 'answer-ready service pages'],
  },
  {
    serviceFocus: 'dealvault',
    focusTerm: 'referral payout tracking software',
    titlePrefix: 'Referral Payout Tracking Software',
    slugPrefix: 'referral-payout-tracking-software',
    clusterType: 'proactive_city_dealvault',
    keywords: ['referral payout tracking', 'payout visibility', 'proof records'],
  },
  {
    serviceFocus: 'dealvault',
    focusTerm: 'agreement tracking software for small business',
    titlePrefix: 'Agreement Tracking Software for Small Business',
    slugPrefix: 'agreement-tracking-software-small-business',
    clusterType: 'proactive_city_dealvault',
    keywords: ['agreement tracking software', 'milestone tracking', 'business recordkeeping'],
  },
  {
    serviceFocus: 'financial_growth_services',
    focusTerm: 'business funding prep review',
    titlePrefix: 'Business Funding Prep Review',
    slugPrefix: 'business-funding-prep-review',
    clusterType: 'proactive_city_financial_growth',
    keywords: ['funding prep review', 'funding readiness', 'document checklist'],
  },
  {
    serviceFocus: 'financial_growth_services',
    focusTerm: 'business credit builder sprint',
    titlePrefix: 'Business Credit Builder Sprint',
    slugPrefix: 'business-credit-builder-sprint',
    clusterType: 'proactive_city_financial_growth',
    keywords: ['business credit builder', 'business credit prep', 'EIN setup for credit'],
  },
  {
    serviceFocus: 'grants',
    focusTerm: 'small business grants checklist',
    titlePrefix: 'Small Business Grants Checklist',
    slugPrefix: 'small-business-grants-checklist',
    clusterType: 'proactive_city_grants',
    keywords: ['small business grants', 'grant checklist', 'grant application prep'],
  },
  {
    serviceFocus: 'real_estate_funding',
    focusTerm: 'dscr loan funding prep',
    titlePrefix: 'DSCR Loan Funding Prep',
    slugPrefix: 'dscr-loan-funding-prep',
    clusterType: 'proactive_city_real_estate_funding',
    keywords: ['DSCR loan', 'rental loan', 'real estate funding'],
  },
  {
    serviceFocus: 'sell_property',
    focusTerm: 'sell a house fast consultation',
    titlePrefix: 'Sell A House Fast Consultation',
    slugPrefix: 'sell-house-fast-consultation',
    clusterType: 'proactive_city_sell_property',
    keywords: ['sell a house fast', 'property review', 'cash buyer conversation'],
  },
  {
    serviceFocus: 'credit_analysis',
    focusTerm: 'credit report analysis tool',
    titlePrefix: 'Credit Report Analysis Tool',
    slugPrefix: 'credit-report-analysis-tool',
    clusterType: 'proactive_city_credit_analysis',
    keywords: ['credit report analysis', 'credit report review', 'dispute prep'],
  },
  {
    serviceFocus: 'business_setup',
    focusTerm: 'business funding prep service',
    titlePrefix: 'Business Funding Prep Service',
    slugPrefix: 'business-funding-prep-service',
    clusterType: 'proactive_city_funding_prep',
    keywords: ['business funding prep', 'funding readiness', 'business setup for funding'],
  },
]

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

function titleCase(value: string) {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseIntEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolEnv(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function rotateForToday<T>(items: T[], salt = 0) {
  if (!items.length) return []
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  const offset = (dayIndex + salt) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

function compact<T>(values: Array<T | null | undefined | false>) {
  return values.filter(Boolean) as T[]
}

function cityLabel(city?: string | null, state?: string | null) {
  return [city, state].filter(Boolean).join(', ')
}

function deriveLeadServiceFocus(lead: any) {
  const offer = String(lead.best_offer || '').toLowerCase()
  const category = String(lead.category || '').toLowerCase()
  const niche = String(lead.niche || '').toLowerCase()
  const language = String(lead.language_segment || '').toLowerCase()
  const typeText = JSON.stringify({
    leadType: lead.lead_type,
    businessName: lead.business_name,
    notes: lead.notes,
    painSignal: lead.pain_signal,
    metadata: lead.metadata_json,
  }).toLowerCase()

  if (language.includes('spanish') || language === 'es') return 'spanish_business_funding'
  if (category === 'seller_lead' || category === 'code_violation') return 'sell_property'
  if (
    offer.includes('dealvault') ||
    offer.includes('accountability') ||
    ((category === 'real_estate' || String(lead.lead_type || '').toLowerCase() === 'real_estate') &&
      /contractor|rehab|property management|investor|landlord|referral|partner|jv|joint venture|seller finance|lease option|subject-to|creative finance|rental/.test(
        typeText
      ))
  ) {
    return 'dealvault'
  }
  if (category === 'real_estate') return 'sell_property'
  if (offer.includes('website') || offer.includes('visibility') || niche.includes('seo') || niche.includes('aeo')) {
    return 'visibility_expansion'
  }
  if (offer.includes('ai receptionist') || niche.includes('booking')) return 'ai_assistant'
  if (offer.includes('business credit') || category.includes('business_credit')) return 'business_credit'
  if (offer.includes('grant')) return 'grants'
  if (offer.includes('setup')) return 'business_setup'
  return 'visibility_expansion'
}

function deriveLenderServiceFocus(category: string) {
  const normalized = category.toLowerCase()
  if (['dscr', 'fix_and_flip', 'bridge', 'hard_money', 'refinance', 'brrrr_friendly', 'portfolio_bank', 'construction', 'commercial', 'sba_504_real_estate', 'heloc', 'private_lender', 'creative_finance_partner'].includes(normalized)) {
    return 'real_estate_funding'
  }
  if (normalized.includes('spanish') || normalized.includes('immigrant') || normalized.includes('minority')) {
    return 'spanish_business_funding'
  }
  return 'visibility_expansion'
}

function deriveBuyerServiceFocus() {
  return 'sell_property'
}

function buildKeywords(input: { city?: string | null; state?: string | null; focusTerm: string; serviceLabel: string }) {
  return compact([
    `${input.focusTerm}`,
    input.city ? `${input.focusTerm} ${input.city}` : null,
    input.state ? `${input.focusTerm} ${input.state}` : null,
    input.city && input.state ? `${input.focusTerm} ${input.city} ${input.state}` : null,
    `${input.serviceLabel.toLowerCase()}`,
  ])
}

function isProactiveCityOpportunity(opportunity: OpportunityCandidate) {
  return Boolean((opportunity.sourceSignals as { proactiveCitySeed?: unknown } | undefined)?.proactiveCitySeed)
}

function buildProactiveBodyMarkdown(opportunity: OpportunityCandidate) {
  const serviceLabel = serviceLabelMap[opportunity.suggestedServiceFocus] || titleCase(opportunity.suggestedServiceFocus)
  const route = serviceRouteMap[opportunity.suggestedServiceFocus] || '/services'
  const location = cityLabel(opportunity.city, opportunity.state) || 'this market'
  const keywords = opportunity.suggestedKeywords.slice(0, 5)

  return `# ${opportunity.suggestedTitle}

VestBlock created this page to explain how ${serviceLabel.toLowerCase()} can help businesses in ${location} strengthen trust, visibility, and lead capture without making inflated claims.

## Why this matters in ${location}

- Local businesses need clearer service pages that answer buyer questions directly
- Missed calls, unclear proof records, and weak search visibility can cost real opportunities
- Buyers and partners move faster when the next step is obvious
- Search engines and answer engines need specific, crawlable explanations instead of vague service copy

## How VestBlock can help

- Clarify the business offer and route interested visitors to the right next step
- Organize proof records, milestones, payouts, or intake details when they matter
- Improve answer-ready service language for people researching this topic
- Create a more practical handoff from research to ${route}

## Safe expectations

VestBlock can support stronger readiness, clearer records, better lead capture, and improved crawlability. We do not guarantee rankings, AI citations, funding approvals, legal outcomes, payouts, or customer results.

## Keywords this page supports

- ${keywords.join('\n- ')}

## Next step

Open the VestBlock ${serviceLabel.toLowerCase()} page and use it as the practical starting point for ${location}.
`
}

function buildBodyMarkdown(opportunity: OpportunityCandidate) {
  const serviceLabel = serviceLabelMap[opportunity.suggestedServiceFocus] || titleCase(opportunity.suggestedServiceFocus)
  const route = serviceRouteMap[opportunity.suggestedServiceFocus] || '/services'
  const location = cityLabel(opportunity.city, opportunity.state) || titleCase(opportunity.entityName)
  const keywords = opportunity.suggestedKeywords.slice(0, 4).join(', ')

  if (isProactiveCityOpportunity(opportunity)) {
    return buildProactiveBodyMarkdown(opportunity)
  }

  return `# ${opportunity.suggestedTitle}

VestBlock reviews real customer interest around ${location} so we can publish more useful pages about funding, lead capture, real-estate help, and partner coverage.

## Why this topic matters in ${location}

- Recent activity showed meaningful interest around this topic
- The topic was strong enough to prioritize a city, niche, or service page
- The goal is to connect research with a practical next step instead of publishing generic filler
- The closest service path for this topic currently routes through ${route}

## What this page is meant to help with

- Clarify the local intent behind this topic
- Connect the topic to a real VestBlock service path
- Give business owners, sellers, or partners a cleaner starting point

## How VestBlock fits

VestBlock helps organize the next step for ${serviceLabel.toLowerCase()}, documentation, lead routing, and follow-up. We use real customer interest so the page library stays closer to what people actually need.

## Keywords we are targeting

- ${keywords.split(', ').join('\n- ')}

## Next step

Open the VestBlock page for ${serviceLabel.toLowerCase()} and move from research into a more practical plan.
`
}

function buildTitleSlugForLead(city: string, state: string, lead: { niche?: string | null; category?: string | null; language_segment?: string | null }, serviceFocus: string) {
  const niche = String(lead.niche || '').trim()
  const category = String(lead.category || '').trim().toLowerCase()
  const isSpanish = /spanish|es/.test(String(lead.language_segment || '').toLowerCase()) || serviceFocus === 'spanish_business_funding'

  if (category === 'code_violation') {
    return {
      title: `Code Violation Property Help in ${city}, ${state}`,
      slug: `code-violation-property-help-${slugify(city)}-${slugify(state)}`,
      focus: 'code violation property help',
      clusterType: 'city_real_estate_help',
    }
  }

  if (category === 'seller_lead' || category === 'real_estate') {
    return {
      title: `Sell My House Fast in ${city}, ${state}`,
      slug: `sell-my-house-fast-${slugify(city)}-${slugify(state)}`,
      focus: 'sell my house fast',
      clusterType: 'city_real_estate_help',
    }
  }

  if (isSpanish) {
    return {
      title: `Spanish Business Funding in ${city}, ${state}`,
      slug: `spanish-business-funding-${slugify(city)}-${slugify(state)}`,
      focus: 'spanish business funding',
      clusterType: 'spanish_city_service',
    }
  }

  const nicheLabel = niche ? titleCase(niche) : serviceLabelMap[serviceFocus] || titleCase(serviceFocus)
  const suffix =
    serviceFocus === 'dealvault'
      ? 'DealVault'
      : serviceFocus === 'visibility_expansion'
        ? 'Visibility Expansion'
        : serviceFocus === 'ai_assistant'
          ? 'AI Receptionist'
          : serviceFocus === 'business_credit'
            ? 'Business Credit'
            : serviceFocus === 'business_setup'
              ? 'Business Setup'
              : 'Funding'

  return {
    title: `${nicheLabel} ${suffix} in ${city}, ${state}`,
    slug: `${slugify(nicheLabel)}-${slugify(suffix)}-${slugify(city)}-${slugify(state)}`,
    focus: `${nicheLabel.toLowerCase()} ${suffix.toLowerCase()}`,
    clusterType: 'city_niche_service',
  }
}

function buildTitleSlugForLender(city: string | null, state: string | null, category: string) {
  const label = titleCase(category.replace(/_/g, ' '))
  const baseLocation = cityLabel(city, state) || state || city || 'your market'
  const stateOnly = state ? `-${slugify(state)}` : city ? `-${slugify(city)}` : ''
  return {
    title: `${label} Lenders in ${baseLocation}`,
    slug: `${slugify(label)}-lenders${stateOnly}`,
    focus: `${label.toLowerCase()} lenders`,
    clusterType: city ? 'city_lender_category' : 'state_lender_category',
  }
}

function buildTitleSlugForBuyer(city: string | null, state: string | null, category: string) {
  const location = cityLabel(city, state) || state || city || 'your market'
  if (category === 'local_cash_buyer' || category === 'wholesaler_buyer' || category === 'fix_and_flip_buyer') {
    return {
      title: `Cash Home Buyers in ${location}`,
      slug: `cash-home-buyers-${slugify(location)}`,
      focus: 'cash home buyers',
      clusterType: 'city_buyer_category',
    }
  }

  const label = titleCase(category.replace(/_/g, ' '))
  return {
    title: `${label} in ${location}`,
    slug: `${slugify(label)}-${slugify(location)}`,
    focus: label.toLowerCase(),
    clusterType: 'city_buyer_category',
  }
}

function normalizeOpportunityRecord(opportunity: OpportunityCandidate | EntitySeoOpportunityRecord): OpportunityCandidate {
  if ('suggestedTitle' in opportunity) {
    return opportunity
  }

  return {
    entityType: opportunity.entity_type,
    entityName: opportunity.entity_name,
    city: opportunity.city,
    state: opportunity.state,
    clusterType: opportunity.cluster_type,
    opportunityScore: opportunity.opportunity_score,
    suggestedTitle: opportunity.suggested_title,
    suggestedSlug: opportunity.suggested_slug,
    suggestedKeywords: opportunity.suggested_keywords,
    suggestedServiceFocus: opportunity.suggested_service_focus || 'visibility_expansion',
    sourceReason: opportunity.source_reason,
    approvalStatus: opportunity.approval_status,
    publishStatus: opportunity.publish_status,
    sourceSignals: opportunity.source_signals_json || {},
    safeAutoPublish: opportunity.publish_status === 'published' || opportunity.approval_status === 'published',
  }
}

async function createOrPublishContentAssetForOpportunity(opportunity: OpportunityCandidate | EntitySeoOpportunityRecord) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const normalized = normalizeOpportunityRecord(opportunity)
  const bodyMarkdown = buildBodyMarkdown({
    ...normalized,
    safeAutoPublish: true,
  })

  const { data, error } = await admin
    .from('content_assets')
    .upsert(
      {
        created_by: null,
        title: normalized.suggestedTitle,
        slug: normalized.suggestedSlug,
        content_type: 'seo_page',
        service_key: normalized.suggestedServiceFocus,
        language: String((normalized.sourceSignals as { language?: string } | undefined)?.language || 'en').startsWith('es')
          ? 'es'
          : 'en',
        audience: `people looking for ${normalized.entityName} support in ${cityLabel(normalized.city, normalized.state) || 'this market'}`,
        prompt: 'Generated by VestBlock entity SEO expansion.',
        status: 'published',
        platform: 'automation',
        post_type: 'entity seo opportunity',
        seo_title: `${normalized.suggestedTitle} | VestBlock`,
        meta_description: `${normalized.suggestedTitle} with VestBlock guidance, market context, and next-step support.`,
        excerpt: `${normalized.sourceReason}`.slice(0, 240),
        body_markdown: bodyMarkdown,
        social_caption: null,
        hashtags: [],
        cta_label: `Open ${serviceLabelMap[normalized.suggestedServiceFocus || 'visibility_expansion'] || 'VestBlock'}`,
        cta_url: serviceRouteMap[normalized.suggestedServiceFocus || 'visibility_expansion'] || '/services',
        publish_path: `/resources/${normalized.suggestedSlug}`,
        metadata_json: {
          generatedBy: 'entity-seo-expansion',
          sourceReason: normalized.sourceReason,
          entityType: normalized.entityType,
          clusterType: normalized.clusterType,
        },
        published_at: now,
        updated_at: now,
      },
      { onConflict: 'slug' }
    )
    .select('id,slug,status,published_at')
    .single()

  if (error) throw error
  return data
}

export async function publishEntitySeoOpportunity(id: string) {
  const opportunity = await listEntitySeoOpportunities({ limit: 500 }).then((rows) => rows.find((row) => row.id === id))
  if (!opportunity) throw new Error('SEO opportunity not found.')

  const content = await createOrPublishContentAssetForOpportunity(opportunity)
  const updated = await updateEntitySeoOpportunity(id, {
    content_asset_id: content.id,
    approval_status: 'published',
    publish_status: 'published',
  })

  await logEvent({
    eventType: 'content_published',
    entityType: 'entity_seo_opportunity',
    entityId: id,
    metadata: { slug: updated.suggested_slug, contentAssetId: content.id },
  })

  return updated
}

function buildNamedReviewOpportunity(entityType: EntitySeoOpportunityRecord['entity_type'], entityName: string, city?: string | null, state?: string | null, serviceFocus = 'visibility_expansion'): OpportunityCandidate {
  return {
    entityType,
    entityName,
    city: city ?? null,
    state: state ?? null,
    clusterType: 'named_partner_profile',
    opportunityScore: 38,
    suggestedTitle: `Review SEO opportunity for ${entityName}`,
    suggestedSlug: `review-${slugify(entityName)}-${slugify(cityLabel(city, state) || 'partner')}`.slice(0, 95),
    suggestedKeywords: [entityName.toLowerCase(), cityLabel(city, state).toLowerCase()].filter(Boolean),
    suggestedServiceFocus: serviceFocus,
    sourceReason: `Named partner signal detected for ${entityName}; queueing for human review before any public page is created.`,
    approvalStatus: 'needs_review',
    publishStatus: 'queued',
    sourceSignals: { namedEntity: true },
    safeAutoPublish: false,
  }
}

function buildLenderOpportunitiesFromRecord(lender: {
  name: string
  category: string
  headquarters_city?: string | null
  headquarters_state?: string | null
  relationship_stage?: string | null
}) {
  const serviceFocus = deriveLenderServiceFocus(lender.category)
  const opportunities: OpportunityCandidate[] = []
  const review = buildNamedReviewOpportunity(
    'lender_segment',
    lender.name,
    lender.headquarters_city,
    lender.headquarters_state,
    serviceFocus
  )

  opportunities.push({
    ...review,
    opportunityScore:
      lender.relationship_stage === 'active_partner' ? 54 : review.opportunityScore,
    sourceReason:
      lender.relationship_stage === 'active_partner'
        ? `${lender.name} is now an active VestBlock lender partner; queueing a named review page before any public profile is created.`
        : review.sourceReason,
  })

  const shape = buildTitleSlugForLender(
    lender.headquarters_city ?? null,
    lender.headquarters_state ?? null,
    lender.category
  )

  opportunities.push({
    entityType: 'lender_segment',
    entityName: lender.category,
    city: lender.headquarters_city ?? null,
    state: lender.headquarters_state ?? null,
    clusterType: shape.clusterType,
    opportunityScore: lender.relationship_stage === 'active_partner' ? 62 : 44,
    suggestedTitle: shape.title,
    suggestedSlug: shape.slug,
    suggestedKeywords: buildKeywords({
      city: lender.headquarters_city ?? null,
      state: lender.headquarters_state ?? null,
      focusTerm: shape.focus,
      serviceLabel: serviceLabelMap[serviceFocus],
    }),
    suggestedServiceFocus: serviceFocus,
    sourceReason:
      lender.relationship_stage === 'active_partner'
        ? `${lender.name} is active in VestBlock and reinforces ${titleCase(lender.category.replace(/_/g, ' '))} coverage in ${cityLabel(lender.headquarters_city, lender.headquarters_state) || 'this market'}.`
        : `${lender.name} added a fresh ${titleCase(lender.category.replace(/_/g, ' '))} lender signal in ${cityLabel(lender.headquarters_city, lender.headquarters_state) || 'this market'}.`,
    approvalStatus: lender.relationship_stage === 'active_partner' ? 'ready' : 'suggested',
    publishStatus: 'queued',
    sourceSignals: {
      category: lender.category,
      relationshipStage: lender.relationship_stage || null,
      namedEntity: lender.name,
    },
    safeAutoPublish: false,
  })

  return opportunities
}

function buildBuyerOpportunitiesFromRecord(buyer: {
  name: string
  category: string
  headquarters_city?: string | null
  headquarters_state?: string | null
  relationship_stage?: string | null
}) {
  const opportunities: OpportunityCandidate[] = []
  const review = buildNamedReviewOpportunity(
    'buyer_segment',
    buyer.name,
    buyer.headquarters_city,
    buyer.headquarters_state,
    'sell_property'
  )

  opportunities.push({
    ...review,
    opportunityScore:
      buyer.relationship_stage === 'active_buyer' ? 54 : review.opportunityScore,
    sourceReason:
      buyer.relationship_stage === 'active_buyer'
        ? `${buyer.name} is now an active VestBlock buyer; queueing a named review page before any public profile is created.`
        : review.sourceReason,
  })

  const shape = buildTitleSlugForBuyer(
    buyer.headquarters_city ?? null,
    buyer.headquarters_state ?? null,
    buyer.category
  )

  opportunities.push({
    entityType: 'buyer_segment',
    entityName: buyer.category,
    city: buyer.headquarters_city ?? null,
    state: buyer.headquarters_state ?? null,
    clusterType: shape.clusterType,
    opportunityScore: buyer.relationship_stage === 'active_buyer' ? 62 : 44,
    suggestedTitle: shape.title,
    suggestedSlug: shape.slug,
    suggestedKeywords: buildKeywords({
      city: buyer.headquarters_city ?? null,
      state: buyer.headquarters_state ?? null,
      focusTerm: shape.focus,
      serviceLabel: serviceLabelMap.sell_property,
    }),
    suggestedServiceFocus: 'sell_property',
    sourceReason:
      buyer.relationship_stage === 'active_buyer'
        ? `${buyer.name} is active in VestBlock and strengthens buyer coverage in ${cityLabel(buyer.headquarters_city, buyer.headquarters_state) || 'this market'}.`
        : `${buyer.name} added a fresh buyer signal in ${cityLabel(buyer.headquarters_city, buyer.headquarters_state) || 'this market'}.`,
    approvalStatus: buyer.relationship_stage === 'active_buyer' ? 'ready' : 'suggested',
    publishStatus: 'queued',
    sourceSignals: {
      category: buyer.category,
      relationshipStage: buyer.relationship_stage || null,
      namedEntity: buyer.name,
    },
    safeAutoPublish: false,
  })

  return opportunities
}

function buildProactiveCityOpportunities(existingSlugs: Set<string>, limit: number) {
  const opportunities: OpportunityCandidate[] = []
  const markets = rotateForToday(proactiveCityMarkets)
  const templates = rotateForToday(proactiveCityServiceTemplates, 3)
  const usedSlugs = new Set(existingSlugs)

  for (const market of markets) {
    for (const template of templates) {
      if (opportunities.length >= limit) return opportunities

      const slug = `${template.slugPrefix}-${slugify(market.city)}-${slugify(market.state)}`
      if (usedSlugs.has(slug)) continue

      const serviceLabel = serviceLabelMap[template.serviceFocus] || titleCase(template.serviceFocus)
      usedSlugs.add(slug)
      opportunities.push({
        entityType: 'city',
        entityName: template.focusTerm,
        city: market.city,
        state: market.state,
        clusterType: template.clusterType,
        opportunityScore: 52 + Math.max(0, 4 - market.tier) * 2,
        suggestedTitle: `${template.titlePrefix} in ${market.city}, ${market.state}`,
        suggestedSlug: slug,
        suggestedKeywords: Array.from(
          new Set([
            ...buildKeywords({
              city: market.city,
              state: market.state,
              focusTerm: template.focusTerm,
              serviceLabel,
            }),
            ...template.keywords,
          ])
        ),
        suggestedServiceFocus: template.serviceFocus,
        sourceReason: `Proactive city expansion for ${template.focusTerm} in ${cityLabel(market.city, market.state)} so VestBlock builds local coverage before waiting on lead volume.`,
        approvalStatus: 'ready',
        publishStatus: 'queued',
        sourceSignals: {
          proactiveCitySeed: true,
          marketTier: market.tier,
          focusTerm: template.focusTerm,
          keywordCluster: template.keywords,
          language: 'en',
        },
        safeAutoPublish: true,
      })
    }
  }

  return opportunities
}

async function saveImmediateSeoOpportunities(
  candidates: OpportunityCandidate[],
  metadata: { entityType: string; entityId: string; trigger: string }
) {
  if (!candidates.length) return []

  const unique = new Map<string, OpportunityCandidate>()
  for (const candidate of candidates) {
    if (!unique.has(candidate.suggestedSlug)) unique.set(candidate.suggestedSlug, candidate)
  }

  const saved = await upsertEntitySeoOpportunities(
    Array.from(unique.values()).map((candidate) => ({
      entityType: candidate.entityType,
      entityName: candidate.entityName,
      city: candidate.city,
      state: candidate.state,
      clusterType: candidate.clusterType,
      opportunityScore: candidate.opportunityScore,
      suggestedTitle: candidate.suggestedTitle,
      suggestedSlug: candidate.suggestedSlug,
      suggestedKeywords: candidate.suggestedKeywords,
      suggestedServiceFocus: candidate.suggestedServiceFocus,
      sourceReason: candidate.sourceReason,
      approvalStatus: candidate.approvalStatus,
      publishStatus: candidate.publishStatus,
      sourceSignals: candidate.sourceSignals,
      performance: {
        trigger: metadata.trigger,
        immediate: true,
      },
    }))
  )

  await logEvent({
    eventType: 'content_generated',
    entityType: `${metadata.entityType}_seo_queue`,
    entityId: metadata.entityId,
    metadata: {
      trigger: metadata.trigger,
      suggestionCount: saved.length,
      slugs: saved.map((item) => item.suggested_slug),
    },
  })

  return saved
}

export async function queueSeoForLenderRecord(lender: {
  id: string
  name: string
  category: string
  headquarters_city?: string | null
  headquarters_state?: string | null
  relationship_stage?: string | null
}) {
  return saveImmediateSeoOpportunities(
    buildLenderOpportunitiesFromRecord(lender),
    { entityType: 'lender', entityId: lender.id, trigger: lender.relationship_stage === 'active_partner' ? 'active_partner' : 'lender_record' }
  )
}

export async function queueSeoForBuyerRecord(buyer: {
  id: string
  name: string
  category: string
  headquarters_city?: string | null
  headquarters_state?: string | null
  relationship_stage?: string | null
}) {
  return saveImmediateSeoOpportunities(
    buildBuyerOpportunitiesFromRecord(buyer),
    { entityType: 'buyer', entityId: buyer.id, trigger: buyer.relationship_stage === 'active_buyer' ? 'active_buyer' : 'buyer_record' }
  )
}

export async function runEntitySeoExpansion(options: EntitySeoExpansionOptions = {}) {
  const admin = createAdminClient()
  const proactiveCityEnabled =
    options.proactiveCityEnabled ?? parseBoolEnv('ENTITY_SEO_PROACTIVE_CITY_ENABLED', true)
  const proactiveCityLimit = Math.min(
    12,
    Math.max(0, options.proactiveCityLimit ?? parseIntEnv('ENTITY_SEO_PROACTIVE_CITY_LIMIT', 6))
  )
  const run = await createEntitySeoRun({
    runType: options.dryRun ? 'manual_refresh' : 'daily_scan',
    requestParams: {
      dryRun: options.dryRun || false,
      proactiveCityEnabled,
      proactiveCityLimit,
    },
  })

  try {
    const startedAt = addDays(new Date(), -7).toISOString()
    const [leadsResult, lendersResult, buyersResult, assetsResult, opportunitiesResult] = await Promise.all([
      admin
        .from('leads')
        .select('id,city,state,niche,best_offer,category,language_segment,created_at')
        .gte('created_at', startedAt),
      admin
        .from('lenders')
        .select('id,name,category,headquarters_city,headquarters_state,created_at')
        .gte('created_at', startedAt),
      admin
        .from('buyers')
        .select('id,name,category,headquarters_city,headquarters_state,created_at')
        .gte('created_at', startedAt),
      admin.from('content_assets').select('slug,id,status,published_at,indexed_status'),
      admin.from('entity_seo_opportunities').select('suggested_slug'),
    ])

    if (leadsResult.error) throw leadsResult.error
    if (lendersResult.error) throw lendersResult.error
    if (buyersResult.error) throw buyersResult.error
    if (assetsResult.error) throw assetsResult.error
    if (opportunitiesResult.error) throw opportunitiesResult.error

    const existingSlugs = new Set<string>([
      ...(assetsResult.data || []).map((row) => row.slug),
      ...(opportunitiesResult.data || []).map((row) => row.suggested_slug),
    ])

    const candidates: OpportunityCandidate[] = []
    const proactiveCityCandidates =
      proactiveCityEnabled && proactiveCityLimit > 0
        ? buildProactiveCityOpportunities(existingSlugs, proactiveCityLimit)
        : []

    const leadGroups = new Map<string, { city: string; state: string; sample: any; count: number }>()
    for (const lead of leadsResult.data || []) {
      if (!lead.city || !lead.state) continue
      const key = `${lead.city}|${lead.state}|${lead.niche || 'general'}|${deriveLeadServiceFocus(lead)}|${lead.category || 'general'}`
      const current = leadGroups.get(key)
      if (current) {
        current.count += 1
      } else {
        leadGroups.set(key, { city: lead.city, state: lead.state, sample: lead, count: 1 })
      }
    }

    for (const [, group] of leadGroups) {
      const serviceFocus = deriveLeadServiceFocus(group.sample)
      const shape = buildTitleSlugForLead(group.city, group.state, group.sample, serviceFocus)
      if (existingSlugs.has(shape.slug)) continue
      const opportunityScore = Math.min(96, 42 + group.count * 8 + (serviceFocus === 'spanish_business_funding' ? 12 : 0))
      candidates.push({
        entityType: 'lead_segment',
        entityName: group.sample.niche || group.sample.category || serviceFocus,
        city: group.city,
        state: group.state,
        clusterType: shape.clusterType,
        opportunityScore,
        suggestedTitle: shape.title,
        suggestedSlug: shape.slug,
        suggestedKeywords: buildKeywords({
          city: group.city,
          state: group.state,
          focusTerm: shape.focus,
          serviceLabel: serviceLabelMap[serviceFocus],
        }),
        suggestedServiceFocus: serviceFocus,
        sourceReason: `Recent lead activity in ${group.city}, ${group.state} produced ${group.count} matching signals for ${group.sample.niche || group.sample.category || serviceFocus}.`,
        approvalStatus: group.count >= 2 ? 'ready' : 'suggested',
        publishStatus: 'queued',
        sourceSignals: {
          count: group.count,
          category: group.sample.category,
          niche: group.sample.niche,
          language: group.sample.language_segment || 'en',
        },
        safeAutoPublish: group.count >= 2,
      })
    }

    const lenderGroups = new Map<string, { city: string | null; state: string | null; category: string; count: number }>()
    for (const lender of lendersResult.data || []) {
      const key = `${lender.headquarters_city || ''}|${lender.headquarters_state || ''}|${lender.category}`
      const current = lenderGroups.get(key)
      if (current) current.count += 1
      else lenderGroups.set(key, { city: lender.headquarters_city, state: lender.headquarters_state, category: lender.category, count: 1 })

      if (lender.name) {
        const review = buildNamedReviewOpportunity('lender_segment', lender.name, lender.headquarters_city, lender.headquarters_state, deriveLenderServiceFocus(lender.category))
        if (!existingSlugs.has(review.suggestedSlug)) candidates.push(review)
      }
    }

    for (const [, group] of lenderGroups) {
      const shape = buildTitleSlugForLender(group.city, group.state, group.category)
      if (existingSlugs.has(shape.slug)) continue
      const serviceFocus = deriveLenderServiceFocus(group.category)
      candidates.push({
        entityType: 'lender_segment',
        entityName: group.category,
        city: group.city,
        state: group.state,
        clusterType: shape.clusterType,
        opportunityScore: Math.min(90, 36 + group.count * 10),
        suggestedTitle: shape.title,
        suggestedSlug: shape.slug,
        suggestedKeywords: buildKeywords({
          city: group.city,
          state: group.state,
          focusTerm: shape.focus,
          serviceLabel: serviceLabelMap[serviceFocus],
        }),
        suggestedServiceFocus: serviceFocus,
        sourceReason: `${group.count} recent lender records point to stronger ${titleCase(group.category.replace(/_/g, ' '))} demand in ${cityLabel(group.city, group.state) || 'this market'}.`,
        approvalStatus: group.count >= 2 ? 'ready' : 'suggested',
        publishStatus: 'queued',
        sourceSignals: { count: group.count, category: group.category },
        safeAutoPublish: group.count >= 2,
      })
    }

    const buyerGroups = new Map<string, { city: string | null; state: string | null; category: string; count: number }>()
    for (const buyer of buyersResult.data || []) {
      const key = `${buyer.headquarters_city || ''}|${buyer.headquarters_state || ''}|${buyer.category}`
      const current = buyerGroups.get(key)
      if (current) current.count += 1
      else buyerGroups.set(key, { city: buyer.headquarters_city, state: buyer.headquarters_state, category: buyer.category, count: 1 })

      if (buyer.name) {
        const review = buildNamedReviewOpportunity('buyer_segment', buyer.name, buyer.headquarters_city, buyer.headquarters_state, 'sell_property')
        if (!existingSlugs.has(review.suggestedSlug)) candidates.push(review)
      }
    }

    for (const [, group] of buyerGroups) {
      const shape = buildTitleSlugForBuyer(group.city, group.state, group.category)
      if (existingSlugs.has(shape.slug)) continue
      const serviceFocus = deriveBuyerServiceFocus()
      candidates.push({
        entityType: 'buyer_segment',
        entityName: group.category,
        city: group.city,
        state: group.state,
        clusterType: shape.clusterType,
        opportunityScore: Math.min(92, 38 + group.count * 11),
        suggestedTitle: shape.title,
        suggestedSlug: shape.slug,
        suggestedKeywords: buildKeywords({
          city: group.city,
          state: group.state,
          focusTerm: shape.focus,
          serviceLabel: serviceLabelMap[serviceFocus],
        }),
        suggestedServiceFocus: serviceFocus,
        sourceReason: `${group.count} recent buyer records in ${cityLabel(group.city, group.state) || 'this market'} support a targeted real-estate buyer page.`,
        approvalStatus: group.count >= 2 ? 'ready' : 'suggested',
        publishStatus: 'queued',
        sourceSignals: { count: group.count, category: group.category },
        safeAutoPublish: group.count >= 2,
      })
    }

    candidates.push(...proactiveCityCandidates)

    const deduped = new Map<string, OpportunityCandidate>()
    for (const candidate of candidates.sort((a, b) => b.opportunityScore - a.opportunityScore)) {
      if (!deduped.has(candidate.suggestedSlug)) deduped.set(candidate.suggestedSlug, candidate)
    }

    const finalCandidates = Array.from(deduped.values()).sort((a, b) => b.opportunityScore - a.opportunityScore)
    if (options.dryRun) {
      await finishEntitySeoRun(run.id, {
        status: 'completed',
        resultCount: finalCandidates.length,
        autoPublishedCount: 0,
      })
      return {
        ok: true,
        count: finalCandidates.length,
        autoPublishedCount: 0,
        proactiveCityCandidatesCount: proactiveCityCandidates.length,
        opportunities: finalCandidates,
      }
    }

    const saved = await upsertEntitySeoOpportunities(
      finalCandidates.map((candidate) => ({
        entityType: candidate.entityType,
        entityName: candidate.entityName,
        city: candidate.city,
        state: candidate.state,
        clusterType: candidate.clusterType,
        opportunityScore: candidate.opportunityScore,
        suggestedTitle: candidate.suggestedTitle,
        suggestedSlug: candidate.suggestedSlug,
        suggestedKeywords: candidate.suggestedKeywords,
        suggestedServiceFocus: candidate.suggestedServiceFocus,
        sourceReason: candidate.sourceReason,
        approvalStatus: candidate.approvalStatus,
        publishStatus: candidate.publishStatus,
        createdByRunId: run.id,
        sourceSignals: candidate.sourceSignals,
        performance: {},
      }))
    )

    const autoPublishEnabled = parseBoolEnv('ENTITY_SEO_AUTO_PUBLISH_ENABLED', true)
    const autoPublishLimit = parseIntEnv('ENTITY_SEO_AUTO_PUBLISH_LIMIT', 3)
    const toPublish = autoPublishEnabled
      ? finalCandidates.filter((candidate) => candidate.safeAutoPublish).slice(0, autoPublishLimit)
      : []

    let autoPublishedCount = 0
    for (const candidate of toPublish) {
      const savedOpportunity = saved.find((row) => row.suggested_slug === candidate.suggestedSlug)
      if (!savedOpportunity) continue
      const content = await createOrPublishContentAssetForOpportunity(candidate)
      await updateEntitySeoOpportunity(savedOpportunity.id, {
        content_asset_id: content.id,
        approval_status: 'published',
        publish_status: 'published',
      })
      autoPublishedCount += 1
    }

    const allOpportunities = await listEntitySeoOpportunities({ limit: 250 })
    const snapshotDate = format(new Date(), 'yyyy-MM-dd')
    const snapshots = await insertEntitySeoPerformanceSnapshots(
      allOpportunities
        .filter((row) => row.content_asset_id)
        .map((row) => {
          const asset = (assetsResult.data || []).find((item) => item.id === row.content_asset_id)
          return {
            opportunityId: row.id,
            contentAssetId: row.content_asset_id,
            snapshotDate,
            indexedStatus: asset?.indexed_status || null,
            publishStatus: asset?.status || row.publish_status,
            performance: {
              opportunityScore: row.opportunity_score,
              clusterType: row.cluster_type,
            },
          }
        })
    )

    await finishEntitySeoRun(run.id, {
      status: 'completed',
      resultCount: saved.length,
      autoPublishedCount,
    })

    await logEvent({
      eventType: 'content_generated',
      entityType: 'entity_seo_batch',
      entityId: run.id,
      metadata: {
        opportunityCount: saved.length,
        autoPublishedCount,
        snapshotCount: snapshots.length,
        proactiveCityCandidatesCount: proactiveCityCandidates.length,
      },
    })

    if (process.env.ADMIN_ALERT_EMAIL && saved.length > 0) {
      await sendEmail({
        to: process.env.ADMIN_ALERT_EMAIL,
        subject: `VestBlock entity SEO report: ${saved.length} new opportunities`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;">
            <h2 style="color:#fff;">Entity SEO opportunities</h2>
            <p>${saved.length} opportunities created, ${autoPublishedCount} auto-published.</p>
            <ul>${saved.slice(0, 8).map((item) => `<li style="margin-bottom:8px;">${item.suggested_title}</li>`).join('')}</ul>
          </div>
        `,
        eventType: 'admin_lead_run_daily_report',
      }).catch(() => null)
    }

    return {
      ok: true,
      count: saved.length,
      autoPublishedCount,
      proactiveCityCandidatesCount: proactiveCityCandidates.length,
      opportunities: saved,
    }
  } catch (error) {
    await finishEntitySeoRun(run.id, {
      status: 'failed',
      resultCount: 0,
      autoPublishedCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function regenerateEntitySeoOpportunity(id: string) {
  const opportunity = await listEntitySeoOpportunities({ limit: 500 }).then((rows) => rows.find((row) => row.id === id))
  if (!opportunity) throw new Error('SEO opportunity not found.')

  const title = opportunity.suggested_title
  const slug = opportunity.suggested_slug
  const keywords = opportunity.suggested_keywords
  return updateEntitySeoOpportunity(id, {
    suggested_title: title,
    suggested_slug: slug,
    suggested_keywords: keywords,
    source_reason: `${opportunity.source_reason} Regenerated on ${format(new Date(), 'yyyy-MM-dd')}.`,
  })
}
