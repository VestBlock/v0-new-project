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
  source: 'dealmachine_export' | 'public_listing' | 'manual' | 'system'
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

const LEDGER_DIR = path.join(process.cwd(), 'data', 'operating-loops')
const LEDGER_PATH = path.join(LEDGER_DIR, 'campaign-ledger.jsonl')
const SUMMARY_PATH = path.join(LEDGER_DIR, 'campaign-summary.json')

const STRATEGY_LABELS: Record<string, string> = {
  'dealmachine-seller-options': 'DealMachine owner seller-options',
  'divorce-separation': 'Divorce / separation quiet exit',
  'relocation-job-transfer': 'Relocation / job-transfer timing',
  'out-of-state-heir': 'Out-of-state heir / remote relief',
  'senior-downsizing-medical': 'Senior downsizing / medical hardship',
  'fire-storm-damage': 'Fire / storm / insurance damage',
  'problem-tenant-eviction': 'Problem tenant / eviction relief',
  'seller-finance-equity': 'Seller finance / owner-carry equity',
  'portfolio-landlord': 'Portfolio / senior landlord',
  'tired-landlord': 'Tired landlord / rental fatigue',
  'probate-inheritance': 'Probate / inheritance soft-touch',
  'vacant-property-refresh': 'Vacant property refresh',
  'code-violation-distress': 'Code violation / city-pressure',
  'tax-delinquent-cure': 'Tax delinquent cure path',
  'fsbo-conversion': 'FSBO conversion',
  'failed-flipper-stuck-rehab': 'Failed flipper / stuck rehab',
  'hoa-delinquent': 'HOA delinquent / association pressure',
  'reverse-mortgage-exit': 'Reverse mortgage exit',
  'title-issue-cloud': 'Title issue / cloud on title',
  'post-auction-backup-buyer': 'Post-auction / backup buyer',
  'tax-code-stack': 'Tax delinquent + code violation',
  'preforeclosure-subto': 'Preforeclosure subject-to review',
  'on-market-lowball-agent-sweep': 'On-market agent cash review',
  'stale-listing-creative-finance': 'Stale listing creative terms',
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

function writeCampaignLedgerCache(events: CampaignLedgerEvent[]) {
  try {
    fs.mkdirSync(LEDGER_DIR, { recursive: true })
    fs.writeFileSync(LEDGER_PATH, `${events.map((event) => JSON.stringify(event)).join('\n')}${events.length ? '\n' : ''}`, 'utf8')
    fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(buildCampaignRollups(events), null, 2)}\n`, 'utf8')
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

export function syncCampaignLedger(): { events: CampaignLedgerEvent[]; ledgerPath: string; summaryPath: string } {
  const outreachDir = path.join(process.cwd(), 'tmp', 'outreach')
  const events = sortEvents([
    ...buildDealmachineEvents(outreachDir),
    ...buildStaleListingEvents(outreachDir),
    ...buildBlockedSourceEvents(),
  ])

  return { events, ...writeCampaignLedgerCache(events) }
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

export function buildCampaignRollups(events: CampaignLedgerEvent[]): StrategyCampaignRollup[] {
  const byStrategy = new Map<string, CampaignLedgerEvent[]>()
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
    const status: CommandStatus = blocked > 0 && sent === 0 ? 'red' : failed > 0 || blocked > 0 ? 'yellow' : sent > 0 ? 'green' : 'yellow'
    const latestBlocked = sourceNeededRows[0]
    const nextMove = latestBlocked
      ? String(latestBlocked.metadata.reason || 'Resolve source blocker before sending this strategy.')
      : sent > 0
        ? 'Monitor replies, suppress opt-outs, and run the learning pass before repeating volume.'
        : drafted > 0
          ? 'Review drafts and run the approved send lane.'
          : 'Source and dry-run this strategy before sending.'

    return {
      key,
      label: rows[0]?.strategyName || strategyName(key),
      status,
      sent,
      failed,
      drafted,
      blocked,
      replies: 0,
      optOuts: 0,
      lastEventAt: latest?.sentAt || null,
      markets: topMarkets(rows),
      latestArtifact: latest?.artifactFile || null,
      nextMove,
      learningSignal:
        'Reply attribution is not fully wired yet; current score uses sends, source blockers, suppressions, and command-center reply totals.',
    }
  })

  return rollups.sort((a, b) => {
    const order = b.sent - a.sent || a.status.localeCompare(b.status) || a.label.localeCompare(b.label)
    return order
  })
}

export type LoadOperatingLoopTelemetryInput = Omit<
  OperatingLoopBuilderInput,
  'campaigns' | 'blockedSources' | 'ledgerEventCount' | 'lastEventAt'
>

export function loadOperatingLoopTelemetry(input: LoadOperatingLoopTelemetryInput): OperatingLoopTelemetry {
  const { events } = syncCampaignLedger()
  const campaigns = buildCampaignRollups(events)
  const lastEventAt = events[0]?.sentAt || null
  const totalSent = campaigns.reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0)
  const lowballSent = campaigns.find((campaign) => campaign.key === 'on-market-lowball-agent-sweep')?.sent || 0
  const lowballShare = totalSent > 0 ? lowballSent / totalSent : 0
  const blockedSources = campaigns
    .filter((campaign) => campaign.blocked > 0)
    .flatMap((campaign) => campaign.nextMove ? [`${campaign.label}: ${campaign.nextMove}`] : [])
  if (totalSent >= 10 && lowballShare > 0.2) {
    blockedSources.unshift(
      `On-market agent cash review: lowball outreach is ${Math.round(lowballShare * 100)}% of sent volume. Hold it below 20% and shift capacity to creative, distress, landlord, builder, and preforeclosure lanes.`
    )
  }
  const trimmedBlockedSources = blockedSources.slice(0, 6)

  return {
    generatedAt: new Date().toISOString(),
    ledgerPath: LEDGER_PATH,
    ledgerEventCount: events.length,
    focusStrategyKey: input.focusStrategyKey || campaigns[0]?.key || null,
    challengerStrategyKey: input.challengerStrategyKey || campaigns.find((campaign) => campaign.key !== campaigns[0]?.key)?.key || null,
    campaigns,
    blockedSources: trimmedBlockedSources,
    loops: buildOperatingLoopCards({
      ...input,
      campaigns,
      blockedSources: trimmedBlockedSources,
      ledgerEventCount: events.length,
      lastEventAt,
    }),
  }
}
