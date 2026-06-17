#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'data', 'operating-loops')
const OUT_PATH = path.join(OUT_DIR, 'resource-strategy-plan-latest.json')

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function latestJson(dir, test) {
  try {
    return fs
      .readdirSync(dir)
      .filter(test)
      .map((name) => ({ file: path.join(dir, name), mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]?.file || null
  } catch {
    return null
  }
}

function runJson(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
  })
  let parsed = null
  const text = String(result.stdout || '').trim()
  try {
    const jsonStart = text.indexOf('{')
    parsed = jsonStart >= 0 ? JSON.parse(text.slice(jsonStart)) : null
  } catch {
    parsed = null
  }
  return {
    name,
    ok: result.status === 0 && Boolean(parsed?.ok ?? parsed?.success ?? true),
    status: result.status,
    parsed,
    stdoutTail: text.slice(-1200),
    stderrTail: String(result.stderr || '').slice(-1200),
  }
}

const revenueOps = readJson(path.join(OUT_DIR, 'revenue-ops-latest.json'))
const rotation = readJson(path.join(OUT_DIR, 'tax-code-stack-rotation.json'))
const smsPath = latestJson(path.join(ROOT, 'tmp', 'outreach'), /^sms-review-queue-.*\.json$/)
const sms = smsPath ? readJson(smsPath) : null
const instantly = runJson('instantly-doctor', 'npm', ['run', 'instantly:doctor'])
const dealMachineDownload = runJson('dealmachine-export-download', 'npm', ['run', 'dealmachine:download-export', '--', '--max=1'])

const lanes = Array.isArray(rotation?.lanes) ? rotation.lanes : []
const waitingExport = lanes.filter((lane) => lane.status === 'waiting_for_dealmachine_export_email')
const readyCsv = lanes.filter((lane) => lane.status === 'csv_ready_for_daily_send')
const blockedZeroExportable = lanes.filter((lane) => lane.status === 'blocked_zero_exportable_contacts')
const needsContactExport = lanes.filter((lane) => lane.status === 'needs_contact_export')
const totalKnownSellerLeads = lanes.reduce((sum, lane) => sum + Number(lane.knownLeadCount || 0), 0)
const instantlyAccount = instantly.parsed?.accounts?.[0] || null
const warmupActive = Boolean(instantlyAccount?.warmup_status)
const activeInstantlyCampaigns = (instantly.parsed?.campaigns || []).filter((campaign) => Number(campaign.status) === 1)
const dealMachineDownloadNeedsAuth = /Gmail read scope is missing/i.test(dealMachineDownload.parsed?.error || dealMachineDownload.stderrTail || dealMachineDownload.stdoutTail || '')

const recommendations = []
if (waitingExport.length) {
  recommendations.push({
    priority: 'critical',
    lane: 'DealMachine seller supply',
    action: `Do not build more lists first. Resolve ${waitingExport.length} waiting export lane(s) by watching export emails, retrying zero exports, or ingesting delivered CSVs.`,
  })
}
if (readyCsv.length) {
  recommendations.push({
    priority: 'high',
    lane: 'Seller outreach',
    action: `Run daily-capped seller outreach from ${readyCsv.length} CSV-ready lane(s), keeping market/strategy copy separate.`,
  })
}
if (blockedZeroExportable.length) {
  recommendations.push({
    priority: 'critical',
    lane: 'DealMachine export repair',
    action: `Rebuild or replace ${blockedZeroExportable.length} zero-export lane(s): ${blockedZeroExportable.map((lane) => lane.market).join(', ')}. Do not keep waiting for emails from those lists.`,
  })
}
if (dealMachineDownloadNeedsAuth) {
  recommendations.push({
    priority: 'critical',
    lane: 'DealMachine export downloader',
    action: 'Complete the one-time Gmail read OAuth grant so Boss can download DealMachine export CSVs directly instead of relying on manual email downloads.',
  })
}
if (warmupActive) {
  recommendations.push({
    priority: 'high',
    lane: 'Instantly demand network',
    action: 'Use Instantly for buyer/developer/lender list growth and warm-start sends only; avoid seller-owner blasting while sender health is still building.',
  })
}
if (Number(sms?.acceptedCount || 0) > 0) {
  recommendations.push({
    priority: 'medium',
    lane: 'Manual SMS',
    action: `Review ${sms.acceptedCount} mobile candidates for DNC/textability before any manual text outreach.`,
  })
}
if (!readyCsv.length && !waitingExport.length && !needsContactExport.length) {
  recommendations.push({
    priority: 'high',
    lane: 'Lead generation',
    action: 'Build the next DealMachine seller stack in 4 mid-sized markets and pair it with Outscraper code/source discovery.',
  })
}

