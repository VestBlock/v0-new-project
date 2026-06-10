import {
  type RoughPropertyEstimate,
  type RoughPropertyEstimateInput,
  parseCurrencyAmount,
} from '@/lib/property/roughEstimate'
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

export type PropertyOpportunityInput = RoughPropertyEstimateInput & {
  afterRepairValue?: string | number | null
  repairBudget?: string | number | null
  closingCosts?: string | number | null
  holdingPeriodMonths?: string | number | null
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
  dealStrength: {
    score: number
    label: 'Strong' | 'Promising' | 'Watchlist' | 'Weak'
    summary: string
    strengths: string[]
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

function dealStrengthLabel(score: number): PropertyOpportunityAnalysis['dealStrength']['label'] {
  if (score >= 78) return 'Strong'
  if (score >= 62) return 'Promising'
  if (score >= 42) return 'Watchlist'
  return 'Weak'
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
  const isRentalStyle = ['rental', 'brrrr', 'dscr_refinance', 'hold_long_term'].includes(exitStrategy)
  const isFlipStyle = ['flip', 'brrrr', 'wholetail'].includes(exitStrategy)
  const isWholesaleStyle = ['wholesale'].includes(exitStrategy)

  const arv = parseCurrencyAmount(input.afterRepairValue) ?? estimate.estimateValue
  const repairBudget = parseCurrencyAmount(input.repairBudget)
  const askingPrice = estimate.askingPrice ?? parseCurrencyAmount(input.askingPrice)
  const purchasePrice = askingPrice ?? estimate.estimateValue ?? arv
  const closingCostsInput = parseCurrencyAmount(input.closingCosts)
  const holdingPeriodMonths = parseCurrencyAmount(input.holdingPeriodMonths) ?? (isFlipStyle ? 6 : 0)
  const monthlyRent = estimate.rentEstimate
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
    monthlyRent !== null && estimate.estimateValue !== null
      ? percent(monthlyRent * 12, estimate.estimateValue)
      : null
  const dscr = calculateDscr(netOperatingIncomeAnnual, annualDebtService)
  const capRatePercent = calculateCapRate(netOperatingIncomeAnnual, purchasePrice ?? estimate.estimateValue)
  const debtYieldPercent = calculateDebtYield(netOperatingIncomeAnnual, recommendedLoanAmount)
  const breakEvenRent = calculateBreakEvenRent(monthlyDebtService, operatingExpenses.total)
  const rentToPriceRatioPercent = calculateRentToPriceRatioPercent(monthlyRent, purchasePrice ?? estimate.estimateValue)

  const mao70 = calculateMaxAllowableOffer(arv, repairBudget)
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
      ? askingPrice !== null
        ? Math.min(askingPrice, sellerFinanceMaxPrice)
        : sellerFinanceMaxPrice
      : askingPrice
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
  const existingLoanPayment = monthlyDebtService ?? calculatedExistingLoanPayment
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
    dscr !== null && dscr < 1.05 ? 'DSCR below lender threshold' : null,
    vacancyPercent >= 10 ? 'High vacancy assumption' : null,
    flipProfit !== null && flipProfit < 15000 && isFlipStyle ? 'Thin profit spread' : null,
    operatorCashNeeded !== null && operatorCashAvailable < operatorCashNeeded * 0.5 ? 'Too much operator cash required' : null,
    missingItems.length > 0 ? 'Missing documents or borrower details' : null,
    exitStrategy === 'not_sure' ? 'No clear exit strategy' : null,
    totalCapitalAvailable !== null && totalCashNeeded !== null && totalCapitalAvailable < totalCashNeeded ? 'Overleveraged capital stack' : null,
  ].filter(Boolean) as string[]

  let recommendedFundingPath: PropertyOpportunityAnalysis['fundingReadiness']['recommendedPath'] = 'Manual review'
  if (isWholesaleStyle) {
    recommendedFundingPath = 'Transactional funding'
  } else if (creditScore !== null && creditScore < 620) {
    recommendedFundingPath = 'Credit prep'
  } else if (!entityReady) {
    recommendedFundingPath = 'Business credit builder'
  } else if (isRentalStyle && dscr !== null && dscr >= 1.1 && (creditScore ?? 680) >= 660) {
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
      fundingReadinessScore * 0.34
  )

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

  const dealStrengthScore = bounded(
    (Math.min(20, Math.max(0, ((discountToValuePercent ?? equityPercent ?? 0) / 20) * 20))) +
      (estimatedMonthlyCashFlow !== null
        ? Math.min(15, Math.max(0, (estimatedMonthlyCashFlow / Math.max(targetMonthlyCashFlow, 1)) * 10 + 5))
        : 4) +
      (Math.min(10, Math.max(0, ((rentToPriceRatioPercent ?? 0) / 1.2) * 10))) +
      (repairBudget !== null && arv !== null
        ? Math.min(10, Math.max(0, 10 - (repairBudget / Math.max(arv, 1)) * 25))
        : 5) +
      Math.round(fundingReadinessScore * 0.15) +
      (exitStrategy !== 'not_sure' ? 10 : 4) +
      Math.min(10, Math.round(estimate.confidence / 10)) +
      Math.max(0, 10 - riskFlags.length * 2)
  )

  const strengths = [
    discountToValuePercent !== null && discountToValuePercent >= 12 ? 'Price sits well below rough value' : null,
    estimatedMonthlyCashFlow !== null && estimatedMonthlyCashFlow >= targetMonthlyCashFlow ? 'Monthly cash flow clears the target' : null,
    dscr !== null && dscr >= 1.15 ? 'Debt coverage is lender friendly' : null,
    flipProfit !== null && flipProfit >= 25000 ? 'Projected flip spread is healthy' : null,
    fundingReadinessScore >= 70 ? 'File looks ready for capital review' : null,
    hasHealthyEquity(estimate) ? 'Seller equity appears workable' : null,
  ].filter(Boolean) as string[]

  const capitalStackNotes = [
    recommendedFundingPath === 'DSCR' ? 'Route to DSCR review once rent support and borrower file are confirmed.' : null,
    recommendedFundingPath === 'Hard money' ? 'Use senior leverage first, then keep private money and seller carry as gap coverage.' : null,
    fundingGap !== null && fundingGap > 0 ? 'There is still an uncovered capital gap at the current assumptions.' : null,
    operatorCashNeeded !== null && operatorCashNeeded <= operatorCashAvailable ? 'Current operator cash looks adequate for the modeled structure.' : null,
    exitStrategy === 'seller_finance' ? 'Creative carry can reduce cash needed if payoff and title are clean.' : null,
  ].filter(Boolean) as string[]

  const topRoute = routeFit[0]
  const nextSteps = [
    'Verify ownership, payoff, liens, taxes, and property condition before any offer or routing.',
    topRoute ? `Start with ${topRoute.label.toLowerCase()} and keep the other paths available until the seller goal is clear.` : null,
    `Prepare the file for ${recommendedFundingPath.toLowerCase()} review with the missing items cleared first.`,
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
    dealStrength: {
      score: dealStrengthScore,
      label: dealStrengthLabel(dealStrengthScore),
      summary:
        dealStrengthScore >= 78
          ? 'The numbers support active review across buyers and capital routes.'
          : dealStrengthScore >= 62
            ? 'There is enough signal here to keep the deal moving, but the file still needs discipline.'
            : dealStrengthScore >= 42
              ? 'This is a watchlist deal until pricing, scope, or borrower details improve.'
              : 'The current structure is thin and should be tightened before real routing.',
      strengths,
    },
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
    buyerInterest,
    nextSteps,
    disclaimer:
      'VestBlock provides informational analysis, deal estimates, funding readiness guidance, and referral routing support. VestBlock does not guarantee funding, approval, property value, rental income, profit, or investment performance. All property data, valuations, rents, comps, and projections must be independently verified before making financial decisions.',
  }
}
