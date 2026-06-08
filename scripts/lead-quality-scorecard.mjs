import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/
const SOURCE_FAMILY_SEPARATOR = '__'
const BLOCKED_SUBSTRINGS = [
  '@2x.',
  '@1x.',
  'user@domain.',
  'your@email.com',
  'youremail@',
  'your.name@',
  'john@email.com',
  'example.com',
  'sentry',
  'wixpress',
  'asset-',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
]
const BLOCKED_LOCAL_PARTS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'info',
  'hello',
  'contact',
  'support',
  'admin',
  'office',
  'sales',
  'team',
  'leasing',
  'tenant',
  'offers',
  'main',
])
const BLOCKED_DOMAINS = new Set([
  'domain.com',
  'email.com',
  'example.com',
  'example.org',
  'example.net',
  'facebook.com',
  'fb.com',
  'instagram.com',
  'linkedin.com',
  'messenger.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'webador.com',
])
const SUSPICIOUS_APPENDED_TLD_RE = /\.(com|net|org|co|io|biz|info|us)(office|branch|location|team|corp|group)$/i

const REVENUE_OFFERS = new Set([
  'DealVault Agreement & Milestone Records',
  'DealVault / Operator Accountability',
  'Business Funding',
  'Business Credit Builder',
  'AI Receptionist',
  'AI Receptionist Launch',
  'AI Appointment Booking System',
  'Website Upgrade',
  'Website Upgrade Sprint',
  'Gov Contract Readiness',
  'Real Estate Seller Lead',
  'Credit Repair',
  'Spanish Funding Assistance',
  'Grant/Funding Roadmap',
  'New Business Formation',
  'Business Setup / Compliance Help',
])

