import {
  type RoughPropertyEstimate,
  type RoughPropertyEstimateInput,
  parseCurrencyAmount,
} from '@/lib/property/roughEstimate'
import {
  computeArv,
  computeEndBuyerProfit,
  computeMao,
  computeSpread,
  getDealRulePercent,
  getDealRuleType,
  gradeDeal,
} from '@/lib/property/dealAnalyzerMath'
import {
  buildBuilderDispositionPlan,
  type BuilderDispositionPlan,
} from '@/lib/property/builderDisposition'
import {
  calculateAnnualDebtService,
  calculateBreakEvenRent,
  calculateCapRate,
  calculateCashFlow,
  calculateCashOnCashReturn,
  calculateConservativeLoanAmount,
  calculateDebtYield,
  calculateDscr,
  calculateFlipProfit,
  calculateFundingGap,
  calculateMaxAllowableOffer,
  calculateMonthlyMortgagePayment,
  calculateNetOperatingIncome,
  calculateOperatingExpenses,
  calculateRentToPriceRatioPercent,
  calculateReturnOnInvestment,
  principalFromPaymentCapacity,
  remainingLoanBalance,
} from '@/lib/property/formulas'

export const MIN_CASH_ON_CASH_RETURN_PERCENT = 13

export type PropertyOpportunityInput = RoughPropertyEstimateInput & {
  selectedComps?: Array<{
    address?: string | null
    salePrice?: string | number | null
    squareFeet?: string | number | null
    distanceMiles?: string | number | null
    beds?: string | number | null
    baths?: string | number | null
    notes?: string | null
  }>
  listingSourceUrl?: string | null
  listingStatus?: string | null
  daysOnMarket?: string | number | null
  priceCutCount?: string | number | null
  lastPriceCutAmount?: string | number | null
  listingNotes?: string | null
  afterRepairValue?: string | number | null
  repairBudget?: string | number | null
  assignmentFee?: string | number | null
  closingCosts?: string | number | null
  holdingPeriodMonths?: string | number | null
  monthlyRentEstimate?: string | number | null
  monthlyTaxes?: string | number | null
  monthlyInsurance?: string | number | null
  monthlyUtilities?: string | number | null
  propertyManagementPercent?: string | number | null
  vacancyPercent?: string | number | null
  maintenancePercent?: string | number | null
  otherMonthlyExpenses?: string | number | null
  monthlyDebtService?: string | number | null
  downPayment?: string | number | null
  interestRate?: string | number | null
  loanTermYears?: string | number | null
  points?: string | number | null
  lenderFees?: string | number | null
  loanToCost?: string | number | null
  loanToValue?: string | number | null
  privateMoneyAmount?: string | number | null
  gapFundingAmount?: string | number | null
  sellerFinanceAmount?: string | number | null
  operatorCashAvailable?: string | number | null
  exitStrategy?: string | null
  creditScoreRange?: string | null
  entityStatus?: string | null
  realEstateExperience?: string | null
  documentsAvailable?: string | null
  targetMonthlyCashFlow?: string | number | null
  creativeDownPayment?: string | number | null
  creativeNoteInterestRate?: string | number | null
  creativeAmortizationYears?: string | number | null
  creativeBalloonYears?: string | number | null
  existingLoanInterestRate?: string | number | null
  existingLoanRemainingTermYears?: string | number | null
}

export type CreativeOfferKey = 'seller_finance' | 'subject_to' | 'wrap_mortgage' | 'hybrid_morby'

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
    monthlyOperatingExpenses: number | null
    annualDebtService: number | null
    netOperatingIncomeAnnual: number | null
    capRatePercent: number | null
    cashOnCashReturnPercent: number | null
    debtYieldPercent: number | null
    breakEvenRent: number | null
    rentToPriceRatioPercent: number | null
    flipProfit: number | null
    flipRoiPercent: number | null
    recommendedLoanAmount: number | null
    totalProjectCost: number | null
    totalCashNeeded: number | null
    fundingGap: number | null
  }
  dealMath: {
    arvMode: 'BASELINE' | 'COMPS_AVG' | 'MANUAL'
    ruleType: 'residential' | 'land' | 'commercial'
    rulePercent: number
    assignmentFee: number | null
    mao: number | null
    sellerAsk: number | null
    spread: number | null
    endBuyerProfit: number | null
    grade: 'RISKY' | 'GOOD' | null
  }
  comparables: {
    usedCount: number
    averageSalePrice: number | null
    averagePricePerFoot: number | null
    selected: Array<{
      address: string | null
      salePrice: number | null
      squareFeet: number | null
      distanceMiles: number | null
      beds: number | null
      baths: number | null
      notes: string | null
      pricePerFoot: number | null
    }>
  }
  listingContext: {
    sourceUrl: string | null
    status: string | null
    daysOnMarket: number | null
    priceCutCount: number | null
    lastPriceCutAmount: number | null
    pressureLabel:
      | 'Needs public listing context'
      | 'Off-market or private'
      | 'Fresh listing'
      | 'Active listing'
      | 'Stale listing'
      | 'Discounted listing'
    summary: string
    signals: string[]
  }
  dealStrength: {
    score: number
    label: 'Strong' | 'Promising' | 'Watchlist' | 'Weak'
    summary: string
    strengths: string[]
  }
  signalScore: {
    score: number
    label: 'High-intent signal' | 'Useful signal' | 'Thin signal' | 'Needs source evidence'
    summary: string
    signals: string[]
    nextAction: string
  }
  fundingReadiness: {
    score: number
    label: 'Ready to route' | 'Needs more file prep' | 'Needs borrower cleanup' | 'Manual review'
    recommendedPath:
      | 'DSCR'
      | 'Hard money'
      | 'Private money'
      | 'Gap funding'
      | 'Transactional funding'
      | 'Business credit builder'
      | 'Credit prep'
      | 'Manual review'
    summary: string
    missingItems: string[]
  }
  capitalStack: {
    totalProjectCost: number | null
    seniorDebt: number | null
    privateMoney: number | null
    sellerFinance: number | null
    gapFunding: number | null
    operatorCash: number | null
    estimatedReserves: number | null
    totalCapitalAvailable: number | null
    fundingGap: number | null
    notes: string[]
  }
  riskFlags: string[]
  creativeOffers: Array<{
    key: CreativeOfferKey
    label: string
    viability: 'Meets target' | 'Borderline' | 'Below target' | 'Needs more inputs'
    summary: string
    caution: string | null
    trustScore: number
    trustLabel: 'Offer-ready' | 'Promising' | 'Needs proof' | 'Do not send'
    terms: string[]
    guardrails: string[]
    metrics: {
      targetMonthlyCashFlow: number | null
      maxPriceToHitTargetCashFlow: number | null
      suggestedPurchasePrice: number | null
      cashToSellerNow: number | null
      cashToClose: number | null
      entryFee: number | null
      arrearsAndLiens: number | null
      closingBuffer: number | null
      repairReserve: number | null
      operatingReserve: number | null
      financedBalance: number | null
      seniorDebt: number | null
      sellerCarryBalance: number | null
      existingLoanBalance: number | null
      existingLoanPayment: number | null
      noteRatePercent: number | null
      amortizationYears: number | null
      balloonYears: number | null
      monthlyPayment: number | null
      totalMonthlyPayment: number | null
      estimatedMonthlyCashFlow: number | null
      paymentSpread: number | null
      sellerMonthlySpread: number | null
      balloonBalance: number | null
      balloonEquityCushion: number | null
      exitLoanToValuePercent: number | null
    }
  }>
  routeFit: Array<{
    key: 'fast_cash' | 'creative_structure' | 'novation' | 'lender_review' | 'builder_disposition'
    label: string
    score: number
    summary: string
  }>
  builderDisposition: BuilderDispositionPlan
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

function creativeViabilityLabel(
  estimatedMonthlyCashFlow: number | null,
  targetMonthlyCashFlow: number | null,
  suggestedPurchasePrice: number | null,
  maxPriceToHitTargetCashFlow: number | null
): PropertyOpportunityAnalysis['creativeOffers'][number]['viability'] {
  if (
    !Number.isFinite(estimatedMonthlyCashFlow) ||
    !Number.isFinite(targetMonthlyCashFlow) ||
    !Number.isFinite(suggestedPurchasePrice) ||
    !Number.isFinite(maxPriceToHitTargetCashFlow)
  ) {
    return 'Needs more inputs'
  }

  if (Number(estimatedMonthlyCashFlow) >= Number(targetMonthlyCashFlow)) return 'Meets target'
  if (Number(estimatedMonthlyCashFlow) >= Number(targetMonthlyCashFlow) * 0.6) return 'Borderline'
  return 'Below target'
}

function creativeSummary(
  label: string,
  viability: PropertyOpportunityAnalysis['creativeOffers'][number]['viability'],
  askingPrice: number | null,
  maxPriceToHitTargetCashFlow: number | null
) {
  if (!Number.isFinite(maxPriceToHitTargetCashFlow)) {
    return `Add rent, carry, and payoff details to size a ${label.toLowerCase()} structure.`
  }

  if (viability === 'Meets target') {
    return `${label} can support this deal at the current assumptions and still protect monthly spread.`
  }

  if (viability === 'Borderline') {
    return `${label} may work, but the terms need to stay disciplined on price and payment.`
  }

  if (askingPrice !== null && Number(maxPriceToHitTargetCashFlow) < askingPrice) {
    return `${label} only works if the price or seller terms come down.`
  }

  return `${label} does not currently hit the monthly cash-flow target.`
}

function paymentFactor(annualRatePercent: number | null, amortizationYears: number | null) {
  const payment = calculateMonthlyMortgagePayment(1, annualRatePercent, amortizationYears)
  return Number.isFinite(payment) ? Number(payment) : null
}

function sumFinite(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => Number.isFinite(value))
  if (numericValues.length !== values.length) return null
  return Math.round(numericValues.reduce((sum, value) => sum + value, 0) * 100) / 100
}

function calculateCreativeEntryFee(inputs: {
  cashToClose: number | null
  repairBudget: number | null
  totalMonthlyPayment: number | null
}) {
  const repairReserve = Number.isFinite(inputs.repairBudget) ? Math.max(0, Number(inputs.repairBudget)) : 0
  const operatingReserve = Number.isFinite(inputs.totalMonthlyPayment)
    ? Math.round(Math.max(0, Number(inputs.totalMonthlyPayment)) * 3)
    : null
  const entryFee = sumFinite([inputs.cashToClose, repairReserve, operatingReserve])

  return {
    entryFee,
    repairReserve,
    operatingReserve,
  }
}

