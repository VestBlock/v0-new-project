import 'server-only'

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { createAdminClient } from '../supabase/admin'
import type { RoughPropertyEstimate } from '../property/roughEstimate'
import type { PropertyOpportunityAnalysis } from '../property/opportunityAnalysis'

type AnyRow = Record<string, any>

export type CommandCenterEventPriority = 'critical' | 'warning' | 'info'

export type CommandCenterMemoryEvent = {
  id: string
  eventType: string
  entityType: string | null
  entityId: string | null
  source: string
  title: string
  summary: string | null
  priority: CommandCenterEventPriority
  status: 'open' | 'resolved' | 'archived'
  occurredAt: string
  metadata: Record<string, unknown>
}

export type PropertyAnalysisMemoryRecord = {
  id: string
  propertyAddress: string
  city: string | null
  state: string | null
  zipCode: string | null
  analysisSource: string
  estimateValue: number | null
  arv: number | null
  repairBudget: number | null
  assignmentFee: number | null
  mao: number | null
  sellerAsk: number | null
  spread: number | null
  endBuyerProfit: number | null
  grade: 'RISKY' | 'GOOD' | null
  dealStrengthScore: number | null
  dealStrengthLabel: string | null
  primaryRouteKey: string | null
  primaryRouteLabel: string | null
  primaryRouteScore: number | null
  buyerInterestLabel: string | null
  buyerInterestScore: number | null
  builderLabel: string | null
  nextAction: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

export type DealMemorySnapshot = {
  totalAnalyses: number
  dbCount: number
  localCount: number
  latestAt: string | null
  riskyCount: number
  goodCount: number
  weakCount: number
  averageDealStrength: number | null
  recentAnalyses: Array<{
    id: string
    propertyAddress: string
    grade: 'RISKY' | 'GOOD' | null
    dealStrengthLabel: string | null
    spread: number | null
    primaryRouteLabel: string | null
    nextAction: string | null
    createdAt: string
  }>
  nextActions: string[]
}

export type PropertyAnalysisPersistResult = {
  id: string
  recorded: boolean
  localWritten: boolean
  dbWritten: boolean
  eventWritten: boolean
  warning?: string
}

const MEMORY_DIR = path.join(process.cwd(), 'data', 'command-center')
const LOCAL_ANALYSIS_PATH = path.join(MEMORY_DIR, 'property-analysis-runs.jsonl')
const LOCAL_EVENTS_PATH = path.join(MEMORY_DIR, 'command-center-events.jsonl')

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function makeId(prefix: string, seed: string) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)
  return `${prefix}_${hash}`
}

function safeJsonLineAppend(file: string, row: Record<string, unknown>) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}

function readJsonl(file: string) {
  try {
    if (!fs.existsSync(file)) return []
    return fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AnyRow)
  } catch {
    return []
  }
}

function latestRoute(opportunity: PropertyOpportunityAnalysis) {
  return [...(opportunity.routeFit || [])].sort((left, right) => right.score - left.score)[0] || null
}

