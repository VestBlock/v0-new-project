import { COMPLIANCE_BLOCKED_PATTERNS, HIGH_RISK_DISTRESSED_SIGNALS } from './config.mjs'
import { normalizeEmail, normalizeText, websiteHost } from './utils.mjs'
import { getEmailQualityIssue } from '../../../scripts/shared-email-quality.mjs'

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const FREE_EMAIL_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'mail.com'])
const PLACEHOLDER_FREE_EMAIL_LOCAL_PARTS = new Set(['user', 'test', 'example', 'name'])

function emailQuality(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return { usable: false, issue: 'missing_email', score: 0 }
  if (!BASIC_EMAIL_RE.test(normalized)) return { usable: false, issue: 'invalid_email_format', score: 0 }
  const [localPart, domain] = normalized.split('@')
  const sharedIssue = getEmailQualityIssue(normalized)
  if (sharedIssue) return { usable: false, issue: sharedIssue, score: 0 }
  if (FREE_EMAIL_DOMAINS.has(domain) && PLACEHOLDER_FREE_EMAIL_LOCAL_PARTS.has(localPart)) {
    return { usable: false, issue: 'likely_placeholder_free_email', score: 0 }
  }
  if (/example\.|domain\.com|facebook\.com|instagram\.com|linkedin\.com/.test(domain)) {
    return { usable: false, issue: 'blocked_email_domain', score: 0 }
  }
  return { usable: true, issue: null, score: 22 }
}

function complianceRisk(lead) {
  const text = [
    lead.businessName,
    lead.propertyAddress,
    lead.vertical,
    lead.serviceFit,
    lead.painSignal,
    lead.outreachAngle,
    lead.evidence?.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const blockedPattern = COMPLIANCE_BLOCKED_PATTERNS.find((pattern) => text.includes(pattern))
  if (blockedPattern) return { score: 100, issue: `blocked_claim_pattern:${blockedPattern}` }

  if (lead.vertical === 'distressed_house') {
    const signals = new Set(lead.distressedSignals || [])
    const highRisk = [...signals].filter((signal) => HIGH_RISK_DISTRESSED_SIGNALS.has(signal))
    if (lead.homeownerContact === true) return { score: 95, issue: 'distressed_homeowner_contact_manual_only' }
    if (highRisk.length) return { score: 85, issue: `high_risk_distressed_signal:${highRisk.join('|')}` }
    return { score: 65, issue: 'distressed_pipeline_manual_review' }
  }

  if (lead.vertical === 'funding_prep') return { score: 35, issue: 'funding_claims_need_review' }
  if (lead.vertical === 'real_estate_partners') return { score: 30, issue: 'real_estate_claims_need_review' }
  return { score: 12, issue: null }
}

function fitScore(lead) {
  let score = 20
  if (normalizeText(lead.businessName || lead.propertyAddress)) score += 8
  if (lead.website) score += 8
  if (lead.phone) score += 4
  if (lead.serviceFit) score += 10
  if (Array.isArray(lead.evidence) && lead.evidence.length) score += Math.min(14, lead.evidence.length * 4)
  if (lead.vertical === 'dealvault' && /contract|restoration|property|lender|staffing|public adjuster/i.test(lead.niche || '')) score += 12
  if (lead.vertical === 'ai_receptionist' && /missed|booking|after-hours|contact|chat|phone/i.test(lead.painSignal || '')) score += 12
  if (lead.vertical === 'search_visibility' && /visibility|search|service clarity|crawl|website/i.test(lead.painSignal || '')) score += 10
  if (lead.vertical === 'distressed_house') score += Math.min(18, (lead.distressedSignals || []).length * 6)
  return Math.min(score, 100)
}

function contactabilityScore(lead, email) {
  let score = email.score
  if (lead.phone) score += 8
  if (lead.website) score += 8
  if (websiteHost(lead.website) && lead.email && normalizeEmail(lead.email).endsWith(`@${websiteHost(lead.website)}`)) score += 10
  if (Array.isArray(lead.contactPaths) && lead.contactPaths.length) score += 6
  return Math.min(score, 100)
}

function hasRealSourceProvenance(lead) {
  return lead?.sourceType === 'real_provider_dry_run' || lead?.metadata?.realSourceDryRun === true
}

function readinessDecision({ lead, email, risk, score }) {
  if (lead.vertical === 'distressed_house') {
    return {
      status: 'manual_review_required',
      reason: 'distressed_house_pipeline_never_auto_sends',
      sendReady: false,
    }
  }
  if (!hasRealSourceProvenance(lead)) {
    return {
      status: 'needs_review',
      reason: 'non_real_source_review_only',
      sendReady: false,
    }
  }
  if (!email.usable) return { status: 'blocked', reason: email.issue, sendReady: false }
  if (risk.score >= 80) return { status: 'blocked', reason: risk.issue, sendReady: false }
  if (score < 60) return { status: 'needs_review', reason: 'score_below_v4_auto_ready_floor', sendReady: false }
  if (email.issue === 'role_email_needs_extra_caution') {
    return { status: 'needs_review', reason: email.issue, sendReady: false }
  }
  return { status: 'draft_ready', reason: 'v4_quality_gate_passed', sendReady: true }
}

export function scoreLeadV4(lead) {
  const email = emailQuality(lead.email)
  const risk = complianceRisk(lead)
  const fit = fitScore(lead)
  const contactability = contactabilityScore(lead, email)
  const urgency = lead.vertical === 'distressed_house'
    ? Math.min(100, 25 + (lead.distressedSignals || []).length * 12)
    : Math.min(100, 30 + (lead.evidence || []).length * 8)
  const duplicateRiskPenalty = lead.duplicateRisk ? 20 : 0
  const score = Math.max(0, Math.min(100, Math.round(fit * 0.5 + contactability * 0.35 + urgency * 0.25 - risk.score * 0.1 - duplicateRiskPenalty)))
  const decision = readinessDecision({ lead, email, risk, score })

  return {
    leadId: lead.id,
    vertical: lead.vertical,
    score,
    fitScore: fit,
    contactabilityScore: contactability,
    urgencyScore: urgency,
    complianceRiskScore: risk.score,
    sendReady: decision.sendReady,
    status: decision.status,
    blockReason: decision.reason,
    emailQualityIssue: email.issue,
    bestOffer: lead.serviceFit,
    reasons: [
      ...(lead.evidence || []),
      risk.issue ? `risk:${risk.issue}` : null,
      decision.reason,
    ].filter(Boolean),
    scoringVersion: 'v4',
  }
}
