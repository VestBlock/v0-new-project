export type OperatingExpenseInputs = {
  monthlyRent: number | null
  monthlyTaxes?: number | null
  monthlyInsurance?: number | null
  monthlyUtilities?: number | null
  otherMonthlyExpenses?: number | null
  propertyManagementPercent?: number | null
  vacancyPercent?: number | null
  maintenancePercent?: number | null
}

function rounded(value: number | null, digits = 2) {
  if (!Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

export function percentOf(base: number | null, percent: number | null) {
  if (!Number.isFinite(base) || !Number.isFinite(percent)) return null
  return rounded((Number(base) * Number(percent)) / 100)
}

export function calculateMonthlyMortgagePayment(
  principal: number | null,
  annualRatePercent: number | null,
  amortizationYears: number | null
) {
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
    return rounded(loanPrincipal / totalPayments)
  }

  const payment =
    (loanPrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalPayments))

  return rounded(payment)
}

export function remainingLoanBalance(
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
    return rounded(loanPrincipal * (1 - completedPayments / totalPayments))
  }

  const payment = calculateMonthlyMortgagePayment(principal, annualRatePercent, amortizationYears)
  if (!Number.isFinite(payment)) return null

  const remaining =
    loanPrincipal * Math.pow(1 + monthlyRate, completedPayments) -
    Number(payment) * ((Math.pow(1 + monthlyRate, completedPayments) - 1) / monthlyRate)

  return rounded(Math.max(0, remaining))
}

export function principalFromPaymentCapacity(
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
    return rounded(payment * totalPayments)
  }

  const principal =
    payment * ((1 - Math.pow(1 + monthlyRate, -totalPayments)) / monthlyRate)

  return rounded(principal)
}

export function calculateOperatingExpenses(inputs: OperatingExpenseInputs) {
  const management = percentOf(inputs.monthlyRent, inputs.propertyManagementPercent ?? 0) ?? 0
  const vacancy = percentOf(inputs.monthlyRent, inputs.vacancyPercent ?? 0) ?? 0
  const maintenance = percentOf(inputs.monthlyRent, inputs.maintenancePercent ?? 0) ?? 0
  const taxes = inputs.monthlyTaxes ?? 0
  const insurance = inputs.monthlyInsurance ?? 0
  const utilities = inputs.monthlyUtilities ?? 0
  const other = inputs.otherMonthlyExpenses ?? 0

  const total = management + vacancy + maintenance + taxes + insurance + utilities + other

  return {
    management: rounded(management),
    vacancy: rounded(vacancy),
    maintenance: rounded(maintenance),
    taxes: rounded(taxes),
    insurance: rounded(insurance),
    utilities: rounded(utilities),
    other: rounded(other),
    total: rounded(total),
    annual: rounded(total * 12),
  }
}

export function calculateNetOperatingIncome(
  monthlyRent: number | null,
  monthlyOperatingExpenses: number | null
) {
  if (!Number.isFinite(monthlyRent) || !Number.isFinite(monthlyOperatingExpenses)) return null
  return rounded((Number(monthlyRent) - Number(monthlyOperatingExpenses)) * 12)
}

export function calculateCapRate(noiAnnual: number | null, purchasePrice: number | null) {
  if (!Number.isFinite(noiAnnual) || !Number.isFinite(purchasePrice) || Number(purchasePrice) <= 0) return null
  return rounded((Number(noiAnnual) / Number(purchasePrice)) * 100)
}

export function calculateAnnualDebtService(monthlyDebtService: number | null) {
  if (!Number.isFinite(monthlyDebtService)) return null
  return rounded(Number(monthlyDebtService) * 12)
}

export function calculateDscr(noiAnnual: number | null, annualDebtService: number | null) {
  if (!Number.isFinite(noiAnnual) || !Number.isFinite(annualDebtService) || Number(annualDebtService) <= 0) return null
  return rounded(Number(noiAnnual) / Number(annualDebtService))
}

export function calculateCashFlow(monthlyRent: number | null, monthlyCarry: number | null) {
  if (!Number.isFinite(monthlyRent) || !Number.isFinite(monthlyCarry)) return null
  return rounded(Number(monthlyRent) - Number(monthlyCarry))
}

