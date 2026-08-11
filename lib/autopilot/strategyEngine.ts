export const STRATEGY_VERTICALS = [
  'real_estate_acquisitions',
  'real_estate_buyers',
  'dscr',
  'business_funding',
  'funding_partners',
  'seo',
  'aeo',
  'pr',
  'email_outreach',
  'sms',
  'social_media',
  'content',
  'paid_advertising',
  'partnerships',
  'referrals',
  'conversion_rate',
  'retention_reactivation',
] as const

export type StrategyVertical = (typeof STRATEGY_VERTICALS)[number]

export type StrategyScoreInput = {
  expectedImpact: number
  confidence: number
  cost: number
  timeToResult: number
  executionDifficulty: number
  risk: number
}

export type StrategyScore = StrategyScoreInput & {
  total: number
  formula: string
}

export type VestBlockStrategy = {
  schemaVersion: 1
  name: string
  vertical: StrategyVertical
  hypothesis: string
  targetAudience: string
  problem: string
  tactic: string
  channel: string
  expectedOutcome: string
  primaryKpi: string
  secondaryKpis: string[]
  cost: string
  risk: 'low' | 'medium' | 'high'
  confidence: number
  evidence: string[]
  dateCreated: string
  status: 'candidate' | 'approved' | 'testing' | 'measured' | 'retired'
  result: string | null
  lesson: string | null
  nextIteration: string | null
  score: StrategyScore
}

export type StrategyCandidateInput = Omit<
  VestBlockStrategy,
  'schemaVersion' | 'dateCreated' | 'status' | 'result' | 'lesson' | 'nextIteration' | 'score'
> & {
  score: StrategyScoreInput
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function scoreStrategy(input: StrategyScoreInput): StrategyScore {
  const normalized = {
    expectedImpact: clamp(input.expectedImpact),
    confidence: clamp(input.confidence),
    cost: clamp(input.cost),
    timeToResult: clamp(input.timeToResult),
    executionDifficulty: clamp(input.executionDifficulty),
    risk: clamp(input.risk),
  }
  const total = Math.round(
    normalized.expectedImpact * 0.3 +
      normalized.confidence * 0.25 +
      normalized.timeToResult * 0.15 +
      (100 - normalized.cost) * 0.1 +
      (100 - normalized.executionDifficulty) * 0.1 +
      (100 - normalized.risk) * 0.1
  )

  return {
    ...normalized,
    total,
    formula:
      'impact × 30% + confidence × 25% + speed × 15% + inverse cost × 10% + inverse difficulty × 10% + inverse risk × 10%',
  }
}

export function createStrategyObject(
  input: StrategyCandidateInput,
  now = new Date().toISOString()
): VestBlockStrategy {
  return {
    schemaVersion: 1,
    name: input.name.trim(),
    vertical: input.vertical,
    hypothesis: input.hypothesis.trim(),
    targetAudience: input.targetAudience.trim(),
    problem: input.problem.trim(),
    tactic: input.tactic.trim(),
    channel: input.channel.trim(),
    expectedOutcome: input.expectedOutcome.trim(),
    primaryKpi: input.primaryKpi.trim(),
    secondaryKpis: input.secondaryKpis.map((value) => value.trim()).filter(Boolean).slice(0, 8),
    cost: input.cost.trim(),
    risk: input.risk,
    confidence: clamp(input.confidence),
    evidence: input.evidence.map((value) => value.trim()).filter(Boolean).slice(0, 12),
    dateCreated: now,
    status: 'candidate',
    result: null,
    lesson: null,
    nextIteration: null,
    score: scoreStrategy(input.score),
  }
}

export function strategyTargetKey(strategy: VestBlockStrategy, weekKey: string) {
  return `autopilot:${weekKey}:${strategy.vertical}:${strategy.name}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180)
}
