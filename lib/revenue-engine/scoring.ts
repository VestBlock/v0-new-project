import type { RevenueLane, RevenueScore, RevenueScoreInput } from './types'

const SCORE_VERSION = 'revenue-engine-v1'

const WEIGHTS: Record<RevenueLane, Record<keyof Omit<RevenueScoreInput, 'lane' | 'riskPenalty'>, number>> = {
  deals: { fit: 0.22, urgency: 0.2, economics: 0.25, readiness: 0.14, engagement: 0.09, dataQuality: 0.1 },
  capital: { fit: 0.24, urgency: 0.1, economics: 0.16, readiness: 0.24, engagement: 0.1, dataQuality: 0.16 },
  partners: { fit: 0.3, urgency: 0.06, economics: 0.14, readiness: 0.14, engagement: 0.22, dataQuality: 0.14 },
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function bandFor(score: number, confidence: number): RevenueScore['band'] {
  if (confidence < 45) return 'review'
  if (score >= 80) return 'priority'
  if (score >= 62) return 'qualified'
  if (score >= 38) return 'nurture'
  return 'review'
}

export function scoreRevenueOpportunity(raw: RevenueScoreInput): RevenueScore {
  const input: RevenueScoreInput = {
    lane: raw.lane,
    fit: clamp(raw.fit),
    urgency: clamp(raw.urgency),
    economics: clamp(raw.economics),
    readiness: clamp(raw.readiness),
    engagement: clamp(raw.engagement),
    dataQuality: clamp(raw.dataQuality),
    riskPenalty: clamp(raw.riskPenalty || 0),
  }
  const weights = WEIGHTS[input.lane]
  const weighted =
    input.fit * weights.fit +
    input.urgency * weights.urgency +
    input.economics * weights.economics +
    input.readiness * weights.readiness +
    input.engagement * weights.engagement +
    input.dataQuality * weights.dataQuality
  const score = Math.round(clamp(weighted - (input.riskPenalty || 0)))
  const confidence = Math.round(clamp(input.dataQuality * 0.7 + input.readiness * 0.3))
  const ranked = [
    ['fit', input.fit],
    ['economics', input.economics],
    ['readiness', input.readiness],
    ['urgency', input.urgency],
    ['engagement', input.engagement],
    ['data quality', input.dataQuality],
  ] as const
  const strongest = [...ranked].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const reasons = strongest.map(([label, value]) => `${label} ${value}/100`)
  if (input.riskPenalty) reasons.push(`risk penalty -${input.riskPenalty}`)
  if (confidence < 45) reasons.push('manual review: confidence below 45')

  return {
    score,
    confidence,
    version: SCORE_VERSION,
    band: bandFor(score, confidence),
    reasons,
    inputs: input,
  }
}
