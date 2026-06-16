import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const originalResolveFilename = (Module as any)._resolveFilename
;(Module as any)._resolveFilename = function resolveFilename(request: string, parent: unknown, isMain: boolean, options: unknown) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

import type { RoughPropertyEstimate } from '../lib/property/roughEstimate'

const {
  MIN_CASH_ON_CASH_RETURN_PERCENT,
  buildPropertyOpportunityAnalysis,
} = require('../lib/property/opportunityAnalysis') as typeof import('../lib/property/opportunityAnalysis')

const baseEstimate: RoughPropertyEstimate = {
  source: 'seller_supplied',
  sourceLabel: 'Seller supplied',
  estimateValue: 180000,
  lowEstimate: 165000,
  highEstimate: 195000,
  rentEstimate: 1500,
  confidence: 72,
  confidenceLabel: 'medium',
  sellerEstimatedValue: 180000,
  askingPrice: 112000,
  mortgageBalance: 62000,
  liensOrTaxesAmount: 8000,
  equityEstimate: 118000,
  ltvEstimate: 34.4,
  spreadToAsking: 68000,
  acquisitionRangeLow: 95000,
  acquisitionRangeHigh: 125000,
  suggestedExitPaths: ['fast_cash', 'novation'],
  buyerPacketSummary: '',
  lenderPacketSummary: '',
  warnings: [],
  comparableCount: 0,
  subjectProperty: null,
  generatedAt: '2026-06-14T00:00:00.000Z',
  disclaimer: '',
}

const highSignal = buildPropertyOpportunityAnalysis(
  {
    address: '123 Signal St',
    city: 'Milwaukee',
    state: 'WI',
    propertyType: 'Duplex',
    propertyCondition: 'Vacant / code violation',
    timelineToSell: 'ASAP',
    occupancyStatus: 'Vacant',
    askingPrice: 112000,
    afterRepairValue: 190000,
    repairBudget: 5000,
    liensOrTaxes: 8000,
    listingSourceUrl: 'https://example.com/listing',
    listingStatus: 'Expired / withdrawn',
    daysOnMarket: 145,
    priceCutCount: 2,
    listingNotes: 'tax delinquency, code violation, vacant, foreclosure auction postponed',
    selectedComps: [
      { address: '1 Comp Ave', salePrice: 185000, squareFeet: 1600, distanceMiles: 0.4 },
      { address: '2 Comp Ave', salePrice: 192000, squareFeet: 1550, distanceMiles: 0.6 },
    ],
    exitStrategy: 'wholesale',
  },
  baseEstimate
)

assert.equal(highSignal.signalScore.label, 'High-intent signal')
assert.ok(highSignal.signalScore.score >= 78)
assert.ok(highSignal.signalScore.signals.includes('Tax delinquency language'))
assert.ok(highSignal.signalScore.signals.includes('Code or condition language'))
assert.ok(highSignal.signalScore.signals.includes('Listing/source URL attached'))

const thinSignal = buildPropertyOpportunityAnalysis(
  {
    address: '456 Thin St',
    city: 'Toledo',
    state: 'OH',
    propertyType: 'Single Family',
    propertyCondition: 'Unknown',
    askingPrice: 175000,
  },
  { ...baseEstimate, confidence: 35, confidenceLabel: 'low', liensOrTaxesAmount: null }
)

assert.equal(thinSignal.signalScore.label, 'Needs source evidence')
assert.ok(thinSignal.signalScore.score < 36)
assert.ok(thinSignal.signalScore.nextAction.includes('public-record sources'))

const creativeTerms = buildPropertyOpportunityAnalysis(
  {
    address: '789 Terms Ave',
    city: 'Kansas City',
    state: 'MO',
    propertyType: 'Single Family',
    propertyCondition: 'Fair / Dated',
    occupancyStatus: 'Tenant occupied',
    askingPrice: 145000,
    afterRepairValue: 190000,
    repairBudget: 12000,
    monthlyRentEstimate: 1850,
    monthlyTaxes: 165,
    monthlyInsurance: 115,
    targetMonthlyCashFlow: 250,
    mortgageBalance: 92000,
    liensOrTaxes: 3500,
    monthlyDebtService: 620,
    creativeDownPayment: 7500,
    creativeNoteInterestRate: 5,
    creativeAmortizationYears: 30,
    creativeBalloonYears: 7,
    existingLoanInterestRate: 3.25,
    existingLoanRemainingTermYears: 24,
    exitStrategy: 'seller finance',
  },
  {
    ...baseEstimate,
    askingPrice: 145000,
    mortgageBalance: 92000,
    liensOrTaxesAmount: 3500,
    estimateValue: 180000,
    rentEstimate: 1850,
    ltvEstimate: 51.1,
    equityEstimate: 88000,
  }
)