const strategyQueue = [
  {
    key: 'buyer-backed-fire-damage',
    resource: 'Outscraper + Instantly',
    target: 'builders, fire restoration rehabbers, cash buyers',
    nextAction: 'Build buyer demand first, then negotiate seller price.',
  },
  {
    key: 'tax-code-absentee-stack',
    resource: 'DealMachine + public records + Outscraper source discovery',
    target: 'tax delinquent, code violation, absentee/out-of-state owners',
    nextAction: 'Main seller engine; keep exports DNC-aware and strategy-separated.',
  },
  {
    key: 'small-multifamily-portfolio-pull',
    resource: 'DealMachine + buyer network',
    target: '2-20 unit owners with code/tax/rent stress and multiple properties',
    nextAction: 'Ask about one property or portfolio sale, then route to DSCR/cash-flow buyers.',
  },
  {
    key: 'infill-land-developer-backed',
    resource: 'DealMachine + Outscraper developer discovery',
    target: 'land or teardown lots near permits/developer activity',
    nextAction: 'Only send lowball land offers after developer demand is mapped.',
  },
  {
    key: 'stale-listing-agent-lowball',
    resource: 'homeharvest/listing search + email',
    target: '30+ DOM distressed listings with agent contact',
    nextAction: 'Use listing-agent copy, not owner-seller copy.',
  },
]

const plan = {
  createdAt: new Date().toISOString(),
  machineRole: 'Mac Pro revenue operations node',
  currentState: {
    revenueOpsOk: Boolean(revenueOps?.ok),
    instantlyOk: Boolean(instantly.parsed?.ok),
    instantlyWarmupActive: warmupActive,
    activeInstantlyCampaigns: activeInstantlyCampaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, dailyLimit: campaign.daily_limit })),
    taxCodeLanes: lanes.length,
    sellerLeadsKnownInRotation: totalKnownSellerLeads,
    csvReadyLanes: readyCsv.length,
    waitingDealMachineExportLanes: waitingExport.length,
    blockedZeroExportableLanes: blockedZeroExportable.length,
    needsContactExportLanes: needsContactExport.length,
    dealMachineExportDownloaderOk: Boolean(dealMachineDownload.parsed?.ok),
    dealMachineExportDownloaderNeedsAuth: dealMachineDownloadNeedsAuth,
    smsReviewAccepted: sms?.acceptedCount || 0,
  },
  resourceRules: {
    dealMachine: 'seller owner lists and DNC-aware export handoff',
    outscraper: 'business/entity discovery, county/public-record source discovery, code/developer overlays',
    instantly: 'buyer/lender/developer/acquisition-manager network growth',
    supabase: 'CRM memory, deal twins, suppression ledger, source performance',
    macPro: 'daily ops runner, long tasks, local reports, exports, QA',
  },
  recommendations,
  strategyQueue,
  commands: [
    'npm run revenue:ops',
    'npm run revenue:resource-plan',
    'npm run instantly:doctor',
    'npm run vestblock:tax-code-stack:rotation',
    'npm run dealmachine:export-doctor',
    'npm run dealmachine:download-export:apply',
    'npm run outreach:sms-review -- --limit=100',
  ],
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(OUT_PATH, `${JSON.stringify(plan, null, 2)}\n`)
console.log(JSON.stringify(plan, null, 2))
