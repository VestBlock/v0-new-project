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
  targetMonthlyCashFlow?: string | number | null
  creativeDownPayment?: string | number | null
  creativeNoteInterestRate?: string | number | null
  creativeAmortizationYears?: string | number | null
  creativeBalloonYears?: string | number | null
  existingLoanInterestRate?: string | number | null
  existingLoanRemainingTermYears?: string | number | null
}

export type CreativeOfferKey = 'seller_finance' | 'subject_to'

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
  creativeOffers: Array<{
    key: CreativeOfferKey
    label: string
    viability: 'Meets target' | 'Borderline' | 'Below target' | 'Needs more inputs'
    summary: string
    caution: string | null
    metrics: {
      targetMonthlyCashFlow: number | null
      maxPriceToHitTargetCashFlow: number | null
      suggestedPurchasePrice: number | null
      cashToSellerNow: number | null
      cashToClose: number | null
      financedBalance: number | null
      existingLoanBalance: number | null
      existingLoanPayment: number | null
      noteRatePercent: number | null
      amortizationYears: number | null
      balloonYears: number | null
      monthlyPayment: number | null
      totalMonthlyPayment: number | null
      estimatedMonthlyCashFlow: number | null
      balloonBalance: number | null
    }
  }>
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

function monthlyPayment(principal: number | null, annualRatePercent: number | null, amortizationYears: number | null) {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRatePercent) ||
    !Number.isFinite(amortizationYears) ||
    Number(principal) <= 0 ||
    Number(amortizationYears) <= 0
  ) {
    return null
  }

  const loanPrincipal = Number(principal)
  const totalPayments = Math.max(1, Math.round(Number(amortizationYears) * 12))
  const monthlyRate = Math.max(0, Number(annualRatePercent)) / 100 / 12

  if (monthlyRate === 0) {
    return Math.round((loanPrincipal / totalPayments) * 100) / 100
  }

  const payment =
    (loanPrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalPayments))

  return Math.round(payment * 100) / 100
}

function remainingBalanceAfterPayments(
  principal: number | null,
  annualRatePercent: number | null,
  amortizationYears: number | null,
  paymentsMade: number
) {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRatePercent) ||
    !Number.isFinite(amortizationYears) ||
    Number(principal) <= 0 ||
    Number(amortizationYears) <= 0 ||
    paymentsMade < 0
  ) {
    return null
  }

  const loanPrincipal = Number(principal)
  const totalPayments = Math.max(1, Math.round(Number(amortizationYears) * 12))
  const completedPayments = Math.min(totalPayments, Math.round(paymentsMade))
  const monthlyRate = Math.max(0, Number(annualRatePercent)) / 100 / 12

  if (completedPayments >= totalPayments) return 0

  if (monthlyRate === 0) {
    const remaining = loanPrincipal * (1 - completedPayments / totalPayments)
    return Math.max(0, Math.round(remaining * 100) / 100)
  }

  const payment = monthlyPayment(loanPrincipal, annualRatePercent, amortizationYears)
  if (!Number.isFinite(payment)) return null

  const remaining =
    loanPrincipal * Math.pow(1 + monthlyRate, completedPayments) -
    Number(payment) * ((Math.pow(1 + monthlyRate, completedPayments) - 1) / monthlyRate)

  return Math.max(0, Math.round(remaining * 100) / 100)
}

