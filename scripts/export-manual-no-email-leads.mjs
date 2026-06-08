import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/
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
const SOURCE_FAMILY_SEPARATOR = '__'
const EXCLUDED_STATUSES = new Set(['closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'])
const EXCLUDED_DELIVERY_STATUSES = new Set(['suppressed', 'bounced', 'failed'])
const REVENUE_CAMPAIGNS = [
  {
    key: 'dealvault_smart_contracts',
    label: 'DealVault / Smart Contracts',
    primary: true,
    priority: 500,
    terms: [
      'dealvault',
      'smart contract',
      'blockchain',
      'agreement tracking',
      'proof record',
      'approval history',
      'referral payout',
      'referral partner',
      'referral chain',
      'partner split',
      'referral split',
      'commission split',
      'placement split',
      'milestone',
      'completion certificate',
      'draw approval',
      'draw schedule',
      'staged draw',
      'draw package',
      'progress billing',
      'subcontractor',
      'rehab contractor',
      'remodel contractor',
      'restoration',
      'mitigation',
      'private lending',
      'hard money',
      'borrower draw',
      'loan packaging',
      'funding referral',
      'referral desk',
      'joint venture',
      'creative finance',
      'vendor deliverable',
      'vendor proof',
      'vendor completion',
      'work order approval',
      'maintenance vendor',
      'property management',
      'unit turn',
      'turn make ready',
      'turnover',
      'retainer deliverable',
      'monthly retainer',
      'statement of work',
      'sponsorship deliverable',
      'sponsor fulfillment',
      'placement fee',
      'contingent search',
      'staffing guarantee',
      'recruiter split',
      'guarantee period',
      'permit expeditor',
      'owner rep',
      'owner approval',
      'field completion proof',
    ],
  },
  {
    key: 'ai_receptionist_visibility',
    label: 'AI Receptionist / Search Visibility',
    primary: true,
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
    priority: 0,
    terms: [],
  },
]

function envInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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

