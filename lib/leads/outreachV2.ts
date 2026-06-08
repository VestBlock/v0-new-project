import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { getEmailQualityIssue } from '@/lib/outreach/email-quality'

export type OutreachV2SegmentKey =
  | 'dealvault_records'
  | 'ai_receptionist'
  | 'search_visibility'
  | 'funding_prep'
  | 'manual_review'

type OutreachV2Segment = {
  key: OutreachV2SegmentKey
  label: string
  minScore: number
  terms: string[]
  excludedTerms?: string[]
}

type OutreachV2LeadShape = Partial<
  Pick<
    LeadRecord,
    | 'id'
    | 'status'
    | 'outreach_status'
    | 'source'
    | 'source_url'
    | 'email'
    | 'email_valid'
    | 'website'
    | 'phone'
    | 'business_name'
    | 'name'
    | 'city'
    | 'state'
    | 'bounce_risk_score'
    | 'lead_score'
    | 'lead_type'
    | 'category'
    | 'best_offer'
    | 'niche'
    | 'market_segment'
    | 'pain_signal'
    | 'notes'
    | 'outreach_angle'
    | 'delivery_status'
    | 'suppression_reason'
    | 'contact_info'
    | 'metadata_json'
    | 'form_data'
    | 'website_audit_json'
>
>
type OutreachV2LeadInput = OutreachV2LeadShape | null | undefined

type OutreachV2Evaluation = {
  enabled: boolean
  eligible: boolean
  segmentKey: OutreachV2SegmentKey
  segmentLabel: string
  reason: string | null
  reasons: string[]
  strengths: string[]
  score: number
  minScore: number
  maxBounceRisk: number
  nextAction: 'send' | 'manual_review' | 'enrich' | 'suppress'
}

export type OutreachV2EmailDraft = {
  subject: string
  body: string
  complianceNote: string
  cta: string
}

const WEBMAIL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com'])
const PLATFORM_DOMAINS = new Set([
  'instagram.com',
  'facebook.com',
  'fb.com',
  'messenger.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'webador.com',
])
const BAD_STATUSES = new Set(['closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'])
const BAD_DELIVERY_STATUSES = new Set(['bounced', 'suppressed', 'failed'])
const PUBLIC_OR_LOW_FIT_TERMS = [
  'uscis',
  'field office',
  'government',
  'department of',
  'public school',
  'university',
  'county office',
  'federal',
  'charity',
  'charities',
  'refugee',
  'immigration services',
  'church',
  'nonprofit',
]
const LOW_CONVERSION_NICHES = [
  'restaurant',
  'bar',
  'pub',
  'cafe',
  'pizza',
  'coffee',
  'food truck',
]
const DEALVAULT_STRONG_TERMS = [
  'dealvault',
  'smart contract',
  'agreement',
  'proof record',
  'milestone',
  'payout',
  'referral',
  'partner split',
  'commission split',
  'subcontractor',
  'construction',
  'restoration',
  'property management',
  'private lending',
  'hard money',
  'joint venture',
  'creative finance',
  'statement of work',
  'sponsorship',
  'placement fee',
]
const GOVERNMENT_CONTRACT_READY_TERMS = [
  'gov contract',
  'government contract',
  'contract readiness',
  'sam registration',
  'sam.gov',
  'procurement readiness',
  'bid ready',
  'set aside',
  'set-aside',
]