export function calculateCashOnCashReturn(
  annualCashFlow: number | null,
  totalCashInvested: number | null
) {
  if (!Number.isFinite(annualCashFlow) || !Number.isFinite(totalCashInvested) || Number(totalCashInvested) <= 0) return null
  return rounded((Number(annualCashFlow) / Number(totalCashInvested)) * 100)
}

export function calculateDebtYield(noiAnnual: number | null, loanAmount: number | null) {
  if (!Number.isFinite(noiAnnual) || !Number.isFinite(loanAmount) || Number(loanAmount) <= 0) return null
  return rounded((Number(noiAnnual) / Number(loanAmount)) * 100)
}

export function calculateBreakEvenRent(
  monthlyDebtService: number | null,
  monthlyOperatingExpenses: number | null
) {
  if (!Number.isFinite(monthlyDebtService) || !Number.isFinite(monthlyOperatingExpenses)) return null
  return rounded(Number(monthlyDebtService) + Number(monthlyOperatingExpenses))
}

export function calculateRentToPriceRatioPercent(
  monthlyRent: number | null,
  purchasePrice: number | null
) {
  if (!Number.isFinite(monthlyRent) || !Number.isFinite(purchasePrice) || Number(purchasePrice) <= 0) return null
  return rounded((Number(monthlyRent) / Number(purchasePrice)) * 100)
}

export function calculateFlipProfit(inputs: {
  salePrice: number | null
  purchasePrice: number | null
  rehabCost?: number | null
  closingCosts?: number | null
  holdingCosts?: number | null
  resaleCosts?: number | null
  financingCosts?: number | null
}) {
  const {
    salePrice,
    purchasePrice,
    rehabCost = 0,
    closingCosts = 0,
    holdingCosts = 0,
    resaleCosts = 0,
    financingCosts = 0,
  } = inputs

  if (!Number.isFinite(salePrice) || !Number.isFinite(purchasePrice)) return null

  const profit =
    Number(salePrice) -
    Number(purchasePrice) -
    Number(rehabCost) -
    Number(closingCosts) -
    Number(holdingCosts) -
    Number(resaleCosts) -
    Number(financingCosts)

  return rounded(profit)
}

export function calculateReturnOnInvestment(
  netProfit: number | null,
  cashInvested: number | null
) {
  if (!Number.isFinite(netProfit) || !Number.isFinite(cashInvested) || Number(cashInvested) <= 0) return null
  return rounded((Number(netProfit) / Number(cashInvested)) * 100)
}

export function calculateFundingGap(
  totalCashNeeded: number | null,
  operatorCashAvailable: number | null
) {
  if (!Number.isFinite(totalCashNeeded) || !Number.isFinite(operatorCashAvailable)) return null
  return rounded(Math.max(0, Number(totalCashNeeded) - Number(operatorCashAvailable)))
}

export function calculateMaxAllowableOffer(
  afterRepairValue: number | null,
  rehabCost: number | null,
  wholesaleFee: number | null = 0
) {
  if (!Number.isFinite(afterRepairValue) || !Number.isFinite(rehabCost)) return null
  return rounded(Number(afterRepairValue) * 0.7 - Number(rehabCost) - Number(wholesaleFee))
}

export function calculateConservativeLoanAmount(inputs: {
  totalProjectCost: number | null
  collateralValue: number | null
  loanToCostPercent?: number | null
  loanToValuePercent?: number | null
}) {
  const { totalProjectCost, collateralValue, loanToCostPercent, loanToValuePercent } = inputs

  const byCost =
    Number.isFinite(totalProjectCost) && Number.isFinite(loanToCostPercent)
      ? Number(totalProjectCost) * (Number(loanToCostPercent) / 100)
      : null

  const byValue =
    Number.isFinite(collateralValue) && Number.isFinite(loanToValuePercent)
      ? Number(collateralValue) * (Number(loanToValuePercent) / 100)
      : null

  if (Number.isFinite(byCost) && Number.isFinite(byValue)) {
    return rounded(Math.min(Number(byCost), Number(byValue)))
  }

  if (Number.isFinite(byCost)) return rounded(byCost)
  if (Number.isFinite(byValue)) return rounded(byValue)
  return null
}
