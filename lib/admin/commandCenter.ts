import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildInvestorPipelineSnapshotFromRecord } from '@/lib/investors/pipeline'
import { getOutboundProviderReadiness } from '@/lib/leads/outbound'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { isCurrentVestblockOutboundLead } from '@/lib/leads/outboundEligibility'
import { loadOperatingLoopTelemetryFromDatabase, type OperatingLoopTelemetry } from '@/lib/admin/operatingLoops'
import { buildOperatingArchitecture, type CommandCenterOperatingArchitecture } from '@/lib/admin/operatingArchitecture'
import {
  buildDealMemorySnapshot,
  loadLocalPropertyAnalysisMemory,
  type DealMemorySnapshot,
} from '@/lib/admin/dealMemory'
import { buildSourceGovernorSnapshot, type SourceGovernorSnapshot } from '@/lib/leads/sourceCostGovernor'
import { getOutlookMailboxStatus } from '@/lib/email/outlookMailbox'
import { buildDatabaseDealMachineFreshness } from '@/lib/admin/dealMachineFreshness'
import { loadResearchSourceHealth, type ResearchSourceHealthSnapshot } from '@/lib/research/sourceHealth'
import { buildRevenueFunnelSnapshot, type CommandCenterRevenueFunnel } from '@/lib/admin/revenueFunnel'
import {
  SOURCE_DOCTRINE,
  buildAutopilotSnapshot,
  type AutopilotSnapshot,
  type SourceDoctrineLane,
} from '@/lib/admin/autonomousOperatingCore'

export type CommandStatus = 'green' | 'yellow' | 'red'
export type AgentStatus = 'active' | 'attention' | 'idle'
export type AgentKey =
  | 'acquisition'
  | 'outreach'
  | 'routing'
  | 'underwriting'
  | 'authority'
  | 'qa'
  | 'operator'

export type AgentKpi = {
  label: string
  value: string | number
  helper?: string
  status?: CommandStatus
}

export type AgentFeedItem = {
  label: string
  detail: string
  at: string | null
  href?: string
}

export type AgentAction = {
  label: string
  href: string
}

export type CommandActionTone = 'default' | 'primary' | 'success' | 'warning'

export type CommandCenterInlineAction =
  | {
      id: string
      type: 'navigate'
      label: string
      href: string
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lead_bulk'
      label: string
      leadIds: string[]
      action: 'approve_outreach' | 'generate_outreach'
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'buyer_bulk'
      label: string
      buyerIds: string[]
      action: 'approve_outreach' | 'generate_outreach'
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lender_bulk'
      label: string
      lenderIds: string[]
      action: 'approve_outreach' | 'generate_outreach'
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'investor_bulk'
      label: string
      investorIds: string[]
      action:
        | 'generate_outreach'
        | 'approve_outreach'
        | 'queue_outreach'
        | 'mark_researched'
        | 'mark_buy_box_inferred'
        | 'confirm_buy_box'
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lead_status'
      label: string
      leadId: string
      status: 'contacted' | 'replied' | 'interested' | 'qualified'
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lead_outreach'
      label: string
      leadId: string
      messageId: string
      status?: 'approved' | 'archived'
      sendNow?: boolean
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lead_send_batch'
      label: string
      messages: { leadId: string; messageId: string }[]
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lead_throughput_sprint'
      label: string
      target: number
      dryRun?: boolean
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'boss_daily_loop'
      label: string
      dryRun?: boolean
      dispatch?: boolean
      send?: boolean
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'command_center_autopilot'
      label: string
      dryRun?: boolean
      dispatch?: boolean
      send?: boolean
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'buyer_send_batch'
      label: string
      messages: { buyerId: string; messageId: string }[]
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lender_send_batch'
      label: string
      messages: { lenderId: string; messageId: string }[]
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'buyer_outreach'
      label: string
      buyerId: string
      messageId: string
      status?: 'approved' | 'archived'
      sendNow?: boolean
      tone?: CommandActionTone
    }
  | {
      id: string
      type: 'lender_outreach'
      label: string
      lenderId: string
      messageId: string
      status?: 'approved' | 'archived'
      sendNow?: boolean
      tone?: CommandActionTone
    }

export type CommandCenterStreamItem = {
  id: string
  lane: 'seller' | 'buyer' | 'lender' | 'partner' | 'system'
  title: string
  detail: string
  hint?: string
  at: string | null
  statusLabel?: string
  priority: 'critical' | 'warning' | 'info'
  href: string
  actions: CommandCenterInlineAction[]
}

export type CommandCenterInboxSection = {
  key: 'hot_replies' | 'partner_replies' | 'stale_threads' | 'automation_alerts'
  title: string
  hint: string
  items: CommandCenterStreamItem[]
}

export type CommandCenterQueueCard = {
  key: 'seller' | 'buyer' | 'lender' | 'builder'
  title: string
  detail: string
  href: string
  kpis: AgentKpi[]
  items: CommandCenterStreamItem[]
  actions: CommandCenterInlineAction[]
}

export type CommandCenterOutboundControl = {
  dailyLimit: number
  sent24h: number
  remainingToday: number
  recommendedSprintTarget: number
  maxSprintTarget: number
  sender: string
  provider: string
  mailingAddressConfigured: boolean
  autoSendEnabled: boolean
  emailReady: number
  needsReview: number
  followupsDue: number
  smsMode: 'review_only'
  smsReason: string
}

export type CommandCenterAutomationHealth = {
  status: CommandStatus
  headline: string
  metrics24h: {
    sellerSent: number
    buyerSent: number
    lenderSent: number
    failed: number
    replies: number
    followupsDue: number
  }
  deliveryEvidence: {
    windowDays: number
    sampleSize: number
    delivered: number
    bounced: number
    complained: number
    suppressed: number
    failed: number
    badRate: number
    threshold: number
    circuitOpen: boolean
    reason: string | null
  }
  mailbox: {
    configured: boolean
    mailbox: string
    authMode: string
    lastSyncAt: string | null
    lastStatus: string | null
    lastError: string | null
    missing: string[]
  }
  scheduler: {
    configuredRunsPerDay: number
    jobsTracked: number
    jobsDue: number
    jobsBlocked: number
    lastRevenueLoopAt: string | null
    lastRevenueLoopStatus: string | null
    nextRevenueLoopAt: string | null
  }
  buyerPipeline: {
    lastRunId: string | null
    lastRunAt: string | null
    status: string | null
    sent: number
    error: string | null
  }
  report: {
    reportDate: string | null
    generatedAt: string | null
    delivered: boolean | null
    provider: string | null
    recipient: string | null
    error: string | null
  }
  latestActivityAt: string | null
  blockers: {
    key: string
    severity: 'critical' | 'warning'
    title: string
    detail: string
    href: string
  }[]
}

export type CommandCenterStrategyExecution = {
  reportDate: string | null
  generatedAt: string | null
  status: 'completed' | 'partial' | 'blocked' | 'failed' | 'not_started'
  dryRun: boolean | null
  citiesAttempted: number
  sourcesAttempted: number
  leadsDiscovered: number
  leadsQualified: number
  draftsCreated: number
  staleCandidateLeadsExcluded: number
  accepted: number
  delivered: number
  replies: number
  blockers: string[]
  laneRuns: {
    strategyKey: string
    strategyName: string
    market: string
    sourceProvider: string
    status: string
    qualified: number
    draftsCreated: number
  }[]
}

export type CommandCenterOnMarketSweep = {
  latestRunAt: string | null
  latestDraftAt: string | null
  sent: number
  failed: number
  draftCount: number
  uniqueEmails: number
  markets: { market: string; count: number }[]
  latestResultFile: string | null
  latestDraftFile: string | null
  summary: string
}

export type CommandCenterTaxCodeStack = {
  latestRunAt: string | null
  writtenRows: number
  totalOutputRows: number
  markets: { market: string; stackedRows: number; taxDelinquentRows: number; codeViolationRows: number }[]
  sourceNeededCount: number
  latestSummaryFile: string | null
  summary: string
}

export type CommandCenterStrategyLab = {
  status: CommandStatus
  focus: string
  challenger: string
  nextMove: string
  sentToday: number
  remainingToday: number
  emailReady: number
  needsReview: number
  replySignals7d: number
  activeDirectiveCount: number
  lastDirectiveAt: string | null
  onMarketSweep: CommandCenterOnMarketSweep
  guardrails: AgentKpi[]
  actions: CommandCenterInlineAction[]
}

export type CommandCenterSuppressionCenter = {
  activeCount: number
  dbCount: number
  localCount: number
  missingDb: boolean
  recent: {
    email: string
    reason: string
    source: string
    propertyAddress?: string
    createdAt: string | null
  }[]
}

export type CommandCenterDealMachineFreshness = {
  freshCount: number
  staleCount: number
  oldestAgeDays: number | null
  newestAgeDays: number | null
  nextRefreshMarkets: string[]
  topStale: { file: string; ageDays: number; market: string }[]
  latestExportRequest: CommandCenterDealMachineExportRequest | null
  summary: string
}

export type CommandCenterDealMachineExportRequest = {
  createdAt: string | null
  ageMinutes: number | null
  totalRows: number
  strategies: string[]
  markets: string[]
  csvPath: string | null
  guidePath: string | null
  summaryFile: string | null
  noDealMachineSkipTraceDefault: boolean
  orchestratorSummaryFile?: string | null
  exportJobCounts?: Record<string, number> | null
}

export type CommandCenterOsintSourceBoard = {
  status: CommandStatus
  summary: string
  nextMove: string
  totals: {
    checklists: number
    ready: number
    needsReview: number
    blocked: number
    averageConfidence: number | null
  }
  sourceCards: {
    key: string
    label: string
    status: CommandStatus
    cadence: string
    count: number
    signalScore: number
    detail: string
    nextAction: string
  }[]
  marketSignals: {
    market: string
    count: number
    ready: number
    averageConfidence: number | null
  }[]
  actions: CommandCenterInlineAction[]
}

export type CommandCenterOutcomeLearning = {
  status: CommandStatus
  totalEvents: number
  sellerReplies: number
  interested: number
  qualified: number
  doNotContact: number
  followups: number
  buyerPacketsSent: number
  buyerPacketReplies: number
  lastEventAt: string | null
  summary: string
  nextMove: string
  lessons: {
    label: string
    detail: string
    status: CommandStatus
  }[]
  recent: {
    title: string
    summary: string
    status: string
    source: string
    occurredAt: string | null
  }[]
}

export type CommandCenterOutboundGovernance = {
  status: CommandStatus
  sender: string
  dailyLimit: number
  sent24h: number
  remainingToday: number
  readyToSend: number
  needsReview: number
  replySignals7d: number
  bounceRiskLeads: number
  suppressionCount: number
  paidSourcesBlocked: number
  nextGate: string
  checks: AgentKpi[]
}

export type CommandCenterBuyBoxGraph = {
  status: CommandStatus
  summary: string
  nextMove: string
  lanes: {
    key: 'buyers' | 'lenders' | 'builders' | 'multifamily' | 'btr' | 'commercial' | 'novation' | 'creative'
    label: string
    count: number
    detail: string
    status: CommandStatus
  }[]
  recentProperties: {
    id: string
    propertyAddress: string
    market: string
    grade: string
    route: string
    suggestedLane: string
    routeReason: string
    createdAt: string | null
  }[]
  actions: CommandCenterInlineAction[]
}

export type CommandCenterDealPipeline = {
  status: CommandStatus
  summary: string
  nextMove: string
  totals: {
    activeDeals: number
    packetReady: number
    packetSent: number
    buyerReplies: number
  }
  stages: {
    key: string
    label: string
    count: number
    value: number
    items: {
      id: string
      propertyAddress: string
      market: string
      stage: string
      priority: string
      nextAction: string
      sentCount: number
      replyCount: number
      updatedAt: string | null
    }[]
  }[]
  recentPackets: {
    id: string
    propertyAddress: string
    status: string
    selectedBuyerCount: number
    sentCount: number
    repliedCount: number
    createdAt: string | null
  }[]
}

export type ForeclosureSignalKey =
  | 'tax_delinquency'
  | 'code_violation'
  | 'vacancy'
  | 'probate'
  | 'bankruptcy_dismissal'
  | 'eviction_landlord'
  | 'expired_listing'
  | 'multiple_liens'
  | 'foreclosure_filing'
  | 'auction_postponed'
  | 'failed_auction_reo'

export type ForeclosureExitBucketKey =
  | 'cash_offer'
  | 'wholesale_assignment'
  | 'novation'
  | 'short_sale'
  | 'subject_to'
  | 'seller_finance'
  | 'investor_buyer_match'
  | 'lender_rescue_referral'
  | 'attorney_housing_referral'
  | 'surplus_funds_followup'

export type ForeclosureCountySource = {
  key: string
  market: string
  county: string
  state: string
  priority: 'home' | 'core' | 'expansion'
  cadence: 'daily' | 'weekly'
  sources: string[]
  bestFirstSignals: ForeclosureSignalKey[]
  nextAdapter: string
}

export type ForeclosureExitBucket = {
  key: ForeclosureExitBucketKey
  label: string
  fit: string
  guardrail: string
}

export type ForeclosureLeadSignalInput = {
  equityPercent?: number | null
  daysToSale?: number | null
  ownerOccupied?: boolean | null
  absenteeOwner?: boolean | null
  vacant?: boolean | null
  taxDelinquent?: boolean | null
  codeViolation?: boolean | null
  probate?: boolean | null
  bankruptcyDismissed?: boolean | null
  evictionLandlord?: boolean | null
  expiredListing?: boolean | null
  multipleLiens?: boolean | null
  foreclosureFiled?: boolean | null
  auctionPostponed?: boolean | null
  failedAuctionReo?: boolean | null
  rentalDemand?: number | null
  buyerMatchCount?: number | null
  lenderMatchCount?: number | null
  arvSpread?: number | null
}

export type ForeclosureLeadRoute = {
  score: number
  urgency: 'watch' | 'active' | 'urgent'
  signals: ForeclosureSignalKey[]
  buckets: ForeclosureExitBucketKey[]
  bestExit: ForeclosureExitBucketKey
  complianceFlags: string[]
  nextMove: string
}

export type CommandCenterForeclosureCommand = {
  status: CommandStatus
  summary: string
  nextMove: string
  countySources: ForeclosureCountySource[]
  exitBuckets: ForeclosureExitBucket[]
  starterPlays: {
    key: string
    label: string
    difficulty: 'easy' | 'medium' | 'hard'
    testPath: string
    reason: string
  }[]
  sampleRoute: ForeclosureLeadRoute
  guardrails: string[]
}

export type AgentPanelData = {
  key: AgentKey
  name: string
  role: string
  status: AgentStatus
  statusReason: string
  kpis: AgentKpi[]
  feed: AgentFeedItem[]
  actions: AgentAction[]
}

export type CommandAlert = {
  severity: 'critical' | 'warning' | 'info'
  message: string
  href?: string
}

export type MarketHeatRow = {
  market: string
  leads: number
  contactable: number
  recent7d: number
  replied: number
  heat: number
  href?: string
}

export type ActivityItem = {
  at: string
  source: string
  message: string
  href?: string
}

export type OverdueTaskItem = {
  id: string
  title: string
  detail: string
  dueAt: string | null
  priority: string
  status: string
  href: string
  relatedHref?: string
}

export type MissionNode = {
  key: AgentKey
  label: string
  intensity: number
  status: AgentStatus
  headline: string
  detail: string
  signals: AgentKpi[]
  watchItems: string[]
  actions: AgentAction[]
}

export type CommandCenterData = {
  generatedAt: string
  liveDataReachable: boolean
  dataSourceIssues: { source: string; message: string }[]
  summary: {
    revenue30d: number
    revenueTarget: number
    outreach24h: number
    outreachTarget: number
    newLeads24h: number
    replySignals7d: number
    openTasks: number
    urgentTasks: number
    activePartners: number
    builderPartners: number
    dealMachineAlignedPartners: number
    partnerResearchReady: number
    partnerOutreachReady: number
    partnerBuyBoxesConfirmed: number
    partnerDiscoveryRuns7d: number
    cooldownSaves7d: number
    failedPartnerRuns7d: number
    archivedLegacyRuntimeRows: number
    hiddenLegacyDrafts: number
  }
  missionNodes: MissionNode[]
  priorities: string[]
  alerts: CommandAlert[]
  agents: AgentPanelData[]
  automationHealth: CommandCenterAutomationHealth
  strategyExecution: CommandCenterStrategyExecution
  outboundControl: CommandCenterOutboundControl
  strategyLab: CommandCenterStrategyLab
  operatingLoops: OperatingLoopTelemetry
  operatingArchitecture: CommandCenterOperatingArchitecture
  dealMemory: DealMemorySnapshot
  sourceGovernor: SourceGovernorSnapshot
  sourceDoctrine: SourceDoctrineLane[]
  suppressionCenter: CommandCenterSuppressionCenter
  dealMachineFreshness: CommandCenterDealMachineFreshness
  osintSourceBoard: CommandCenterOsintSourceBoard
  outcomeLearning: CommandCenterOutcomeLearning
  outboundGovernance: CommandCenterOutboundGovernance
  buyBoxGraph: CommandCenterBuyBoxGraph
  dealPipeline: CommandCenterDealPipeline
  revenueFunnel: CommandCenterRevenueFunnel
  researchSourceHealth: ResearchSourceHealthSnapshot
  foreclosureCommand: CommandCenterForeclosureCommand
  autopilot: AutopilotSnapshot
  inbox: {
    summary: AgentKpi[]
    sections: CommandCenterInboxSection[]
  }
  outreachQueues: CommandCenterQueueCard[]
  marketHeat: MarketHeatRow[]
  routingQueue: { label: string; count: number; href: string }[]
  overdueTasks: OverdueTaskItem[]
  activity: ActivityItem[]
  localSignals: {
    dmExports: { file: string; ageDays: number }[]
    onMarketSweep: CommandCenterOnMarketSweep
    taxCodeStack: CommandCenterTaxCodeStack
    dealMachineExportRequest: CommandCenterDealMachineExportRequest | null
    distressStackRows: number | null
    suppressionRecords: {
      email: string
      reason: string
      source: string
      propertyAddress?: string
      createdAt: string | null
    }[]
  }
}

type DataSourceIssue = { source: string; message: string }

type AnyRow = Record<string, any>

async function safeRows<T = AnyRow>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
  },
  label: string,
  issues: DataSourceIssue[],
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000
  const maxRows = options.maxRows ?? 5000
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1)
    try {
      const { data, error } = await buildQuery().range(from, to)
      if (error) {
        issues.push({ source: label, message: error.message || 'Query unavailable.' })
        return []
      }
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    } catch (error) {
      issues.push({ source: label, message: error instanceof Error ? error.message : 'Query failed.' })
      return []
    }
  }

  return rows
}

async function optionalRows<T = AnyRow>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
  },
  label: string,
  issues: DataSourceIssue[],
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<T[]> {
  const optionalIssues: DataSourceIssue[] = []
  const rows = await safeRows(buildQuery, label, optionalIssues, options)
  const missingOptionalTable = optionalIssues.some((issue) =>
    /does not exist|schema cache|could not find|relation .* does not exist/i.test(issue.message || '')
  )
  if (!missingOptionalTable) issues.push(...optionalIssues)
  return rows
}

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function hoursSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY
  return (Date.now() - ts) / 36e5
}

const withinHours = (value: string | null | undefined, hours: number) => hoursSince(value) <= hours
const withinDays = (value: string | null | undefined, days: number) => hoursSince(value) <= days * 24

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(String(value))))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
}

const lower = (value?: string | null) => String(value || '').toLowerCase()

function readLocalJsonl(file: string): AnyRow[] {
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

function mergeRowsById(primary: AnyRow[], localRows: AnyRow[]) {
  const rows = new Map<string, AnyRow>()
  for (const row of localRows) {
    const id = String(row.id || '')
    if (id) rows.set(id, row)
  }
  for (const row of primary) {
    const id = String(row.id || '')
    if (id) rows.set(id, row)
  }
  return [...rows.values()]
}

function normalizeLocalBuyerPacket(row: AnyRow): AnyRow {
  return {
    ...row,
    property_analysis_run_id: row.property_analysis_run_id || row.propertyAnalysisRunId || null,
    property_address: row.property_address || row.propertyAddress || null,
    zip_code: row.zip_code || row.zipCode || null,
    selected_buyer_count: row.selected_buyer_count ?? row.selectedBuyerCount ?? 0,
    sent_count: row.sent_count ?? row.sentCount ?? 0,
    opened_count: row.opened_count ?? row.openedCount ?? 0,
    replied_count: row.replied_count ?? row.repliedCount ?? 0,
    last_sent_at: row.last_sent_at || row.lastSentAt || null,
    created_at: row.created_at || row.createdAt || null,
    updated_at: row.updated_at || row.updatedAt || row.created_at || row.createdAt || null,
    metadata_json: row.metadata_json || row.metadata || {},
  }
}

function normalizeLocalPipelineItem(row: AnyRow): AnyRow {
  return {
    ...row,
    property_analysis_run_id: row.property_analysis_run_id || row.propertyAnalysisRunId || null,
    buyer_packet_id: row.buyer_packet_id || row.buyerPacketId || null,
    lead_id: row.lead_id || row.leadId || null,
    property_address: row.property_address || row.propertyAddress || null,
    zip_code: row.zip_code || row.zipCode || null,
    current_stage: row.current_stage || row.currentStage || null,
    stage_label: row.stage_label || row.stageLabel || null,
    deal_grade: row.deal_grade || row.dealGrade || null,
    deal_strength_score: row.deal_strength_score ?? row.dealStrengthScore ?? null,
    buyer_packet_sent_count: row.buyer_packet_sent_count ?? row.buyerPacketSentCount ?? 0,
    buyer_reply_count: row.buyer_reply_count ?? row.buyerReplyCount ?? 0,
    estimated_assignment_fee: row.estimated_assignment_fee ?? row.estimatedAssignmentFee ?? null,
    expected_profit: row.expected_profit ?? row.expectedProfit ?? null,
    next_action: row.next_action || row.nextAction || null,
    next_action_at: row.next_action_at || row.nextActionAt || null,
    created_at: row.created_at || row.createdAt || null,
    updated_at: row.updated_at || row.updatedAt || row.created_at || row.createdAt || null,
    metadata_json: row.metadata_json || row.metadata || {},
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function timestampOf(row: AnyRow): string | null {
  return row.created_at || row.updated_at || row.sent_at || row.published_at || null
}

function titleCase(value: string | null | undefined) {
  const normalized = String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!normalized) return ''
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function marketLabel(row: AnyRow | null | undefined) {
  return [row?.city, row?.state].filter(Boolean).join(', ')
}

function leadLabel(lead: AnyRow | null | undefined) {
  return (
    String(lead?.property_address || '').trim() ||
    String(lead?.business_name || '').trim() ||
    String(lead?.name || '').trim() ||
    'Seller lead'
  )
}

function partnerLabel(row: AnyRow | null | undefined, fallback: string) {
  return (
    String(row?.company_name || '').trim() ||
    String(row?.display_name || '').trim() ||
    String(row?.name || '').trim() ||
    fallback
  )
}

function navigateAction(id: string, label: string, href: string, tone?: CommandActionTone): CommandCenterInlineAction {
  return { id, type: 'navigate', label, href, tone }
}

function leadStatusAction(
  id: string,
  label: string,
  leadId: string,
  status: 'contacted' | 'replied' | 'interested' | 'qualified',
  tone?: CommandActionTone
): CommandCenterInlineAction {
  return { id, type: 'lead_status', label, leadId, status, tone }
}

function leadOutreachAction(
  id: string,
  label: string,
  leadId: string,
  messageId: string,
  options: { status?: 'approved' | 'archived'; sendNow?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'lead_outreach', label, leadId, messageId, ...options }
}

function buyerOutreachAction(
  id: string,
  label: string,
  buyerId: string,
  messageId: string,
  options: { status?: 'approved' | 'archived'; sendNow?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'buyer_outreach', label, buyerId, messageId, ...options }
}

function lenderOutreachAction(
  id: string,
  label: string,
  lenderId: string,
  messageId: string,
  options: { status?: 'approved' | 'archived'; sendNow?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'lender_outreach', label, lenderId, messageId, ...options }
}

const LEGACY_OUTREACH_SUBJECT_PATTERNS = [
  /business setup/i,
  /business operations/i,
  /compliance/i,
  /startup/i,
  /visibility/i,
]

const LEGACY_TASK_ENTITY_TYPES = new Set([
  'credit_report',
  'dispute_letter',
  'funding_strategy_request',
])

const LEGACY_TASK_TEXT_PATTERNS = [
  /credit report/i,
  /credit analysis/i,
  /dispute letter/i,
  /funding strategy/i,
  /business funding/i,
  /\bsam\b/i,
  /\bgrant\b/i,
  /government/i,
]

function isCooldownNote(value: string | null | undefined) {
  const normalized = String(value || '').toLowerCase()
  return normalized.includes('cooldown') || normalized.includes('skipped duplicate')
}

function isCurrentVestblockLead(lead: AnyRow) {
  return isCurrentVestblockOutboundLead(lead)
}

function isLegacyLeadOutreachMessage(message: AnyRow, leadById: Map<string, AnyRow>) {
  const subject = String(message.subject || '').trim()
  const lead = message.lead_id ? leadById.get(message.lead_id) : null

  if (lead && !isCurrentVestblockLead(lead)) return true
  if (subject && LEGACY_OUTREACH_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject))) return true

  return false
}

function isCurrentVestblockTask(task: AnyRow) {
  const entityType = lower(task.entity_type)
  if (LEGACY_TASK_ENTITY_TYPES.has(entityType)) return false

  const haystack = [task.title, task.description, task.task_type, task.entity_type].map((value) => String(value || '')).join(' · ')
  return !LEGACY_TASK_TEXT_PATTERNS.some((pattern) => pattern.test(haystack))
}

function leadHref(lead: AnyRow | null | undefined) {
  return lead?.id ? `/admin/leads/${lead.id}` : '/admin/leads'
}

function buyerHref(buyer: AnyRow | null | undefined) {
  return buyer?.id ? `/admin/buyers/${buyer.id}` : '/admin/buyers'
}

function lenderHref(lender: AnyRow | null | undefined) {
  return lender?.id ? `/admin/lenders/${lender.id}` : '/admin/lenders'
}

function taskRelatedHref(task: AnyRow) {
  if (task.entity_type === 'lead' && task.entity_id) return `/admin/leads/${task.entity_id}`
  if (task.entity_type === 'buyer' && task.entity_id) return `/admin/buyers/${task.entity_id}`
  if (task.entity_type === 'lender' && task.entity_id) return `/admin/lenders/${task.entity_id}`
  if (task.entity_type === 'investor_profile' && task.entity_id) return '/admin/investor-partnerships'
  if (task.entity_type === 'research_checklist' && task.entity_id) return '/admin/research-checklists'
  return '/admin/command-center'
}

function priorityWeight(priority: string | null | undefined) {
  switch (lower(priority)) {
    case 'urgent':
      return 4
    case 'high':
      return 3
    case 'normal':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function leadBulkAction(
  id: string,
  label: string,
  leadIds: string[],
  action: 'approve_outreach' | 'generate_outreach',
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'lead_bulk', label, leadIds, action, tone }
}

function buyerBulkAction(
  id: string,
  label: string,
  buyerIds: string[],
  action: 'approve_outreach' | 'generate_outreach',
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'buyer_bulk', label, buyerIds, action, tone }
}

function lenderBulkAction(
  id: string,
  label: string,
  lenderIds: string[],
  action: 'approve_outreach' | 'generate_outreach',
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'lender_bulk', label, lenderIds, action, tone }
}

