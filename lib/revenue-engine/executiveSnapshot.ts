import { buildAutomationRegistrySnapshot } from './automationRegistry'
import type { RevenueExecutiveSnapshot, RevenueLaneSnapshot } from './types'

type SnapshotInput = {
  generatedAt: string
  liveDataReachable: boolean
  dataSourceIssues: { source: string; message: string }[]
  priorities: string[]
  alerts: { severity: string; message: string }[]
  overdueTasks: { title: string; priority: string }[]
  summary: {
    revenue30d: number
    revenueTarget: number
    outreach24h: number
    outreachTarget: number
    newLeads24h: number
    replySignals7d: number
    urgentTasks: number
    activePartners: number
    partnerOutreachReady: number
    partnerBuyBoxesConfirmed: number
  }
  routingQueue: { label: string; count: number }[]
  dealPipeline: {
    status: 'green' | 'yellow' | 'red'
    totals: { activeDeals: number; packetReady: number; packetSent: number; buyerReplies: number }
    nextMove: string
  }
  autopilot: {
    status: 'green' | 'yellow' | 'red'
    enabled: boolean
    summary: string
    nextMove: string
    durable: { activeJobs: number; jobsDue: number; strategyRuns7d: number }
  }
}

function queueCount(input: SnapshotInput, label: string) {
  return input.routingQueue.find((item) => item.label === label)?.count || 0
}

function statusFromAttention(attention: number, red = false): RevenueLaneSnapshot['status'] {
  if (red) return 'red'
  return attention > 0 ? 'yellow' : 'green'
}

export function buildRevenueExecutiveSnapshot(input: SnapshotInput): RevenueExecutiveSnapshot {
  const buyerMatches = queueCount(input, 'Buyer matches open')
  const lenderMatches = queueCount(input, 'Lender matches open')
  const leadFollowups = queueCount(input, 'Lead follow-ups due')
  const partnerFollowups = queueCount(input, 'Partner follow-ups due')
  const alertCount = input.alerts.filter((alert) => alert.severity !== 'info').length
  const urgentCount = input.alerts.filter((alert) => alert.severity === 'critical').length + input.summary.urgentTasks
  const attentionCount = alertCount + input.overdueTasks.length + input.summary.urgentTasks
  const automation = buildAutomationRegistrySnapshot()
  const targetProgress = input.summary.revenueTarget > 0
    ? Math.max(0, Math.min(100, Math.round((input.summary.revenue30d / input.summary.revenueTarget) * 100)))
    : 0

  const lanes: RevenueLaneSnapshot[] = [
    {
      lane: 'deals',
      label: 'Deals',
      status: statusFromAttention(leadFollowups + buyerMatches, input.dealPipeline.status === 'red'),
      active: input.dealPipeline.totals.activeDeals,
      attention: leadFollowups + buyerMatches,
      leadingMetric: 'Packets ready',
      leadingValue: input.dealPipeline.totals.packetReady,
      nextMove: input.dealPipeline.nextMove,
    },
    {
      lane: 'capital',
      label: 'Capital',
      status: statusFromAttention(lenderMatches),
      active: lenderMatches,
      attention: lenderMatches,
      leadingMetric: 'Lender matches',
      leadingValue: lenderMatches,
      nextMove: lenderMatches > 0 ? `Work ${lenderMatches} open lender match${lenderMatches === 1 ? '' : 'es'} and complete missing package evidence.` : 'Keep lender criteria current and prepare the next complete capital package.',
    },
    {
      lane: 'partners',
      label: 'Partners',
      status: statusFromAttention(partnerFollowups),
      active: input.summary.activePartners,
      attention: partnerFollowups,
      leadingMetric: 'Outreach ready',
      leadingValue: input.summary.partnerOutreachReady,
      nextMove: partnerFollowups > 0 ? `Work ${partnerFollowups} partner follow-up${partnerFollowups === 1 ? '' : 's'} before adding volume.` : 'Confirm partner criteria and connect it to live Deal and Capital opportunities.',
    },
  ]

  const topPriorities = [...input.priorities, ...input.overdueTasks.map((task) => task.title)].filter(Boolean).slice(0, 5)
  const risks = [
    ...input.alerts.filter((alert) => alert.severity !== 'info').map((alert) => alert.message),
    ...input.dataSourceIssues.map((issue) => `${issue.source} unavailable`),
  ].slice(0, 5)

  return {
    generatedAt: input.generatedAt,
    headline: urgentCount > 0
      ? `${urgentCount} urgent work item${urgentCount === 1 ? '' : 's'} need owner attention.`
      : alertCount > 0
        ? `${alertCount} operating risk${alertCount === 1 ? '' : 's'} need attention before adding volume.`
        : 'The Revenue Engine is ready for the next highest-value move.',
    today: { attentionCount, urgentCount, topPriorities },
    money: {
      revenue30d: input.summary.revenue30d,
      target30d: input.summary.revenueTarget,
      targetProgress,
      activeDeals: input.dealPipeline.totals.activeDeals,
      packetReady: input.dealPipeline.totals.packetReady,
    },
    lanes,
    automation,
    dailyBrief: [
      `${input.summary.newLeads24h} new leads and ${input.summary.replySignals7d} reply signals are visible in the current operating windows.`,
      `${input.summary.outreach24h} of ${input.summary.outreachTarget} daily outreach actions are recorded; work replies and suppressions before adding volume.`,
      `${input.dealPipeline.totals.activeDeals} active deals, ${input.dealPipeline.totals.packetReady} packets ready, and ${lenderMatches} lender matches are in the shared revenue view.`,
      `${automation.blocked + automation.attention} registered schedulers need repair or verification; no automation was removed.`,
    ],
    weeklyReview: {
      wins: [
        `${input.autopilot.durable.strategyRuns7d} strategy runs recorded in 7 days.`,
        `${input.dealPipeline.totals.packetSent} buyer packets sent and ${input.dealPipeline.totals.buyerReplies} buyer replies visible.`,
        `${input.summary.partnerBuyBoxesConfirmed} partner buy boxes confirmed.`,
      ],
      risks: risks.length ? risks : ['No critical alert is present in the current snapshot.'],
      decisions: [
        input.autopilot.nextMove,
        'Consolidate one no-send automation family before changing any live outreach path.',
        'Keep payment, deployment, bulk-send, and destructive actions human-approved.',
      ],
    },
  }
}
