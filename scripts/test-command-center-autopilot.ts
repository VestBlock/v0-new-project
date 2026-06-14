import assert from 'node:assert/strict'

import {
  DEFAULT_AUTOPILOT_JOBS,
  buildAutopilotSnapshot,
  buildStrategyBatchPlans,
  type AutopilotSnapshotInput,
} from '../lib/admin/autonomousOperatingCore'

const baseInput: AutopilotSnapshotInput = {
  now: new Date('2026-06-14T14:00:00.000Z'),
  remainingToday: 360,
  sentToday: 140,
  emailReady: 120,
  needsReview: 80,
  followupsDue: 4,
  replySignals7d: 0,
  partnerBuyBoxesConfirmed: 3,
  sellerLeads: 700,
  activeSuppressionCount: 24,
  missingSuppressionDb: false,
  sourceLanes: [
    {
      provider: 'dealmachine',
      label: 'DealMachine exports',
      status: 'allowed',
      canRun: true,
      costTier: 'owned',
      reason: 'Source is within budget and cooldown policy.',
    },
    {
      provider: 'homeharvest',
      label: 'Public on-market sweep',
      status: 'allowed',
      canRun: true,
      costTier: 'free',
      reason: 'Source is within budget and cooldown policy.',
    },
    {
      provider: 'outscraper',
      label: 'Outscraper',
      status: 'blocked',
      canRun: false,
      costTier: 'paid',
      reason: 'Paid scraper quarantined.',
    },
  ],
  marketHeat: [
    { market: 'Milwaukee, WI', heat: 80, leads: 120, replied: 2 },
    { market: 'Toledo, OH', heat: 74, leads: 90, replied: 1 },
  ],
  nextRefreshMarkets: ['Cleveland, OH', 'Columbus, OH'],
  campaigns: [
    {
      key: 'tax-code-stack',
      label: 'Tax delinquent + code violation',
      sent: 100,
      failed: 0,
      blocked: 0,
      replies: 1,
      lastEventAt: '2026-06-13T18:00:00.000Z',
    },
  ],
  jobs: DEFAULT_AUTOPILOT_JOBS.map((job, index) => ({
    job_key: job.jobKey,
    job_type: job.jobType,
    title: job.title,
    status: 'active',
    priority: job.priority,
    next_run_at: index < 2 ? '2026-06-14T13:00:00.000Z' : '2026-06-14T18:00:00.000Z',
    last_run_at: index === 0 ? '2026-06-14T08:00:00.000Z' : null,
  })),
  strategyRuns: [
    {
      strategy_key: 'tax-code-stack',
      strategy_name: 'Tax delinquent + code violation',
      status: 'completed',
      created_at: '2026-06-13T18:00:00.000Z',
    },
  ],
  replyMemory: [
    {
      strategy_key: 'tax-code-stack',
      classification: 'hot_seller_lead',
      received_at: '2026-06-13T20:00:00.000Z',
      reply_summary: 'Seller wants terms.',
    },
  ],
  suppressionDecisions: [
    {
      decision: 'blocked',
      created_at: '2026-06-13T19:00:00.000Z',
    },
  ],
}

const batches = buildStrategyBatchPlans(baseInput)
assert.equal(batches.length, 4, 'Autopilot should keep the four seller strategies separated')
assert.deepEqual(
  batches.map((batch) => batch.strategyKey),
  [
    'tax-code-stack',
    'senior-out-of-state-landlord',
    'on-market-lowball-agent-sweep',
    'stale-listing-creative-finance',
  ],
  'Strategy ordering should stay stable for command-center review'
)
assert.ok(batches.every((batch) => batch.targetEmailCount <= 100), 'No strategy should exceed 100 planned emails per batch')
assert.ok(batches.every((batch) => batch.targetSmsReviewCount === batch.targetEmailCount), 'SMS should mirror email count as review-only tasks')
assert.ok(batches[0]?.markets.includes('Cleveland, OH'), 'Tax/code stack should use refresh markets first')
assert.ok(batches[2]?.markets.includes('Milwaukee, WI'), 'On-market lane should use hot markets first')

const snapshot = buildAutopilotSnapshot(baseInput)
assert.equal(snapshot.status, 'green')
assert.equal(snapshot.mode, 'send_ready')
assert.equal(snapshot.durable.jobsConfigured, DEFAULT_AUTOPILOT_JOBS.length)
assert.equal(snapshot.durable.jobsDue, 2)
assert.equal(snapshot.durable.strategyRuns7d, 1)
assert.equal(snapshot.durable.replyMemories7d, 1)
assert.equal(snapshot.durable.suppressionBlocks7d, 1)
assert.ok(snapshot.nextMove.includes('Tax delinquent') || snapshot.nextMove.includes('Run'), 'Snapshot should name the next operating move')

const blocked = buildAutopilotSnapshot({
  ...baseInput,
  missingSuppressionDb: true,
  jobs: [],
  replyMemory: [],
  suppressionDecisions: [],
})
assert.equal(blocked.status, 'red')
assert.equal(blocked.mode, 'blocked')
assert.ok(blocked.batches.every((batch) => batch.blockedReason?.includes('Suppression database')), 'Missing suppression DB should block every strategy')
assert.equal(blocked.guardrails.find((guardrail) => guardrail.label === 'Suppressions')?.status, 'red')

const replyFirst = buildAutopilotSnapshot({
  ...baseInput,
  replySignals7d: 3,
  remainingToday: 300,
})
assert.ok(replyFirst.nextMove.startsWith('Work replies'), 'Replies should outrank fresh volume')
assert.equal(
  replyFirst.batches.filter((batch) => batch.targetEmailCount > 0).length,
  2,
  'Reply-first mode should only keep focus and challenger batches active'
)

console.log('command-center-autopilot: ok')
