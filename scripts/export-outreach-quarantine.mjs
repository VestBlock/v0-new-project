import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { formatScriptError, getEmailQualityIssue, isUsableContactEmail, normalizeEmailAddress } from './shared-email-quality.mjs'

const BAD_DELIVERY_STATUSES = new Set(['suppressed', 'bounced', 'failed'])
const CLOSED_STATUSES = new Set(['closed', 'closed_won', 'closed_lost', 'do_not_contact'])
const SOURCE_FAMILY_SEPARATOR = '__'

function envInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1]
  }
  return fallback
}

function getDateWindowStart(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function safeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getSourceFamily(sourceKey) {
  const normalized = String(sourceKey || '').trim()
  if (!normalized) return 'unknown'
  return normalized.split(SOURCE_FAMILY_SEPARATOR)[0] || normalized
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D+/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

function maskPhone(value) {
  const digits = normalizePhone(value)
  if (digits.length < 4) return ''
  return `***-***-${digits.slice(-4)}`
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

function getNestedObject(value, key) {
  return value && typeof value === 'object' && typeof value[key] === 'object' && value[key]
    ? value[key]
    : null
}

function getEmailEnrichment(lead) {
  return (
    getNestedObject(lead.automation_flags_json, 'emailEnrichment') ||
    getNestedObject(lead.metadata_json, 'emailEnrichment') ||
    getNestedObject(lead.contact_info, 'publicEmailEnrichment')
  )
}

function getContactFormUrls(lead) {
  const fromContact = Array.isArray(lead.contact_info?.contactFormUrls) ? lead.contact_info.contactFormUrls : []
  const fromEnrichment = Array.isArray(getEmailEnrichment(lead)?.contactFormUrls)
    ? getEmailEnrichment(lead).contactFormUrls
    : []
  return Array.from(new Set([...fromContact, ...fromEnrichment].filter((item) => typeof item === 'string' && item.trim())))
}

function hasManualContactPath(lead) {
  return Boolean(safeString(lead.website) || safeString(lead.phone) || safeString(lead.source_url) || getContactFormUrls(lead).length)
}

function classifyQuarantineReason(lead) {
  const email = normalizeEmailAddress(lead.email)
  const emailIssue = getEmailQualityIssue(email)
  const enrichment = getEmailEnrichment(lead)
  const enrichmentStatus = String(enrichment?.status || '').toLowerCase()
  const enrichmentConfidence = String(enrichment?.confidence || '').toLowerCase()
  const deliveryStatus = String(lead.delivery_status || '').toLowerCase()
  const suppressionReason = safeString(lead.suppression_reason)

  if (suppressionReason) {
    return {
      reason: 'suppressed_email',
      detail: suppressionReason,
      recommendedNextStep: 'Keep out of automated outreach. Research manually only if there is a clear business reason.',
    }
  }

  if (BAD_DELIVERY_STATUSES.has(deliveryStatus)) {
    return {
      reason: 'bad_delivery_history',
      detail: deliveryStatus,
      recommendedNextStep: 'Do not retry the same address. Research a different verified business email or contact form.',
    }
  }

  if (email && (lead.email_valid === false || emailIssue)) {
    return {
      reason: 'invalid_or_risky_email',
      detail: lead.email_valid === false ? 'email_valid_false' : emailIssue,
      recommendedNextStep: 'Research a replacement email manually before returning to automation.',
    }
  }

  if (!email && ['not_found', 'skipped', 'none'].includes(enrichmentStatus || enrichmentConfidence)) {
    return {
      reason: 'enrichment_exhausted_no_email',
      detail: enrichment?.note || enrichmentStatus || enrichmentConfidence || 'no_email_after_enrichment',
      recommendedNextStep: 'Use contact form, phone, or manual research. Do not block the daily scrape pool.',
    }
  }

  if (!email) {
    return {
      reason: 'missing_email_offline_research',
      detail: hasManualContactPath(lead) ? 'manual_contact_path_available' : 'no_contact_path',
      recommendedNextStep: hasManualContactPath(lead)
        ? 'Review manually from sheet; use contact form or phone if high fit.'
        : 'Keep archived unless a better source rediscovers this business.',
    }
  }

  return null
}

function dedupeKey(row) {
  const business = safeString(row.business_name || row.name).toLowerCase()
  const city = safeString(row.city).toLowerCase()
  const state = safeString(row.state).toLowerCase()
  const host = getHostname(row.website)
  const phone = normalizePhone(row.phone)
  const email = normalizeEmailAddress(row.email)

  if (email) return `email:${email}`
  if (business && host) return `biz-host:${business}:${host}`
  if (business && phone) return `biz-phone:${business}:${phone}`
  if (host) return `host:${host}`
  if (business) return `biz-place:${business}:${city}:${state}`
  return `fallback:${safeString(row.source).toLowerCase()}:${city}:${state}:${row.id}`
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function compareRows(left, right) {
  const scoreDelta = Number(right.lead_score || 0) - Number(left.lead_score || 0)
  if (scoreDelta !== 0) return scoreDelta
  return Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials in environment.')
  }

  const lookbackDays = envInt('OUTREACH_QUARANTINE_EXPORT_DAYS', 90)
  const leadLimit = envInt('OUTREACH_QUARANTINE_EXPORT_LIMIT', 10000)
  const dateStamp = getArgValue('--date', new Date().toISOString().slice(0, 10))
  const apply = hasFlag('--apply')
  const startedAt = getDateWindowStart(lookbackDays)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin
    .from('leads')
    .select(
      'id,created_at,updated_at,status,outreach_status,source,source_url,category,lead_type,name,business_name,phone,email,email_valid,website,city,state,zip,best_offer,lead_score,delivery_status,suppression_reason,contact_info,form_data,metadata_json,automation_flags_json,website_audit_json,pain_signal,outreach_angle,market_segment,niche'
    )
    .gte('created_at', startedAt)
    .order('lead_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(leadLimit)

  if (error) throw error

  const rawLeads = data || []
  const candidates = []
  for (const lead of rawLeads) {
    if (CLOSED_STATUSES.has(String(lead.status || '').toLowerCase())) continue
    if (isUsableContactEmail(lead.email) && lead.email_valid !== false && !BAD_DELIVERY_STATUSES.has(String(lead.delivery_status || '').toLowerCase()) && !lead.suppression_reason) continue
    const classification = classifyQuarantineReason(lead)
    if (!classification) continue
    candidates.push({ ...lead, ...classification })
  }

  const deduped = new Map()
  for (const lead of candidates.sort(compareRows)) {
    const key = dedupeKey(lead)
    if (!deduped.has(key)) deduped.set(key, lead)
  }

  const reasonCounts = new Map()
  const sourceCounts = new Map()
  const serviceCounts = new Map()
  const rows = Array.from(deduped.values()).sort(compareRows).map((lead) => {
    increment(reasonCounts, lead.reason)
    increment(sourceCounts, getSourceFamily(lead.source))
    increment(serviceCounts, safeString(lead.best_offer) || safeString(lead.category) || 'unknown')

    const enrichment = getEmailEnrichment(lead)
    return {
      lead_id: lead.id,
      created_at: lead.created_at,
      quarantine_reason: lead.reason,
      quarantine_detail: lead.detail,
      recommended_next_step: lead.recommendedNextStep,
      business_name: safeString(lead.business_name || lead.name),
      service_fit: safeString(lead.best_offer),
      lead_score: Number(lead.lead_score || 0),
      source_family: getSourceFamily(lead.source),
      source: safeString(lead.source),
      city: safeString(lead.city),
      state: safeString(lead.state),
      website: safeString(lead.website),
      website_host: getHostname(lead.website),
      risky_or_missing_email: normalizeEmailAddress(lead.email),
      email_quality_issue: getEmailQualityIssue(lead.email) || '',
      email_valid: String(lead.email_valid ?? ''),
      delivery_status: safeString(lead.delivery_status),
      suppression_reason: safeString(lead.suppression_reason),
      enrichment_status: safeString(enrichment?.status),
      enrichment_confidence: safeString(enrichment?.confidence),
      enrichment_checked_at: safeString(enrichment?.checkedAt),
      contact_form_urls: getContactFormUrls(lead).join(' | '),
      phone_hint: maskPhone(lead.phone),
      source_url: safeString(lead.source_url),
      outreach_status: safeString(lead.outreach_status),
      current_status: safeString(lead.status),
      review_mode: 'offline_quarantine_research',
    }
  })

  const outputDir = path.join(process.cwd(), 'artifacts', 'lead-exports')
  fs.mkdirSync(outputDir, { recursive: true })
  const csvPath = path.join(outputDir, `vestblock-outreach-quarantine-${dateStamp}.csv`)
  const summaryPath = path.join(outputDir, `vestblock-outreach-quarantine-${dateStamp}.summary.json`)

  const headers = [
    'lead_id',
    'created_at',
    'quarantine_reason',
    'quarantine_detail',
    'recommended_next_step',
    'business_name',
    'service_fit',
    'lead_score',
    'source_family',
    'source',
    'city',
    'state',
    'website',
    'website_host',
    'risky_or_missing_email',
    'email_quality_issue',
    'email_valid',
    'delivery_status',
    'suppression_reason',
    'enrichment_status',
    'enrichment_confidence',
    'enrichment_checked_at',
    'contact_form_urls',
    'phone_hint',
    'source_url',
    'outreach_status',
    'current_status',
    'review_mode',
  ]

  fs.writeFileSync(csvPath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n')}\n`)

  if (apply && rows.length) {
    const now = new Date().toISOString()
    const ids = rows.map((row) => row.lead_id)
    const { error: updateError } = await admin
      .from('leads')
      .update({
        status: 'disqualified',
        outreach_status: 'failed',
        suppression_reason: 'offline_outreach_quarantine_export',
        updated_at: now,
      })
      .in('id', ids)

    if (updateError) throw updateError

    const { error: messageError } = await admin
      .from('outreach_messages')
      .update({
        status: 'failed',
        send_error: 'Lead moved to offline outreach quarantine export.',
        updated_at: now,
      })
      .in('lead_id', ids)
      .eq('channel', 'email')
      .in('status', ['approved', 'queued', 'needs_review', 'failed'])

    if (messageError) throw messageError
  }

  const summary = {
    ok: true,
    apply,
    generatedAt: new Date().toISOString(),
    windowStart: startedAt,
    windowDays: lookbackDays,
    rawLeadCount: rawLeads.length,
    quarantineCandidateCount: candidates.length,
    exportedLeadCount: rows.length,
    duplicateCount: candidates.length - rows.length,
    mode: apply ? 'offline_export_and_db_quarantine' : 'offline_export_only',
    csvPath,
    summaryPath,
    countsByReason: Object.fromEntries(Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])),
    countsBySource: Object.fromEntries(Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])),
    countsByServiceFit: Object.fromEntries(Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1])),
    note: apply
      ? 'Rows were exported and marked disqualified/failed so active outreach can focus on fresh qualified prospects.'
      : 'Rows were exported only. Re-run with --apply to remove these records from active outreach counts.',
  }

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  const formattedError = formatScriptError(error)
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: formattedError,
        hint: formattedError.includes('fetch failed')
          ? 'Supabase could not be reached from this environment. Re-run where outbound network access to the project is available.'
          : undefined,
      },
      null,
      2
    )
  )
  process.exit(1)
})
