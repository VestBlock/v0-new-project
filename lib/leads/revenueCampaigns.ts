import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'

export type RevenueCampaignKey =
  | 'dealvault_smart_contracts'
  | 'ai_receptionist_visibility'
  | 'funding_prep'
  | 'seller_real_estate'
  | 'other'

type RevenueCampaign = {
  key: RevenueCampaignKey
  label: string
  primary: boolean
  sendWeight: number
  minAutoScore: number
  priority: number
  terms: string[]
}

export const REVENUE_CAMPAIGNS: RevenueCampaign[] = [
  {
    key: 'dealvault_smart_contracts',
    label: 'DealVault / Smart Contracts',
    primary: true,
    sendWeight: 40,
    minAutoScore: 68,
    priority: 500,
    terms: [
      'dealvault',
      'smart contract',
      'blockchain',
      'agreement tracking',
      'proof record',
      'proof records',
      'document proof',
      'referral payout',
      'partner split',
      'payout split',
      'milestone',
      'contractor milestone',
      'draw approval',
      'private lending',
      'hard money',
      'joint venture',
      'jv',
      'creative finance',
      'vendor deliverable',
      'placement fee',
    ],
  },
  {
    key: 'ai_receptionist_visibility',
    label: 'AI Receptionist / Search Visibility',
    primary: true,
    sendWeight: 30,
    minAutoScore: 70,
    priority: 420,
    terms: [
      'ai receptionist',
      'ai appointment',
      'appointment booking',
      'online booking',
      'booking flow',
      'missed call',
      'front desk',
      'lead capture',
      'website conversion',
      'website upgrade',
      'visibility',
      'seo',
      'search visibility',
      'answer engine',
      'website weakness',
    ],
  },
  {
    key: 'funding_prep',
    label: 'Business Funding Prep',
    primary: true,
    sendWeight: 30,
    minAutoScore: 70,
    priority: 400,
    terms: [
      'business funding',
      'funding readiness',
      'funding prep',
      'capital',
      'business credit',
      'credit builder',
      'grant',
      'financing',
      'new business formation',
      'business setup',
      'spanish funding',
      'contract readiness',
      'gov contract',
    ],
  },
  {
    key: 'seller_real_estate',
    label: 'Real Estate Seller Review',
    primary: false,
    sendWeight: 0,
    minAutoScore: 78,
    priority: 220,
    terms: [
      'seller lead',
      'sell house',
      'direct sale',
      'as-is',
      'cash path',
      'failed listing',
      'novation',
      'vacant',
      'code violation',
      'tax delinquent',
      'preforeclosure',
      'probate',
    ],
  },
  {
    key: 'other',
    label: 'Other / Manual Review',
    primary: false,
    sendWeight: 0,
    minAutoScore: 85,
    priority: 0,
    terms: [],
  },
]

export const PRIMARY_REVENUE_CAMPAIGNS = REVENUE_CAMPAIGNS.filter((campaign) => campaign.primary)
export const REVENUE_CAMPAIGN_ORDER = REVENUE_CAMPAIGNS.map((campaign) => campaign.label)

const PRIMARY_CAMPAIGN_KEYS = new Set(PRIMARY_REVENUE_CAMPAIGNS.map((campaign) => campaign.key))

