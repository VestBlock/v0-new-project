import type { RevenueLane, RevenueOpportunity, RevenuePipelineStage } from './types'

export type RevenuePipelineDefinition = {
  lane: RevenueLane
  label: string
  stages: RevenuePipelineStage[]
  terminalStages: RevenuePipelineStage[]
  staleAfterDays: Partial<Record<RevenuePipelineStage, number>>
}

export const REVENUE_PIPELINES: Record<RevenueLane, RevenuePipelineDefinition> = {
  deals: {
    lane: 'deals',
    label: 'Deals',
    stages: ['discovered', 'intake', 'qualified', 'analysis', 'matched', 'outreach', 'engaged', 'proposal', 'contract', 'closed', 'nurture', 'lost'],
    terminalStages: ['closed', 'lost'],
    staleAfterDays: { discovered: 1, intake: 2, qualified: 2, analysis: 3, matched: 3, outreach: 3, engaged: 2, proposal: 3, contract: 5 },
  },
  capital: {
    lane: 'capital',
    label: 'Capital',
    stages: ['intake', 'documents', 'ready', 'matched', 'outreach', 'engaged', 'underwriting', 'term_sheet', 'committed', 'funded', 'nurture', 'lost'],
    terminalStages: ['funded', 'lost'],
    staleAfterDays: { intake: 2, documents: 4, ready: 2, matched: 2, outreach: 3, engaged: 2, underwriting: 5, term_sheet: 3, committed: 5 },
  },
  partners: {
    lane: 'partners',
    label: 'Partners',
    stages: ['discovered', 'research', 'qualified', 'outreach', 'engaged', 'activated', 'producing', 'nurture', 'closed', 'lost'],
    terminalStages: ['closed', 'lost'],
    staleAfterDays: { discovered: 3, research: 4, qualified: 3, outreach: 5, engaged: 4, activated: 14, producing: 30 },
  },
}

export function getPipeline(lane: RevenueLane) {
  return REVENUE_PIPELINES[lane]
}

export function canTransition(lane: RevenueLane, from: RevenuePipelineStage, to: RevenuePipelineStage) {
  if (from === to) return true
  const pipeline = getPipeline(lane)
  if (!pipeline.stages.includes(from) || !pipeline.stages.includes(to)) return false
  if (pipeline.terminalStages.includes(from)) return false
  if (to === 'nurture' || to === 'lost') return true
  const fromIndex = pipeline.stages.indexOf(from)
  const toIndex = pipeline.stages.indexOf(to)
  return toIndex === fromIndex + 1
}

export function transitionOpportunity(
  opportunity: RevenueOpportunity,
  to: RevenuePipelineStage,
  input: { now?: string; nextAction?: string | null; nextActionAt?: string | null; lossReason?: string | null } = {}
): RevenueOpportunity {
  if (!canTransition(opportunity.lane, opportunity.stage, to)) {
    throw new Error(`Invalid ${opportunity.lane} pipeline transition: ${opportunity.stage} -> ${to}`)
  }

  const now = input.now || new Date().toISOString()
  const terminal = getPipeline(opportunity.lane).terminalStages.includes(to)

  return {
    ...opportunity,
    stage: to,
    nextAction: terminal ? null : input.nextAction ?? opportunity.nextAction,
    nextActionAt: terminal ? null : input.nextActionAt ?? opportunity.nextActionAt,
    lossReason: to === 'lost' ? input.lossReason || opportunity.lossReason || 'unspecified' : null,
    closedAt: terminal ? now : null,
    updatedAt: now,
  }
}

export function isOpportunityStale(opportunity: RevenueOpportunity, now = new Date()) {
  const threshold = getPipeline(opportunity.lane).staleAfterDays[opportunity.stage]
  if (!threshold) return false
  const reference = opportunity.lastActivityAt || opportunity.updatedAt
  const timestamp = Date.parse(reference)
  if (!Number.isFinite(timestamp)) return true
  return now.getTime() - timestamp > threshold * 86_400_000
}

export function summarizePipeline(opportunities: RevenueOpportunity[]) {
  return (Object.keys(REVENUE_PIPELINES) as RevenueLane[]).map((lane) => {
    const laneItems = opportunities.filter((item) => item.lane === lane)
    return {
      lane,
      active: laneItems.filter((item) => !getPipeline(lane).terminalStages.includes(item.stage)).length,
      stale: laneItems.filter((item) => isOpportunityStale(item)).length,
      value: laneItems.reduce((sum, item) => sum + (item.value || 0), 0),
      stages: Object.fromEntries(getPipeline(lane).stages.map((stage) => [stage, laneItems.filter((item) => item.stage === stage).length])),
    }
  })
}
