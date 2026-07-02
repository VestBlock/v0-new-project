import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

/**
 * Logged offer outcomes (scripts/log-offer-outcome.mjs) feed negotiation
 * calibration in the analyzer: real counters teach the next anchor.
 * Kept separate from opportunityAnalysis so that module stays pure/portable.
 */
export type OfferOutcomeHistoryRow = {
  status: string
  propertyAddress: string | null
  mao: number | null
  counter: number | null
  sellerAsk: number | null
  cashOffer: number | null
  at: string | null
}

const TRAIL_PATH = path.join(process.cwd(), 'data', 'operating-loops', 'offer-outcomes.jsonl')

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function loadOfferOutcomeHistory(input: { city?: string | null; state?: string | null } = {}): OfferOutcomeHistoryRow[] {
  let lines: string[]
  try {
    lines = fs.readFileSync(TRAIL_PATH, 'utf8').split('\n')
  } catch {
    return []
  }

  const rows: OfferOutcomeHistoryRow[] = []
  for (const line of lines) {
    const text = line.trim()
    if (!text) continue
    try {
      const row = JSON.parse(text)
      const status = String(row.status || '').trim().toLowerCase()
      if (!status) continue
      rows.push({
        status,
        propertyAddress: row.property_address ? String(row.property_address) : null,
        mao: toNumber(row.mao),
        counter: toNumber(row.counter),
        sellerAsk: toNumber(row.seller_ask),
        cashOffer: toNumber(row.cash_offer),
        at: row.at ? String(row.at) : null,
      })
    } catch {
      // skip malformed lines
    }
  }

  // Prefer same-market rows (city match, then state token); fall back to all
  // rows so thin markets still get global calibration.
  const city = String(input.city || '').trim().toLowerCase()
  const state = String(input.state || '').trim().toLowerCase()
  if (city) {
    const cityRows = rows.filter((row) => (row.propertyAddress || '').toLowerCase().includes(city))
    if (cityRows.length >= 3) return cityRows
  }
  if (state) {
    const stateRows = rows.filter((row) =>
      new RegExp(`[,\\s]${state}[\\s,]|[,\\s]${state}$`, 'i').test(row.propertyAddress || '')
    )
    if (stateRows.length >= 3) return stateRows
  }
  return rows
}