function principalFromAffordablePayment(
  monthlyAmount: number | null,
  annualRatePercent: number | null,
  amortizationYears: number | null
) {
  if (
    !Number.isFinite(monthlyAmount) ||
    !Number.isFinite(annualRatePercent) ||
    !Number.isFinite(amortizationYears) ||
    Number(monthlyAmount) <= 0 ||
    Number(amortizationYears) <= 0
  ) {
    return null
  }

  const payment = Number(monthlyAmount)
  const totalPayments = Math.max(1, Math.round(Number(amortizationYears) * 12))
  const monthlyRate = Math.max(0, Number(annualRatePercent)) / 100 / 12

  if (monthlyRate === 0) {
    return Math.round(payment * totalPayments * 100) / 100
  }

  const principal =
    payment * ((1 - Math.pow(1 + monthlyRate, -totalPayments)) / monthlyRate)

  return Math.round(principal * 100) / 100
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
  const targetMonthlyCashFlow = parseCurrencyAmount(input.targetMonthlyCashFlow) ?? 250
  const creativeDownPaymentInput = parseCurrencyAmount(input.creativeDownPayment)
  const creativeNoteInterestRate = parseCurrencyAmount(input.creativeNoteInterestRate) ?? 6
  const creativeAmortizationYears = parseCurrencyAmount(input.creativeAmortizationYears) ?? 30
  const creativeBalloonYears = parseCurrencyAmount(input.creativeBalloonYears) ?? 7
  const existingLoanInterestRate = parseCurrencyAmount(input.existingLoanInterestRate)
  const existingLoanRemainingTermYears = parseCurrencyAmount(input.existingLoanRemainingTermYears)
  const liensOrTaxes = estimate.liensOrTaxesAmount ?? parseCurrencyAmount(input.liensOrTaxes) ?? 0
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
  const creativeBasePrice =
    askingPrice ??
    estimate.estimateValue ??
    arv ??
    balancedCashReview

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
      ? Math.max(0, monthlyRent - (monthlyTaxes || 0) - (monthlyInsurance || 0) - targetMonthlyCashFlow)
      : null

  const sellerFinanceMaxPrice =
    paymentCapacityBeforeDebt !== null && creativeDownPayment !== null
      ? roundToNearest(
          Number(creativeDownPayment) +
            (principalFromAffordablePayment(
              paymentCapacityBeforeDebt,
              creativeNoteInterestRate,
              creativeAmortizationYears
            ) || 0),
          500
        )
      : null
  const sellerFinanceSuggestedPrice =
    sellerFinanceMaxPrice !== null
      ? askingPrice !== null
        ? Math.min(askingPrice, sellerFinanceMaxPrice)
        : sellerFinanceMaxPrice
      : askingPrice
  const sellerFinanceFinancedBalance =
    sellerFinanceSuggestedPrice !== null && creativeDownPayment !== null
      ? Math.max(0, sellerFinanceSuggestedPrice - creativeDownPayment)
      : null
  const sellerFinanceMonthlyPayment = monthlyPayment(
    sellerFinanceFinancedBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears
  )
  const sellerFinanceTotalMonthlyPayment =
    sellerFinanceMonthlyPayment !== null
      ? Math.round(
          (sellerFinanceMonthlyPayment + (monthlyTaxes || 0) + (monthlyInsurance || 0)) * 100
        ) / 100
      : null
  const sellerFinanceMonthlyCashFlow =
    monthlyRent !== null && sellerFinanceTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - sellerFinanceTotalMonthlyPayment) * 100) / 100
      : null
  const sellerFinanceBalloonBalance = remainingBalanceAfterPayments(
    sellerFinanceFinancedBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const sellerFinanceCashToClose =
    creativeDownPayment !== null
      ? Math.round((creativeDownPayment + liensOrTaxes + (fixedCreativeClosingBuffer || 0)) * 100) / 100
      : null

  const existingLoanBalance = estimate.mortgageBalance
  const calculatedExistingLoanPayment =
    existingLoanBalance !== null &&
    existingLoanInterestRate !== null &&
    existingLoanRemainingTermYears !== null
      ? monthlyPayment(
          existingLoanBalance,
          existingLoanInterestRate,
          existingLoanRemainingTermYears
        )
      : null
  const existingLoanPayment = monthlyDebtService ?? calculatedExistingLoanPayment
  const subjectToSellerCarryCapacity =
    paymentCapacityBeforeDebt !== null && existingLoanPayment !== null
      ? Math.max(0, paymentCapacityBeforeDebt - existingLoanPayment)
      : null
  const subjectToSellerCarryMax =
    subjectToSellerCarryCapacity !== null
      ? principalFromAffordablePayment(
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
      ? askingPrice !== null
        ? Math.min(askingPrice, subjectToMaxPrice)
        : subjectToMaxPrice
      : askingPrice
  const subjectToSellerCarryBalance =
    subjectToSuggestedPrice !== null &&
    existingLoanBalance !== null &&
    creativeDownPayment !== null
      ? Math.max(0, subjectToSuggestedPrice - existingLoanBalance - creativeDownPayment)
      : null
  const subjectToSellerCarryPayment = monthlyPayment(
    subjectToSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears
  )
  const subjectToTotalMonthlyPayment =
    existingLoanPayment !== null && subjectToSellerCarryPayment !== null
      ? Math.round(
          (existingLoanPayment +
            subjectToSellerCarryPayment +
            (monthlyTaxes || 0) +
            (monthlyInsurance || 0)) *
            100
        ) / 100
      : null
  const subjectToMonthlyCashFlow =
    monthlyRent !== null && subjectToTotalMonthlyPayment !== null
      ? Math.round((monthlyRent - subjectToTotalMonthlyPayment) * 100) / 100
      : null
  const subjectToBalloonBalance = remainingBalanceAfterPayments(
    subjectToSellerCarryBalance,
    creativeNoteInterestRate,
    creativeAmortizationYears,
    Math.round(creativeBalloonYears * 12)
  )
  const subjectToCashToClose =
    creativeDownPayment !== null
      ? Math.round((creativeDownPayment + liensOrTaxes + (fixedCreativeClosingBuffer || 0)) * 100) / 100
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
  const creativeOfferCanMeetTarget =
    (sellerFinanceMonthlyCashFlow !== null && sellerFinanceMonthlyCashFlow >= targetMonthlyCashFlow * 0.8) ||
    (subjectToMonthlyCashFlow !== null && subjectToMonthlyCashFlow >= targetMonthlyCashFlow * 0.8)
  const creativeOfferNearAsk =
    askingPrice !== null &&
    ((sellerFinanceMaxPrice !== null && sellerFinanceMaxPrice >= askingPrice) ||
      (subjectToMaxPrice !== null && subjectToMaxPrice >= askingPrice))

  const fastCashScore = bounded(distress * 0.45 + urgency * 0.35 + (hasEstimate ? 14 : 0) + (hasHealthyEquity(estimate) ? 8 : 0))
  const creativeScore = bounded(
    (highDebt ? 42 : 16) +
      (urgency < 65 ? 18 : 8) +
      (hasEstimate ? 12 : 0) +
      (isTenant ? 8 : 0) +
      (creativeOfferCanMeetTarget ? 16 : 0) +
      (creativeOfferNearAsk ? 10 : 0)
  )
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

  const creativeOffers: PropertyOpportunityAnalysis['creativeOffers'] = [
    {
      key: 'seller_finance',
      label: 'Seller finance',
      viability: creativeViabilityLabel(
        sellerFinanceMonthlyCashFlow,
        targetMonthlyCashFlow,
        sellerFinanceSuggestedPrice,
        sellerFinanceMaxPrice
      ),
      summary: creativeSummary(
        'Seller finance',
        creativeViabilityLabel(
          sellerFinanceMonthlyCashFlow,
          targetMonthlyCashFlow,
          sellerFinanceSuggestedPrice,
          sellerFinanceMaxPrice
        ),
        askingPrice,
        sellerFinanceMaxPrice
      ),
      caution:
        askingPrice !== null &&
        sellerFinanceMaxPrice !== null &&
        sellerFinanceMaxPrice < askingPrice
          ? 'At the current cash-flow target, the price likely needs to come in below asking.'
          : null,
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: sellerFinanceMaxPrice,
        suggestedPurchasePrice: sellerFinanceSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        cashToClose: sellerFinanceCashToClose,
        financedBalance: sellerFinanceFinancedBalance,
        existingLoanBalance: null,
        existingLoanPayment: null,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: sellerFinanceMonthlyPayment,
        totalMonthlyPayment: sellerFinanceTotalMonthlyPayment,
        estimatedMonthlyCashFlow: sellerFinanceMonthlyCashFlow,
        balloonBalance: sellerFinanceBalloonBalance,
      },
    },
    {
      key: 'subject_to',
      label: 'Subject-to + seller carry',
      viability: creativeViabilityLabel(
        subjectToMonthlyCashFlow,
        targetMonthlyCashFlow,
        subjectToSuggestedPrice,
        subjectToMaxPrice
      ),
      summary: creativeSummary(
        'Subject-to',
        creativeViabilityLabel(
          subjectToMonthlyCashFlow,
          targetMonthlyCashFlow,
          subjectToSuggestedPrice,
          subjectToMaxPrice
        ),
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
      metrics: {
        targetMonthlyCashFlow,
        maxPriceToHitTargetCashFlow: subjectToMaxPrice,
        suggestedPurchasePrice: subjectToSuggestedPrice,
        cashToSellerNow: creativeDownPayment,
        cashToClose: subjectToCashToClose,
        financedBalance: subjectToSellerCarryBalance,
        existingLoanBalance,
        existingLoanPayment,
        noteRatePercent: creativeNoteInterestRate,
        amortizationYears: creativeAmortizationYears,
        balloonYears: creativeBalloonYears,
        monthlyPayment: subjectToSellerCarryPayment,
        totalMonthlyPayment: subjectToTotalMonthlyPayment,
        estimatedMonthlyCashFlow: subjectToMonthlyCashFlow,
        balloonBalance: subjectToBalloonBalance,
      },
    },
  ]

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
    creativeOffers,
    routeFit,
    buyerInterest,
    nextSteps,
    disclaimer:
      'This is a rough screening tool, not an appraisal, loan approval, legal advice, or guaranteed offer. Creative structures use default assumptions unless you override them, and final terms still require verified payoff, title, condition, insurance, taxes, and partner review.',
  }
}