assert.equal(creativeTerms.creativeOffers.length, 4)

const subjectTo = creativeTerms.creativeOffers.find((offer) => offer.key === 'subject_to')
assert.ok(subjectTo)
assert.ok(subjectTo!.metrics.entryFee !== null && subjectTo!.metrics.entryFee > 0)
assert.ok(subjectTo!.trustScore >= 0 && subjectTo!.trustScore <= 100)
assert.ok(subjectTo!.trustLabel)
assert.ok(subjectTo!.guardrails.some((guardrail) => guardrail.includes('due-on-sale')))
assert.ok(subjectTo!.terms.some((term) => term.includes('Subject-to price target')))

const wrap = creativeTerms.creativeOffers.find((offer) => offer.key === 'wrap_mortgage')
assert.ok(wrap)
assert.ok(wrap!.metrics.sellerMonthlySpread !== null)
assert.ok(wrap!.metrics.exitLoanToValuePercent !== null)

const hybrid = creativeTerms.creativeOffers.find((offer) => offer.key === 'hybrid_morby')
assert.ok(hybrid)
assert.ok(hybrid!.metrics.seniorDebt !== null && hybrid!.metrics.sellerCarryBalance !== null)
assert.ok(hybrid!.terms.some((term) => term.includes('Senior debt target')))

const lowCashOnCash = buildPropertyOpportunityAnalysis(
  {
    address: '1313 Thin Yield Ln',
    city: 'Dayton',
    state: 'OH',
    propertyType: 'Single Family',
    propertyCondition: 'Average',
    monthlyRentEstimate: 1500,
    monthlyTaxes: 200,
    monthlyInsurance: 100,
    exitStrategy: 'rental',
  },
  {
    ...baseEstimate,
    estimateValue: 150000,
    askingPrice: 120000,
    rentEstimate: 1500,
    mortgageBalance: 0,
    liensOrTaxesAmount: 0,
    equityEstimate: 150000,
    ltvEstimate: 0,
  }
)

assert.ok(lowCashOnCash.metrics.cashOnCashReturnPercent !== null)
assert.ok(lowCashOnCash.metrics.cashOnCashReturnPercent! < MIN_CASH_ON_CASH_RETURN_PERCENT)
assert.ok(lowCashOnCash.riskFlags.includes(`Cash-on-cash below ${MIN_CASH_ON_CASH_RETURN_PERCENT}% floor`))
assert.ok(lowCashOnCash.dealStrength.score <= 58)
assert.notEqual(lowCashOnCash.dealStrength.label, 'Promising')
assert.notEqual(lowCashOnCash.dealStrength.label, 'Strong')
assert.notEqual(lowCashOnCash.fundingReadiness.recommendedPath, 'DSCR')

const healthyCashOnCash = buildPropertyOpportunityAnalysis(
  {
    address: '1414 Strong Yield Ave',
    city: 'Toledo',
    state: 'OH',
    propertyType: 'Single Family',
    propertyCondition: 'Average',
    monthlyRentEstimate: 1900,
    monthlyTaxes: 140,
    monthlyInsurance: 90,
    exitStrategy: 'rental',
    creditScoreRange: '700+',
    entityStatus: 'Active LLC',
    documentsAvailable: 'Bank statements, rent support, lease, operating agreement, EIN',
  },
  {
    ...baseEstimate,
    estimateValue: 150000,
    askingPrice: 105000,
    rentEstimate: 1900,
    mortgageBalance: 0,
    liensOrTaxesAmount: 0,
    equityEstimate: 150000,
    ltvEstimate: 0,
  }
)

assert.ok(healthyCashOnCash.metrics.cashOnCashReturnPercent !== null)
assert.ok(healthyCashOnCash.metrics.cashOnCashReturnPercent! >= MIN_CASH_ON_CASH_RETURN_PERCENT)
assert.ok(healthyCashOnCash.dealStrength.strengths.includes(`Cash-on-cash clears the ${MIN_CASH_ON_CASH_RETURN_PERCENT}% floor`))

console.log('property-opportunity-analysis: ok')