const SEGMENTS: OutreachV2Segment[] = [
  {
    key: 'dealvault_records',
    label: 'DealVault Records',
    minScore: 76,
    terms: [
      'dealvault',
      'smart contract',
      'agreement',
      'proof record',
      'milestone',
      'payout',
      'referral',
      'partner split',
      'commission split',
      'contractor',
      'subcontractor',
      'construction',
      'restoration',
      'property management',
      'private lending',
      'hard money',
      'joint venture',
      'creative finance',
      'vendor',
      'statement of work',
      'sponsorship',
      'placement fee',
      'recruiting',
      'broker',
      'agency',
    ],
  },
  {
    key: 'funding_prep',
    label: 'Funding Prep',
    minScore: 78,
    terms: [
      'business funding',
      'funding prep',
      'capital',
      'business credit',
      'credit builder',
      'credit repair',
      'grant',
      'grant/funding roadmap',
      'funding roadmap',
      'financing',
      'trade line',
      'tradeline',
      'new business',
      'business setup',
      'contract readiness',
      'gov contract',
    ],
  },
  {
    key: 'search_visibility',
    label: 'AI / Search Visibility',
    minScore: 78,
    terms: [
      'website upgrade',
      'website conversion',
      'visibility',
      'seo',
      'search visibility',
      'weak website',
      'outdated website',
      'no booking',
      'no clear cta',
      'lead capture',
      'answer engine',
    ],
    excludedTerms: LOW_CONVERSION_NICHES,
  },
  {
    key: 'ai_receptionist',
    label: 'Website / AI Receptionist',
    minScore: 74,
    terms: [
      'ai receptionist',
      'appointment',
      'booking',
      'missed call',
      'front desk',
      'lead capture',
      'med spa',
      'dental',
      'clinic',
      'doctor',
      'salon',
      'home service',
      'hvac',
      'plumbing',
      'roofing',
      'contractor',
      'cleaning',
      'law firm',
      'attorney',
      'veterinary',
      'chiropractor',
    ],
    excludedTerms: LOW_CONVERSION_NICHES,
  },
]
const MANUAL_REVIEW_SEGMENT: OutreachV2Segment = {
  key: 'manual_review',
  label: 'Manual Review',
  minScore: 99,
  terms: [],
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function isOutreachV2Enabled() {
  return envBool('OUTREACH_V2_ENABLED', true)
}

export function getOutreachV2DailyTarget() {
  return envInt('OUTREACH_V2_DAILY_QUALITY_TARGET', envInt('LEADS_TARGET_EMAILS_PER_DAY', 100))
}

function textFromUnknown(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || typeof value === 'undefined') return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function leadText(lead: OutreachV2LeadInput, subject = '') {
  return [
    subject,
    lead?.lead_type,
    lead?.category,
    lead?.best_offer,
    lead?.niche,
    lead?.market_segment,
    lead?.outreach_angle,
    lead?.business_name,
    lead?.name,
    lead?.pain_signal,
    lead?.notes,
    lead?.source,
    textFromUnknown(lead?.contact_info),
    textFromUnknown(lead?.metadata_json),
    textFromUnknown(lead?.form_data),
    textFromUnknown(lead?.website_audit_json),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesTerm(haystack: string, term: string) {
  return new RegExp(`\\b${escapeRegExp(term)}s?\\b`, 'i').test(haystack)
}

function metadataFieldText(lead: OutreachV2LeadInput, keys: string[]) {
  const metadata =
    lead?.metadata_json && typeof lead.metadata_json === 'object'
      ? (lead.metadata_json as Record<string, unknown>)
      : {}
  return keys.map((key) => textFromUnknown(metadata[key])).filter(Boolean).join(' ')
}

function strongSourceText(lead: OutreachV2LeadInput, subject = '') {
  return [
    subject,
    lead?.business_name,
    lead?.name,
    lead?.category,
    lead?.lead_type,
    lead?.best_offer,
    lead?.outreach_angle,
    lead?.pain_signal,
    metadataFieldText(lead, ['query', 'primaryType', 'types', 'businessCategory', 'businessType']),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function hasLowConversionFoodSignal(lead: OutreachV2LeadInput) {
  const haystack = strongSourceText(lead)
  return LOW_CONVERSION_NICHES.some((term) => includesTerm(haystack, term))
}

function findSegment(key: OutreachV2SegmentKey) {
  return SEGMENTS.find((segment) => segment.key === key) || MANUAL_REVIEW_SEGMENT
}

function hasAnyStrongTerm(haystack: string, terms: string[]) {
  return terms.some((term) => includesTerm(haystack, term))
}

function hasAiReceptionistIntent(lead: OutreachV2LeadInput, subject = '') {
  const haystack = strongSourceText(lead, subject)
  return hasAnyStrongTerm(haystack, ['ai receptionist', 'appointment', 'booking', 'missed call', 'front desk', 'lead capture'])
}

function hasFundingIntent(lead: OutreachV2LeadInput, subject = '') {
  const haystack = strongSourceText(lead, subject)
  return hasAnyStrongTerm(haystack, [
    'business funding',
    'funding prep',
    'capital',
    'business credit',
    'grant',
    'financing',
    ...GOVERNMENT_CONTRACT_READY_TERMS,
  ])
}

function hasGovernmentContractReadinessIntent(lead: OutreachV2LeadInput, subject = '') {
  const haystack = strongSourceText(lead, subject)
  return hasAnyStrongTerm(haystack, GOVERNMENT_CONTRACT_READY_TERMS)
}

function hasDealVaultIntent(lead: OutreachV2LeadInput, subject = '') {
  const haystack = leadText(lead, subject)
  return hasAnyStrongTerm(haystack, DEALVAULT_STRONG_TERMS)
}

function extractHost(value: string | null | undefined) {
  if (!value) return null
  try {
    return new URL(value).host.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function extractEmailDomain(email: string | null | undefined) {
  const normalized = String(email || '').trim().toLowerCase()
  const parts = normalized.split('@')
  return parts.length === 2 ? parts[1] : null
}

function domainsLookAligned(emailDomain: string, websiteHost: string) {
  return emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${emailDomain}`)
}

function hasDirectBusinessEmail(lead: OutreachV2LeadInput) {
  const emailDomain = extractEmailDomain(lead?.email)
  const websiteHost = extractHost(lead?.website)
  return Boolean(
    emailDomain &&
      websiteHost &&
      !WEBMAIL_DOMAINS.has(emailDomain) &&
      !PLATFORM_DOMAINS.has(emailDomain) &&
      domainsLookAligned(emailDomain, websiteHost)
  )
}

function hasVerifiedPublicEmailCandidate(lead: OutreachV2LeadInput) {
  const email = String(lead?.email || '').trim().toLowerCase()
  if (!email) return false

  const contactInfo = lead?.contact_info && typeof lead.contact_info === 'object' ? lead.contact_info : {}
  const candidates = Array.isArray(contactInfo.publicEmailCandidates)
    ? (contactInfo.publicEmailCandidates as Array<Record<string, unknown>>)
    : []
  const enrichment =
    contactInfo.publicEmailEnrichment && typeof contactInfo.publicEmailEnrichment === 'object'
      ? (contactInfo.publicEmailEnrichment as Record<string, unknown>)
      : null
  const confidence = String(enrichment?.confidence || '').toLowerCase()
  if (!['medium', 'high'].includes(confidence)) return false

  return candidates.some((candidate) => {
    const candidateEmail = String(candidate.email || '').trim().toLowerCase()
    const reason = String(candidate.reason || '').toLowerCase()
    const score = Number(candidate.score || 0)
    const sourceUrl = String(candidate.sourceUrl || '')

    return (
      candidateEmail === email &&
      score >= 6 &&
      sourceUrl.length > 0 &&
      /contact|about|team|homepage|internal/.test(reason)
    )
  })
}

function getEmailTrustIssue(lead: OutreachV2LeadInput) {
  const emailIssue = getEmailQualityIssue(lead?.email)
  if (emailIssue) return emailIssue === 'missing' ? 'missing_email' : 'invalid_email'
  if (lead?.email_valid === false) return 'invalid_email'

  const emailDomain = extractEmailDomain(lead?.email)
  if (!emailDomain) return 'invalid_email'
  if (emailDomain.endsWith('.gov')) return 'institutional_domain'
  if (PLATFORM_DOMAINS.has(emailDomain)) return 'platform_email'

  const websiteHost = extractHost(lead?.website)
  if (websiteHost && !WEBMAIL_DOMAINS.has(emailDomain) && !domainsLookAligned(emailDomain, websiteHost)) {
    return hasVerifiedPublicEmailCandidate(lead) ? null : 'mismatched_domain'
  }

  if (WEBMAIL_DOMAINS.has(emailDomain) && websiteHost && !hasVerifiedPublicEmailCandidate(lead)) {
    return 'manual_webmail_verification_required'
  }

  return null
}

function hasWebsiteWeaknessSignal(lead: OutreachV2LeadInput) {
  const audit = lead?.website_audit_json || {}
  const weakSignals = Array.isArray(audit.weakSignals) ? audit.weakSignals : []
  return Boolean(
    audit.isLikelyOutdated ||
      audit.hasClearCta === false ||
      audit.hasOnlineBooking === false ||
      audit.hasContactSignals === false ||
      weakSignals.length > 0
  )
}

function classifySegment(lead: OutreachV2LeadInput, subject = '') {
  const haystack = leadText(lead, subject)
  const websiteWeakness = hasWebsiteWeaknessSignal(lead)
  if (hasLowConversionFoodSignal(lead) && !envBool('OUTREACH_V2_ALLOW_LOW_CONVERSION_FOOD', false)) {
    return findSegment('manual_review')
  }
  if (hasDealVaultIntent(lead, subject)) return findSegment('dealvault_records')
  if (hasFundingIntent(lead, subject)) return findSegment('funding_prep')
  if (websiteWeakness) return findSegment('search_visibility')
  if (hasAiReceptionistIntent(lead, subject)) return findSegment('ai_receptionist')

  for (const segment of SEGMENTS) {
    if (segment.key === 'dealvault_records' || segment.key === 'funding_prep' || segment.key === 'ai_receptionist') {
      continue
    }
    if (segment.excludedTerms?.some((term) => haystack.includes(term))) continue
    if (segment.terms.some((term) => haystack.includes(term))) return segment
  }

  if (SEGMENTS.find((segment) => segment.key === 'ai_receptionist')?.terms.some((term) => haystack.includes(term))) {
    return findSegment('ai_receptionist')
  }

  return {
    key: 'manual_review' as const,
    label: 'Manual Review',
    minScore: 99,
    terms: [],
  }
}

function businessName(lead: OutreachV2LeadInput) {
  return String(lead?.business_name || lead?.name || '').trim()
}

function isBadTargetFit(lead: OutreachV2LeadInput) {
  const email = String(lead?.email || '').toLowerCase()
  const haystack = leadText(lead)
  if (email.endsWith('.gov') || email.includes('@uscis.gov')) return true
  const publicLowFitTerms = hasGovernmentContractReadinessIntent(lead)
    ? PUBLIC_OR_LOW_FIT_TERMS.filter((term) => !['government', 'federal'].includes(term))
    : PUBLIC_OR_LOW_FIT_TERMS
  if (publicLowFitTerms.some((term) => haystack.includes(term))) return true
  if (hasLowConversionFoodSignal(lead) && !envBool('OUTREACH_V2_ALLOW_LOW_CONVERSION_FOOD', false)) return true
  if (!businessName(lead) || /^test\b/i.test(businessName(lead))) return true
  return false
}

function getSegmentMinScore(lead: OutreachV2LeadInput, segment: OutreachV2Segment, subject = '') {
  const trustedBusinessContact =
    hasDirectBusinessEmail(lead) &&
    Boolean(businessName(lead)) &&
    Boolean(String(lead?.website || '').trim()) &&
    segment.key !== 'manual_review'

  if (segment.key === 'funding_prep' && hasGovernmentContractReadinessIntent(lead, subject)) {
    return Math.min(segment.minScore, trustedBusinessContact ? 70 : 74)
  }
  if (trustedBusinessContact) return Math.max(68, segment.minScore - 5)
  return segment.minScore
}

function getStrengths(lead: OutreachV2LeadInput, segment: OutreachV2Segment) {
  const strengths: string[] = []
  if (businessName(lead)) strengths.push('named_business')
  if (lead?.website) strengths.push('has_website')
  if (hasVerifiedPublicEmailCandidate(lead)) strengths.push('verified_public_email')
  if (hasWebsiteWeaknessSignal(lead)) strengths.push('website_issue')
  if (String(lead?.pain_signal || '').trim()) strengths.push('pain_signal')
  if (String(lead?.outreach_angle || '').trim()) strengths.push('clear_angle')
  if (segment.key !== 'manual_review') strengths.push(segment.key)
  return strengths
}

export function evaluateOutreachV2Lead(lead: OutreachV2LeadInput, subject = ''): OutreachV2Evaluation {
  const enabled = isOutreachV2Enabled()
  const segment = classifySegment(lead, subject)
  const score = Number(lead?.lead_score || 0)
  const minScore = getSegmentMinScore(lead, segment, subject)
  const maxBounceRisk = envInt('OUTREACH_V2_MAX_BOUNCE_RISK', 25)
  const reasons: string[] = []

  if (!enabled) {
    return {
      enabled,
      eligible: true,
      segmentKey: segment.key,
      segmentLabel: segment.label,
      reason: null,
      reasons,
      strengths: getStrengths(lead, segment),
      score,
      minScore,
      maxBounceRisk,
      nextAction: 'send',
    }
  }

  if (!lead) reasons.push('missing_lead')
  if (BAD_STATUSES.has(String(lead?.status || '').toLowerCase()) || lead?.outreach_status === 'do_not_contact') reasons.push('do_not_contact')
  if (BAD_DELIVERY_STATUSES.has(String(lead?.delivery_status || '').toLowerCase())) reasons.push('bad_delivery_history')
  if (String(lead?.suppression_reason || '').trim()) reasons.push('suppressed')
  if (isBadTargetFit(lead)) reasons.push('poor_target_fit')

  const emailTrustIssue = getEmailTrustIssue(lead)
  if (emailTrustIssue) reasons.push(emailTrustIssue)

  if (Number(lead?.bounce_risk_score || 0) > maxBounceRisk) reasons.push('high_bounce_risk')
  if (segment.key === 'manual_review') reasons.push('unclear_offer_fit')
  if (score < minScore) reasons.push('below_v2_score_floor')

  const hasSpecificSignal = Boolean(
    String(lead?.pain_signal || '').trim() ||
      String(lead?.outreach_angle || '').trim() ||
      String(lead?.niche || '').trim() ||
      hasWebsiteWeaknessSignal(lead)
  )
  if (!hasSpecificSignal) reasons.push('missing_specific_reason_to_reach_out')

  const uniqueReasons = Array.from(new Set(reasons))
  const reason = uniqueReasons[0] || null
  const nextAction =
    reason === 'missing_email' || reason === 'manual_webmail_verification_required' || reason === 'mismatched_domain'
      ? 'enrich'
      : reason === 'poor_target_fit' || reason === 'do_not_contact' || reason === 'bad_delivery_history' || reason === 'suppressed'
        ? 'suppress'
        : reason
          ? 'manual_review'
          : 'send'

  return {
    enabled,
    eligible: uniqueReasons.length === 0,
    segmentKey: segment.key,
    segmentLabel: segment.label,
    reason,
    reasons: uniqueReasons,
    strengths: getStrengths(lead, segment),
    score,
    minScore,
    maxBounceRisk,
    nextAction,
  }
}

export function getOutreachV2FitIssue(lead: OutreachV2LeadInput, subject = '') {
  const evaluation = evaluateOutreachV2Lead(lead, subject)
  return evaluation.eligible ? null : evaluation.reason || 'outreach_v2_not_qualified'
}

export function buildOutreachV2EmailDraft(lead: OutreachV2LeadInput): OutreachV2EmailDraft {
  const evaluation = evaluateOutreachV2Lead({ ...(lead || {}), lead_score: Math.max(Number(lead?.lead_score || 0), 100) })
  const name = businessName(lead) || 'your team'
  const location = [lead?.city, lead?.state].filter(Boolean).join(', ')
  const opener = location
    ? `I noticed ${name} while reviewing businesses around ${location}.`
    : `I came across ${name} and thought this may be useful.`
  const complianceNote = 'If this is not relevant, reply "opt out" and we will not contact you again.'

  if (evaluation.segmentKey === 'dealvault_records') {
    const cta = 'Reply if you want the short DealVault example.'
    return {
      subject: `${name}: cleaner agreement and milestone records`,
      body: `Hi ${name},\n\n${opener} VestBlock helps teams keep cleaner records around agreements, referrals, approvals, and milestone updates without asking customers to connect a wallet.\n\nFor businesses that manage partners, vendors, contractors, or deal referrals, DealVault gives everyone a clearer proof trail: what was agreed to, what changed, what was approved, and what still needs attention.\n\n${cta}\n\nBest,\nRobert Sanders\nVestBlock\ncontact@vestblock.io`,
      complianceNote,
      cta,
    }
  }

  if (evaluation.segmentKey === 'funding_prep') {
    const cta = 'Reply if you want the quick funding-prep checklist.'
    return {
      subject: `${name}: cleaner prep before funding conversations`,
      body: `Hi ${name},\n\n${opener} VestBlock helps business owners organize the basics lenders and funding partners usually want to see before a serious funding conversation.\n\nThe goal is simple: clean up the business profile, clarify the next-step plan, and avoid walking into funding conversations with scattered or incomplete information.\n\n${cta}\n\nBest,\nRobert Sanders\nVestBlock\ncontact@vestblock.io`,
      complianceNote,
      cta,
    }
  }

  if (evaluation.segmentKey === 'search_visibility') {
    const cta = 'Reply if you want a quick visibility review.'
    return {
      subject: `${name}: a clearer website lead path`,
      body: `Hi ${name},\n\n${opener} VestBlock helps local businesses make their website easier to find, easier to understand, and easier to contact from.\n\nA strong page should quickly explain what you do, why someone should trust you, and how to take the next step. When that path is unclear, good prospects can leave without calling or filling out a form.\n\n${cta}\n\nBest,\nRobert Sanders\nVestBlock\ncontact@vestblock.io`,
      complianceNote,
      cta,
    }
  }

  const cta = 'Reply if you want a short example of the setup.'
  return {
    subject: `${name}: missed-call and booking support`,
    body: `Hi ${name},\n\n${opener} VestBlock helps service businesses respond faster to calls, website forms, and appointment requests when the team is busy.\n\nWe can help set up an AI receptionist and simple follow-up path so more inquiries get answered quickly instead of slipping through the cracks.\n\n${cta}\n\nBest,\nRobert Sanders\nVestBlock\ncontact@vestblock.io`,
    complianceNote,
    cta,
  }
}

export function validateOutreachV2Copy(input: {
  lead: OutreachV2LeadInput
  message: Pick<OutreachMessageRecord, 'subject' | 'body' | 'compliance_note'>
}) {
  const evaluation = evaluateOutreachV2Lead(input.lead, input.message.subject || '')
  if (!evaluation.eligible) return evaluation.reason || 'outreach_v2_not_qualified'

  const subject = String(input.message.subject || '').trim()
  const body = String(input.message.body || '').trim()
  const complianceNote = String(input.message.compliance_note || '').trim()
  const combined = `${subject}\n${body}\n${complianceNote}`
  const normalized = combined.toLowerCase()
  const name = businessName(input.lead).toLowerCase()

  if (!subject) return 'missing_subject'
  if (body.length < 160) return 'message_too_short'
  if (body.length > 1300) return 'message_too_long'
  if (name && !normalized.includes(name)) return 'missing_lead_identity_in_copy'
  if (!/vestblock/i.test(combined)) return 'missing_vestblock_identity'
  if (!/reply/i.test(combined)) return 'missing_soft_reply_cta'
  if (!/opt out|unsubscribe|do not contact/i.test(complianceNote)) return 'missing_opt_out_note'
  if (/\[(your name|your company|company name|insert|name|su nombre)\]|\{\{|\}\}|todo|lorem ipsum/i.test(combined)) {
    return 'placeholder_copy'
  }
  if (/\b(workflow infrastructure|operator accountability|pilot|mvp|aeo|readiness lane|support layer|rails)\b/i.test(combined)) {
    return 'internal_language'
  }
  if (/guaranteed|guarantee approval|guaranteed funding|passive income|legal replacement|escrow|custody/i.test(combined)) {
    return 'overpromising_or_regulated_claim'
  }

  return null
}
