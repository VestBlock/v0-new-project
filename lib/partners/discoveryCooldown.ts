import { createAdminClient } from '@/lib/supabase/admin'

type DiscoveryRunTable = 'buyer_outreach_runs' | 'lender_outreach_runs' | 'investor_automation_runs'
type CompletedAtColumn = 'completed_at' | 'finished_at'

type RecentDiscoveryRun = {
  id: string
  started_at: string | null
  request_params: Record<string, unknown> | null
  completedAt: string | null
}

function normalizeValue(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function sameMarket(requestParams: Record<string, unknown> | null | undefined, city: string, state: string) {
  if (!requestParams) return false
  return normalizeValue(requestParams.city) === normalizeValue(city) && normalizeValue(requestParams.state) === normalizeValue(state)
}

export async function findRecentDiscoveryRun(input: {
  table: DiscoveryRunTable
  completedAtColumn: CompletedAtColumn
  sourceKey: string
  city: string
  state: string
  cooldownHours: number
}) {
  if (input.cooldownHours <= 0) return null

  const admin = createAdminClient()
  const since = new Date(Date.now() - input.cooldownHours * 60 * 60 * 1000).toISOString()
  const selectColumns = `id,started_at,${input.completedAtColumn},request_params`

  const { data, error } = await admin
    .from(input.table)
    .select(selectColumns)
    .eq('run_type', 'discovery')
    .eq('source_key', input.sourceKey)
    .eq('status', 'completed')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(40)

  if (error) {
    console.warn(`[discovery-cooldown] ${input.table} query failed:`, error.message)
    return null
  }

  const rows = ((data || []) as unknown[]) as Array<Record<string, unknown>>
  const recent = rows.find((row) => sameMarket((row.request_params as Record<string, unknown> | null | undefined) || null, input.city, input.state))
  if (!recent) return null

  return {
    id: String(recent.id || ''),
    started_at: typeof recent.started_at === 'string' ? recent.started_at : null,
    request_params: (recent.request_params as Record<string, unknown> | null | undefined) || null,
    completedAt:
      typeof recent[input.completedAtColumn] === 'string'
        ? (recent[input.completedAtColumn] as string)
        : typeof recent.started_at === 'string'
          ? recent.started_at
          : null,
  } satisfies RecentDiscoveryRun
}

export function buildDiscoveryCooldownMessage(input: {
  label: string
  city: string
  state: string
  cooldownHours: number
  completedAt?: string | null
}) {
  const completedAtLabel = input.completedAt ? new Date(input.completedAt).toLocaleString() : 'recently'
  return `Skipped duplicate ${input.label} discovery for ${input.city}, ${input.state}. A completed run already covered this market at ${completedAtLabel}, inside the ${input.cooldownHours}h cooldown window.`
}
