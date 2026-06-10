import {
  type RoughPropertyEstimate,
  type RoughPropertyEstimateInput,
  parseCurrencyAmount,
} from '@/lib/property/roughEstimate'

export type PropertyOpportunityInput = RoughPropertyEstimateInput & {
  afterRepairValue?: string | number | null
  repairBudget?: string | number | null
  monthlyTaxes?: string | number | null
  monthlyInsurance?: string | number | null
  monthlyDebtService?: string | number | null
}

export type PropertyOpportunityAnalysis = {
  metrics: {
    arv: number | null
    repairBudget: number | null
    mao70: number | null
    conservativeCashReview: number | null
    balancedCashReview: number | null
    discountToValuePercent: number | null
    equityPercent: number | null
    grossRentYieldPercent: number | null
    estimatedMonthlyCarry: number | null
    estimatedMonthlyCashFlow: number | null
    dscr: number | null
  }
  routeFit: Array<{
    key: 'fast_cash' | 'creative_structure' | 'novation' | 'lender_review'
    label: string
    score: number
    summary: string
  }>
  buyerInterest: {
    label: 'Needs more details' | 'Possible buyer fit' | 'Good buyer fit' | 'Strong buyer fit'
    score: number
    summary: string
  }
  nextSteps: string[]
  disclaimer: string
}

function roundToNearest(value: number | null, nearest = 1000) {
  if (!Number.isFinite(value)) return null
  return Math.round(Number(value) / nearest) * nearest
}

function percent(numerator: number | null, denominator: number | null) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Number(denominator) <= 0) return null
  return Math.round((Number(numerator) / Number(denominator)) * 1000) / 10
}

