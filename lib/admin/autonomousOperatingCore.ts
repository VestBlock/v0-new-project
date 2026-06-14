export type CommandStatus = 'green' | 'yellow' | 'red'

export type SourceCostLane = {
  provider: string
  label: string
  status: string
  canRun: boolean
  costTier: string
  reason: string
}

export type AutopilotJobType =
  | 'daily_strategy_plan'
  | 'source_rotation'
  | 'seller_outreach_batch'
  | 'reply_memory_sync'
  | 'suppression_sync'
  | 'followup_router'
  | 'deal_routing_sync'

export type AutopilotJobDefinition = {
  jobKey: string
  jobType: AutopilotJobType
  title: string
  cadence: string
  priority: number
  strategyKey?: string | null
  sourceProvider?: string | null
  market?: string | null
  config: Record<string, unknown>
}

export type AutopilotJobRow = {
  id?: string
  job_key?: string
  job_type?: AutopilotJobType | string
  title?: string
  status?: string
  cadence?: string
  priority?: number
  strategy_key?: string | null
  source_provider?: string | null
  market?: string | null
  next_run_at?: string | null
  last_run_at?: string | null
  last_status?: string | null
  last_error?: string | null
  config_json?: Record<string, unknown> | null
  metrics_json?: Record<string, unknown> | null
}

export type AutopilotRunRow = {
  id?: string
  strategy_key?: string
  strategy_name?: string
  status?: string
  source_provider?: string
  market?: string | null
  target_email_count?: number
  target_sms_count?: number
  lead_count?: number
  draft_count?: number
  approved_count?: number
  sent_count?: number
  sms_review_count?: number
  suppression_blocked_count?: number
  cost_guardrail_status?: string
  artifact_path?: string | null
  created_at?: string | null
  completed_at?: string | null
  metadata_json?: Record<string, unknown> | null
}

export type AutopilotReplyMemoryRow = {
  id?: string
  strategy_key?: string | null
  mailbox?: string | null
  from_email?: string | null
  subject?: string | null
  property_address?: string | null
  market?: string | null
  classification?: string | null
  received_at?: string | null
  next_step?: string | null
  reply_summary?: string | null
}

export type StrategyBatchPlan = {
  strategyKey: string
  strategyName: string
  sourceProvider: 'dealmachine' | 'homeharvest' | 'public_records' | 'manual_csv'
  status: CommandStatus
  markets: string[]
  targetEmailCount: number
  targetSmsReviewCount: number
  blockedReason: string | null
  command: string
  copyGuardrail: string
}

export type AutopilotSnapshotInput = {
  now?: Date
  remainingToday: number
  sentToday: number
  emailReady: number
  needsReview: number
  followupsDue: number
  replySignals7d: number
  partnerBuyBoxesConfirmed: number
  sellerLeads: number
  activeSuppressionCount: number
  missingSuppressionDb: boolean
  sourceLanes: SourceCostLane[]
  marketHeat: { market: string; heat?: number; leads?: number; replied?: number }[]
  nextRefreshMarkets: string[]
  campaigns: {
    key: string
    label: string
    sent: number
    failed: number
    blocked: number
    replies: number
    lastEventAt: string | null
  }[]
  jobs?: AutopilotJobRow[]
  strategyRuns?: AutopilotRunRow[]
  replyMemory?: AutopilotReplyMemoryRow[]
  suppressionDecisions?: { decision?: string | null; created_at?: string | null }[]
}

export type AutopilotSnapshot = {
  status: CommandStatus
  enabled: boolean
  mode: 'plan_only' | 'dispatch_ready' | 'send_ready' | 'blocked'
  summary: string
  nextMove: string
  lastRunAt: string | null
  nextRunAt: string | null
  durable: {
    jobsConfigured: number
    jobsDue: number
    activeJobs: number
    strategyRuns7d: number
    replyMemories7d: number
    suppressionBlocks7d: number
  }
  batches: StrategyBatchPlan[]
  guardrails: {
    label: string
    value: string | number
    status: CommandStatus
    detail: string
  }[]
}

const DEFAULT_MARKETS = ['Milwaukee, WI', 'Toledo, OH', 'Cleveland, OH', 'Detroit, MI']

