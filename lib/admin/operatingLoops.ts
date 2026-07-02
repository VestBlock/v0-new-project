import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import {
  buildOperatingLoopCards,
  type CommandStatus,
  type OperatingLoopBuilderInput,
  type OperatingLoopCard,
  type StrategyCampaignRollup,
} from '@/lib/admin/operatingLoopCore'

type AnyRow = Record<string, any>

export type CampaignLedgerEvent = {
  id: string
  strategyKey: string
  strategyName: string
  source: 'dealmachine_export' | 'public_listing' | 'reactivation' | 'manual' | 'system'
  channel: 'email' | 'sms' | 'task'
  status: 'sent' | 'failed' | 'drafted' | 'blocked'
  recipient: string | null
  market: string | null
  propertyAddress: string | null
  sentAt: string | null
  providerId: string | null
  artifactFile: string
  metadata: Record<string, any>
}

export type { OperatingLoopCard, StrategyCampaignRollup } from '@/lib/admin/operatingLoopCore'

export type RepliedLeadSignal = {
  email: string
  status: string
  at: string | null
}

export type OperatingLoopTelemetry = {
  generatedAt: string
  ledgerPath: string
  ledgerEventCount: number
  focusStrategyKey: string | null
  challengerStrategyKey: string | null
  loops: OperatingLoopCard[]
  campaigns: StrategyCampaignRollup[]
  blockedSources: string[]
}

export type LoadOperatingLoopTelemetryInput = Omit<
  OperatingLoopBuilderInput,
  'campaigns' | 'blockedSources' | 'ledgerEventCount' | 'lastEventAt'
> & {
  /** Leads with reply-positive statuses so campaign rollups can attribute replies per strategy lane. */
  repliedLeads?: RepliedLeadSignal[]
}

const LEDGER_DIR = path.join(process.cwd(), 'data', 'operating-loops')
const LEDGER_PATH = path.join(LEDGER_DIR, 'campaign-ledger.jsonl')
const SUMMARY_PATH = path.join(LEDGER_DIR, 'campaign-summary.json')
const SUPPRESSION_PATH = path.join(process.cwd(), 'data', 'outreach-suppressions.json')
const REPLY_LOG_PATH = path.join(LEDGER_DIR, 'reply-log.jsonl')

const REPLY_POSITIVE_STATUSES = new Set(['replied', 'interested', 'qualified', 'closed_won'])

const STRATEGY_LABELS: Record<string, string> = {
  'dealmachine-seller-options': 'DealMachine owner seller-options',
  'portfolio-landlord': 'Portfolio / senior landlord',
  'tax-code-stack': 'Tax delinquent + code violation',
  'on-market-lowball-agent-sweep': 'On-market agent cash review',
  'stale-listing-creative-finance': 'Stale listing creative terms',
  'failed-landlord-exit': 'Failed landlord exit',
  'insurance-damage-event': 'Insurance / damage event',
  'zombie-rehab': 'Zombie rehab / stalled project',
  'senior-downsizer': 'Equity-rich downsizer',
  'rent-gap-multifamily': 'Small multifamily rent gap',
  'probate-vacant-equity': 'Probate + vacant + equity',
  'tired-airbnb-midterm': 'Tired Airbnb / midterm rental',
  'utility-lien-water-shutoff': 'Utility / water lien pressure',
  'contractor-distress-flip': 'Contractor distress flip',
  'small-commercial-owner-exit': 'Small commercial owner exit',
  'portfolio-fragmentation': 'Portfolio fragmentation',
  'buyer-reverse-engineering': 'Buyer reverse-engineering',
  'permit-spike-developer-land': 'Permit spike developer / land',
  'judgment-lien-pressure': 'Judgment / lien pressure',
  'tax-assessment-shock': 'Tax assessment shock',
  'reply-resurrection': 'Reply resurrection',
}

function isoFromMtime(file: string) {
  try {
    return new Date(fs.statSync(file).mtimeMs).toISOString()
  } catch {
    return null
  }
}

function safeJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function normalizeMarket(value: unknown) {
  const text = String(value || '').trim()
  return text || null
}

function marketFromAddress(address: unknown) {
  const text = String(address || '').trim()
  if (!text) return null
  const pieces = text.split(',').map((piece) => piece.trim()).filter(Boolean)
  if (pieces.length < 2) return null
  const city = pieces[pieces.length - 2]
  const stateZip = pieces[pieces.length - 1] || ''
  const state = stateZip.split(/\s+/)[0]
  return [city, state].filter(Boolean).join(', ') || null
}

function strategyName(key: string) {
  return STRATEGY_LABELS[key] || key.replace(/-/g, ' ')
}

function stampFromResultFile(name: string, prefix: string) {
  return name.replace(prefix, '').replace(/\.json$/i, '')
}

function findStaleDraftMap(dir: string, stamp: string) {
  const draftFile = path.join(dir, `stale-listing-drafts-${stamp}.json`)
  const drafts = safeJson(draftFile)
  const byEmail = new Map<string, AnyRow>()
  const byAddress = new Map<string, AnyRow>()
  if (!Array.isArray(drafts)) return { byEmail, byAddress }
  for (const draft of drafts) {
    const email = String(draft.agent_email || draft.email || '').trim().toLowerCase()
    const address = String(draft.address || '').trim().toLowerCase()
    if (email) byEmail.set(email, draft)
    if (address) byAddress.set(address, draft)
  }
  return { byEmail, byAddress }
}

function buildDealmachineEvents(dir: string): CampaignLedgerEvent[] {
  if (!fs.existsSync(dir)) return []
  const events: CampaignLedgerEvent[] = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('dealmachine-export-outreach-results-') || !name.endsWith('.json')) continue
    const file = path.join(dir, name)
    const rows = safeJson(file)
    if (!Array.isArray(rows)) continue
    const sentAt = isoFromMtime(file)

    rows.forEach((row: AnyRow, index: number) => {
      const strategyKey = String(row.strategy || row.metadata_json?.strategy || 'dealmachine-seller-options')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'dealmachine-seller-options'
      const address = String(row.property_address_full || row.propertyAddress || '').trim() || null
      events.push({
        id: `${name}:${index}`,
        strategyKey,
        strategyName: strategyName(strategyKey),
        source: 'dealmachine_export',
        channel: 'email',
        status: row.ok ? 'sent' : 'failed',
        recipient: String(row.email || '').trim().toLowerCase() || null,
        market: normalizeMarket(row.market) || marketFromAddress(address),
        propertyAddress: address,
        sentAt,
        providerId: row.id || row.resendId || null,
        artifactFile: name,
        metadata: {
          dealmachineId: row.dealmachine_id || null,
          commandCenterLeadId: row.commandCenter?.leadId || null,
          commandCenterOutreachMessageId: row.commandCenter?.outreachMessageId || null,
          error: row.error || null,
        },
      })
    })
  }
  return events
}

function buildStaleListingEvents(dir: string): CampaignLedgerEvent[] {
  if (!fs.existsSync(dir)) return []
  const events: CampaignLedgerEvent[] = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('stale-listing-results-') || !name.endsWith('.json')) continue
    const file = path.join(dir, name)
    const rows = safeJson(file)
    if (!Array.isArray(rows)) continue
    const stamp = stampFromResultFile(name, 'stale-listing-results-')
    const drafts = findStaleDraftMap(dir, stamp)
    const sentAt = isoFromMtime(file)

    rows.forEach((row: AnyRow, index: number) => {
      const email = String(row.email || row.agent_email || '').trim().toLowerCase()
      const address = String(row.address || '').trim()
      const draft = drafts.byEmail.get(email) || drafts.byAddress.get(address.toLowerCase()) || {}
      const offerMode = String(draft.offer_mode || draft.offerMode || '').toLowerCase()
      const strategyKey = offerMode.includes('lowball') ? 'on-market-lowball-agent-sweep' : 'stale-listing-creative-finance'
      events.push({
        id: `${name}:${index}`,
        strategyKey,
        strategyName: strategyName(strategyKey),
        source: 'public_listing',
        channel: 'email',
        status: row.ok ? 'sent' : 'failed',
        recipient: email || null,
        market: normalizeMarket(draft.market) || marketFromAddress(address),
        propertyAddress: address || null,
        sentAt,
        providerId: row.id || null,
        artifactFile: name,
        metadata: {
          agentName: draft.agent_name || null,
          daysOnMarket: draft.days_on_market || null,
          listPrice: draft.price || null,
          offerMode: draft.offer_mode || null,
          error: row.error || null,
        },
      })
    })
  }
  return events
}

