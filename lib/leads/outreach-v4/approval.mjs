import { COMPLIANCE_BLOCKED_PATTERNS } from './config.mjs'
import { getEmailDeliverabilityIssue } from '../../../scripts/shared-email-quality.mjs'

const AUTO_APPROVABLE_VERTICALS = new Set([
  'ai_receptionist',
  'search_visibility',
  'dealvault',
  'no_website',
  'weak_website',
  'contractors_home_services',
  'real_estate_partners',
])

const MANUAL_ONLY_VERTICALS = new Set([
  'funding_prep',
  'distressed_house',
])

const REQUIRED_OPTOUT = 'reply no and i will not follow up'
const REQUIRED_BRAND = 'VestBlock'

function hasUnsafeClaims(text) {
  const haystack = String(text || '').toLowerCase()
  return COMPLIANCE_BLOCKED_PATTERNS.find((pattern) => haystack.includes(pattern))
}

function hasUnfilledTokens(text) {
  return /\{\{[^}]+\}\}/.test(String(text || ''))
}

async function approveableEmail(email) {
  return (await getEmailDeliverabilityIssue(email)) === null
}

function isRealSourceLead(lead) {
  if (lead?.source_type === 'real_provider_dry_run') return true
  const rawMetadata = lead?.metadata
  if (!rawMetadata) return false
  try {
    const parsed = JSON.parse(String(rawMetadata))
    return parsed?.realSourceDryRun === true
  } catch {
    return String(rawMetadata).includes('"realSourceDryRun":true')
  }
}

export async function reviewDraftForAutoApproval({ draft, lead }) {
  const reasons = []
  const body = draft?.body || ''
  const subject = draft?.subject || ''
  const vertical = draft?.vertical || lead?.vertical

  if (!draft) reasons.push('missing_draft')
  if (!lead) reasons.push('missing_joined_lead_record')
  if (lead && !isRealSourceLead(lead)) reasons.push(`non_real_source_lead:${lead?.source_type || 'unknown'}`)
  if (!AUTO_APPROVABLE_VERTICALS.has(vertical)) reasons.push(`vertical_not_auto_approvable:${vertical || 'unknown'}`)
  if (MANUAL_ONLY_VERTICALS.has(vertical)) reasons.push(`manual_only_vertical:${vertical}`)
  if (draft?.status !== 'draft_ready') reasons.push(`draft_status_not_ready:${draft?.status || 'missing'}`)
  if (!(await approveableEmail(lead?.email))) reasons.push('missing_or_invalid_recipient_email')
  if (Number.parseInt(lead?.score || '0', 10) < 60) reasons.push('score_below_auto_approval_floor')
  if (!subject || subject.length > 80) reasons.push('subject_missing_or_too_long')
  if (!body || body.length > 1400) reasons.push('body_missing_or_too_long')
  if (!body.includes(REQUIRED_BRAND)) reasons.push('missing_brand_reference')
  if (!body.toLowerCase().includes(REQUIRED_OPTOUT)) reasons.push('missing_plain_opt_out')
  if (hasUnfilledTokens(`${subject}\n${body}`)) reasons.push('unfilled_template_token')

  const unsafeClaim = hasUnsafeClaims(`${subject}\n${body}\n${draft?.complianceNote || ''}`)
  if (unsafeClaim) reasons.push(`unsafe_claim:${unsafeClaim}`)

  return {
    approved: reasons.length === 0,
    reasons,
  }
}

export function buildApprovedDraftPacket({ draft, lead, reviewedAt = new Date().toISOString() }) {
  return {
    leadId: draft.leadId,
    vertical: draft.vertical,
    to: lead.email,
    businessName: lead.business_name || '',
    city: lead.city || '',
    state: lead.state || '',
    website: lead.website || '',
    sourceType: lead.source_type || '',
    score: Number.parseInt(lead.score || '0', 10),
    subject: draft.subject,
    body: draft.body,
    status: 'codex_auto_approved',
    approvedBy: 'codex_v4_safety_review',
    approvedAt: reviewedAt,
    sendAllowed: false,
    sendRequiresExplicitApproval: true,
    complianceNote: draft.complianceNote,
  }
}
