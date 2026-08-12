import type { PropertySignalRecord } from '@/lib/property-intelligence/types'

export type AttomPropertyFacts = {
  attomId: number | null
  apn: string | null
  address: string | null
  ownerName: string | null
  ownerType: string | null
  ownerMailingAddress: string | null
  absenteeOwner: boolean
  corporateOwner: boolean
  propertyType: string | null
  propertyClass: string | null
  landUse: string | null
  yearBuilt: number | null
  structureSqft: number | null
  lotSizeAcres: number | null
  latitude: number | null
  longitude: number | null
  assessedValue: number | null
  marketValue: number | null
  landValue: number | null
  improvementValue: number | null
  taxAmount: number | null
  taxYear: number | null
  delinquentYear: number | null
  latestSaleAmount: number | null
  latestSaleDate: string | null
  firstMortgageAmount: number | null
  secondMortgageAmount: number | null
  estimatedLoanBalance: number | null
  avmValue: number | null
  avmLow: number | null
  avmHigh: number | null
  avmConfidence: number | null
  ltvPercent: number | null
  equityAmount: number | null
  equityPercent: number | null
  freeAndClear: boolean
  dataLastUpdated: string | null
}

export type AttomStrategyContext = {
  sourceText?: string
  existingSignals?: string[]
  leadStatus?: string | null
}

export type AttomStrategyRoute = {
  key: string
  label: string
  score: number
  rationale: string[]
  reviewOnly: boolean
  suppress: boolean
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function yearsSince(value: string | null) {
  const timestamp = value ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, (Date.now() - timestamp) / (365.25 * 24 * 60 * 60 * 1000))
}

function hasSignal(context: AttomStrategyContext, pattern: RegExp) {
  return pattern.test(`${context.sourceText || ''} ${(context.existingSignals || []).join(' ')}`.toLowerCase())
}

export function finalizeAttomFacts(input: Partial<AttomPropertyFacts>): AttomPropertyFacts {
  const avmValue = finiteNumber(input.avmValue) || finiteNumber(input.marketValue)
  const loanBalance = finiteNumber(input.estimatedLoanBalance)
  const apiLtv = finiteNumber(input.ltvPercent)
  const normalizedApiLtv = apiLtv !== null && apiLtv > 0 && apiLtv <= 1.5 ? apiLtv * 100 : apiLtv
  const computedLtv = avmValue && loanBalance !== null ? (loanBalance / avmValue) * 100 : null
  const ltvPercent = normalizedApiLtv ?? computedLtv
  const equityAmount = avmValue && loanBalance !== null ? Math.max(-avmValue, avmValue - loanBalance) : finiteNumber(input.equityAmount)
  const equityPercent = avmValue && equityAmount !== null ? (equityAmount / avmValue) * 100 : finiteNumber(input.equityPercent)
  const mortgageTotal = (finiteNumber(input.firstMortgageAmount) || 0) + (finiteNumber(input.secondMortgageAmount) || 0)
  const freeAndClear = Boolean(avmValue && (loanBalance ?? mortgageTotal) <= 1_000)

  return {
    attomId: finiteNumber(input.attomId),
    apn: input.apn || null,
    address: input.address || null,
    ownerName: input.ownerName || null,
    ownerType: input.ownerType || null,
    ownerMailingAddress: input.ownerMailingAddress || null,
    absenteeOwner: Boolean(input.absenteeOwner),
    corporateOwner: Boolean(input.corporateOwner),
    propertyType: input.propertyType || null,
    propertyClass: input.propertyClass || null,
    landUse: input.landUse || null,
    yearBuilt: finiteNumber(input.yearBuilt),
    structureSqft: finiteNumber(input.structureSqft),
    lotSizeAcres: finiteNumber(input.lotSizeAcres),
    latitude: finiteNumber(input.latitude),
    longitude: finiteNumber(input.longitude),
    assessedValue: finiteNumber(input.assessedValue),
    marketValue: finiteNumber(input.marketValue),
    landValue: finiteNumber(input.landValue),
    improvementValue: finiteNumber(input.improvementValue),
    taxAmount: finiteNumber(input.taxAmount),
    taxYear: finiteNumber(input.taxYear),
    delinquentYear: finiteNumber(input.delinquentYear),
    latestSaleAmount: finiteNumber(input.latestSaleAmount),
    latestSaleDate: input.latestSaleDate || null,
    firstMortgageAmount: finiteNumber(input.firstMortgageAmount),
    secondMortgageAmount: finiteNumber(input.secondMortgageAmount),
    estimatedLoanBalance: loanBalance ?? (mortgageTotal > 0 ? mortgageTotal : null),
    avmValue,
    avmLow: finiteNumber(input.avmLow),
    avmHigh: finiteNumber(input.avmHigh),
    avmConfidence: finiteNumber(input.avmConfidence),
    ltvPercent,
    equityAmount,
    equityPercent,
    freeAndClear,
    dataLastUpdated: input.dataLastUpdated || null,
  }
}

