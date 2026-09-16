import {
  getDailyStrategyOutputLane,
  type DailyStrategyOutputLaneKey,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { getEmailQualityIssue, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  assessHunterSendVerificationCache,
  hashHunterVerificationEmail,
  HUNTER_SEND_VERIFICATION_DEFAULT_MAX_AGE_MS,
  type HunterSendVerificationCache,
} from '@/lib/outreach/hunterSendVerificationCore'
import { isListingAgentIntermediaryLead } from '@/lib/outreach/listingAgentCore'
import { assessPublicBusinessWebsiteEvidenceMiss } from '@/lib/outreach/publicBusinessWebsiteEvidenceCore'

export const VERIFIED_BUSINESS_CONTACT_EVIDENCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000
const FUTURE_EVIDENCE_SKEW_MS = 5 * 60 * 1_000

export type VerifiedBusinessContactEvidence = {
  confirmed: true
  contactType: 'business'
  source: string
  observedAt: string
  recipientHash: string
  sourceUrl?: string
}

export type VerifiedBusinessColdEmailAdmissionReason =
  | 'approved'
  | 'seller_lane_rejected'
  | 'unsupported_lane'
  | 'recipient_email_invalid'
  | 'hunter_verification_missing'
  | 'hunter_verification_invalid'
  | 'hunter_verification_not_fresh'
  | 'hunter_verification_not_valid'
  | 'business_contact_evidence_required'
  | 'business_contact_evidence_invalid'
  | 'business_contact_evidence_recipient_mismatch'
  | 'business_contact_evidence_not_fresh'

export type VerifiedBusinessColdEmailAdmission =
  | {
      allowed: true
      reason: 'approved'
      lane: DailyStrategyOutputLaneKey
      recipientEmail: string
      hunterEvidence: HunterSendVerificationCache
      businessContactEvidence: VerifiedBusinessContactEvidence
    }
  | {
      allowed: false
      reason: Exclude<VerifiedBusinessColdEmailAdmissionReason, 'approved'>
      lane: null
      recipientEmail: string
    }

export function classifyVerifiedBusinessColdEmailAdmissionScope(
  reason: Exclude<VerifiedBusinessColdEmailAdmissionReason, 'approved'>
): 'record' | 'lane' {
  return reason === 'seller_lane_rejected' || reason === 'unsupported_lane'
    ? 'lane'
    : 'record'
}

function httpUrl(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function websiteDomain(value: unknown) {
  const url = httpUrl(value)
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null : null
}

function domainsAlign(leftValue: unknown, rightValue: unknown) {
  const left = String(leftValue || '').trim().toLowerCase().replace(/^www\./, '')
  const right = String(rightValue || '').trim().toLowerCase().replace(/^www\./, '')
  return Boolean(
    left && right &&
    (left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`))
  )
}

function recipientDomain(recipientEmail: string) {
  const at = recipientEmail.lastIndexOf('@')
  return at > 0 ? recipientEmail.slice(at + 1).toLowerCase().replace(/^www\./, '') : ''
}

export function assessVerifiedBusinessContactEvidence(
  value: unknown,
  now: Date = new Date(),
  maxAgeMs = VERIFIED_BUSINESS_CONTACT_EVIDENCE_MAX_AGE_MS
):
  | { evidence: VerifiedBusinessContactEvidence; reason: 'approved' }
  | {
      evidence: null
      reason: Extract<
        VerifiedBusinessColdEmailAdmissionReason,
        | 'business_contact_evidence_required'
        | 'business_contact_evidence_invalid'
        | 'business_contact_evidence_not_fresh'
      >
    } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { evidence: null, reason: 'business_contact_evidence_required' }
  }
  const candidate = value as Record<string, unknown>
  if (candidate.confirmed !== true) {
    return { evidence: null, reason: 'business_contact_evidence_required' }
  }
  const source = typeof candidate.source === 'string' ? candidate.source.trim() : ''
  const observedAtMs = Date.parse(typeof candidate.observedAt === 'string' ? candidate.observedAt : '')
  const recipientHash = typeof candidate.recipientHash === 'string'
    ? candidate.recipientHash.trim().toLowerCase()
    : ''
  const sourceUrl = typeof candidate.sourceUrl === 'string' ? candidate.sourceUrl.trim() : ''
  if (
    candidate.contactType !== 'business' ||
    !source ||
    source.length > 200 ||
    !Number.isFinite(observedAtMs) ||
    observedAtMs > now.getTime() + FUTURE_EVIDENCE_SKEW_MS ||
    !/^[0-9a-f]{64}$/.test(recipientHash) ||
    sourceUrl.length > 2_000
  ) {
    return { evidence: null, reason: 'business_contact_evidence_invalid' }
  }
  if (observedAtMs < now.getTime() - maxAgeMs) {
    return { evidence: null, reason: 'business_contact_evidence_not_fresh' }
  }
  return {
    evidence: {
      confirmed: true,
      contactType: 'business',
      source,
      observedAt: new Date(observedAtMs).toISOString(),
      recipientHash,
      ...(sourceUrl ? { sourceUrl } : {}),
    },
    reason: 'approved',
  }
}

/**
 * Re-derives evidence only from current canonical enrichment. Arbitrary caller
 * booleans or persisted evidence blobs cannot authorize a new cold send.
 */
export function deriveRecipientBoundBusinessContactEvidence(input: {
  source?: string | null
  metadataJson?: Record<string, unknown> | null
  contactInfo?: Record<string, unknown> | null
  recipientEmail?: string | null
  website?: string | null
  now?: Date
}) {
  const now = input.now || new Date()
  const metadata = input.metadataJson || {}
  const contactInfo = input.contactInfo || {}
  const recipientEmail = normalizeEmailAddress(input.recipientEmail)
  const recipientHash = recipientEmail ? hashHunterVerificationEmail(recipientEmail) : ''

  const publicEnrichment = contactInfo.publicEmailEnrichment
  const publicCandidates = contactInfo.publicEmailCandidates
  if (
    publicEnrichment &&
    typeof publicEnrichment === 'object' &&
    !Array.isArray(publicEnrichment) &&
    Array.isArray(publicCandidates)
  ) {
    const enrichment = publicEnrichment as Record<string, unknown>
    const matchingCandidate = publicCandidates.find((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const candidate = value as Record<string, unknown>
      const sourceUrl = httpUrl(candidate.sourceUrl)
      const candidateRecipientHash = String(candidate.recipientHash || '').trim().toLowerCase()
      return normalizeEmailAddress(String(candidate.email || '')) === recipientEmail &&
        Number(candidate.score) >= 5 &&
        (!candidateRecipientHash || candidateRecipientHash === recipientHash) &&
        Boolean(sourceUrl) &&
        Boolean(websiteDomain(input.website)) &&
        domainsAlign(websiteDomain(sourceUrl), websiteDomain(input.website))
    }) as Record<string, unknown> | undefined
    if (
      enrichment.provider === 'public_website' &&
      ['medium', 'high'].includes(String(enrichment.confidence || '').toLowerCase()) &&
      (!enrichment.recipientHash || enrichment.recipientHash === recipientHash) &&
      matchingCandidate
    ) {
      const assessed = assessVerifiedBusinessContactEvidence({
        confirmed: true,
        contactType: 'business',
        source: 'public_business_website_email',
        observedAt: enrichment.checkedAt,
        recipientHash,
        sourceUrl: httpUrl(matchingCandidate.sourceUrl),
      }, now)
      if (assessed.evidence) return assessed.evidence
    }
  }

  const listingUrl = httpUrl(metadata.listingUrl || metadata.sourceUrl)
  const listingObservedAt = metadata.sourceObservedAt || metadata.listingFetchedAt
  const listingAgentEmailHash = String(metadata.listingAgentEmailHash || '').trim().toLowerCase()
  if (
    isListingAgentIntermediaryLead({
      source: input.source,
      contact_info: contactInfo,
      metadata_json: metadata,
    }) &&
    listingUrl &&
    listingAgentEmailHash === recipientHash
  ) {
    const assessed = assessVerifiedBusinessContactEvidence({
      confirmed: true,
      contactType: 'business',
      source: 'verified_listing_feed_agent_contact',
      observedAt: listingObservedAt,
      recipientHash,
      sourceUrl: listingUrl,
    }, now)
    if (assessed.evidence) return assessed.evidence
  }

  const hunter = metadata.hunterContactEnrichment
  if (hunter && typeof hunter === 'object' && !Array.isArray(hunter)) {
    const record = hunter as Record<string, unknown>
    const websiteHost = websiteDomain(input.website)
    if (
      record.provider === 'hunter' &&
      record.status === 'found' &&
      record.accepted === true &&
      String(record.acceptedVerificationStatus || '').toLowerCase() === 'valid' &&
      Number.isFinite(Number(record.acceptedConfidence)) &&
      Number(record.acceptedConfidence) >= 90 &&
      record.acceptedRecipientHash === recipientHash &&
      domainsAlign(record.domain, websiteHost) &&
      domainsAlign(recipientDomain(recipientEmail), websiteHost)
    ) {
      const assessed = assessVerifiedBusinessContactEvidence({
        confirmed: true,
        contactType: 'business',
        source: 'hunter_business_contact_enrichment',
        observedAt: record.checkedAt,
        recipientHash,
        sourceUrl: httpUrl(input.website),
      }, now)
      if (assessed.evidence) return assessed.evidence
    }
  }

  return null
}

export function isAutonomousEmailQueueLeadAllowed(lead: {
  source?: string | null
  category?: string | null
  lead_type?: string | null
  email?: string | null
  website?: string | null
  contact_info?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
}, now: Date = new Date()) {
  const isSellerEntity =
    String(lead.category || '').trim().toLowerCase() === 'seller_lead' ||
    String(lead.lead_type || '').trim().toLowerCase() === 'sell_house'
  if (!isSellerEntity) return true
  if (!isListingAgentIntermediaryLead(lead)) return false

  const evidence = deriveRecipientBoundBusinessContactEvidence({
    source: lead.source,
    metadataJson: lead.metadata_json,
    contactInfo: lead.contact_info,
    recipientEmail: lead.email,
    website: lead.website,
    now,
  })
  return evidence?.source === 'verified_listing_feed_agent_contact'
}

export function isPublicBusinessWebsiteEvidenceMissQuarantined(lead: {
  source?: string | null
  email?: string | null
  website?: string | null
  contact_info?: Record<string, unknown> | null
  metadata_json?: Record<string, unknown> | null
}, now: Date = new Date()) {
  const positiveEvidence = deriveRecipientBoundBusinessContactEvidence({
    source: lead.source,
    metadataJson: lead.metadata_json,
    contactInfo: lead.contact_info,
    recipientEmail: lead.email,
    website: lead.website,
    now,
  })
  if (positiveEvidence) return false

  return assessPublicBusinessWebsiteEvidenceMiss({
    metadataJson: lead.metadata_json,
    recipientEmail: lead.email,
    website: lead.website,
    now,
  }).active
}

export function excludePublicBusinessWebsiteEvidenceMissesFromQueue<
  T extends {
    leads: {
      source?: string | null
      email?: string | null
      website?: string | null
      contact_info?: Record<string, unknown> | null
      metadata_json?: Record<string, unknown> | null
    } | null
  }
>(rows: readonly T[], now: Date = new Date()) {
  return rows.filter((row) => (
    row.leads && !isPublicBusinessWebsiteEvidenceMissQuarantined(row.leads, now)
  ))
}

export function assessVerifiedBusinessColdEmailAdmission(input: {
  strategyKey: DailyStrategyOutputLaneKey | string
  recipientEmail: string
  hunterEvidence?: HunterSendVerificationCache | null
  businessContactEvidence?: unknown
  now?: Date
  hunterMaxAgeMs?: number
  businessContactMaxAgeMs?: number
}): VerifiedBusinessColdEmailAdmission {
  const now = input.now || new Date()
  const strategyKey = String(input.strategyKey || '').trim()
  const recipientEmail = normalizeEmailAddress(input.recipientEmail)
  const lane = getDailyStrategyOutputLane(strategyKey)
  if (lane?.group === 'seller') {
    return { allowed: false, reason: 'seller_lane_rejected', lane: null, recipientEmail }
  }
  if (!lane || (lane.group !== 'business' && lane.group !== 'partner')) {
    return { allowed: false, reason: 'unsupported_lane', lane: null, recipientEmail }
  }
  if (getEmailQualityIssue(recipientEmail)) {
    return { allowed: false, reason: 'recipient_email_invalid', lane: null, recipientEmail }
  }
  if (!input.hunterEvidence) {
    return { allowed: false, reason: 'hunter_verification_missing', lane: null, recipientEmail }
  }
  const hunter = assessHunterSendVerificationCache({
    metadata: { hunterSendVerification: input.hunterEvidence },
    email: recipientEmail,
    now,
    maxAgeMs: input.hunterMaxAgeMs || HUNTER_SEND_VERIFICATION_DEFAULT_MAX_AGE_MS,
  })
  if (!hunter.record) {
    return { allowed: false, reason: 'hunter_verification_invalid', lane: null, recipientEmail }
  }
  if (!hunter.fresh) {
    return { allowed: false, reason: 'hunter_verification_not_fresh', lane: null, recipientEmail }
  }
  if (!hunter.sendable || hunter.record.status !== 'valid') {
    return { allowed: false, reason: 'hunter_verification_not_valid', lane: null, recipientEmail }
  }
  const business = assessVerifiedBusinessContactEvidence(
    input.businessContactEvidence,
    now,
    input.businessContactMaxAgeMs || VERIFIED_BUSINESS_CONTACT_EVIDENCE_MAX_AGE_MS
  )
  if (!business.evidence) {
    return { allowed: false, reason: business.reason, lane: null, recipientEmail }
  }
  if (business.evidence.recipientHash !== hashHunterVerificationEmail(recipientEmail)) {
    return {
      allowed: false,
      reason: 'business_contact_evidence_recipient_mismatch',
      lane: null,
      recipientEmail,
    }
  }
  return {
    allowed: true,
    reason: 'approved',
    lane: lane.key,
    recipientEmail,
    hunterEvidence: hunter.record,
    businessContactEvidence: business.evidence,
  }
}
