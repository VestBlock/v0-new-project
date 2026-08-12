process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' })
require('ts-node/register')

const Module = require('module')
const path = require('path')
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveVestBlockAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, path.join(process.cwd(), request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const { finalizeAttomFacts, buildAttomSignals, routeAttomStrategies } = require('../lib/property-intelligence/attom-strategy.ts')

const freeClear = finalizeAttomFacts({ avmValue: 275000, estimatedLoanBalance: 0, latestSaleDate: '2004-03-12' })
if (!freeClear.freeAndClear || Math.round(freeClear.equityPercent) !== 100) throw new Error('Free-and-clear calculation failed')
const freeClearRoutes = routeAttomStrategies(freeClear)
if (!freeClearRoutes.some((route) => route.key === 'seller-finance-free-clear')) throw new Error('Seller-finance route missing')

const lowEquity = finalizeAttomFacts({ avmValue: 200000, estimatedLoanBalance: 185000, latestSaleDate: '2022-04-10' })
const lowEquityRoutes = routeAttomStrategies(lowEquity, { sourceText: 'preforeclosure notice of default' })
if (!lowEquityRoutes.some((route) => route.key === 'subject-to-low-equity')) throw new Error('Subject-to route missing')
if (!lowEquityRoutes.some((route) => route.key === 'preforeclosure-equity')) throw new Error('Preforeclosure route missing')
if (!lowEquityRoutes.find((route) => route.key === 'preforeclosure-equity')?.reviewOnly) throw new Error('Preforeclosure must remain review-only')

const hybrid = finalizeAttomFacts({ avmValue: 300000, estimatedLoanBalance: 150000, absenteeOwner: true })
const hybridRoutes = routeAttomStrategies(hybrid)
if (!hybridRoutes.some((route) => route.key === 'hybrid-equity-bridge')) throw new Error('Hybrid route missing')
if (!hybridRoutes.some((route) => route.key === 'novation-retail-equity')) throw new Error('Novation route missing')
if (!hybridRoutes.some((route) => route.key === 'absentee-equity-creative')) throw new Error('Absentee-equity route missing')

const recent = finalizeAttomFacts({ avmValue: 250000, estimatedLoanBalance: 100000, latestSaleDate: new Date().toISOString() })
const recentRoutes = routeAttomStrategies(recent)
if (!recentRoutes.some((route) => route.key === 'recent-sale-cooldown' && route.suppress)) throw new Error('Recent-sale suppression missing')

const signals = buildAttomSignals(freeClear)
if (!signals.some((signal) => signal.signal_type === 'high_equity')) throw new Error('High-equity signal missing')
if (!signals.some((signal) => signal.signal_type === 'free_and_clear')) throw new Error('Free-and-clear signal missing')

console.log(JSON.stringify({
  freeClear: freeClearRoutes.map((route) => route.key),
  lowEquity: lowEquityRoutes.map((route) => route.key),
  hybrid: hybridRoutes.map((route) => route.key),
  recent: recentRoutes.map((route) => route.key),
  signals: signals.map((signal) => signal.signal_type),
}, null, 2))
