import type { CommandStatus } from '@/lib/admin/commandCenter'

export type OperatingArchitecturePillarKey =
  | 'event_bus'
  | 'routing_engine'
  | 'memory_graph'
  | 'signal_ranking'
  | 'deal_digital_twin'
  | 'agent_debate'

export type OperatingArchitecturePillar = {
  key: OperatingArchitecturePillarKey
  title: string
  status: CommandStatus
  metric: string
  summary: string
  nextAction: string
}

export type CommandCenterOperatingArchitecture = {
  status: CommandStatus
  summary: string
  pillars: OperatingArchitecturePillar[]
  nextBuildSteps: string[]
}

export type OperatingArchitectureInput = {
  ledgerEventCount: number
  operatingLoopCount: number
  replySignals7d: number
  sent7d: number
  sellerLeads: number
  propertyLeadCount: number
  pendingBuyerMatches: number
  pendingLenderMatches: number
  followupsDue: number
  partnerFollowupsDue: number
  partnerBuyBoxesConfirmed: number
  partnerResearchReady: number
  partnerOutreachReady: number
  activeSuppressionCount: number
  freshSourceCount: number
  staleSourceCount: number
  openTaskCount: number
  overdueTaskCount: number
  analyzerOutcomeCount: number
}

function statusFromPressure(pressure: number, warningThreshold: number, redThreshold: number): CommandStatus {
  if (pressure >= redThreshold) return 'red'
  if (pressure >= warningThreshold) return 'yellow'
  return 'green'
}

function overallStatus(pillars: OperatingArchitecturePillar[]): CommandStatus {
  const redCount = pillars.filter((pillar) => pillar.status === 'red').length
  const yellowCount = pillars.filter((pillar) => pillar.status === 'yellow').length
  if (redCount >= 2) return 'red'
  if (redCount || yellowCount >= 3) return 'yellow'
  return 'green'
}

export function buildOperatingArchitecture(input: OperatingArchitectureInput): CommandCenterOperatingArchitecture {
  const routePressure =
    input.pendingBuyerMatches + input.pendingLenderMatches + input.followupsDue + input.partnerFollowupsDue
  const memorySignals =
    input.replySignals7d + input.partnerBuyBoxesConfirmed + input.partnerResearchReady + input.activeSuppressionCount
  const sourceSignals = input.freshSourceCount + input.partnerOutreachReady + input.partnerBuyBoxesConfirmed
  const debateReady =
    input.analyzerOutcomeCount > 0 &&
    input.partnerBuyBoxesConfirmed > 0 &&
    input.pendingBuyerMatches + input.pendingLenderMatches > 0

  const pillars: OperatingArchitecturePillar[] = [
    {
      key: 'event_bus',
      title: 'Event Bus',
      status: input.ledgerEventCount > 0 && input.operatingLoopCount >= 10 ? 'green' : input.ledgerEventCount > 0 ? 'yellow' : 'red',
      metric: `${input.ledgerEventCount} events`,
      summary: 'Normalizes outreach, source, reply, and command-loop activity into one operating ledger.',
      nextAction:
        input.ledgerEventCount > 0
          ? 'Keep every new send, reply, analysis, buyer match, and source run writing into the same event stream.'
          : 'Start by writing command-center actions into the event ledger before adding more autonomous agents.',
    },
    {
      key: 'routing_engine',
      title: 'Routing Engine',
      status: input.partnerBuyBoxesConfirmed > 0 ? statusFromPressure(routePressure, 12, 30) : 'yellow',
      metric: `${routePressure} routes`,
      summary: 'Turns leads and analyzed properties into seller follow-up, buyer match, lender match, or partner action.',
      nextAction:
        routePressure > 0
          ? 'Clear route pressure by assigning each live item to seller, buyer, lender, builder, suppress, or archive.'
          : 'Keep route pressure low while adding explicit strategy tags to every new lead.',
    },
    {
      key: 'memory_graph',
      title: 'Memory Graph',
      status: memorySignals > 25 && input.partnerBuyBoxesConfirmed > 0 ? 'green' : memorySignals > 0 ? 'yellow' : 'red',
      metric: `${memorySignals} memories`,
      summary: 'Stores what VestBlock has learned about sellers, markets, suppressions, buyers, builders, and outreach outcomes.',
      nextAction:
        input.partnerBuyBoxesConfirmed > 0
          ? 'Connect buy-box memory to routing so sourcing starts from real buyer demand instead of generic distress.'
          : 'Capture confirmed buy boxes and seller reply lessons as permanent memory before scaling new markets.',
    },
    {
      key: 'signal_ranking',
      title: 'Signal Ranking',
      status: sourceSignals > 0 && input.staleSourceCount === 0 ? 'green' : sourceSignals > 0 ? 'yellow' : 'red',
      metric: `${sourceSignals} signals`,
      summary: 'Ranks markets, list stacks, source freshness, and buyer demand before the next outbound batch.',
      nextAction:
        input.staleSourceCount > 0
          ? 'Refresh stale source files before trusting the next campaign ranking.'
          : 'Score every strategy by reply quality, contactability, market heat, and buyer-demand fit.',
    },
    {
      key: 'deal_digital_twin',
      title: 'Deal Digital Twin',
      status: input.analyzerOutcomeCount > 0 ? 'green' : input.propertyLeadCount > 0 ? 'yellow' : 'red',
      metric: `${input.analyzerOutcomeCount} outcomes`,
      summary: 'Makes each property a living object with ARV, MAO, creative path, seller ask, buyers, lenders, and next action.',
      nextAction:
        input.analyzerOutcomeCount > 0
          ? 'Tie accepted, rejected, and countered offers back to the analyzer so MAO quality improves.'
          : 'Start saving analyzer outcomes on every property before sending serious offers at scale.',
    },
    {
      key: 'agent_debate',
      title: 'Multi-Agent Debate',
      status: debateReady ? 'green' : input.analyzerOutcomeCount > 0 || input.partnerBuyBoxesConfirmed > 0 ? 'yellow' : 'red',
      metric: debateReady ? 'ready' : 'partial',
      summary: 'Lets conservative underwriting, aggressive acquisition, buyer-fit, capital, and risk lanes argue before the Boss decides.',
      nextAction:
        debateReady
          ? 'Use debate on high-value replies and on-market lowball offers before live seller negotiation.'
          : 'Feed debate with analyzer outcomes plus confirmed buyer/builder demand so recommendations are grounded.',
    },
  ]

  const status = overallStatus(pillars)
  const weakPillars = pillars.filter((pillar) => pillar.status !== 'green').slice(0, 3)
  const nextBuildSteps = weakPillars.length
    ? weakPillars.map((pillar) => pillar.nextAction)
    : [
        'Promote the strongest source-market-offer combo into the next controlled outreach sprint.',
        'Start using the debate lane for the hottest seller replies before any offer leaves the system.',
        'Keep the daily war-room loop focused on one focus play and one challenger play.',
      ]

  return {
    status,
    summary:
      status === 'green'
        ? 'The command center has the core operating-system pieces online: events, routing, memory, ranking, deal objects, and debate.'
        : status === 'yellow'
          ? 'The command center has the right foundation, but a few pieces need stronger data before full autonomous scaling.'
          : 'The command center should stay in controlled mode until event, memory, and deal-outcome data are stronger.',
    pillars,
    nextBuildSteps,
  }
}
