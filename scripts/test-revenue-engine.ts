import assert from 'node:assert/strict'

import { buildAutomationRegistrySnapshot } from '../lib/revenue-engine/automationRegistry'
import { buildRevenueExecutiveSnapshot } from '../lib/revenue-engine/executiveSnapshot'
import { canTransition, isOpportunityStale, transitionOpportunity } from '../lib/revenue-engine/pipeline'
import { scoreRevenueOpportunity } from '../lib/revenue-engine/scoring'
import type { RevenueOpportunity } from '../lib/revenue-engine/types'

const score = scoreRevenueOpportunity({
  lane: 'deals',
  fit: 95,
  urgency: 90,
  economics: 100,
  readiness: 95,
  engagement: 80,
  dataQuality: 95,
  riskPenalty: 2,
})
assert.equal(score.version, 'revenue-engine-v1')
assert.equal(score.band, 'priority')
assert.ok(score.score >= 80)
assert.equal(score.confidence, 95)
assert.ok(score.reasons.some((reason) => reason.includes('risk penalty')))

assert.equal(canTransition('deals', 'qualified', 'analysis'), true)
assert.equal(canTransition('deals', 'qualified', 'contract'), false)
assert.equal(canTransition('capital', 'funded', 'nurture'), false)

const opportunity: RevenueOpportunity = {
  id: 'opp-1', lane: 'deals', stage: 'qualified', title: '123 Main', contactIds: [], assetIds: [], matchIds: [], source: 'test', owner: null, value: 100000, score: 81, confidence: 84, nextAction: 'Analyze', nextActionAt: null, lastActivityAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
}
const transitioned = transitionOpportunity(opportunity, 'analysis', { now: '2026-08-10T00:00:00.000Z', nextAction: 'Build packet' })
assert.equal(transitioned.stage, 'analysis')
assert.equal(transitioned.nextAction, 'Build packet')
assert.equal(isOpportunityStale(transitioned, new Date('2026-08-14T00:00:00.000Z')), true)
assert.throws(() => transitionOpportunity(opportunity, 'contract'))

const registry = buildAutomationRegistrySnapshot()
assert.equal(registry.inventoryTotal, 363)
assert.equal(registry.classifications.remove, 0)
assert.ok(registry.entries.some((entry) => entry.id === 'webhook-paypal-legacy' && entry.riskClass === 'red'))
assert.ok(registry.entries.some((entry) => entry.status === 'blocked'))

const executive = buildRevenueExecutiveSnapshot({
  generatedAt: '2026-08-10T00:00:00.000Z', liveDataReachable: true, dataSourceIssues: [], priorities: ['Work replies'], alerts: [], overdueTasks: [],
  summary: { revenue30d: 25000, revenueTarget: 100000, outreach24h: 50, outreachTarget: 100, newLeads24h: 12, replySignals7d: 4, urgentTasks: 0, activePartners: 20, partnerOutreachReady: 5, partnerBuyBoxesConfirmed: 3 },
  routingQueue: [{ label: 'Buyer matches open', count: 2 }, { label: 'Lender matches open', count: 1 }, { label: 'Lead follow-ups due', count: 3 }, { label: 'Partner follow-ups due', count: 0 }],
  dealPipeline: { status: 'green', totals: { activeDeals: 6, packetReady: 2, packetSent: 1, buyerReplies: 1 }, nextMove: 'Work ready packets.' },
  autopilot: { status: 'green', enabled: true, summary: 'Active', nextMove: 'Work replies.', durable: { activeJobs: 6, jobsDue: 1, strategyRuns7d: 20 } },
})
assert.equal(executive.money.targetProgress, 25)
assert.equal(executive.lanes.length, 3)
assert.equal(executive.lanes.find((lane) => lane.lane === 'deals')?.attention, 5)
assert.ok(executive.dailyBrief.every((line) => !line.includes('undefined')))

const urgentExecutive = buildRevenueExecutiveSnapshot({
  generatedAt: '2026-08-10T00:00:00.000Z', liveDataReachable: true, dataSourceIssues: [], priorities: [], alerts: [{ severity: 'critical', message: 'Provider failure' }], overdueTasks: [{ title: 'Work queue', priority: 'urgent' }],
  summary: { revenue30d: 0, revenueTarget: 100000, outreach24h: 0, outreachTarget: 100, newLeads24h: 0, replySignals7d: 0, urgentTasks: 3, activePartners: 0, partnerOutreachReady: 0, partnerBuyBoxesConfirmed: 0 },
  routingQueue: [], dealPipeline: { status: 'yellow', totals: { activeDeals: 0, packetReady: 0, packetSent: 0, buyerReplies: 0 }, nextMove: 'Review.' },
  autopilot: { status: 'yellow', enabled: false, summary: 'Paused', nextMove: 'Review.', durable: { activeJobs: 0, jobsDue: 0, strategyRuns7d: 0 } },
})
assert.equal(urgentExecutive.today.urgentCount, 4)
assert.equal(urgentExecutive.today.attentionCount, 5)
assert.ok(urgentExecutive.headline.includes('urgent work items'))

console.log('revenue-engine: ok')