const STRATEGY_DEFINITIONS: Array<Omit<StrategyBatchPlan, 'status' | 'markets' | 'targetEmailCount' | 'targetSmsReviewCount' | 'blockedReason' | 'command'>> = [
  {
    strategyKey: 'tax-code-stack',
    strategyName: 'Tax delinquent + code violation',
    sourceProvider: 'dealmachine',
    copyGuardrail:
      'Reference property updates and a simple cash/terms review without shaming the owner, threatening tax consequences, or implying government affiliation.',
  },
  {
    strategyKey: 'senior-out-of-state-landlord',
    strategyName: 'Senior / out-of-state landlord portfolio',
    sourceProvider: 'dealmachine',
    copyGuardrail:
      'Keep copy low-pressure: ask whether simplifying one or more rentals is useful, and offer cash or flexible terms depending on condition.',
  },
  {
    strategyKey: 'on-market-lowball-agent-sweep',
    strategyName: 'On-market agent cash review',
    sourceProvider: 'dealmachine',
    copyGuardrail:
      'Position the low cash range as condition-dependent review room, never as a final take-it-or-leave-it insult.',
  },
  {
    strategyKey: 'stale-listing-creative-finance',
    strategyName: 'Stale listing creative terms',
    sourceProvider: 'homeharvest',
    copyGuardrail:
      'Ask the agent if the seller would consider a clean creative structure only after confirming cash is not the right fit.',
  },
]

export const DEFAULT_AUTOPILOT_JOBS: AutopilotJobDefinition[] = [
  {
    jobKey: 'daily-strategy-plan',
    jobType: 'daily_strategy_plan',
    title: 'Choose daily focus and challenger strategy',
    cadence: 'daily morning',
    priority: 100,
    config: { localHour: 8, output: 'strategy plan + source blockers + send target' },
  },
  {
    jobKey: 'source-rotation',
    jobType: 'source_rotation',
    title: 'Rotate markets and sources before scraping',
    cadence: 'every 6 hours',
    priority: 90,
    config: { avoidRepeatHours: 18, preferOwnedFreeSources: true },
  },
  {
    jobKey: 'seller-outreach-batch',
    jobType: 'seller_outreach_batch',
    title: 'Prepare strategy-specific seller batches',
    cadence: 'hourly while slots remain',
    priority: 85,
    config: { channel: 'email', sms: 'review_only', maxPerStrategy: 100 },
  },
  {
    jobKey: 'reply-memory-sync',
    jobType: 'reply_memory_sync',
    title: 'Attach replies to campaign, property, and next step',
    cadence: 'hourly',
    priority: 95,
    config: { mailbox: 'acquisitions@vestblock.io', fallbackMailbox: 'contact@vestblock.io' },
  },
  {
    jobKey: 'suppression-sync',
    jobType: 'suppression_sync',
    title: 'Apply opt-out, bounce, wrong-owner, and spam suppressions',
    cadence: 'before every send',
    priority: 110,
    config: { blockAcrossStrategies: true, channels: ['email', 'sms'] },
  },
  {
    jobKey: 'followup-router',
    jobType: 'followup_router',
    title: 'Route due seller and partner follow-ups',
    cadence: 'hourly',
    priority: 80,
    config: { staleHours: [24, 48, 72] },
  },
  {
    jobKey: 'deal-routing-sync',
    jobType: 'deal_routing_sync',
    title: 'Turn analyses into buyer, lender, builder, or creative routes',
    cadence: 'after every saved analysis',
    priority: 75,
    config: { rankingEngine: 'disabled_until_more_data' },
  },
]

function daysAgo(now: Date, value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
  return Math.max(0, (now.getTime() - parsed) / 864e5)
}

function statusRank(status: CommandStatus) {
  if (status === 'red') return 3
  if (status === 'yellow') return 2
  return 1
}

function worstStatus(statuses: CommandStatus[]): CommandStatus {
  return statuses.sort((left, right) => statusRank(right) - statusRank(left))[0] || 'green'
}

function normalizeMarketList(markets: string[]) {
  const normalized = markets.map((market) => String(market || '').trim()).filter(Boolean)
  return [...new Set(normalized)].slice(0, 4)
}