function propertyAnalysisRecord(input: {
  id?: string
  address: string
  form: AnyRow
  estimate: RoughPropertyEstimate
  opportunity: PropertyOpportunityAnalysis
  analysisSource?: string
  createdAt?: string
}): PropertyAnalysisMemoryRecord {
  const createdAt = input.createdAt || new Date().toISOString()
  const route = latestRoute(input.opportunity)
  const nextAction = input.opportunity.nextSteps?.[0] || route?.summary || null
  const id = input.id || makeId('analysis', `${input.address}|${createdAt}|${input.opportunity.dealMath.mao || ''}`)

  return {
    id,
    propertyAddress: input.address,
    city: asString(input.form.city),
    state: asString(input.form.state),
    zipCode: asString(input.form.zipCode),
    analysisSource: input.analysisSource || 'command_center',
    estimateValue: asNumber(input.estimate.estimateValue),
    arv: asNumber(input.opportunity.metrics.arv),
    repairBudget: asNumber(input.opportunity.metrics.repairBudget),
    assignmentFee: asNumber(input.opportunity.dealMath.assignmentFee),
    mao: asNumber(input.opportunity.dealMath.mao),
    sellerAsk: asNumber(input.opportunity.dealMath.sellerAsk),
    spread: asNumber(input.opportunity.dealMath.spread),
    endBuyerProfit: asNumber(input.opportunity.dealMath.endBuyerProfit),
    grade: input.opportunity.dealMath.grade,
    dealStrengthScore: asNumber(input.opportunity.dealStrength.score),
    dealStrengthLabel: input.opportunity.dealStrength.label || null,
    primaryRouteKey: route?.key || null,
    primaryRouteLabel: route?.label || null,
    primaryRouteScore: asNumber(route?.score),
    buyerInterestLabel: input.opportunity.buyerInterest.label || null,
    buyerInterestScore: asNumber(input.opportunity.buyerInterest.score),
    builderLabel: input.opportunity.builderDisposition.label || null,
    nextAction,
    createdAt,
    metadata: {
      listingPressure: input.opportunity.listingContext.pressureLabel,
      riskFlags: input.opportunity.riskFlags,
      selectedCompCount: input.opportunity.comparables.usedCount,
    },
  }
}

function dbPayload(
  record: PropertyAnalysisMemoryRecord,
  input: {
    eventId: string | null
    leadId?: string | null
    form: AnyRow
    estimate: RoughPropertyEstimate
    opportunity: PropertyOpportunityAnalysis
  }
) {
  return {
    id: crypto.randomUUID(),
    command_center_event_id: input.eventId,
    lead_id: input.leadId || null,
    property_address: record.propertyAddress,
    city: record.city,
    state: record.state,
    zip_code: record.zipCode,
    analysis_source: record.analysisSource,
    estimate_value: record.estimateValue,
    arv: record.arv,
    repair_budget: record.repairBudget,
    assignment_fee: record.assignmentFee,
    mao: record.mao,
    seller_ask: record.sellerAsk,
    spread: record.spread,
    end_buyer_profit: record.endBuyerProfit,
    grade: record.grade,
    deal_strength_score: record.dealStrengthScore,
    deal_strength_label: record.dealStrengthLabel,
    primary_route_key: record.primaryRouteKey,
    primary_route_label: record.primaryRouteLabel,
    primary_route_score: record.primaryRouteScore,
    buyer_interest_label: record.buyerInterestLabel,
    buyer_interest_score: record.buyerInterestScore,
    builder_label: record.builderLabel,
    next_action: record.nextAction,
    input_json: input.form,
    estimate_json: input.estimate,
    opportunity_json: input.opportunity,
    created_at: record.createdAt,
    updated_at: record.createdAt,
  }
}

export async function recordCommandCenterEvent(input: {
  eventType: string
  entityType?: string | null
  entityId?: string | null
  source?: string
  title: string
  summary?: string | null
  priority?: CommandCenterEventPriority
  status?: CommandCenterMemoryEvent['status']
  occurredAt?: string
  metadata?: Record<string, unknown>
}) {
  const event: CommandCenterMemoryEvent = {
    id: crypto.randomUUID(),
    eventType: input.eventType,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    source: input.source || 'command_center',
    title: input.title,
    summary: input.summary || null,
    priority: input.priority || 'info',
    status: input.status || 'open',
    occurredAt: input.occurredAt || new Date().toISOString(),
    metadata: input.metadata || {},
  }
  const localWritten = safeJsonLineAppend(LOCAL_EVENTS_PATH, event)

  let dbWritten = false
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('command_center_events').insert({
      id: event.id,
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      source: event.source,
      title: event.title,
      summary: event.summary,
      priority: event.priority,
      status: event.status,
      occurred_at: event.occurredAt,
      metadata_json: event.metadata,
    })
    dbWritten = !error
  } catch {
    dbWritten = false
  }

  return { event, localWritten, dbWritten }
}

