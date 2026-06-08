#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dailyTarget = Number.parseInt(process.env.LEADS_TARGET_EMAILS_PER_DAY || '100', 10)
const monthlyRevenueTarget = Number.parseInt(process.env.VESTBLOCK_MONTHLY_REVENUE_TARGET || '100000', 10)
const now = Date.now()

function toLocalDateStamp(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hoursSince(value) {
  if (!value) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY
  return (now - timestamp) / (1000 * 60 * 60)
}

function withinHours(value, hours) {
  return hoursSince(value) <= hours
}

function withinDays(value, days) {
  return withinHours(value, days * 24)
}

function lower(value) {
  return String(value || '').toLowerCase()
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

const SERVICE_DEFINITIONS = [
  {
    key: 'dealvault_records',
    label: 'DealVault / Smart Contract Records',
    terms: [
      'dealvault',
      'smart contract',
      'milestone',
      'blockchain',
      'proof vault',
      'operator accountability',
      'private demo',
      'agreement record',
      'referral payout',
      'partner pay',
    ],
  },
  {
    key: 'funding_prep',
    label: 'Business Funding Prep',
    terms: [
      'business funding',
      'funding prep',
      'funding readiness',
      'capital',
      'credit builder',
      'credit repair',
      'grant',
      'gov contract',
      'business setup',
      'spanish funding',
      'funding strategy',
    ],
  },
  {
    key: 'visibility_expansion',
    label: 'AI / Search Visibility',
    terms: [
      'visibility',
      'search visibility',
      'seo',
      'aeo',
      'answer engine',
      'website upgrade',
      'website weakness',
      'authority',
      'citation',
      'entity seo',
    ],
  },
  {
    key: 'ai_receptionist',
    label: 'AI Receptionist',
    terms: [
      'ai receptionist',
      'appointment booking',
      'online booking',
      'missed call',
      'front desk',
      'lead capture',
      'phone agent',
      'voice agent',
      'booking system',
    ],
  },
]

function classifyServiceFromText(...values) {
  const haystack = values
    .map((value) => textFromUnknown(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const definition of SERVICE_DEFINITIONS) {
    if (definition.terms.some((term) => haystack.includes(term))) return definition.key
  }

  return null
}

function classifyLeadService(lead) {
  const bestOffer = lower(lead.best_offer)
  const marketSegment = lower(lead.market_segment)
  const category = lower(lead.category)
  const leadType = lower(lead.lead_type)

  if (bestOffer.includes('ai receptionist') || bestOffer.includes('appointment booking')) return 'ai_receptionist'
  if (bestOffer.includes('visibility') || bestOffer.includes('website upgrade') || marketSegment.includes('visibility')) {
    return 'visibility_expansion'
  }
  if (
    bestOffer.includes('business funding') ||
    bestOffer.includes('credit builder') ||
    bestOffer.includes('grant') ||
    bestOffer.includes('gov contract') ||
    bestOffer.includes('spanish funding') ||
    leadType.includes('business_funding')
  ) {
    return 'funding_prep'
  }

  return classifyServiceFromText(
    lead.best_offer,
    lead.category,
    lead.lead_type,
    lead.market_segment,
    lead.niche,
    lead.outreach_angle,
    lead.pain_signal,
    lead.notes,
    lead.metadata_json,
    lead.form_data,
  )
}

function classifyTaskService(task) {
  return classifyServiceFromText(task.title, task.task_type, task.entity_type)
}

function classifyPaymentService(payment) {
  return classifyServiceFromText(payment.product_type, payment.payment_method, payment.metadata_json)
}

function classifyContentService(asset) {
  return classifyServiceFromText(asset.service_key, asset.content_type)
}

function hasEmail(lead) {
  return Boolean(String(lead.email || '').trim())
}

function isUsableLead(lead) {
  return (
    hasEmail(lead) &&
    lead.email_valid !== false &&
    !['suppressed', 'unsubscribed', 'bounced'].includes(lower(lead.delivery_status)) &&
    Number(lead.bounce_risk_score || 0) <= 60
  )
}

function isDemoLikeRecord(value) {
  return /\b(test|demo|smoke|ui flow|shell insert)\b/i.test(String(value || ''))
}

function isOffPlatformOutreachEligible(lead) {
  const status = lower(lead.status)
  const outreachStatus = lower(lead.outreach_status)
  const offerSignal = lower(`${lead.best_offer || ''} ${lead.category || ''} ${lead.niche || ''} ${lead.market_segment || ''}`)

  return (
    hasEmail(lead) &&
    ['scored', 'outreach_ready'].includes(status) &&
    ['not_started', 'failed', ''].includes(outreachStatus) &&
    !['suppressed', 'unsubscribed'].includes(lower(lead.delivery_status)) &&
    Number(lead.bounce_risk_score || 0) <= 60 &&
    /dealvault|visibility|receptionist|funding|business|website|spanish|grant|real estate/.test(offerSignal)
  )
}

function statusFor(actual, target) {
  if (actual >= target) return 'green'
  if (actual >= Math.max(1, Math.round(target * 0.5))) return 'yellow'
  return 'red'
}

function grade(metrics) {
  const red = metrics.filter((metric) => metric.status === 'red').length
  const yellow = metrics.filter((metric) => metric.status === 'yellow').length
  if (red >= 4) return 'C'
  if (red >= 2) return 'B-'
  if (red === 1 || yellow >= 3) return 'B'
  if (yellow >= 1) return 'A-'
  return 'A'
}

function countBy(rows, keyFn, limit = 6) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function safeCountCsvRows(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw) return 0
    const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    if (!text) return 0
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length <= 1) return 0
    return lines.length - 1
  } catch {
    return 0
  }
}