/** Second-touch sends from scripts/send-reactivation-batch.mjs enter lane stats too. */
function buildReactivationEvents(dir: string): CampaignLedgerEvent[] {
  if (!fs.existsSync(dir)) return []
  const events: CampaignLedgerEvent[] = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('reactivation-results-') || !name.endsWith('.json')) continue
    const file = path.join(dir, name)
    const rows = safeJson(file)
    if (!Array.isArray(rows)) continue
    const sentAt = isoFromMtime(file)
    rows.forEach((row: AnyRow, index: number) => {
      const strategyKey =
        String(row.strategy || 'reactivation')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'reactivation'
      events.push({
        id: `${name}:${index}`,
        strategyKey,
        strategyName: strategyName(strategyKey),
        source: 'reactivation',
        channel: 'email',
        status: row.ok ? 'sent' : 'failed',
        recipient: String(row.email || '').trim().toLowerCase() || null,
        market: normalizeMarket(row.market) || marketFromAddress(row.property_address),
        propertyAddress: String(row.property_address || '').trim() || null,
        sentAt,
        providerId: row.id || null,
        artifactFile: name,
        metadata: { secondTouch: true, error: row.error || null },
      })
    })
  }
  return events
}

function buildBlockedSourceEvents(): CampaignLedgerEvent[] {
  const events: CampaignLedgerEvent[] = []
  const distressDir = path.join(process.cwd(), 'data', 'distress-leads')
  if (!fs.existsSync(distressDir)) return events

  const summaries = fs
    .readdirSync(distressDir)
    .filter((name) => name.endsWith('.json') && (
      name.startsWith('dealmachine-on-market-lowball-export-needed-summary-') ||
      name.startsWith('dealmachine-tax-code-stack-summary-')
    ))
    .sort()

  for (const name of summaries) {
    const file = path.join(distressDir, name)
    const parsed = safeJson(file)
    if (!parsed) continue
    const at = parsed.generatedAt || isoFromMtime(file)

    if (name.startsWith('dealmachine-on-market-lowball-export-needed-summary-')) {
      events.push({
        id: `${name}:export-needed`,
        strategyKey: 'on-market-lowball-agent-sweep',
        strategyName: strategyName('on-market-lowball-agent-sweep'),
        source: 'dealmachine_export',
        channel: 'task',
        status: Number(parsed.selected || 0) >= Number(parsed.limit || 100) ? 'drafted' : 'blocked',
        recipient: null,
        market: null,
        propertyAddress: null,
        sentAt: at,
        providerId: null,
        artifactFile: name,
        metadata: {
          selected: Number(parsed.selected || 0),
          limit: Number(parsed.limit || 100),
          byMarket: parsed.byMarket || {},
          reason: 'DealMachine active/pending on-market owner contacts need export before email.',
        },
      })
    }

    if (name.startsWith('dealmachine-tax-code-stack-summary-')) {
      const sourceNeeded = Array.isArray(parsed.sourceNeeded) ? parsed.sourceNeeded : []
      events.push({
        id: `${name}:source-needed`,
        strategyKey: 'tax-code-stack',
        strategyName: strategyName('tax-code-stack'),
        source: 'dealmachine_export',
        channel: 'task',
        status: Number(parsed.writtenRows || 0) > 0 ? 'drafted' : 'blocked',
        recipient: null,
        market: null,
        propertyAddress: null,
        sentAt: at,
        providerId: null,
        artifactFile: name,
        metadata: {
          writtenRows: Number(parsed.writtenRows || 0),
          sourceNeeded,
          reason: sourceNeeded.length
            ? 'Code-violation overlay source is missing.'
            : 'No matched tax/code rows were produced.',
        },
      })
    }
  }

  return events
}

