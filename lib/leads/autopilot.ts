import type { LeadRecord, LeadSuppressionRecord } from '@/lib/leads/types'
import { getLeadRevenueFitIssue, getRevenueCampaignMinAutoScore } from '@/lib/leads/revenueCampaigns'
import { isSourceInFamily } from '@/lib/leads/source-keys'
import { getEmailQualityIssue } from '@/lib/outreach/email-quality'

type LeadEmailAutopilotInput = Partial<Pick<
  LeadRecord,
  | 'status'
  | 'outreach_status'
  | 'source'
  | 'email'
  | 'email_valid'
  | 'website'
  | 'phone'
  | 'business_name'
  | 'city'
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
  | 'metadata_json'
  | 'form_data'
>>

type LeadEmailAutopilotDecision = {
  autoApproveEnabled: boolean
  autoSendEnabled: boolean
  minScore: number
  maxBounceRisk: number
  eligible: boolean
  reason: string | null
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

export function isLegacyGooglePlacesPhaseOutEnabled() {
  return !envBool('LEADS_ALLOW_LEGACY_GOOGLE_PLACES', false)
}

function isClosedLeadStatus(status: string | null | undefined) {
  return ['closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'].includes(
    String(status || '').toLowerCase()
  )
}

function matchesSuppression(lead: LeadEmailAutopilotInput, suppressions: LeadSuppressionRecord[]) {
  return suppressions.find((entry) =>
    (entry.email && lead.email && entry.email.toLowerCase() === lead.email.toLowerCase()) ||
    (entry.phone && lead.phone && entry.phone === lead.phone) ||
    (entry.website && lead.website && entry.website === lead.website) ||
    (entry.business_name &&
      lead.business_name &&
      entry.business_name.toLowerCase() === lead.business_name.toLowerCase() &&
      entry.city === lead.city)
  )
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
])

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
  if (emailDomain === websiteHost) return true
  if (emailDomain.endsWith(`.${websiteHost}`)) return true
  if (websiteHost.endsWith(`.${emailDomain}`)) return true
  return false
}

export function getLeadEmailAutopilotDecision(
  lead: LeadEmailAutopilotInput,
  suppressions: LeadSuppressionRecord[] = []
): LeadEmailAutopilotDecision {
  const autoApproveEnabled = envBool('LEADS_AUTO_APPROVE_ENABLED', true)
  const autoSendEnabled = envBool('AUTO_SEND_ENABLED', envBool('LEADS_AUTO_SEND_APPROVED', false))
  const minScore = envInt(
    'LEADS_AUTO_APPROVE_MIN_SCORE',
    envInt('LEADS_AUTO_SEND_MIN_SCORE', getRevenueCampaignMinAutoScore(lead))
  )
  const maxBounceRisk = envInt(
    'LEADS_AUTO_APPROVE_MAX_BOUNCE_RISK',
    envInt('LEADS_AUTO_SEND_MAX_BOUNCE_RISK', 40)
  )
  const allowSecondaryCampaigns = envBool('LEADS_ALLOW_SECONDARY_CAMPAIGNS_FOR_AUTO_SEND', false)

  if (!autoApproveEnabled) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'auto_approval_disabled' }
  }
  if (isClosedLeadStatus(lead.status) || lead.outreach_status === 'do_not_contact') {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'do_not_contact' }
  }
  if (isSourceInFamily(lead.source, 'google_places_businesses') && isLegacyGooglePlacesPhaseOutEnabled()) {
    return {
      autoApproveEnabled,
      autoSendEnabled,
      minScore,
      maxBounceRisk,
      eligible: false,
      reason: 'legacy_google_places_paused',
    }
  }
  if (!lead.email) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'missing_email' }
  }

  const emailIssue = getEmailQualityIssue(lead.email)
  if (emailIssue) {
    return {
      autoApproveEnabled,
      autoSendEnabled,
      minScore,
      maxBounceRisk,
      eligible: false,
      reason: emailIssue === 'missing' ? 'missing_email' : 'invalid_email',
    }
  }
  if (lead.email_valid === false) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'invalid_email' }
  }
  const emailDomain = extractEmailDomain(lead.email)
  if (emailDomain?.endsWith('.gov')) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'institutional_domain' }
  }
  if (emailDomain && PLATFORM_DOMAINS.has(emailDomain)) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'platform_email' }
  }
  const websiteHost = extractHost(lead.website)
  if (emailDomain && websiteHost && !WEBMAIL_DOMAINS.has(emailDomain) && !domainsLookAligned(emailDomain, websiteHost)) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'mismatched_domain' }
  }
  if (matchesSuppression(lead, suppressions)) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'suppressed' }
  }
  if (Number(lead.bounce_risk_score || 0) > maxBounceRisk) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'high_bounce_risk' }
  }
  const fitIssue = getLeadRevenueFitIssue(lead, { allowSecondaryCampaigns })
  if (fitIssue) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: fitIssue }
  }
  if (Number(lead.lead_score || 0) < minScore) {
    return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: false, reason: 'below_min_score' }
  }

  return { autoApproveEnabled, autoSendEnabled, minScore, maxBounceRisk, eligible: true, reason: null }
}
