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

const { buildPropertyOpportunityAnalysis } = require('../lib/property/opportunityAnalysis') as typeof import('../lib/property/opportunityAnalysis')

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

console.log('property-opportunity-analysis: ok')