function sourceLane(input: AutopilotSnapshotInput, provider: string) {
  return input.sourceLanes.find((lane) => lane.provider === provider)
}

function sourceBlockedReason(input: AutopilotSnapshotInput, provider: string) {
  const lane = sourceLane(input, provider)
  if (!lane) return `${provider} source governor lane is not visible.`
  if (lane.canRun || ['allowed', 'manual_review'].includes(lane.status)) return null
  return lane.reason || `${lane.label || provider} is not available.`
}

function strategyMarkets(input: AutopilotSnapshotInput, strategyKey: string) {
  const heated = normalizeMarketList(input.marketHeat.map((market) => market.market))
  const refresh = normalizeMarketList(input.nextRefreshMarkets)
  if (strategyKey === 'tax-code-stack') {
    return normalizeMarketList([...refresh, 'Cleveland, OH', 'Columbus, OH', 'Indianapolis, IN', 'Louisville, KY'])
  }
  if (strategyKey === 'on-market-lowball-agent-sweep') {
    return normalizeMarketList([...heated, 'Milwaukee, WI', 'Toledo, OH', 'Cincinnati, OH', 'Detroit, MI'])
  }
  return normalizeMarketList([...heated, ...refresh, ...DEFAULT_MARKETS])
}

function strategyCommand(strategyKey: string, markets: string[], target: number) {
  const marketArg = markets.map((market) => market.replace(', ', '-').toLowerCase()).join(',')
  if (strategyKey === 'tax-code-stack') return `pnpm run distress:tax-code-stack:new-markets -- --limit=${target}`
  if (strategyKey === 'senior-out-of-state-landlord') {
    return `pnpm run sellers:outreach:portfolio-landlords -- --markets=${marketArg} --limit=${target}`
  }
  if (strategyKey === 'on-market-lowball-agent-sweep') {
    return `pnpm run sellers:on-market-lowball -- --limit=${target}`
  }
  return `pnpm run boss:stale-listings -- --market="${markets.join('|')}" --limit=${target}`
}

export function buildStrategyBatchPlans(input: AutopilotSnapshotInput): StrategyBatchPlan[] {
  const maxPerStrategy = 100
  const capacity = Math.max(0, Math.min(input.remainingToday, maxPerStrategy * STRATEGY_DEFINITIONS.length))
  const activeStrategyCount = input.replySignals7d > 0 ? 2 : STRATEGY_DEFINITIONS.length
  const baseTarget = activeStrategyCount > 0 ? Math.floor(capacity / activeStrategyCount) : 0
  const readyPressure = input.emailReady + input.needsReview

  return STRATEGY_DEFINITIONS.map((definition, index) => {
    const blockedReason =
      input.missingSuppressionDb
        ? 'Suppression database is not visible; live sends must stay paused.'
        : sourceBlockedReason(input, definition.sourceProvider)
    const markets = strategyMarkets(input, definition.strategyKey)
    const targetEmailCount =
      blockedReason || index >= activeStrategyCount
        ? 0
        : Math.max(0, Math.min(maxPerStrategy, baseTarget + (index === 0 ? capacity % activeStrategyCount : 0)))
    const status: CommandStatus = blockedReason ? 'red' : targetEmailCount > 0 || readyPressure > 0 ? 'green' : 'yellow'

    return {
      ...definition,
      status,
      markets,
      targetEmailCount,
      targetSmsReviewCount: targetEmailCount,
      blockedReason,
      command: strategyCommand(definition.strategyKey, markets, Math.max(targetEmailCount, 100)),
    }
  })
}

