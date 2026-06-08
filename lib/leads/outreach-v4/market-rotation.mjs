import fs from 'node:fs'
import path from 'node:path'

import { BUSINESS_MARKETS, DISTRESSED_HOUSE_MARKETS, V4_VERTICALS } from './config.mjs'
import { hashString, normalizeKey, rotate } from './utils.mjs'

const DEFAULT_HISTORY_PATH = path.join(process.cwd(), 'artifacts', 'outreach-v4', 'market-history.json')

function readHistory(historyPath = DEFAULT_HISTORY_PATH) {
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'))
  } catch {
    return { version: 1, runs: [] }
  }
}

function writeHistory(history, historyPath = DEFAULT_HISTORY_PATH) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true })
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`)
}

function daysBetween(leftIso, rightIso) {
  const left = new Date(leftIso)
  const right = new Date(rightIso)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return 999
  return Math.floor(Math.abs(right.getTime() - left.getTime()) / 86400000)
}

function recentMarketKeys(history, verticalId, dateIso, cooldownDays) {
  return new Set(
    (history.runs || [])
      .filter((run) => run.verticalId === verticalId && daysBetween(run.date, dateIso) < cooldownDays)
      .map((run) => run.marketKey)
  )
}

function marketKey(market) {
  return `${normalizeKey(market.city)}-${normalizeKey(market.state)}`
}

function pickMarketsForVertical({ vertical, dateIso, count, history, distressed = false }) {
  const seed = hashString(`${vertical.id}-${dateIso}`)
  const marketPool = distressed ? DISTRESSED_HOUSE_MARKETS : BUSINESS_MARKETS
  const cooldownDays = distressed ? 21 : 14
  const recent = recentMarketKeys(history, vertical.id, dateIso, cooldownDays)
  const freshMarkets = marketPool.filter((market) => !recent.has(marketKey(market)))
  const candidates = freshMarkets.length >= count ? freshMarkets : marketPool

  return rotate(candidates, seed, count).map((market, index) => ({
    ...market,
    marketKey: marketKey(market),
    verticalId: vertical.id,
    selectedReason: recent.has(marketKey(market))
      ? `fallback_repeat_after_${cooldownDays}_day_pool_exhaustion`
      : `fresh_${distressed ? 'distressed' : 'business'}_market_rotation_rank_${index + 1}`,
  }))
}

export function buildMarketRotationPlan(options = {}) {
  const dateIso = options.date || new Date().toISOString().slice(0, 10)
  const history = options.history || readHistory(options.historyPath)
  const businessMarketCount = Number.isFinite(options.businessMarketCount) ? options.businessMarketCount : 2
  const distressedMarketCount = Number.isFinite(options.distressedMarketCount) ? options.distressedMarketCount : 2

  const verticalPlans = V4_VERTICALS.map((vertical) => {
    const distressed = vertical.id === 'distressed_house'
    const marketCount = distressed ? distressedMarketCount : businessMarketCount
    return {
      verticalId: vertical.id,
      label: vertical.label,
      quota: vertical.quota,
      manualReviewOnly: Boolean(vertical.manualReviewOnly),
      markets: pickMarketsForVertical({
        vertical,
        dateIso,
        count: marketCount,
        history,
        distressed,
      }),
      niches: vertical.niches,
    }
  })

  return {
    version: 1,
    date: dateIso,
    generatedAt: new Date().toISOString(),
    businessMarketCount,
    distressedMarketCount,
    verticalPlans,
  }
}

export function buildHistoryRowsFromPlan(plan) {
  return plan.verticalPlans.flatMap((verticalPlan) =>
    verticalPlan.markets.map((market) => ({
      date: plan.date,
      verticalId: verticalPlan.verticalId,
      city: market.city,
      state: market.state,
      marketKey: market.marketKey,
      selectedReason: market.selectedReason,
    }))
  )
}

export function persistMarketRotationHistory(plan, options = {}) {
  const historyPath = options.historyPath || DEFAULT_HISTORY_PATH
  const history = readHistory(historyPath)
  const existingKeys = new Set(
    (history.runs || []).map((run) => `${run.date}:${run.verticalId}:${run.marketKey}`)
  )
  const nextRuns = [...(history.runs || [])]

  for (const row of buildHistoryRowsFromPlan(plan)) {
    const key = `${row.date}:${row.verticalId}:${row.marketKey}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    nextRuns.push(row)
  }

  writeHistory(
    {
      version: 1,
      updatedAt: new Date().toISOString(),
      runs: nextRuns,
    },
    historyPath
  )
}