function textFromUnknown(value: unknown) {
  if (typeof value === 'string') return value
  if (value === null || typeof value === 'undefined') return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

type LeadCampaignInput = Partial<LeadRecord> | null | undefined

function leadText(lead: LeadCampaignInput, subject = '') {
  if (!lead) return subject.toLowerCase()

  return [
    subject,
    lead.lead_type,
    lead.category,
    lead.best_offer,
    lead.niche,
    lead.market_segment,
    lead.outreach_angle,
    lead.business_name,
    lead.name,
    lead.pain_signal,
    lead.notes,
    lead.status_detail,
    lead.source,
    textFromUnknown(lead.metadata_json),
    textFromUnknown(lead.form_data),
    textFromUnknown(lead.website_audit_json),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function classifyLeadRevenueCampaign(lead: LeadCampaignInput, subject = '') {
  const haystack = leadText(lead, subject)
  const match = REVENUE_CAMPAIGNS.find((campaign) =>
    campaign.key !== 'other' && campaign.terms.some((term) => haystack.includes(term))
  )

  return match || REVENUE_CAMPAIGNS[REVENUE_CAMPAIGNS.length - 1]
}

export function isPrimaryRevenueCampaign(key: RevenueCampaignKey) {
  return PRIMARY_CAMPAIGN_KEYS.has(key)
}

export function getRevenueCampaignAllocation(limit: number) {
  const safeLimit = Math.max(0, Math.floor(limit))
  const totalWeight = PRIMARY_REVENUE_CAMPAIGNS.reduce((sum, campaign) => sum + campaign.sendWeight, 0)
  const allocations = new Map<string, number>()
  let assigned = 0

  for (const campaign of PRIMARY_REVENUE_CAMPAIGNS) {
    const count = totalWeight > 0 ? Math.floor((safeLimit * campaign.sendWeight) / totalWeight) : 0
    allocations.set(campaign.label, count)
    assigned += count
  }

  let remainder = safeLimit - assigned
  for (const campaign of PRIMARY_REVENUE_CAMPAIGNS) {
    if (remainder <= 0) break
    allocations.set(campaign.label, (allocations.get(campaign.label) || 0) + 1)
    remainder -= 1
  }

  return allocations
}

export function getRevenueCampaignPriority(lead: LeadCampaignInput, subject = '') {
  return classifyLeadRevenueCampaign(lead, subject).priority
}

export function getRevenueCampaignMinAutoScore(lead: LeadCampaignInput, subject = '') {
  return classifyLeadRevenueCampaign(lead, subject).minAutoScore
}

export function getLeadRevenueFitIssue(
  lead: LeadCampaignInput,
  options: { allowSecondaryCampaigns?: boolean } = {}
) {
  if (!lead) return 'missing_lead'

  const campaign = classifyLeadRevenueCampaign(lead)
  if (campaign.key === 'other') return 'non_primary_campaign'
  if (!campaign.primary && !options.allowSecondaryCampaigns) {
    return 'non_primary_campaign'
  }

  const hasIdentity = Boolean(String(lead.business_name || lead.name || '').trim())
  if (!hasIdentity) return 'missing_business_identity'

  const hasPersonalizationSignal = Boolean(
    String(lead.pain_signal || '').trim() ||
      String(lead.outreach_angle || '').trim() ||
      String(lead.niche || '').trim() ||
      String(lead.best_offer || '').trim() ||
      String(lead.website || '').trim() ||
      [lead.city, lead.state].filter(Boolean).length > 0
  )

  if (!hasPersonalizationSignal) return 'weak_personalization_signal'

  return null
}

export function validateOutreachMessageQuality(input: {
  lead: LeadRecord
  message: Pick<OutreachMessageRecord, 'subject' | 'body' | 'compliance_note'>
}) {
  const subject = String(input.message.subject || '').trim()
  const body = String(input.message.body || '').trim()
  const combined = `${subject}\n${body}`
  const normalized = combined.toLowerCase()

  if (!subject) return 'missing_subject'
  if (body.length < 120) return 'message_too_short'

  if (
    /\[(your name|your company|company name|insert|name|su nombre)\]/i.test(combined) ||
    /\{\{|\}\}|todo|lorem ipsum/i.test(combined)
  ) {
    return 'placeholder_copy'
  }

  if (/workflow and growth systems overview|practical operator support|operator accountability/i.test(combined)) {
    return 'internal_or_generic_copy'
  }

  const campaign = classifyLeadRevenueCampaign(input.lead, subject)
  if (!campaign.primary) return 'non_primary_campaign'

  const identity = String(input.lead.business_name || input.lead.name || '').trim().toLowerCase()
  if (identity && !normalized.includes(identity.toLowerCase())) {
    return 'missing_lead_identity_in_copy'
  }

  const includesClearService =
    /dealvault|smart contract|agreement|proof record|payout|milestone|ai receptionist|booking|lead capture|website|visibility|funding|capital|business credit|grant/i.test(
      combined
    )

  if (!includesClearService) return 'missing_clear_service_angle'

  return null
}