export function buildAttomSignals(facts: AttomPropertyFacts): PropertySignalRecord[] {
  const signals: PropertySignalRecord[] = []
  const add = (signal_type: string, signal_label: string, signal_value?: string | null, confidence = 85) => {
    signals.push({
      signal_type,
      signal_label,
      signal_value: signal_value || null,
      confidence_score: confidence,
      source_name: 'ATTOM API',
      raw_fields: { attomId: facts.attomId, dataLastUpdated: facts.dataLastUpdated },
    })
  }

  if (facts.equityPercent !== null && facts.equityPercent >= 35) {
    add('high_equity', 'Estimated high equity', `${Math.round(facts.equityPercent)}%`, facts.avmConfidence || 82)
  } else if (facts.equityPercent !== null && facts.equityPercent <= 15) {
    add('low_equity', 'Estimated low equity', `${Math.round(facts.equityPercent)}%`, facts.avmConfidence || 82)
  }
  if (facts.freeAndClear) add('free_and_clear', 'Likely free and clear', 'No material estimated loan balance')
  else if ((facts.estimatedLoanBalance || 0) > 1_000) add('active_mortgage', 'Estimated active mortgage', String(Math.round(facts.estimatedLoanBalance || 0)))
  if (facts.delinquentYear) add('tax_delinquent', 'ATTOM delinquent-tax year', String(facts.delinquentYear), 90)
  if (facts.absenteeOwner) add('absentee_owner', 'ATTOM absentee-owner indicator')
  if (facts.corporateOwner) add('corporate_owner', 'ATTOM corporate-owner indicator')

  const holdingYears = yearsSince(facts.latestSaleDate)
  if (holdingYears !== null && holdingYears >= 10) add('long_term_owner', 'Long-term ownership', `${Math.floor(holdingYears)} years`)
  if (holdingYears !== null && holdingYears <= 0.5) add('recent_sale', 'Recent recorded sale', facts.latestSaleDate, 90)

  return signals
}

