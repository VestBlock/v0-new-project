const args = new Set(process.argv.slice(2))
const value = (name, fallback) => {
  const prefix = `--${name}=`
  const found = process.argv.find((arg) => arg.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://vestblock.io').replace(/\/$/, '')
const secret = String(process.env.CRON_SECRET || '').trim()
if (!secret) throw new Error('CRON_SECRET is required to run ATTOM enrichment.')

const url = new URL('/api/cron/attom-enrichment', baseUrl)
url.searchParams.set('limit', value('limit', '10'))
url.searchParams.set('mode', value('mode', 'smart'))
if (args.has('--dry-run')) url.searchParams.set('dryRun', 'true')

const response = await fetch(url, {
  headers: { authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(300_000),
})
const body = await response.json().catch(() => ({}))
console.log(JSON.stringify({
  status: response.status,
  success: body.success,
  dryRun: body.dryRun,
  mode: body.mode,
  selected: body.selected,
  leadsUpdated: body.leadsUpdated,
  propertyRecordsUpdated: body.propertyRecordsUpdated,
  successfulBillableCalls: body.successfulBillableCalls,
  cacheHits: body.cacheHits,
  dailyUsageAfter: body.dailyUsageAfter,
  remainingCalls: body.remainingCalls,
  circuitStatus: body.circuitStatus,
  strategyCounts: body.strategyCounts,
  errors: body.errors,
}, null, 2))
if (!response.ok) process.exitCode = 1