function getSourceFamily(sourceKey) {
  const normalized = String(sourceKey || '').trim()
  if (!normalized) return 'unknown'
  return normalized.split(SOURCE_FAMILY_SEPARATOR)[0] || normalized
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

function classifyLeadRevenueCampaign(lead) {
  const haystack = [
    lead?.lead_type,
    lead?.category,
    lead?.best_offer,
    lead?.niche,
    lead?.market_segment,
    lead?.outreach_angle,
    lead?.business_name,
    lead?.name,
    lead?.pain_signal,
    lead?.source,
    textFromUnknown(lead?.metadata_json),
    textFromUnknown(lead?.form_data),
    textFromUnknown(lead?.website_audit_json),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    REVENUE_CAMPAIGNS.find(
      (campaign) => campaign.key !== 'other' && campaign.terms.some((term) => haystack.includes(term))
    ) || REVENUE_CAMPAIGNS[REVENUE_CAMPAIGNS.length - 1]
  )
}

function getLeadContactFormUrls(lead) {
  const urls = lead?.contact_info?.contactFormUrls
  return Array.isArray(urls) ? urls.filter((value) => typeof value === 'string' && value.trim()) : []
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

function getHostname(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function safeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getDateWindowStart(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function hasSuppressionReason(lead) {
  return typeof lead?.suppression_reason === 'string' && lead.suppression_reason.trim().length > 0
}

function hasManualPath(lead) {
  return (
    getLeadContactFormUrls(lead).length > 0 ||
    safeString(lead.website) !== '' ||
    safeString(lead.phone) !== '' ||
    safeString(lead.source_url) !== ''
  )
}

function getManualPathFlags(lead) {
  const flags = []
  if (getLeadContactFormUrls(lead).length > 0) flags.push('contact_form')
  if (safeString(lead.website)) flags.push('website')
  if (safeString(lead.phone)) flags.push('phone')
  if (safeString(lead.source_url)) flags.push('source_listing')
  return flags
}

function computeReviewReason(lead, contactFormUrls) {
  const reasons = [`No usable email (${getEmailQualityIssue(lead.email) || 'unknown'})`]
  if (contactFormUrls.length > 0) reasons.push(`Has ${contactFormUrls.length} contact form URL${contactFormUrls.length === 1 ? '' : 's'}`)
  if (safeString(lead.phone)) reasons.push('Phone available')
  if (safeString(lead.website)) reasons.push('Website available')
  if (safeString(lead.source_url)) reasons.push('Source listing available')
  return reasons.join('; ')
}

function priorityBucket(lead, campaign, manualPathFlags) {
  const score = Number(lead?.lead_score || 0)
  const manualStrength = manualPathFlags.includes('contact_form') ? 2 : manualPathFlags.includes('phone') ? 1 : 0
  const composite = score + Math.round(campaign.priority / 20) + manualStrength * 8
  if (campaign.primary && composite >= 88) return 'high'
  if (campaign.primary && composite >= 68) return 'medium'
  if (!campaign.primary && composite >= 78) return 'medium'
  return 'low'
}

function dedupeKey(lead) {
  const websiteHost = getHostname(lead.website)
  const sourceHost = getHostname(lead.source_url)
  const phone = normalizePhone(lead.phone)
  const business = safeString(lead.business_name || lead.name).toLowerCase()
  const city = safeString(lead.city).toLowerCase()
  const state = safeString(lead.state).toLowerCase()

  if (websiteHost && business) return `biz-host:${business}:${websiteHost}`
  if (phone && business) return `biz-phone:${business}:${phone}`
  if (websiteHost) return `host:${websiteHost}`
  if (phone) return `phone:${phone}`
  if (sourceHost && business) return `biz-source:${business}:${sourceHost}`
  return `fallback:${business}:${city}:${state}:${safeString(lead.source).toLowerCase()}`
}

function compareLeads(left, right) {
  const scoreDelta = Number(right.lead_score || 0) - Number(left.lead_score || 0)
  if (scoreDelta !== 0) return scoreDelta
  return Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0)
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials in environment.')
  }

  const lookbackDays = envInt('MANUAL_LEAD_EXPORT_DAYS', 45)
  const leadLimit = envInt('MANUAL_LEAD_EXPORT_LIMIT', 5000)
  const startedAt = getDateWindowStart(lookbackDays)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('leads')
    .select(
      'id,created_at,updated_at,status,source,source_url,category,lead_type,name,business_name,phone,email,email_valid,website,city,state,zip,best_offer,lead_score,urgency_level,contactability_level,pain_signal,outreach_angle,market_segment,niche,delivery_status,suppression_reason,contact_info,form_data,metadata_json,website_audit_json'
    )
    .gte('created_at', startedAt)
    .order('lead_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(leadLimit)

  if (error) throw error

  const rawLeads = data || []
  const filtered = rawLeads.filter((lead) => {
    if (EXCLUDED_STATUSES.has(String(lead.status || '').toLowerCase())) return false
    if (EXCLUDED_DELIVERY_STATUSES.has(String(lead.delivery_status || '').toLowerCase())) return false
    if (hasSuppressionReason(lead)) return false
    if (isLeadEmailReady(lead)) return false
    if (!hasManualPath(lead)) return false
    return true
  })

  const deduped = new Map()
  for (const lead of filtered.sort(compareLeads)) {
    const key = dedupeKey(lead)
    if (!deduped.has(key)) deduped.set(key, lead)
  }

  const sourceCounts = new Map()
  const fitCounts = new Map()
  const priorityCounts = new Map()
  const exportRows = []

  for (const lead of deduped.values()) {
    const contactFormUrls = getLeadContactFormUrls(lead)
    const campaign = classifyLeadRevenueCampaign(lead)
    const sourceFamily = getSourceFamily(lead.source)
    const manualPathFlags = getManualPathFlags(lead)
    const priority = priorityBucket(lead, campaign, manualPathFlags)

    increment(sourceCounts, sourceFamily)
    increment(fitCounts, campaign.label)
    increment(priorityCounts, priority)

    exportRows.push({
      lead_id: lead.id,
      created_at: lead.created_at,
      business_name: safeString(lead.business_name || lead.name),
      contact_name: safeString(lead.name),
      service_fit: campaign.label,
      priority,
      lead_score: Number(lead.lead_score || 0),
      source_family: sourceFamily,
      source: safeString(lead.source),
      city: safeString(lead.city),
      state: safeString(lead.state),
      website: safeString(lead.website),
      contact_form_urls: contactFormUrls.join(' | '),
      phone: safeString(lead.phone),
      manual_contact_paths: manualPathFlags.join('|'),
      source_url: safeString(lead.source_url),
      category: safeString(lead.category),
      lead_type: safeString(lead.lead_type),
      best_offer: safeString(lead.best_offer),
      outreach_angle: safeString(lead.outreach_angle),
      pain_signal: safeString(lead.pain_signal),
      review_reason: computeReviewReason(lead, contactFormUrls),
    })
  }

  exportRows.sort((left, right) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 }
    const priorityDelta = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0)
    if (priorityDelta !== 0) return priorityDelta
    return Number(right.lead_score || 0) - Number(left.lead_score || 0)
  })

  const dateStamp = new Date().toISOString().slice(0, 10)
  const outputDir = path.join(process.cwd(), 'artifacts', 'lead-exports')
  fs.mkdirSync(outputDir, { recursive: true })
  const csvPath = path.join(outputDir, `vestblock-no-email-manual-review-${dateStamp}.csv`)
  const summaryPath = path.join(outputDir, `vestblock-no-email-manual-review-${dateStamp}.summary.json`)

  const headers = [
    'lead_id',
    'created_at',
    'business_name',
    'contact_name',
    'service_fit',
    'priority',
    'lead_score',
    'source_family',
    'source',
    'city',
    'state',
    'website',
    'contact_form_urls',
    'phone',
    'manual_contact_paths',
    'source_url',
    'category',
    'lead_type',
    'best_offer',
    'outreach_angle',
    'pain_signal',
    'review_reason',
  ]

  const csv = [
    headers.join(','),
    ...exportRows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n')
  fs.writeFileSync(csvPath, `${csv}\n`)

  const summary = {
    generatedAt: new Date().toISOString(),
    windowStart: startedAt,
    windowDays: lookbackDays,
    rawLeadCount: rawLeads.length,
    eligibleLeadCount: filtered.length,
    exportedLeadCount: exportRows.length,
    duplicateCount: filtered.length - exportRows.length,
    mode: 'manual_offline_review_only',
    excluded: {
      statuses: Array.from(EXCLUDED_STATUSES),
      deliveryStatuses: Array.from(EXCLUDED_DELIVERY_STATUSES),
      usableEmailLeads: 'excluded',
      suppressedLeads: 'excluded',
    },
    countsByServiceFit: Object.fromEntries(Array.from(fitCounts.entries()).sort((a, b) => b[1] - a[1])),
    countsBySource: Object.fromEntries(Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])),
    countsByPriority: Object.fromEntries(Array.from(priorityCounts.entries()).sort((a, b) => b[1] - a[1])),
    csvPath,
  }
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(
    JSON.stringify(
      {
        ...summary,
        summaryPath,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  const payload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : typeof error === 'object' && error !== null
        ? error
        : { message: String(error) }
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
})