function investorBulkAction(
  id: string,
  label: string,
  investorIds: string[],
  action:
    | 'generate_outreach'
    | 'approve_outreach'
    | 'queue_outreach'
    | 'mark_researched'
    | 'mark_buy_box_inferred'
    | 'confirm_buy_box',
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'investor_bulk', label, investorIds, action, tone }
}

function leadSendBatchAction(
  id: string,
  label: string,
  messages: { leadId: string; messageId: string }[],
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'lead_send_batch', label, messages, tone }
}

function leadThroughputSprintAction(
  id: string,
  label: string,
  target: number,
  options: { dryRun?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'lead_throughput_sprint', label, target, ...options }
}

function bossDailyLoopAction(
  id: string,
  label: string,
  options: { dryRun?: boolean; dispatch?: boolean; send?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'boss_daily_loop', label, ...options }
}

function commandCenterAutopilotAction(
  id: string,
  label: string,
  options: { dryRun?: boolean; dispatch?: boolean; send?: boolean; tone?: CommandActionTone } = {}
): CommandCenterInlineAction {
  return { id, type: 'command_center_autopilot', label, ...options }
}

function buyerSendBatchAction(
  id: string,
  label: string,
  messages: { buyerId: string; messageId: string }[],
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'buyer_send_batch', label, messages, tone }
}

function lenderSendBatchAction(
  id: string,
  label: string,
  messages: { lenderId: string; messageId: string }[],
  tone: CommandActionTone = 'default'
): CommandCenterInlineAction {
  return { id, type: 'lender_send_batch', label, messages, tone }
}

function marketFromDmExportFile(file: string) {
  const base = file
    .replace(/\.csv$/i, '')
    .replace(/^(dealmachine|dm|contacts|export)[-_]*/i, '')
    .replace(/[-_]?20\d{2}[-_]\d{1,2}[-_]\d{1,2}.*$/i, '')
    .replace(/[-_]?contacts?$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()

  return titleCase(base || file.replace(/\.csv$/i, ''))
}

function newestLocalFile(dir: string, prefix: string, suffix = '.json') {
  if (!fs.existsSync(dir)) return null

  const matches = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => {
      const file = path.join(dir, name)
      const stat = fs.statSync(file)
      return { name, file, mtimeMs: stat.mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  return matches[0] || null
}

function readJsonArray(file: string | null | undefined): AnyRow[] {
  if (!file) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(parsed) ? (parsed as AnyRow[]) : []
  } catch {
    return []
  }
}

function readJsonObject(file: string | null | undefined): Record<string, any> | null {
  if (!file) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, any>) : null
  } catch {
    return null
  }
}

function loadDealMachineExportRequest(): CommandCenterDealMachineExportRequest | null {
  const dir = path.join(process.cwd(), 'data', 'distress-leads')
  try {
    const latestSummary = newestLocalFile(dir, 'dealmachine-contact-export-request-summary-')
    const parsed = readJsonObject(latestSummary?.file)
    if (!latestSummary || !parsed) return null
    const orchestrator = readJsonObject(path.join(process.cwd(), 'data', 'operating-loops', 'dealmachine-export-orchestrator-summary.json'))
    const exportJobs = orchestrator?.exportJobs && typeof orchestrator.exportJobs === 'object'
      ? orchestrator.exportJobs
      : null

    const createdAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date(latestSummary.mtimeMs).toISOString()
    const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60000))

    return {
      createdAt,
      ageMinutes: Number.isFinite(ageMinutes) ? ageMinutes : null,
      totalRows: Number(parsed.totalRows || 0),
      strategies: Array.isArray(parsed.strategies) ? parsed.strategies.map(String).slice(0, 8) : [],
      markets: Array.isArray(parsed.markets) ? parsed.markets.map(String).slice(0, 8) : [],
      csvPath: typeof parsed.csvPath === 'string' ? parsed.csvPath : null,
      guidePath: typeof parsed.guidePath === 'string' ? parsed.guidePath : null,
      summaryFile: latestSummary.name,
      noDealMachineSkipTraceDefault: parsed.noDealMachineSkipTraceDefault !== false,
      orchestratorSummaryFile: typeof orchestrator?.generatedAt === 'string' ? 'data/operating-loops/dealmachine-export-orchestrator-summary.json' : null,
      exportJobCounts: exportJobs?.byStatus && typeof exportJobs.byStatus === 'object' ? exportJobs.byStatus as Record<string, number> : null,
    }
  } catch {
    return null
  }
}

function loadOnMarketSweep(): CommandCenterOnMarketSweep {
  const dir = path.join(process.cwd(), 'tmp', 'outreach')
  try {
    const latestResult = newestLocalFile(dir, 'stale-listing-results-')
    const latestDraft = newestLocalFile(dir, 'stale-listing-drafts-')
    const resultRows = readJsonArray(latestResult?.file)
    const draftRows = readJsonArray(latestDraft?.file)
    const sent = resultRows.filter((row) => row.ok === true).length
    const failed = resultRows.filter((row) => row.ok === false || row.error).length
    const emailSet = new Set<string>()

    for (const row of resultRows.length ? resultRows : draftRows) {
      const email = String(row.email || row.agent_email || row.office_email || '').trim().toLowerCase()
      if (email) emailSet.add(email)
    }

    const marketCounts = new Map<string, number>()
    for (const row of draftRows) {
      const market = String(row.market || [row.city, row.state].filter(Boolean).join(', ')).trim()
      if (!market) continue
      marketCounts.set(market, (marketCounts.get(market) || 0) + 1)
    }

    const markets = [...marketCounts.entries()]
      .map(([market, count]) => ({ market, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
    const latestRunAt = latestResult ? new Date(latestResult.mtimeMs).toISOString() : null
    const latestDraftAt = latestDraft ? new Date(latestDraft.mtimeMs).toISOString() : null
    const totalResults = sent + failed
    const summary = latestResult
      ? `Latest public listing sweep sent ${sent}/${totalResults || sent} agent email${sent === 1 ? '' : 's'}${failed ? ` with ${failed} failed` : ' with no failures'}.`
      : latestDraft
        ? `Latest public listing sweep has ${draftRows.length} agent draft${draftRows.length === 1 ? '' : 's'} staged for review.`
        : 'No public on-market listing sweep has been generated yet.'

    return {
      latestRunAt,
      latestDraftAt,
      sent,
      failed,
      draftCount: draftRows.length,
      uniqueEmails: emailSet.size,
      markets,
      latestResultFile: latestResult?.name || null,
      latestDraftFile: latestDraft?.name || null,
      summary,
    }
  } catch {
    return {
      latestRunAt: null,
      latestDraftAt: null,
      sent: 0,
      failed: 0,
      draftCount: 0,
      uniqueEmails: 0,
      markets: [],
      latestResultFile: null,
      latestDraftFile: null,
      summary: 'Public on-market sweep telemetry is unavailable in this environment.',
    }
  }
}

function loadTaxCodeStack(): CommandCenterTaxCodeStack {
  const dir = path.join(process.cwd(), 'data', 'distress-leads')
  try {
    const latestSummary = newestLocalFile(dir, 'dealmachine-tax-code-stack-summary-')
    if (!latestSummary) {
      return {
        latestRunAt: null,
        writtenRows: 0,
        totalOutputRows: 0,
        markets: [],
        sourceNeededCount: 0,
        latestSummaryFile: null,
        summary: 'No tax-delinquent + code-violation stack has been built yet.',
      }
    }

    const parsed = JSON.parse(fs.readFileSync(latestSummary.file, 'utf8')) as Record<string, any>
    const marketSummaries = Array.isArray(parsed.marketSummaries) ? parsed.marketSummaries : []
    const markets = marketSummaries
      .map((row: Record<string, any>) => ({
        market: String(row.market || ''),
        stackedRows: Number(row.stackedRows || 0),
        taxDelinquentRows: Number(row.taxDelinquentRows || 0),
        codeViolationRows: Number(row.codeViolationRows || 0),
      }))
      .filter((row) => row.market)
      .slice(0, 6)
    const writtenRows = Number(parsed.writtenRows || 0)
    const totalOutputRows = Number(parsed.totalOutputRows || 0)
    const sourceNeededCount = Array.isArray(parsed.sourceNeeded) ? parsed.sourceNeeded.length : 0

    return {
      latestRunAt: new Date(latestSummary.mtimeMs).toISOString(),
      writtenRows,
      totalOutputRows,
      markets,
      sourceNeededCount,
      latestSummaryFile: latestSummary.name,
      summary: writtenRows
        ? `Latest tax/code stack wrote ${writtenRows} row${writtenRows === 1 ? '' : 's'} across ${markets.length} market${markets.length === 1 ? '' : 's'}.`
        : sourceNeededCount
          ? `Tax/code stack is waiting on ${sourceNeededCount} source input${sourceNeededCount === 1 ? '' : 's'}.`
          : 'Latest tax/code stack did not find matched rows.',
    }
  } catch {
    return {
      latestRunAt: null,
      writtenRows: 0,
      totalOutputRows: 0,
      markets: [],
      sourceNeededCount: 0,
      latestSummaryFile: null,
      summary: 'Tax/code stack telemetry is unavailable in this environment.',
    }
  }
}

function loadLocalSignals() {
  const dmExports: { file: string; ageDays: number }[] = []
  const localCommandCenterDir = path.join(process.cwd(), 'data', 'command-center')
  const propertyAnalysisRuns = loadLocalPropertyAnalysisMemory()
  const propertyBuyerPackets = readLocalJsonl(path.join(localCommandCenterDir, 'property-buyer-packets.jsonl')).map(
    normalizeLocalBuyerPacket
  )
  const dealPipelineItems = readLocalJsonl(path.join(localCommandCenterDir, 'deal-pipeline-items.jsonl')).map(
    normalizeLocalPipelineItem
  )
  const suppressionRecords: {
    email: string
    reason: string
    source: string
    propertyAddress?: string
    createdAt: string | null
  }[] = []
  let distressStackRows: number | null = null
  const onMarketSweep = loadOnMarketSweep()
  const taxCodeStack = loadTaxCodeStack()
  const dealMachineExportRequest = loadDealMachineExportRequest()

  try {
    const dir = path.join(process.cwd(), 'data', 'dm-exports')
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir)) {
        if (!name.toLowerCase().endsWith('.csv')) continue
        const stat = fs.statSync(path.join(dir, name))
        dmExports.push({ file: name, ageDays: Math.floor((Date.now() - stat.mtimeMs) / 864e5) })
      }
      dmExports.sort((a, b) => a.ageDays - b.ageDays)
    }
  } catch {
    // local filesystem unavailable (serverless) — fine
  }

  try {
    const master = path.join(process.cwd(), 'data', 'distress-leads', 'MASTER-distress-stack.csv')
    if (fs.existsSync(master)) {
      const text = fs.readFileSync(master, 'utf8')
      let count = 0
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++
      distressStackRows = Math.max(0, count - 1)
    }
  } catch {
    distressStackRows = null
  }

  try {
    const file = path.join(process.cwd(), 'data', 'outreach-suppressions.json')
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const email = String(row?.email || '').trim().toLowerCase()
          if (!email) continue
          suppressionRecords.push({
            email,
            reason: String(row?.reason || 'local_suppression'),
            source: String(row?.source || 'local_file'),
            propertyAddress: row?.property_address ? String(row.property_address) : undefined,
            createdAt: row?.created_at || row?.received_at || null,
          })
        }
      }
    }
  } catch {
    // local suppression file is optional
  }

  suppressionRecords.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))

  return {
    dmExports,
    onMarketSweep,
    taxCodeStack,
    dealMachineExportRequest,
    distressStackRows,
    suppressionRecords,
    propertyAnalysisRuns,
    propertyBuyerPackets,
    dealPipelineItems,
  }
}

function eventMetadata(event: AnyRow): Record<string, any> {
  const metadata = event.metadata_json || event.metadata || {}
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function outcomeStatus(event: AnyRow) {
  const metadata = eventMetadata(event)
  return lower(metadata.status || metadata.outreachStatus || event.status || event.title || event.summary)
}

export const FORECLOSURE_COUNTY_SOURCES: ForeclosureCountySource[] = [
  {
    key: 'milwaukee-wi',
    market: 'Milwaukee',
    county: 'Milwaukee County',
    state: 'WI',
    priority: 'home',
    cadence: 'daily',
    sources: ['Sheriff sale list', 'Court foreclosure docket', 'Property tax search', 'Code violations', 'Probate filings'],
    bestFirstSignals: ['tax_delinquency', 'code_violation', 'vacancy', 'foreclosure_filing', 'auction_postponed'],
    nextAdapter: 'Milwaukee sheriff + tax/code daily sheet',
  },
  {
    key: 'waukesha-wi',
    market: 'Waukesha',
    county: 'Waukesha County',
    state: 'WI',
    priority: 'core',
    cadence: 'weekly',
    sources: ['Sheriff sale list', 'Recorder liens', 'Property tax search', 'Probate filings'],
    bestFirstSignals: ['tax_delinquency', 'multiple_liens', 'foreclosure_filing', 'probate'],
    nextAdapter: 'Waukesha sheriff + tax weekly pull',
  },
  {
    key: 'lucas-oh',
    market: 'Toledo',
    county: 'Lucas County',
    state: 'OH',
    priority: 'core',
    cadence: 'daily',
    sources: ['Court foreclosure docket', 'Sheriff sales', 'Tax delinquency', 'Code violations', 'Eviction filings'],
    bestFirstSignals: ['foreclosure_filing', 'tax_delinquency', 'code_violation', 'eviction_landlord'],
    nextAdapter: 'Lucas foreclosure + code violation daily pull',
  },
  {
    key: 'cuyahoga-oh',
    market: 'Cleveland',
    county: 'Cuyahoga County',
    state: 'OH',
    priority: 'core',
    cadence: 'daily',
    sources: ['Court foreclosure docket', 'Sheriff sales', 'Treasurer tax delinquency', 'Code violations', 'Vacant registry'],
    bestFirstSignals: ['foreclosure_filing', 'tax_delinquency', 'code_violation', 'vacancy', 'auction_postponed'],
    nextAdapter: 'Cuyahoga court + tax/code daily pull',
  },
  {
    key: 'wayne-mi',
    market: 'Detroit',
    county: 'Wayne County',
    state: 'MI',
    priority: 'core',
    cadence: 'daily',
    sources: ['Sheriff sales', 'Treasurer tax delinquency', 'Code violations', 'Vacant registry', 'REO follow-up'],
    bestFirstSignals: ['tax_delinquency', 'code_violation', 'vacancy', 'failed_auction_reo'],
    nextAdapter: 'Wayne tax/code + REO follow-up pull',
  },
]

export const FORECLOSURE_EXIT_BUCKETS: ForeclosureExitBucket[] = [
  {
    key: 'cash_offer',
    label: 'Fast cash offer',
    fit: 'High equity, urgent seller, clean title path, or heavy distress where speed matters more than retail price.',
    guardrail: 'Keep offer non-binding until title, condition, access, and decision-maker authority are verified.',
  },
  {
    key: 'wholesale_assignment',
    label: 'Wholesale assignment',
    fit: 'Enough spread after repairs and fee, with a known buyer lane that can close quickly.',
    guardrail: 'Do not market a deal without assignable contract rights and accurate condition disclosure.',
  },
  {
    key: 'novation',
    label: 'Novation / retail lift',
    fit: 'Seller needs more than a cash offer but condition, photos, and access can support an agent or retail exit.',
    guardrail: 'Use attorney-reviewed documents and make representation, commission, and risk clear.',
  },
  {
    key: 'short_sale',
    label: 'Short sale path',
    fit: 'Low or negative equity with lender pressure where the lender may need to approve a reduced payoff.',
    guardrail: 'No promise of lender approval; require lender, attorney, and seller documentation review.',
  },
  {
    key: 'subject_to',
    label: 'Subject-to / arrears takeover',
    fit: 'Existing payment is attractive, arrears are manageable, and the seller understands the loan remains in their name.',
    guardrail: 'Owner-occupant and foreclosure situations need attorney review before any document or promise.',
  },
  {
    key: 'seller_finance',
    label: 'Seller finance',
    fit: 'Seller can wait for price, owns meaningful equity, or wants income instead of one cash check.',
    guardrail: 'Disclose terms clearly and avoid implying tax/legal advice.',
  },
  {
    key: 'investor_buyer_match',
    label: 'Investor buyer match',
    fit: 'Property fits a known buyer, builder, rental, or creative-finance buy box with enough margin.',
    guardrail: 'Do not overstate buyer demand; use confirmed buy-box notes and buyer packet proof.',
  },
  {
    key: 'lender_rescue_referral',
    label: 'Lender rescue / refi referral',
    fit: 'Seller wants to keep the property and has enough income/equity for a lender or counselor path.',
    guardrail: 'Make clear VestBlock is not guaranteeing foreclosure stoppage or credit approval.',
  },
  {
    key: 'attorney_housing_referral',
    label: 'Attorney / housing counselor referral',
    fit: 'Owner-occupant foreclosure, bankruptcy, probate, or legal distress where advice must come from licensed parties.',
    guardrail: 'Do not give legal advice; route to qualified counsel or HUD-approved housing resources.',
  },
  {
    key: 'surplus_funds_followup',
    label: 'Surplus funds follow-up',
    fit: 'Auction/REO outcome creates possible surplus, relocation, or second-touch opportunity.',
    guardrail: 'Follow state rules for surplus recovery and avoid upfront-fee foreclosure-rescue claims.',
  },
]

function uniqueValues<T extends string>(values: T[]) {
  return [...new Set(values)]
}

function boundedNumber(value: number | null | undefined, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(min, Math.min(max, parsed))
}

export function buildForeclosureLeadRoute(input: ForeclosureLeadSignalInput): ForeclosureLeadRoute {
  const signals: ForeclosureSignalKey[] = []
  if (input.taxDelinquent) signals.push('tax_delinquency')
  if (input.codeViolation) signals.push('code_violation')
  if (input.vacant) signals.push('vacancy')
  if (input.probate) signals.push('probate')
  if (input.bankruptcyDismissed) signals.push('bankruptcy_dismissal')
  if (input.evictionLandlord) signals.push('eviction_landlord')
  if (input.expiredListing) signals.push('expired_listing')
  if (input.multipleLiens) signals.push('multiple_liens')
  if (input.foreclosureFiled) signals.push('foreclosure_filing')
  if (input.auctionPostponed) signals.push('auction_postponed')
  if (input.failedAuctionReo) signals.push('failed_auction_reo')

  const equity = boundedNumber(input.equityPercent, 0, 100)
  const daysToSale = input.daysToSale == null ? null : boundedNumber(input.daysToSale, 0, 365)
  const buyerMatches = boundedNumber(input.buyerMatchCount, 0, 50)
  const lenderMatches = boundedNumber(input.lenderMatchCount, 0, 50)
  const rentalDemand = boundedNumber(input.rentalDemand, 0, 10)
  const arvSpread = boundedNumber(input.arvSpread, 0, 500000)
  const ownerOccupied = Boolean(input.ownerOccupied)
  const hasTaxCodeStack = Boolean(input.taxDelinquent && input.codeViolation)

  let score = 18
  score += Math.min(24, equity * 0.3)
  score += signals.length * 5
  if (hasTaxCodeStack) score += 12
  if (input.vacant && (input.taxDelinquent || input.codeViolation)) score += 8
  if (input.bankruptcyDismissed) score += 8
  if (input.auctionPostponed) score += 7
  score += Math.min(10, buyerMatches * 4)
  score += Math.min(6, lenderMatches * 3)
  if (rentalDemand >= 7) score += 6
  if (arvSpread >= 25000) score += 8
  if (daysToSale !== null && daysToSale <= 14) score += 12
  else if (daysToSale !== null && daysToSale <= 45) score += 7
  if (ownerOccupied && input.foreclosureFiled) score -= 5

  const buckets: ForeclosureExitBucketKey[] = []
  if (input.failedAuctionReo) {
    buckets.push('surplus_funds_followup', 'investor_buyer_match')
  } else if (input.foreclosureFiled && equity < 10) {
    buckets.push('short_sale', 'lender_rescue_referral')
  } else {
    if (equity >= 25) buckets.push('cash_offer', 'wholesale_assignment')
    if (equity >= 35 && buyerMatches > 0) buckets.push('investor_buyer_match')
    if (equity >= 20 && (input.expiredListing || (daysToSale !== null && daysToSale > 14))) buckets.push('novation')
    if (equity >= 15 && rentalDemand >= 6 && (input.evictionLandlord || input.absenteeOwner)) buckets.push('subject_to', 'seller_finance')
    if (lenderMatches > 0 && ownerOccupied) buckets.push('lender_rescue_referral')
  }
  if (ownerOccupied && input.foreclosureFiled) buckets.push('attorney_housing_referral')
  if (!buckets.length) buckets.push('cash_offer')

  const complianceFlags: string[] = []
  if (ownerOccupied && input.foreclosureFiled) {
    complianceFlags.push('Owner-occupant foreclosure: require attorney/housing-counselor language and no foreclosure-stop promises.')
  }
  if (input.bankruptcyDismissed) complianceFlags.push('Bankruptcy signal: avoid legal advice and verify case status before outreach.')
  if (input.probate) complianceFlags.push('Probate signal: verify personal representative authority before discussing terms.')
  if (daysToSale !== null && daysToSale <= 14) complianceFlags.push('Sale date under 14 days: urgent review, no guaranteed rescue claims.')

  const urgency: ForeclosureLeadRoute['urgency'] =
    daysToSale !== null && daysToSale <= 14 ? 'urgent' : signals.length >= 3 || score >= 65 ? 'active' : 'watch'
  const uniqueBuckets = uniqueValues(buckets)
  const bestExit =
    uniqueBuckets.find((bucket) => bucket === 'investor_buyer_match') ||
    uniqueBuckets.find((bucket) => bucket === 'novation') ||
    uniqueBuckets[0]

  const label = FORECLOSURE_EXIT_BUCKETS.find((bucket) => bucket.key === bestExit)?.label || 'Fast cash offer'
  const nextMove =
    urgency === 'urgent'
      ? `Run owner-safety compliance review, verify title/sale date, then prepare ${label.toLowerCase()} outreach.`
      : `Verify source evidence, run analyzer, and queue ${label.toLowerCase()} outreach with the right guardrails.`

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    urgency,
    signals: uniqueValues(signals),
    buckets: uniqueBuckets,
    bestExit,
    complianceFlags,
    nextMove,
  }
}

