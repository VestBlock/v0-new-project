import { phaseOneMarkets, type InvestorProfileRecord, type InvestorScoreBreakdown, type InvestorSequenceCode, type NormalizedInvestorInput } from '@/lib/investors/types'

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeMarket(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/,\s*/g, ', ').trim()
}

function countPhaseOneMarkets(markets: string[]) {
  const normalized = new Set(markets.map(normalizeMarket))
  return phaseOneMarkets.filter((market) => normalized.has(normalizeMarket(market))).length
}

function scoreRecentActivity(input: Pick<NormalizedInvestorInput, 'transactions' | 'evidence'>) {
  const transactionDates = (input.transactions || [])
    .map((transaction) => transaction.transactionDate)
    .filter(Boolean)
    .map((date) => new Date(String(date)).getTime())
    .filter(Number.isFinite)
  const evidenceDates = (input.evidence || [])
    .map((evidence) => evidence.recordDate)
    .filter(Boolean)
    .map((date) => new Date(String(date)).getTime())
    .filter(Number.isFinite)
  const latest = Math.max(0, ...transactionDates, ...evidenceDates)
  if (!latest) return 35

  const ageDays = (Date.now() - latest) / 86400000
  if (ageDays <= 45) return 100
  if (ageDays <= 90) return 85
  if (ageDays <= 180) return 70
  if (ageDays <= 365) return 50
  return 25
}

function scoreTransactionVolume(input: Pick<NormalizedInvestorInput, 'transactions' | 'evidence'>) {
  const transactions = input.transactions?.length || 0
  const flipSignals = (input.evidence || []).filter((row) =>
    ['recent_flip_transaction', 'public_foreclosure_buyer', 'county_deed_record', 'public_property_sales'].includes(row.sourceType)
  ).length
  return clampScore(transactions * 18 + flipSignals * 12 + 20)
}

function scoreGeographicFit(markets: string[] = []) {
  const matches = countPhaseOneMarkets(markets)
  if (matches >= 3) return 100
  if (matches === 2) return 86
  if (matches === 1) return 72
  if (markets.some((market) => /\b(oh|ohio|wi|wisconsin)\b/i.test(market))) return 45
  return 25
}

function scoreFinancingNeed(input: NormalizedInvestorInput) {
  const tags = [...(input.classificationTags || []), input.primaryInvestorType || ''].join(' ').toLowerCase()
  const indicators = (input.financingIndicators || []).join(' ').toLowerCase()
  let score = 20
  if (/dscr|hard.money|borrower|fix.?and.?flip|rehab|bridge/.test(tags)) score += 35
  if (/loan|lender|capital|cash.out|dscr|bridge|working capital|funding/.test(indicators)) score += 35
  if ((input.transactions || []).some((transaction) => /loan|mortgage|hard money|private/i.test(transaction.financingType || ''))) score += 15
  return clampScore(score)
}

function scoreDispositionNeed(input: NormalizedInvestorInput) {
  const tags = [...(input.classificationTags || []), input.primaryInvestorType || ''].join(' ').toLowerCase()
  let score = 20
  if (/wholesale|dispo|assignment|acquisition_manager/.test(tags)) score += 45
  if ((input.transactions || []).some((transaction) => transaction.salePrice || transaction.transactionType === 'sale')) score += 20
  if ((input.propertyTypes || []).some((propertyType) => /portfolio|multi|rental/i.test(propertyType))) score += 10
  return clampScore(score)
}

function scorePartnershipPotential(input: NormalizedInvestorInput, geographicFit: number) {
  const contactScore = input.contactEmail || input.contactPhone || input.website || input.linkedinUrl ? 25 : 5
  const marketScore = geographicFit >= 70 ? 25 : 10
  const sourceScore = Math.min(25, (input.sourceNames?.length || input.evidence?.length || 0) * 8)
  const profileScore = input.estimatedBuyBox && Object.keys(input.estimatedBuyBox).length ? 20 : 8
  return clampScore(contactScore + marketScore + sourceScore + profileScore)
}

function pickSequence(input: NormalizedInvestorInput, financingNeed: number, dispositionNeed: number): InvestorSequenceCode {
  const tags = [...(input.classificationTags || []), input.primaryInvestorType || ''].join(' ').toLowerCase()
  if (financingNeed >= 70) return 'C'
  if (dispositionNeed >= 70 || /wholesale|dispo/.test(tags)) return 'B'
  if (/fix|hold|dscr|institutional|acquisition/.test(tags)) return 'A'
  return 'D'
}

export function calculateInvestorScore(input: NormalizedInvestorInput): InvestorScoreBreakdown {
  const recentActivity = scoreRecentActivity(input)
  const transactionVolume = scoreTransactionVolume(input)
  const geographicFit = scoreGeographicFit(input.markets)
  const financingNeed = scoreFinancingNeed(input)
  const dispositionNeed = scoreDispositionNeed(input)
  const partnershipPotential = scorePartnershipPotential(input, geographicFit)
  const partnershipScore = clampScore(
    recentActivity * 0.2 +
      transactionVolume * 0.18 +
      geographicFit * 0.2 +
      financingNeed * 0.14 +
      dispositionNeed * 0.12 +
      partnershipPotential * 0.16
  )
  const assignedSequence = pickSequence(input, financingNeed, dispositionNeed)

  return {
    recentActivity,
    transactionVolume,
    geographicFit,
    financingNeed,
    dispositionNeed,
    partnershipPotential,
    partnershipScore,
    assignedSequence,
    dealFlowFit: geographicFit >= 45 && ['A', 'D'].includes(assignedSequence),
    dispositionFit: dispositionNeed >= 55,
    financingFit: financingNeed >= 55,
    partnershipFit: partnershipScore >= 60,
    fitSummary: `Score ${partnershipScore}/100. ${assignedSequence === 'A' ? 'Deal-flow fit' : assignedSequence === 'B' ? 'Disposition fit' : assignedSequence === 'C' ? 'Financing fit' : 'Strategic partnership fit'} across ${input.markets?.join(', ') || 'unconfirmed markets'}.`,
  }
}

export function scoreExistingInvestor(investor: InvestorProfileRecord): InvestorScoreBreakdown {
  return calculateInvestorScore({
    displayName: investor.display_name,
    primaryInvestorType: investor.primary_investor_type,
    classificationTags: investor.classification_tags,
    contactEmail: investor.contact_email,
    contactPhone: investor.contact_phone,
    website: investor.website,
    linkedinUrl: investor.linkedin_url,
    markets: investor.markets,
    propertyTypes: investor.property_types,
    estimatedBuyBox: investor.estimated_buy_box,
    financingIndicators: investor.financing_indicators,
    sourceNames: investor.source_names,
    metadata: investor.metadata_json,
  })
}