export async function recordLeadOutcomeEvent(input: {
  leadId: string
  status?: string | null
  outreachStatus?: string | null
  lead?: AnyRow | null
  actorUserId?: string | null
}) {
  const status = String(input.status || input.outreachStatus || '').trim().toLowerCase()
  if (!['replied', 'interested', 'qualified', 'do_not_contact', 'followup_due'].includes(status)) {
    return null
  }

  const title =
    status === 'do_not_contact'
      ? 'Seller suppression outcome logged'
      : status === 'qualified'
        ? 'Qualified seller outcome logged'
        : 'Seller reply outcome logged'

  return recordCommandCenterEvent({
    eventType: 'seller_reply_outcome',
    entityType: 'lead',
    entityId: input.leadId,
    source: 'lead_update',
    title,
    summary: `${input.lead?.property_address || input.lead?.business_name || 'Seller lead'} moved to ${status}.`,
    priority: status === 'qualified' ? 'critical' : status === 'interested' ? 'warning' : 'info',
    metadata: {
      status: input.status || null,
      outreachStatus: input.outreachStatus || null,
      propertyAddress: input.lead?.property_address || null,
      email: input.lead?.email || null,
      actorUserId: input.actorUserId || null,
    },
  })
}

export async function recordPropertyAnalysisRun(input: {
  address: string
  form: AnyRow
  estimate: RoughPropertyEstimate
  opportunity: PropertyOpportunityAnalysis
  analysisSource?: string
  leadId?: string | null
}): Promise<PropertyAnalysisPersistResult> {
  const record = propertyAnalysisRecord(input)
  const localWritten = safeJsonLineAppend(LOCAL_ANALYSIS_PATH, record)
  const eventResult = await recordCommandCenterEvent({
    eventType: 'property_analysis_saved',
    entityType: input.leadId ? 'lead' : 'property',
    entityId: input.leadId || record.id,
    source: input.analysisSource || 'command_center',
    title: `Analysis saved: ${record.propertyAddress}`,
    summary: `${record.grade || 'Needs details'} · ${record.dealStrengthLabel || 'ungraded'} · ${record.primaryRouteLabel || 'route pending'}`,
    priority: record.grade === 'GOOD' ? 'warning' : 'info',
    metadata: {
      propertyAddress: record.propertyAddress,
      grade: record.grade,
      spread: record.spread,
      primaryRoute: record.primaryRouteLabel,
    },
  })

  let dbWritten = false
  let warning: string | undefined
  try {
    const admin = createAdminClient()
    const { error } = await admin
      .from('property_analysis_runs')
      .insert(dbPayload(record, {
        eventId: eventResult.dbWritten ? eventResult.event.id : null,
        leadId: input.leadId,
        form: input.form,
        estimate: input.estimate,
        opportunity: input.opportunity,
      }))
    if (error) {
      warning = error.message
    } else {
      dbWritten = true
    }
  } catch (error) {
    warning = error instanceof Error ? error.message : String(error)
  }

  return {
    id: record.id,
    recorded: localWritten || dbWritten,
    localWritten,
    dbWritten,
    eventWritten: eventResult.localWritten || eventResult.dbWritten,
    warning,
  }
}