function safeReadJsonl(filePath, { maxLines = 5000 } = {}) {
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    if (!text.trim()) return []
    const lines = text.trim().split('\n')
    const start = Math.max(0, lines.length - maxLines)
    return lines
      .slice(start)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function findLatestOutreachV4RunDir() {
  const baseDir = path.join(process.cwd(), 'artifacts', 'outreach-v4')
  try {
    const dirents = fs.readdirSync(baseDir, { withFileTypes: true })
    const candidates = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => /^\d{4}-\d{2}-\d{2}/.test(name))
      .map((name) => {
        const dirPath = path.join(baseDir, name)
        const sendResultsPath = path.join(dirPath, 'send-results.json')
        const approvedDraftsPath = path.join(dirPath, 'approved-drafts.json')
        const draftsPath = path.join(dirPath, 'drafts.json')
        const scorecardPath = path.join(dirPath, 'outreach-v4-scorecard.json')
        const acceptedLeadsPath = path.join(dirPath, 'accepted-leads.csv')
        const quarantinePath = path.join(dirPath, 'quarantine.csv')

        const hasSendResults = fs.existsSync(sendResultsPath)
        const hasApprovedDrafts = fs.existsSync(approvedDraftsPath)
        const hasDrafts = fs.existsSync(draftsPath)
        const hasScorecard = fs.existsSync(scorecardPath)
        const hasAcceptedLeads = fs.existsSync(acceptedLeadsPath)
        const hasQuarantine = fs.existsSync(quarantinePath)

        const tsCandidates = []
        for (const candidatePath of [
          sendResultsPath,
          approvedDraftsPath,
          draftsPath,
          scorecardPath,
          acceptedLeadsPath,
          quarantinePath,
        ]) {
          try {
            if (!fs.existsSync(candidatePath)) continue
            tsCandidates.push(fs.statSync(candidatePath).mtimeMs)
          } catch {
            // ignore
          }
        }
        const updatedAt = tsCandidates.length ? Math.max(...tsCandidates) : 0

        return {
          name,
          dirPath,
          updatedAt,
          hasSendResults,
          hasApprovedDrafts,
          hasDrafts,
          hasScorecard,
          hasAcceptedLeads,
          hasQuarantine,
        }
      })
      .filter((candidate) => candidate.updatedAt > 0)

    if (!candidates.length) return null

    const today = toLocalDateStamp()
    const todaysRuns = candidates.filter((candidate) => candidate.name.startsWith(today))
    const ranked = (todaysRuns.length ? todaysRuns : candidates).sort((left, right) => {
      const leftPriority =
        (left.hasSendResults ? 4 : 0) + (left.hasApprovedDrafts ? 2 : 0) + (left.hasDrafts ? 1 : 0)
      const rightPriority =
        (right.hasSendResults ? 4 : 0) + (right.hasApprovedDrafts ? 2 : 0) + (right.hasDrafts ? 1 : 0)
      if (rightPriority !== leftPriority) return rightPriority - leftPriority
      return right.updatedAt - left.updatedAt
    })
    return ranked[0] || null
  } catch {
    return null
  }
}