export function routeAttomStrategies(facts: AttomPropertyFacts, context: AttomStrategyContext = {}): AttomStrategyRoute[] {
  const routes: AttomStrategyRoute[] = []
  const add = (key: string, label: string, score: number, rationale: string[], reviewOnly = false, suppress = false) => {
    routes.push({ key, label, score: Math.max(0, Math.min(100, score)), rationale, reviewOnly, suppress })
  }

  const ltv = facts.ltvPercent
  const equityPercent = facts.equityPercent
  const equityAmount = facts.equityAmount
  const loanBalance = facts.estimatedLoanBalance || 0
  const holdingYears = yearsSince(facts.latestSaleDate)
  const isPreforeclosure = hasSignal(context, /pre.?foreclosure|foreclosure|lis pendens|notice of default|auction/)
  const isProbate = hasSignal(context, /probate|estate|heir|inherit|deceased|trust/)
  const isTaxOrCode = Boolean(facts.delinquentYear) || hasSignal(context, /tax.?delinquent|tax.?lien|code.?violation|nuisance|unsafe/)
  const isVacant = hasSignal(context, /vacant|unoccupied|boarded/)
  const isLand = /land|lot|acreage|vacant/i.test(`${facts.propertyType || ''} ${facts.propertyClass || ''} ${facts.landUse || ''}`)
  const recentSale = holdingYears !== null && holdingYears <= 0.5

  if (recentSale) add('recent-sale-cooldown', 'Recent-sale suppression', 100, ['Recorded sale is less than six months old'], false, true)

  if (isPreforeclosure && loanBalance > 1_000) {
    const key = ltv !== null && ltv >= 95 ? 'preforeclosure-short-sale-review' : 'preforeclosure-equity'
    add(key, ltv !== null && ltv >= 95 ? 'Preforeclosure short-sale review' : 'Preforeclosure creative options', 96, [
      'Preforeclosure signal requires manual review',
      `Estimated loan balance ${Math.round(loanBalance).toLocaleString()}`,
      ltv !== null ? `Estimated LTV ${Math.round(ltv)}%` : 'LTV requires payoff verification',
    ], true)
  }

  if (facts.freeAndClear) {
    add('seller-finance-free-clear', 'Free-and-clear seller finance', 92, ['No material estimated loan balance', 'Terms can create income without an immediate full cash discount'])
  } else if (ltv !== null && ltv >= 80 && ltv <= 110) {
    add('subject-to-low-equity', 'Subject-to / low-equity review', 90, [`Estimated LTV ${Math.round(ltv)}%`, 'Existing financing may matter more than a cash-only price'], true)
  }

  if (equityPercent !== null && equityPercent >= 20 && equityPercent < 80 && loanBalance > 1_000) {
    add('hybrid-equity-bridge', 'Hybrid cash and terms', 86, [`Estimated equity ${Math.round(equityPercent)}%`, 'Combination of cash and terms can bridge seller and investor needs'])
  }

  if ((equityPercent || 0) >= 35 && (equityAmount || 0) >= 40_000) {
    add('novation-retail-equity', 'Novation / retail-equity review', 84, [`Estimated equity ${Math.round(equityPercent || 0)}%`, 'Equity may support a retail-facing exit without defaulting to a deep cash discount'], true)
  }

  if (facts.absenteeOwner && (equityPercent || 0) >= 20) {
    add('absentee-equity-creative', 'Absentee-owner creative options', 82, ['ATTOM absentee-owner indicator', `Estimated equity ${Math.round(equityPercent || 0)}%`])
  }

  if (isTaxOrCode) {
    add('tax-code-stack', 'Tax / code resolution options', 88, [facts.delinquentYear ? `Delinquent-tax year ${facts.delinquentYear}` : 'Public tax or code signal', 'Compare as-is, terms, and referral paths'])
  }

  if (isProbate && ((equityPercent || 0) >= 20 || facts.freeAndClear)) {
    add('probate-vacant-equity', 'Probate / inherited equity review', 90, ['Estate or inherited-property signal', 'Manual authority and title review required'], true)
  }

  if (isLand) add('land-wholesale', 'Land and builder route', 85, ['ATTOM land-use or property-type classification'])
  if (isVacant && (equityPercent || 0) >= 20) add('vacant-equity', 'Vacant property with equity', 84, ['Vacancy signal', `Estimated equity ${Math.round(equityPercent || 0)}%`])
  if (facts.corporateOwner) add('portfolio-landlord', 'Portfolio-owner expansion', 76, ['Corporate-owner indicator', 'Run owner-level portfolio lookup before outreach'])
  if (holdingYears !== null && holdingYears >= 10 && !facts.freeAndClear) {
    add('long-term-owner-seller-finance', 'Long-term owner seller finance', 80, [`Approximately ${Math.floor(holdingYears)} years of ownership`, 'Seasoned ownership may support flexible terms'])
  }

  if (!routes.some((route) => !route.suppress)) {
    add('active-stale-creative', 'General creative-finance review', 65, ['ATTOM facts available; verify debt, equity, condition, and seller timing'])
  }

  return routes.sort((left, right) => Number(right.suppress) - Number(left.suppress) || right.score - left.score).slice(0, 6)
}