function normalizeLocalRecord(row: AnyRow): PropertyAnalysisMemoryRecord | null {
  const propertyAddress = asString(row.propertyAddress || row.property_address)
  if (!propertyAddress) return null
  return {
    id: String(row.id || makeId('analysis', `${propertyAddress}|${row.createdAt || row.created_at || ''}`)),
    propertyAddress,
    city: asString(row.city),
    state: asString(row.state),
    zipCode: asString(row.zipCode || row.zip_code),
    analysisSource: String(row.analysisSource || row.analysis_source || 'command_center'),
    estimateValue: asNumber(row.estimateValue || row.estimate_value),
    arv: asNumber(row.arv),
    repairBudget: asNumber(row.repairBudget || row.repair_budget),
    assignmentFee: asNumber(row.assignmentFee || row.assignment_fee),
    mao: asNumber(row.mao),
    sellerAsk: asNumber(row.sellerAsk || row.seller_ask),
    spread: asNumber(row.spread),
    endBuyerProfit: asNumber(row.endBuyerProfit || row.end_buyer_profit),
    grade: row.grade === 'GOOD' || row.grade === 'RISKY' ? row.grade : null,
    dealStrengthScore: asNumber(row.dealStrengthScore || row.deal_strength_score),
    dealStrengthLabel: asString(row.dealStrengthLabel || row.deal_strength_label),
    primaryRouteKey: asString(row.primaryRouteKey || row.primary_route_key),
    primaryRouteLabel: asString(row.primaryRouteLabel || row.primary_route_label),
    primaryRouteScore: asNumber(row.primaryRouteScore || row.primary_route_score),
    buyerInterestLabel: asString(row.buyerInterestLabel || row.buyer_interest_label),
    buyerInterestScore: asNumber(row.buyerInterestScore || row.buyer_interest_score),
    builderLabel: asString(row.builderLabel || row.builder_label),
    nextAction: asString(row.nextAction || row.next_action),
    createdAt: String(row.createdAt || row.created_at || new Date().toISOString()),
    metadata: row.metadata || row.metadata_json || {},
  }
}

export function loadLocalPropertyAnalysisMemory() {
  return readJsonl(LOCAL_ANALYSIS_PATH).map(normalizeLocalRecord).filter(Boolean) as PropertyAnalysisMemoryRecord[]
}

export function buildDealMemorySnapshot(dbRows: AnyRow[] = []): DealMemorySnapshot {
  const localRows = loadLocalPropertyAnalysisMemory()
  const normalizedDbRows = dbRows.map(normalizeLocalRecord).filter(Boolean) as PropertyAnalysisMemoryRecord[]
  const byKey = new Map<string, PropertyAnalysisMemoryRecord>()

  for (const row of [...localRows, ...normalizedDbRows]) {
    const key = `${row.propertyAddress.toLowerCase()}|${row.createdAt}|${row.mao || ''}`
    byKey.set(key, row)
  }

  const rows = [...byKey.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const riskyCount = rows.filter((row) => row.grade === 'RISKY').length
  const goodCount = rows.filter((row) => row.grade === 'GOOD').length
  const weakCount = rows.filter((row) => String(row.dealStrengthLabel || '').toLowerCase() === 'weak').length
  const scored = rows.map((row) => row.dealStrengthScore).filter((value): value is number => Number.isFinite(value))
  const averageDealStrength = scored.length
    ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
    : null

  return {
    totalAnalyses: rows.length,
    dbCount: normalizedDbRows.length,
    localCount: localRows.length,
    latestAt: rows[0]?.createdAt || null,
    riskyCount,
    goodCount,
    weakCount,
    averageDealStrength,
    recentAnalyses: rows.slice(0, 5).map((row) => ({
      id: row.id,
      propertyAddress: row.propertyAddress,
      grade: row.grade,
      dealStrengthLabel: row.dealStrengthLabel,
      spread: row.spread,
      primaryRouteLabel: row.primaryRouteLabel,
      nextAction: row.nextAction,
      createdAt: row.createdAt,
    })),
    nextActions: [
      rows.length === 0 ? 'Run and save the next command-center property analysis before sending a serious offer.' : null,
      riskyCount > goodCount ? 'Use the debate lane on risky analyses before any offer leaves the system.' : null,
      rows.length > 0 ? 'Tie seller counters and accepted/rejected offers back to these saved deal twins.' : null,
    ].filter(Boolean) as string[],
  }
}