export function buildForeclosureCommandSnapshot(input: {
  buyerMatchesOpen?: number
  lenderMatchesOpen?: number
  freshDealMachineExports?: number
  sampleLead?: ForeclosureLeadSignalInput
} = {}): CommandCenterForeclosureCommand {
  const sampleRoute = buildForeclosureLeadRoute(
    input.sampleLead || {
      equityPercent: 42,
      daysToSale: 21,
      ownerOccupied: false,
      absenteeOwner: true,
      vacant: true,
      taxDelinquent: true,
      codeViolation: true,
      foreclosureFiled: true,
      buyerMatchCount: input.buyerMatchesOpen || 0,
      lenderMatchCount: input.lenderMatchesOpen || 0,
      rentalDemand: 7,
      arvSpread: 32000,
    }
  )
  const freshExports = Number(input.freshDealMachineExports || 0)
  const status: CommandStatus = sampleRoute.urgency === 'urgent' ? 'red' : freshExports > 0 ? 'green' : 'yellow'

  return {
    status,
    summary: `${FORECLOSURE_COUNTY_SOURCES.length} county lanes, ${FORECLOSURE_EXIT_BUCKETS.length} exit buckets, sample route ${sampleRoute.score}/100 into ${sampleRoute.bestExit.replace(/_/g, ' ')}.`,
    nextMove:
      freshExports > 0
        ? 'Ingest the latest DealMachine exports, stack public distress signals, then route each lead to the best exit before drafting.'
        : 'Build/export fresh DealMachine distress lists before sending; keep county evidence and exit route attached to each lead.',
    countySources: FORECLOSURE_COUNTY_SOURCES,
    exitBuckets: FORECLOSURE_EXIT_BUCKETS,
    starterPlays: [
      {
        key: 'foreclosure-county-checklists',
        label: 'County source checklists',
        difficulty: 'easy',
        testPath: 'scripts/test-command-center-ops.ts',
        reason: 'Pure config and command-center payload; easiest to verify without browser automation.',
      },
      {
        key: 'foreclosure-exit-routing',
        label: 'Exit-option routing',
        difficulty: 'easy',
        testPath: 'scripts/test-command-center-ops.ts',
        reason: 'Pure score/bucket function with deterministic inputs and no live data dependency.',
      },
      {
        key: 'auction-cancellation-watch',
        label: 'Auction cancellation watch',
        difficulty: 'medium',
        testPath: 'scripts/test-command-center-ops.ts + source adapter tests',
        reason: 'Model is simple, but each county source needs a separate adapter and freshness check.',
      },
      {
        key: 'bankruptcy-dismissal-watch',
        label: 'Bankruptcy dismissal watch',
        difficulty: 'hard',
        testPath: 'adapter-specific integration tests',
        reason: 'High value but court-source specific and compliance sensitive.',
      },
    ],
    sampleRoute,
    guardrails: [
      'No foreclosure-stop promises, no upfront foreclosure-rescue fees, and no bank/government impersonation.',
      'Use attorney-reviewed language for owner-occupant foreclosure, subject-to, short-sale, probate, and bankruptcy paths.',
      'Disclose VestBlock as an investor/buyer or buyer representative; never tell owners to avoid their lender or attorney.',
      'Keep cash offer, novation, short-sale, subject-to, seller-finance, and referral outreach in separate lanes.',
    ],
  }
}

function averageNumbers(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length)
}

function checklistMarket(row: AnyRow) {
  return [row.city, row.state].filter(Boolean).join(', ') || 'Unknown market'
}

function checklistIsClosed(row: AnyRow) {
  const status = lower(row.outreach_status || row.status)
  return ['sent', 'responded', 'do_not_contact', 'done', 'completed', 'complete', 'archived'].includes(status)
}

function checklistIsReady(row: AnyRow) {
  const status = lower(row.outreach_status || row.status)
  const confidence = Number(row.confidence_score || 0)
  return ['ready', 'approved'].includes(status) && confidence >= 60 && Boolean(row.contact_email || row.contact_phone)
}

export function buildOsintSourceBoard(input: {
  researchChecklists?: AnyRow[]
  dmExports?: { file: string; ageDays: number }[]
  taxCodeStack?: CommandCenterTaxCodeStack
  distressStackRows?: number | null
  foreclosureCommand?: CommandCenterForeclosureCommand
}): CommandCenterOsintSourceBoard {
  const checklists = input.researchChecklists || []
  const open = checklists.filter((row) => !checklistIsClosed(row))
  const ready = open.filter(checklistIsReady)
  const needsReview = open.filter((row) => lower(row.outreach_status || row.status) === 'needs_review')
  const blocked = open.filter((row) => lower(row.recommended_lane) === 'no_outreach' || lower(row.outreach_status || row.status) === 'not_ready')
  const averageConfidence = averageNumbers(open.map((row) => Number(row.confidence_score || 0)))
  const freshDmExports = (input.dmExports || []).filter((file) => file.ageDays <= 7)
  const taxCodeRows = Number(input.taxCodeStack?.writtenRows || 0)
  const publicStackRows = Number(input.distressStackRows || 0)
  const foreclosureLanes = input.foreclosureCommand?.countySources.length || FORECLOSURE_COUNTY_SOURCES.length

  const rawSourceCards = [
    {
      key: 'dealmachine-contacts',
      label: 'DealMachine Contacts',
      status: freshDmExports.length ? 'green' : (input.dmExports || []).length ? 'yellow' : 'red',
      cadence: 'export after list build',
      count: freshDmExports.length,
      signalScore: Math.min(100, freshDmExports.length * 18 + (ready.length ? 20 : 0)),
      detail: freshDmExports.length
        ? `${freshDmExports.length} fresh Contacts export${freshDmExports.length === 1 ? '' : 's'} with DNC visibility can feed checklists.`
        : 'No fresh Contacts export is visible; build/export before increasing seller sends.',
      nextAction: 'Export Contacts with phone type and DNC columns, then ingest into research checklists.',
    },
    {
      key: 'tax-code-stack',
      label: 'Tax + code stack',
      status: taxCodeRows > 0 ? 'green' : publicStackRows > 0 ? 'yellow' : 'red',
      cadence: 'daily public-record refresh',
      count: taxCodeRows || publicStackRows,
      signalScore: Math.min(100, Math.round((taxCodeRows || publicStackRows) / 25) + (taxCodeRows > 0 ? 35 : 10)),
      detail: taxCodeRows
        ? `${taxCodeRows} stacked tax/code row${taxCodeRows === 1 ? '' : 's'} available for higher-intent owner review.`
        : publicStackRows
          ? `${publicStackRows} public distress row${publicStackRows === 1 ? '' : 's'} need DealMachine/contact overlay.`
          : 'Public tax/code stack has no usable rows yet.',
      nextAction: taxCodeRows ? 'Route stacked rows into seller-options copy.' : 'Run the daily stack and overlay DealMachine Contacts.',
    },
    {
      key: 'county-foreclosure-watch',
      label: 'County foreclosure watch',
      status: input.foreclosureCommand?.status || 'yellow',
      cadence: 'daily core counties',
      count: foreclosureLanes,
      signalScore: Math.min(100, foreclosureLanes * 12 + (input.foreclosureCommand?.sampleRoute.score || 0) * 0.3),
      detail: `${foreclosureLanes} county source lane${foreclosureLanes === 1 ? '' : 's'} are configured for foreclosure, auction, tax, code, probate, and vacancy evidence.`,
      nextAction: 'Attach county evidence before choosing cash, novation, short-sale, subject-to, or referral copy.',
    },
    {
      key: 'research-checklist-qa',
      label: 'Research checklist QA',
      status: ready.length ? 'green' : needsReview.length ? 'yellow' : open.length ? 'yellow' : 'red',
      cadence: 'before outreach',
      count: open.length,
      signalScore: Math.min(100, (averageConfidence || 0) + Math.min(20, ready.length * 4)),
      detail: `${open.length} open checklist${open.length === 1 ? '' : 's'}; ${ready.length} ready and ${needsReview.length} need review.`,
      nextAction: ready.length ? 'Work ready checklists first, then move needs-review rows through owner/source validation.' : 'Create checklist rows from fresh exports and public source stacks.',
    },
  ] satisfies CommandCenterOsintSourceBoard['sourceCards']
  const sourceCards: CommandCenterOsintSourceBoard['sourceCards'] = rawSourceCards.map((card) => ({
    ...card,
    signalScore: Math.max(0, Math.min(100, Math.round(card.signalScore))),
  }))

  const marketMap = new Map<string, { market: string; count: number; ready: number; confidence: number[] }>()
  for (const row of open) {
    const market = checklistMarket(row)
    const entry = marketMap.get(market) || { market, count: 0, ready: 0, confidence: [] }
    entry.count += 1
    if (checklistIsReady(row)) entry.ready += 1
    entry.confidence.push(Number(row.confidence_score || 0))
    marketMap.set(market, entry)
  }

  const marketSignals = [...marketMap.values()]
    .map((row) => ({
      market: row.market,
      count: row.count,
      ready: row.ready,
      averageConfidence: averageNumbers(row.confidence),
    }))
    .sort((a, b) => b.ready - a.ready || b.count - a.count)
    .slice(0, 6)

  const redCount = sourceCards.filter((card) => card.status === 'red').length
  const greenCount = sourceCards.filter((card) => card.status === 'green').length
  const status: CommandStatus = redCount >= 2 ? 'red' : greenCount >= 2 ? 'green' : 'yellow'

  return {
    status,
    summary: `${sourceCards.length} OSINT source lane${sourceCards.length === 1 ? '' : 's'} online; ${ready.length} checklist${ready.length === 1 ? '' : 's'} ready and ${needsReview.length} need review.`,
    nextMove:
      ready.length > 0
        ? 'Work ready research checklists into the correct outreach lane before building more generic volume.'
        : freshDmExports.length
          ? 'Convert fresh DealMachine exports into research checklists, then stack county/tax/code evidence before sends.'
          : 'Build fresh DealMachine Contacts exports and public-record source evidence before new seller outreach.',
    totals: {
      checklists: open.length,
      ready: ready.length,
      needsReview: needsReview.length,
      blocked: blocked.length,
      averageConfidence,
    },
    sourceCards,
    marketSignals,
    actions: [
      navigateAction('osint-board-open-checklists', 'Open checklists', '/admin/research-checklists', 'primary'),
      navigateAction('osint-board-open-sources', 'Open lead sources', '/admin/lead-sources'),
      navigateAction('osint-board-open-research', 'Open research', '/admin/research'),
    ],
  }
}

export function buildOutcomeLearningSnapshot(input: {
  commandCenterEvents?: AnyRow[]
  replySignals7d: number
  propertyBuyerPacketSends?: AnyRow[]
}): CommandCenterOutcomeLearning {
  const outcomeEvents = (input.commandCenterEvents || [])
    .filter((event) => {
      const type = lower(event.event_type || event.eventType)
      return (
        type.includes('seller_reply') ||
        type.includes('lead_outcome') ||
        type.includes('outreach_reply') ||
        type === 'seller_reply_outcome'
      )
    })
    .sort((a, b) => Date.parse(b.occurred_at || b.occurredAt || b.created_at || '') - Date.parse(a.occurred_at || a.occurredAt || a.created_at || ''))

  const interested = outcomeEvents.filter((event) => outcomeStatus(event).includes('interested')).length
  const qualified = outcomeEvents.filter((event) => outcomeStatus(event).includes('qualified')).length
  const doNotContact = outcomeEvents.filter((event) => /do_not_contact|unsubscribe|opt.?out|suppression/.test(outcomeStatus(event))).length
  const followups = outcomeEvents.filter((event) => /followup|follow_up|follow-up/.test(outcomeStatus(event))).length
  const sellerReplies = outcomeEvents.filter((event) => /replied|reply|interested|qualified/.test(outcomeStatus(event))).length
  const buyerPacketsSent = (input.propertyBuyerPacketSends || []).filter((send) =>
    ['sent', 'opened', 'replied', 'interested'].includes(lower(send.status))
  ).length
  const buyerPacketReplies = (input.propertyBuyerPacketSends || []).filter((send) =>
    ['replied', 'interested'].includes(lower(send.status))
  ).length
  const lastEventAt = outcomeEvents[0]?.occurred_at || outcomeEvents[0]?.occurredAt || outcomeEvents[0]?.created_at || null

  const lessons: CommandCenterOutcomeLearning['lessons'] = [
    qualified > 0
      ? {
          label: 'Conversion before volume',
          detail: `${qualified} qualified seller signal${qualified === 1 ? '' : 's'} should be advanced before opening another batch.`,
          status: 'green',
        }
      : {
          label: 'Qualification gap',
          detail: 'No qualified seller outcomes are recorded yet. Keep asking for photos, access, asking price, and motivation in replies.',
          status: input.replySignals7d > 0 ? 'yellow' : 'red',
        },
    interested > 0
      ? {
          label: 'Interest pattern',
          detail: `${interested} interested seller outcome${interested === 1 ? '' : 's'} can teach the next segment and follow-up copy.`,
          status: 'green',
        }
      : {
          label: 'Interest pattern',
          detail: 'The system needs more interested replies before it can reliably tell which seller angle is pulling.',
          status: 'yellow',
        },
    doNotContact > 0
      ? {
          label: 'Suppression learning',
          detail: `${doNotContact} opt-out or suppression outcome${doNotContact === 1 ? '' : 's'} should tighten future source and copy rules.`,
          status: 'yellow',
        }
      : {
          label: 'Suppression learning',
          detail: 'No opt-out outcomes are recorded in the learning lane.',
        status: 'green',
      },
    buyerPacketsSent > 0
      ? {
          label: 'Disposition learning',
          detail:
            buyerPacketReplies > 0
              ? `${buyerPacketReplies} buyer packet reply signal${buyerPacketReplies === 1 ? '' : 's'} can tune buyer matching and packet content.`
              : `${buyerPacketsSent} buyer packet${buyerPacketsSent === 1 ? '' : 's'} sent. Watch replies to learn which buy boxes are real.`,
          status: buyerPacketReplies > 0 ? 'green' : 'yellow',
        }
      : {
          label: 'Disposition learning',
          detail: 'No buyer packets have been sent yet. Matching quality cannot improve until packets reach buyers and outcomes are tracked.',
          status: 'yellow',
        },
  ]

  const status: CommandStatus =
    qualified > 0 || interested > 0 ? 'green' : outcomeEvents.length > 0 || input.replySignals7d > 0 ? 'yellow' : 'red'
  const summary = outcomeEvents.length
    ? `${outcomeEvents.length} seller outcome event${outcomeEvents.length === 1 ? '' : 's'} captured for strategy learning.`
    : input.replySignals7d > 0
      ? `${input.replySignals7d} lead repl${input.replySignals7d === 1 ? 'y' : 'ies'} visible, but no seller outcome events were captured yet.`
      : 'No seller outcome learning events are visible yet.'
  const nextMove =
    qualified > 0
      ? 'Convert the qualified replies first, then let the strategy lab compare what produced them.'
      : interested > 0
        ? 'Move interested replies into analysis and collect condition/photos before the next large send.'
        : input.replySignals7d > 0
          ? 'Use command-center reply actions so every reply becomes a learning event.'
          : 'Run smaller strategy batches until replies start creating reusable outcome data.'

  return {
    status,
    totalEvents: outcomeEvents.length,
    sellerReplies,
    interested,
    qualified,
    doNotContact,
    followups,
    buyerPacketsSent,
    buyerPacketReplies,
    lastEventAt,
    summary,
    nextMove,
    lessons,
    recent: outcomeEvents.slice(0, 4).map((event) => ({
      title: String(event.title || 'Seller outcome'),
      summary: String(event.summary || eventMetadata(event).propertyAddress || 'Outcome recorded'),
      status: outcomeStatus(event) || 'logged',
      source: String(event.source || 'command_center'),
      occurredAt: event.occurred_at || event.occurredAt || event.created_at || null,
    })),
  }
}

export function buildOutboundGovernanceSnapshot(input: {
  sender: string
  dailyLimit: number
  sent24h: number
  remainingToday: number
  readyToSend: number
  needsReview: number
  replySignals7d: number
  bounceRiskLeads: number
  suppressionCount: number
  paidSourcesBlocked: number
  mailingAddressConfigured: boolean
  autoSendEnabled: boolean
  missingSuppressionDb: boolean
}): CommandCenterOutboundGovernance {
  const usingAcquisitions = lower(input.sender).includes('acquisitions@vestblock.io')
  const highBounceRisk = input.bounceRiskLeads >= 10
  const status: CommandStatus =
    input.missingSuppressionDb || !input.mailingAddressConfigured
      ? 'red'
      : !usingAcquisitions || highBounceRisk || input.needsReview > input.readyToSend
        ? 'yellow'
        : 'green'
  const nextGate =
    input.missingSuppressionDb
      ? 'Restore suppression visibility before live sends.'
      : !input.mailingAddressConfigured
        ? 'Configure the physical mailing address before scaled email.'
        : !usingAcquisitions
          ? 'Move seller sends onto acquisitions@vestblock.io before volume.'
          : input.replySignals7d > 0
            ? 'Work replies before increasing batch size.'
            : input.remainingToday <= 0
              ? 'Daily email cap is reached.'
              : input.readyToSend <= 0
                ? 'Generate or approve more seller drafts.'
                : `Safe to push up to ${Math.min(input.remainingToday, input.readyToSend)} seller email${Math.min(input.remainingToday, input.readyToSend) === 1 ? '' : 's'} from the ready queue.`

  return {
    status,
    sender: input.sender,
    dailyLimit: input.dailyLimit,
    sent24h: input.sent24h,
    remainingToday: input.remainingToday,
    readyToSend: input.readyToSend,
    needsReview: input.needsReview,
    replySignals7d: input.replySignals7d,
    bounceRiskLeads: input.bounceRiskLeads,
    suppressionCount: input.suppressionCount,
    paidSourcesBlocked: input.paidSourcesBlocked,
    nextGate,
    checks: [
      {
        label: 'Sender',
        value: usingAcquisitions ? 'acquisitions' : 'review',
        helper: input.sender,
        status: usingAcquisitions ? 'green' : 'yellow',
      },
      {
        label: 'Compliance',
        value: input.mailingAddressConfigured ? 'ready' : 'blocked',
        helper: input.autoSendEnabled ? 'auto-send enabled' : 'manual approval',
        status: input.mailingAddressConfigured ? 'green' : 'red',
      },
      {
        label: 'Suppressions',
        value: input.suppressionCount,
        helper: input.missingSuppressionDb ? 'database unavailable' : 'visible',
        status: input.missingSuppressionDb ? 'red' : 'green',
      },
      {
        label: 'Bounce risk',
        value: input.bounceRiskLeads,
        helper: highBounceRisk ? 'clean before scaling' : 'within guardrail',
        status: highBounceRisk ? 'yellow' : 'green',
      },
      {
        label: 'Paid sources',
        value: input.paidSourcesBlocked,
        helper: input.paidSourcesBlocked ? 'blocked until revenue' : 'no paid source pressure',
        status: 'green',
      },
    ],
  }
}

function buyBoxSuggestedLane(row: AnyRow) {
  const route = lower(row.primary_route_label || row.primaryRouteLabel || row.builder_label || '')
  const repairBudget = Number(row.repair_budget || row.repairBudget || 0)
  const grade = lower(row.grade)
  const profit = Number(row.end_buyer_profit || row.endBuyerProfit || 0)

  if (/seller.?finance|subject.?to|wrap|lease.?option|creative/.test(route)) {
    return { lane: 'creative', label: 'Creative route', reason: 'Route language points to seller finance, subject-to, wrap, or lease-option terms.' }
  }
  if (/builder|developer|infill|land|heavy|rehab/.test(route) || repairBudget >= 25000) {
    return { lane: 'builders', label: 'Builder / developer', reason: 'Repair, infill, land, or builder signal is strongest.' }
  }
  if (/dscr|private|lender|capital|funding/.test(route)) {
    return { lane: 'lenders', label: 'Capital route', reason: 'Route fit points to financing or capital placement.' }
  }
  if (grade === 'good' || profit > 0) {
    return { lane: 'buyers', label: 'Buyer dispo', reason: 'Positive buyer-profit or GOOD math can move into buyer matching.' }
  }
  return { lane: 'buyers', label: 'Buyer review', reason: 'Default to buyer review until analysis or partner criteria adds a stronger path.' }
}

