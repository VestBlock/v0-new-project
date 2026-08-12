export type DealMachineSourceEvent = {
  provider?: string | null
  external_event_id?: string | null
  event_type?: string | null
  strategy_key?: string | null
  market?: string | null
  status?: string | null
  rows_received?: number | string | null
  rows_ingested?: number | string | null
  payload_json?: Record<string, unknown> | null
  error_message?: string | null
  occurred_at?: string | null
  processed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type DatabaseDealMachineFreshness = {
  freshCount: number
  staleCount: number
  oldestAgeDays: number | null
  newestAgeDays: number | null
  nextRefreshMarkets: string[]
  topStale: { file: string; ageDays: number; market: string }[]
  latestExportRequest: {
    createdAt: string | null
    ageMinutes: number | null
    totalRows: number
    strategies: string[]
    markets: string[]
    csvPath: null
    guidePath: null
    summaryFile: null
    noDealMachineSkipTraceDefault: boolean
  } | null
  summary: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function timestamp(event: DealMachineSourceEvent) {
  for (const value of [event.occurred_at, event.processed_at, event.created_at, event.updated_at]) {
    const parsed = Date.parse(String(value || ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatMarket(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'All markets'
  if (raw.includes(',')) return raw
  const pieces = raw.split('-').filter(Boolean)
  if (pieces.length < 2) return raw
  const state = pieces.at(-1)!
  const city = pieces
    .slice(0, -1)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(' ')
  return state.length === 2 ? `${city}, ${state.toUpperCase()}` : raw
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

export function buildDatabaseDealMachineFreshness(
  sourceEvents: DealMachineSourceEvent[],
  now = new Date()
): DatabaseDealMachineFreshness | null {
  const events = sourceEvents.filter((event) => String(event.provider || '').toLowerCase() === 'dealmachine')
  if (!events.length) return null

  const pendingExports = events.filter(
    (event) =>
      event.event_type === 'contact_export_needed' &&
      ['received', 'processing'].includes(String(event.status || '').toLowerCase())
  )
  const sourceObservations = events.filter((event) => {
    const eventType = String(event.event_type || '')
    const rows = Number(event.rows_received || 0) + Number(event.rows_ingested || 0)
    return (
      !['cursor_checkpoint', 'contact_export_needed'].includes(eventType) &&
      String(event.status || '').toLowerCase() === 'completed' &&
      rows > 0 &&
      timestamp(event) !== null
    )
  })

  const latestByFeed = new Map<string, DealMachineSourceEvent>()
  for (const event of sourceObservations) {
    const payload = event.payload_json || {}
    const key = [
      event.event_type,
      event.market || payload.market,
      event.strategy_key || payload.strategyKey,
      payload.listId,
      event.market || event.strategy_key || payload.listId ? '' : 'global',
    ].join(':')
    const existing = latestByFeed.get(key)
    if (!existing || (timestamp(event) || 0) > (timestamp(existing) || 0)) latestByFeed.set(key, event)
  }

  const observations = [...latestByFeed.values()].map((event) => {
    const observedAt = timestamp(event)!
    const ageDays = Math.max(0, Math.floor((now.getTime() - observedAt) / DAY_MS))
    const payload = event.payload_json || {}
    const market = formatMarket(event.market || payload.market)
    return {
      file: `database:${event.event_type || 'source'}:${event.external_event_id || 'event'}`,
      ageDays,
      market,
    }
  })
  const fresh = observations.filter((event) => event.ageDays <= 7)
  const stale = observations.filter((event) => event.ageDays > 7).sort((a, b) => b.ageDays - a.ageDays)
  const ages = observations.map((event) => event.ageDays)
  const blockedRecent = events.filter((event) => {
    const eventAt = timestamp(event)
    return (
      eventAt !== null &&
      now.getTime() - eventAt <= 7 * DAY_MS &&
      ['blocked', 'failed'].includes(String(event.status || '').toLowerCase())
    )
  }).length

  const pendingCreatedAt = pendingExports
    .map((event) => timestamp(event))
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0]
  const latestExportRequest = pendingExports.length
    ? {
        createdAt: pendingCreatedAt ? new Date(pendingCreatedAt).toISOString() : null,
        ageMinutes: pendingCreatedAt ? Math.max(0, Math.floor((now.getTime() - pendingCreatedAt) / 60_000)) : null,
        totalRows: pendingExports.length,
        strategies: unique(pendingExports.map((event) => event.strategy_key)),
        markets: unique(pendingExports.map((event) => formatMarket(event.market))),
        csvPath: null,
        guidePath: null,
        summaryFile: null,
        noDealMachineSkipTraceDefault: true,
      }
    : null

  const nextRefreshMarkets = unique([
    ...stale.map((event) => event.market).filter((market) => market !== 'All markets'),
    ...pendingExports.map((event) => formatMarket(event.market)).filter((market) => market !== 'All markets'),
  ]).slice(0, 4)
  const evidenceSummary = observations.length
    ? `${fresh.length} fresh and ${stale.length} stale DealMachine source feed${observations.length === 1 ? '' : 's'} recorded in the production database.`
    : 'No completed DealMachine source feed with rows is recorded in the production database.'
  const pendingSummary = pendingExports.length
    ? ` ${pendingExports.length} contact export${pendingExports.length === 1 ? '' : 's'} waiting for usable contacts.`
    : ''
  const blockedSummary = blockedRecent
    ? ` ${blockedRecent} source attempt${blockedRecent === 1 ? '' : 's'} blocked or failed in the last 7 days.`
    : ''

  return {
    freshCount: fresh.length,
    staleCount: stale.length,
    oldestAgeDays: ages.length ? Math.max(...ages) : null,
    newestAgeDays: ages.length ? Math.min(...ages) : null,
    nextRefreshMarkets,
    topStale: stale.slice(0, 4),
    latestExportRequest,
    summary: `${evidenceSummary}${pendingSummary}${blockedSummary}`,
  }
}
