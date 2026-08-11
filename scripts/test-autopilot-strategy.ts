import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  createStrategyObject,
  scoreStrategy,
  strategyTargetKey,
} from '../lib/autopilot/strategyEngine'

const candidate = {
  name: 'Controlled strategy attribution test',
  vertical: 'email_outreach' as const,
  hypothesis: 'Correlated positive replies should be worked before a new volume batch.',
  targetAudience: 'Existing tagged test conversations',
  problem: 'A controlled reply is waiting for an operator decision.',
  tactic: 'Create one task and record the measured result without sending anything.',
  channel: 'Command Center test fixture',
  expectedOutcome: 'The strategy, campaign, and result remain linked.',
  primaryKpi: 'attributed test opportunity',
  secondaryKpis: ['reply-to-task time'],
  cost: '$0 media spend',
  risk: 'low' as const,
  confidence: 78,
  evidence: ['Controlled fixture; no customer record and no provider send.'],
  score: {
    expectedImpact: 82,
    confidence: 78,
    cost: 12,
    timeToResult: 92,
    executionDifficulty: 22,
    risk: 14,
  },
}

const scored = scoreStrategy(candidate.score)
assert.equal(scored.total, 83)
assert.match(scored.formula, /impact × 30%/)

const strategy = createStrategyObject(candidate, '2026-08-10T00:00:00.000Z')
assert.equal(strategy.status, 'candidate')
assert.equal(strategy.result, null)
assert.equal(strategy.score.total, 83)
assert.equal(strategy.evidence.length, 1)
assert.match(strategyTargetKey(strategy, 'controlled-test'), /^autopilot:controlled-test:email_outreach:/)

async function livePersistenceTest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  assert.ok(url && serviceKey, 'Supabase admin environment is required for --live.')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const marker = `codex-autopilot-${Date.now()}`
  let strategyId: string | null = null
  let campaignId: string | null = null
  let experimentId: string | null = null

  try {
    const measuredStrategy = createStrategyObject(candidate)
    const { data: strategyRow, error: strategyError } = await admin
      .from('strategy_updates')
      .insert({
        category: 'autopilot_strategy',
        target_type: 'vestblock_strategy',
        target_key: marker,
        risk_level: measuredStrategy.risk,
        approval_status: 'approved',
        title: measuredStrategy.name,
        rationale: measuredStrategy.hypothesis,
        proposed_change_json: measuredStrategy,
        requires_admin_review: true,
        approved_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (strategyError) throw strategyError
    strategyId = strategyRow.id

    const { data: campaignRow, error: campaignError } = await admin
      .from('command_center_strategy_runs')
      .insert({
        strategy_key: marker,
        strategy_name: measuredStrategy.name,
        status: 'planned',
        source_provider: 'vestblock',
        cost_guardrail_status: 'allowed',
        metadata_json: {
          strategyUpdateId: strategyId,
          launchAuthority: 'not_granted',
          controlledTest: true,
        },
      })
      .select('*')
      .single()
    if (campaignError) throw campaignError
    campaignId = campaignRow.id
    assert.equal(campaignRow.metadata_json.launchAuthority, 'not_granted')

    const metrics = {
      strategyId,
      campaignRunId: campaignId,
      leads: 1,
      replies: 1,
      opportunities: 1,
      conversions: 0,
      revenue: 0,
      controlledTest: true,
    }
    const { data: experimentRow, error: experimentError } = await admin
      .from('experiment_results')
      .insert({
        experiment_key: marker,
        category: 'strategy_revenue_attribution',
        variant_key: marker,
        metrics_json: metrics,
        winner: false,
        notes: 'Controlled persistence proof; no provider action.',
      })
      .select('*')
      .single()
    if (experimentError) throw experimentError
    experimentId = experimentRow.id

    const { data: proof, error: proofError } = await admin
      .from('experiment_results')
      .select('metrics_json')
      .eq('id', experimentId)
      .single()
    if (proofError) throw proofError
    assert.equal(proof.metrics_json.strategyId, strategyId)
    assert.equal(proof.metrics_json.campaignRunId, campaignId)
    assert.equal(proof.metrics_json.revenue, 0)
  } finally {
    if (experimentId) await admin.from('experiment_results').delete().eq('id', experimentId)
    if (campaignId) await admin.from('command_center_strategy_runs').delete().eq('id', campaignId)
    if (strategyId) await admin.from('strategy_updates').delete().eq('id', strategyId)
  }
}

if (process.argv.includes('--live')) {
  livePersistenceTest()
    .then(() => console.log('Autopilot strategy + attribution tests passed (pure + live persistence, exact cleanup).'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
} else {
  console.log('Autopilot strategy scoring tests passed (pure). Add --live for tagged persistence proof.')
}