function loadOutreachV4Summary() {
  const run = findLatestOutreachV4RunDir()
  const baseDir = path.join(process.cwd(), 'artifacts', 'outreach-v4')
  const ledgerPath = path.join(baseDir, 'sent-ledger.jsonl')

  if (!run) {
    return {
      ok: false,
      runDir: null,
      ledgerPath: fs.existsSync(ledgerPath) ? ledgerPath : null,
      counts: {
        quarantined: 0,
        accepted: 0,
        approvedDrafts: 0,
        sentInRun: 0,
        sentLedger24h: 0,
      },
    }
  }

  const approvedDraftsPath = path.join(run.dirPath, 'approved-drafts.json')
  const draftsPath = path.join(run.dirPath, 'drafts.json')
  const sendResultsPath = path.join(run.dirPath, 'send-results.json')
  const acceptedLeadsPath = path.join(run.dirPath, 'accepted-leads.csv')
  const quarantinePath = path.join(run.dirPath, 'quarantine.csv')

  const approvedDraftsJson = fs.existsSync(approvedDraftsPath) ? safeReadJson(approvedDraftsPath) : null
  const approvedDraftCount = Array.isArray(approvedDraftsJson?.approvedDrafts)
    ? approvedDraftsJson.approvedDrafts.length
    : Array.isArray(approvedDraftsJson)
      ? approvedDraftsJson.length
      : 0

  const draftsJson = fs.existsSync(draftsPath) ? safeReadJson(draftsPath) : null
  const draftCount = Array.isArray(draftsJson?.drafts)
    ? draftsJson.drafts.length
    : Array.isArray(draftsJson)
      ? draftsJson.length
      : 0

  const sendResultsJson = fs.existsSync(sendResultsPath) ? safeReadJson(sendResultsPath) : null
  const sentValue = sendResultsJson?.sent ?? sendResultsJson?.summary?.sent ?? 0
  const sendResultsCount = Array.isArray(sentValue) ? sentValue.length : Number(sentValue || 0) || 0

  const ledgerEvents = safeReadJsonl(ledgerPath)
  const sentLedger24h = ledgerEvents.filter((event) => {
    const status = lower(event.status || 'sent')
    const channel = lower(event.channel || event.transport || event.provider || 'email')
    const timestamp = event.sentAt || event.createdAt || event.created_at || event.timestamp
    const isEmailish = channel.includes('gmail') || channel.includes('email') || channel.includes('smtp') || channel === ''
    return Boolean(timestamp) && isEmailish && status === 'sent' && withinHours(timestamp, 24)
  }).length

  return {
    ok: true,
    runDir: run.dirPath,
    runName: run.name,
    ledgerPath: fs.existsSync(ledgerPath) ? ledgerPath : null,
    paths: {
      approvedDraftsPath: fs.existsSync(approvedDraftsPath) ? approvedDraftsPath : null,
      draftsPath: fs.existsSync(draftsPath) ? draftsPath : null,
      sendResultsPath: fs.existsSync(sendResultsPath) ? sendResultsPath : null,
      acceptedLeadsPath: fs.existsSync(acceptedLeadsPath) ? acceptedLeadsPath : null,
      quarantinePath: fs.existsSync(quarantinePath) ? quarantinePath : null,
    },
    counts: {
      quarantined: safeCountCsvRows(quarantinePath),
      accepted: safeCountCsvRows(acceptedLeadsPath),
      approvedDrafts: approvedDraftCount,
      drafts: draftCount,
      sentInRun: sendResultsCount,
      sentLedger24h,
    },
  }
}