export function buildBuyBoxGraphSnapshot(input: {
  propertyAnalysisRuns?: AnyRow[]
  buyers?: AnyRow[]
  lenders?: AnyRow[]
  investorPipelineRows?: { investor: AnyRow; pipeline: AnyRow }[]
  pendingBuyerMatches: number
  pendingLenderMatches: number
}): CommandCenterBuyBoxGraph {
  const properties = (input.propertyAnalysisRuns || [])
    .slice()
    .sort((a, b) => Date.parse(b.created_at || b.createdAt || '') - Date.parse(a.created_at || a.createdAt || ''))
    .slice(0, 5)
  const buyers = (input.buyers || []).filter((buyer) => String(buyer.contact_email || buyer.email || '').trim())
  const lenders = (input.lenders || []).filter((lender) => String(lender.contact_email || lender.email || '').trim())
  const builders = (input.investorPipelineRows || []).filter(
    (item) => item.pipeline?.builderLane || item.pipeline?.buyBoxConfirmed || item.pipeline?.dealMachineAligned
  )
  const investorText = (item: { investor: AnyRow; pipeline: AnyRow }) =>
    [
      item.investor?.display_name,
      item.investor?.company_name,
      item.investor?.primary_investor_type,
      item.investor?.notes,
      item.investor?.investment_criteria,
      item.investor?.buy_box_notes,
      ...(Array.isArray(item.investor?.classification_tags) ? item.investor.classification_tags : []),
    ]
      .filter(Boolean)
      .join(' ')
  const multifamilyProfiles = (input.investorPipelineRows || []).filter((item) =>
    /multifamily|multi family|apartment|duplex|triplex|fourplex|portfolio|1031|doors/i.test(investorText(item))
  )
  const btrProfiles = (input.investorPipelineRows || []).filter((item) =>
    /build.?to.?rent|btr|sfr|single.?family rental|rental aggregator|institutional/i.test(investorText(item))
  )
  const commercialProfiles = (input.investorPipelineRows || []).filter((item) =>
    /commercial|industrial|small.?bay|storage|warehouse|mixed.?use|flex|retail|office|redevelopment/i.test(investorText(item))
  )
  const novationProfiles = (input.investorPipelineRows || []).filter((item) =>
    /novation|retail.?spread|market.?assisted|agent partner|list.?to.?sell/i.test(investorText(item))
  )
  const creativeProfiles = (input.investorPipelineRows || []).filter((item) =>
    /creative|seller.?finance|subject.?to|wrap|lease/i.test(
      [item.investor?.display_name, item.investor?.notes, item.investor?.investment_criteria, item.investor?.buy_box_notes]
        .filter(Boolean)
        .join(' ')
    )
  )
  const lanes: CommandCenterBuyBoxGraph['lanes'] = [
    {
      key: 'buyers',
      label: 'Buyer dispo',
      count: buyers.length,
      detail: `${input.pendingBuyerMatches} open buyer match${input.pendingBuyerMatches === 1 ? '' : 'es'}.`,
      status: buyers.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'lenders',
      label: 'Capital route',
      count: lenders.length,
      detail: `${input.pendingLenderMatches} open lender match${input.pendingLenderMatches === 1 ? '' : 'es'}.`,
      status: lenders.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'builders',
      label: 'Builder / developer',
      count: builders.length,
      detail: 'Profiles with builder lane, DealMachine alignment, or confirmed criteria.',
      status: builders.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'multifamily',
      label: 'Multifamily operators',
      count: multifamilyProfiles.length,
      detail: 'Duplex, small apartment, portfolio, 1031, and door-count buyer criteria.',
      status: multifamilyProfiles.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'btr',
      label: 'BTR / SFR institutions',
      count: btrProfiles.length,
      detail: 'Build-to-rent, SFR aggregator, and institutional rental-buyer criteria.',
      status: btrProfiles.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'commercial',
      label: 'Commercial operators',
      count: commercialProfiles.length,
      detail: 'Small-bay, storage, mixed-use, flex, retail, and redevelopment appetite.',
      status: commercialProfiles.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'novation',
      label: 'Novation partners',
      count: novationProfiles.length,
      detail: 'Disclosed market-assisted and retail-spread operator coverage.',
      status: novationProfiles.length > 0 ? 'green' : 'yellow',
    },
    {
      key: 'creative',
      label: 'Creative finance',
      count: creativeProfiles.length,
      detail: 'Profiles that mention creative, subject-to, wrap, seller finance, or lease-option appetite.',
      status: creativeProfiles.length > 0 ? 'green' : 'yellow',
    },
  ]

  const recentProperties = properties.map((row) => {
    const suggestion = buyBoxSuggestedLane(row)
    const market = [row.city, row.state].filter(Boolean).join(', ') || 'Market pending'
    return {
      id: String(row.id || row.property_address || row.propertyAddress),
      propertyAddress: String(row.property_address || row.propertyAddress || 'Property analysis'),
      market,
      grade: String(row.grade || 'Needs details'),
      route: String(row.primary_route_label || row.primaryRouteLabel || 'Route pending'),
      suggestedLane: suggestion.label,
      routeReason: suggestion.reason,
      createdAt: row.created_at || row.createdAt || null,
    }
  })

  const stockedLaneCount = lanes.filter((lane) => lane.count > 0).length
  const status: CommandStatus =
    recentProperties.length === 0 ? 'yellow' : stockedLaneCount >= 3 ? 'green' : stockedLaneCount >= 1 ? 'yellow' : 'red'
  const summary = recentProperties.length
    ? `${recentProperties.length} saved deal twin${recentProperties.length === 1 ? '' : 's'} can route across ${stockedLaneCount}/${lanes.length} partner lanes without ranking.`
    : 'No saved deal twins are ready for buy-box routing yet.'
  const nextMove =
    recentProperties.length === 0
      ? 'Save a command-center property analysis, then route it to buyers, lenders, builders, or creative finance lanes.'
      : stockedLaneCount < 3
        ? 'Stock the missing buyer, lender, builder, or creative profiles before scaling assignments.'
        : 'Route each saved analysis into the strongest lane and record the outcome.'

  return {
    status,
    summary,
    nextMove,
    lanes,
    recentProperties,
    actions: [
      navigateAction('buy-box-open-buyers', 'Open buyers', '/admin/buyers'),
      navigateAction('buy-box-open-lenders', 'Open lenders', '/admin/lenders'),
      navigateAction('buy-box-open-builders', 'Open builders', '/admin/investor-partnerships?lane=builder'),
      navigateAction('buy-box-open-property', 'Property command', '#property-command', 'primary'),
    ],
  }
}

export function buildDealPipelineSnapshot(input: {
  dealPipelineItems?: AnyRow[]
  propertyBuyerPackets?: AnyRow[]
  propertyBuyerPacketSends?: AnyRow[]
}): CommandCenterDealPipeline {
  const stageOrder = [
    { key: 'diligence_required', label: 'Diligence Required' },
    { key: 'analyzed', label: 'Analyzed' },
    { key: 'offer_sent', label: 'Offer Sent' },
    { key: 'under_contract', label: 'Under Contract' },
    { key: 'buyer_packet_sent', label: 'Packet Sent' },
    { key: 'buyer_interested', label: 'Buyer Interested' },
    { key: 'assignment_drafted', label: 'Assignment Drafted' },
    { key: 'closed_won', label: 'Closed Won' },
  ]
  const activeItems = (input.dealPipelineItems || []).filter(
    (item) => !['closed_lost', 'archived'].includes(lower(item.current_stage))
  )
  const packets = input.propertyBuyerPackets || []
  const sends = input.propertyBuyerPacketSends || []
  const sentSends = sends.filter((send) => ['sent', 'opened', 'replied', 'interested'].includes(lower(send.status)))
  const replySends = sends.filter((send) => ['replied', 'interested'].includes(lower(send.status)))

  const stages: CommandCenterDealPipeline['stages'] = stageOrder.map((stage) => {
    const items = activeItems
      .filter((item) => lower(item.current_stage) === stage.key)
      .sort((a, b) => Date.parse(b.updated_at || b.created_at || '') - Date.parse(a.updated_at || a.created_at || ''))
      .slice(0, 4)
      .map((item) => ({
        id: String(item.id),
        propertyAddress: String(item.property_address || 'Property'),
        market: [item.city, item.state].filter(Boolean).join(', ') || 'Market pending',
        stage: String(item.stage_label || stage.label),
        priority: String(item.priority || 'normal'),
        nextAction: String(item.next_action || 'Review the next operator move.'),
        sentCount: Number(item.buyer_packet_sent_count || 0),
        replyCount: Number(item.buyer_reply_count || 0),
        updatedAt: item.updated_at || item.created_at || null,
      }))

    return {
      key: stage.key,
      label: stage.label,
      count: activeItems.filter((item) => lower(item.current_stage) === stage.key).length,
      value: activeItems
        .filter((item) => lower(item.current_stage) === stage.key)
        .reduce((sum, item) => sum + Number(item.estimated_assignment_fee || item.expected_profit || 0), 0),
      items,
    }
  })

  const packetReady = packets.filter((packet) => ['ready', 'ready_for_review', 'partial'].includes(lower(packet.status))).length
  const packetSent = packets.filter((packet) => ['sent', 'partial'].includes(lower(packet.status))).length
  const activeDeals = activeItems.length
  const status: CommandStatus =
    activeDeals === 0 && packets.length === 0 ? 'yellow' : packetReady > 0 || sentSends.length > 0 ? 'green' : 'yellow'
  const summary =
    activeDeals > 0
      ? `${activeDeals} active pipeline deal${activeDeals === 1 ? '' : 's'}, ${packetSent} packet${packetSent === 1 ? '' : 's'} sent, ${replySends.length} buyer reply signal${replySends.length === 1 ? '' : 's'}.`
      : packets.length > 0
        ? `${packets.length} buyer packet${packets.length === 1 ? '' : 's'} exist, but no active pipeline item is visible yet.`
        : 'No deal pipeline items exist yet. Run an analysis, match buyers, and send the first packet.'
  const nextMove =
    replySends.length > 0
      ? 'Move buyer replies into assignment terms or buyer-interest stage.'
      : packetReady > 0
        ? 'Send ready buyer packets to matched buyers and track replies.'
        : activeDeals > 0
          ? 'Advance analyzed deals into offers, contracts, or packet sends.'
          : 'Create a buyer packet from the next command-center analysis.'

  return {
    status,
    summary,
    nextMove,
    totals: {
      activeDeals,
      packetReady,
      packetSent,
      buyerReplies: replySends.length,
    },
    stages,
    recentPackets: packets.slice(0, 5).map((packet) => ({
      id: String(packet.id),
      propertyAddress: String(packet.property_address || 'Property packet'),
      status: String(packet.status || 'ready'),
      selectedBuyerCount: Number(packet.selected_buyer_count || 0),
      sentCount: Number(packet.sent_count || 0),
      repliedCount: Number(packet.replied_count || 0),
      createdAt: packet.created_at || null,
    })),
  }
}