const PRIMARY_CAMPAIGNS = [
  {
    key: 'dealvault_smart_contracts',
    label: 'DealVault / Smart Contracts',
    terms: [
      'dealvault',
      'smart contract',
      'agreement tracking',
      'agreement tracker',
      'approval record',
      'approval history',
      'audit trail',
      'proof record',
      'proof of completion',
      'referral payout',
      'referral fee',
      'referral partner',
      'referral chain',
      'partner split',
      'referral split',
      'commission split',
      'placement split',
      'milestone',
      'milestone approval',
      'milestone tracking',
      'completion certificate',
      'draw request',
      'draw schedule',
      'staged draw',
      'draw package',
      'progress billing',
      'subcontractor',
      'rehab contractor',
      'remodel contractor',
      'solar installer',
      'solar EPC',
      'dealer installer',
      'contractor payout',
      'low voltage',
      'security installer',
      'access control',
      'AV integrator',
      'restoration',
      'mitigation',
      'public adjuster',
      'insurance claim consultant',
      'loss consultant',
      'proof of loss',
      'vendor deliverable',
      'vendor proof',
      'vendor completion',
      'work order approval',
      'maintenance vendor',
      'retainer deliverable',
      'monthly retainer',
      'statement of work',
      'scope approval',
      'lead generation agency',
      'appointment setting agency',
      'sales development agency',
      'outsourced sdr',
      'white label lead generation',
      'sponsorship deliverable',
      'sponsor fulfillment',
      'influencer marketing agency',
      'creator campaign agency',
      'proof of post',
      'placement fee',
      'contingent search',
      'staffing guarantee',
      'recruiter split',
      'co-broker split',
      'manufacturer rep',
      'manufacturers representative',
      'independent sales rep',
      'territory rep',
      'property management',
      'unit turn',
      'turn make ready',
      'turnover',
      'home watch',
      'property watch',
      'vacant property service',
      'seasonal home management',
      'reserve study',
      'reserve specialist',
      'grounds maintenance',
      'landscaping maintenance',
      'snow removal contractor',
      'rehab draw',
      'draw inspector',
      'draw administration',
      'rehab draw service',
      'private lending',
      'private lender servicing',
      'hard money',
      'borrower draw',
      'loan packaging',
      'invoice factoring',
      'purchase order finance',
      'funding referral',
      'referral desk',
      'merchant cash advance iso',
      'merchant services broker',
      'payment processing agent',
      'payroll broker',
      'PEO broker',
      'residual split',
      'joint venture',
      'creative finance',
      'guarantee period',
      'permit expeditor',
      'owner rep',
      'owner approval',
      'field completion proof',
      'outdoor living contractor',
      'pool builder',
      'deck builder',
      'fence contractor',
      'promotional products',
      'trade show display',
      'experiential fabrication',
    ],
  },
  {
    key: 'funding_prep',
    label: 'Business Funding Prep',
    terms: [
      'business funding',
      'funding readiness',
      'funding prep',
      'capital',
      'business credit',
      'credit builder',
      'credit repair',
      'grant',
      'financing',
      'grant/funding roadmap',
      'funding roadmap',
      'trade line',
      'tradeline',
      'new business formation',
      'business setup',
      'spanish funding',
      'gov contract',
    ],
  },
  {
    key: 'ai_receptionist_visibility',
    label: 'AI Receptionist / Search Visibility',
    terms: [
      'ai receptionist',
      'appointment booking',
      'online booking',
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
]

const GOOD_REPLY_STATUSES = new Set(['replied', 'interested', 'qualified', 'nurturing', 'closed_won'])
const BOOKED_STATUSES = new Set(['qualified', 'closed_won'])
const BAD_LEAD_STATUSES = new Set(['disqualified', 'do_not_contact', 'closed_lost'])

function envInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function isOutreachMailingAddressConfigured() {
  return Boolean(
    process.env.OUTREACH_MAILING_ADDRESS ||
      process.env.BUSINESS_MAILING_ADDRESS ||
      process.env.COMPANY_MAILING_ADDRESS ||
      process.env.PUBLIC_BUSINESS_ADDRESS
  )
}

function safeDivide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0
}

function toPercent(value) {
  return Number((value * 100).toFixed(1))
}

function normalizeEmailAddress(value) {
  return value?.trim().toLowerCase() || ''
}

function getEmailQualityIssue(value) {
  const email = normalizeEmailAddress(value)
  if (!email) return 'missing'
  if (email.length > 254) return 'too_long'
  if (!BASIC_EMAIL_RE.test(email)) return 'invalid_format'
  if (BLOCKED_SUBSTRINGS.some((entry) => email.includes(entry))) return 'blocked_pattern'

  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return 'invalid_format'
  if (BLOCKED_LOCAL_PARTS.has(localPart)) return 'blocked_local_part'
  if (localPart === 'example' || localPart === 'sample' || localPart.startsWith('test+')) {
    return 'blocked_local_part'
  }
  if (BLOCKED_DOMAINS.has(domain)) return 'blocked_domain'
  if (domain.endsWith('.local')) return 'local_domain'
  if (SUSPICIOUS_APPENDED_TLD_RE.test(domain)) return 'suspicious_domain_suffix'

  const labels = domain.split('.')
  if (labels.length < 2) return 'invalid_domain'

  for (const label of labels) {
    if (!label || label.startsWith('-') || label.endsWith('-') || !DOMAIN_LABEL_RE.test(label)) {
      return 'invalid_domain'
    }
  }

  return null
}

function isUsableContactEmail(value) {
  return getEmailQualityIssue(value) === null
}

function isLeadEmailReady(lead) {
  return Boolean(lead && lead.email_valid !== false && isUsableContactEmail(lead.email))
}

function isUnsentMessage(message, lead) {
  return Boolean(
    message &&
      !message.sent_at &&
      String(message.status || '').toLowerCase() !== 'sent' &&
      String(lead?.delivery_status || '').toLowerCase() !== 'sent' &&
      String(lead?.outreach_status || '').toLowerCase() !== 'sent'
  )
}

function getSourceFamily(sourceKey) {
  const normalized = String(sourceKey || '').trim()
  if (!normalized) return 'unknown'
  return normalized.split(SOURCE_FAMILY_SEPARATOR)[0] || normalized
}

function isSourceInFamily(sourceKey, family) {
  return getSourceFamily(sourceKey) === family
}

function isLegacyGooglePlacesPhaseOutEnabled() {
  return !envBool('LEADS_ALLOW_LEGACY_GOOGLE_PLACES', false)
}

function allowSecondaryRevenueSendQueue() {
  return envBool('LEADS_ALLOW_SECONDARY_CAMPAIGNS_FOR_AUTO_SEND', envBool('LEADS_INCLUDE_SECONDARY_CAMPAIGNS_IN_OUTREACH', false))
}

function getLeadContactFormUrls(lead) {
  const urls = lead?.contact_info?.contactFormUrls
  return Array.isArray(urls) ? urls.filter((value) => typeof value === 'string' && value.trim()) : []
}

function getBestOfferLabel(lead) {
  return typeof lead?.best_offer === 'string' && lead.best_offer.trim() ? lead.best_offer.trim() : 'Unmapped'
}

function textFromUnknown(value) {
  if (typeof value === 'string') return value
  if (value === null || typeof value === 'undefined') return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function classifyPrimaryCampaign(lead) {
  const haystack = [
    lead?.best_offer,
    lead?.category,
    lead?.lead_type,
    lead?.niche,
    lead?.market_segment,
    lead?.outreach_angle,
    lead?.pain_signal,
    lead?.business_name,
    lead?.name,
    textFromUnknown(lead?.metadata_json),
    textFromUnknown(lead?.form_data),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return PRIMARY_CAMPAIGNS.find((campaign) =>
    campaign.terms.some((term) => haystack.includes(term))
  ) || null
}

function getLeadRevenueFitIssue(lead, { allowSecondaryCampaigns = false } = {}) {
  if (!lead) return 'missing_lead'

  const campaign = classifyPrimaryCampaign(lead)
  if (!campaign) return 'non_primary_campaign'
  if (!allowSecondaryCampaigns && campaign.primary === false) return 'non_primary_campaign'

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

function shouldIncludeInProductionSendQueue(lead) {
  if (
    isLegacyGooglePlacesPhaseOutEnabled() &&
    isSourceInFamily(lead?.source, 'google_places_businesses')
  ) {
    return false
  }

  return !getLeadRevenueFitIssue(lead, { allowSecondaryCampaigns: allowSecondaryRevenueSendQueue() })
}

function incrementCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

function topEntries(map, limit = 3) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
}

function getCityKey(lead) {
  const city = String(lead?.city || '').trim()
  const state = String(lead?.state || '').trim()
  return city || state ? [city, state].filter(Boolean).join(', ') : 'Unknown market'
}

function getSourceKey(lead) {
  return String(lead?.source || 'unknown_source').trim() || 'unknown_source'
}

function summarizeDiversity(rows, getKey, totalOverride = null) {
  const counts = new Map()
  for (const row of rows) incrementCount(counts, getKey(row))
  const total = totalOverride ?? rows.length
  const top = topEntries(counts, 8)
  const topShare = total > 0 && top[0] ? Number(((top[0].value / total) * 100).toFixed(1)) : 0
  return {
    uniqueCount: counts.size,
    topShare,
    top,
  }
}

function getDateWindowStart(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function isPositiveReplySignal(lead) {
  return GOOD_REPLY_STATUSES.has(String(lead?.status || '').toLowerCase()) ||
    ['replied', 'booked'].includes(String(lead?.delivery_status || '').toLowerCase())
}

function isBookedSignal(lead) {
  return BOOKED_STATUSES.has(String(lead?.status || '').toLowerCase()) ||
    String(lead?.delivery_status || '').toLowerCase() === 'booked'
}

function isBadLead(lead) {
  if (BAD_LEAD_STATUSES.has(String(lead?.status || '').toLowerCase())) return true
  if (String(lead?.delivery_status || '').toLowerCase() === 'suppressed') return true
  if (typeof lead?.suppression_reason === 'string' && lead.suppression_reason.trim()) return true
  return false
}

function pickAction(metrics) {
  if (metrics.totalLeads < 8) {
    return {
      action: 'manual_review',
      reason: 'Low sample size. Keep the source active only for manual inspection until volume is clearer.',
    }
  }

  if (metrics.primaryCampaignFitRate < 0.25 && metrics.sentEmailVolume >= 10) {
    return {
      action: 'pause',
      reason: 'Source is producing too few leads for the current revenue campaigns.',
    }
  }

  if (metrics.bookedSignalRate >= 0.03 && metrics.usableEmailRate >= 0.45 && metrics.badLeadRate <= 0.12) {
    return {
      action: 'scale',
      reason: 'Booked signals and contactability are both healthy enough to justify more volume.',
    }
  }

  if (metrics.replySignalRate >= 0.08 && metrics.usableEmailRate >= 0.4 && metrics.skipRate <= 0.3) {
    return {
      action: 'scale',
      reason: 'Reply/follow-up signals are solid and the send path is not being heavily blocked.',
    }
  }

  if (metrics.usableEmailRate < 0.35 && (metrics.contactFormOnlyRate >= 0.2 || metrics.skipRate >= 0.35)) {
    return {
      action: 'enrich',
      reason: 'Fit exists, but too much of the pool is blocked by missing usable email coverage.',
    }
  }

  if (metrics.badLeadRate >= 0.25 || (metrics.sentEmailVolume >= 10 && metrics.replySignalRate === 0 && metrics.skipRate >= 0.4)) {
    return {
      action: 'pause',
      reason: 'Lead quality is weak enough that more automation will likely waste volume.',
    }
  }

  return {
    action: 'manual_review',
    reason: 'Mixed signals. Keep it in review until either quality or contactability improves.',
  }
}

function summarizeSource(sourceKey, sourceName, leads, sendEvents, messages, adminTasks) {
  const offerMix = new Map()
  const campaignMix = new Map()
  let usableEmailCount = 0
  let contactFormOnlyCount = 0
  let badLeadCount = 0
  let replySignalCount = 0
  let bookedSignalCount = 0
  let adminTaskSignalCount = 0
  let serviceFitCount = 0
  let primaryCampaignFitCount = 0

  for (const lead of leads) {
    if (isLeadEmailReady(lead)) usableEmailCount += 1
    if (!isLeadEmailReady(lead) && getLeadContactFormUrls(lead).length > 0) contactFormOnlyCount += 1
    if (isBadLead(lead)) badLeadCount += 1
    if (isPositiveReplySignal(lead)) replySignalCount += 1
    if (isBookedSignal(lead)) bookedSignalCount += 1

    const offer = getBestOfferLabel(lead)
    incrementCount(offerMix, offer)
    if (REVENUE_OFFERS.has(offer)) serviceFitCount += 1

    const campaign = classifyPrimaryCampaign(lead)
    if (campaign) {
      incrementCount(campaignMix, campaign.label)
      primaryCampaignFitCount += 1
    }
  }

  const sentEmailVolume = sendEvents.filter((event) => String(event.status).toLowerCase() === 'sent').length
  const skippedEmailVolume = sendEvents.filter((event) => String(event.status).toLowerCase() === 'skipped').length
  const totalEmailAttempts = sendEvents.length
  const approvedOrQueuedMessages = messages.filter((message) =>
    ['approved', 'queued', 'needs_review'].includes(String(message.status).toLowerCase())
  ).length
  adminTaskSignalCount = adminTasks.filter((task) =>
    ['open', 'in_progress', 'waiting', 'completed'].includes(String(task.status).toLowerCase())
  ).length

  const metrics = {
    sourceKey,
    sourceName,
    totalLeads: leads.length,
    usableEmailRate: safeDivide(usableEmailCount, leads.length),
    contactFormOnlyRate: safeDivide(contactFormOnlyCount, leads.length),
    skipRate: safeDivide(skippedEmailVolume, totalEmailAttempts),
    sentEmailVolume,
    replySignalRate: safeDivide(replySignalCount, leads.length),
    replySignalCount,
    followUpSignalVolume: approvedOrQueuedMessages,
    bookedSignalRate: safeDivide(bookedSignalCount, leads.length),
    bookedSignalCount,
    adminTaskSignalCount,
    badLeadRate: safeDivide(badLeadCount, leads.length),
    serviceFitRate: safeDivide(serviceFitCount, leads.length),
    primaryCampaignFitRate: safeDivide(primaryCampaignFitCount, leads.length),
    topOffers: topEntries(offerMix, 3),
    topCampaigns: topEntries(campaignMix, 3),
  }

  const recommendation = pickAction(metrics)

  return {
    sourceKey,
    sourceName,
    totalLeads: metrics.totalLeads,
    usableEmailRate: toPercent(metrics.usableEmailRate),
    contactFormOnlyRate: toPercent(metrics.contactFormOnlyRate),
    skipRate: toPercent(metrics.skipRate),
    sentEmailVolume: metrics.sentEmailVolume,
    replyOrFollowUpSignals: metrics.replySignalCount,
    replySignalRate: toPercent(metrics.replySignalRate),
    followUpSignalVolume: metrics.followUpSignalVolume,
    bookedTaskSignals: metrics.bookedSignalCount,
    bookedSignalRate: toPercent(metrics.bookedSignalRate),
    adminTaskSignals: metrics.adminTaskSignalCount,
    badLeadRate: toPercent(metrics.badLeadRate),
    serviceFitRate: toPercent(metrics.serviceFitRate),
    primaryCampaignFitRate: toPercent(metrics.primaryCampaignFitRate),
    topOffers: metrics.topOffers,
    topCampaigns: metrics.topCampaigns,
    recommendedAction: recommendation.action,
    recommendationReason: recommendation.reason,
  }
}

function sortSources(rows) {
  return [...rows].sort((left, right) => {
    const actionWeight = { scale: 4, enrich: 3, manual_review: 2, pause: 1 }
    const actionDelta = (actionWeight[right.recommendedAction] || 0) - (actionWeight[left.recommendedAction] || 0)
    if (actionDelta !== 0) return actionDelta

    const rightComposite =
      right.bookedSignalRate * 5 +
      right.replySignalRate * 2 +
      right.usableEmailRate -
      right.badLeadRate -
      right.skipRate
    const leftComposite =
      left.bookedSignalRate * 5 +
      left.replySignalRate * 2 +
      left.usableEmailRate -
      left.badLeadRate -
      left.skipRate
    return rightComposite - leftComposite
  })
}

function getEventSkipReason(event) {
  const metadata = event?.metadata_json && typeof event.metadata_json === 'object' ? event.metadata_json : {}
  return (
    metadata.skippedReason ||
    metadata.reason ||
    event?.error_message ||
    'unspecified'
  )
}

function summarizeOutreachThroughput(leads, sendEvents, messages, adminTasks, lookbackDays) {
  const dailyTarget = envInt('LEADS_DAILY_SEND_LIMIT', envInt('LEADS_DAILY_SEND_TARGET', 50))
  const autoSendEnabled = envBool('AUTO_SEND_ENABLED', envBool('LEADS_AUTO_SEND_APPROVED', false))
  const mailingAddressConfigured = isOutreachMailingAddressConfigured()
  const gmailConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_WORKSPACE_SENDER
  )
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL)
  const providerConfigured = gmailConfigured || resendConfigured
  const last24hMs = Date.now() - 24 * 60 * 60 * 1000
  const createdInLast24h = (row) => {
    const createdAt = Date.parse(row?.created_at || row?.updated_at || '')
    return Number.isFinite(createdAt) && createdAt >= last24hMs
  }

  const sentLast24h = sendEvents.filter(
    (event) => String(event.status).toLowerCase() === 'sent' && createdInLast24h(event)
  ).length
  const sentInWindow = sendEvents.filter((event) => String(event.status).toLowerCase() === 'sent').length
  const skippedLast24h = sendEvents.filter(
    (event) => String(event.status).toLowerCase() === 'skipped' && createdInLast24h(event)
  )
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))
  const messageRows = messages.map((message) => ({
    message,
    lead: leadById.get(message.lead_id),
  }))
  const messagesByLeadId = new Map()
  for (const message of messages) {
    const leadMessages = messagesByLeadId.get(message.lead_id) || []
    leadMessages.push(message)
    messagesByLeadId.set(message.lead_id, leadMessages)
  }
  const productionEligibleMessages = messageRows.filter(({ lead }) => shouldIncludeInProductionSendQueue(lead))
  const productionEligibleLeads = leads.filter((lead) => shouldIncludeInProductionSendQueue(lead))
  const productionEligibleAlreadySentLeads = productionEligibleLeads.filter((lead) =>
    (messagesByLeadId.get(lead.id) || []).some((message) => String(message.status).toLowerCase() === 'sent')
  ).length
  const productionEligibleActiveUnsentLeads = productionEligibleLeads.filter((lead) =>
    (messagesByLeadId.get(lead.id) || []).some((message) =>
      ['approved', 'queued', 'needs_review'].includes(String(message.status).toLowerCase()) &&
        isUnsentMessage(message, lead)
    )
  ).length
  const freshProductionEligibleEmailLeads = productionEligibleLeads.filter((lead) => {
    if (!isLeadEmailReady(lead)) return false
    const leadMessages = messagesByLeadId.get(lead.id) || []
    return !leadMessages.some((message) =>
      ['approved', 'queued', 'needs_review', 'sent'].includes(String(message.status).toLowerCase())
    )
  }).length
  const rawApprovedQueue = messageRows.filter(({ message, lead }) =>
    ['approved', 'queued'].includes(String(message.status).toLowerCase()) && isUnsentMessage(message, lead)
  ).length
  const rawNeedsReviewQueue = messageRows.filter(({ message, lead }) =>
    String(message.status).toLowerCase() === 'needs_review' && isUnsentMessage(message, lead)
  ).length
  const excludedByProductionRules = messageRows.length - productionEligibleMessages.length
  const excludedLegacyGooglePlacesMessages = messageRows.filter(
    ({ lead }) => isLegacyGooglePlacesPhaseOutEnabled() && isSourceInFamily(lead?.source, 'google_places_businesses')
  ).length
  const approvedQueue = productionEligibleMessages.filter(({ message, lead }) =>
    ['approved', 'queued'].includes(String(message.status).toLowerCase()) && isUnsentMessage(message, lead)
  ).length
  const needsReviewQueue = productionEligibleMessages.filter(({ message, lead }) =>
    String(message.status).toLowerCase() === 'needs_review' && isUnsentMessage(message, lead)
  ).length
  const productionSendReadyMessages = productionEligibleMessages.filter(({ message, lead }) =>
    ['approved', 'queued'].includes(String(message.status).toLowerCase()) && isUnsentMessage(message, lead) && isLeadEmailReady(lead)
  )
  const productionSendReadyMessageCount = productionSendReadyMessages.length
  const productionNeedsReviewEmailReadyMessages = productionEligibleMessages.filter(
    ({ message, lead }) => String(message.status).toLowerCase() === 'needs_review' && isUnsentMessage(message, lead) && isLeadEmailReady(lead)
  )
  const productionNeedsReviewEmailReadyMessageCount = productionNeedsReviewEmailReadyMessages.length
  const noEmailManualQueue = leads.filter(
    (lead) => !isLeadEmailReady(lead) && getLeadContactFormUrls(lead).length > 0
  ).length
  const noUsableEmailCount = leads.filter((lead) => !isLeadEmailReady(lead)).length
  const usableEmailCount = leads.length - noUsableEmailCount
  const replySignals = leads.filter(isPositiveReplySignal).length
  const bookedSignals = leads.filter(isBookedSignal).length
  const openAdminTasks = adminTasks.filter((task) =>
    ['open', 'in_progress', 'waiting'].includes(String(task.status).toLowerCase())
  ).length

  const skipReasonCounts = new Map()
  for (const event of skippedLast24h) {
    incrementCount(skipReasonCounts, String(getEventSkipReason(event)))
  }
  const topSkipReasons = topEntries(skipReasonCounts, 5)
  const topSkipReason = topSkipReasons[0]?.label || null
  const sendReadyCityMix = summarizeDiversity(productionSendReadyMessages, ({ lead }) => getCityKey(lead))
  const sendReadySourceMix = summarizeDiversity(productionSendReadyMessages, ({ lead }) => getSourceKey(lead))
  const needsReviewCityMix = summarizeDiversity(productionNeedsReviewEmailReadyMessages, ({ lead }) => getCityKey(lead))
  const leadCityMix = summarizeDiversity(leads, getCityKey)
  const concentrationWarnings = [
    sendReadyCityMix.topShare > 40
      ? `Send-ready queue is concentrated in ${sendReadyCityMix.top[0]?.label || 'one city'} (${sendReadyCityMix.topShare}%).`
      : null,
    sendReadySourceMix.topShare > 50
      ? `Send-ready queue is concentrated in ${sendReadySourceMix.top[0]?.label || 'one source'} (${sendReadySourceMix.topShare}%).`
      : null,
    needsReviewCityMix.topShare > 40
      ? `Needs-review queue is concentrated in ${needsReviewCityMix.top[0]?.label || 'one city'} (${needsReviewCityMix.topShare}%).`
      : null,
  ].filter(Boolean)

  let bottleneck = 'quality_candidate_shortage'
  let bestNextRevenueAction = 'Find or enrich better-fit leads before increasing send volume.'

  if (!providerConfigured) {
    bottleneck = 'outbound_provider_not_configured'
    bestNextRevenueAction = 'Configure Gmail Workspace or Resend before expecting automated sends.'
  } else if (!mailingAddressConfigured) {
    bottleneck = 'missing_outreach_mailing_address'
    bestNextRevenueAction =
      productionSendReadyMessageCount > 0
        ? 'Add OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS, then run a small controlled send batch.'
        : 'Add OUTREACH_MAILING_ADDRESS or BUSINESS_MAILING_ADDRESS, then review production-eligible drafts before sending.'
  } else if (!autoSendEnabled) {
    bottleneck = 'auto_send_disabled'
    bestNextRevenueAction = 'Enable AUTO_SEND_ENABLED only after reviewing the top approved messages and confirming the send cap.'
  } else if (sentLast24h >= dailyTarget) {
    bottleneck = 'target_hit'
    bestNextRevenueAction = 'Work replies and booked calls first, then refill tomorrow morning queue.'
  } else if (productionSendReadyMessageCount > 0) {
    bottleneck = 'send_execution_or_auto_send_disabled'
    bestNextRevenueAction = 'Run the send queue for approved messages, or confirm auto-send is intentionally disabled.'
  } else if (productionNeedsReviewEmailReadyMessageCount >= Math.min(dailyTarget, 25)) {
    bottleneck = 'review_queue_needs_approval'
    bestNextRevenueAction = 'Review the top 25 email-ready drafts and approve only messages that pass the guardrails.'
  } else if (
    freshProductionEligibleEmailLeads < Math.min(10, Math.max(1, dailyTarget - sentLast24h)) &&
    productionEligibleAlreadySentLeads > freshProductionEligibleEmailLeads
  ) {
    bottleneck = 'qualified_pool_exhausted'
    bestNextRevenueAction =
      'Run the throughput refill path: scrape higher-fit business sources, enrich websites for public emails, generate V2 drafts, then send only clean production-eligible messages.'
  } else if (noEmailManualQueue >= Math.min(dailyTarget, 25)) {
    bottleneck = 'missing_email_or_contact_form_backlog'
    bestNextRevenueAction = 'Export no-email leads to the offline research sheet and enrich the strongest matches.'
  } else if (topSkipReason) {
    bottleneck = 'guardrail_skips'
    bestNextRevenueAction = `Fix the dominant skip reason before scaling volume: ${topSkipReason}.`
  }

  return {
    dailyTarget,
    sentLast24h,
    targetGap24h: Math.max(0, dailyTarget - sentLast24h),
    onPaceForDailyTarget: sentLast24h >= dailyTarget,
    sentInWindow,
    averageSentPerDay: Number(safeDivide(sentInWindow, lookbackDays).toFixed(1)),
    approvedOrQueuedMessages: rawApprovedQueue,
    needsReviewMessages: rawNeedsReviewQueue,
    productionEligibleApprovedOrQueuedMessages: approvedQueue,
    productionEligibleNeedsReviewMessages: needsReviewQueue,
    productionSendReadyMessages: productionSendReadyMessageCount,
    productionNeedsReviewEmailReadyMessages: productionNeedsReviewEmailReadyMessageCount,
    cityMix: leadCityMix,
    sendReadyCityMix,
    sendReadySourceMix,
    needsReviewCityMix,
    concentrationWarnings,
    freshProductionEligibleEmailLeads,
    productionEligibleAlreadySentLeads,
    productionEligibleActiveUnsentLeads,
    excludedByProductionRules,
    excludedLegacyGooglePlacesMessages,
    skippedLast24h: skippedLast24h.length,
    topSkipReasons,
    usableEmailLeads: usableEmailCount,
    noUsableEmailLeads: noUsableEmailCount,
    noEmailManualQueue,
    repliesOrPositiveSignals: replySignals,
    bookedSignals,
    openAdminTasks,
    autoSendEnabled,
    mailingAddressConfigured,
    providerConfigured,
    bottleneck,
    bestNextRevenueAction,
  }
}