function balloonExitMetrics(inputs: {
  propertyValue: number | null
  balloonBalance: number | null
  existingLoanBalance?: number | null
}) {
  const totalExitDebt =
    Number.isFinite(inputs.balloonBalance) || Number.isFinite(inputs.existingLoanBalance)
      ? Number(inputs.balloonBalance || 0) + Number(inputs.existingLoanBalance || 0)
      : null
  const exitLoanToValuePercent = percent(totalExitDebt, inputs.propertyValue)
  const balloonEquityCushion =
    Number.isFinite(inputs.propertyValue) && Number.isFinite(totalExitDebt)
      ? Math.round((Number(inputs.propertyValue) - Number(totalExitDebt)) * 100) / 100
      : null

  return {
    exitLoanToValuePercent,
    balloonEquityCushion,
  }
}

function creativeTrustLabel(score: number): PropertyOpportunityAnalysis['creativeOffers'][number]['trustLabel'] {
  if (score >= 78) return 'Offer-ready'
  if (score >= 62) return 'Promising'
  if (score >= 42) return 'Needs proof'
  return 'Do not send'
}

function scoreCreativeOffer(inputs: {
  viability: PropertyOpportunityAnalysis['creativeOffers'][number]['viability']
  monthlyCashFlow: number | null
  targetMonthlyCashFlow: number | null
  entryFee: number | null
  propertyValue: number | null
  suggestedPurchasePrice: number | null
  balloonEquityCushion: number | null
  exitLoanToValuePercent: number | null
  hasExistingLoanDetails?: boolean
  sellerMonthlySpread?: number | null
  riskCount: number
}) {
  const cashFlowScore =
    Number.isFinite(inputs.monthlyCashFlow) && Number.isFinite(inputs.targetMonthlyCashFlow)
      ? Math.min(24, Math.max(0, Math.round((Number(inputs.monthlyCashFlow) / Math.max(Number(inputs.targetMonthlyCashFlow), 1)) * 20)))
      : 4
  const viabilityScore =
    inputs.viability === 'Meets target' ? 24 : inputs.viability === 'Borderline' ? 14 : inputs.viability === 'Below target' ? 4 : 0
  const entryFeeScore =
    Number.isFinite(inputs.entryFee) && Number.isFinite(inputs.propertyValue) && Number(inputs.propertyValue) > 0
      ? Math.max(0, Math.min(16, Math.round(16 - (Number(inputs.entryFee) / Number(inputs.propertyValue)) * 85)))
      : 4
  const priceScore =
    Number.isFinite(inputs.suggestedPurchasePrice) && Number.isFinite(inputs.propertyValue) && Number(inputs.propertyValue) > 0
      ? Math.max(0, Math.min(14, Math.round((1 - Number(inputs.suggestedPurchasePrice) / Number(inputs.propertyValue)) * 40 + 10)))
      : 4
  const exitScore =
    Number.isFinite(inputs.balloonEquityCushion) && Number(inputs.balloonEquityCushion) > 0
      ? Number.isFinite(inputs.exitLoanToValuePercent) && Number(inputs.exitLoanToValuePercent) <= 75
        ? 12
        : 7
      : 0
  const loanDetailScore = inputs.hasExistingLoanDetails === undefined ? 8 : inputs.hasExistingLoanDetails ? 10 : 0
  const spreadScore =
    inputs.sellerMonthlySpread === undefined
      ? 6
      : Number.isFinite(inputs.sellerMonthlySpread) && Number(inputs.sellerMonthlySpread) >= 0
        ? 8
        : 0

  return bounded(
    viabilityScore +
      cashFlowScore +
      entryFeeScore +
      priceScore +
      exitScore +
      loanDetailScore +
      spreadScore -
      inputs.riskCount * 3
  )
}

function formatMoneyForTerm(value: number | null) {
  if (!Number.isFinite(value)) return 'unknown'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
}