function sortEvents(events: CampaignLedgerEvent[]) {
  return [...events].sort((a, b) => Date.parse(b.sentAt || '') - Date.parse(a.sentAt || '') || a.id.localeCompare(b.id))
}

function writeCampaignLedgerCache(events: CampaignLedgerEvent[], repliedLeads: RepliedLeadSignal[] = []) {
  try {
    fs.mkdirSync(LEDGER_DIR, { recursive: true })
    fs.writeFileSync(LEDGER_PATH, `${events.map((event) => JSON.stringify(event)).join('\n')}${events.length ? '\n' : ''}`, 'utf8')
    fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(buildCampaignRollups(events, repliedLeads), null, 2)}\n`, 'utf8')
    return { ledgerPath: LEDGER_PATH, summaryPath: SUMMARY_PATH }
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
      console.warn('Campaign ledger cache skipped because the runtime filesystem is not writable.')
      return { ledgerPath: 'memory:campaign-ledger', summaryPath: 'memory:campaign-summary' }
    }
    throw error
  }
}

export function syncCampaignLedger(
  repliedLeads: RepliedLeadSignal[] = []
): { events: CampaignLedgerEvent[]; ledgerPath: string; summaryPath: string } {
  const outreachDir = path.join(process.cwd(), 'tmp', 'outreach')
  const events = sortEvents([
    ...buildDealmachineEvents(outreachDir),
    ...buildStaleListingEvents(outreachDir),
    ...buildReactivationEvents(outreachDir),
    ...buildBlockedSourceEvents(),
  ])

  return { events, ...writeCampaignLedgerCache(events, repliedLeads) }
}

function topMarkets(events: CampaignLedgerEvent[]) {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (!event.market) continue
    counts.set(event.market, (counts.get(event.market) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([market, count]) => ({ market, count }))
    .sort((a, b) => b.count - a.count || a.market.localeCompare(b.market))
    .slice(0, 5)
}

function loadSuppressionRows() {
  const data = safeJson(SUPPRESSION_PATH)
  if (Array.isArray(data)) return data as AnyRow[]
  // Current on-disk format is { emails: [...] }; older formats were a bare array or keyed object.
  if (data && typeof data === 'object') {
    if (Array.isArray((data as AnyRow).emails)) return (data as AnyRow).emails as AnyRow[]
    return Object.values(data)
      .flatMap((row) => (Array.isArray(row) ? row : [row]))
      .filter((row) => row && typeof row === 'object') as AnyRow[]
  }
  return []
}

/**
 * Operator-logged replies (scripts/log-reply.mjs) recorded locally so reply
 * attribution works even before/without Supabase lead-status sync.
 */
function loadLocalReplyLog(): RepliedLeadSignal[] {
  try {
    const lines = fs.readFileSync(REPLY_LOG_PATH, 'utf8').split('\n')
    const rows: RepliedLeadSignal[] = []
    for (const line of lines) {
      const text = line.trim()
      if (!text) continue
      try {
        const row = JSON.parse(text)
        const email = String(row.email || '').trim().toLowerCase()
        const status = String(row.status || '').trim().toLowerCase()
        if (!email || !REPLY_POSITIVE_STATUSES.has(status)) continue
        rows.push({ email, status, at: row.at || row.loggedAt || null })
      } catch {
        // skip malformed lines
      }
    }
    return rows
  } catch {
    return []
  }
}

function mergeRepliedLeads(...sources: (RepliedLeadSignal[] | undefined)[]) {
  const byEmail = new Map<string, RepliedLeadSignal>()
  for (const source of sources) {
    for (const row of source || []) {
      const email = row.email.trim().toLowerCase()
      if (!email) continue
      const existing = byEmail.get(email)
      if (!existing || Date.parse(row.at || '') > Date.parse(existing.at || '')) {
        byEmail.set(email, { ...row, email })
      }
    }
  }
  return byEmail
}

function suppressionRowsByEmail() {
  const byEmail = new Map<string, AnyRow[]>()
  for (const row of loadSuppressionRows()) {
    const email = String(row.email || row.recipient || '').trim().toLowerCase()
    if (!email) continue
    const bucket = byEmail.get(email) || []
    bucket.push(row)
    byEmail.set(email, bucket)
  }
  return byEmail
}

function suppressionIsOptOut(row: AnyRow) {
  const reason = `${row.reason || ''} ${row.type || ''} ${row.category || ''}`.toLowerCase()
  return /unsubscribe|do[_ -]?not[_ -]?contact|opt[_ -]?out|remove|wrong[_ -]?owner/.test(reason)
}

function campaignNextMove(input: { key: string; sent: number; failed: number; drafted: number; blocked: number; optOuts: number; replies: number; latestBlocked?: CampaignLedgerEvent }) {
  if (input.replies > 0) {
    return `Work the ${input.replies} attributed repl${input.replies === 1 ? 'y' : 'ies'} in this lane to a next step (photos, condition, seller number, buyer fit) before adding fresh volume.`
  }
  if (input.latestBlocked) return String(input.latestBlocked.metadata.reason || 'Resolve source blocker before sending this strategy.')
  if (/seller-options/.test(input.key) && input.sent > 0) {
    return 'Pause generic seller-options live sends; move volume to high-intent stacked lanes and only stage this lane for manual review.'
  }
  if (input.key === 'on-market-lowball-agent-sweep' && input.sent > 0) {
    return 'Keep on-market lowball as a staged backup-offer test only; do not repeat live volume until agent reply attribution is clear.'
  }
  if (input.optOuts > 0) return 'Tighten copy, suppress opt-outs, and rerun as a 30-lead test before scaling this lane.'
  if (input.failed > 0) return 'Fix delivery failures and bounce risk before adding more sends.'
  if (input.sent >= 30) return 'Run a smaller A/B test on message angle and compare replies before repeating this lane.'
  if (input.sent > 0) return 'Monitor replies and run the learning audit before repeating volume.'
  if (input.drafted > 0) return 'Review drafts and send only the strongest 30-lead batch.'
  return 'Source and dry-run this strategy before sending.'
}

function campaignLearningSignal(input: { key: string; sent: number; failed: number; blocked: number; optOuts: number; replies: number }) {
  const parts = [
    `${input.sent} tracked sends`,
    `${input.replies} attributed replies`,
    `${input.failed} failures`,
    `${input.blocked} source blockers`,
    `${input.optOuts} suppression/opt-out signals`,
  ]
  if (/seller-options/.test(input.key)) parts.push('generic seller-options is now paused for live sends by default')
  if (input.key === 'on-market-lowball-agent-sweep') parts.push('on-market lowball is now staged/review-only by default')
  if (input.replies === 0 && input.sent > 0) {
    parts.push('log replies via outreach:log-reply (or lead status updates) so this lane earns scaling decisions')
  }
  return parts.join(' · ')
}

export function buildCampaignRollups(
  events: CampaignLedgerEvent[],
  repliedLeads: RepliedLeadSignal[] = []
): StrategyCampaignRollup[] {
  const byStrategy = new Map<string, CampaignLedgerEvent[]>()
  const suppressions = suppressionRowsByEmail()
  const repliedByEmail = mergeRepliedLeads(loadLocalReplyLog(), repliedLeads)

  for (const event of events) {
    const bucket = byStrategy.get(event.strategyKey) || []
    bucket.push(event)
    byStrategy.set(event.strategyKey, bucket)
  }

  const rollups = [...byStrategy.entries()].map(([key, rows]) => {
    const sent = rows.filter((row) => row.status === 'sent').length
    const failed = rows.filter((row) => row.status === 'failed').length
    const drafted = rows.filter((row) => row.status === 'drafted').length
    const blocked = rows.filter((row) => row.status === 'blocked').length
    const latest = rows[0] || null
    const sourceNeededRows = rows.filter((row) => row.status === 'blocked')
    const latestBlocked = sourceNeededRows[0]
    const recipientEmails = new Set(rows.map((row) => String(row.recipient || '').trim().toLowerCase()).filter(Boolean))
    const suppressionRows = [...recipientEmails].flatMap((email) => suppressions.get(email) || [])
    const optOuts = suppressionRows.filter(suppressionIsOptOut).length
    const replies = [...recipientEmails].filter((email) => repliedByEmail.has(email)).length
    const status: CommandStatus = replies > 0
      ? 'green'
      : blocked > 0 && sent === 0
        ? 'red'
        : failed > 0 || blocked > 0 || optOuts > 0
          ? 'yellow'
          : sent > 0
            ? 'green'
            : 'yellow'
    const nextMove = campaignNextMove({ key, sent, failed, drafted, blocked, optOuts, replies, latestBlocked })

    return {
      key,
      label: rows[0]?.strategyName || strategyName(key),
      status,
      sent,
      failed,
      drafted,
      blocked,
      replies,
      optOuts,
      lastEventAt: latest?.sentAt || null,
      markets: topMarkets(rows),
      latestArtifact: latest?.artifactFile || null,
      nextMove,
      learningSignal: campaignLearningSignal({ key, sent, failed, blocked, optOuts, replies }),
    }
  })

  return rollups.sort((a, b) => {
    const order =
      b.replies - a.replies || b.sent - a.sent || a.status.localeCompare(b.status) || a.label.localeCompare(b.label)
    return order
  })
}

/** Latest reactivation-queue run stats so the loop card reflects real state. */
function loadReactivationSnapshot() {
  const dir = path.join(LEDGER_DIR, 'reactivation')
  try {
    const latest = fs
      .readdirSync(dir)
      .filter((name) => name.startsWith('reactivation-queue-') && name.endsWith('.json'))
      .sort()
      .pop()
    if (!latest) return { eligible: 0, staged: 0, lastRunAt: null as string | null }
    const data = safeJson(path.join(dir, latest))
    const staged = Array.isArray(data?.queue) ? data.queue.length : 0
    return {
      eligible: Number(data?.eligible ?? staged) || staged,
      staged,
      lastRunAt: (data?.generatedAt as string | undefined) || isoFromMtime(path.join(dir, latest)),
    }
  } catch {
    return { eligible: 0, staged: 0, lastRunAt: null as string | null }
  }
}

export function loadOperatingLoopTelemetry(input: LoadOperatingLoopTelemetryInput): OperatingLoopTelemetry {
  const { repliedLeads = [], ...builderInput } = input
  const { events } = syncCampaignLedger(repliedLeads)
  const campaigns = buildCampaignRollups(events, repliedLeads)
  const reactivation = loadReactivationSnapshot()
  const lastEventAt = events[0]?.sentAt || null
  const blockedSources = campaigns
    .filter((campaign) => campaign.blocked > 0)
    .flatMap((campaign) => campaign.nextMove ? [`${campaign.label}: ${campaign.nextMove}`] : [])
    .slice(0, 6)

  return {
    generatedAt: new Date().toISOString(),
    ledgerPath: LEDGER_PATH,
    ledgerEventCount: events.length,
    focusStrategyKey: builderInput.focusStrategyKey || campaigns[0]?.key || null,
    challengerStrategyKey: builderInput.challengerStrategyKey || campaigns.find((campaign) => campaign.key !== campaigns[0]?.key)?.key || null,
    campaigns,
    blockedSources,
    loops: buildOperatingLoopCards({
      ...builderInput,
      campaigns,
      blockedSources,
      ledgerEventCount: events.length,
      lastEventAt,
      reactivationEligible: reactivation.eligible,
      reactivationStaged: reactivation.staged,
      reactivationLastRunAt: reactivation.lastRunAt,
    }),
  }
}
