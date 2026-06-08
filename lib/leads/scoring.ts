import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import { listActiveScoreAdjustments } from '@/lib/improvement/repository'
import type {
  LeadOffer,
  LeadRecord,
  LeadScoreBreakdown,
  WebsiteWeaknessReport,
} from '@/lib/leads/types'
import { daysBetween } from '@/lib/leads/utils'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function isUrbanMarket(lead: LeadRecord) {
  return /(milwaukee|chicago|cincinnati|columbus|cleveland|detroit|atlanta|houston|dallas)/i.test(
    [lead.city, lead.state, lead.property_address].filter(Boolean).join(' ')
  )
}

function businessTypeText(lead: LeadRecord) {
  return JSON.stringify({
    category: lead.category,
    businessName: lead.business_name,
    name: lead.name,
    notes: lead.notes,
    pain: lead.pain_signal,
    metadata: lead.metadata_json,
    formData: lead.form_data,
  }).toLowerCase()
}

const WEBMAIL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com'])

function extractEmailDomain(email: string | null | undefined) {
  const parts = String(email || '').trim().toLowerCase().split('@')
  return parts.length === 2 ? parts[1] : null
}

function extractWebsiteHost(website: string | null | undefined) {
  if (!website) return null
  try {
    const normalized = /^https?:\/\//i.test(website) ? website : `https://${website}`
    return new URL(normalized).host.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function domainsLookAligned(emailDomain: string, websiteHost: string) {
  return emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${emailDomain}`)
}

function hasDirectBusinessEmail(lead: LeadRecord) {
  if (lead.email_valid === false || !isUsableContactEmail(lead.email)) return false
  const emailDomain = extractEmailDomain(lead.email)
  const websiteHost = extractWebsiteHost(lead.website)
  return Boolean(emailDomain && websiteHost && domainsLookAligned(emailDomain, websiteHost))
}

function getContactFormCount(lead: LeadRecord) {
  const urls = lead.contact_info?.contactFormUrls
  return Array.isArray(urls) ? urls.filter((value) => typeof value === 'string' && value.trim()).length : 0
}

const dealVaultWorkflowSegments: Array<{
  niche: string
  marketSegment: string
  outreachAngle: string
  pattern: RegExp
}> = [
  {
    niche: 'Construction draw and milestone tracking',
    marketSegment: 'dealvault_construction_rehab',
    outreachAngle: 'Contractor milestones, draw approvals, and proof records',
    pattern: /construction|contractor|rehab|renovation|remodel|remodeler|design-build|draw request|draw schedule|progress billing|retainage|scope of work|change order|subcontractor|solar installer|solar epc|pool builder|spa installer|fence contractor|deck builder|outdoor living contractor|abatement|asbestos|lead inspection|lead abatement|mold assessment|clearance testing|ff&e|millwork installer/,
  },
  {
    niche: 'Property management work-order accountability',
    marketSegment: 'dealvault_property_management',
    outreachAngle: 'Vendor deliverables, approvals, and service proof for managed properties',
    pattern: /property management|property manager|turnover|maintenance vendor|maintenance coordination|vendor coordination|work order|unit turn|repair coordination|hoa|make ready|make-ready|grounds maintenance|snow removal|landscaping maintenance|apartment turn|turn service|leasing turnover|rental turn|home watch|property watch|vacant property service|seasonal home management|absentee home service|reserve study|reserve specialist/,
  },
  {
    niche: 'Referral payout and partner split tracking',
    marketSegment: 'dealvault_referral_partner_splits',
    outreachAngle: 'Referral payouts, split visibility, and partner accountability',
    pattern: /referral fee|referral payout|bird dog|partner split|profit split|commission split|jv|joint venture|co-wholesale|dispo|assignment fee|partner payout|referral partner|intro fee|origination fee|dealer fee|channel partner|residual split|residual payout|manufacturer rep|manufacturers representative|rep agency|territory rep|independent sales rep/,
  },
  {
    niche: 'Agency retainer and deliverable proof',
    marketSegment: 'dealvault_agency_retainers',
    outreachAngle: 'Retainer scope tracking, approvals, and proof of delivered work',
    pattern: /agency|marketing studio|creative studio|seo agency|paid media|fractional cmo|video production|podcast production|content studio|ghostwriting agency|web design retainer|retainer|monthly scope|campaign deliverable|client approval|revision round|managed service provider|managed it|msp\b|it support company|outsourced it|help desk|monthly support plan|vcio|fractional cfo|virtual controller|bookkeeping service|monthly close|lead generation agency|appointment setting agency|sales development agency|outsourced sdr|white label lead generation|rev share agency|influencer marketing agency|creator campaign agency/,
  },
  {
    niche: 'Vendor deliverable and service proof',
    marketSegment: 'dealvault_vendor_deliverables',
    outreachAngle: 'Delivered-work records, approval proof, and payment readiness',
    pattern: /vendor|supplier|field service|commercial cleaning|janitorial|facility services|sign installation|sign installer|sign shop|vehicle wrap|wall wrap|graphics installer|wayfinding|parking lot striping|deliverable|install crew|service ticket|completion proof|completion photo|low voltage|security system|access control|av integrator|audio visual|structured cabling|fire alarm|trade show display|experiential fabrication|promotional products|office furniture installation|furniture installer|cubicle installer|fixture installer|millwork installer|ff&e|cabinet installer|countertop installer|glass installer|shower door installer|finish carpentry|dumpster rental|roll off dumpster|portable toilet|portable sanitation|scaffold rental|site services/,
  },
  {
    niche: 'Logistics handoff and delivery-proof tracking',
    marketSegment: 'dealvault_logistics_dispatch',
    outreachAngle: 'Load handoffs, delivery proof, exception tracking, and fee visibility',
    pattern: /freight broker|freight brokerage|truck dispatch|dispatch service|3pl|third party logistics|logistics broker|broker agent|carrier packet|rate confirmation|proof of delivery|delivery receipt|load tender|carrier setup|lumper|detention|tonu/,
  },
  {
    niche: 'Sponsorship deliverable tracking',
    marketSegment: 'dealvault_sponsorship_deliverables',
    outreachAngle: 'Sponsor obligations, posting proof, and fulfillment tracking',
    pattern: /sponsorship|sponsor package|brand partner|activation|deliverable schedule|event deliverable|podcast sponsor|fulfillment report|makegood|sponsor proof|creator payout|proof of post|creator campaign|brand activation agency/,
  },
  {
    niche: 'Private lending and draw coordination',
    marketSegment: 'dealvault_private_lending',
    outreachAngle: 'Private-loan milestones, borrower updates, and draw documentation',
    pattern: /private lender|private lending broker|hard money|hard money broker|bridge lender|note buyer|draw schedule|borrower update|loan servicing|loan packaging|draw inspector|draw administration|rehab inspection|owner rep|rehab draw service|construction loan servicing|lender draw coordinator|private lender servicing/,
  },
  {
    niche: 'Public adjuster and claims-vendor coordination',
    marketSegment: 'dealvault_public_adjusters',
    outreachAngle: 'Claim milestones, restoration proof, and fee visibility across owner, carrier, and vendor handoffs',
    pattern: /public adjuster|insurance claim consultant|loss consultant|appraisal umpire|claim documentation|proof of loss|contents inventory|claim settlement/,
  },
  {
    niche: 'Funding referral and broker fee tracking',
    marketSegment: 'dealvault_funding_referrals',
    outreachAngle: 'Referral chains, intro fees, and funding-partner accountability',
    pattern: /funding referral|loan broker|capital advisory|equipment finance broker|commercial mortgage broker|sba packaging|sba loan packager|broker fee|placement fee|referral partner|iso|merchant cash advance|capital introduction|merchant services broker|payment processing agent|payroll broker|peo broker|benefits consultant/,
  },
  {
    niche: 'Invoice factoring and receivables coordination',
    marketSegment: 'dealvault_factoring_coordination',
    outreachAngle: 'Referral accountability, receivables proof, and funding status visibility',
    pattern: /invoice factoring|factoring company|accounts receivable finance|accounts receivable factoring|invoice finance|factor funding|purchase order finance/,
  },
  {
    niche: 'Staffing placement fee accountability',
    marketSegment: 'dealvault_staffing_placement_fees',
    outreachAngle: 'Candidate placement milestones, fee triggers, and proof trails',
    pattern: /staffing|recruiting|recruiter|contingent search|placement fee|temp-to-hire|candidate start date|guarantee period|commission schedule|locum tenens|travel nurse|allied staffing|skilled trades staffing|therapy staffing/,
  },
  {
    niche: 'Agreement and milestone tracking',
    marketSegment: 'dealvault_agreement_tracking',
    outreachAngle: 'Agreement records, approvals, and milestone accountability',
    pattern: /agreement|msa|sow|statement of work|milestone|approval trail|scope tracking|deliverable review/,
  },
]

function isDealVaultRecordLead(lead: LeadRecord, typeText: string, pain: string) {
  const category = String(lead.category || '').toLowerCase()
  const leadType = String(lead.lead_type || '').toLowerCase()
  const eligibleCategory =
    category === 'real_estate' ||
    category === 'small_business' ||
    category === 'business_funding' ||
    category === 'website_upgrade' ||
    category === 'business_setup' ||
    leadType === 'real_estate'

  if (!eligibleCategory) {
    return false
  }

  if (/distress|vacant|violation|preforeclosure|tax delinquent|probate/.test(pain)) {
    return false
  }

  return /contractor|construction|rehab|remodel|design-build|milestone|property management|landlord|real estate investor|investor|acquisition|dispo|referral|partner|partnership|jv|joint venture|seller finance|lease option|subject-to|creative finance|portfolio|rental|staffing|recruiting|placement fee|agency|consulting|deliverable|vendor|subcontractor|project management|field service|public adjuster|insurance claim|loss consultant|owner rep|permit expeditor|factoring|accounts receivable|purchase order finance|solar|low voltage|security installer|access control|av integrator|landscaping|snow removal|merchant services|payment processing|merchant cash advance|payroll broker|peo broker|pool builder|deck builder|fence contractor|promotional products|trade show display|experiential fabrication|make-ready|unit turn|apartment turn|vehicle wrap|sign shop|wayfinding|office furniture|ff&e|millwork|abatement|asbestos|locum tenens|travel nurse|sba packaging|commercial mortgage broker|managed service provider|managed it|msp\b|it support|fractional cfo|bookkeeping|monthly close|freight broker|truck dispatch|3pl|carrier packet|proof of delivery|cabinet installer|countertop installer|glass installer|shower door installer|dumpster rental|portable toilet|transaction coordinator|closing coordinator|home watch|property watch|reserve study|reserve specialist|manufacturer rep|independent sales rep|territory rep|lead generation agency|appointment setting agency|outsourced sdr|white label lead generation|influencer marketing agency|creator campaign agency|draw administration|private lender servicing/.test(typeText)
}

function getDealVaultWorkflowSegment(typeText: string, pain: string) {
  const haystack = `${typeText} ${pain}`.toLowerCase()
  return dealVaultWorkflowSegments.find((segment) => segment.pattern.test(haystack)) || null
}

function coerceWebsiteReport(value: unknown): WebsiteWeaknessReport | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<WebsiteWeaknessReport>
  if (
    typeof candidate.websiteExists !== 'boolean' ||
    !Array.isArray(candidate.weakSignals) ||
    typeof candidate.estimatedSpeed !== 'string'
  ) {
    return null
  }

  return {
    websiteExists: candidate.websiteExists,
    responseTimeMs: typeof candidate.responseTimeMs === 'number' ? candidate.responseTimeMs : null,
    hasViewportMeta: Boolean(candidate.hasViewportMeta),
    hasChat: Boolean(candidate.hasChat),
    hasOnlineBooking: Boolean(candidate.hasOnlineBooking),
    hasClearCta: Boolean(candidate.hasClearCta),
    hasTrustSignals: Boolean(candidate.hasTrustSignals),
    hasContactSignals: Boolean(candidate.hasContactSignals),
    isLikelyOutdated: Boolean(candidate.isLikelyOutdated),
    estimatedSpeed: candidate.estimatedSpeed as WebsiteWeaknessReport['estimatedSpeed'],
    weakSignals: candidate.weakSignals.filter((signal): signal is string => typeof signal === 'string'),
  }
}

function pickBestOffer(lead: LeadRecord, website: WebsiteWeaknessReport): LeadOffer {
  const category = (lead.category || '').toLowerCase()
  const language = (lead.language_signal || '').toLowerCase()
  const pain = `${lead.pain_signal || ''} ${lead.notes || ''}`.toLowerCase()
  const typeText = businessTypeText(lead)

  if (category.includes('code_violation') || pain.includes('vacant') || pain.includes('distress')) {
    return 'Real Estate Seller Lead'
  }
  if (isDealVaultRecordLead(lead, typeText, pain)) {
    return 'DealVault Agreement & Milestone Records'
  }
  if (category.includes('government') || pain.includes('sam') || pain.includes('contract')) {
    return 'Gov Contract Readiness'
  }
  if (language.includes('spanish') || language.includes('es')) {
    return 'Spanish Funding Assistance'
  }
  if (category.includes('new_business') || category.includes('formation') || typeText.includes('entitytype')) {
    return 'Business Setup / Compliance Help'
  }
  if (
    /appointment|bookings|reserve|daycare|barber|salon|med spa|dentist|clinic|tax service|immigration|auto repair/.test(
      typeText
    ) &&
    !website.hasOnlineBooking
  ) {
    return 'AI Appointment Booking System'
  }
  if (!website.websiteExists || website.weakSignals.length >= 2) {
    if (!website.hasChat) return 'AI Receptionist Launch'
    return 'Website Upgrade Sprint'
  }
  if (pain.includes('grant')) return 'Grant/Funding Roadmap'
  if (pain.includes('credit')) return 'Business Credit Builder'
  return 'Business Funding'
}

async function getAdjustmentDelta(lead: LeadRecord, bestOffer: LeadOffer) {
  const adjustments = await listActiveScoreAdjustments().catch(() => [])
  if (!adjustments.length) return { delta: 0, reasons: [] as string[] }

  const cityState = [lead.city, lead.state].filter(Boolean).join('|')
  const reasons: string[] = []
  let delta = 0

  for (const adjustment of adjustments) {
    let matches = false
    switch (adjustment.scope_type) {
      case 'global':
        matches = adjustment.scope_key === 'global'
        break
      case 'city_state':
        matches = Boolean(cityState && adjustment.scope_key.toLowerCase() === cityState.toLowerCase())
        break
      case 'niche':
        matches = Boolean(lead.niche && adjustment.scope_key.toLowerCase() === lead.niche.toLowerCase())
        break
      case 'category':
        matches = Boolean(lead.category && adjustment.scope_key.toLowerCase() === lead.category.toLowerCase())
        break
      case 'best_offer':
        matches = adjustment.scope_key.toLowerCase() === String(bestOffer).toLowerCase()
        break
      case 'language_segment':
        matches = Boolean(lead.language_segment && adjustment.scope_key.toLowerCase() === lead.language_segment.toLowerCase())
        break
    }

    if (!matches) continue
    delta += Number(adjustment.score_delta || 0)
    reasons.push(adjustment.reason)
  }

  return { delta, reasons }
}

export async function scoreLead(
  lead: LeadRecord,
  options: { refreshWebsiteAudit?: boolean } = {}
): Promise<LeadScoreBreakdown> {
  const cachedWebsiteReport = coerceWebsiteReport(lead.website_audit_json)
  const websiteReport =
    !options.refreshWebsiteAudit && cachedWebsiteReport
      ? cachedWebsiteReport
      : await analyzeWebsiteWeakness(lead.website)
  const typeText = businessTypeText(lead)
  const pain = `${lead.pain_signal || ''} ${lead.notes || ''} ${lead.status_detail || ''}`.toLowerCase()
  const urbanBonus = isUrbanMarket(lead) ? 6 : 0
  const dealVaultSegment = isDealVaultRecordLead(lead, typeText, pain)
    ? getDealVaultWorkflowSegment(typeText, pain)
    : null

  const urgencyScore =
    lead.category === 'code_violation'
      ? 18
      : lead.category === 'government_contracts'
        ? 14
        : lead.category === 'new_business_formation'
          ? 12
          : lead.category === 'seller_lead' || lead.lead_type === 'sell_house'
            ? 14
          : 8

  const businessAgeDays =
    daysBetween(String(lead.metadata_json?.registered_effective_date || lead.form_data?.registeredEffectiveDate || '')) ??
    null

  const businessAgeScore =
    businessAgeDays === null
      ? 6
      : businessAgeDays <= 45
        ? 16
        : businessAgeDays <= 180
          ? 12
          : businessAgeDays <= 365
            ? 8
            : 4

  const fundingNeedScore =
    lead.category === 'new_business_formation'
      ? 16
      : lead.category === 'small_business'
        ? 12
        : lead.category === 'business_credit'
          ? 12
          : lead.category === 'business_setup'
            ? 11
        : lead.category === 'government_contracts'
          ? 10
          : 8

  const websiteWeaknessScore =
    !lead.website
      ? 16
      : !websiteReport.websiteExists
        ? 18
        : clamp(websiteReport.weakSignals.length * 4, 0, 18)

  const languageNicheScore =
    lead.language_signal?.toLowerCase().includes('spanish') ||
    lead.language_signal?.toLowerCase().includes('es')
      ? 10
      : 0

  const distressSignalScore =
    lead.category === 'code_violation'
      ? 18
      : /(distress|vacant|violation|lien|overdue)/i.test(
            `${lead.pain_signal || ''} ${lead.notes || ''} ${lead.status_detail || ''}`
          )
        ? 12
        : 0

  const contractFitScore =
    lead.category === 'government_contracts' ||
    /(naics|solicitation|set-aside|subcontract)/i.test(
      JSON.stringify(lead.metadata_json || {})
    )
      ? 14
      : 0

  const monetizationPotentialScore =
    dealVaultSegment
      ? 10
      : /contractor|restaurant|barber|salon|med spa|daycare|tax|immigration|auto repair|cleaning/.test(typeText)
      ? 10
      : /real estate|seller|property/.test(typeText)
        ? 9
        : /government|naics|solicitation/.test(typeText)
          ? 10
          : 6

  const emailDomain = extractEmailDomain(lead.email)
  const hasUsableEmail = lead.email_valid !== false && isUsableContactEmail(lead.email)
  const hasWebmailEmail = Boolean(hasUsableEmail && emailDomain && WEBMAIL_DOMAINS.has(emailDomain))
  const hasDirectEmail = hasDirectBusinessEmail(lead)
  const contactFormCount = getContactFormCount(lead)
  const contactabilityScore = clamp(
    (lead.phone ? 6 : 0) +
      (hasUsableEmail ? 9 : lead.email ? 1 : 0) +
      (hasDirectEmail ? 5 : 0) +
      (hasWebmailEmail && !hasDirectEmail ? 1 : 0) +
      (lead.website ? 4 : 0) +
      (contactFormCount > 0 ? 4 : 0) +
      (lead.source_url ? 2 : 0),
    0,
    22
  )

  const estimatedValueScore =
    lead.category === 'government_contracts'
      ? 10
      : lead.category === 'code_violation'
        ? 9
        : lead.best_offer?.toString().includes('Website')
          ? 9
          : lead.best_offer?.toString().includes('AI')
            ? 9
        : lead.category === 'small_business'
          ? 8
          : 7

  const bestOffer = pickBestOffer(lead, websiteReport)
  const baseScore = clamp(
    urgencyScore +
      businessAgeScore +
      fundingNeedScore +
      websiteWeaknessScore +
      languageNicheScore +
      distressSignalScore +
      contractFitScore +
      contactabilityScore +
      estimatedValueScore +
      monetizationPotentialScore +
      urbanBonus,
    0,
    100
  )
  const adjustments = await getAdjustmentDelta(lead, bestOffer)
  const score = clamp(baseScore + adjustments.delta, 0, 100)

  const urgencyLevel =
    urgencyScore + distressSignalScore >= 26 ? 'high' : urgencyScore + distressSignalScore >= 15 ? 'medium' : 'low'
  const contactabilityLevel =
    contactabilityScore >= 16 ? 'high' : contactabilityScore >= 9 ? 'medium' : 'low'
  const languageSegment =
    lead.language_signal?.toLowerCase().includes('spanish') || lead.language_signal?.toLowerCase().includes('es')
      ? /bilingual/i.test(lead.language_signal || '')
        ? 'bilingual'
        : 'spanish'
      : 'english'
  const estimatedValueLabel =
    estimatedValueScore + monetizationPotentialScore >= 18
      ? 'premium'
      : estimatedValueScore + monetizationPotentialScore >= 14
        ? 'high'
        : estimatedValueScore + monetizationPotentialScore >= 10
          ? 'medium'
          : 'low'
  const outreachAngle =
    bestOffer === 'DealVault Agreement & Milestone Records' && dealVaultSegment
      ? dealVaultSegment.outreachAngle
      : bestOffer === 'AI Receptionist Launch'
      ? 'Missed-call and lead-capture automation'
      : bestOffer === 'AI Appointment Booking System'
        ? 'Booking flow and appointment conversion'
        : bestOffer === 'Website Upgrade Sprint'
          ? 'Website conversion and trust upgrade'
          : bestOffer === 'Real Estate Seller Lead'
            ? 'Seller conversations, acquisition options, and practical property exit paths'
            : bestOffer === 'Gov Contract Readiness'
              ? 'Contract readiness and subcontracting fit'
              : bestOffer === 'Business Setup / Compliance Help'
                ? 'Business setup, EIN, and compliance readiness'
                : bestOffer === 'Spanish Funding Assistance'
                  ? 'Spanish-first funding support'
                  : bestOffer === 'Business Credit Builder'
                    ? 'Business credit and funding prep'
                    : 'Funding readiness and growth strategy'

  const reasoning = [
    lead.category === 'code_violation'
      ? 'Property distress and enforcement activity raise urgency and can point to a motivated seller conversation.'
      : lead.category === 'seller_lead' || lead.category === 'real_estate'
        ? 'Property-owner signals support a direct-sale or investor-conversation angle.'
        : null,
    businessAgeDays !== null && businessAgeDays <= 45
      ? 'Recently formed business signals strong setup, funding, and compliance needs.'
      : null,
    websiteWeaknessScore >= 10 ? 'Website quality gaps create a clear AI receptionist or upgrade opportunity.' : null,
    languageNicheScore > 0 ? 'Spanish-language signal supports a localized outreach and offer path.' : null,
    contractFitScore > 0 ? 'Opportunity and category fit support government-contract readiness outreach.' : null,
    urbanBonus > 0 ? 'Urban market density supports stronger outreach and partner-fit potential.' : null,
    hasDirectEmail ? 'Direct business email improves send confidence.' : null,
    !hasUsableEmail && contactFormCount > 0 ? 'Contact form is available, so this should be handled manually instead of emailed.' : null,
    adjustments.delta !== 0 ? `Active improvement tuning adjusted this score by ${adjustments.delta > 0 ? '+' : ''}${adjustments.delta}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    score,
    urgencyScore,
    businessAgeScore,
    fundingNeedScore,
    websiteWeaknessScore,
    languageNicheScore,
    distressSignalScore,
    contractFitScore,
    contactabilityScore,
    estimatedValueScore,
    bestOffer,
    reasoning:
      reasoning ||
      'Lead score combines urgency, contactability, business stage, offer fit, and website readiness signals.',
    urgencyLevel,
    contactabilityLevel,
    languageSegment,
    outreachAngle,
    estimatedValueLabel,
    marketSegment: dealVaultSegment?.marketSegment || null,
    niche: dealVaultSegment?.niche || null,
    breakdown: {
      website: websiteReport,
      businessAgeDays,
      monetizationPotentialScore,
      urbanBonus,
      hasUsableEmail,
      hasDirectEmail,
      contactFormCount,
      dealVaultSegment,
      scoreAdjustments: adjustments.reasons,
      scoreAdjustmentDelta: adjustments.delta,
    },
  }
}
