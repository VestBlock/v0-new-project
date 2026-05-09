import { createClient } from '@supabase/supabase-js'

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/
const SOURCE_FAMILY_SEPARATOR = '__'
const BLOCKED_SUBSTRINGS = [
  '@2x.',
  '@1x.',
  'user@domain.',
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
])
const SUSPICIOUS_APPENDED_TLD_RE = /\.(com|net|org|co|io|biz|info|us)(office|branch|location|team|corp|group)$/i

const REVENUE_OFFERS = new Set([
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
      'audit trail',
      'proof record',
      'proof of completion',
      'referral payout',
      'referral fee',
      'partner split',
      'milestone',
      'milestone approval',
      'draw request',
      'draw schedule',
      'contractor payout',
      'vendor deliverable',
      'work order approval',
      'retainer deliverable',
      'statement of work',
      'scope approval',
      'sponsorship deliverable',
      'placement fee',
      'recruiter split',
      'co-broker split',
      'property management',
      'rehab draw',
      'private lending',
      'hard money',
      'funding referral',
      'joint venture',
      'creative finance',
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
      'grant',
      'financing',
      'new business formation',
      'business setup',
      'spanish funding',
      'gov contract',
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

function getSourceFamily(sourceKey) {
  const normalized = String(sourceKey || '').trim()
  if (!normalized) return 'unknown'
  return normalized.split(SOURCE_FAMILY_SEPARATOR)[0] || normalized
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

function incrementCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

function topEntries(map, limit = 3) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }))
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

function summarizeSource(sourceKey, sourceName, leads, sendEvents, messages) {
  const offerMix = new Map()
  const campaignMix = new Map()
  let usableEmailCount = 0
  let contactFormOnlyCount = 0
  let badLeadCount = 0
  let replySignalCount = 0
  let bookedSignalCount = 0
  let serviceFitCount = 0
  let primaryCampaignFitCount = 0

  for (const lead of leads) {
    if (isUsableContactEmail(lead.email)) usableEmailCount += 1
    if (!isUsableContactEmail(lead.email) && getLeadContactFormUrls(lead).length > 0) contactFormOnlyCount += 1
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
    ['approved', 'queued', 'needs_review', 'sent'].includes(String(message.status).toLowerCase())
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

  const [sourcesResult, leadsResult, sendEventsResult, messagesResult] = await Promise.all([
    admin.from('lead_sources').select('source_key,name,is_active'),
    admin
      .from('leads')
      .select('id,source,email,contact_info,best_offer,status,delivery_status,suppression_reason,created_at,category,lead_type,niche,market_segment,outreach_angle,pain_signal,business_name,name,metadata_json,form_data')
      .gte('created_at', startedAt)
      .limit(leadLimit),
    admin
      .from('outreach_send_events')
      .select('lead_id,status,channel,created_at')
      .eq('channel', 'email')
      .gte('created_at', startedAt)
      .limit(leadLimit * 3),
    admin
      .from('outreach_messages')
      .select('lead_id,status,channel,updated_at')
      .eq('channel', 'email')
      .gte('updated_at', startedAt)
      .limit(leadLimit * 2),
  ])

  if (sourcesResult.error) throw sourcesResult.error
  if (leadsResult.error) throw leadsResult.error
  if (sendEventsResult.error) throw sendEventsResult.error
  if (messagesResult.error) throw messagesResult.error

  const sourceNameByKey = new Map(
    (sourcesResult.data || []).map((row) => [String(row.source_key), row.name || String(row.source_key)])
  )
  const leads = leadsResult.data || []
  const sendEvents = sendEventsResult.data || []
  const messages = messagesResult.data || []
  const leadById = new Map(leads.map((lead) => [lead.id, lead]))

  const grouped = new Map()

  for (const lead of leads) {
    const sourceKey = getSourceFamily(lead.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [] })
    }
    grouped.get(sourceKey).leads.push(lead)
  }

  for (const event of sendEvents) {
    const lead = leadById.get(event.lead_id)
    const sourceKey = getSourceFamily(lead?.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [] })
    }
    grouped.get(sourceKey).sendEvents.push(event)
  }

  for (const message of messages) {
    const lead = leadById.get(message.lead_id)
    const sourceKey = getSourceFamily(lead?.source)
    if (!grouped.has(sourceKey)) {
      grouped.set(sourceKey, { leads: [], sendEvents: [], messages: [] })
    }
    grouped.get(sourceKey).messages.push(message)
  }

  const sourceRows = Array.from(grouped.entries()).map(([sourceKey, rows]) =>
    summarizeSource(sourceKey, sourceNameByKey.get(sourceKey) || sourceKey, rows.leads, rows.sendEvents, rows.messages)
  )

  const actionCounts = new Map()
  for (const row of sourceRows) incrementCount(actionCounts, row.recommendedAction)

  const summary = {
    windowStart: startedAt,
    windowDays: lookbackDays,
    leadCount: leads.length,
    sourceCount: sourceRows.length,
    recommendedMix: Object.fromEntries(Array.from(actionCounts.entries()).sort()),
    sources: sortSources(sourceRows),
  }

  console.log(JSON.stringify(summary, null, 2))
}

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
