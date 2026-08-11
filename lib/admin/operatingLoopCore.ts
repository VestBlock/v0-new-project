export type CommandStatus = 'green' | 'yellow' | 'red'

export type StrategyCampaignRollup = {
  key: string
  label: string
  status: CommandStatus
  sent: number
  failed: number
  drafted: number
  blocked: number
  replies: number
  optOuts: number
  lastEventAt: string | null
  markets: { market: string; count: number }[]
  latestArtifact: string | null
  nextMove: string
  learningSignal: string
}

export type OperatingLoopKey =
  | 'reply_to_revenue'
  | 'offer_follow_up'
  | 'lead_source_quality'
  | 'market_rotation'
  | 'offer_accuracy'
  | 'suppression_compliance'
  | 'buyer_demand'
  | 'agent_performance'
  | 'dead_code_dirty_system'
  | 'daily_war_room'

export type OperatingLoopCard = {
  key: OperatingLoopKey
  title: string
  status: CommandStatus
  cadence: string
  lastRunAt: string | null
  summary: string
  nextAction: string
}

export type OperatingLoopBuilderInput = {
  sentToday: number
  sent7d?: number
  remainingToday: number
  replySignals7d: number
  emailReady: number
  needsReview: number
  campaigns: StrategyCampaignRollup[]
  blockedSources: string[]
  ledgerEventCount: number
  lastEventAt: string | null
  focusStrategyKey?: string | null
  challengerStrategyKey?: string | null
  followupsDue?: number
  partnerFollowupsDue?: number
  activeSuppressionCount?: number
  missingSuppressionDb?: boolean
  bounceRiskLeads?: number
  buyerDemandSignals?: number
  pendingMatches?: number
  partnerBuyBoxesConfirmed?: number
  partnerResearchReady?: number
  partnerOutreachReady?: number
  partnerDiscoveryRuns7d?: number
  failedPartnerRuns7d?: number
  failedScrapes24h?: number
  sourceFreshCount?: number
  sourceStaleCount?: number
  staleExportCount?: number
  staleExportTotal?: number
  activeDirectiveCount?: number
  overdueTaskCount?: number
  urgentTaskCount?: number
  openTaskCount?: number
  legacyDraftCount?: number
  archivedLegacyRuntimeRows?: number
  openResearchChecklistCount?: number
  analyzerOutcomeCount?: number
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`
}

function sumCampaignMarkets(campaigns: StrategyCampaignRollup[]) {
  const markets = new Map<string, number>()
  for (const campaign of campaigns) {
    for (const row of campaign.markets) {
      markets.set(row.market, (markets.get(row.market) || 0) + row.count)
    }
  }
  return [...markets.entries()]
    .map(([market, count]) => ({ market, count }))
    .sort((a, b) => b.count - a.count || a.market.localeCompare(b.market))
}

function recentSentCampaigns(campaigns: StrategyCampaignRollup[]) {
  return campaigns.filter((campaign) => campaign.sent > 0)
}

export function buildOperatingLoopCards(input: OperatingLoopBuilderInput): OperatingLoopCard[] {
  const sent7d = input.sent7d ?? input.sentToday
  const totalFollowupsDue = (input.followupsDue || 0) + (input.partnerFollowupsDue || 0)
  const failedRuns = (input.failedPartnerRuns7d || 0) + (input.failedScrapes24h || 0)
  const staleSources = input.sourceStaleCount ?? input.staleExportCount ?? 0
  const sourceFreshCount = input.sourceFreshCount || 0
  const sourceBlockerCount = input.blockedSources.length
  const allMarkets = sumCampaignMarkets(input.campaigns)
  const topMarket = allMarkets[0]?.market || null
  const activeCampaigns = recentSentCampaigns(input.campaigns).length
  const suppressionRisk = (input.missingSuppressionDb ? 1 : 0) + (input.bounceRiskLeads || 0)
  const buyerDemand =
    (input.buyerDemandSignals || 0) +
    (input.partnerBuyBoxesConfirmed || 0) +
    (input.partnerOutreachReady || 0) +
    (input.pendingMatches || 0)
  const agentPressure = (input.overdueTaskCount || 0) + (input.urgentTaskCount || 0)
  const dirtySystemItems =
    (input.legacyDraftCount || 0) + (input.archivedLegacyRuntimeRows || 0) + (input.openResearchChecklistCount || 0)
  const dailyReady = input.replySignals7d > 0 || input.emailReady > 0 || totalFollowupsDue > 0

  return [
    {
      key: 'reply_to_revenue',
      title: 'Reply-To-Revenue Loop',
      status: input.replySignals7d > 0 ? 'green' : sent7d > 0 ? 'yellow' : 'red',
      cadence: 'hourly inbox plus daily attribution',
      lastRunAt: input.lastEventAt,
      summary: `${plural(input.replySignals7d, 'reply', 'replies')} in 7d against ${plural(sent7d, 'send')} and ${plural(input.ledgerEventCount, 'ledger event')}.`,
      nextAction:
        input.replySignals7d > 0
          ? 'Tie each hot reply to campaign, market, property, offer type, and next revenue step before adding fresh volume.'
          : sent7d > 0
            ? 'Audit outbound copy/source quality because sends are not producing visible replies yet.'
            : 'Send from one controlled strategy lane, then attribute every reply back to that lane.',
    },
    {
      key: 'offer_follow_up',
      title: 'Offer Follow-Up Loop',
      status: totalFollowupsDue > 10 ? 'red' : totalFollowupsDue > 0 ? 'yellow' : 'green',
      cadence: 'every seller or partner reply',
      lastRunAt: null,
      summary: `${plural(input.followupsDue || 0, 'seller follow-up')} and ${plural(input.partnerFollowupsDue || 0, 'partner follow-up')} due.`,
      nextAction:
        totalFollowupsDue > 0
          ? 'Clear due follow-ups before new prospecting: photos, access, condition, seller number, buyer fit, or suppress.'
          : 'Keep every reply on a 24/48/72-hour next-step rail so no hot thread goes cold.',
    },
    {
      key: 'lead_source_quality',
      title: 'Lead Source Quality Loop',
      status: sourceBlockerCount >= 2 || failedRuns > 0 ? 'red' : sourceBlockerCount || staleSources ? 'yellow' : 'green',
      cadence: 'before every outbound batch',
      lastRunAt: input.lastEventAt,
      summary: `${plural(activeCampaigns, 'active campaign')} · ${plural(sourceFreshCount, 'fresh source')} · ${plural(sourceBlockerCount, 'source blocker')} · ${plural(staleSources, 'stale source')} · ${plural(failedRuns, 'failed run')}.`,
      nextAction:
        input.blockedSources[0] ||
        (staleSources > 0
          ? 'Refresh stale DealMachine/listing exports and remove duplicate daily scraping before the next send.'
          : 'Score each source by contactability, reply quality, motivation, and deal quality after every campaign.'),
    },
    {
      key: 'market_rotation',
      title: 'Market Rotation Loop',
      status: allMarkets.length >= 4 ? 'green' : allMarkets.length > 0 ? 'yellow' : 'red',
      cadence: 'daily market selection',
      lastRunAt: input.lastEventAt,
      summary: allMarkets.length
        ? `${plural(allMarkets.length, 'market')} in the campaign ledger; top lane is ${topMarket}.`
        : 'No campaign market mix is visible yet.',
      nextAction:
        allMarkets.length >= 4
          ? 'Let Boss promote the hottest reply/source markets and rotate weaker markets out of the daily send plan.'
          : 'Run fresh lists in at least four markets so the Boss can compare performance instead of guessing.',
    },
    {
      key: 'offer_accuracy',
      title: 'Offer Accuracy Loop',
      status: (input.analyzerOutcomeCount || 0) > 0 ? 'green' : input.replySignals7d > 0 ? 'yellow' : 'red',
      cadence: 'after every analysis and counter',
      lastRunAt: null,
      summary:
        (input.analyzerOutcomeCount || 0) > 0
          ? `${plural(input.analyzerOutcomeCount || 0, 'offer outcome')} captured for MAO/creative feedback.`
          : 'Analyzer runs are visible, but accepted/rejected/countered offer outcomes are not yet feeding the score.',
      nextAction:
        'Store ARV, MAO, cash offer, creative offer, seller ask, counter, buyer match, and final outcome on every analyzed deal.',
    },
    {
      key: 'suppression_compliance',
      title: 'Suppression And Compliance Loop',
      status: input.missingSuppressionDb || (input.bounceRiskLeads || 0) > 25 ? 'red' : suppressionRisk > 0 ? 'yellow' : 'green',
      cadence: 'before send and after every reply',
      lastRunAt: null,
      summary: `${plural(input.activeSuppressionCount || 0, 'active suppression')} · ${plural(input.bounceRiskLeads || 0, 'bounce-risk lead')} · DB ${input.missingSuppressionDb ? 'unavailable' : 'ready'}.`,
      nextAction:
        input.missingSuppressionDb
          ? 'Restore suppression DB visibility before scaling sends.'
          : 'Apply unsubscribe/wrong-owner/bounce suppressions immediately, then block those contacts from every strategy lane.',
    },
    {
      key: 'buyer_demand',
      title: 'Buyer Demand Loop',
      status: (input.partnerBuyBoxesConfirmed || 0) > 0 || (input.pendingMatches || 0) > 0 ? 'green' : buyerDemand > 0 ? 'yellow' : 'red',
      cadence: 'daily before sourcing',
      lastRunAt: null,
      summary: `${plural(input.partnerBuyBoxesConfirmed || 0, 'confirmed buy box')} · ${plural(input.pendingMatches || 0, 'open match')} · ${plural(input.partnerOutreachReady || 0, 'partner ready')}.`,
      nextAction:
        (input.partnerBuyBoxesConfirmed || 0) > 0
          ? 'Source seller leads that match confirmed builder/buyer buy boxes before generic distress lists.'
          : 'Convert researched builders, buyers, and lenders into confirmed buy boxes so sourcing has a target.',
    },
    {
      key: 'agent_performance',
      title: 'Agent Performance Loop',
      status: agentPressure > 8 ? 'red' : (input.activeDirectiveCount || 0) > 0 || agentPressure > 0 ? 'yellow' : 'green',
      cadence: 'after every Boss directive',
      lastRunAt: null,
      summary: `${plural(input.activeDirectiveCount || 0, 'active directive')} · ${plural(input.overdueTaskCount || 0, 'overdue task')} · ${plural(input.urgentTaskCount || 0, 'urgent task')}.`,
      nextAction:
        agentPressure > 0
          ? 'Finish or dismiss stale directives before starting new agent work, then write the retrospective result.'
          : 'Keep one active focus play and one challenger play; promote only the agent actions that create replies or revenue.',
    },
    {
      key: 'dead_code_dirty_system',
      title: 'Dead Code / Dirty System Loop',
      status: dirtySystemItems > 25 ? 'red' : dirtySystemItems > 0 || staleSources > 0 ? 'yellow' : 'green',
      cadence: 'weekly cleanup plus pre-deploy gate',
      lastRunAt: null,
      summary: `${plural(input.legacyDraftCount || 0, 'legacy draft')} · ${plural(input.archivedLegacyRuntimeRows || 0, 'legacy runtime row')} · ${plural(input.openResearchChecklistCount || 0, 'open checklist')}.`,
      nextAction:
        dirtySystemItems > 0
          ? 'Delete, finish, or archive old code paths and unfinished queues before adding another command-center feature.'
          : 'Keep the command center lean by blocking duplicate agents, dead integrations, and abandoned panels.',
    },
    {
      key: 'daily_war_room',
      title: 'Daily War Room Loop',
      status: agentPressure > 8 || sourceBlockerCount >= 2 ? 'red' : dailyReady ? 'green' : 'yellow',
      cadence: 'every morning',
      lastRunAt: input.lastEventAt,
      summary: `${plural(input.sentToday, 'send')} today · ${plural(input.remainingToday, 'slot')} left · ${plural(input.emailReady, 'ready email')} · ${plural(input.needsReview, 'needs-review draft')}.`,
      nextAction:
        input.replySignals7d > 0
          ? 'Open with hot replies, then decide whether today is follow-up, analysis, or new outbound.'
          : 'Generate the morning command brief: best strategy, worst strategy, source blocker, follow-up queue, and send plan.',
    },
  ]
}