function formatError(error) {
  if (!error) return { message: 'Unknown error' }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.DEBUG ? error.stack : undefined,
    }
  }
  if (typeof error === 'object') {
    return {
      name: error.name || 'Error',
      message: error.message || JSON.stringify(error),
      details: error.details,
      hint: error.hint,
      code: error.code,
    }
  }
  return { message: String(error) }
}

function runSelfTest() {
  const sourceSummary = summarizeSource(
    'google_places_businesses',
    'Google Places Businesses',
    [
      {
        id: 'lead-1',
        email: 'owner@acmecontractors.com',
        email_valid: true,
        website: 'https://acmecontractors.com',
        business_name: 'Acme Contractors',
        lead_score: 90,
        contact_info: { contactFormUrls: [] },
        best_offer: 'AI Receptionist Launch',
        status: 'qualified',
        delivery_status: 'booked',
        category: 'ai receptionist',
        niche: 'contractor',
      },
      {
        id: 'lead-2',
        email: '',
        contact_info: { contactFormUrls: ['https://example.org/contact'] },
        best_offer: 'Website Upgrade Sprint',
        status: 'new',
        delivery_status: 'not_sent',
        category: 'website upgrade',
      },
    ],
    [
      { lead_id: 'lead-1', status: 'sent' },
      { lead_id: 'lead-2', status: 'skipped' },
    ],
    [
      { lead_id: 'lead-1', status: 'approved' },
      { lead_id: 'lead-1', status: 'sent' },
    ],
    [{ entity_id: 'lead-2', status: 'open', entity_type: 'lead', task_type: 'lead_contact_form_outreach' }]
  )

  if (sourceSummary.adminTaskSignals !== 1) {
    throw new Error(`Self-test failed: expected adminTaskSignals=1, received ${sourceSummary.adminTaskSignals}`)
  }
  if (sourceSummary.contactFormOnlyRate !== 50) {
    throw new Error(`Self-test failed: expected contactFormOnlyRate=50, received ${sourceSummary.contactFormOnlyRate}`)
  }
  if (sourceSummary.bookedTaskSignals !== 1) {
    throw new Error(`Self-test failed: expected bookedTaskSignals=1, received ${sourceSummary.bookedTaskSignals}`)
  }
  if (sourceSummary.followUpSignalVolume !== 1) {
    throw new Error(`Self-test failed: expected followUpSignalVolume=1, received ${sourceSummary.followUpSignalVolume}`)
  }

  const throughput = summarizeOutreachThroughput(
    [
      {
        id: 'lead-1',
        email: 'owner@acmecontractors.com',
        email_valid: true,
        website: 'https://acmecontractors.com',
        business_name: 'Acme Contractors',
        lead_score: 90,
        contact_info: { contactFormUrls: [] },
        status: 'qualified',
        delivery_status: 'booked',
        best_offer: 'AI Receptionist Launch',
        category: 'ai receptionist',
        niche: 'contractor',
      },
      {
        id: 'lead-2',
        email: '',
        contact_info: { contactFormUrls: ['https://example.org/contact'] },
        status: 'new',
        delivery_status: 'not_sent',
      },
    ],
    [
      { lead_id: 'lead-1', status: 'sent', created_at: new Date().toISOString() },
      {
        lead_id: 'lead-2',
        status: 'skipped',
        created_at: new Date().toISOString(),
        metadata_json: { reason: 'missing_email' },
      },
    ],
    [{ lead_id: 'lead-1', status: 'approved', updated_at: new Date().toISOString() }],
    [{ entity_id: 'lead-2', status: 'open', entity_type: 'lead', task_type: 'lead_contact_form_outreach' }],
    30
  )

  if (throughput.sentLast24h !== 1) {
    throw new Error(`Self-test failed: expected sentLast24h=1, received ${throughput.sentLast24h}`)
  }
  if (throughput.noEmailManualQueue !== 1) {
    throw new Error(`Self-test failed: expected noEmailManualQueue=1, received ${throughput.noEmailManualQueue}`)
  }

  console.log(
    JSON.stringify({
      ok: true,
      checked: ['adminTaskSignals', 'contactFormOnlyRate', 'bookedTaskSignals', 'outreachThroughput'],
      sample: sourceSummary,
      throughput,
    }, null, 2)
  )
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials in environment.')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const lookbackDays = envInt('LEAD_SOURCE_SCORECARD_DAYS', 30)
  const leadLimit = envInt('LEAD_SOURCE_SCORECARD_LIMIT', 5000)
  const startedAt = getDateWindowStart(lookbackDays)

  const [sourcesResult, leadsResult, sendEventsResult, messagesResult, adminTasksResult] = await Promise.all([
    admin.from('lead_sources').select('source_key,name,is_active'),
    admin
      .from('leads')
      .select('id,source,source_url,email,email_valid,contact_info,best_offer,status,delivery_status,suppression_reason,created_at,category,lead_type,niche,market_segment,outreach_angle,pain_signal,business_name,name,website,city,state,lead_score,bounce_risk_score,outreach_status,metadata_json,form_data,website_audit_json')
      .gte('created_at', startedAt)
      .limit(leadLimit),
    admin
      .from('outreach_send_events')
      .select('lead_id,status,channel,created_at,error_message,metadata_json')
      .eq('channel', 'email')
      .gte('created_at', startedAt)
      .order('created_at', { ascending: false })
      .limit(leadLimit * 3),
    admin
      .from('outreach_messages')
      .select('lead_id,status,channel,sent_at,updated_at')
      .eq('channel', 'email')
      .gte('updated_at', startedAt)
      .limit(leadLimit * 2),
    admin
      .from('admin_tasks')
      .select('entity_id,entity_type,status,task_type,created_at')
      .eq('entity_type', 'lead')
      .gte('created_at', startedAt)
      .limit(leadLimit * 2),
  ])

  if (sourcesResult.error) throw sourcesResult.error
  if (leadsResult.error) throw leadsResult.error
  if (sendEventsResult.error) throw sendEventsResult.error
  if (messagesResult.error) throw messagesResult.error
  if (adminTasksResult.error) throw adminTasksResult.error

  const sourceNameByKey = new Map(
    (sourcesResult.data || []).map((row) => [String(row.source_key), row.name || String(row.source_key)])
  )
  const leads = leadsResult.data || []
  const sendEvents = sendEventsResult.data || []
  const messages = messagesResult.data || []
  const adminTasks = adminTasksResult.data || []
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  const grouped = new Map()

  for (const lead of leads) {
    const sourceKey = getSourceFamily(lead.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [], adminTasks: [] })
    }
    grouped.get(sourceKey).leads.push(lead)
  }

  for (const event of sendEvents) {
    const lead = leadById.get(event.lead_id)
    if (!lead) continue
    const sourceKey = getSourceFamily(lead?.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [], adminTasks: [] })
    }
    grouped.get(sourceKey).sendEvents.push(event)
  }

  for (const message of messages) {
    const lead = leadById.get(message.lead_id)
    if (!lead) continue
    const sourceKey = getSourceFamily(lead?.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [], adminTasks: [] })
    }
    grouped.get(sourceKey).messages.push(message)
  }

  for (const task of adminTasks) {
    const lead = leadById.get(task.entity_id)
    if (!lead) continue
    const sourceKey = getSourceFamily(lead.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [], adminTasks: [] })
    }
    grouped.get(sourceKey).adminTasks.push(task)
  }

  const sourceRows = Array.from(grouped.entries()).map(([sourceKey, rows]) =>
    summarizeSource(
      sourceKey,
      sourceNameByKey.get(sourceKey) || sourceKey,
      rows.leads,
      rows.sendEvents,
      rows.messages,
      rows.adminTasks
    )
  )

  const actionCounts = new Map()
  for (const row of sourceRows) incrementCount(actionCounts, row.recommendedAction)

  const summary = {
    windowStart: startedAt,
    windowDays: lookbackDays,
    leadCount: leads.length,
    sourceCount: sourceRows.length,
    recommendedMix: Object.fromEntries(Array.from(actionCounts.entries()).sort()),
    outreachThroughput: summarizeOutreachThroughput(leads, sendEvents, messages, adminTasks, lookbackDays),
    sources: sortSources(sourceRows),
  }

  console.log(JSON.stringify(summary, null, 2))
}

const isDirectExecution = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false

if (process.env.LEAD_SOURCE_SCORECARD_SELF_TEST === '1' || process.argv.includes('--self-test')) {
  runSelfTest()
} else if (isDirectExecution) {
  main().catch((error) => {
    const formatted = formatError(error)
    if (/fetch failed/i.test(formatted.message || '')) {
      formatted.hint =
        formatted.hint ||
        'Supabase could not be reached from this environment. Re-run where outbound network access to the project is available.'
    }
    console.error(JSON.stringify(formatted, null, 2))
    process.exit(1)
  })
}