async function loadTables(admin: SupabaseClient<any, any, any>, issues: DataSourceIssue[]) {
  const [
    leads,
    outreachMessages,
    outreachSendEvents,
    buyers,
    buyerOutreach,
    buyerMatches,
    lenders,
    lenderOutreach,
    lenderMatches,
    investors,
    investorFollowUps,
    payments,
    fundingPayments,
    contentAssets,
    seoOpportunities,
    prTargets,
    prPitches,
    scrapeRuns,
    buyerDiscoveryRuns,
    lenderDiscoveryRuns,
    investorAutomationRuns,
    adminTasks,
    leadSuppressions,
    dailyReports,
    strategyDailyReports,
    researchChecklists,
    targetMarkets,
    propertyAnalysisRuns,
    commandCenterEvents,
    commandCenterJobs,
    commandCenterStrategyRuns,
    commandCenterReplyMemory,
    commandCenterOutboundEnrollments,
    commandCenterSuppressionDecisions,
    strategySourceEvents,
    propertyBuyerPackets,
    propertyBuyerPacketSends,
    dealPipelineItems,
  ] = await Promise.all([
    safeRows(
      () =>
        admin
          .from('leads')
          .select(
            'id,name,business_name,property_address,email,phone,email_valid,status,outreach_status,source,city,state,lead_score,lead_type,delivery_status,bounce_risk_score,created_at,updated_at,last_contacted_at,next_follow_up_at'
          )
          .order('created_at', { ascending: false }),
      'leads',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('outreach_messages')
          .select('id,lead_id,status,channel,subject,approved_at,sent_at,created_at,updated_at')
          .order('updated_at', { ascending: false }),
      'outreach_messages',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('outreach_send_events')
          .select('id,lead_id,outreach_message_id,channel,status,subject,created_at')
          .order('created_at', { ascending: false }),
      'outreach_send_events',
      issues,
      { maxRows: 5000 }
    ),
    safeRows(
      () =>
        admin
          .from('buyers')
          .select('id,company_name,contact_email,relationship_stage,outreach_status,state,next_follow_up_at,last_contacted_at,created_at,updated_at'),
      'buyers',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('buyer_outreach_messages')
          .select('id,buyer_id,status,channel,subject,approved_at,sent_at,created_at,updated_at'),
      'buyer_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('buyer_matches').select('*'), 'buyer_matches', issues, { maxRows: 1000 }),
    safeRows(
      () =>
        admin
          .from('lenders')
          .select('id,company_name,contact_email,relationship_stage,outreach_status,state,next_follow_up_at,last_contacted_at,created_at,updated_at'),
      'lenders',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('lender_outreach_messages')
          .select('id,lender_id,status,channel,subject,approved_at,sent_at,created_at,updated_at'),
      'lender_outreach_messages',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('lender_matches').select('*'), 'lender_matches', issues, { maxRows: 1000 }),
    safeRows(() => admin.from('investor_profiles').select('*'), 'investor_profiles', issues, { maxRows: 1000 }),
    safeRows(() => admin.from('investor_follow_up_tasks').select('*'), 'investor_follow_up_tasks', issues, {
      maxRows: 500,
    }),
    safeRows(() => admin.from('payments').select('amount,status,created_at,updated_at'), 'payments', issues, {
      maxRows: 2000,
    }),
    safeRows(
      () => admin.from('funding_payments').select('amount_paid,status,created_at,updated_at'),
      'funding_payments',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(
      () =>
        admin
          .from('content_assets')
          .select('id,status,content_type,service_key,indexed_status,published_at,created_at,updated_at')
          .order('updated_at', { ascending: false }),
      'content_assets',
      issues,
      { maxRows: 2000 }
    ),
    safeRows(() => admin.from('entity_seo_opportunities').select('*'), 'entity_seo_opportunities', issues, {
      maxRows: 500,
    }),
    safeRows(() => admin.from('pr_targets').select('*'), 'pr_targets', issues, { maxRows: 500 }),
    safeRows(() => admin.from('pr_pitch_drafts').select('*'), 'pr_pitch_drafts', issues, { maxRows: 500 }),
    safeRows(
      () =>
        admin
          .from('scrape_runs')
          .select('id,source_key,status,result_count,started_at,completed_at,created_at')
          .order('created_at', { ascending: false }),
      'scrape_runs',
      issues,
      { maxRows: 300 }
    ),
    safeRows(
      () =>
        admin
          .from('buyer_outreach_runs')
          .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,completed_at')
          .in('run_type', ['daily_pipeline', 'daily_discovery', 'discovery'])
          .order('started_at', { ascending: false }),
      'buyer_outreach_runs',
      issues,
      { maxRows: 300 }
    ),
    safeRows(
      () =>
        admin
          .from('lender_outreach_runs')
          .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,completed_at')
          .in('run_type', ['daily_discovery', 'discovery'])
          .order('started_at', { ascending: false }),
      'lender_outreach_runs',
      issues,
      { maxRows: 300 }
    ),
    safeRows(
      () =>
        admin
          .from('investor_automation_runs')
          .select('id,source_key,run_type,status,result_count,request_params,error_message,started_at,finished_at')
          .in('run_type', ['daily_discovery', 'discovery'])
          .order('started_at', { ascending: false }),
      'investor_automation_runs',
      issues,
      { maxRows: 300 }
    ),
    safeRows(
      () =>
        admin
          .from('admin_tasks')
          .select('id,title,description,task_type,status,priority,due_at,created_at,updated_at,entity_type,entity_id,user_email,metadata_json')
          .order('created_at', { ascending: false }),
      'admin_tasks',
      issues,
      { maxRows: 500 }
    ),
    safeRows(
      () =>
        admin
          .from('lead_suppressions')
          .select('id,email,phone,website,business_name,city,state,reason,status,created_at,updated_at')
          .order('created_at', { ascending: false }),
      'lead_suppressions',
      issues,
      { maxRows: 1000 }
    ),
    safeRows(
      () =>
        admin
          .from('daily_growth_reports')
          .select('id,report_date,leads_summary,lenders_summary,buyers_summary,recommended_actions,summary_json,created_at,updated_at')
          .order('report_date', { ascending: false }),
      'daily_growth_reports',
      issues,
      { maxRows: 10 }
    ),
    optionalRows(
      () =>
        admin
          .from('strategy_daily_reports')
          .select('id,report_date,status,cities_attempted,sources_attempted,leads_discovered,leads_qualified,drafts_created,accepted_count,delivered_count,reply_count,report_json,created_at,updated_at')
          .order('report_date', { ascending: false }),
      'strategy_daily_reports',
      issues,
      { maxRows: 14 }
    ),
    safeRows(() => admin.from('osint_research_checklists').select('*'), 'osint_research_checklists', issues, {
      maxRows: 500,
    }),
    safeRows(() => admin.from('target_markets').select('*'), 'target_markets', issues, { maxRows: 250 }),
    optionalRows(
      () =>
        admin
          .from('property_analysis_runs')
          .select(
            'id,property_address,city,state,zip_code,analysis_source,estimate_value,arv,repair_budget,assignment_fee,mao,seller_ask,spread,end_buyer_profit,grade,deal_strength_score,deal_strength_label,primary_route_key,primary_route_label,primary_route_score,buyer_interest_label,buyer_interest_score,builder_label,next_action,created_at'
          )
          .order('created_at', { ascending: false }),
      'property_analysis_runs',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_events')
          .select('id,event_type,entity_type,entity_id,source,title,summary,priority,status,occurred_at,created_at,metadata_json')
          .order('occurred_at', { ascending: false }),
      'command_center_events',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_jobs')
          .select('id,job_key,job_type,title,status,cadence,priority,strategy_key,source_provider,market,next_run_at,last_run_at,last_status,last_error,config_json,metrics_json')
          .order('priority', { ascending: false }),
      'command_center_jobs',
      issues,
      { maxRows: 100 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_strategy_runs')
          .select('id,run_key,strategy_key,strategy_name,status,source_provider,market,target_email_count,target_sms_count,lead_count,qualified_count,draft_count,approved_count,sent_count,accepted_count,delivered_count,reply_count,bounce_count,sms_review_count,suppression_blocked_count,cost_guardrail_status,source_error,artifact_path,created_at,completed_at,metadata_json')
          .order('created_at', { ascending: false }),
      'command_center_strategy_runs',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_reply_memory')
          .select('id,strategy_key,mailbox,from_email,subject,property_address,market,classification,received_at,next_step,reply_summary')
          .order('received_at', { ascending: false }),
      'command_center_reply_memory',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_outbound_enrollments')
          .select('id,strategy_key,channel,status,market,next_action_at,last_message_id,created_at,updated_at,metadata_json')
          .order('updated_at', { ascending: false }),
      'command_center_outbound_enrollments',
      issues,
      { maxRows: 2000 }
    ),
    optionalRows(
      () =>
        admin
          .from('command_center_suppression_decisions')
          .select('id,strategy_key,channel,matched_value,decision,reason,created_at,metadata_json')
          .order('created_at', { ascending: false }),
      'command_center_suppression_decisions',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('strategy_source_events')
          .select('id,provider,external_event_id,event_type,strategy_key,market,status,rows_received,rows_ingested,error_message,occurred_at,processed_at,created_at,updated_at,payload_json')
          .order('created_at', { ascending: false }),
      'strategy_source_events',
      issues,
      { maxRows: 2000 }
    ),
    optionalRows(
      () =>
        admin
          .from('property_buyer_packets')
          .select('id,property_analysis_run_id,property_address,city,state,zip_code,status,selected_buyer_count,sent_count,opened_count,replied_count,last_sent_at,created_at,updated_at,metadata_json')
          .order('created_at', { ascending: false }),
      'property_buyer_packets',
      issues,
      { maxRows: 500 }
    ),
    optionalRows(
      () =>
        admin
          .from('property_buyer_packet_sends')
          .select('id,buyer_packet_id,buyer_id,buyer_match_id,buyer_email,subject,status,send_provider,sent_at,opened_at,replied_at,created_at,updated_at,metadata_json')
          .order('created_at', { ascending: false }),
      'property_buyer_packet_sends',
      issues,
      { maxRows: 1000 }
    ),
    optionalRows(
      () =>
        admin
          .from('deal_pipeline_items')
          .select('id,property_analysis_run_id,buyer_packet_id,lead_id,property_address,city,state,zip_code,current_stage,stage_label,priority,deal_grade,deal_strength_score,buyer_packet_sent_count,buyer_reply_count,estimated_assignment_fee,expected_profit,next_action,next_action_at,created_at,updated_at,metadata_json')
          .order('updated_at', { ascending: false }),
      'deal_pipeline_items',
      issues,
      { maxRows: 500 }
    ),
  ])

  return {
    leads,
    outreachMessages,
    outreachSendEvents,
    buyers,
    buyerOutreach,
    buyerMatches,
    lenders,
    lenderOutreach,
    lenderMatches,
    investors,
    investorFollowUps,
    payments,
    fundingPayments,
    contentAssets,
    seoOpportunities,
    prTargets,
    prPitches,
    scrapeRuns,
    buyerDiscoveryRuns,
    lenderDiscoveryRuns,
    investorAutomationRuns,
    adminTasks,
    leadSuppressions,
    dailyReports,
    strategyDailyReports,
    researchChecklists,
    targetMarkets,
    propertyAnalysisRuns,
    commandCenterEvents,
    commandCenterJobs,
    commandCenterStrategyRuns,
    commandCenterReplyMemory,
    commandCenterOutboundEnrollments,
    commandCenterSuppressionDecisions,
    strategySourceEvents,
    propertyBuyerPackets,
    propertyBuyerPacketSends,
    dealPipelineItems,
  }
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const admin = createAdminClient()
  const issues: DataSourceIssue[] = []
  const [t, deliveryEvidence, researchSourceHealth] = await Promise.all([
    loadTables(admin, issues),
    getDeliveryCircuitBreaker(),
    loadResearchSourceHealth(),
  ])
  const local = loadLocalSignals()
  const databaseDealMachineFreshness = buildDatabaseDealMachineFreshness(t.strategySourceEvents)
  const propertyAnalysisRuns = mergeRowsById(t.propertyAnalysisRuns, local.propertyAnalysisRuns)
  const propertyBuyerPackets = mergeRowsById(t.propertyBuyerPackets, local.propertyBuyerPackets)
  const dealPipelineItems = mergeRowsById(t.dealPipelineItems, local.dealPipelineItems)
  const liveDataReachable = issues.length === 0
  const dealMemory = buildDealMemorySnapshot(propertyAnalysisRuns)
  const sourceGovernor = buildSourceGovernorSnapshot({
    scrapeRuns: t.scrapeRuns,
    dealMachineExports: local.dmExports,
  })

  // ── Shared signals ─────────────────────────────────────────────────────────
  const outreachTarget = envInt('LEADS_TARGET_EMAILS_PER_DAY', 500)
  const revenueTarget = envInt('VESTBLOCK_MONTHLY_REVENUE_TARGET', 100000)

  const leadById = new Map(t.leads.map((lead) => [lead.id, lead]))
  const buyerById = new Map(t.buyers.map((buyer) => [buyer.id, buyer]))
  const lenderById = new Map(t.lenders.map((lender) => [lender.id, lender]))
  const currentLeads = t.leads.filter(isCurrentVestblockLead)
  const currentLeadIds = new Set(currentLeads.map((lead) => lead.id))
  const currentOutreachMessages = t.outreachMessages.filter((message) => !isLegacyLeadOutreachMessage(message, leadById))
  const currentOutreachSendEvents = t.outreachSendEvents.filter(
    (event) => !event.lead_id || currentLeadIds.has(event.lead_id)
  )
  const activeBuyerOutreach = t.buyerOutreach.filter((message) => lower(message.status) !== 'archived')
  const activeLenderOutreach = t.lenderOutreach.filter((message) => lower(message.status) !== 'archived')
  const legacyLeadOutreachCount = t.outreachMessages.length - currentOutreachMessages.length
  const investorPipelineRows = t.investors.map((investor) => ({
    investor,
    pipeline: buildInvestorPipelineSnapshotFromRecord(investor as any),
  }))
  const builderPartners = investorPipelineRows.filter((item) => item.pipeline.builderLane).length
  const dealMachineAlignedPartners = investorPipelineRows.filter((item) => item.pipeline.dealMachineAligned).length
  const partnerResearchReady = investorPipelineRows.filter((item) => item.pipeline.researchReady).length
  const partnerOutreachReady = investorPipelineRows.filter((item) => item.pipeline.outreachReady).length
  const partnerBuyBoxesConfirmed = investorPipelineRows.filter((item) => item.pipeline.buyBoxConfirmed).length
  const partnerResearchBlocked = investorPipelineRows.filter(
    (item) => !item.pipeline.outreachReady && ['discovered', 'researched', 'buy_box_inferred'].includes(item.pipeline.stage)
  ).length

  const newLeads24h = currentLeads.filter((lead) => withinHours(lead.created_at, 24)).length
  const newLeads7d = currentLeads.filter((lead) => withinDays(lead.created_at, 7)).length

  const allLeadSends24h = t.outreachSendEvents.filter(
    (event) => ['accepted', 'sent'].includes(lower(event.status)) && lower(event.channel) === 'email' && withinHours(event.created_at, 24)
  ).length
  const partnerSends24h =
    activeLenderOutreach.filter((m) => lower(m.status) === 'sent' && withinHours(m.sent_at || m.updated_at, 24)).length +
    activeBuyerOutreach.filter((m) => lower(m.status) === 'sent' && withinHours(m.sent_at || m.updated_at, 24)).length
  const outreach24h = allLeadSends24h + partnerSends24h
  const sends7d =
    currentOutreachSendEvents.filter((event) => ['accepted', 'sent'].includes(lower(event.status)) && withinDays(event.created_at, 7)).length +
    activeLenderOutreach.filter((m) => lower(m.status) === 'sent' && withinDays(m.sent_at || m.updated_at, 7)).length +
    activeBuyerOutreach.filter((m) => lower(m.status) === 'sent' && withinDays(m.sent_at || m.updated_at, 7)).length

  const sendReady = currentOutreachMessages.filter(
    (m) => lower(m.channel) === 'email' && ['approved', 'queued'].includes(lower(m.status))
  ).length
  const needsReview = currentOutreachMessages.filter(
    (m) => lower(m.channel) === 'email' && lower(m.status) === 'needs_review'
  ).length
  const buyerApproved = activeBuyerOutreach.filter((message) => lower(message.status) === 'approved').length
  const buyerNeedsReview = activeBuyerOutreach.filter((message) => lower(message.status) === 'needs_review').length
  const lenderApproved = activeLenderOutreach.filter((message) => lower(message.status) === 'approved').length
  const lenderNeedsReview = activeLenderOutreach.filter((message) => lower(message.status) === 'needs_review').length
  const remainingToday = Math.max(0, outreachTarget - outreach24h)
  const outboundReadiness = getOutboundProviderReadiness()
  const autoSendEnabled = envBool('AUTO_SEND_ENABLED', envBool('LEADS_AUTO_SEND_APPROVED', false))
  const maxSprintTarget = envInt('LEADS_COMMAND_CENTER_MAX_SENDS_PER_RUN', Math.min(outreachTarget, 100))
  const recommendedSprintTarget = Math.max(0, Math.min(remainingToday, maxSprintTarget))

  const replySignals7d = currentLeads.filter(
    (lead) =>
      ['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status)) &&
      withinDays(lead.updated_at || lead.last_contacted_at || lead.created_at, 7)
  ).length
  const propertyLeadCount = currentLeads.filter((lead) => String(lead.property_address || '').trim()).length
  const analyzerOutcomeCount = dealMemory.totalAnalyses

  const followupsDue = currentLeads.filter((lead) => lower(lead.outreach_status) === 'followup_due').length
  const outboundControl: CommandCenterOutboundControl = {
    dailyLimit: outreachTarget,
    sent24h: outreach24h,
    remainingToday,
    recommendedSprintTarget,
    maxSprintTarget,
    sender: outboundReadiness.sender,
    provider: outboundReadiness.defaultProvider,
    mailingAddressConfigured: outboundReadiness.mailingAddressConfigured,
    autoSendEnabled,
    emailReady: sendReady,
    needsReview,
    followupsDue,
    smsMode: 'review_only',
    smsReason: 'SMS requires consent/opt-out review before live sending.',
  }
  const bounceRiskLeads = currentLeads.filter(
    (lead) => Number(lead.bounce_risk_score || 0) >= 70 || lower(lead.delivery_status) === 'bounced'
  ).length

  const completedPayments = t.payments.filter((p) => ['completed', 'paid', 'succeeded'].includes(lower(p.status)))
  const paidFunding = t.fundingPayments.filter((p) => ['paid', 'completed'].includes(lower(p.status)))
  const revenue30d =
    completedPayments
      .filter((p) => withinDays(p.created_at || p.updated_at, 30))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    paidFunding
      .filter((p) => withinDays(p.created_at || p.updated_at, 30))
      .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)

  const activeBuyers = t.buyers.filter((b) =>
    ['contacted', 'responded', 'reviewing', 'active_buyer'].includes(lower(b.relationship_stage))
  ).length
  const activeLenders = t.lenders.filter((l) =>
    ['contacted', 'responded', 'reviewing', 'active_partner'].includes(lower(l.relationship_stage))
  ).length
  const partnerFollowupsDue =
    t.buyers.filter((b) => b.next_follow_up_at && Date.parse(b.next_follow_up_at) < Date.now()).length +
    t.lenders.filter((l) => l.next_follow_up_at && Date.parse(l.next_follow_up_at) < Date.now()).length

  const pendingBuyerMatches = t.buyerMatches.filter(
    (m) => !['closed', 'rejected', 'won', 'lost', 'complete', 'completed'].includes(lower(m.status))
  ).length
  const pendingLenderMatches = t.lenderMatches.filter(
    (m) => !['closed', 'rejected', 'won', 'lost', 'complete', 'completed'].includes(lower(m.status))
  ).length

  const openChecklists = t.researchChecklists.filter(
    (c) => !['done', 'completed', 'complete', 'archived'].includes(lower(c.status))
  ).length

  const investorFollowupsOpen = t.investorFollowUps.filter(
    (task) => !['done', 'completed', 'complete', 'cancelled'].includes(lower(task.status))
  ).length

  const publishedContent = t.contentAssets.filter((a) => lower(a.status) === 'published')
  const publishedContent7d = publishedContent.filter((a) =>
    withinDays(a.published_at || a.updated_at || a.created_at, 7)
  ).length
  const openSeoOpportunities = t.seoOpportunities.filter(
    (o) => !['done', 'completed', 'published', 'dismissed'].includes(lower(o.status))
  ).length
  const draftPitches = t.prPitches.filter((p) => ['draft', 'ready', 'pending'].includes(lower(p.status))).length

  const recentScrapeRuns = t.scrapeRuns.filter((run) => withinHours(run.created_at || run.started_at, 24))
  const failedScrapes24h = recentScrapeRuns.filter((run) => lower(run.status) === 'failed').length
  const okScrapes24h = recentScrapeRuns.filter((run) => ['completed', 'partial'].includes(lower(run.status))).length
  const partnerDiscoveryRuns = [
    ...t.buyerDiscoveryRuns.filter((run) => lower(run.run_type) !== 'daily_pipeline').map((run) => ({
      lane: 'buyers',
      sourceKey: run.source_key as string | null,
      status: String(run.status || ''),
      resultCount: Number(run.result_count || 0),
      startedAt: (run.started_at as string | null) || null,
      completedAt: (run.completed_at as string | null) || (run.started_at as string | null) || null,
      note: (run.error_message as string | null) || null,
    })),
    ...t.lenderDiscoveryRuns.map((run) => ({
      lane: 'lenders',
      sourceKey: run.source_key as string | null,
      status: String(run.status || ''),
      resultCount: Number(run.result_count || 0),
      startedAt: (run.started_at as string | null) || null,
      completedAt: (run.completed_at as string | null) || (run.started_at as string | null) || null,
      note: (run.error_message as string | null) || null,
    })),
    ...t.investorAutomationRuns.map((run) => ({
      lane: 'investors',
      sourceKey: run.source_key as string | null,
      status: String(run.status || ''),
      resultCount: Number(run.result_count || 0),
      startedAt: (run.started_at as string | null) || null,
      completedAt: (run.finished_at as string | null) || (run.started_at as string | null) || null,
      note: (run.error_message as string | null) || null,
    })),
  ].sort((a, b) => Date.parse(b.startedAt || b.completedAt || '') - Date.parse(a.startedAt || a.completedAt || ''))
  const recentPartnerRuns7d = partnerDiscoveryRuns.filter((run) => withinDays(run.startedAt || run.completedAt, 7))
  const activePartnerDiscoveryRuns7d = recentPartnerRuns7d.filter(
    (run) => !isCooldownNote(run.note) && lower(run.status) !== 'failed'
  ).length
  const cooldownSaves7d = recentPartnerRuns7d.filter((run) => isCooldownNote(run.note)).length
  const failedPartnerRuns7d = recentPartnerRuns7d.filter((run) => lower(run.status) === 'failed').length
  const archivedLegacyRuntimeRows = t.scrapeRuns.length
  const staleExports = databaseDealMachineFreshness?.staleCount ?? local.dmExports.filter((e) => e.ageDays > 7).length

  const openTasks = t.adminTasks.filter(
    (task) => !['done', 'completed', 'closed'].includes(lower(task.status)) && isCurrentVestblockTask(task)
  )
  const urgentTasks = openTasks.filter((task) => ['urgent', 'high'].includes(lower(task.priority)))
  const overdueTasks = openTasks.filter((task) => task.due_at && Date.parse(task.due_at) < Date.now())

  const latestReport = t.dailyReports[0] || null
  const latestStrategyReport = t.strategyDailyReports[0] || null
  const strategyReportJson = (latestStrategyReport?.report_json || {}) as Record<string, any>
  const strategyLaneRuns = Array.isArray(strategyReportJson.laneRuns) ? strategyReportJson.laneRuns : []
  let strategyExecution: CommandCenterStrategyExecution = latestStrategyReport
    ? {
        reportDate: String(latestStrategyReport.report_date || '') || null,
        generatedAt: String(strategyReportJson.generatedAt || latestStrategyReport.updated_at || latestStrategyReport.created_at || '') || null,
        status: ['completed', 'partial', 'blocked', 'failed'].includes(lower(latestStrategyReport.status))
          ? (lower(latestStrategyReport.status) as CommandCenterStrategyExecution['status'])
          : 'failed',
        dryRun: typeof strategyReportJson.dryRun === 'boolean' ? strategyReportJson.dryRun : null,
        citiesAttempted: Number(latestStrategyReport.cities_attempted || 0),
        sourcesAttempted: Number(latestStrategyReport.sources_attempted || 0),
        leadsDiscovered: Number(latestStrategyReport.leads_discovered || 0),
        leadsQualified: Number(latestStrategyReport.leads_qualified || 0),
        draftsCreated: Number(latestStrategyReport.drafts_created || 0),
        staleCandidateLeadsExcluded: Number(strategyReportJson.staleCandidateLeadsExcluded || 0),
        accepted: Number(latestStrategyReport.accepted_count || 0),
        delivered: Number(latestStrategyReport.delivered_count || 0),
        replies: Number(latestStrategyReport.reply_count || 0),
        blockers: Array.isArray(strategyReportJson.report?.blockers)
          ? strategyReportJson.report.blockers.map(String)
          : [],
        laneRuns: strategyLaneRuns.slice(0, 12).map((run: Record<string, unknown>) => ({
          strategyKey: String(run.strategyKey || ''),
          strategyName: String(run.strategyName || run.strategyKey || 'Strategy lane'),
          market: String(run.market || 'Unknown market'),
          sourceProvider: String(run.sourceProvider || 'unknown'),
          status: String(run.status || 'unknown'),
          qualified: Number(run.qualified || 0),
          draftsCreated: Number(run.draftsCreated || 0),
        })),
      }
    : {
        reportDate: null,
        generatedAt: null,
        status: 'not_started',
        dryRun: null,
        citiesAttempted: 0,
        sourcesAttempted: 0,
        leadsDiscovered: 0,
        leadsQualified: 0,
        draftsCreated: 0,
        staleCandidateLeadsExcluded: 0,
        accepted: 0,
        delivered: 0,
        replies: 0,
        blockers: ['The strategy execution engine has not stored its first report.'],
        laneRuns: [],
      }
  const missingSuppressionDb = issues.some((issue) => issue.source === 'lead_suppressions')
  const activeDbSuppressions = t.leadSuppressions.filter((row) => lower(row.status) !== 'released')
  const localSuppressionEmails = new Set(local.suppressionRecords.map((row) => row.email))
  const dbSuppressionEmails = new Set(
    activeDbSuppressions.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean)
  )
  const activeSuppressionCount = new Set([...localSuppressionEmails, ...dbSuppressionEmails]).size
  const recentSuppressions = [
    ...activeDbSuppressions
      .map((row) => {
        const email = String(row.email || '').trim().toLowerCase()
        if (!email) return null
        return {
          email,
          reason: String(row.reason || 'suppression'),
          source: 'database',
          createdAt: (row.created_at as string | null) || null,
        }
      })
      .filter(Boolean),
    ...local.suppressionRecords.map((row) => ({
      email: row.email,
      reason: row.reason,
      source: row.source,
      propertyAddress: row.propertyAddress,
      createdAt: row.createdAt,
    })),
  ]
    .sort((a, b) => Date.parse(b?.createdAt || '') - Date.parse(a?.createdAt || ''))
    .slice(0, 5) as CommandCenterSuppressionCenter['recent']

  const freshDmExports = local.dmExports.filter((file) => file.ageDays <= 7)
  const staleDmExports = local.dmExports.filter((file) => file.ageDays > 7)
  const nextRefreshMarkets = [
    ...new Set(
      (staleDmExports.length ? staleDmExports : local.dmExports)
        .map((file) => marketFromDmExportFile(file.file))
        .filter(Boolean)
    ),
  ].slice(0, 4)
  const dmAges = local.dmExports.map((file) => file.ageDays)
  const localDealMachineFreshness: CommandCenterDealMachineFreshness = {
    freshCount: freshDmExports.length,
    staleCount: staleDmExports.length,
    oldestAgeDays: dmAges.length ? Math.max(...dmAges) : null,
    newestAgeDays: dmAges.length ? Math.min(...dmAges) : null,
    nextRefreshMarkets,
    topStale: staleDmExports.slice(0, 4).map((file) => ({
      file: file.file,
      ageDays: file.ageDays,
      market: marketFromDmExportFile(file.file),
    })),
    latestExportRequest: local.dealMachineExportRequest,
    summary: local.dmExports.length
      ? `${freshDmExports.length} fresh export${freshDmExports.length === 1 ? '' : 's'} and ${staleDmExports.length} stale export${staleDmExports.length === 1 ? '' : 's'} on disk${local.dealMachineExportRequest?.totalRows ? `; latest request has ${local.dealMachineExportRequest.totalRows} row${local.dealMachineExportRequest.totalRows === 1 ? '' : 's'} waiting for a Contacts export` : ''}.`
      : 'No DealMachine contact exports are on disk yet.',
  }
  const dealMachineFreshness: CommandCenterDealMachineFreshness =
    databaseDealMachineFreshness || localDealMachineFreshness

  const strategyLabDirectives = openTasks
    .filter((task) => lower(task.task_type) === 'boss_directive')
    .filter((task) => {
      const meta = (task.metadata_json || {}) as Record<string, unknown>
      return meta.play_key === 'daily-autonomous-strategy-lab'
    })
  const lastStrategyDirectiveAt = strategyLabDirectives
    .map((task) => task.created_at || task.updated_at)
    .filter(Boolean)
    .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] as string | undefined
  const onMarketSweepRecent = withinDays(local.onMarketSweep.latestRunAt || local.onMarketSweep.latestDraftAt, 1)
  const strategyFocus =
    replySignals7d > 0
      ? 'Reply-first seller conversion'
      : onMarketSweepRecent && local.onMarketSweep.sent > 0
        ? 'Follow up fresh on-market cash reviews'
        : recommendedSprintTarget > 0 && sendReady > 0
        ? 'Push safe seller cap sprint'
        : dealMachineFreshness.freshCount > 0
          ? 'Mine fresh DealMachine exports'
          : 'Refresh portfolio landlord exports'
  const leadMarketFallback = marketLabel(currentLeads.find((lead) => lead.city || lead.state))
  const strategyChallenger =
    (onMarketSweepRecent && local.onMarketSweep.markets[0]?.market
      ? `On-market agents in ${local.onMarketSweep.markets[0].market}`
      : '') ||
    nextRefreshMarkets[0] ||
    leadMarketFallback ||
    (builderPartners > 0 ? 'Builder buy-box matching' : 'Portfolio landlords in four markets')
  const strategyNextMove =
    replySignals7d > 0
      ? `Advance ${replySignals7d} seller repl${replySignals7d === 1 ? 'y' : 'ies'} before new sends.`
      : onMarketSweepRecent && local.onMarketSweep.sent > 0
        ? `Monitor replies from the ${local.onMarketSweep.sent} public listing-agent cash review email${local.onMarketSweep.sent === 1 ? '' : 's'} sent in the latest sweep, then let Boss decide whether to repeat or pivot.`
        : recommendedSprintTarget > 0 && sendReady > 0
        ? `Preview or push ${recommendedSprintTarget} acquisition email${recommendedSprintTarget === 1 ? '' : 's'} toward today’s cap.`
        : staleDmExports.length > 0
          ? `Refresh ${nextRefreshMarkets.slice(0, 2).join(' and ') || 'the stale DealMachine markets'} before sending more volume.`
          : 'Source the next DealMachine export, then let the lab pick the strongest segment.'
  const strategyLab: CommandCenterStrategyLab = {
    status:
      missingSuppressionDb || !outboundReadiness.mailingAddressConfigured
        ? 'red'
        : recommendedSprintTarget > 0 || replySignals7d > 0
          ? 'green'
          : 'yellow',
    focus: strategyFocus,
    challenger: strategyChallenger,
    nextMove: strategyNextMove,
    sentToday: outreach24h,
    remainingToday,
    emailReady: sendReady,
    needsReview,
    replySignals7d,
    activeDirectiveCount: strategyLabDirectives.length,
    lastDirectiveAt: lastStrategyDirectiveAt || null,
    onMarketSweep: local.onMarketSweep,
    guardrails: [
      {
        label: 'Sender',
        value: outboundReadiness.sender,
        helper: outboundReadiness.sender.includes('acquisitions@vestblock.io') ? 'seller-safe lane' : 'review sender',
        status: outboundReadiness.sender.includes('acquisitions@vestblock.io') ? 'green' : 'yellow',
      },
      {
        label: 'Suppressions',
        value: activeSuppressionCount,
        helper: missingSuppressionDb ? 'database check failed' : `${local.suppressionRecords.length} local`,
        status: missingSuppressionDb ? 'red' : 'green',
      },
      {
        label: 'DealMachine',
        value: freshDmExports.length,
        helper: freshDmExports.length ? 'fresh exports' : staleDmExports.length ? 'exports stale' : 'needs export',
        status: freshDmExports.length ? 'green' : staleDmExports.length ? 'yellow' : 'red',
      },
      {
        label: 'SMS',
        value: 'review only',
        helper: 'no live SMS auto-send',
        status: 'yellow',
      },
    ],
    actions: [
      commandCenterAutopilotAction('autopilot-seed-preview', 'Seed autopilot', {
        dryRun: true,
        tone: 'primary',
      }),
      commandCenterAutopilotAction('autopilot-dispatch-plan', 'Dispatch autopilot', {
        dryRun: false,
        dispatch: true,
        tone: 'success',
      }),
      bossDailyLoopAction('strategy-lab-run-preview', 'Run loop preview', {
        dryRun: true,
        tone: 'primary',
      }),
      bossDailyLoopAction('strategy-lab-dispatch-focus', 'Dispatch focus loop', {
        dryRun: false,
        dispatch: true,
        tone: 'success',
      }),
      ...(recommendedSprintTarget > 0
        ? [
            leadThroughputSprintAction('strategy-lab-live-sprint', `Push ${recommendedSprintTarget}`, recommendedSprintTarget, {
              tone: 'success',
            }),
          ]
        : []),
      leadThroughputSprintAction(
        'strategy-lab-preview-sprint',
        'Preview cap sprint',
        Math.max(1, recommendedSprintTarget || Math.min(outreachTarget, maxSprintTarget)),
        { dryRun: true, tone: 'primary' }
      ),
      navigateAction('strategy-lab-sources', 'Open lead sources', '/admin/lead-sources'),
    ],
  }

  const operatingLoops = await loadOperatingLoopTelemetryFromDatabase({
    sentToday: strategyLab.sentToday,
    sent7d: sends7d,
    remainingToday: strategyLab.remainingToday,
    replySignals7d: strategyLab.replySignals7d,
    emailReady: strategyLab.emailReady,
    needsReview: strategyLab.needsReview,
    focusStrategyKey: strategyLab.focus,
    challengerStrategyKey: strategyLab.challenger,
    followupsDue,
    partnerFollowupsDue,
    activeSuppressionCount,
    missingSuppressionDb,
    bounceRiskLeads,
    buyerDemandSignals: activeBuyers + activeLenders + builderPartners,
    pendingMatches: pendingBuyerMatches + pendingLenderMatches,
    partnerBuyBoxesConfirmed,
    partnerResearchReady,
    partnerOutreachReady,
    partnerDiscoveryRuns7d: activePartnerDiscoveryRuns7d,
    failedPartnerRuns7d,
    failedScrapes24h,
    sourceFreshCount: dealMachineFreshness.freshCount,
    sourceStaleCount: dealMachineFreshness.staleCount,
    staleExportCount: staleExports,
    staleExportTotal: local.dmExports.length,
    activeDirectiveCount: strategyLabDirectives.length,
    overdueTaskCount: overdueTasks.length,
    urgentTaskCount: urgentTasks.length,
    openTaskCount: openTasks.length,
    legacyDraftCount: legacyLeadOutreachCount,
    archivedLegacyRuntimeRows,
    openResearchChecklistCount: openChecklists,
    analyzerOutcomeCount,
  })

  const operatingArchitecture = buildOperatingArchitecture({
    ledgerEventCount: operatingLoops.ledgerEventCount,
    operatingLoopCount: operatingLoops.loops.length,
    replySignals7d,
    sent7d: sends7d,
    sellerLeads: currentLeads.length,
    propertyLeadCount,
    pendingBuyerMatches,
    pendingLenderMatches,
    followupsDue,
    partnerFollowupsDue,
    partnerBuyBoxesConfirmed,
    partnerResearchReady,
    partnerOutreachReady,
    activeSuppressionCount,
    freshSourceCount: dealMachineFreshness.freshCount,
    staleSourceCount: dealMachineFreshness.staleCount,
    openTaskCount: openTasks.length,
    overdueTaskCount: overdueTasks.length,
    analyzerOutcomeCount,
  })

  const suppressionCenter: CommandCenterSuppressionCenter = {
    activeCount: activeSuppressionCount,
    dbCount: activeDbSuppressions.length,
    localCount: local.suppressionRecords.length,
    missingDb: missingSuppressionDb,
    recent: recentSuppressions,
  }
  const outcomeLearning = buildOutcomeLearningSnapshot({
    commandCenterEvents: t.commandCenterEvents,
    replySignals7d,
    propertyBuyerPacketSends: t.propertyBuyerPacketSends,
  })
  const outboundGovernance = buildOutboundGovernanceSnapshot({
    sender: outboundReadiness.sender,
    dailyLimit: outreachTarget,
    sent24h: outreach24h,
    remainingToday,
    readyToSend: sendReady,
    needsReview,
    replySignals7d,
    bounceRiskLeads,
    suppressionCount: activeSuppressionCount,
    paidSourcesBlocked: sourceGovernor.paidSourcesBlocked,
    mailingAddressConfigured: outboundReadiness.mailingAddressConfigured,
    autoSendEnabled,
    missingSuppressionDb,
  })
  const buyBoxGraph = buildBuyBoxGraphSnapshot({
    propertyAnalysisRuns,
    buyers: t.buyers,
    lenders: t.lenders,
    investorPipelineRows,
    pendingBuyerMatches,
    pendingLenderMatches,
  })
  const dealPipeline = buildDealPipelineSnapshot({
    dealPipelineItems,
    propertyBuyerPackets,
    propertyBuyerPacketSends: t.propertyBuyerPacketSends,
  })
  const foreclosureCommand = buildForeclosureCommandSnapshot({
    buyerMatchesOpen: pendingBuyerMatches,
    lenderMatchesOpen: pendingLenderMatches,
    freshDealMachineExports: freshDmExports.length,
  })
  const osintSourceBoard = buildOsintSourceBoard({
    researchChecklists: t.researchChecklists,
    dmExports: local.dmExports,
    taxCodeStack: local.taxCodeStack,
    distressStackRows: local.distressStackRows,
    foreclosureCommand,
  })

  // ── Market heat ────────────────────────────────────────────────────────────
  const marketMap = new Map<string, MarketHeatRow>()
  for (const lead of currentLeads) {
    if (!lead.city) continue
    const market = `${lead.city}${lead.state ? `, ${lead.state}` : ''}`
    const row = marketMap.get(market) || { market, leads: 0, contactable: 0, recent7d: 0, replied: 0, heat: 0 }
    row.leads++
    if (String(lead.email || '').trim()) row.contactable++
    if (withinDays(lead.created_at, 7)) row.recent7d++
    if (['replied', 'interested', 'qualified', 'closed_won'].includes(lower(lead.status))) row.replied++
    row.href = `/admin/leads?city=${encodeURIComponent(String(lead.city))}${lead.state ? `&state=${encodeURIComponent(String(lead.state))}` : ''}`
    marketMap.set(market, row)
  }
  const marketHeat = [...marketMap.values()]
    .map((row) => ({
      ...row,
      heat: Math.round(
        clamp01(row.recent7d / 25) * 40 + clamp01(row.replied / 5) * 35 + clamp01(row.contactable / 100) * 25
      ),
    }))
    .sort((a, b) => b.heat - a.heat || b.leads - a.leads)
    .slice(0, 8)

  const autopilot = buildAutopilotSnapshot({
    remainingToday,
    sentToday: outreach24h,
    emailReady: sendReady,
    needsReview,
    followupsDue,
    replySignals7d,
    partnerBuyBoxesConfirmed,
    sellerLeads: currentLeads.length,
    activeSuppressionCount,
    missingSuppressionDb,
    sourceLanes: sourceGovernor.lanes,
    marketHeat,
    nextRefreshMarkets: dealMachineFreshness.nextRefreshMarkets,
    campaigns: operatingLoops.campaigns,
    jobs: t.commandCenterJobs,
    strategyRuns: t.commandCenterStrategyRuns,
    replyMemory: t.commandCenterReplyMemory,
    suppressionDecisions: t.commandCenterSuppressionDecisions,
  })

  // ── Inbox / outreach command surfaces ─────────────────────────────────────
  const hotLeadReplies: CommandCenterStreamItem[] = currentLeads
    .filter((lead) => ['replied', 'interested', 'qualified'].includes(lower(lead.status)))
    .sort((a, b) => Date.parse(timestampOf(b) || '') - Date.parse(timestampOf(a) || ''))
    .slice(0, 4)
    .map((lead) => {
      const status = lower(lead.status)
      return {
        id: `seller-reply-${lead.id}`,
        lane: 'seller',
        title: leadLabel(lead),
        detail: `${marketLabel(lead) || lead.source || 'Seller lead'} · ${titleCase(status)}`,
        hint: String(lead.email || '').trim() || String(lead.source || '').trim() || 'Open seller thread',
        at: lead.updated_at || lead.last_contacted_at || lead.created_at || null,
        statusLabel: titleCase(status),
        priority: status === 'qualified' ? ('critical' as const) : status === 'interested' ? ('warning' as const) : ('info' as const),
        href: leadHref(lead),
        actions: [
          navigateAction(`lead-open-${lead.id}`, 'Open', leadHref(lead)),
          status === 'replied'
            ? leadStatusAction(`lead-interest-${lead.id}`, 'Mark interested', lead.id, 'interested', 'warning')
            : leadStatusAction(`lead-qualify-${lead.id}`, 'Mark qualified', lead.id, 'qualified', 'success'),
        ],
      }
    })

  const partnerReplyItems: CommandCenterStreamItem[] = [
    ...t.buyers
      .filter((buyer) => ['responded', 'reviewing', 'active_buyer'].includes(lower(buyer.relationship_stage)))
      .map((buyer) => ({
        id: `buyer-reply-${buyer.id}`,
        lane: 'buyer' as const,
        title: partnerLabel(buyer, 'Buyer reply'),
        detail: `Buyer lane · ${titleCase(lower(buyer.relationship_stage) || 'responded')}`,
        hint: String(buyer.contact_email || '').trim() || 'Open buyer thread',
        at: buyer.updated_at || buyer.last_contacted_at || buyer.created_at || null,
        statusLabel: titleCase(lower(buyer.relationship_stage) || 'responded'),
        priority: lower(buyer.relationship_stage) === 'active_buyer' ? ('warning' as const) : ('info' as const),
        href: buyerHref(buyer),
        actions: [navigateAction(`buyer-open-${buyer.id}`, 'Open', buyerHref(buyer))],
      })),
    ...t.lenders
      .filter((lender) => ['responded', 'reviewing', 'active_partner'].includes(lower(lender.relationship_stage)))
      .map((lender) => ({
        id: `lender-reply-${lender.id}`,
        lane: 'lender' as const,
        title: partnerLabel(lender, 'Lender reply'),
        detail: `Capital lane · ${titleCase(lower(lender.relationship_stage) || 'responded')}`,
        hint: String(lender.contact_email || '').trim() || 'Open lender thread',
        at: lender.updated_at || lender.last_contacted_at || lender.created_at || null,
        statusLabel: titleCase(lower(lender.relationship_stage) || 'responded'),
        priority: lower(lender.relationship_stage) === 'active_partner' ? ('warning' as const) : ('info' as const),
        href: lenderHref(lender),
        actions: [navigateAction(`lender-open-${lender.id}`, 'Open', lenderHref(lender))],
      })),
  ]
    .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
    .slice(0, 4)

  const staleThreadItems: CommandCenterStreamItem[] = [
    ...currentLeads
      .filter((lead) => lower(lead.outreach_status) === 'followup_due')
      .sort((a, b) => Date.parse((a.next_follow_up_at || a.updated_at || a.created_at || '')) - Date.parse((b.next_follow_up_at || b.updated_at || b.created_at || '')))
      .slice(0, 2)
      .map((lead) => ({
        id: `lead-followup-${lead.id}`,
        lane: 'seller' as const,
        title: leadLabel(lead),
        detail: `${marketLabel(lead) || 'Seller lane'} · follow-up due`,
        hint: String(lead.email || '').trim() || String(lead.source || '').trim() || 'Needs next touch',
        at: lead.next_follow_up_at || lead.updated_at || lead.created_at || null,
        statusLabel: 'Follow-up due',
        priority: 'warning' as const,
        href: leadHref(lead),
        actions: [
          navigateAction(`lead-followup-open-${lead.id}`, 'Open', leadHref(lead)),
          leadStatusAction(`lead-followup-contacted-${lead.id}`, 'Mark contacted', lead.id, 'contacted', 'success'),
        ],
      })),
    ...t.buyers
      .filter((buyer) => buyer.next_follow_up_at && Date.parse(buyer.next_follow_up_at) < Date.now())
      .sort((a, b) => Date.parse(a.next_follow_up_at || '') - Date.parse(b.next_follow_up_at || ''))
      .slice(0, 1)
      .map((buyer) => ({
        id: `buyer-followup-${buyer.id}`,
        lane: 'buyer' as const,
        title: partnerLabel(buyer, 'Buyer follow-up'),
        detail: 'Buyer lane · follow-up due',
        hint: String(buyer.contact_email || '').trim() || 'Relationship thread waiting',
        at: buyer.next_follow_up_at || buyer.updated_at || buyer.created_at || null,
        statusLabel: 'Follow-up due',
        priority: 'warning' as const,
        href: buyerHref(buyer),
        actions: [navigateAction(`buyer-followup-open-${buyer.id}`, 'Open', buyerHref(buyer))],
      })),
    ...t.lenders
      .filter((lender) => lender.next_follow_up_at && Date.parse(lender.next_follow_up_at) < Date.now())
      .sort((a, b) => Date.parse(a.next_follow_up_at || '') - Date.parse(b.next_follow_up_at || ''))
      .slice(0, 1)
      .map((lender) => ({
        id: `lender-followup-${lender.id}`,
        lane: 'lender' as const,
        title: partnerLabel(lender, 'Lender follow-up'),
        detail: 'Capital lane · follow-up due',
        hint: String(lender.contact_email || '').trim() || 'Relationship thread waiting',
        at: lender.next_follow_up_at || lender.updated_at || lender.created_at || null,
        statusLabel: 'Follow-up due',
        priority: 'warning' as const,
        href: lenderHref(lender),
        actions: [navigateAction(`lender-followup-open-${lender.id}`, 'Open', lenderHref(lender))],
      })),
  ]

  const automationAlertItems: CommandCenterStreamItem[] = [
    ...(failedScrapes24h > 0
      ? [
          {
            id: 'alert-failed-scrapes',
            lane: 'system' as const,
            title: 'Source failures need review',
            detail: `${failedScrapes24h} scrape run${failedScrapes24h === 1 ? '' : 's'} failed in the last 24 hours.`,
            hint: 'Lead inflow quality is at risk until this clears.',
            at: recentScrapeRuns[0]?.started_at || recentScrapeRuns[0]?.created_at || null,
            statusLabel: 'Source failure',
            priority: 'critical' as const,
            href: '/admin/scrape-runs',
            actions: [navigateAction('alert-failed-scrapes-open', 'Open runs', '/admin/scrape-runs', 'warning')],
          },
        ]
      : []),
    ...(sendReady === 0
      ? [
          {
            id: 'alert-empty-send-ready',
            lane: 'system' as const,
            title: 'Seller queue is dry',
            detail: 'No send-ready seller drafts are available right now.',
            hint: 'Generate or approve drafts before the next push.',
            at: null,
            statusLabel: 'Queue dry',
            priority: 'warning' as const,
            href: '/admin/leads',
            actions: [navigateAction('alert-empty-send-ready-open', 'Open seller queue', '/admin/leads')],
          },
        ]
      : []),
    ...(staleExports === local.dmExports.length && local.dmExports.length > 0
      ? [
          {
            id: 'alert-stale-exports',
            lane: 'system' as const,
            title: 'DealMachine exports are stale',
            detail: `All ${local.dmExports.length} saved exports are older than 7 days.`,
            hint: 'Pull a fresh export before another seller run.',
            at: null,
            statusLabel: 'Refresh needed',
            priority: 'warning' as const,
            href: '/admin/lead-sources',
            actions: [navigateAction('alert-stale-exports-open', 'Open sources', '/admin/lead-sources')],
          },
        ]
      : []),
  ].slice(0, 3)

  const sellerQueueItems: CommandCenterStreamItem[] = currentOutreachMessages
    .filter((message) => lower(message.channel) === 'email' && ['approved', 'queued', 'needs_review'].includes(lower(message.status)))
    .sort((a, b) => Date.parse((b.approved_at || b.updated_at || b.created_at || '')) - Date.parse((a.approved_at || a.updated_at || a.created_at || '')))
    .slice(0, 3)
    .map((message) => {
      const lead = leadById.get(message.lead_id)
      const status = lower(message.status)
      return {
        id: `seller-send-${message.id}`,
        lane: 'seller',
        title: leadLabel(lead),
        detail: `${marketLabel(lead) || 'Seller lane'} · ${message.subject || 'Outreach draft'}`,
        hint: String(lead?.email || '').trim() || 'Ready to send',
        at: message.approved_at || message.updated_at || message.created_at || null,
        statusLabel: titleCase(status),
        priority: status === 'needs_review' ? 'warning' as const : 'info' as const,
        href: leadHref(lead),
        actions: [
          navigateAction(`seller-open-${message.id}`, 'Open', leadHref(lead)),
          status === 'needs_review'
            ? leadOutreachAction(`seller-approve-${message.id}`, 'Approve', message.lead_id, message.id, {
                status: 'approved',
                tone: 'primary',
              })
            : leadOutreachAction(`seller-send-now-${message.id}`, 'Send now', message.lead_id, message.id, {
                sendNow: true,
                tone: 'success',
              }),
        ],
      }
    })

  const sellerNeedsReviewActions = sellerQueueItems
    .filter((item) => item.statusLabel?.toLowerCase() === 'needs review')
    .map((item) => {
      const approveAction = item.actions.find((action) => action.type === 'lead_outreach' && action.status === 'approved')
      return approveAction?.type === 'lead_outreach' ? approveAction.leadId : null
    })
    .filter((value): value is string => Boolean(value))
  const sellerSendBatchMessages = sellerQueueItems
    .map((item) => item.actions.find((action) => action.type === 'lead_outreach' && action.sendNow))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'lead_outreach' }> =>
        Boolean(action && action.type === 'lead_outreach')
    )
    .map((action) => ({ leadId: action.leadId, messageId: action.messageId }))

  const buyerQueueItems: CommandCenterStreamItem[] = activeBuyerOutreach
    .filter((message) => ['needs_review', 'approved'].includes(lower(message.status)))
    .sort((a, b) => Date.parse((b.approved_at || b.updated_at || b.created_at || '')) - Date.parse((a.approved_at || a.updated_at || a.created_at || '')))
    .slice(0, 3)
    .map((message) => {
      const buyer = buyerById.get(message.buyer_id)
      const status = lower(message.status)
      return {
        id: `buyer-send-${message.id}`,
        lane: 'buyer',
        title: partnerLabel(buyer, 'Buyer outreach'),
        detail: `${marketLabel(buyer) || 'Buyer lane'}${message.subject ? ` · ${message.subject}` : ''}`,
        hint: String(buyer?.contact_email || '').trim() || 'Open buyer record',
        at: message.approved_at || message.updated_at || message.created_at || null,
        statusLabel: titleCase(status),
        priority: status === 'approved' ? ('info' as const) : ('warning' as const),
        href: buyerHref(buyer),
        actions: [
          navigateAction(`buyer-open-queue-${message.id}`, 'Open', buyerHref(buyer)),
          status === 'approved'
            ? buyerOutreachAction(`buyer-send-now-${message.id}`, 'Send now', message.buyer_id, message.id, {
                sendNow: true,
                tone: 'success',
              })
            : buyerOutreachAction(`buyer-approve-${message.id}`, 'Approve', message.buyer_id, message.id, {
                status: 'approved',
                tone: 'primary',
              }),
        ],
      }
    })

  const buyerNeedsReviewActions = buyerQueueItems
    .filter((item) => item.statusLabel?.toLowerCase() === 'needs review')
    .map((item) => item.actions.find((action) => action.type === 'buyer_outreach' && action.status === 'approved'))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'buyer_outreach' }> =>
        Boolean(action && action.type === 'buyer_outreach')
    )
    .map((action) => action.buyerId)
  const buyerSendBatchMessages = buyerQueueItems
    .map((item) => item.actions.find((action) => action.type === 'buyer_outreach' && action.sendNow))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'buyer_outreach' }> =>
        Boolean(action && action.type === 'buyer_outreach')
    )
    .map((action) => ({ buyerId: action.buyerId, messageId: action.messageId }))

  const lenderQueueItems: CommandCenterStreamItem[] = activeLenderOutreach
    .filter((message) => ['needs_review', 'approved'].includes(lower(message.status)))
    .sort((a, b) => Date.parse((b.approved_at || b.updated_at || b.created_at || '')) - Date.parse((a.approved_at || a.updated_at || a.created_at || '')))
    .slice(0, 3)
    .map((message) => {
      const lender = lenderById.get(message.lender_id)
      const status = lower(message.status)
      return {
        id: `lender-send-${message.id}`,
        lane: 'lender',
        title: partnerLabel(lender, 'Lender outreach'),
        detail: `${marketLabel(lender) || 'Capital lane'}${message.subject ? ` · ${message.subject}` : ''}`,
        hint: String(lender?.contact_email || '').trim() || 'Open lender record',
        at: message.approved_at || message.updated_at || message.created_at || null,
        statusLabel: titleCase(status),
        priority: status === 'approved' ? ('info' as const) : ('warning' as const),
        href: lenderHref(lender),
        actions: [
          navigateAction(`lender-open-queue-${message.id}`, 'Open', lenderHref(lender)),
          status === 'approved'
            ? lenderOutreachAction(`lender-send-now-${message.id}`, 'Send now', message.lender_id, message.id, {
                sendNow: true,
                tone: 'success',
              })
            : lenderOutreachAction(`lender-approve-${message.id}`, 'Approve', message.lender_id, message.id, {
                status: 'approved',
                tone: 'primary',
              }),
        ],
      }
    })

  const lenderNeedsReviewActions = lenderQueueItems
    .filter((item) => item.statusLabel?.toLowerCase() === 'needs review')
    .map((item) => item.actions.find((action) => action.type === 'lender_outreach' && action.status === 'approved'))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'lender_outreach' }> =>
        Boolean(action && action.type === 'lender_outreach')
    )
    .map((action) => action.lenderId)
  const lenderSendBatchMessages = lenderQueueItems
    .map((item) => item.actions.find((action) => action.type === 'lender_outreach' && action.sendNow))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'lender_outreach' }> =>
        Boolean(action && action.type === 'lender_outreach')
    )
    .map((action) => ({ lenderId: action.lenderId, messageId: action.messageId }))

  const builderQueueItems: CommandCenterStreamItem[] = investorPipelineRows
    .filter((item) => item.pipeline.outreachReady || item.pipeline.researchReady || item.pipeline.buyBoxConfirmed)
    .sort(
      (a, b) =>
        Date.parse(timestampOf(b.investor) || '') - Date.parse(timestampOf(a.investor) || '')
    )
    .slice(0, 3)
    .map((item) => ({
      id: `builder-queue-${item.investor.id}`,
      lane: 'partner' as const,
      title: partnerLabel(item.investor, 'Builder / developer'),
      detail: `${item.pipeline.stageLabel}${item.pipeline.dealMachineAligned ? ' · DealMachine aligned' : ''}`,
      hint: item.pipeline.buyBoxConfirmed ? 'Criteria confirmed' : item.pipeline.nextAction,
      at: item.investor.updated_at || item.investor.created_at || null,
      statusLabel: item.pipeline.stageLabel,
      priority: item.pipeline.outreachReady ? ('info' as const) : ('warning' as const),
      href: '/admin/investor-partnerships?lane=builder',
      actions: [
        navigateAction(`builder-open-${item.investor.id}`, 'Open', '/admin/investor-partnerships?lane=builder'),
        ...(item.pipeline.outreachReady
          ? [investorBulkAction(`builder-approve-${item.investor.id}`, 'Approve outreach', [item.investor.id], 'approve_outreach', 'primary')]
          : item.pipeline.researchReady
            ? [investorBulkAction(`builder-research-${item.investor.id}`, 'Mark researched', [item.investor.id], 'mark_researched', 'warning')]
            : []),
      ],
    }))

  const builderOutreachReadyIds = builderQueueItems
    .map((item) => item.actions.find((action) => action.type === 'investor_bulk' && action.action === 'approve_outreach'))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'investor_bulk' }> =>
        Boolean(action && action.type === 'investor_bulk')
    )
    .flatMap((action) => action.investorIds)
  const builderResearchReadyIds = builderQueueItems
    .map((item) => item.actions.find((action) => action.type === 'investor_bulk' && action.action === 'mark_researched'))
    .filter(
      (action): action is Extract<CommandCenterInlineAction, { type: 'investor_bulk' }> =>
        Boolean(action && action.type === 'investor_bulk')
    )
    .flatMap((action) => action.investorIds)

  // ── Activity feed ──────────────────────────────────────────────────────────
  const activity: ActivityItem[] = []
  for (const event of currentOutreachSendEvents.slice(0, 30)) {
    if (!event.created_at) continue
    activity.push({
      at: event.created_at,
      source: 'Outreach',
      message: `${event.subject || `Email ${lower(event.status) || 'event'}`} via ${event.channel || 'email'}`,
      href: event.lead_id ? leadHref(leadById.get(event.lead_id)) : '/admin/leads',
    })
  }
  for (const lead of currentLeads.slice(0, 25)) {
    if (!lead.created_at) continue
    activity.push({
      at: lead.created_at,
      source: 'Leads',
      message: `New ${lead.lead_type || 'lead'}${lead.city ? ` in ${lead.city}` : ''}${lead.source ? ` from ${lead.source}` : ''}`,
      href: leadHref(lead),
    })
  }
  for (const run of partnerDiscoveryRuns.slice(0, 18)) {
    const at = run.completedAt || run.startedAt
    if (!at) continue
    activity.push({
      at,
      source: 'Sources',
      message: `${run.lane} · ${run.sourceKey || 'runtime'} ${lower(run.status) || 'logged'}${
        run.resultCount ? ` · ${run.resultCount} results` : ''
      }`,
      href: '/admin/scrape-runs',
    })
  }
  for (const asset of publishedContent.slice(0, 10)) {
    const at = asset.published_at || asset.updated_at
    if (!at) continue
    activity.push({ at, source: 'Authority', message: `Published ${asset.content_type || 'asset'}`, href: '/admin/research' })
  }
  for (const message of activeBuyerOutreach.slice(0, 10)) {
    if (lower(message.status) !== 'sent' || !(message.sent_at || message.updated_at)) continue
    activity.push({ at: message.sent_at || message.updated_at!, source: 'Buyers', message: 'Buyer outreach sent', href: '/admin/buyer-outreach' })
  }
  for (const message of activeLenderOutreach.slice(0, 10)) {
    if (lower(message.status) !== 'sent' || !(message.sent_at || message.updated_at)) continue
    activity.push({ at: message.sent_at || message.updated_at!, source: 'Lenders', message: 'Lender outreach sent', href: '/admin/lender-outreach' })
  }
  activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const activityFeed = activity.slice(0, 40)

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts: CommandAlert[] = []
  if (!liveDataReachable) {
    alerts.push({
      severity: 'critical',
      message: 'Some live data sources are unreachable. Zero counts may not be real.',
    })
  }
  if (failedScrapes24h > 0) {
    alerts.push({
      severity: 'critical',
      message: `${failedScrapes24h} source run${failedScrapes24h === 1 ? '' : 's'} failed in the last 24h.`,
      href: '/admin/scrape-runs',
    })
  }
  if (failedPartnerRuns7d > 0) {
    alerts.push({
      severity: 'critical',
      message: `${failedPartnerRuns7d} partner discovery run${failedPartnerRuns7d === 1 ? '' : 's'} failed in the last 7d.`,
      href: '/admin/scrape-runs',
    })
  }
  if (sendReady === 0 && liveDataReachable) {
    alerts.push({
      severity: 'warning',
      message: 'Send-ready outreach queue is empty. Refill before expecting replies.',
      href: '/admin/leads',
    })
  }
  if (overdueTasks.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${overdueTasks.length} admin task${overdueTasks.length === 1 ? '' : 's'} overdue.`,
      href: '/admin/command-center',
    })
  }
  if (partnerFollowupsDue > 0) {
    alerts.push({
      severity: 'warning',
      message: `${partnerFollowupsDue} partner follow-up${partnerFollowupsDue === 1 ? ' is' : 's are'} past due.`,
      href: '/admin/buyers',
    })
  }
  if (builderPartners > 0 && partnerOutreachReady === 0) {
    alerts.push({
      severity: 'warning',
      message: `${builderPartners} builder/developer profile${builderPartners === 1 ? '' : 's'} are in the engine but none are cleared for outreach yet.`,
      href: '/admin/investor-partnerships?lane=builder',
    })
  }
  if (bounceRiskLeads > 0) {
    alerts.push({
      severity: 'info',
      message: `${bounceRiskLeads} lead${bounceRiskLeads === 1 ? '' : 's'} flagged for bounce risk or failed delivery.`,
      href: '/admin/leads',
    })
  }
  if (legacyLeadOutreachCount > 0) {
    alerts.push({
      severity: 'info',
      message: `${legacyLeadOutreachCount} legacy lead outreach draft${legacyLeadOutreachCount === 1 ? '' : 's'} hidden from today’s queue.`,
      href: '/admin/leads',
    })
  }
  if (cooldownSaves7d > 0) {
    alerts.push({
      severity: 'info',
      message: `${cooldownSaves7d} duplicate partner discovery run${cooldownSaves7d === 1 ? '' : 's'} skipped in the last 7d to protect usage.`,
      href: '/admin/scrape-runs',
    })
  }
  if (local.dmExports.length > 0 && local.dmExports.every((e) => e.ageDays > 7)) {
    alerts.push({
      severity: 'warning',
      message: `All ${staleExports} DealMachine contact exports on disk are older than 7 days. Export fresh contacts before the next send.`,
    })
  }
  if (sourceGovernor.paidSourcesBlocked > 0) {
    alerts.push({
      severity: 'info',
      message: `${sourceGovernor.paidSourcesBlocked} paid source${sourceGovernor.paidSourcesBlocked === 1 ? '' : 's'} blocked by the source governor.`,
      href: '/admin/lead-sources',
    })
  }
  if (dealMemory.totalAnalyses === 0) {
    alerts.push({
      severity: 'info',
      message: 'No saved command-center deal twins yet. Save the next analyzer run before sending an offer.',
      href: '/admin/command-center',
    })
  }
  if (missingSuppressionDb) {
    alerts.push({
      severity: 'critical',
      message: 'Lead suppression records could not be read. Keep live outreach paused until opt-out checks are visible.',
      href: '/admin/leads',
    })
  }
  if (activeSuppressionCount > 0) {
    alerts.push({
      severity: 'info',
      message: `${activeSuppressionCount} active opt-out suppression${activeSuppressionCount === 1 ? '' : 's'} are being honored by seller outreach.`,
      href: '/admin/leads',
    })
  }

  // ── Priorities ─────────────────────────────────────────────────────────────
  const priorities = (
    liveDataReachable
      ? [
          replySignals7d > 0
            ? `Answer and advance ${replySignals7d} live repl${replySignals7d === 1 ? 'y' : 'ies'} before sending anything new.`
            : null,
          sendReady === 0
            ? 'Refill the outreach queue: source, score, and draft before volume.'
            : `Approve and send from the ${sendReady}-message ready queue (target ${outreachTarget}/day).`,
          strategyLab.nextMove,
          activePartnerDiscoveryRuns7d === 0 && cooldownSaves7d === 0
            ? 'Launch a fresh buyer, lender, or builder discovery market — no partner discovery runs landed in the last 7 days.'
            : null,
          followupsDue > 0 ? `Clear ${followupsDue} lead follow-up${followupsDue === 1 ? '' : 's'} marked due.` : null,
          pendingBuyerMatches + pendingLenderMatches > 0
            ? `Route ${pendingBuyerMatches + pendingLenderMatches} open match${pendingBuyerMatches + pendingLenderMatches === 1 ? '' : 'es'} to buyers/lenders.`
            : null,
          partnerResearchBlocked > 0
            ? `Advance ${partnerResearchBlocked} partner profile${partnerResearchBlocked === 1 ? '' : 's'} from research into confirmed buy boxes or outreach-ready criteria.`
            : null,
          openChecklists > 0
            ? `Finish ${openChecklists} research checklist${openChecklists === 1 ? '' : 's'} blocking outreach.`
            : null,
          publishedContent7d < 5
            ? 'Publish proof-backed authority content — visibility cadence is below 5/week.'
            : null,
          overdueTasks.length > 0 ? `Close ${overdueTasks.length} overdue operator task${overdueTasks.length === 1 ? '' : 's'}.` : null,
        ]
      : ['Restore live data reads first — operating blind on cached zeros is how bad sends happen.']
  ).filter(Boolean) as string[]

  // ── Agents ─────────────────────────────────────────────────────────────────
  const agentStatus = (active: boolean, attention: boolean): AgentStatus =>
    attention ? 'attention' : active ? 'active' : 'idle'

  const recentLeadFeed: AgentFeedItem[] = currentLeads.slice(0, 5).map((lead) => ({
    label: lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : lead.source || 'Lead',
    detail: `${lead.lead_type || 'lead'} · ${lead.status || 'new'}`,
    at: lead.created_at || null,
    href: leadHref(lead),
  }))

  const agents: AgentPanelData[] = [
    {
      key: 'acquisition',
      name: 'Lead Acquisition',
      role: 'Sellers, distress stacks, DealMachine lanes, partner signups',
      status: agentStatus(
        newLeads7d > 0 || activePartnerDiscoveryRuns7d > 0,
        failedScrapes24h > 0 || failedPartnerRuns7d > 0 || (local.dmExports.length > 0 && staleExports === local.dmExports.length)
      ),
      statusReason:
        failedScrapes24h > 0 || failedPartnerRuns7d > 0
          ? `${failedScrapes24h + failedPartnerRuns7d} runtime/discovery issue${failedScrapes24h + failedPartnerRuns7d === 1 ? '' : 's'} need review`
          : builderPartners > 0
            ? `${builderPartners} partner-side profiles discovered · ${activePartnerDiscoveryRuns7d} current discovery runs this week`
            : newLeads7d > 0
              ? `${newLeads7d} new leads this week`
              : 'No new inflow this week',
      kpis: [
        { label: 'New 24h', value: newLeads24h, status: newLeads24h > 0 ? 'green' : 'yellow' },
        { label: 'New 7d', value: newLeads7d },
        { label: 'Discovery 7d', value: activePartnerDiscoveryRuns7d, helper: `${cooldownSaves7d} duplicate runs skipped` },
        { label: 'Partner research', value: partnerResearchReady, helper: 'builder / lender / buyer records ready for internal review' },
      ],
      feed: recentLeadFeed,
      actions: [
        { label: 'Open leads', href: '/admin/leads' },
        { label: 'Investor partnerships', href: '/admin/investor-partnerships' },
        { label: 'Lead sources', href: '/admin/lead-sources' },
        { label: 'Market expansion', href: '/admin/market-expansion' },
        { label: 'Scrape runs', href: '/admin/scrape-runs' },
      ],
    },
    {
      key: 'outreach',
      name: 'Outreach',
      role: 'Email/SMS sends, follow-up cadence, queue health',
      status: agentStatus(outreach24h > 0, sendReady === 0 || followupsDue > 10),
      statusReason:
        sendReady === 0
          ? 'Queue empty — needs refill'
          : `${outreach24h}/${outreachTarget} sent in 24h · ${sendReady} ready`,
      kpis: [
        {
          label: 'Sent 24h',
          value: outreach24h,
          helper: `target ${outreachTarget}`,
          status: outreach24h >= outreachTarget ? 'green' : outreach24h > 0 ? 'yellow' : 'red',
        },
        { label: 'Send-ready', value: sendReady, status: sendReady >= 25 ? 'green' : sendReady > 0 ? 'yellow' : 'red' },
        { label: 'Needs review', value: needsReview },
        { label: 'Follow-ups due', value: followupsDue, status: followupsDue > 10 ? 'yellow' : undefined },
      ],
      feed: currentOutreachSendEvents.slice(0, 5).map((event) => ({
        label: event.subject || `Email ${lower(event.status) || 'event'}`,
        detail: event.channel || 'email',
        at: event.created_at || null,
        href: event.lead_id ? leadHref(leadById.get(event.lead_id)) : '/admin/leads',
      })),
      actions: [
        { label: 'Buyer outreach', href: '/admin/buyer-outreach' },
        { label: 'Lender outreach', href: '/admin/lender-outreach' },
        { label: 'Lead queue', href: '/admin/leads' },
      ],
    },
    {
      key: 'routing',
      name: 'Deal Routing',
      role: 'Fit decisions: cash, creative, novation, buy boxes, lending boxes',
      status: agentStatus(pendingBuyerMatches + pendingLenderMatches > 0, pendingBuyerMatches + pendingLenderMatches > 20),
      statusReason:
        builderPartners > 0
          ? `${pendingBuyerMatches + pendingLenderMatches} open matches · ${dealMachineAlignedPartners} DealMachine-aligned partner profiles`
          : `${pendingBuyerMatches + pendingLenderMatches} open matches awaiting routing`,
      kpis: [
        { label: 'Buyer matches', value: pendingBuyerMatches },
        { label: 'Lender matches', value: pendingLenderMatches },
        { label: 'Builder lane', value: builderPartners, helper: 'partner-side builder / developer records' },
        { label: 'DM aligned', value: dealMachineAlignedPartners, helper: 'partners in active DealMachine markets' },
      ],
      feed: investorPipelineRows
        .filter((item) => item.pipeline.builderLane || item.pipeline.dealMachineAligned)
        .slice(0, 4)
        .map((item) => ({
          label: item.investor.display_name,
          detail: `${item.pipeline.stageLabel}${item.pipeline.dealMachineAligned ? ' · DM aligned' : ''}`,
          at: item.investor.updated_at || item.investor.created_at || null,
          href: '/admin/investor-partnerships',
        })),
      actions: [
        { label: 'Buyer matches', href: '/admin/buyer-matches' },
        { label: 'Lender matches', href: '/admin/lender-matches' },
        { label: 'Partner engine', href: '/admin/investor-partnerships?lane=builder' },
      ],
    },
    {
      key: 'underwriting',
      name: 'Underwriting & Packets',
      role: 'Analyzer output, assignment math, builder packets, lender fit',
      status: agentStatus(pendingLenderMatches > 0 || partnerOutreachReady > 0, pendingLenderMatches > 12),
      statusReason:
        pendingLenderMatches > 0
          ? `${pendingLenderMatches} lender match${pendingLenderMatches === 1 ? '' : 'es'} waiting on underwriting context`
          : `${partnerBuyBoxesConfirmed} confirmed criteria and ${partnerOutreachReady} outreach-ready partner profiles`,
      kpis: [
        { label: 'Lender matches', value: pendingLenderMatches, status: pendingLenderMatches > 0 ? 'yellow' : 'green' },
        { label: 'Buy boxes confirmed', value: partnerBuyBoxesConfirmed, status: partnerBuyBoxesConfirmed > 0 ? 'green' : 'yellow' },
        { label: 'Outreach ready', value: partnerOutreachReady },
        { label: 'Builder lane', value: builderPartners },
      ],
      feed: investorPipelineRows
        .filter((item) => item.pipeline.outreachReady || item.pipeline.buyBoxConfirmed)
        .slice(0, 4)
        .map((item) => ({
          label: item.investor.display_name,
          detail: `${item.pipeline.stageLabel}${item.pipeline.buyBoxConfirmed ? ' · confirmed' : ''}`,
          at: item.investor.updated_at || item.investor.created_at || null,
          href: '/admin/investor-partnerships',
        })),
      actions: [
        { label: 'Lender network', href: '/admin/lenders' },
        { label: 'Lender matches', href: '/admin/lender-matches' },
        { label: 'Partner engine', href: '/admin/investor-partnerships' },
        { label: 'Property analyzer', href: '/property-analyzer' },
      ],
    },
    {
      key: 'authority',
      name: 'Authority Engine',
      role: 'AEO, SEO, PR, content, indexing — runs behind the scenes',
      status: agentStatus(publishedContent7d > 0, publishedContent7d === 0 && openSeoOpportunities > 0),
      statusReason: `${publishedContent7d} published this week · ${openSeoOpportunities} authority tasks open`,
      kpis: [
        { label: 'Published 7d', value: publishedContent7d, helper: 'target 5/week', status: publishedContent7d >= 5 ? 'green' : 'yellow' },
        { label: 'Total published', value: publishedContent.length },
        { label: 'Authority tasks', value: openSeoOpportunities },
        { label: 'PR drafts', value: draftPitches },
      ],
      feed: publishedContent.slice(0, 4).map((asset) => ({
        label: asset.content_type || 'asset',
        detail: lower(asset.indexed_status) || 'published',
        at: asset.published_at || asset.updated_at || null,
      })),
      actions: [
        { label: 'Research', href: '/admin/research' },
        { label: 'Daily reports', href: '/admin/reports/daily' },
      ],
    },
    {
      key: 'qa',
      name: 'QA / Funnel Health',
      role: 'Intake, signup, analyzer, delivery, broken-state detection',
      status: agentStatus(true, failedScrapes24h > 0 || failedPartnerRuns7d > 0 || bounceRiskLeads > 25),
      statusReason:
        failedScrapes24h > 0 || failedPartnerRuns7d > 0
          ? `${failedScrapes24h + failedPartnerRuns7d} runtime/discovery issue${failedScrapes24h + failedPartnerRuns7d === 1 ? '' : 's'} · ${bounceRiskLeads} delivery-risk leads`
          : partnerResearchBlocked > 0
            ? `${partnerResearchBlocked} partner profile${partnerResearchBlocked === 1 ? '' : 's'} still blocked before outreach`
            : `${bounceRiskLeads} delivery-risk leads tracked`,
      kpis: [
        { label: 'Discovery 7d', value: activePartnerDiscoveryRuns7d, status: activePartnerDiscoveryRuns7d > 0 ? 'green' : 'yellow' },
        { label: 'Cooldown saves', value: cooldownSaves7d, helper: 'duplicate markets skipped' },
        { label: 'Failed runs', value: failedPartnerRuns7d + failedScrapes24h, status: failedPartnerRuns7d + failedScrapes24h > 0 ? 'red' : 'green' },
        { label: 'Research open', value: openChecklists + investorFollowupsOpen + partnerResearchBlocked },
      ],
      feed: partnerDiscoveryRuns.slice(0, 4).map((run) => ({
        label: `${run.lane} · ${run.sourceKey || 'runtime'}`,
        detail: `${lower(run.status) || 'run'}${run.resultCount ? ` · ${run.resultCount}` : ''}${isCooldownNote(run.note) ? ' · cooled down' : ''}`,
        at: run.completedAt || run.startedAt || null,
        href: '/admin/scrape-runs',
      })),
      actions: [
        { label: 'Scrape runs', href: '/admin/scrape-runs' },
        { label: 'Research checklists', href: '/admin/research-checklists' },
        { label: 'Lead sources', href: '/admin/lead-sources' },
      ],
    },
    {
      key: 'operator',
      name: 'Operator Intelligence',
      role: 'Today’s priorities, escalations, stalled work, relationships',
      status: agentStatus(true, urgentTasks.length > 0 || overdueTasks.length > 0),
      statusReason: `${openTasks.length} open tasks · ${urgentTasks.length} urgent · ${overdueTasks.length} overdue`,
      kpis: [
        { label: 'Open tasks', value: openTasks.length },
        { label: 'Urgent', value: urgentTasks.length, status: urgentTasks.length > 0 ? 'yellow' : 'green' },
        { label: 'Overdue', value: overdueTasks.length, status: overdueTasks.length > 0 ? 'red' : 'green' },
        { label: 'Partner follow-ups', value: investorFollowupsOpen },
      ],
      feed: openTasks.slice(0, 5).map((task) => ({
        label: task.title || 'Task',
        detail: `${lower(task.priority) || 'normal'}${task.due_at ? ` · due ${new Date(task.due_at).toLocaleDateString()}` : ''}`,
        at: task.updated_at || task.created_at || null,
        href: taskRelatedHref(task),
      })),
      actions: [
        { label: 'Lead queue', href: '/admin/leads' },
        { label: 'Investor partnerships', href: '/admin/investor-partnerships' },
        { label: 'Buyer outreach', href: '/admin/buyer-outreach' },
        { label: 'Lender outreach', href: '/admin/lender-outreach' },
      ],
    },
  ]

  const overdueTaskItems: OverdueTaskItem[] = overdueTasks
    .sort((a, b) => {
      const priorityDelta = priorityWeight(b.priority) - priorityWeight(a.priority)
      if (priorityDelta !== 0) return priorityDelta
      const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY
      const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY
      return aDue - bDue
    })
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title || 'Task',
      detail:
        task.description ||
        `${task.task_type || 'operator'}${task.user_email ? ` · ${task.user_email}` : ''}${task.entity_type ? ` · ${task.entity_type}` : ''}`,
      dueAt: task.due_at || null,
      priority: task.priority || 'normal',
      status: task.status || 'open',
      href: '/admin/command-center',
      relatedHref: taskRelatedHref(task),
    }))

  // ── Mission nodes (intensity drives the visualization) ─────────────────────
  const missionNodes: MissionNode[] = [
    {
      key: 'acquisition',
      label: 'Acquire',
      intensity: clamp01(newLeads7d / 50),
      status: agentStatus(
        newLeads7d > 0 || activePartnerDiscoveryRuns7d > 0,
        failedScrapes24h > 0 || failedPartnerRuns7d > 0
      ),
      headline: `${newLeads24h} fresh lead${newLeads24h === 1 ? '' : 's'} today · ${activePartnerDiscoveryRuns7d} partner run${activePartnerDiscoveryRuns7d === 1 ? '' : 's'} this week`,
      detail: 'Lead inflow is the front door. This lane should tell us whether fresh seller inventory and partner discovery are actually feeding the machine.',
      signals: [
        { label: 'New 24h', value: newLeads24h, status: newLeads24h > 0 ? 'green' : 'yellow' },
        { label: 'Discovery 7d', value: activePartnerDiscoveryRuns7d, helper: `${cooldownSaves7d} duplicate runs skipped` },
        { label: 'DM exports', value: local.dmExports.length, helper: staleExports === local.dmExports.length && local.dmExports.length > 0 ? 'all stale' : 'saved on disk' },
      ],
      watchItems: [
        staleExports === local.dmExports.length && local.dmExports.length > 0
          ? 'Refresh DealMachine exports before another seller push.'
          : 'Fresh contact exports are available for the next seller run.',
        partnerResearchReady > 0
          ? `${partnerResearchReady} partner profiles are ready for internal review.`
          : 'No partner profiles are staged for review yet.',
      ],
      actions: [
        { label: 'Open leads', href: '/admin/leads' },
        { label: 'Lead sources', href: '/admin/lead-sources' },
        { label: 'Partner engine', href: '/admin/investor-partnerships' },
      ],
    },
    {
      key: 'outreach',
      label: 'Outreach',
      intensity: clamp01(sends7d / (outreachTarget * 3)),
      status: agentStatus(outreach24h > 0, sendReady === 0 || followupsDue > 10),
      headline: `${outreach24h}/${outreachTarget} sent today · ${sendReady} seller draft${sendReady === 1 ? '' : 's'} ready now`,
      detail: 'This is the live contact desk: hot seller replies, approved sends, due follow-ups, and the lanes that can turn into conversations today.',
      signals: [
        { label: 'Sent 24h', value: outreach24h, helper: `target ${outreachTarget}`, status: outreach24h >= outreachTarget ? 'green' : outreach24h > 0 ? 'yellow' : 'red' },
        { label: 'Seller ready', value: sendReady, status: sendReady > 0 ? 'green' : 'red' },
        { label: 'Partner ready', value: buyerApproved + lenderApproved, helper: `${buyerNeedsReview + lenderNeedsReview} still need approval` },
      ],
      watchItems: [
        replySignals7d > 0
          ? `${replySignals7d} live seller repl${replySignals7d === 1 ? 'y is' : 'ies are'} waiting on operator movement.`
          : 'No fresh seller reply signal is showing right now.',
        followupsDue + partnerFollowupsDue > 0
          ? `${followupsDue + partnerFollowupsDue} follow-up${followupsDue + partnerFollowupsDue === 1 ? '' : 's'} are due across seller and partner lanes.`
          : 'No follow-up backlog is pressuring the queue.',
      ],
      actions: [
        { label: 'Lead queue', href: '/admin/leads' },
        { label: 'Buyer outreach', href: '/admin/buyer-outreach' },
        { label: 'Lender outreach', href: '/admin/lender-outreach' },
      ],
    },
    {
      key: 'routing',
      label: 'Route',
      intensity: clamp01((pendingBuyerMatches + pendingLenderMatches) / 20),
      status: agentStatus(pendingBuyerMatches + pendingLenderMatches > 0, pendingBuyerMatches + pendingLenderMatches > 20),
      headline: `${pendingBuyerMatches + pendingLenderMatches} open routing decision${pendingBuyerMatches + pendingLenderMatches === 1 ? '' : 's'} across buyers and lenders`,
      detail: 'Routing should feel like a live graph: where this property goes next, who fits it, what is missing, and what is cooling off.',
      signals: [
        { label: 'Buyer matches', value: pendingBuyerMatches },
        { label: 'Lender matches', value: pendingLenderMatches },
        { label: 'DM aligned', value: dealMachineAlignedPartners, helper: 'partner overlap with active markets' },
      ],
      watchItems: [
        builderPartners > 0
          ? `${builderPartners} builder/developer profiles can be used for heavier rehab or infill routing.`
          : 'Builder lane is not stocked yet.',
        pendingBuyerMatches + pendingLenderMatches > 0
          ? 'Open matches need disposition decisions before they go stale.'
          : 'No routing queue pressure right now.',
      ],
      actions: [
        { label: 'Buyer matches', href: '/admin/buyer-matches' },
        { label: 'Lender matches', href: '/admin/lender-matches' },
        { label: 'Builder lane', href: '/admin/investor-partnerships?lane=builder' },
      ],
    },
    {
      key: 'underwriting',
      label: 'Underwrite',
      intensity: clamp01((pendingLenderMatches + partnerBuyBoxesConfirmed) / 10),
      status: agentStatus(pendingLenderMatches > 0 || partnerOutreachReady > 0, pendingLenderMatches > 12),
      headline: `${partnerBuyBoxesConfirmed} confirmed criteria · ${pendingLenderMatches} capital route${pendingLenderMatches === 1 ? '' : 's'} waiting on clean packaging`,
      detail: 'Underwriting is where raw opportunity becomes a confident seller path, lender path, and packet-ready offer conversation.',
      signals: [
        { label: 'Confirmed boxes', value: partnerBuyBoxesConfirmed, status: partnerBuyBoxesConfirmed > 0 ? 'green' : 'yellow' },
        { label: 'Outreach ready', value: partnerOutreachReady },
        { label: 'Builder lane', value: builderPartners },
      ],
      watchItems: [
        partnerResearchBlocked > 0
          ? `${partnerResearchBlocked} partner profile${partnerResearchBlocked === 1 ? '' : 's'} still need research or box confirmation.`
          : 'Partner research is not blocking current underwriting.',
        'Use Property Command to keep cash, creative, novation, and packet logic on one surface.',
      ],
      actions: [
        { label: 'Property command', href: '#property-command' },
        { label: 'Lender matches', href: '/admin/lender-matches' },
        { label: 'Partner engine', href: '/admin/investor-partnerships' },
      ],
    },
    {
      key: 'authority',
      label: 'Authority',
      intensity: clamp01(publishedContent7d / 5),
      status: agentStatus(publishedContent7d > 0, publishedContent7d === 0 && openSeoOpportunities > 0),
      headline: `${publishedContent7d} published this week · ${openSeoOpportunities} authority task${openSeoOpportunities === 1 ? '' : 's'} open`,
      detail: 'Authority is the quiet force multiplier. It should support better inbound, warmer outreach, and stronger partner confidence without becoming dashboard clutter.',
      signals: [
        { label: 'Published 7d', value: publishedContent7d, helper: 'target 5/week', status: publishedContent7d >= 5 ? 'green' : 'yellow' },
        { label: 'Open tasks', value: openSeoOpportunities },
        { label: 'PR drafts', value: draftPitches },
      ],
      watchItems: [
        latestReport?.recommended_actions?.length
          ? 'Daily report is pushing fresh authority and growth actions.'
          : 'No fresh authority report recommendations are loaded yet.',
        publishedContent7d < 5 ? 'Publishing cadence is below target right now.' : 'Authority cadence is on track.',
      ],
      actions: [
        { label: 'Research', href: '/admin/research' },
        { label: 'Daily reports', href: '/admin/reports/daily' },
      ],
    },
    {
      key: 'qa',
      label: 'QA',
      intensity:
        failedScrapes24h > 0 || failedPartnerRuns7d > 0
          ? 0.9
          : clamp01((okScrapes24h + activePartnerDiscoveryRuns7d) / 10),
      status: agentStatus(true, failedScrapes24h > 0 || failedPartnerRuns7d > 0 || bounceRiskLeads > 25),
      headline: `${failedPartnerRuns7d + failedScrapes24h} failed run${failedPartnerRuns7d + failedScrapes24h === 1 ? '' : 's'} · ${bounceRiskLeads} delivery-risk lead${bounceRiskLeads === 1 ? '' : 's'}`,
      detail: 'QA is less about pretty charts and more about knowing what is quietly breaking the operator workflow before it costs us responses.',
      signals: [
        { label: 'Cooldown saves', value: cooldownSaves7d, helper: 'duplicate runs skipped' },
        { label: 'Failed runs', value: failedPartnerRuns7d + failedScrapes24h, status: failedPartnerRuns7d + failedScrapes24h > 0 ? 'red' : 'green' },
        { label: 'Bounce risk', value: bounceRiskLeads },
      ],
      watchItems: [
        failedPartnerRuns7d > 0 || failedScrapes24h > 0
          ? 'Source and discovery failures need clearing before more volume.'
          : 'No acute source failures are showing right now.',
        bounceRiskLeads > 0
          ? 'Delivery risk is building inside the seller queue.'
          : 'Delivery quality looks stable.',
      ],
      actions: [
        { label: 'Scrape runs', href: '/admin/scrape-runs' },
        { label: 'Research checklists', href: '/admin/research-checklists' },
      ],
    },
    {
      key: 'operator',
      label: 'Operator',
      intensity: clamp01(openTasks.length / 20),
      status: agentStatus(true, urgentTasks.length > 0 || overdueTasks.length > 0),
      headline: `${urgentTasks.length} urgent · ${overdueTasks.length} overdue · ${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}`,
      detail: 'The operator lane should tell you what actually needs your judgment now, not just what exists in the database.',
      signals: [
        { label: 'Open tasks', value: openTasks.length },
        { label: 'Urgent', value: urgentTasks.length, status: urgentTasks.length > 0 ? 'yellow' : 'green' },
        { label: 'Overdue', value: overdueTasks.length, status: overdueTasks.length > 0 ? 'red' : 'green' },
      ],
      watchItems: [
        priorities[0] || 'No priority stack is loaded yet.',
        openTasks.length > 0 ? 'Clear the overdue board before opening new loops.' : 'Operator board is clear right now.',
      ],
      actions: [
        { label: 'Lead queue', href: '/admin/leads' },
        { label: 'Strategy engine', href: '#strategy-engine' },
        { label: 'Partner engine', href: '/admin/investor-partnerships' },
      ],
    },
  ]

  const inboxSummary: AgentKpi[] = [
    { label: 'Hot seller replies', value: hotLeadReplies.length, status: hotLeadReplies.length > 0 ? 'yellow' : 'green' },
    { label: 'Partner replies', value: partnerReplyItems.length },
    { label: 'Follow-ups due', value: followupsDue + partnerFollowupsDue, status: followupsDue + partnerFollowupsDue > 0 ? 'yellow' : 'green' },
    { label: 'Ready to send', value: sendReady + buyerApproved + lenderApproved, status: sendReady + buyerApproved + lenderApproved > 0 ? 'green' : 'yellow' },
  ]

  const inboxSections: CommandCenterInboxSection[] = [
    {
      key: 'hot_replies',
      title: 'Hot seller replies',
      hint: 'watch this first',
      items: hotLeadReplies,
    },
    {
      key: 'partner_replies',
      title: 'Partner replies',
      hint: 'buyers and lenders',
      items: partnerReplyItems,
    },
    {
      key: 'stale_threads',
      title: 'Follow-ups and stale threads',
      hint: 'keep momentum',
      items: staleThreadItems.slice(0, 4),
    },
    {
      key: 'automation_alerts',
      title: 'Automation and queue alerts',
      hint: 'watch the machine',
      items: automationAlertItems,
    },
  ]

  const outreachQueues: CommandCenterQueueCard[] = [
    {
      key: 'seller',
      title: 'Seller outreach',
      detail: 'Live seller drafts and follow-up pressure. Use this lane to send, reply, and keep DealMachine-fed inventory moving.',
      href: '/admin/leads',
      kpis: [
        { label: 'Send ready', value: sendReady, status: sendReady > 0 ? 'green' : 'red' },
        { label: 'Needs review', value: needsReview },
        { label: 'Follow-ups', value: followupsDue, status: followupsDue > 0 ? 'yellow' : 'green' },
      ],
      items: sellerQueueItems,
      actions: [
        navigateAction('seller-queue-open', 'Open seller queue', '/admin/leads', 'primary'),
        ...(recommendedSprintTarget > 0
          ? [
              leadThroughputSprintAction(
                'seller-throughput-live',
                `Push ${recommendedSprintTarget} toward cap`,
                recommendedSprintTarget,
                { tone: 'success' }
              ),
            ]
          : []),
        leadThroughputSprintAction(
          'seller-throughput-preview',
          recommendedSprintTarget > 0 ? 'Preview cap sprint' : 'Preview next sprint',
          Math.max(1, recommendedSprintTarget || Math.min(outreachTarget, maxSprintTarget)),
          { dryRun: true }
        ),
        ...(sellerNeedsReviewActions.length
          ? [leadBulkAction('seller-queue-approve', 'Approve top drafts', [...new Set(sellerNeedsReviewActions)], 'approve_outreach', 'primary')]
          : []),
        ...(sellerSendBatchMessages.length
          ? [leadSendBatchAction('seller-queue-send', 'Send top ready', sellerSendBatchMessages, 'success')]
          : []),
        navigateAction('seller-queue-sources', 'Open lead sources', '/admin/lead-sources'),
      ],
    },
    {
      key: 'buyer',
      title: 'Buyer outreach',
      detail: 'Approved buyer recruiting, criteria follow-up, and stale partner threads that can be pushed from the cockpit.',
      href: '/admin/buyer-outreach',
      kpis: [
        { label: 'Approved', value: buyerApproved, status: buyerApproved > 0 ? 'green' : 'yellow' },
        { label: 'Needs review', value: buyerNeedsReview },
        { label: 'Follow-ups', value: t.buyers.filter((buyer) => buyer.next_follow_up_at && Date.parse(buyer.next_follow_up_at) < Date.now()).length },
      ],
      items: buyerQueueItems,
      actions: [
        navigateAction('buyer-queue-open', 'Open buyer outreach', '/admin/buyer-outreach', 'primary'),
        ...(buyerNeedsReviewActions.length
          ? [buyerBulkAction('buyer-queue-approve', 'Approve top drafts', [...new Set(buyerNeedsReviewActions)], 'approve_outreach', 'primary')]
          : []),
        ...(buyerSendBatchMessages.length
          ? [buyerSendBatchAction('buyer-queue-send', 'Send approved', buyerSendBatchMessages, 'success')]
          : []),
        navigateAction('buyer-network-open', 'Open buyers', '/admin/buyers'),
      ],
    },
    {
      key: 'lender',
      title: 'Lender outreach',
      detail: 'Capital recruiting and lender relationship follow-up that can move directly from command without digging through separate pages.',
      href: '/admin/lender-outreach',
      kpis: [
        { label: 'Approved', value: lenderApproved, status: lenderApproved > 0 ? 'green' : 'yellow' },
        { label: 'Needs review', value: lenderNeedsReview },
        { label: 'Follow-ups', value: t.lenders.filter((lender) => lender.next_follow_up_at && Date.parse(lender.next_follow_up_at) < Date.now()).length },
      ],
      items: lenderQueueItems,
      actions: [
        navigateAction('lender-queue-open', 'Open lender outreach', '/admin/lender-outreach', 'primary'),
        ...(lenderNeedsReviewActions.length
          ? [lenderBulkAction('lender-queue-approve', 'Approve top drafts', [...new Set(lenderNeedsReviewActions)], 'approve_outreach', 'primary')]
          : []),
        ...(lenderSendBatchMessages.length
          ? [lenderSendBatchAction('lender-queue-send', 'Send approved', lenderSendBatchMessages, 'success')]
          : []),
        navigateAction('lender-network-open', 'Open lenders', '/admin/lenders'),
      ],
    },
    {
      key: 'builder',
      title: 'Builder / partner lane',
      detail: 'Builder and developer profiles that are close to useful. This is where partner research becomes routing leverage instead of dead data.',
      href: '/admin/investor-partnerships?lane=builder',
      kpis: [
        { label: 'Builder lane', value: builderPartners },
        { label: 'Outreach ready', value: partnerOutreachReady, status: partnerOutreachReady > 0 ? 'green' : 'yellow' },
        { label: 'Confirmed boxes', value: partnerBuyBoxesConfirmed },
      ],
      items: builderQueueItems,
      actions: [
        navigateAction('builder-lane-open', 'Open builder lane', '/admin/investor-partnerships?lane=builder', 'primary'),
        ...(builderOutreachReadyIds.length
          ? [investorBulkAction('builder-lane-approve', 'Approve outreach', [...new Set(builderOutreachReadyIds)], 'approve_outreach', 'primary')]
          : []),
        ...(builderResearchReadyIds.length
          ? [investorBulkAction('builder-lane-research', 'Stage research', [...new Set(builderResearchReadyIds)], 'mark_researched', 'warning')]
          : []),
        navigateAction('partner-engine-open', 'Open partner engine', '/admin/investor-partnerships'),
      ],
    },
  ]

  const sellerSends24h = currentOutreachSendEvents.filter(
    (event) => ['accepted', 'sent'].includes(lower(event.status)) && lower(event.channel) === 'email' && withinHours(event.created_at, 24)
  ).length
  const buyerSends24h = activeBuyerOutreach.filter(
    (message) => lower(message.status) === 'sent' && withinHours(message.sent_at || message.updated_at, 24)
  ).length
  const lenderSends24h = activeLenderOutreach.filter(
    (message) => lower(message.status) === 'sent' && withinHours(message.sent_at || message.updated_at, 24)
  ).length
  const failedSends24h =
    currentOutreachSendEvents.filter((event) => lower(event.status) === 'failed' && withinHours(event.created_at, 24)).length +
    activeBuyerOutreach.filter((message) => lower(message.status) === 'failed' && withinHours(message.updated_at, 24)).length +
    activeLenderOutreach.filter((message) => lower(message.status) === 'failed' && withinHours(message.updated_at, 24)).length
  const revenueReplies24h = t.commandCenterReplyMemory.filter(
    (reply) =>
      ['hot_seller_lead', 'partner_reply'].includes(lower(reply.classification)) &&
      withinHours(reply.received_at, 24)
  ).length
  const enrollmentFollowupsDue = t.commandCenterOutboundEnrollments.filter(
    (enrollment) =>
      enrollment.next_action_at &&
      Date.parse(enrollment.next_action_at) <= Date.now() &&
      ['sent', 'approved', 'queued'].includes(lower(enrollment.status))
  ).length
  const mailboxReadiness = getOutlookMailboxStatus()
  if (mailboxReadiness.configured && strategyExecution.blockers.length) {
    strategyExecution = {
      ...strategyExecution,
      blockers: strategyExecution.blockers.filter(
        (blocker) => !/^Reply capture for .* is disconnected\./i.test(blocker)
      ),
    }
  }
  const revenueFunnel = buildRevenueFunnelSnapshot({
    leads: currentLeads,
    outreachMessages: currentOutreachMessages,
    outreachSendEvents: currentOutreachSendEvents,
    buyerPackets: propertyBuyerPackets,
    buyerPacketSends: t.propertyBuyerPacketSends,
    dealPipelineItems,
    mailboxReady: mailboxReadiness.configured,
    outboundReady:
      outboundReadiness.defaultProvider !== 'none' && outboundReadiness.mailingAddressConfigured,
  })
  const mailboxJob = t.commandCenterJobs.find((job) => job.job_key === 'reply-memory-sync') || null
  const revenueLoopJob = t.commandCenterJobs.find((job) => job.job_key === 'seller-outreach-batch') || null
  const latestBuyerPipeline = t.buyerDiscoveryRuns.find((run) => lower(run.run_type) === 'daily_pipeline') || null
  const reportDelivery = (latestReport?.summary_json?.delivery || null) as Record<string, unknown> | null
  const jobsDue = t.commandCenterJobs.filter(
    (job) =>
      !['paused'].includes(lower(job.status)) &&
      job.next_run_at &&
      Date.parse(job.next_run_at) <= Date.now()
  ).length
  const jobsBlocked = t.commandCenterJobs.filter(
    (job) => ['blocked', 'failed'].includes(lower(job.status)) || ['failed', 'disconnected'].includes(lower(job.last_status))
  ).length
  const latestSellerSendAt = latestTimestamp(
    currentOutreachSendEvents
      .filter((event) => ['accepted', 'sent'].includes(lower(event.status)))
      .map((event) => event.created_at)
  )
  const latestBuyerSendAt = latestTimestamp(
    activeBuyerOutreach
      .filter((message) => lower(message.status) === 'sent')
      .map((message) => message.sent_at || message.updated_at)
  )
  const latestLenderSendAt = latestTimestamp(
    activeLenderOutreach
      .filter((message) => lower(message.status) === 'sent')
      .map((message) => message.sent_at || message.updated_at)
  )
  const latestReplyAt = latestTimestamp(
    t.commandCenterReplyMemory
      .filter((reply) => ['hot_seller_lead', 'partner_reply'].includes(lower(reply.classification)))
      .map((reply) => reply.received_at)
  )
  const automationBlockers: CommandCenterAutomationHealth['blockers'] = []

  if (!deliveryEvidence.allowed) {
    const hasEnoughEvidence = deliveryEvidence.sampleSize >= 20
    automationBlockers.push({
      key: 'delivery-circuit-open',
      severity: hasEnoughEvidence ? 'critical' : 'warning',
      title: hasEnoughEvidence ? 'Email delivery circuit is open' : 'Email delivery evidence is incomplete',
      detail: hasEnoughEvidence
        ? `${(deliveryEvidence.badRate * 100).toFixed(1)}% of finalized email deliveries failed, bounced, or were suppressed. Automated sending is blocked above ${(deliveryEvidence.threshold * 100).toFixed(1)}%.`
        : `Only ${deliveryEvidence.sampleSize} provider-confirmed outcomes are available. Automated sending remains blocked until enough evidence is collected.`,
      href: '#outreach-command',
    })
  }

  if (!mailboxReadiness.configured) {
    automationBlockers.push({
      key: 'mailbox-disconnected',
      severity: 'critical',
      title: 'Acquisitions mailbox is disconnected',
      detail: `Production cannot ingest replies until ${mailboxReadiness.missing.join(' and ')} is configured.`,
      href: '#inbox-command',
    })
  } else if (mailboxJob && ['blocked', 'failed'].includes(lower(mailboxJob.status))) {
    automationBlockers.push({
      key: 'mailbox-sync-failed',
      severity: 'critical',
      title: 'Mailbox sync needs repair',
      detail: String(mailboxJob.last_error || 'The latest Microsoft Graph mailbox sync did not complete.'),
      href: '#inbox-command',
    })
  }
  if (!latestReport) {
    automationBlockers.push({
      key: 'report-missing',
      severity: 'warning',
      title: 'No operations report is stored',
      detail: 'The daily report cron has not left a report record yet.',
      href: '/admin/reports/daily',
    })
  } else if (reportDelivery?.attempted && reportDelivery.ok !== true) {
    automationBlockers.push({
      key: 'report-delivery-failed',
      severity: 'warning',
      title: 'Latest operations report was not delivered',
      detail: String(reportDelivery.error || 'The report exists, but its email delivery was not confirmed.'),
      href: `/admin/reports/daily/${latestReport.report_date}`,
    })
  }
  if (failedSends24h > 0) {
    automationBlockers.push({
      key: 'send-failures',
      severity: 'warning',
      title: `${failedSends24h} outbound send${failedSends24h === 1 ? '' : 's'} failed in 24 hours`,
      detail: 'Review recipient quality and provider errors before retrying these records.',
      href: '#outreach-command',
    })
  }
  if (latestBuyerPipeline && ['failed', 'partial'].includes(lower(latestBuyerPipeline.status))) {
    automationBlockers.push({
      key: 'buyer-pipeline-partial',
      severity: 'warning',
      title: 'Latest buyer pipeline was incomplete',
      detail: String(latestBuyerPipeline.error_message || 'At least one buyer automation stage did not finish.'),
      href: '/admin/scrape-runs',
    })
  }
  if (jobsBlocked > 0 && !automationBlockers.some((blocker) => blocker.key === 'mailbox-sync-failed')) {
    automationBlockers.push({
      key: 'automation-jobs-blocked',
      severity: 'warning',
      title: `${jobsBlocked} automation job${jobsBlocked === 1 ? ' is' : 's are'} blocked or failed`,
      detail: 'Open the strategy engine to inspect the job error and its source or configuration dependency.',
      href: '#strategy-engine',
    })
  } else if (jobsDue > 0) {
    automationBlockers.push({
      key: 'automation-jobs-due',
      severity: 'warning',
      title: `${jobsDue} automation job${jobsDue === 1 ? ' is' : 's are'} due`,
      detail: 'The scheduler has work ready to run or reconcile on its next execution.',
      href: '#strategy-engine',
    })
  }
  if (urgentTasks.length > 0) {
    automationBlockers.push({
      key: 'urgent-operator-work',
      severity: 'warning',
      title: `${urgentTasks.length} urgent operator task${urgentTasks.length === 1 ? '' : 's'} need attention`,
      detail: 'These tasks include revenue replies, blocked sends, or deal-routing work that automation should not guess through.',
      href: '#command-deck',
    })
  }
  if (enrollmentFollowupsDue > 0) {
    automationBlockers.push({
      key: 'automated-followups-due',
      severity: 'warning',
      title: `${enrollmentFollowupsDue} enrolled follow-up${enrollmentFollowupsDue === 1 ? ' is' : 's are'} due`,
      detail: 'Work or advance these contacts before increasing first-touch volume.',
      href: '#outreach-command',
    })
  }
  if (sends7d >= 20 && replySignals7d === 0 && !latestReplyAt) {
    automationBlockers.push({
      key: 'no-reply-signal',
      severity: 'warning',
      title: 'Outbound is moving without a recorded reply signal',
      detail: 'Audit audience fit, message quality, deliverability, and mailbox ingestion before increasing volume.',
      href: '#strategy-engine',
    })
  }
  if (!liveDataReachable) {
    automationBlockers.push({
      key: 'data-sources-unreachable',
      severity: 'critical',
      title: 'Command-center data is incomplete',
      detail: `${issues.length} required data source${issues.length === 1 ? ' is' : 's are'} currently unavailable.`,
      href: '#lane-diagnostics',
    })
  }

  const automationStatus: CommandStatus = automationBlockers.some((blocker) => blocker.severity === 'critical')
    ? 'red'
    : automationBlockers.length || jobsDue > 0 || jobsBlocked > 0
      ? 'yellow'
      : 'green'
  const automationHealth: CommandCenterAutomationHealth = {
    status: automationStatus,
    headline:
      automationStatus === 'red'
        ? 'Automation is running with a critical connection or data blocker.'
        : automationStatus === 'yellow'
          ? 'Revenue loops are visible, with operator work still required.'
          : 'Revenue loops, reporting, and reply capture are healthy.',
    metrics24h: {
      sellerSent: sellerSends24h,
      buyerSent: buyerSends24h,
      lenderSent: lenderSends24h,
      failed: failedSends24h,
      replies: revenueReplies24h,
      followupsDue: enrollmentFollowupsDue,
    },
    deliveryEvidence: {
      windowDays: deliveryEvidence.windowDays,
      sampleSize: deliveryEvidence.sampleSize,
      delivered: deliveryEvidence.delivered,
      bounced: deliveryEvidence.bounced,
      complained: deliveryEvidence.complained,
      suppressed: deliveryEvidence.suppressed,
      failed: deliveryEvidence.failed,
      badRate: deliveryEvidence.badRate,
      threshold: deliveryEvidence.threshold,
      circuitOpen: !deliveryEvidence.allowed,
      reason: deliveryEvidence.reason,
    },
    mailbox: {
      configured: mailboxReadiness.configured,
      mailbox: mailboxReadiness.mailbox,
      authMode: mailboxReadiness.authMode,
      lastSyncAt: mailboxJob?.last_run_at || null,
      lastStatus: mailboxJob?.last_status || null,
      lastError: mailboxJob?.last_error || null,
      missing: mailboxReadiness.missing as string[],
    },
    scheduler: {
      configuredRunsPerDay: envInt('BOSS_DAILY_LOOP_RUNS_PER_DAY', 4),
      jobsTracked: t.commandCenterJobs.length,
      jobsDue,
      jobsBlocked,
      lastRevenueLoopAt: revenueLoopJob?.last_run_at || null,
      lastRevenueLoopStatus: revenueLoopJob?.last_status || null,
      nextRevenueLoopAt: revenueLoopJob?.next_run_at || null,
    },
    buyerPipeline: {
      lastRunId: latestBuyerPipeline?.id || null,
      lastRunAt: latestBuyerPipeline?.completed_at || latestBuyerPipeline?.started_at || null,
      status: latestBuyerPipeline?.status || null,
      sent: Number(latestBuyerPipeline?.result_count || 0),
      error: latestBuyerPipeline?.error_message || null,
    },
    report: {
      reportDate: latestReport?.report_date || null,
      generatedAt: latestReport?.updated_at || latestReport?.created_at || null,
      delivered: reportDelivery ? Boolean(reportDelivery.ok) : null,
      provider: typeof reportDelivery?.provider === 'string' ? reportDelivery.provider : null,
      recipient: typeof reportDelivery?.recipient === 'string' ? reportDelivery.recipient : null,
      error: typeof reportDelivery?.error === 'string' ? reportDelivery.error : null,
    },
    latestActivityAt: latestTimestamp([
      latestSellerSendAt,
      latestBuyerSendAt,
      latestLenderSendAt,
      latestReplyAt,
      latestBuyerPipeline?.completed_at,
      latestReport?.updated_at,
    ]),
    blockers: automationBlockers.slice(0, 6),
  }

  return {
    generatedAt: new Date().toISOString(),
    liveDataReachable,
    dataSourceIssues: issues,
    summary: {
      revenue30d,
      revenueTarget,
      outreach24h,
      outreachTarget,
      newLeads24h,
      replySignals7d,
      openTasks: openTasks.length,
      urgentTasks: urgentTasks.length,
      activePartners: activeBuyers + activeLenders,
      builderPartners,
      dealMachineAlignedPartners,
      partnerResearchReady,
      partnerOutreachReady,
      partnerBuyBoxesConfirmed,
      partnerDiscoveryRuns7d: activePartnerDiscoveryRuns7d,
      cooldownSaves7d,
      failedPartnerRuns7d,
      archivedLegacyRuntimeRows,
      hiddenLegacyDrafts: legacyLeadOutreachCount,
    },
    missionNodes,
    priorities: priorities.slice(0, 7),
    alerts: alerts.slice(0, 8),
    agents,
    automationHealth,
    strategyExecution,
    outboundControl,
    strategyLab,
    operatingLoops,
    operatingArchitecture,
    dealMemory,
    sourceGovernor,
    sourceDoctrine: SOURCE_DOCTRINE,
    suppressionCenter,
    dealMachineFreshness,
    osintSourceBoard,
    outcomeLearning,
    outboundGovernance,
    buyBoxGraph,
    dealPipeline,
    revenueFunnel,
    researchSourceHealth,
    foreclosureCommand,
    autopilot,
    inbox: {
      summary: inboxSummary,
      sections: inboxSections,
    },
    outreachQueues,
    marketHeat,
    routingQueue: [
      { label: 'Buyer matches open', count: pendingBuyerMatches, href: '/admin/buyer-matches' },
      { label: 'Lender matches open', count: pendingLenderMatches, href: '/admin/lender-matches' },
      { label: 'Buyer packets ready', count: dealPipeline.totals.packetReady, href: '#property-command' },
      { label: 'Active deal pipeline', count: dealPipeline.totals.activeDeals, href: '#lane-diagnostics' },
      { label: 'Research checklists open', count: openChecklists, href: '/admin/research-checklists' },
      { label: 'Partner buy boxes to confirm', count: Math.max(0, partnerOutreachReady - partnerBuyBoxesConfirmed), href: '/admin/investor-partnerships' },
      { label: 'Lead follow-ups due', count: followupsDue, href: '/admin/leads?outreachStatus=followup_due' },
      { label: 'Partner follow-ups due', count: partnerFollowupsDue, href: '/admin/buyers' },
    ],
    overdueTasks: overdueTaskItems,
    activity: activityFeed,
    localSignals: {
      dmExports: local.dmExports.slice(0, 6),
      onMarketSweep: local.onMarketSweep,
      taxCodeStack: local.taxCodeStack,
      dealMachineExportRequest: local.dealMachineExportRequest,
      distressStackRows: local.distressStackRows,
      suppressionRecords: local.suppressionRecords.slice(0, 6),
    },
  }
}

export type { DataSourceIssue }