function formatRateForTerm(value: number | null) {
  if (!Number.isFinite(value)) return 'unknown rate'
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}%`
}

function buildCreativeTerms(inputs: {
  label: string
  suggestedPurchasePrice: number | null
  cashToSellerNow: number | null
  financedBalance: number | null
  seniorDebt?: number | null
  sellerCarryBalance?: number | null
  existingLoanPayment?: number | null
  noteRatePercent: number | null
  amortizationYears: number | null
  balloonYears: number | null
  monthlyPayment: number | null
  totalMonthlyPayment: number | null
}) {
  const terms = [
    `${inputs.label} price target: ${formatMoneyForTerm(inputs.suggestedPurchasePrice)}.`,
    `Cash to seller now: ${formatMoneyForTerm(inputs.cashToSellerNow)}.`,
    inputs.seniorDebt !== undefined ? `Senior debt target: ${formatMoneyForTerm(inputs.seniorDebt)}.` : null,
    inputs.sellerCarryBalance !== undefined ? `Seller carry balance: ${formatMoneyForTerm(inputs.sellerCarryBalance)}.` : null,
    inputs.financedBalance !== null ? `Financed balance: ${formatMoneyForTerm(inputs.financedBalance)}.` : null,
    `Seller note: ${formatRateForTerm(inputs.noteRatePercent)} over ${inputs.amortizationYears || 'unknown'} years with ${inputs.balloonYears || 'unknown'} year balloon.`,
    inputs.existingLoanPayment !== undefined ? `Underlying payment to verify: ${formatMoneyForTerm(inputs.existingLoanPayment)} monthly.` : null,
    `Modeled note payment: ${formatMoneyForTerm(inputs.monthlyPayment)} monthly.`,
    `Total modeled monthly carry: ${formatMoneyForTerm(inputs.totalMonthlyPayment)}.`,
  ].filter(Boolean) as string[]

  return terms
}

function buildCreativeGuardrails(inputs: {
  key: CreativeOfferKey
  hasExistingLoanDetails?: boolean
  entryFee: number | null
  monthlyCashFlow: number | null
  targetMonthlyCashFlow: number | null
  exitLoanToValuePercent: number | null
  sellerMonthlySpread?: number | null
}) {
  const guardrails = [
    'Verify title, payoff, taxes, insurance, utilities, occupancy, and repair scope before sending a written offer.',
    inputs.key === 'subject_to' || inputs.key === 'wrap_mortgage'
      ? 'Have a real estate attorney review due-on-sale, servicing, disclosure, and seller-liability language before closing.'
      : null,
    inputs.hasExistingLoanDetails === false ? 'Do not send this structure until the underlying payoff, payment, rate, and remaining term are verified.' : null,
    Number.isFinite(inputs.monthlyCashFlow) && Number.isFinite(inputs.targetMonthlyCashFlow) && Number(inputs.monthlyCashFlow) < Number(inputs.targetMonthlyCashFlow)
      ? 'Monthly cash flow is below target; improve price, rate, amortization, or seller carry terms before sending.'
      : null,
    Number.isFinite(inputs.entryFee) && Number(inputs.entryFee) > 35000
      ? 'Entry fee is heavy; confirm this does not kill assignment spread or operator cash reserves.'
      : null,
    Number.isFinite(inputs.exitLoanToValuePercent) && Number(inputs.exitLoanToValuePercent) > 80
      ? 'Balloon/refi exit is tight; require a stronger discount, longer balloon, or more principal paydown.'
      : null,
    inputs.sellerMonthlySpread !== undefined && Number.isFinite(inputs.sellerMonthlySpread) && Number(inputs.sellerMonthlySpread) < 0
      ? 'Wrap spread is negative; do not pitch a wrap unless the buyer payment or underlying terms change.'
      : null,
  ].filter(Boolean) as string[]

  return guardrails
}

function normalizedExitStrategy(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'not_sure'
  if (normalized.includes('flip')) return 'flip'
  if (normalized.includes('brrrr')) return 'brrrr'
  if (normalized.includes('wholesale')) return 'wholesale'
  if (normalized.includes('wholetail')) return 'wholetail'
  if (normalized.includes('dscr')) return 'dscr_refinance'
  if (normalized.includes('seller')) return 'seller_finance'
  if (normalized.includes('hold')) return 'hold_long_term'
  if (normalized.includes('rental')) return 'rental'
  return normalized
}

function approximateCreditScore(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (!normalized) return null
  if (normalized.includes('740')) return 740
  if (normalized.includes('700')) return 700
  if (normalized.includes('680')) return 680
  if (normalized.includes('660')) return 660
  if (normalized.includes('620')) return 620
  if (normalized.includes('<') || normalized.includes('below') || normalized.includes('sub')) return 580
  return null
}

function stringIncludesOneOf(value: string | null | undefined, patterns: RegExp[]) {
  const normalized = String(value || '')
  return patterns.some((pattern) => pattern.test(normalized))
}

function averageNullable(values: Array<number | null>) {
  const usable = values.filter((value): value is number => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function cleanOptionalString(value?: string | null) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function normalizeComparableSelections(input: PropertyOpportunityInput['selectedComps']) {
  return (input || []).map((comp) => {
    const salePrice = parseCurrencyAmount(comp.salePrice)
    const squareFeet = parseCurrencyAmount(comp.squareFeet)
    const pricePerFoot =
      salePrice !== null && squareFeet !== null && squareFeet > 0
        ? Math.round((salePrice / squareFeet) * 100) / 100
        : null

    return {
      address: cleanOptionalString(comp.address),
      salePrice,
      squareFeet,
      distanceMiles: parseCurrencyAmount(comp.distanceMiles),
      beds: parseCurrencyAmount(comp.beds),
      baths: parseCurrencyAmount(comp.baths),
      notes: cleanOptionalString(comp.notes),
      pricePerFoot,
    }
  })
}

function listingPressureLabel(
  hasListingContext: boolean,
  daysOnMarket: number | null,
  priceCutCount: number | null
): PropertyOpportunityAnalysis['listingContext']['pressureLabel'] {
  if (!hasListingContext) return 'Needs public listing context'
  if ((priceCutCount ?? 0) >= 2 || (daysOnMarket ?? 0) >= 120) return 'Discounted listing'
  if ((daysOnMarket ?? 0) >= 60) return 'Stale listing'
  if ((daysOnMarket ?? 0) >= 15) return 'Active listing'
  return 'Fresh listing'
}

function dealStrengthLabel(score: number): PropertyOpportunityAnalysis['dealStrength']['label'] {
  if (score >= 78) return 'Strong'
  if (score >= 62) return 'Promising'
  if (score >= 42) return 'Watchlist'
  return 'Weak'
}

function dealStrengthScoreWithDealMath(
  score: number,
  dealGrade: PropertyOpportunityAnalysis['dealMath']['grade'],
  assignmentSpread: number | null,
  endBuyerProfit: number | null
) {
  if (dealGrade !== 'RISKY') return bounded(score)

  let maxScore = 58
  if (assignmentSpread !== null && assignmentSpread < 0) maxScore = Math.min(maxScore, 54)
  if (assignmentSpread !== null && assignmentSpread <= -25000) maxScore = Math.min(maxScore, 48)
  if (endBuyerProfit !== null && endBuyerProfit <= 0) maxScore = Math.min(maxScore, 38)

  return bounded(Math.min(score, maxScore))
}

function dealStrengthSummary(
  score: number,
  dealGrade: PropertyOpportunityAnalysis['dealMath']['grade'],
  assignmentSpread: number | null,
  lowCashOnCashReturn = false
) {
  if (lowCashOnCashReturn) {
    return `Cash-on-cash is below the ${MIN_CASH_ON_CASH_RETURN_PERCENT}% VestBlock floor, so this should stay in review unless price, financing, rent, or entry cash improves.`
  }

  if (dealGrade === 'RISKY' && assignmentSpread !== null && assignmentSpread < 0) {
    return 'Assignment math is not protected at the current seller ask; keep it in review until price, ARV, fee, or terms improve.'
  }

  if (score >= 78) return 'The numbers support active review across buyers and capital routes.'
  if (score >= 62) return 'There is enough signal here to keep the deal moving, but the file still needs discipline.'
  if (score >= 42) return 'This is a watchlist deal until pricing, scope, or borrower details improve.'
  return 'The current structure is thin and should be tightened before real routing.'
}

function signalScoreLabel(score: number): PropertyOpportunityAnalysis['signalScore']['label'] {
  if (score >= 78) return 'High-intent signal'
  if (score >= 58) return 'Useful signal'
  if (score >= 36) return 'Thin signal'
  return 'Needs source evidence'
}

function signalScoreSummary(score: number, signals: string[]) {
  if (score >= 78) {
    return `This file has strong source evidence and seller-pressure signals: ${signals.slice(0, 3).join(', ')}.`
  }
  if (score >= 58) return 'There is enough source context to keep researching and route the property with more confidence.'
  if (score >= 36) return 'The file has some useful signals, but it still needs public-record evidence or better listing context before outreach.'
  return 'The file is mostly assumption-driven. Add public records, comps, photos, listing history, or owner/source evidence before routing.'
}

function fundingReadinessLabel(score: number): PropertyOpportunityAnalysis['fundingReadiness']['label'] {
  if (score >= 76) return 'Ready to route'
  if (score >= 58) return 'Needs more file prep'
  if (score >= 40) return 'Needs borrower cleanup'
  return 'Manual review'
}

export function buildPropertyOpportunityAnalysis(
  input: PropertyOpportunityInput,
  estimate: RoughPropertyEstimate
): PropertyOpportunityAnalysis {
  const exitStrategy = normalizedExitStrategy(input.exitStrategy ?? input.preferredSalePath)
  const isRentalStyle = ['rental', 'brrrr', 'dscr_refinance', 'hold_long_term', 'seller_finance'].includes(exitStrategy)
  const isFlipStyle = ['flip', 'brrrr', 'wholetail'].includes(exitStrategy)
  const isWholesaleStyle = ['wholesale'].includes(exitStrategy)

  const selectedComps = normalizeComparableSelections(input.selectedComps)
  const usableComps = selectedComps.filter((comp) => comp.salePrice !== null)
  const compAverageSalePrice = averageNullable(usableComps.map((comp) => comp.salePrice))
  const compAveragePricePerFoot = averageNullable(usableComps.map((comp) => comp.pricePerFoot))
  const manualArv = parseCurrencyAmount(input.afterRepairValue)
  const dealArvMode =
    manualArv !== null
      ? 'MANUAL'
      : usableComps.length > 0
        ? 'COMPS_AVG'
        : estimate.estimateValue !== null
          ? 'BASELINE'
          : 'MANUAL'
  const arv =
    computeArv({
      mode: dealArvMode,
      manualArv: manualArv ?? estimate.estimateValue,
      baselineValue: estimate.estimateValue,
      selectedComps: usableComps,
    }) ?? estimate.estimateValue
  const listingSourceUrl = cleanOptionalString(input.listingSourceUrl)
  const listingStatus = cleanOptionalString(input.listingStatus)
  const daysOnMarket = parseCurrencyAmount(input.daysOnMarket)
  const priceCutCount = parseCurrencyAmount(input.priceCutCount)
  const lastPriceCutAmount = parseCurrencyAmount(input.lastPriceCutAmount)
  const listingNotes = cleanOptionalString(input.listingNotes)
  const hasListingContext = Boolean(
    listingSourceUrl ||
      listingStatus ||
      daysOnMarket !== null ||
      priceCutCount !== null ||
      lastPriceCutAmount !== null ||
      listingNotes
  )
  const listingSignals = [
    daysOnMarket !== null && daysOnMarket >= 120 ? `${daysOnMarket} days on market` : null,
    daysOnMarket !== null && daysOnMarket >= 60 && daysOnMarket < 120 ? `${daysOnMarket} days on market` : null,
    priceCutCount !== null && priceCutCount > 0 ? `${priceCutCount} price ${priceCutCount === 1 ? 'cut' : 'cuts'}` : null,
    lastPriceCutAmount !== null && lastPriceCutAmount >= 5000
      ? `${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(lastPriceCutAmount)} latest reduction`
      : null,
    listingStatus ? `Status: ${listingStatus}` : null,
    listingNotes ? `Notes: ${listingNotes}` : null,
  ].filter(Boolean) as string[]
  const listingPressurePoints =
    (daysOnMarket !== null
      ? daysOnMarket >= 120
        ? 18
        : daysOnMarket >= 60
          ? 10
          : daysOnMarket >= 30
            ? 5
            : 0
      : 0) +
    Math.min(12, Math.max(0, (priceCutCount ?? 0) * 4)) +
    (lastPriceCutAmount !== null
      ? lastPriceCutAmount >= 15000
        ? 8
        : lastPriceCutAmount >= 5000
          ? 4
          : 0
      : 0)
  const repairBudget = parseCurrencyAmount(input.repairBudget)
  const manualAssignmentFee = parseCurrencyAmount(input.assignmentFee)
  const askingPrice = estimate.askingPrice ?? parseCurrencyAmount(input.askingPrice)
  const purchasePrice = askingPrice ?? estimate.estimateValue ?? arv
  const closingCostsInput = parseCurrencyAmount(input.closingCosts)
  const holdingPeriodMonths = parseCurrencyAmount(input.holdingPeriodMonths) ?? (isFlipStyle ? 6 : 0)
  const monthlyRent = parseCurrencyAmount(input.monthlyRentEstimate) ?? estimate.rentEstimate
  const monthlyTaxes = parseCurrencyAmount(input.monthlyTaxes)
  const monthlyInsurance = parseCurrencyAmount(input.monthlyInsurance)
  const monthlyUtilities = parseCurrencyAmount(input.monthlyUtilities) ?? 0
  const propertyManagementPercent = parseCurrencyAmount(input.propertyManagementPercent) ?? (isRentalStyle ? 8 : 0)
  const vacancyPercent = parseCurrencyAmount(input.vacancyPercent) ?? (isRentalStyle ? 5 : 0)
  const maintenancePercent = parseCurrencyAmount(input.maintenancePercent) ?? (isRentalStyle ? 5 : 0)
  const otherMonthlyExpenses = parseCurrencyAmount(input.otherMonthlyExpenses) ?? 0
  const monthlyDebtServiceInput = parseCurrencyAmount(input.monthlyDebtService)
  const downPayment = parseCurrencyAmount(input.downPayment)
  const interestRate = parseCurrencyAmount(input.interestRate) ?? (isFlipStyle ? 11.5 : isRentalStyle ? 7.25 : null)
  const loanTermYears = parseCurrencyAmount(input.loanTermYears) ?? (isRentalStyle ? 30 : isFlipStyle ? 1 : null)
  const points = parseCurrencyAmount(input.points) ?? (isFlipStyle ? 2 : 0)
  const lenderFees = parseCurrencyAmount(input.lenderFees) ?? 0
  const loanToCost = parseCurrencyAmount(input.loanToCost) ?? (isFlipStyle ? 85 : isRentalStyle ? 80 : null)
  const loanToValue = parseCurrencyAmount(input.loanToValue) ?? (isFlipStyle ? 70 : isRentalStyle ? 75 : null)
  const privateMoneyAmount = parseCurrencyAmount(input.privateMoneyAmount) ?? 0
  const gapFundingAmount = parseCurrencyAmount(input.gapFundingAmount) ?? 0
  const operatorCashAvailable = parseCurrencyAmount(input.operatorCashAvailable) ?? downPayment ?? 0
  const creditScore = approximateCreditScore(input.creditScoreRange)
  const entityReady = /active|formed|llc|corp|entity ready/i.test(String(input.entityStatus || ''))
  const experiencedOperator = /4-10|experienced/i.test(String(input.realEstateExperience || ''))
  const documentsText = String(input.documentsAvailable || '')
  const targetMonthlyCashFlow = parseCurrencyAmount(input.targetMonthlyCashFlow) ?? 250
  const creativeDownPaymentInput = parseCurrencyAmount(input.creativeDownPayment)
  const creativeNoteInterestRate = parseCurrencyAmount(input.creativeNoteInterestRate) ?? 6
  const creativeAmortizationYears = parseCurrencyAmount(input.creativeAmortizationYears) ?? 30
  const creativeBalloonYears = parseCurrencyAmount(input.creativeBalloonYears) ?? 7
  const existingLoanInterestRate = parseCurrencyAmount(input.existingLoanInterestRate)
  const existingLoanRemainingTermYears = parseCurrencyAmount(input.existingLoanRemainingTermYears)
  const liensOrTaxes = estimate.liensOrTaxesAmount ?? parseCurrencyAmount(input.liensOrTaxes) ?? 0

  const closingCosts =
    closingCostsInput ??
    (purchasePrice !== null
      ? Math.round(purchasePrice * (isFlipStyle ? 0.035 : isRentalStyle ? 0.025 : 0.02))
      : null)
  const operatingExpenses = calculateOperatingExpenses({
    monthlyRent,
    monthlyTaxes,
    monthlyInsurance,
    monthlyUtilities,
    otherMonthlyExpenses,
    propertyManagementPercent,
    vacancyPercent,
    maintenancePercent,
  })
  const totalProjectCost =
    purchasePrice !== null
      ? Math.round((purchasePrice + (repairBudget || 0) + (closingCosts || 0)) * 100) / 100
      : null
  const collateralValue = isFlipStyle ? arv ?? estimate.estimateValue ?? purchasePrice : estimate.estimateValue ?? purchasePrice ?? arv
  const recommendedLoanAmount = calculateConservativeLoanAmount({
    totalProjectCost,
    collateralValue,
    loanToCostPercent: loanToCost,
    loanToValuePercent: loanToValue,
  })
  const monthlyDebtService =
    monthlyDebtServiceInput ??
    calculateMonthlyMortgagePayment(recommendedLoanAmount, interestRate, loanTermYears)
  const annualDebtService = calculateAnnualDebtService(monthlyDebtService)
  const monthlyCarry =
    (operatingExpenses.total || 0) + (monthlyDebtService || 0)
  const estimatedMonthlyCashFlow = calculateCashFlow(monthlyRent, monthlyCarry)
  const netOperatingIncomeAnnual = calculateNetOperatingIncome(monthlyRent, operatingExpenses.total)
  const grossRentYieldPercent =
    monthlyRent !== null && (arv ?? estimate.estimateValue) !== null
      ? percent(monthlyRent * 12, arv ?? estimate.estimateValue)
      : null
  const dscr = calculateDscr(netOperatingIncomeAnnual, annualDebtService)
  const capRatePercent = calculateCapRate(netOperatingIncomeAnnual, purchasePrice ?? arv ?? estimate.estimateValue)
  const debtYieldPercent = calculateDebtYield(netOperatingIncomeAnnual, recommendedLoanAmount)
  const breakEvenRent = calculateBreakEvenRent(monthlyDebtService, operatingExpenses.total)
  const rentToPriceRatioPercent = calculateRentToPriceRatioPercent(monthlyRent, purchasePrice ?? arv ?? estimate.estimateValue)

  const mao70 = calculateMaxAllowableOffer(arv, repairBudget)
  const conservativeCashReview =
    (arv ?? estimate.estimateValue) !== null
      ? roundToNearest((arv ?? estimate.estimateValue)! * 0.62 - (repairBudget || 0) * 0.35, 1000)
      : null
  const balancedCashReview =
    (arv ?? estimate.estimateValue) !== null
      ? roundToNearest((arv ?? estimate.estimateValue)! * 0.72 - (repairBudget || 0) * 0.25, 1000)
      : null

  const discountToValuePercent =
    askingPrice !== null && (arv ?? estimate.estimateValue) !== null
      ? percent((arv ?? estimate.estimateValue)! - askingPrice, arv ?? estimate.estimateValue)
      : null
  const equityPercent =
    estimate.equityEstimate !== null && (arv ?? estimate.estimateValue) !== null
      ? percent(estimate.equityEstimate, arv ?? estimate.estimateValue)
      : null
  const creativeBasePrice =
    purchasePrice ?? estimate.estimateValue ?? arv ?? balancedCashReview

  const defaultCreativeDownPayment =
    creativeBasePrice !== null
      ? roundToNearest(
          Math.max(
            5000,
            creativeBasePrice *
              (grossRentYieldPercent !== null && grossRentYieldPercent >= 10 ? 0.05 : 0.08)
          ),
          500
        )
      : null
  const creativeDownPayment = creativeDownPaymentInput ?? defaultCreativeDownPayment
  const fixedCreativeClosingBuffer = creativeBasePrice !== null ? 2500 : null
  const paymentCapacityBeforeDebt =
    monthlyRent !== null
      ? Math.max(0, monthlyRent - (operatingExpenses.total || 0) - targetMonthlyCashFlow)
      : null
  const creativeValueAnchor = askingPrice ?? estimate.estimateValue ?? arv

  const sellerFinanceMaxPrice =
    paymentCapacityBeforeDebt !== null && creativeDownPayment !== null
      ? roundToNearest(
          Number(creativeDownPayment) +
            (principalFromPaymentCapacity(
              paymentCapacityBeforeDebt,
              creativeNoteInterestRate,
              creativeAmortizationYears
            ) || 0),
          500
        )
      : null
  const sellerFinanceSuggestedPrice =
    sellerFinanceMaxPrice !== null
      ? creativeValueAnchor !== null
        ? Math.min(creativeValueAnchor, sellerFinanceMaxPrice)
        : sellerFinanceMaxPrice
      : creativeValueAnchor
  const sellerFinanceFinancedBalance =
    sellerFinanceSuggestedPrice !== null && creativeDownPayment !== null
      ? Math.max(0, sellerFinanceSuggestedPrice - creativeDownPayment)
      : null
  const sellerFinanceMonthlyPayment = calculateMonthlyMortgagePayment(
    sellerFinanceFinancedBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears
  )
  const sellerFinanceTotalMonthlyPayment =
    sellerFinanceMonthlyPayment !== null
      ? Math.round((sellerFinanceMonthlyPayment + (operatingExpenses.total || 0)) * 100) / 100
      : null
  const sellerFinanceMonthlyCashFlow =
    monthlyRent !== null && sellerFinanceTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - sellerFinanceTotalMonthlyPayment) * 100) / 100
      : null
  const sellerFinanceBalloonBalance = remainingLoanBalance(
    sellerFinanceFinancedBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const sellerFinanceCashToClose =
    creativeDownPayment !== null
      ? Math.round((creativeDownPayment + liensOrTaxes + (fixedCreativeClosingBuffer || 0)) * 100) / 100
      : null
  const sellerFinanceEntry = calculateCreativeEntryFee({
    cashToClose: sellerFinanceCashToClose,
    repairBudget,
    totalMonthlyPayment: sellerFinanceTotalMonthlyPayment,
  })
  const sellerFinanceExit = balloonExitMetrics({
    propertyValue: arv ?? estimate.estimateValue,
    balloonBalance: sellerFinanceBalloonBalance,
  })

  const existingLoanBalance = estimate.mortgageBalance
  const calculatedExistingLoanPayment =
    existingLoanBalance !== null &&
    existingLoanInterestRate !== null &&
    existingLoanRemainingTermYears !== null
      ? calculateMonthlyMortgagePayment(
          existingLoanBalance,
          existingLoanInterestRate,
          existingLoanRemainingTermYears
        )
      : null
  const existingLoanPayment = monthlyDebtServiceInput ?? calculatedExistingLoanPayment
  const subjectToSellerCarryCapacity =
    paymentCapacityBeforeDebt !== null && existingLoanPayment !== null
      ? Math.max(0, paymentCapacityBeforeDebt - existingLoanPayment)
      : null
  const subjectToSellerCarryMax =
    subjectToSellerCarryCapacity !== null
      ? principalFromPaymentCapacity(
          subjectToSellerCarryCapacity,
          creativeNoteInterestRate,
          creativeAmortizationYears
        )
      : null
  const subjectToMaxPrice =
    existingLoanBalance !== null &&
    creativeDownPayment !== null &&
    subjectToSellerCarryMax !== null
      ? roundToNearest(
          existingLoanBalance + creativeDownPayment + subjectToSellerCarryMax,
          500
        )
      : null
  const subjectToSuggestedPrice =
    subjectToMaxPrice !== null
      ? creativeValueAnchor !== null
        ? Math.min(creativeValueAnchor, subjectToMaxPrice)
        : subjectToMaxPrice
      : creativeValueAnchor
  const subjectToSellerCarryBalance =
    subjectToSuggestedPrice !== null &&
    existingLoanBalance !== null &&
    creativeDownPayment !== null
      ? Math.max(0, subjectToSuggestedPrice - existingLoanBalance - creativeDownPayment)
      : null
  const subjectToSellerCarryPayment = calculateMonthlyMortgagePayment(
    subjectToSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears
  )
  const subjectToTotalMonthlyPayment =
    existingLoanPayment !== null && subjectToSellerCarryPayment !== null
      ? Math.round(
          (existingLoanPayment + subjectToSellerCarryPayment + (operatingExpenses.total || 0)) * 100
        ) / 100
      : null
  const subjectToMonthlyCashFlow =
    monthlyRent !== null && subjectToTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - subjectToTotalMonthlyPayment) * 100) / 100
      : null
  const subjectToBalloonBalance = remainingLoanBalance(
    subjectToSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const subjectToCashToClose =
    creativeDownPayment !== null
      ? Math.round((creativeDownPayment + liensOrTaxes + (fixedCreativeClosingBuffer || 0)) * 100) / 100
      : null
  const subjectToEntry = calculateCreativeEntryFee({
    cashToClose: subjectToCashToClose,
    repairBudget,
    totalMonthlyPayment: subjectToTotalMonthlyPayment,
  })
  const subjectToExit = balloonExitMetrics({
    propertyValue: arv ?? estimate.estimateValue,
    balloonBalance: subjectToBalloonBalance,
    existingLoanBalance,
  })
  const wrapNoteInterestRate =
    existingLoanInterestRate !== null
      ? Math.round(((existingLoanInterestRate + creativeNoteInterestRate) / 2) * 100) / 100
      : creativeNoteInterestRate
  const wrapMaxPrice =
    paymentCapacityBeforeDebt !== null && creativeDownPayment !== null
      ? roundToNearest(
          Number(creativeDownPayment) +
            (principalFromPaymentCapacity(
              paymentCapacityBeforeDebt,
              wrapNoteInterestRate,
              creativeAmortizationYears
            ) || 0),
          500
        )
      : null
  const wrapSuggestedPrice =
    wrapMaxPrice !== null
      ? creativeValueAnchor !== null
        ? Math.min(creativeValueAnchor, wrapMaxPrice)
        : wrapMaxPrice
      : creativeValueAnchor
  const wrapFinancedBalance =
    wrapSuggestedPrice !== null && creativeDownPayment !== null
      ? Math.max(0, wrapSuggestedPrice - creativeDownPayment)
      : null
  const wrapMonthlyPayment = calculateMonthlyMortgagePayment(
    wrapFinancedBalance,
    wrapNoteInterestRate,
    creativeAmortizationYears
  )
  const wrapTotalMonthlyPayment =
    wrapMonthlyPayment !== null
      ? Math.round((wrapMonthlyPayment + (operatingExpenses.total || 0)) * 100) / 100
      : null
  const wrapMonthlyCashFlow =
    monthlyRent !== null && wrapTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - wrapTotalMonthlyPayment) * 100) / 100
      : null
  const wrapBalloonBalance = remainingLoanBalance(
    wrapFinancedBalance,
    wrapNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const wrapCashToClose =
    creativeDownPayment !== null
      ? Math.round((creativeDownPayment + liensOrTaxes + (fixedCreativeClosingBuffer || 0)) * 100) / 100
      : null
  const wrapSellerMonthlySpread =
    wrapMonthlyPayment !== null && existingLoanPayment !== null
      ? Math.round((wrapMonthlyPayment - existingLoanPayment) * 100) / 100
      : null
  const wrapEntry = calculateCreativeEntryFee({
    cashToClose: wrapCashToClose,
    repairBudget,
    totalMonthlyPayment: wrapTotalMonthlyPayment,
  })
  const wrapExit = balloonExitMetrics({
    propertyValue: arv ?? estimate.estimateValue,
    balloonBalance: wrapBalloonBalance,
  })
  const hybridSeniorRate = interestRate ?? 8
  const hybridSeniorTermYears = loanTermYears ?? 30
  const hybridSeniorShare = 0.7
  const hybridSellerShare = 0.3
  const hybridSeniorFactor = paymentFactor(hybridSeniorRate, hybridSeniorTermYears)
  const hybridSellerFactor = paymentFactor(creativeNoteInterestRate, creativeAmortizationYears)
  const hybridPaymentFactor =
    hybridSeniorFactor !== null && hybridSellerFactor !== null
      ? hybridSeniorFactor * hybridSeniorShare + hybridSellerFactor * hybridSellerShare
      : null
  const hybridMaxPrice =
    paymentCapacityBeforeDebt !== null && hybridPaymentFactor !== null && hybridPaymentFactor > 0
      ? roundToNearest(paymentCapacityBeforeDebt / hybridPaymentFactor, 500)
      : null
  const hybridSuggestedPrice =
    hybridMaxPrice !== null
      ? creativeValueAnchor !== null
        ? Math.min(creativeValueAnchor, hybridMaxPrice)
        : hybridMaxPrice
      : creativeValueAnchor
  const hybridSeniorDebt =
    hybridSuggestedPrice !== null ? Math.round(hybridSuggestedPrice * hybridSeniorShare) : null
  const hybridSellerCarryBalance =
    hybridSuggestedPrice !== null ? Math.max(0, Math.round(hybridSuggestedPrice * hybridSellerShare)) : null
  const hybridSeniorPayment = calculateMonthlyMortgagePayment(
    hybridSeniorDebt,
    hybridSeniorRate,
    hybridSeniorTermYears
  )
  const hybridSellerCarryPayment = calculateMonthlyMortgagePayment(
    hybridSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears
  )
  const hybridMonthlyPayment =
    hybridSeniorPayment !== null && hybridSellerCarryPayment !== null
      ? Math.round((hybridSeniorPayment + hybridSellerCarryPayment) * 100) / 100
      : null
  const hybridTotalMonthlyPayment =
    hybridMonthlyPayment !== null
      ? Math.round((hybridMonthlyPayment + (operatingExpenses.total || 0)) * 100) / 100
      : null
  const hybridMonthlyCashFlow =
    monthlyRent !== null && hybridTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - hybridTotalMonthlyPayment) * 100) / 100
      : null
  const hybridSellerBalloonBalance = remainingLoanBalance(
    hybridSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const hybridSeniorBalloonBalance = remainingLoanBalance(
    hybridSeniorDebt,
    hybridSeniorRate,
    hybridSeniorTermYears,
    Math.round(creativeBalloonYears * 12)
  )
  const hybridBalloonBalance =
    hybridSellerBalloonBalance !== null || hybridSeniorBalloonBalance !== null
      ? Math.round((Number(hybridSellerBalloonBalance || 0) + Number(hybridSeniorBalloonBalance || 0)) * 100) / 100
      : null
  const hybridCashToClose =
    fixedCreativeClosingBuffer !== null
      ? Math.round((liensOrTaxes + fixedCreativeClosingBuffer) * 100) / 100
      : null
  const hybridEntry = calculateCreativeEntryFee({
    cashToClose: hybridCashToClose,
    repairBudget,
    totalMonthlyPayment: hybridTotalMonthlyPayment,
  })
  const hybridExit = balloonExitMetrics({
    propertyValue: arv ?? estimate.estimateValue,
    balloonBalance: hybridBalloonBalance,
  })

  const distress = conditionScore(input.propertyCondition)
  const urgency = timelineScore(input.timelineToSell)
  const hasEstimate = estimate.estimateValue !== null
  const hasRent = monthlyRent !== null
  const isTenant = /tenant|rental|leased/i.test(String(input.occupancyStatus || ''))
  const highDebt =
    estimate.ltvEstimate !== null
      ? estimate.ltvEstimate >= 75
      : estimate.equityEstimate !== null
        ? estimate.equityEstimate < 25000
        : false
  const creativeOfferCanMeetTarget =
    (sellerFinanceMonthlyCashFlow !== null && sellerFinanceMonthlyCashFlow >= targetMonthlyCashFlow * 0.8) ||
    (subjectToMonthlyCashFlow !== null && subjectToMonthlyCashFlow >= targetMonthlyCashFlow * 0.8) ||
    (wrapMonthlyCashFlow !== null && wrapMonthlyCashFlow >= targetMonthlyCashFlow * 0.8)
  const creativeOfferNearAsk =
    askingPrice !== null &&
    ((sellerFinanceMaxPrice !== null && sellerFinanceMaxPrice >= askingPrice) ||
      (subjectToMaxPrice !== null && subjectToMaxPrice >= askingPrice) ||
      (wrapMaxPrice !== null && wrapMaxPrice >= askingPrice))

  const fastCashScore = bounded(
    distress * 0.45 +
      urgency * 0.35 +
      (hasEstimate ? 14 : 0) +
      (hasHealthyEquity(estimate) ? 8 : 0) +
      Math.min(8, listingPressurePoints * 0.2)
  )
  const creativeScore = bounded(
    (highDebt ? 42 : 16) +
      (urgency < 65 ? 18 : 8) +
      (hasEstimate ? 12 : 0) +
      (isTenant ? 8 : 0) +
      (creativeOfferCanMeetTarget ? 16 : 0) +
      (creativeOfferNearAsk ? 10 : 0) +
      Math.min(16, Math.round(listingPressurePoints * 0.7))
  )
  const novationScore = bounded(
    (/good|average|excellent|renovated|livable/i.test(String(input.propertyCondition || '')) ? 34 : 14) +
      (discountToValuePercent !== null && discountToValuePercent >= 8 ? 24 : 10) +
      (urgency <= 70 ? 18 : 8) +
      (hasEstimate ? 12 : 0) +
      Math.min(10, Math.round(listingPressurePoints * 0.35))
  )

  const estimatedReserves =
    isRentalStyle && monthlyCarry > 0
      ? Math.round(monthlyCarry * 3)
      : isFlipStyle
        ? Math.round(((monthlyTaxes || 0) + (monthlyInsurance || 0) + monthlyUtilities) * Math.max(holdingPeriodMonths, 0))
        : 0
  const pointsCost =
    recommendedLoanAmount !== null && points !== null
      ? Math.round(recommendedLoanAmount * (points / 100))
      : 0
  const financingCarryCost =
    isFlipStyle && monthlyDebtService !== null
      ? Math.round(monthlyDebtService * Math.max(holdingPeriodMonths, 0))
      : 0
  const sellerFinanceContribution =
    parseCurrencyAmount(input.sellerFinanceAmount) ??
    (exitStrategy === 'seller_finance' ? sellerFinanceFinancedBalance ?? 0 : 0)
  const nonOperatorCapital =
    (recommendedLoanAmount || 0) +
    privateMoneyAmount +
    sellerFinanceContribution +
    gapFundingAmount
  const totalCashNeeded =
    totalProjectCost !== null
      ? Math.round(
          (totalProjectCost +
            estimatedReserves +
            lenderFees +
            pointsCost +
            financingCarryCost +
            liensOrTaxes) *
            100
        ) / 100
      : null
  const operatorCashNeeded =
    totalCashNeeded !== null ? Math.max(0, totalCashNeeded - nonOperatorCapital) : null
  const fundingGap = calculateFundingGap(operatorCashNeeded, operatorCashAvailable)
  const totalCapitalAvailable =
    totalCashNeeded !== null
      ? Math.round((nonOperatorCapital + operatorCashAvailable) * 100) / 100
      : null
  const flipHoldingCosts =
    isFlipStyle
      ? Math.round(((operatingExpenses.total || 0) + (monthlyDebtService || 0)) * Math.max(holdingPeriodMonths, 0))
      : null
  const resaleCosts =
    isFlipStyle && arv !== null ? Math.round(arv * 0.06) : null
  const flipProfit = calculateFlipProfit({
    salePrice: arv,
    purchasePrice,
    rehabCost: repairBudget,
    closingCosts,
    holdingCosts: flipHoldingCosts,
    resaleCosts,
    financingCosts: pointsCost + lenderFees + financingCarryCost,
  })
  const cashOnCashReturnPercent = calculateCashOnCashReturn(
    estimatedMonthlyCashFlow !== null ? estimatedMonthlyCashFlow * 12 : null,
    operatorCashNeeded && operatorCashNeeded > 0 ? operatorCashNeeded : operatorCashAvailable || downPayment || null
  )
  const clearsCashOnCashFloor =
    cashOnCashReturnPercent !== null && cashOnCashReturnPercent >= MIN_CASH_ON_CASH_RETURN_PERCENT
  const lowCashOnCashReturn =
    cashOnCashReturnPercent !== null && cashOnCashReturnPercent < MIN_CASH_ON_CASH_RETURN_PERCENT
  const flipRoiPercent = calculateReturnOnInvestment(
    flipProfit,
    operatorCashNeeded && operatorCashNeeded > 0 ? operatorCashNeeded : operatorCashAvailable || downPayment || null
  )

  const hasBankStatements = stringIncludesOneOf(documentsText, [/bank/i, /statement/i])
  const hasRehabScope = stringIncludesOneOf(documentsText, [/rehab/i, /scope/i, /contractor/i, /bid/i])
  const hasRentSupport = stringIncludesOneOf(documentsText, [/lease/i, /rent roll/i, /rent/i, /section 8/i])
  const hasEntityDocs = stringIncludesOneOf(documentsText, [/operating agreement/i, /ein/i, /entity/i, /llc/i])
  const missingItems = [
    !hasEstimate ? 'Property value / ARV confirmation' : null,
    isRentalStyle && !hasRent ? 'Rent estimate or lease support' : null,
    isFlipStyle && repairBudget === null ? 'Repair budget or rehab scope' : null,
    !isWholesaleStyle && creditScore === null ? 'Borrower credit estimate' : null,
    !isWholesaleStyle && !entityReady ? 'Active entity / LLC status' : null,
    !isWholesaleStyle && !hasBankStatements ? 'Recent bank statements' : null,
    isFlipStyle && !hasRehabScope ? 'Rehab scope or contractor bids' : null,
    isRentalStyle && !hasRentSupport ? 'Lease, rent roll, or rent support' : null,
    !isWholesaleStyle && !hasEntityDocs ? 'Entity docs or EIN notes' : null,
  ].filter(Boolean) as string[]

  const riskFlags = [
    estimate.confidence < 55 ? 'Low ARV confidence' : null,
    rentToPriceRatioPercent !== null && rentToPriceRatioPercent < 0.8 ? 'Weak rent-to-price ratio' : null,
    repairBudget !== null && arv !== null && repairBudget / arv >= 0.22 ? 'Rehab too high' : null,
    estimatedMonthlyCashFlow !== null && estimatedMonthlyCashFlow < 0 ? 'Negative cash flow' : null,
    lowCashOnCashReturn
      ? `Cash-on-cash below ${MIN_CASH_ON_CASH_RETURN_PERCENT}% floor`
      : null,
    dscr !== null && dscr < 1.05 ? 'DSCR below lender threshold' : null,
    vacancyPercent >= 10 ? 'High vacancy assumption' : null,
    flipProfit !== null && flipProfit < 15000 && isFlipStyle ? 'Thin profit spread' : null,
    operatorCashNeeded !== null && operatorCashAvailable < operatorCashNeeded * 0.5 ? 'Too much operator cash required' : null,
    missingItems.length > 0 ? 'Missing documents or borrower details' : null,
    usableComps.length === 0 && manualArv === null ? 'No comparable sales entered' : null,
    exitStrategy === 'not_sure' ? 'No clear exit strategy' : null,
    totalCapitalAvailable !== null && totalCashNeeded !== null && totalCapitalAvailable < totalCashNeeded ? 'Overleveraged capital stack' : null,
  ].filter(Boolean) as string[]

  const sourceSignalText = [
    input.propertyCondition,
    input.occupancyStatus,
    input.timelineToSell,
    input.preferredSalePath,
    input.exitStrategy,
    listingStatus,
    listingNotes,
  ]
    .filter(Boolean)
    .join(' ')
  const sourceSignalFlags = [
    liensOrTaxes > 0 ? 'Lien or tax amount entered' : null,
    stringIncludesOneOf(sourceSignalText, [/tax|delinquen|past.?due/i]) ? 'Tax delinquency language' : null,
    stringIncludesOneOf(sourceSignalText, [/code|violation|unsafe|condemn|blight/i]) ? 'Code or condition language' : null,
    stringIncludesOneOf(sourceSignalText, [/vacant|abandoned|boarded/i]) ? 'Vacancy language' : null,
    stringIncludesOneOf(sourceSignalText, [/foreclosure|sheriff|auction|preforeclosure/i]) ? 'Foreclosure or auction language' : null,
    stringIncludesOneOf(sourceSignalText, [/probate|estate/i]) ? 'Probate or estate language' : null,
    stringIncludesOneOf(sourceSignalText, [/expired|withdrawn|cancelled/i]) ? 'Expired listing language' : null,
    daysOnMarket !== null && daysOnMarket >= 90 ? `${daysOnMarket} days on market` : null,
    priceCutCount !== null && priceCutCount > 0 ? `${priceCutCount} price cut${priceCutCount === 1 ? '' : 's'}` : null,
    listingSourceUrl ? 'Listing/source URL attached' : null,
    usableComps.length ? `${usableComps.length} sold comp${usableComps.length === 1 ? '' : 's'} entered` : null,
    estimate.confidence >= 65 ? 'Baseline estimate confidence is usable' : null,
  ].filter(Boolean) as string[]
  const signalScoreValue = bounded(
    Math.min(24, sourceSignalFlags.length * 6) +
      Math.min(18, usableComps.length * 4) +
      Math.min(16, Math.round(listingPressurePoints * 0.7)) +
      (listingSourceUrl ? 10 : 0) +
      (liensOrTaxes > 0 ? 10 : 0) +
      (hasListingContext ? 8 : 0) +
      Math.min(14, Math.round(estimate.confidence / 7))
  )
  const signalScore = {
    score: signalScoreValue,
    label: signalScoreLabel(signalScoreValue),
    summary: signalScoreSummary(signalScoreValue, sourceSignalFlags),
    signals: sourceSignalFlags,
    nextAction:
      signalScoreValue >= 58
        ? 'Attach source evidence to the deal file, then let the route stack choose outreach and buyer packet language.'
        : 'Add public-record sources, photo/listing evidence, and at least two sold comps before sending or packaging.',
  } satisfies PropertyOpportunityAnalysis['signalScore']

  let recommendedFundingPath: PropertyOpportunityAnalysis['fundingReadiness']['recommendedPath'] = 'Manual review'
  if (isWholesaleStyle) {
    recommendedFundingPath = 'Transactional funding'
  } else if (creditScore !== null && creditScore < 620) {
    recommendedFundingPath = 'Credit prep'
  } else if (!entityReady) {
    recommendedFundingPath = 'Business credit builder'
  } else if (isRentalStyle && dscr !== null && dscr >= 1.1 && (creditScore ?? 680) >= 660 && !lowCashOnCashReturn) {
    recommendedFundingPath = 'DSCR'
  } else if (isFlipStyle && flipProfit !== null && flipProfit >= 15000) {
    recommendedFundingPath = 'Hard money'
  } else if (fundingGap !== null && fundingGap > 0 && hasHealthyEquity(estimate)) {
    recommendedFundingPath = 'Gap funding'
  } else if (hasHealthyEquity(estimate) || creativeScore >= 70) {
    recommendedFundingPath = 'Private money'
  }

  const fundingReadinessScore = bounded(
    (hasEstimate ? 18 : 6) +
      ((isRentalStyle && hasRent) || !isRentalStyle ? 14 : 5) +
      ((isFlipStyle && repairBudget !== null) || !isFlipStyle ? 12 : 4) +
      (creditScore !== null ? (creditScore >= 700 ? 16 : creditScore >= 660 ? 12 : creditScore >= 620 ? 8 : 2) : 3) +
      (entityReady ? 10 : 2) +
      (experiencedOperator ? 6 : 2) +
      (hasBankStatements ? 8 : 0) +
      (hasEntityDocs ? 6 : 0) +
      (dscr !== null ? (dscr >= 1.2 ? 10 : dscr >= 1.05 ? 6 : 0) : 4) +
      (cashOnCashReturnPercent !== null ? (clearsCashOnCashFloor ? 10 : -10) : isRentalStyle ? -4 : 2) +
      (operatorCashNeeded !== null && operatorCashNeeded > 0
        ? Math.max(0, Math.min(12, Math.round((operatorCashAvailable / operatorCashNeeded) * 12)))
        : 8) -
      riskFlags.length * 3
  )

  const lenderScore = bounded(
    (hasEstimate ? 18 : 6) +
      (hasRent ? 16 : 4) +
      (equityPercent !== null && equityPercent >= 20 ? 14 : 5) +
      (dscr !== null && dscr >= 1.1 ? 18 : dscr !== null ? 8 : 4) +
      (cashOnCashReturnPercent !== null ? (clearsCashOnCashFloor ? 12 : -8) : 0) +
      fundingReadinessScore * 0.34
  )
  const builderDisposition = buildBuilderDispositionPlan({
    city: input.city ?? null,
    state: input.state ?? null,
    propertyType: input.propertyType ?? null,
    propertyCondition: input.propertyCondition ?? null,
    squareFeet: input.squareFeet ?? null,
    askingPrice: purchasePrice,
    estimateValue: estimate.estimateValue,
    arv,
    repairBudget,
    mao70,
    balancedCashReview,
    conservativeCashReview,
    flipProfit,
    discountToValuePercent,
  })
  const effectiveAssignmentFee =
    manualAssignmentFee ??
    builderDisposition.suggestedAssignmentFee ??
    (isWholesaleStyle ? 10000 : null)
  const dealRuleType = getDealRuleType(input.propertyType)
  const dealRulePercent = getDealRulePercent(input.propertyType)
  const scorecardArv = arv
  const maoWithFee = computeMao({
    arv: scorecardArv,
    rulePct: dealRulePercent,
    repairCost: repairBudget,
    assignmentFee: effectiveAssignmentFee,
  })
  const assignmentSpread = computeSpread({
    mao: maoWithFee,
    sellerAsk: askingPrice,
  })
  const endBuyerProfit = computeEndBuyerProfit({
    arv: scorecardArv,
    sellerAsk: askingPrice,
    assignmentFee: effectiveAssignmentFee,
    repairCost: repairBudget,
  })
  const dealGrade = gradeDeal({ spread: assignmentSpread })

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
    {
      key: 'builder_disposition' as const,
      label: 'Builder / construction lane',
      score: builderDisposition.score,
      summary:
        builderDisposition.score >= 72
          ? 'Builder-fit opportunity with a workable MAO and assignment lane.'
          : builderDisposition.score >= 48
            ? 'Possible builder lane once scope and pricing are tightened.'
            : 'Not ready for builder routing until the rehab or spread is clearer.',
    },
  ].sort((a, b) => b.score - a.score)

  const sellerFinanceViability = creativeViabilityLabel(
    sellerFinanceMonthlyCashFlow,
    targetMonthlyCashFlow,
    sellerFinanceSuggestedPrice,
    sellerFinanceMaxPrice
  )
  const subjectToViability = creativeViabilityLabel(
    subjectToMonthlyCashFlow,
    targetMonthlyCashFlow,
    subjectToSuggestedPrice,
    subjectToMaxPrice
  )
  const wrapViability = creativeViabilityLabel(
    wrapMonthlyCashFlow,
    targetMonthlyCashFlow,
    wrapSuggestedPrice,
    wrapMaxPrice
  )
  const hybridViability = creativeViabilityLabel(
    hybridMonthlyCashFlow,
    targetMonthlyCashFlow,
    hybridSuggestedPrice,
    hybridMaxPrice
  )
  const sellerFinanceTrustScore = scoreCreativeOffer({
    viability: sellerFinanceViability,
    monthlyCashFlow: sellerFinanceMonthlyCashFlow,
    targetMonthlyCashFlow,
    entryFee: sellerFinanceEntry.entryFee,
    propertyValue: arv ?? estimate.estimateValue,
    suggestedPurchasePrice: sellerFinanceSuggestedPrice,
    balloonEquityCushion: sellerFinanceExit.balloonEquityCushion,
    exitLoanToValuePercent: sellerFinanceExit.exitLoanToValuePercent,
    riskCount: riskFlags.length,
  })
  const subjectToTrustScore = scoreCreativeOffer({
    viability: subjectToViability,
    monthlyCashFlow: subjectToMonthlyCashFlow,
    targetMonthlyCashFlow,
    entryFee: subjectToEntry.entryFee,
    propertyValue: arv ?? estimate.estimateValue,
    suggestedPurchasePrice: subjectToSuggestedPrice,
    balloonEquityCushion: subjectToExit.balloonEquityCushion,
    exitLoanToValuePercent: subjectToExit.exitLoanToValuePercent,
    hasExistingLoanDetails:
      existingLoanBalance !== null && existingLoanPayment !== null && existingLoanInterestRate !== null && existingLoanRemainingTermYears !== null,
    riskCount: riskFlags.length,
  })
  const wrapTrustScore = scoreCreativeOffer({
    viability: wrapViability,
    monthlyCashFlow: wrapMonthlyCashFlow,
    targetMonthlyCashFlow,
    entryFee: wrapEntry.entryFee,
    propertyValue: arv ?? estimate.estimateValue,
    suggestedPurchasePrice: wrapSuggestedPrice,
    balloonEquityCushion: wrapExit.balloonEquityCushion,
    exitLoanToValuePercent: wrapExit.exitLoanToValuePercent,
    hasExistingLoanDetails:
      existingLoanBalance !== null && existingLoanPayment !== null && existingLoanInterestRate !== null && existingLoanRemainingTermYears !== null,
    sellerMonthlySpread: wrapSellerMonthlySpread,
    riskCount: riskFlags.length,
  })
  const hybridTrustScore = scoreCreativeOffer({
    viability: hybridViability,
    monthlyCashFlow: hybridMonthlyCashFlow,
    targetMonthlyCashFlow,
    entryFee: hybridEntry.entryFee,
    propertyValue: arv ?? estimate.estimateValue,
    suggestedPurchasePrice: hybridSuggestedPrice,
    balloonEquityCushion: hybridExit.balloonEquityCushion,
    exitLoanToValuePercent: hybridExit.exitLoanToValuePercent,
    riskCount: riskFlags.length,
  })

  const creativeOffers: PropertyOpportunityAnalysis['creativeOffers'] = [
    {
      key: 'seller_finance',
      label: 'Seller finance',
      viability: sellerFinanceViability,
      summary: creativeSummary(
        'Seller finance',
        sellerFinanceViability,
        askingPrice,
        sellerFinanceMaxPrice
      ),
      caution:
        askingPrice !== null &&
        sellerFinanceMaxPrice !== null &&
        sellerFinanceMaxPrice < askingPrice
          ? 'At the current cash-flow target, the price likely needs to come in below asking.'
          : null,
      trustScore: sellerFinanceTrustScore,
      trustLabel: creativeTrustLabel(sellerFinanceTrustScore),
      terms: buildCreativeTerms({
        label: 'Seller finance',
        suggestedPurchasePrice: sellerFinanceSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        financedBalance: sellerFinanceFinancedBalance,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: sellerFinanceMonthlyPayment,
        totalMonthlyPayment: sellerFinanceTotalMonthlyPayment,
      }),
      guardrails: buildCreativeGuardrails({
        key: 'seller_finance',
        entryFee: sellerFinanceEntry.entryFee,
        monthlyCashFlow: sellerFinanceMonthlyCashFlow,
        targetMonthlyCashFlow,
        exitLoanToValuePercent: sellerFinanceExit.exitLoanToValuePercent,
      }),
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: sellerFinanceMaxPrice,
        suggestedPurchasePrice: sellerFinanceSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        cashToClose: sellerFinanceCashToClose,
        entryFee: sellerFinanceEntry.entryFee,
        arrearsAndLiens: liensOrTaxes,
        closingBuffer: fixedCreativeClosingBuffer,
        repairReserve: sellerFinanceEntry.repairReserve,
        operatingReserve: sellerFinanceEntry.operatingReserve,
        financedBalance: sellerFinanceFinancedBalance,
        seniorDebt: null,
        sellerCarryBalance: sellerFinanceFinancedBalance,
        existingLoanBalance: null,
        existingLoanPayment: null,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: sellerFinanceMonthlyPayment,
        totalMonthlyPayment: sellerFinanceTotalMonthlyPayment,
        estimatedMonthlyCashFlow: sellerFinanceMonthlyCashFlow,
        paymentSpread: sellerFinanceMonthlyCashFlow,
        sellerMonthlySpread: null,
        balloonBalance: sellerFinanceBalloonBalance,
        balloonEquityCushion: sellerFinanceExit.balloonEquityCushion,
        exitLoanToValuePercent: sellerFinanceExit.exitLoanToValuePercent,
      },
    },
    {
      key: 'subject_to',
      label: 'Subject-to + seller carry',
      viability: subjectToViability,
      summary: creativeSummary(
        'Subject-to',
        subjectToViability,
        askingPrice,
        subjectToMaxPrice
      ),
      caution:
        existingLoanBalance === null
          ? 'Add the seller payoff or mortgage balance to size a subject-to structure.'
          : askingPrice !== null &&
              subjectToMaxPrice !== null &&
              subjectToMaxPrice < askingPrice
            ? 'The existing loan and carry capacity do not support full asking at the target spread.'
            : null,
      trustScore: subjectToTrustScore,
      trustLabel: creativeTrustLabel(subjectToTrustScore),
      terms: buildCreativeTerms({
        label: 'Subject-to',
        suggestedPurchasePrice: subjectToSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        financedBalance: subjectToSellerCarryBalance,
        sellerCarryBalance: subjectToSellerCarryBalance,
        existingLoanPayment,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: subjectToSellerCarryPayment,
        totalMonthlyPayment: subjectToTotalMonthlyPayment,
      }),
      guardrails: buildCreativeGuardrails({
        key: 'subject_to',
        hasExistingLoanDetails:
          existingLoanBalance !== null && existingLoanPayment !== null && existingLoanInterestRate !== null && existingLoanRemainingTermYears !== null,
        entryFee: subjectToEntry.entryFee,
        monthlyCashFlow: subjectToMonthlyCashFlow,
        targetMonthlyCashFlow,
        exitLoanToValuePercent: subjectToExit.exitLoanToValuePercent,
      }),
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: subjectToMaxPrice,
        suggestedPurchasePrice: subjectToSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        cashToClose: subjectToCashToClose,
        entryFee: subjectToEntry.entryFee,
        arrearsAndLiens: liensOrTaxes,
        closingBuffer: fixedCreativeClosingBuffer,
        repairReserve: subjectToEntry.repairReserve,
        operatingReserve: subjectToEntry.operatingReserve,
        financedBalance: subjectToSellerCarryBalance,
        seniorDebt: existingLoanBalance,
        sellerCarryBalance: subjectToSellerCarryBalance,
        existingLoanBalance,
        existingLoanPayment,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: subjectToSellerCarryPayment,
        totalMonthlyPayment: subjectToTotalMonthlyPayment,
        estimatedMonthlyCashFlow: subjectToMonthlyCashFlow,
        paymentSpread: subjectToMonthlyCashFlow,
        sellerMonthlySpread: null,
        balloonBalance: subjectToBalloonBalance,
        balloonEquityCushion: subjectToExit.balloonEquityCushion,
        exitLoanToValuePercent: subjectToExit.exitLoanToValuePercent,
      },
    },
    {
      key: 'wrap_mortgage',
      label: 'Wrap mortgage',
      viability: wrapViability,
      summary: creativeSummary(
        'Wrap mortgage',
        wrapViability,
        askingPrice,
        wrapMaxPrice
      ),
      caution:
        existingLoanBalance === null
          ? 'Add the existing payoff and underlying loan terms to stress-test a true wrap structure.'
          : wrapSellerMonthlySpread !== null && wrapSellerMonthlySpread < 0
            ? 'The modeled wrap payment is below the underlying payment. Do not pitch a wrap until payment spread is positive.'
            : askingPrice !== null && wrapMaxPrice !== null && wrapMaxPrice < askingPrice
              ? 'The wrap note still needs a lower price or softer seller terms to hit the cash-flow target.'
              : null,
      trustScore: wrapTrustScore,
      trustLabel: creativeTrustLabel(wrapTrustScore),
      terms: buildCreativeTerms({
        label: 'Wrap mortgage',
        suggestedPurchasePrice: wrapSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        financedBalance: wrapFinancedBalance,
        existingLoanPayment,
        noteRatePercent: wrapNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: wrapMonthlyPayment,
        totalMonthlyPayment: wrapTotalMonthlyPayment,
      }),
      guardrails: buildCreativeGuardrails({
        key: 'wrap_mortgage',
        hasExistingLoanDetails:
          existingLoanBalance !== null && existingLoanPayment !== null && existingLoanInterestRate !== null && existingLoanRemainingTermYears !== null,
        entryFee: wrapEntry.entryFee,
        monthlyCashFlow: wrapMonthlyCashFlow,
        targetMonthlyCashFlow,
        exitLoanToValuePercent: wrapExit.exitLoanToValuePercent,
        sellerMonthlySpread: wrapSellerMonthlySpread,
      }),
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: wrapMaxPrice,
        suggestedPurchasePrice: wrapSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        cashToClose: wrapCashToClose,
        entryFee: wrapEntry.entryFee,
        arrearsAndLiens: liensOrTaxes,
        closingBuffer: fixedCreativeClosingBuffer,
        repairReserve: wrapEntry.repairReserve,
        operatingReserve: wrapEntry.operatingReserve,
        financedBalance: wrapFinancedBalance,
        seniorDebt: existingLoanBalance,
        sellerCarryBalance: wrapFinancedBalance,
        existingLoanBalance,
        existingLoanPayment,
        noteRatePercent: wrapNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: wrapMonthlyPayment,
        totalMonthlyPayment: wrapTotalMonthlyPayment,
        estimatedMonthlyCashFlow: wrapMonthlyCashFlow,
        paymentSpread: wrapMonthlyCashFlow,
        sellerMonthlySpread: wrapSellerMonthlySpread,
        balloonBalance: wrapBalloonBalance,
        balloonEquityCushion: wrapExit.balloonEquityCushion,
        exitLoanToValuePercent: wrapExit.exitLoanToValuePercent,
      },
    },
    {
      key: 'hybrid_morby',
      label: 'Hybrid seller-carry stack',
      viability: hybridViability,
      summary:
        hybridViability === 'Meets target'
          ? 'Hybrid terms can support a higher headline price by pairing senior debt with a seller-financed down-payment note.'
          : hybridViability === 'Borderline'
            ? 'Hybrid terms may work if the seller accepts carryback and the senior debt stays disciplined.'
            : 'Hybrid terms need a lower price, longer amortization, or softer rate before they are safe to pitch.',
      caution:
        hybridMaxPrice !== null && askingPrice !== null && hybridMaxPrice < askingPrice
          ? 'The hybrid stack does not support full asking at the target cash-flow spread.'
          : null,
      trustScore: hybridTrustScore,
      trustLabel: creativeTrustLabel(hybridTrustScore),
      terms: buildCreativeTerms({
        label: 'Hybrid',
        suggestedPurchasePrice: hybridSuggestedPrice,
        cashToSellerNow: 0,
        financedBalance: hybridSuggestedPrice,
        seniorDebt: hybridSeniorDebt,
        sellerCarryBalance: hybridSellerCarryBalance,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: hybridSellerCarryPayment,
        totalMonthlyPayment: hybridTotalMonthlyPayment,
      }),
      guardrails: buildCreativeGuardrails({
        key: 'hybrid_morby',
        entryFee: hybridEntry.entryFee,
        monthlyCashFlow: hybridMonthlyCashFlow,
        targetMonthlyCashFlow,
        exitLoanToValuePercent: hybridExit.exitLoanToValuePercent,
      }),
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: hybridMaxPrice,
        suggestedPurchasePrice: hybridSuggestedPrice,
        cashToSellerNow: 0,
        cashToClose: hybridCashToClose,
        entryFee: hybridEntry.entryFee,
        arrearsAndLiens: liensOrTaxes,
        closingBuffer: fixedCreativeClosingBuffer,
        repairReserve: hybridEntry.repairReserve,
        operatingReserve: hybridEntry.operatingReserve,
        financedBalance: hybridSuggestedPrice,
        seniorDebt: hybridSeniorDebt,
        sellerCarryBalance: hybridSellerCarryBalance,
        existingLoanBalance: null,
        existingLoanPayment: null,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: hybridSellerCarryPayment,
        totalMonthlyPayment: hybridTotalMonthlyPayment,
        estimatedMonthlyCashFlow: hybridMonthlyCashFlow,
        paymentSpread: hybridMonthlyCashFlow,
        sellerMonthlySpread: null,
        balloonBalance: hybridBalloonBalance,
        balloonEquityCushion: hybridExit.balloonEquityCushion,
        exitLoanToValuePercent: hybridExit.exitLoanToValuePercent,
      },
    },
  ]

  const buyerInterestScore = bounded(
    (hasEstimate ? 26 : 8) +
      Math.max(fastCashScore, creativeScore, novationScore) * 0.42 +
      (discountToValuePercent !== null && discountToValuePercent > 10 ? 12 : 4) +
      (input.city && input.state ? 8 : 0) +
      Math.min(10, usableComps.length * 3)
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

  const rawDealStrengthScore = bounded(
    (Math.min(20, Math.max(0, ((discountToValuePercent ?? equityPercent ?? 0) / 20) * 20))) +
      (estimatedMonthlyCashFlow !== null
        ? Math.min(
            clearsCashOnCashFloor || cashOnCashReturnPercent === null ? 15 : 7,
            Math.max(0, (estimatedMonthlyCashFlow / Math.max(targetMonthlyCashFlow, 1)) * 10 + 5)
          )
        : 4) +
      (cashOnCashReturnPercent !== null
        ? clearsCashOnCashFloor
          ? Math.min(12, Math.max(0, ((cashOnCashReturnPercent - MIN_CASH_ON_CASH_RETURN_PERCENT) / 12) * 8 + 4))
          : -14
        : isRentalStyle
          ? -4
          : 0) +
      (Math.min(10, Math.max(0, ((rentToPriceRatioPercent ?? 0) / 1.2) * 10))) +
      (repairBudget !== null && arv !== null
        ? Math.min(10, Math.max(0, 10 - (repairBudget / Math.max(arv, 1)) * 25))
        : 5) +
      Math.round(fundingReadinessScore * 0.15) +
      (exitStrategy !== 'not_sure' ? 10 : 4) +
      Math.min(10, Math.round(estimate.confidence / 10)) +
      Math.min(8, usableComps.length * 2) +
      Math.max(0, 10 - riskFlags.length * 2)
  )
  const dealStrengthScoreBeforeCashOnCash = dealStrengthScoreWithDealMath(
    rawDealStrengthScore,
    dealGrade,
    assignmentSpread,
    endBuyerProfit
  )
  const dealStrengthScore = lowCashOnCashReturn
    ? Math.min(dealStrengthScoreBeforeCashOnCash, 58)
    : dealStrengthScoreBeforeCashOnCash

  const strengths = [
    discountToValuePercent !== null && discountToValuePercent >= 12 ? 'Price sits well below rough value' : null,
    estimatedMonthlyCashFlow !== null && estimatedMonthlyCashFlow >= targetMonthlyCashFlow && (cashOnCashReturnPercent === null || clearsCashOnCashFloor)
      ? 'Monthly cash flow clears the target'
      : null,
    clearsCashOnCashFloor ? `Cash-on-cash clears the ${MIN_CASH_ON_CASH_RETURN_PERCENT}% floor` : null,
    dscr !== null && dscr >= 1.15 ? 'Debt coverage is lender friendly' : null,
    flipProfit !== null && flipProfit >= 25000 ? 'Projected flip spread is healthy' : null,
    fundingReadinessScore >= 70 ? 'File looks ready for capital review' : null,
    hasHealthyEquity(estimate) ? 'Seller equity appears workable' : null,
    usableComps.length >= 2 ? `${usableComps.length} comparable sales support the ARV` : null,
  ].filter(Boolean) as string[]

  const capitalStackNotes = [
    recommendedFundingPath === 'DSCR' ? 'Route to DSCR review once rent support and borrower file are confirmed.' : null,
    recommendedFundingPath === 'Hard money' ? 'Use senior leverage first, then keep private money and seller carry as gap coverage.' : null,
    fundingGap !== null && fundingGap > 0 ? 'There is still an uncovered capital gap at the current assumptions.' : null,
    operatorCashNeeded !== null && operatorCashNeeded <= operatorCashAvailable ? 'Current operator cash looks adequate for the modeled structure.' : null,
    exitStrategy === 'seller_finance' ? 'Creative carry can reduce cash needed if payoff and title are clean.' : null,
    builderDisposition.score >= 72 ? 'Builder packet and assignment draft are worth preparing if the seller wants speed.' : null,
  ].filter(Boolean) as string[]

  const topRoute = routeFit[0]
  const nextSteps = [
    'Verify ownership, payoff, liens, taxes, and property condition before any offer or routing.',
    usableComps.length === 0 ? 'Add at least two recent sold comps so the ARV stops leaning on the baseline estimate.' : null,
    hasListingContext ? 'Use the public listing context to confirm photo condition, pricing history, and seller pressure before outreach.' : null,
    topRoute ? `Start with ${topRoute.label.toLowerCase()} and keep the other paths available until the seller goal is clear.` : null,
    `Prepare the file for ${recommendedFundingPath.toLowerCase()} review with the missing items cleared first.`,
    builderDisposition.score >= 60
      ? 'Collect a builder buy box before seller outreach so the right neighborhoods, lot rules, and rehab tolerance are already defined.'
      : null,
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
      monthlyOperatingExpenses: operatingExpenses.total,
      annualDebtService,
      netOperatingIncomeAnnual,
      capRatePercent,
      cashOnCashReturnPercent,
      debtYieldPercent,
      breakEvenRent,
      rentToPriceRatioPercent,
      flipProfit,
      flipRoiPercent,
      recommendedLoanAmount,
      totalProjectCost,
      totalCashNeeded,
      fundingGap,
    },
    dealMath: {
      arvMode: dealArvMode,
      ruleType: dealRuleType,
      rulePercent: dealRulePercent,
      assignmentFee: effectiveAssignmentFee,
      mao: maoWithFee,
      sellerAsk: askingPrice,
      spread: assignmentSpread,
      endBuyerProfit,
      grade: dealGrade,
    },
    comparables: {
      usedCount: usableComps.length,
      averageSalePrice: compAverageSalePrice !== null ? Math.round(compAverageSalePrice) : null,
      averagePricePerFoot:
        compAveragePricePerFoot !== null ? Math.round(compAveragePricePerFoot * 100) / 100 : null,
      selected: selectedComps,
    },
    listingContext: {
      sourceUrl: listingSourceUrl,
      status: listingStatus,
      daysOnMarket,
      priceCutCount,
      lastPriceCutAmount,
      pressureLabel: hasListingContext
        ? listingStatus && /off market|private|unlisted/i.test(listingStatus)
          ? 'Off-market or private'
          : listingPressureLabel(hasListingContext, daysOnMarket, priceCutCount)
        : 'Needs public listing context',
      summary: !hasListingContext
        ? 'Add public listing signals like days on market or price cuts to improve screening.'
        : listingPressurePoints >= 18
          ? 'The public listing trail shows visible pressure, which can support creative and follow-up strategy.'
          : listingPressurePoints >= 8
            ? 'There is enough public listing movement here to sharpen pricing and seller-pressure reads.'
            : 'Public listing context is present, but it is not yet showing strong distress or pricing pressure.',
      signals: listingSignals,
    },
    dealStrength: {
      score: dealStrengthScore,
      label: dealStrengthLabel(dealStrengthScore),
      summary: dealStrengthSummary(dealStrengthScore, dealGrade, assignmentSpread, lowCashOnCashReturn),
      strengths,
    },
    signalScore,
    fundingReadiness: {
      score: fundingReadinessScore,
      label: fundingReadinessLabel(fundingReadinessScore),
      recommendedPath: recommendedFundingPath,
      summary:
        recommendedFundingPath === 'DSCR'
          ? 'The deal reads like a rental or hold opportunity that can move toward a DSCR-style capital review.'
          : recommendedFundingPath === 'Hard money'
            ? 'The spread and project shape point toward a hard-money style acquisition and rehab path.'
            : recommendedFundingPath === 'Gap funding'
              ? 'The deal looks workable, but the current structure still needs a gap solution.'
              : recommendedFundingPath === 'Private money'
                ? 'Equity and flexibility are better than the borrower profile, so a private-capital conversation fits first.'
                : recommendedFundingPath === 'Business credit builder'
                  ? 'The file needs entity and document cleanup before serious lender routing.'
                  : recommendedFundingPath === 'Credit prep'
                    ? 'Borrower readiness is the first blocker, not the deal itself.'
                    : recommendedFundingPath === 'Transactional funding'
                      ? 'This reads like a wholesale-style file that needs short-duration transactional capital.'
                      : 'This needs a manual capital review before the platform can route it confidently.',
      missingItems,
    },
    capitalStack: {
      totalProjectCost,
      seniorDebt: recommendedLoanAmount,
      privateMoney: privateMoneyAmount || null,
      sellerFinance: sellerFinanceContribution || null,
      gapFunding: gapFundingAmount || null,
      operatorCash: operatorCashAvailable || null,
      estimatedReserves: estimatedReserves || null,
      totalCapitalAvailable,
      fundingGap,
      notes: capitalStackNotes,
    },
    riskFlags,
    creativeOffers,
    routeFit,
    builderDisposition,
    buyerInterest,
    nextSteps,
    disclaimer:
      'VestBlock provides informational analysis, deal estimates, funding readiness guidance, and referral routing support. VestBlock does not guarantee funding, approval, property value, rental income, profit, or investment performance. All property data, valuations, rents, comps, and projections must be independently verified before making financial decisions.',
  }
}
