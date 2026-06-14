import {
  buildRenovationEstimate,
  type RenovationEstimate,
  type RenovationScope,
} from '@/lib/admin/renovationAgent'
import { parseCurrencyAmount } from '@/lib/property/roughEstimate'
import { builderBuyBoxQuestions } from '@/lib/investors/builderStrategy'

export type BuilderDispositionStrategy =
  | 'light_value_add'
  | 'heavy_rehab_flip'
  | 'teardown_infill'
  | 'ground_up'
  | 'manual_review'

export type BuilderDispositionPlan = {
  score: number
  label: 'Builder lane ready' | 'Possible builder lane' | 'Needs more detail'
  summary: string
  strategy: BuilderDispositionStrategy
  builderMaxPurchase: number | null
  recommendedSellerOffer: number | null
  suggestedAssignmentFee: number | null
  projectedGrossSpread: number | null
  rehabPlanningLow: number | null
  rehabPlanningHigh: number | null
  renovationScope: string
  sellerOutreachAngle: string
  buyBoxQuestions: string[]
  contractTerms: {
    earnestMoney: number | null
    inspectionDays: number
    closeWindowDays: number
  }
  nextSteps: string[]
}

function roundToNearest(value: number | null, nearest = 500) {
  if (!Number.isFinite(value)) return null
  return Math.round(Number(value) / nearest) * nearest
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scopeForCondition(condition?: string | null): RenovationScope {
  const normalized = String(condition || '').toLowerCase()
  if (/foundation|structural|fire|unsafe|collapse/.test(normalized)) return 'structural'
  if (/gut|major|full|vacant|distress/.test(normalized)) return 'full'
  if (/dated|fair|repairs|needs work/.test(normalized)) return 'moderate'
  return 'cosmetic'
}

function strategyForProperty(input: {
  propertyType?: string | null
  condition?: string | null
  repairBudget?: number | null
  squareFeet?: number | null
}) {
  const propertyType = String(input.propertyType || '').toLowerCase()
  const condition = String(input.condition || '').toLowerCase()

  if (/land|lot/.test(propertyType)) return 'ground_up'
  if (/teardown|demo/.test(condition)) return 'teardown_infill'
  if ((input.repairBudget || 0) >= 70000 || /major|gut|vacant|distress/.test(condition)) return 'heavy_rehab_flip'
  if ((input.squareFeet || 0) >= 1800 && /single|town|duplex|triplex|fourplex|multi/.test(propertyType)) return 'light_value_add'
  return 'manual_review'
}

function renovationFor(input: {
  squareFeet?: string | number | null
  state?: string | null
  propertyCondition?: string | null
  arv?: number | null
  askingPrice?: number | null
}) {
  const squareFeet = parseCurrencyAmount(input.squareFeet)
  if (!squareFeet || squareFeet < 300) return null

  return buildRenovationEstimate({
    squareFeet,
    scope: scopeForCondition(input.propertyCondition),
    state: input.state || undefined,
    conditionNotes: input.propertyCondition || undefined,
    arv: input.arv ?? undefined,
    askingPrice: input.askingPrice ?? undefined,
  })
}

function assignmentFeeForGrossSpread(grossSpread: number | null) {
  if (!Number.isFinite(grossSpread) || Number(grossSpread) <= 0) return null
  const spread = Number(grossSpread)

  if (spread < 5000) return roundToNearest(Math.max(1500, spread * 0.2), 500)
  if (spread < 15000) return roundToNearest(Math.max(3000, spread * 0.25), 500)
  return roundToNearest(Math.min(20000, Math.max(5000, spread * 0.3)), 500)
}

function summaryForScore(score: number, strategy: BuilderDispositionStrategy) {
  if (score >= 78) {
    return strategy === 'ground_up' || strategy === 'teardown_infill'
      ? 'This reads like a real builder lane opportunity once zoning, lot rules, and title are confirmed.'
      : 'This looks strong enough to route to builders or construction partners with an MAO-backed packet.'
  }

  if (score >= 56) {
    return 'There is enough signal for a builder or construction conversation, but the pricing and scope still need tightening.'
  }

  return 'This is not clean enough for a builder assignment lane yet. Verify scope, spread, and exit before outreach.'
}

export function buildBuilderDispositionPlan(input: {
  city?: string | null
  state?: string | null
  propertyType?: string | null
  propertyCondition?: string | null
  squareFeet?: string | number | null
  askingPrice?: number | null
  estimateValue?: number | null
  arv?: number | null
  repairBudget?: number | null
  mao70?: number | null
  balancedCashReview?: number | null
  conservativeCashReview?: number | null
  flipProfit?: number | null
  discountToValuePercent?: number | null
}): BuilderDispositionPlan {
  const renovationEstimate: RenovationEstimate | null = renovationFor({
    squareFeet: input.squareFeet,
    state: input.state,
    propertyCondition: input.propertyCondition,
    arv: input.arv,
    askingPrice: input.askingPrice,
  })

  const strategy = strategyForProperty({
    propertyType: input.propertyType,
    condition: input.propertyCondition,
    repairBudget: input.repairBudget,
    squareFeet: parseCurrencyAmount(input.squareFeet),
  })

  const builderMaxPurchase = roundToNearest(
    input.mao70 ?? input.balancedCashReview ?? input.conservativeCashReview ?? null,
    500
  )
  const anchorPrice = input.askingPrice ?? input.estimateValue ?? null
  const projectedGrossSpread =
    builderMaxPurchase !== null && anchorPrice !== null ? roundToNearest(builderMaxPurchase - anchorPrice, 500) : null
  const suggestedAssignmentFee = assignmentFeeForGrossSpread(projectedGrossSpread)
  const recommendedSellerOffer =
    builderMaxPurchase !== null
      ? roundToNearest(
          builderMaxPurchase - (suggestedAssignmentFee || 0),
          500
        )
      : null

  const builderScore = bounded(
    (input.discountToValuePercent != null && input.discountToValuePercent >= 10 ? 22 : 8) +
      ((input.flipProfit || 0) >= 25000 ? 18 : (input.flipProfit || 0) >= 10000 ? 10 : 4) +
      ((input.repairBudget || 0) >= 35000 ? 14 : (input.repairBudget || 0) > 0 ? 8 : 2) +
      (strategy === 'ground_up' || strategy === 'teardown_infill' ? 16 : strategy === 'heavy_rehab_flip' ? 12 : 6) +
      (projectedGrossSpread !== null && projectedGrossSpread > 0 ? Math.min(20, Math.round(projectedGrossSpread / 2000)) : 0)
  )

  const marketLabel = [input.city, input.state].filter(Boolean).join(', ') || null
  const earnestMoney =
    recommendedSellerOffer !== null ? roundToNearest(Math.max(2500, recommendedSellerOffer * 0.02), 500) : null

  return {
    score: builderScore,
    label: builderScore >= 72 ? 'Builder lane ready' : builderScore >= 48 ? 'Possible builder lane' : 'Needs more detail',
    summary: summaryForScore(builderScore, strategy),
    strategy,
    builderMaxPurchase,
    recommendedSellerOffer,
    suggestedAssignmentFee,
    projectedGrossSpread,
    rehabPlanningLow: renovationEstimate?.budgetLow ?? roundToNearest(input.repairBudget ?? null, 500),
    rehabPlanningHigh: renovationEstimate?.budgetHigh ?? roundToNearest(input.repairBudget ?? null, 500),
    renovationScope: renovationEstimate?.scopeLabel || 'Manual rehab review',
    sellerOutreachAngle:
      strategy === 'ground_up' || strategy === 'teardown_infill'
        ? 'Lead with lot value, build potential, and a quick close instead of a retail-ready sales angle.'
        : 'Lead with renovation upside, realistic close speed, and a clean property packet instead of broad blasting.',
    buyBoxQuestions: builderBuyBoxQuestions(marketLabel),
    contractTerms: {
      earnestMoney,
      inspectionDays: strategy === 'ground_up' || strategy === 'teardown_infill' ? 10 : 7,
      closeWindowDays: strategy === 'ground_up' || strategy === 'teardown_infill' ? 21 : 14,
    },
    nextSteps: [
      'Confirm title, payoff, access, occupancy, and seller motivation before routing to builders.',
      'Collect builder buy-box rules first: neighborhoods, lot size, rehab tolerance, and close speed.',
      'Use the recommended seller offer and assignment fee as a planning range, then tighten it with local comps and contractor feedback.',
      'Once a builder says yes, move straight into an assignment packet with earnest money, close window, and assignee entity confirmed.',
    ],
  }
}