export function buildAutopilotSnapshot(input: AutopilotSnapshotInput): AutopilotSnapshot {
  const now = input.now || new Date()
  const jobs = input.jobs || []
  const activeJobs = jobs.filter((job) => !['paused', 'disabled'].includes(String(job.status || 'active').toLowerCase()))
  const jobsDue = activeJobs.filter((job) => !job.next_run_at || Date.parse(job.next_run_at) <= now.getTime()).length
  const lastRunAt =
    jobs
      .map((job) => job.last_run_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] || null
  const nextRunAt =
    jobs
      .map((job) => job.next_run_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(a)) - Date.parse(String(b)))[0] || null

  const strategyRuns7d = (input.strategyRuns || []).filter((run) => daysAgo(now, run.created_at || run.completed_at) <= 7).length
  const replyMemories7d = (input.replyMemory || []).filter((reply) => daysAgo(now, reply.received_at) <= 7).length
  const suppressionBlocks7d = (input.suppressionDecisions || []).filter(
    (decision) => decision.decision === 'blocked' && daysAgo(now, decision.created_at) <= 7
  ).length

  const batches = buildStrategyBatchPlans(input)
  const guardrails = [
    {
      label: 'Suppressions',
      value: input.activeSuppressionCount,
      status: input.missingSuppressionDb ? 'red' : 'green',
      detail: input.missingSuppressionDb
        ? 'Suppression DB is not visible; block live sends.'
        : 'Opt-outs and DNC records are visible before batching.',
    },
    {
      label: 'Reply memory',
      value: replyMemories7d,
      status: replyMemories7d || input.replySignals7d === 0 ? 'green' : 'yellow',
      detail: replyMemories7d
        ? 'Recent replies are being stored as learning objects.'
        : 'No recent reply memory rows are visible yet.',
    },
    {
      label: 'Daily slots',
      value: input.remainingToday,
      status: input.remainingToday > 0 ? 'green' : 'yellow',
      detail: input.remainingToday > 0 ? 'Autopilot can still plan outbound volume.' : 'Daily outbound cap is already full.',
    },
    {
      label: 'SMS lane',
      value: 'review',
      status: 'yellow',
      detail: 'SMS is prepared as review-only until consent and opt-out controls are approved.',
    },
  ] satisfies AutopilotSnapshot['guardrails']

  const blockingStatuses: CommandStatus[] = [
    input.missingSuppressionDb ? 'red' : 'green',
    input.remainingToday > 0 || input.replySignals7d > 0 || input.followupsDue > 0 ? 'green' : 'yellow',
    ...batches.map((batch) => batch.status),
  ]
  const status = worstStatus(blockingStatuses)
  const enabled = activeJobs.length >= DEFAULT_AUTOPILOT_JOBS.length || jobs.length === 0
  const sendReady = input.remainingToday > 0 && batches.some((batch) => batch.targetEmailCount > 0)
  const mode: AutopilotSnapshot['mode'] =
    input.missingSuppressionDb ? 'blocked' : sendReady ? 'send_ready' : jobsDue > 0 || input.followupsDue > 0 ? 'dispatch_ready' : 'plan_only'

  const summary =
    jobs.length === 0
      ? 'Autopilot jobs are ready to seed. The planner can choose strategy lanes, markets, suppression gates, and reply memory objects.'
      : `${activeJobs.length} active job${activeJobs.length === 1 ? '' : 's'} · ${strategyRuns7d} strategy run${strategyRuns7d === 1 ? '' : 's'} in 7d · ${replyMemories7d} reply memor${replyMemories7d === 1 ? 'y' : 'ies'} in 7d.`
  const firstBlocked = batches.find((batch) => batch.blockedReason)
  const topBatch = batches.find((batch) => batch.targetEmailCount > 0) || batches[0]
  const nextMove =
    input.replySignals7d > 0
      ? 'Work replies and write memory before adding volume; each reply should update strategy, market, property, and next action.'
      : firstBlocked
        ? `${firstBlocked.strategyName}: ${firstBlocked.blockedReason}`
        : topBatch
          ? `Run ${topBatch.strategyName} in ${topBatch.markets.slice(0, 2).join(' and ')} with ${topBatch.targetEmailCount || 100} separated emails and SMS review tasks.`
          : 'Seed the durable jobs, then run a dry autopilot pass.'

  return {
    status,
    enabled,
    mode,
    summary,
    nextMove,
    lastRunAt,
    nextRunAt,
    durable: {
      jobsConfigured: jobs.length,
      jobsDue,
      activeJobs: activeJobs.length,
      strategyRuns7d,
      replyMemories7d,
      suppressionBlocks7d,
    },
    batches,
    guardrails,
  }
}
