import fs from 'node:fs'
import path from 'node:path'

import { buildMarketRotationPlan, persistMarketRotationHistory } from '../lib/leads/outreach-v4/market-rotation.mjs'
import { runVerticalScraperDryRun } from '../lib/leads/outreach-v4/scrapers.mjs'
import { runRealSourceAdapterV4 } from '../lib/leads/outreach-v4/source-adapters.mjs'
import { enrichMissingEmailsV4 } from '../lib/leads/outreach-v4/enrichment.mjs'
import { scoreLeadV4 } from '../lib/leads/outreach-v4/scoring.mjs'
import { dedupeAndQuarantineV4 } from '../lib/leads/outreach-v4/dedupe-quarantine.mjs'
import { loadSentLedgerSummary } from '../lib/leads/outreach-v4/sent-ledger.mjs'
import { draftOutreachV4 } from '../lib/leads/outreach-v4/templates.mjs'
import { buildOutreachV4Scorecard } from '../lib/leads/outreach-v4/scorecard.mjs'
import { safeJson, toCsv } from '../lib/leads/outreach-v4/utils.mjs'

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(getArgValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function listArg(name, fallback = []) {
  const value = getArgValue(name, '')
  if (!value) return fallback
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function skippedRealSourceResult(verticalPlan, reason) {
  return {
    verticalId: verticalPlan.verticalId,
    label: verticalPlan.label,
    provider: 'none',
    ok: true,
    skipped: true,
    reason,
    rawFound: 0,
    leads: [],
    attempts: [],
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeCsv(filePath, rows, columns) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${toCsv(rows, columns)}\n`)
}

function leadCsvRow(row) {
  const lead = row.lead || row
  const score = row.score || {}
  return {
    id: lead.id,
    source_type: lead.sourceType || '',
    vertical: lead.vertical,
    business_name: lead.businessName || '',
    property_address: lead.propertyAddress || '',
    city: lead.city || '',
    state: lead.state || '',
    email: lead.email || '',
    phone: lead.phone || '',
    website: lead.website || '',
    service_fit: lead.serviceFit || '',
    score: score.score ?? '',
    status: score.status || '',
    block_reason: score.blockReason || '',
    evidence: Array.isArray(lead.evidence) ? lead.evidence.join(' | ') : '',
    metadata: safeJson(lead.metadata || {}),
  }
}

async function main() {
  const liveSendRequested = hasFlag('--send') || hasFlag('--apply-send')
  if (liveSendRequested) {
    throw new Error('Outreach V4 dry run never sends. Use a future approved V4 send-control script only after Rob explicitly approves.')
  }

  const date = getArgValue('--date', new Date().toISOString().slice(0, 10))
  const businessMarketCount = intArg('--business-markets', 2, 8)
  const distressedMarketCount = intArg('--distressed-markets', 2, 6)
  const perMarketLimit = intArg('--per-market-limit', 2, 8)
  const realSource = hasFlag('--real-source')
  const realSourceVerticalList = listArg('--real-source-verticals', ['ai_receptionist', 'no_website', 'weak_website'])
  const realSourceVerticals = new Set(realSourceVerticalList)
  const realSourceOnly = hasFlag('--real-source-only')
  const realSourceProvider = getArgValue('--provider', 'auto')
  const realSourceLimit = intArg('--real-source-limit', 3, 10)
  const realSourceNicheLimit = intArg('--real-source-niches', 2, 5)
  const realSourceTimeoutMs = intArg('--real-source-timeout-ms', 25000, 55000)
  const websiteAuditLimit = intArg('--website-audit-limit', 4, 25)
  const targetSends = intArg('--target', Number.parseInt(process.env.OUTREACH_V4_DAILY_TARGET || '50', 10), 100)
  const enrichMissingEmail = hasFlag('--enrich-missing-email')
  const enrichmentLimit = intArg('--enrichment-limit', 25, 100)
  const enrichmentTimeoutMs = intArg('--enrichment-timeout-ms', 12000, 30000)
  const artifactDir = path.join(process.cwd(), 'artifacts', 'outreach-v4', date)

  const plan = buildMarketRotationPlan({ date, businessMarketCount, distressedMarketCount })
  const scraped = []
  for (const verticalPlan of plan.verticalPlans) {
    if (realSource && realSourceOnly && !realSourceVerticals.has(verticalPlan.verticalId)) {
      scraped.push(skippedRealSourceResult(verticalPlan, 'real_source_only_skipped_vertical'))
      continue
    }
    if (realSource && realSourceVerticals.has(verticalPlan.verticalId)) {
      const result = await runRealSourceAdapterV4(verticalPlan, {
        provider: realSourceProvider,
        limitPerNiche: realSourceLimit,
        nicheLimit: realSourceNicheLimit,
        timeoutMs: realSourceTimeoutMs,
        websiteAuditLimit,
      })
      scraped.push(result.ok ? result : runVerticalScraperDryRun(verticalPlan, { date, perMarketLimit }))
      continue
    }
    scraped.push(runVerticalScraperDryRun(verticalPlan, { date, perMarketLimit }))
  }
  let enrichment = {
    leads: scraped.flatMap((result) => result.leads),
    events: [],
    checked: 0,
    found: 0,
    skipped: 0,
    failedOrNotFound: 0,
  }
  if (enrichMissingEmail) {
    enrichment = await enrichMissingEmailsV4(enrichment.leads, {
      limit: enrichmentLimit,
      timeoutMs: enrichmentTimeoutMs,
      priorityVerticals: realSource ? realSourceVerticalList : [],
    })
  }
  const enrichedById = new Map(enrichment.leads.map((lead) => [lead.id, lead]))
  const enrichedScraped = scraped.map((result) => ({
    ...result,
    leads: result.leads.map((lead) => enrichedById.get(lead.id) || lead),
  }))
  const allLeads = enrichedScraped.flatMap((result) => result.leads)
  const scored = allLeads.map((lead) => ({ lead, score: scoreLeadV4(lead) }))
  const { accepted, quarantined, duplicates, identityCount } = dedupeAndQuarantineV4(scored)
  const drafts = accepted
    .filter((row) => row.score.sendReady)
    .map((row) => draftOutreachV4(row.lead))
  const { sentEmails, sentToday } = loadSentLedgerSummary({ date })
  const scorecard = buildOutreachV4Scorecard({
    plan,
    scraped: enrichedScraped,
    accepted,
    quarantined,
    drafts,
    targetSends,
    sentEmails,
    sentToday,
  })

  const output = {
    ok: true,
    dryRun: true,
    liveSendBlocked: true,
    realSource,
    realSourceProvider,
    realSourceVerticals: [...realSourceVerticals],
    enrichMissingEmail,
    targetSends,
    date,
    plan,
    scraped: scraped.map((result) => ({
      verticalId: result.verticalId,
      label: result.label,
      provider: result.provider || 'sample',
      rawFound: result.rawFound,
      attempts: result.attempts || [],
    })),
    enrichment: {
      checked: enrichment.checked,
      found: enrichment.found,
      skipped: enrichment.skipped,
      failedOrNotFound: enrichment.failedOrNotFound,
    },
    scorecard,
    identityCount,
    duplicateCount: duplicates.length,
    artifactDir,
  }

  writeJson(path.join(artifactDir, 'market-rotation-plan.json'), plan)
  writeJson(path.join(artifactDir, 'outreach-v4-scorecard.json'), scorecard)
  writeJson(path.join(artifactDir, 'outreach-v4-dry-run-summary.json'), output)
  writeJson(path.join(artifactDir, 'drafts.json'), drafts)
  writeJson(path.join(artifactDir, 'enrichment-events.json'), enrichment.events)
  writeCsv(
    path.join(artifactDir, 'accepted-leads.csv'),
    accepted.map(leadCsvRow),
    ['id', 'source_type', 'vertical', 'business_name', 'property_address', 'city', 'state', 'email', 'phone', 'website', 'service_fit', 'score', 'status', 'block_reason', 'evidence', 'metadata']
  )
  writeCsv(
    path.join(artifactDir, 'quarantine.csv'),
    quarantined.map((row) => ({
      ...leadCsvRow(row),
      quarantine_reason: row.quarantine?.reason || '',
      quarantine_detail: row.quarantine?.detail || row.score?.blockReason || '',
      recommended_next_step: row.quarantine?.recommendedNextStep || '',
    })),
    [
      'id',
      'source_type',
      'vertical',
      'business_name',
      'property_address',
      'city',
      'state',
      'email',
      'phone',
      'website',
      'service_fit',
      'score',
      'status',
      'block_reason',
      'quarantine_reason',
      'quarantine_detail',
      'recommended_next_step',
      'evidence',
      'metadata',
    ]
  )
  persistMarketRotationHistory(plan)

  console.log(JSON.stringify(output, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