function bounded(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function conditionScore(condition?: string | null) {
  const normalized = String(condition || '').toLowerCase()
  if (/fire|mold|gut|major|poor|unsafe/.test(normalized)) return 88
  if (/vacant|distress|code|violation/.test(normalized)) return 78
  if (/fair|repairs|dated|needs work/.test(normalized)) return 68
  if (/good|average|livable/.test(normalized)) return 48
  if (/excellent|renovated|turnkey/.test(normalized)) return 30
  return 45
}

function timelineScore(timeline?: string | null) {
  const normalized = String(timeline || '').toLowerCase()
  if (/asap|now|immediate|urgent|7|14/.test(normalized)) return 86
  if (/30|fast/.test(normalized)) return 70
  if (/60|90/.test(normalized)) return 48
  return 40
}

function hasHealthyEquity(estimate: RoughPropertyEstimate) {
  if (estimate.equityEstimate === null || estimate.estimateValue === null || estimate.estimateValue <= 0) return false
  return estimate.equityEstimate / estimate.estimateValue >= 0.18
}

function routeSummary(label: string, score: number) {
  if (score >= 78) return `${label} should be reviewed first.`
  if (score >= 58) return `${label} is worth keeping in the route stack.`
  if (score >= 38) return `${label} may work after more details are verified.`
  return `${label} is a lower-fit path from the details provided.`
}

export function buildPropertyOpportunityAnalysis(
  input: PropertyOpportunityInput,
  estimate: RoughPropertyEstimate
): PropertyOpportunityAnalysis {
  const arv = parseCurrencyAmount(input.afterRepairValue) ?? estimate.estimateValue
  const repairBudget = parseCurrencyAmount(input.repairBudget)
  const askingPrice = estimate.askingPrice
  const monthlyRent = estimate.rentEstimate
  const monthlyTaxes = parseCurrencyAmount(input.monthlyTaxes)
  const monthlyInsurance = parseCurrencyAmount(input.monthlyInsurance)
  const monthlyDebtService = parseCurrencyAmount(input.monthlyDebtService)
  const monthlyCarry =
    (monthlyTaxes || 0) + (monthlyInsurance || 0) + (monthlyDebtService || 0)
  const estimatedMonthlyCashFlow =
    monthlyRent !== null && monthlyCarry > 0 ? Math.round(monthlyRent - monthlyCarry) : null

  const mao70 =
    arv !== null
      ? roundToNearest(arv * 0.7 - (repairBudget || 0), 500)
      : null
  const conservativeCashReview =
    estimate.estimateValue !== null
      ? roundToNearest(estimate.estimateValue * 0.62 - (repairBudget || 0) * 0.35, 1000)
      : null
  const balancedCashReview =
    estimate.estimateValue !== null
      ? roundToNearest(estimate.estimateValue * 0.72 - (repairBudget || 0) * 0.25, 1000)
      : null

  const discountToValuePercent =
    askingPrice !== null && estimate.estimateValue !== null
      ? percent(estimate.estimateValue - askingPrice, estimate.estimateValue)
      : null
  const equityPercent =
    estimate.equityEstimate !== null && estimate.estimateValue !== null
      ? percent(estimate.equityEstimate, estimate.estimateValue)
      : null
  const grossRentYieldPercent =
    monthlyRent !== null && estimate.estimateValue !== null
      ? percent(monthlyRent * 12, estimate.estimateValue)
      : null
  const dscr =
    monthlyRent !== null && monthlyDebtService !== null && monthlyDebtService > 0
      ? Math.round((monthlyRent / monthlyDebtService) * 100) / 100
      : null

  const distress = conditionScore(input.propertyCondition)
  const urgency = timelineScore(input.timelineToSell)
  const hasEstimate = estimate.estimateValue !== null
  const hasRent = estimate.rentEstimate !== null
  const isTenant = /tenant|rental|leased/i.test(String(input.occupancyStatus || ''))
  const highDebt =
    estimate.ltvEstimate !== null
      ? estimate.ltvEstimate >= 75
      : estimate.equityEstimate !== null
        ? estimate.equityEstimate < 25000
        : false

  const fastCashScore = bounded(distress * 0.45 + urgency * 0.35 + (hasEstimate ? 14 : 0) + (hasHealthyEquity(estimate) ? 8 : 0))
  const creativeScore = bounded((highDebt ? 42 : 16) + (urgency < 65 ? 18 : 8) + (hasEstimate ? 12 : 0) + (isTenant ? 8 : 0))
  const novationScore = bounded(
    (/good|average|excellent|renovated|livable/i.test(String(input.propertyCondition || '')) ? 34 : 14) +
      (discountToValuePercent !== null && discountToValuePercent >= 8 ? 24 : 10) +
      (urgency <= 70 ? 18 : 8) +
      (hasEstimate ? 12 : 0)
  )
  const lenderScore = bounded((hasEstimate ? 26 : 8) + (hasRent ? 24 : 4) + (equityPercent !== null && equityPercent >= 20 ? 18 : 6) + (isTenant ? 12 : 4))

  const routeFit = [
    {
      key: 'fast_cash' as const,
      label: 'Fast cash review',
      score: fastCashScore,
      summary: routeSummary('Fast cash', fastCashScore),
    },
    {
      key: 'creative_structure' as const,
      label: 'Creative structure',
      score: creativeScore,
      summary: routeSummary('Creative structure', creativeScore),
    },
    {
      key: 'novation' as const,
      label: 'Novation path',
      score: novationScore,
      summary: routeSummary('Novation', novationScore),
    },
    {
      key: 'lender_review' as const,
      label: 'Lender review',
      score: lenderScore,
      summary: routeSummary('Lender review', lenderScore),
    },
  ].sort((a, b) => b.score - a.score)

  const buyerInterestScore = bounded(
    (hasEstimate ? 26 : 8) +
      Math.max(fastCashScore, creativeScore, novationScore) * 0.42 +
      (discountToValuePercent !== null && discountToValuePercent > 10 ? 12 : 4) +
      (input.city && input.state ? 8 : 0)
  )

  const buyerInterest = {
    score: buyerInterestScore,
    label:
      buyerInterestScore >= 80
        ? 'Strong buyer fit'
        : buyerInterestScore >= 62
          ? 'Good buyer fit'
          : buyerInterestScore >= 42
            ? 'Possible buyer fit'
            : 'Needs more details',
    summary:
      buyerInterestScore >= 62
        ? 'This looks routeable once ownership, condition, price, and seller timeline are verified.'
        : 'The property needs more detail before it should be sent to buyers or lenders.',
  } satisfies PropertyOpportunityAnalysis['buyerInterest']

  const topRoute = routeFit[0]
  const nextSteps = [
    'Verify ownership, payoff, liens, taxes, and property condition before any offer or routing.',
    topRoute ? `Start with ${topRoute.label.toLowerCase()} and keep the other paths available until the seller goal is clear.` : null,
    'If the seller wants a real conversation, submit the property so VestBlock can create a routing packet.',
  ].filter(Boolean) as string[]

  return {
    metrics: {
      arv: roundToNearest(arv, 1000),
      repairBudget: roundToNearest(repairBudget, 500),
      mao70,
      conservativeCashReview,
      balancedCashReview,
      discountToValuePercent,
      equityPercent,
      grossRentYieldPercent,
      estimatedMonthlyCarry: monthlyCarry > 0 ? Math.round(monthlyCarry) : null,
      estimatedMonthlyCashFlow,
      dscr,
    },
    routeFit,
    buyerInterest,
    nextSteps,
    disclaimer:
      'This is a rough screening tool, not an appraisal, loan approval, legal advice, or guaranteed offer. Final decisions require verified comps, title, condition, and partner review.',
  }
}