async function safeRows(label, buildQuery, { pageSize = 1000, maxRows = 10000 } = {}) {
  const rows = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1)
    const { data, error } = await buildQuery().range(from, to)
    if (error) return { rows: [], issue: { source: label, message: error.message || 'Query unavailable.' } }

    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return { rows, issue: null }
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log(JSON.stringify({ ok: false, error: 'Missing Supabase admin env vars.' }, null, 2))
    process.exitCode = 1
    return
  }

  const outreachV4 = loadOutreachV4Summary()

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const results = await Promise.all([
    safeRows(
      'leads',
      () =>
        admin
        .from('leads')
        .select('id,email,email_valid,status,outreach_status,source,city,state,best_offer,lead_score,lead_type,category,niche,market_segment,outreach_angle,pain_signal,notes,bounce_risk_score,delivery_status,suppression_reason,contact_info,metadata_json,form_data,website_audit_json,created_at,updated_at,last_contacted_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 5000 }
    ),
    safeRows(
      'outreach_messages',
      () =>
        admin
        .from('outreach_messages')
        .select('id,status,channel,approved_at,sent_at,created_at,updated_at')
        .order('updated_at', { ascending: false })
    ,
      { maxRows: 10000 }
    ),
    safeRows(
      'outreach_send_events',
      () =>
        admin
        .from('outreach_send_events')
        .select('id,lead_id,channel,status,created_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 10000 }
    ),
    safeRows(
      'admin_tasks',
      () =>
        admin
        .from('admin_tasks')
        .select('id,title,task_type,entity_type,status,priority,due_at,created_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 1000 }
    ),
    safeRows(
      'content_assets',
      () =>
        admin
        .from('content_assets')
        .select('id,status,content_type,service_key,indexed_status,published_at,created_at,updated_at')
        .order('updated_at', { ascending: false })
    ,
      { maxRows: 2000 }
    ),
    safeRows(
      'funding_strategy_requests',
      () =>
        admin
        .from('funding_strategy_requests')
        .select('id,status,payment_status,readiness_score,paid_at,created_at,updated_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 2000 }
    ),
    safeRows(
      'payments',
      () => admin.from('payments').select('amount,status,product_type,payment_method,paypal_transaction_id,metadata_json,created_at,updated_at'),
      { maxRows: 2000 }
    ),
    safeRows(
      'funding_payments',
      () => admin.from('funding_payments').select('amount_paid,status,payment_plan,created_at,updated_at'),
      { maxRows: 2000 }
    ),
    safeRows(
      'real_estate_deals',
      () =>
        admin
        .from('real_estate_deals')
        .select('id,deal_type,status,title,expected_fee,created_at,updated_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 2000 }
    ),
    safeRows(
      'dealvault_blockchain_transactions',
      () =>
        admin
        .from('dealvault_blockchain_transactions')
        .select('id,related_table,related_id,method_name,status,created_at,confirmed_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 3000 }
    ),
    safeRows(
      'dealvault_milestone_projects',
      () =>
        admin
        .from('dealvault_milestone_projects')
        .select('id,real_estate_deal_id,status,project_type,created_at,updated_at')
        .order('created_at', { ascending: false })
    ,
      { maxRows: 2000 }
    ),
  ])

  const issues = results.map((result) => result.issue).filter(Boolean)
  const liveDataReachable = issues.length === 0
  const [
    leads,
    outreachMessages,
    outreachSendEvents,
    adminTasks,
    contentAssets,
    fundingRequests,
    payments,
    fundingPayments,
    realEstateDeals,
    dealvaultTransactions,
    dealvaultMilestoneProjects,
  ] =
    results.map((result) => result.rows)

  const serviceStats = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [
      definition.key,
      {
        key: definition.key,
        label: definition.label,
        newLeads24h: 0,
        newLeads7d: 0,
        usableLeads: 0,
        sent24h: 0,
        sent30d: 0,
        replyLike7d: 0,
        bookedOrWon7d: 0,
        openFollowupTasks: 0,
        urgentFollowupTasks: 0,
        published7d: 0,
        checkoutSignals30d: 0,
        paidSignals30d: 0,
        dealSignals30d: 0,
        chainSignals30d: 0,
        activeRecords: 0,
      },
    ])
  )

  for (const lead of leads) {
    const serviceKey = classifyLeadService(lead)
    if (!serviceKey || !serviceStats[serviceKey]) continue
    const service = serviceStats[serviceKey]
    if (withinHours(lead.created_at, 24)) service.newLeads24h += 1
    if (withinDays(lead.created_at, 7)) service.newLeads7d += 1
    if (isUsableLead(lead)) service.usableLeads += 1
    if (
      ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) &&
      withinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
    ) {
      service.replyLike7d += 1
    }
    if (
      (['qualified', 'closed_won'].includes(lower(lead.status)) || lower(lead.delivery_status) === 'booked') &&
      withinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
    ) {
      service.bookedOrWon7d += 1
    }
  }

  const leadById = new Map(leads.map((lead) => [lead.id, lead]))
  for (const event of outreachSendEvents) {
    const lead = leadById.get(event.lead_id)
    const serviceKey = lead ? classifyLeadService(lead) : null
    if (!serviceKey || !serviceStats[serviceKey]) continue
    if (lower(event.channel) !== 'email' || lower(event.status) !== 'sent') continue
    if (withinHours(event.created_at, 24)) serviceStats[serviceKey].sent24h += 1
    if (withinDays(event.created_at, 30)) serviceStats[serviceKey].sent30d += 1
  }

  for (const task of adminTasks) {
    const serviceKey = classifyTaskService(task)
    if (!serviceKey || !serviceStats[serviceKey]) continue
    if (!['done', 'completed', 'closed', 'dismissed'].includes(lower(task.status))) {
      serviceStats[serviceKey].openFollowupTasks += 1
      if (['urgent', 'high'].includes(lower(task.priority))) {
        serviceStats[serviceKey].urgentFollowupTasks += 1
      }
    }
  }

  for (const asset of contentAssets) {
    const serviceKey = classifyContentService(asset)
    if (!serviceKey || !serviceStats[serviceKey]) continue
    if (lower(asset.status) === 'published' && withinDays(asset.published_at || asset.updated_at || asset.created_at, 7)) {
      serviceStats[serviceKey].published7d += 1
    }
  }

  for (const request of fundingRequests) {
    const service = serviceStats.funding_prep
    if (lower(request.payment_status) === 'pending' || lower(request.status) === 'awaiting_payment') {
      if (withinDays(request.updated_at || request.created_at, 30)) service.checkoutSignals30d += 1
    }
    if (
      (lower(request.payment_status) === 'paid' || ['strategy_ready', 'closed'].includes(lower(request.status))) &&
      withinDays(request.paid_at || request.updated_at || request.created_at, 30)
    ) {
      service.paidSignals30d += 1
    }
  }

  for (const payment of payments) {
    const serviceKey = classifyPaymentService(payment) || 'funding_prep'
    if (!serviceStats[serviceKey] || !withinDays(payment.created_at || payment.updated_at, 30)) continue
    if (['pending'].includes(lower(payment.status))) serviceStats[serviceKey].checkoutSignals30d += 1
    if (['completed', 'paid', 'succeeded'].includes(lower(payment.status))) serviceStats[serviceKey].paidSignals30d += 1
  }

  for (const payment of fundingPayments) {
    if (!withinDays(payment.created_at || payment.updated_at, 30)) continue
    if (['paid', 'completed'].includes(lower(payment.status))) serviceStats.funding_prep.paidSignals30d += 1
  }

  const productionDealIds = new Set(
    realEstateDeals
      .filter((deal) => !isDemoLikeRecord(deal.title) && !isDemoLikeRecord(deal.status))
      .map((deal) => deal.id)
  )
  const productionMilestoneProjects = dealvaultMilestoneProjects.filter(
    (project) => !project.real_estate_deal_id || productionDealIds.has(project.real_estate_deal_id)
  )
  const productionChainTransactions = dealvaultTransactions.filter((tx) => {
    if (tx.related_table !== 'real_estate_deals') return false
    if (!tx.related_id) return false
    return productionDealIds.has(tx.related_id)
  })

  serviceStats.dealvault_records.activeRecords = productionDealIds.size + productionMilestoneProjects.length
  for (const deal of realEstateDeals) {
    if (!productionDealIds.has(deal.id)) continue
    if (withinDays(deal.updated_at || deal.created_at, 30)) serviceStats.dealvault_records.dealSignals30d += 1
  }
  for (const tx of productionChainTransactions) {
    if (
      withinDays(tx.confirmed_at || tx.created_at, 30) &&
      ['submitted', 'confirmed', 'success', 'succeeded'].includes(lower(tx.status))
    ) {
      serviceStats.dealvault_records.chainSignals30d += 1
    }
  }

  const leadEmails24h = outreachSendEvents.filter(
    (event) => lower(event.status) === 'sent' && lower(event.channel) === 'email' && withinHours(event.created_at, 24)
  ).length
  const sendReady = outreachMessages.filter(
    (message) => lower(message.channel) === 'email' && ['approved', 'queued'].includes(lower(message.status))
  ).length
  const needsReview = outreachMessages.filter(
    (message) => lower(message.channel) === 'email' && lower(message.status) === 'needs_review'
  ).length
  const freshEmailReadyLeads = leads.filter(
    (lead) =>
      hasEmail(lead) &&
      ['scored', 'outreach_ready'].includes(lower(lead.status)) &&
      ['not_started', 'failed', ''].includes(lower(lead.outreach_status))
  ).length
  const freshProductionEligibleEmailLeads = leads.filter(
    (lead) => isOffPlatformOutreachEligible(lead)
  ).length
  const replySignals7d = leads.filter(
    (lead) =>
      ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) &&
      withinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
  ).length
  const completedRevenue =
    payments
      .filter((payment) => ['completed', 'paid', 'succeeded'].includes(lower(payment.status)) && withinDays(payment.created_at || payment.updated_at, 30))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0) +
    fundingPayments
      .filter((payment) => ['paid', 'completed'].includes(lower(payment.status)) && withinDays(payment.created_at || payment.updated_at, 30))
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0)
  const published7d = contentAssets.filter(
    (asset) => lower(asset.status) === 'published' && withinDays(asset.published_at || asset.updated_at || asset.created_at, 7)
  ).length
  const openTasks = adminTasks.filter((task) => !['done', 'completed', 'closed'].includes(lower(task.status)))
  const hotFundingRequests = fundingRequests.filter(
    (request) =>
      ['submitted', 'paid', 'in_review', 'strategy_ready'].includes(lower(request.status)) &&
      Number(request.readiness_score || 0) >= 70
  ).length

  const metrics = [
    { key: 'revenue30d', actual: completedRevenue, target: monthlyRevenueTarget, status: completedRevenue > 0 ? 'yellow' : 'red' },
    {
      key: 'leadEmails24h',
      actual: outreachV4.ok && outreachV4.ledgerPath ? outreachV4.counts.sentLedger24h : leadEmails24h,
      target: dailyTarget,
      status: statusFor(outreachV4.ok && outreachV4.ledgerPath ? outreachV4.counts.sentLedger24h : leadEmails24h, dailyTarget),
    },
    {
      key: 'sendReady',
      actual: outreachV4.ok && outreachV4.paths?.approvedDraftsPath ? outreachV4.counts.approvedDrafts : sendReady,
      target: 25,
      status:
        (outreachV4.ok && outreachV4.paths?.approvedDraftsPath ? outreachV4.counts.approvedDrafts : sendReady) >= 25
          ? 'green'
          : (outreachV4.ok && outreachV4.paths?.approvedDraftsPath ? outreachV4.counts.approvedDrafts : sendReady) > 0
            ? 'yellow'
            : 'red',
    },
    { key: 'freshProductionEligibleEmailLeads', actual: freshProductionEligibleEmailLeads, target: 25, status: statusFor(freshProductionEligibleEmailLeads, 25) },
    { key: 'replySignals7d', actual: replySignals7d, target: 7, status: statusFor(replySignals7d, 7) },
    { key: 'publishedContent7d', actual: published7d, target: 5, status: statusFor(published7d, 5) },
  ]

  const services = Object.values(serviceStats).map((service) => {
    const conversionNumerator =
      service.replyLike7d + service.bookedOrWon7d + service.paidSignals30d + service.dealSignals30d + service.chainSignals30d
    const conversionDenominator = Math.max(1, service.sent30d + service.usableLeads)
    const conversionRate = conversionNumerator / conversionDenominator
    const momentumScore =
      service.newLeads7d * 2 +
      service.usableLeads +
      service.sent24h * 3 +
      service.sent30d +
      service.replyLike7d * 5 +
      service.bookedOrWon7d * 8 +
      service.openFollowupTasks +
      service.published7d * 2 +
      service.checkoutSignals30d * 4 +
      service.paidSignals30d * 10 +
      service.dealSignals30d * 6 +
      service.chainSignals30d * 4 +
      service.activeRecords

    return {
      ...service,
      conversionRate: Number(conversionRate.toFixed(3)),
      momentumScore,
    }
  })

  const rankedByMomentum = [...services].sort((left, right) => right.momentumScore - left.momentumScore)
  const rankedByConversion = [...services].sort((left, right) => left.conversionRate - right.conversionRate || left.momentumScore - right.momentumScore)
  const topServiceByMomentum = rankedByMomentum[0] || null
  const weakestServiceByConversion = rankedByConversion[0] || null

  const nextActions = liveDataReachable
    ? [
        outreachV4.ok && outreachV4.paths?.approvedDraftsPath && outreachV4.counts.approvedDrafts === 0
          ? 'V4 has 0 approved drafts in the latest run. Run V4 sourcing + enrichment, then approve compliant drafts.'
          : null,
        !outreachV4.ok && sendReady === 0
          ? 'Qualified send-ready pool is empty. Run source refill, scoring, enrichment, and draft generation.'
          : null,
        outreachV4.ok && outreachV4.paths?.sendResultsPath && outreachV4.counts.sentInRun === 0
          ? 'V4 send-results show 0 sent in the latest run. Confirm approvals and run sender with a small limit.'
          : null,
        !outreachV4.ok && needsReview > 0 && freshProductionEligibleEmailLeads > 0
          ? `Review ${Math.min(25, needsReview)} legacy outreach drafts before approving sends.`
          : null,
        replySignals7d === 0 ? 'Triage Gmail replies/bounces and tighten follow-up tracking.' : null,
        published7d < 5 ? 'Publish or refresh proof-backed AEO/content assets.' : null,
      ].filter(Boolean)
    : ['Live Supabase reads are unavailable in this environment. Re-run from a networked runner before treating any zero counts as real.']

  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        liveDataReachable,
        grade: grade(metrics),
        metrics,
        outreach: {
          dailyTarget,
          leadEmails24h: outreachV4.ok && outreachV4.ledgerPath ? outreachV4.counts.sentLedger24h : leadEmails24h,
          sendReady: outreachV4.ok && outreachV4.paths?.approvedDraftsPath ? outreachV4.counts.approvedDrafts : sendReady,
          needsReview,
          freshEmailReadyLeads,
          freshProductionEligibleEmailLeads,
          usableEmailLeads: leads.filter(hasEmail).length,
          replySignals7d,
          topCities: countBy(leads, (lead) => (lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : null)),
          topSources: countBy(leads, (lead) => lead.source),
          topOffers: countBy(leads, (lead) => lead.best_offer),
        },
        outreachV4: outreachV4.ok
          ? {
              runName: outreachV4.runName,
              runDir: outreachV4.runDir,
              counts: outreachV4.counts,
              paths: outreachV4.paths,
              ledgerPath: outreachV4.ledgerPath,
            }
          : { ok: false },
        legacyOutreach: {
          leadEmails24h,
          sendReady,
          needsReview,
        },
        revenue: {
          trailing30Revenue: completedRevenue,
          monthlyRevenueTarget,
          revenueGap: Math.max(0, monthlyRevenueTarget - completedRevenue),
          hotFundingRequests,
        },
        operations: {
          openTasks: openTasks.length,
          urgentTasks: openTasks.filter((task) => ['urgent', 'high'].includes(lower(task.priority))).length,
        },
        serviceBreakdown: services,
        topServiceByMomentum,
        weakestServiceByConversion,
        dealvault: {
          totalDealRecords: realEstateDeals.length,
          productionDealRecords: productionDealIds.size,
          totalMilestoneProjects: dealvaultMilestoneProjects.length,
          productionMilestoneProjects: productionMilestoneProjects.length,
          totalBlockchainTransactions: dealvaultTransactions.length,
          productionBlockchainTransactions: productionChainTransactions.length,
          recentDealSignals30d: serviceStats.dealvault_records.dealSignals30d,
          recentChainSignals30d: serviceStats.dealvault_records.chainSignals30d,
          failedChainSignals30d: productionChainTransactions.filter(
            (tx) => lower(tx.status) === 'failed' && withinDays(tx.created_at || tx.confirmed_at, 30)
          ).length,
        },
        bookedOrFollowup: {
          bookedOrWon7d: services.reduce((sum, service) => sum + service.bookedOrWon7d, 0),
          openRevenueFollowupTasks: services.reduce((sum, service) => sum + service.openFollowupTasks, 0),
          urgentRevenueFollowupTasks: services.reduce((sum, service) => sum + service.urgentFollowupTasks, 0),
        },
        paymentsActivity: {
          checkoutSignals30d: services.reduce((sum, service) => sum + service.checkoutSignals30d, 0),
          paidSignals30d: services.reduce((sum, service) => sum + service.paidSignals30d, 0),
          completedRevenue,
        },
        nextActions,
        issues,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
