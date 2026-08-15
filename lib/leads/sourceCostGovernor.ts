import 'server-only'

export type SourceCostProvider =
  | 'dealmachine'
  | 'homeharvest'
  | 'google_places'
  | 'outscraper'
  | 'instantly'
  | 'public_records'
  | 'manual_csv'

export type SourceCostStatus = 'allowed' | 'blocked' | 'cooldown' | 'manual_review'

export type SourceCostDecision = {
  provider: SourceCostProvider
  label: string
  status: SourceCostStatus
  canRun: boolean
  costTier: 'owned' | 'free' | 'paid' | 'manual'
  reason: string
  dailyLimit: number
  usedToday: number
  cooldownHours: number
  lastRunAt: string | null
  nextAllowedAt: string | null
}

export type SourceGovernorSnapshot = {
  status: 'green' | 'yellow' | 'red'
  summary: string
  paidSourcesBlocked: number
  cooldownsActive: number
  lanes: SourceCostDecision[]
  nextActions: string[]
}

type EnvShape = Record<string, string | undefined>

type SourcePolicy = {
  provider: SourceCostProvider
  label: string
  costTier: SourceCostDecision['costTier']
  dailyLimit: number
  cooldownHours: number
  requiresPaidApproval?: boolean
  requiresApiKey?: string
  envEnableFlag?: string
  defaultEnabled?: boolean
}

type SourceCostInput = {
  now?: Date
  usedToday?: number
  lastRunAt?: string | null
  env?: EnvShape
  policy?: Partial<SourcePolicy>
}

type SourceGovernorInput = {
  now?: Date
  scrapeRuns?: Array<Record<string, any>>
  /** Historical only. Retained for compatibility; never used to authorize or pace the native API. */
  dealMachineExports?: Array<{ file: string; ageDays: number }>
  env?: EnvShape
}

const DEFAULT_POLICIES: Record<SourceCostProvider, SourcePolicy> = {
  dealmachine: {
    provider: 'dealmachine',
    label: 'DealMachine native API',
    costTier: 'owned',
    dailyLimit: 4,
    cooldownHours: 18,
    requiresApiKey: 'DEALMACHINE_API_KEY',
    envEnableFlag: 'DEALMACHINE_SOURCE_ENABLED',
    defaultEnabled: false,
  },
  homeharvest: {
    provider: 'homeharvest',
    label: 'Public on-market sweep',
    costTier: 'free',
    dailyLimit: 8,
    cooldownHours: 12,
    defaultEnabled: true,
  },
  google_places: {
    provider: 'google_places',
    label: 'Google Places',
    costTier: 'paid',
    dailyLimit: 3,
    cooldownHours: 24,
    requiresApiKey: 'GOOGLE_PLACES_API_KEY',
    envEnableFlag: 'LEADS_ENABLE_GOOGLE_PLACES',
    defaultEnabled: false,
  },
  outscraper: {
    provider: 'outscraper',
    label: 'Outscraper',
    costTier: 'paid',
    dailyLimit: 4,
    cooldownHours: 12,
    requiresPaidApproval: true,
    requiresApiKey: 'OUTSCRAPER_API_KEY',
    envEnableFlag: 'LEADS_ENABLE_OUTSCRAPER',
    defaultEnabled: false,
  },
  instantly: {
    provider: 'instantly',
    label: 'Instantly network database and outreach',
    costTier: 'paid',
    dailyLimit: 2,
    cooldownHours: 0,
    requiresApiKey: 'INSTANTLY_API_KEY',
    envEnableFlag: 'LEADS_ENABLE_INSTANTLY',
    defaultEnabled: false,
  },
  public_records: {
    provider: 'public_records',
    label: 'County/public record sources',
    costTier: 'free',
    dailyLimit: 10,
    cooldownHours: 12,
    defaultEnabled: true,
  },
  manual_csv: {
    provider: 'manual_csv',
    label: 'Manual CSV imports',
    costTier: 'manual',
    dailyLimit: 20,
    cooldownHours: 0,
    defaultEnabled: true,
  },
}

function envBool(env: EnvShape, name: string, fallback = false) {
  const raw = env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function envInt(env: EnvShape, name: string, fallback: number) {
  const parsed = Number.parseInt(env[name] || '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function hoursBetween(left: Date, rightIso: string | null | undefined) {
  if (!rightIso) return Number.POSITIVE_INFINITY
  const right = Date.parse(rightIso)
  if (!Number.isFinite(right)) return Number.POSITIVE_INFINITY
  return Math.max(0, (left.getTime() - right) / 36e5)
}

function nextAllowedAt(now: Date, lastRunAt: string | null, cooldownHours: number) {
  if (!lastRunAt || cooldownHours <= 0) return null
  const parsed = Date.parse(lastRunAt)
  if (!Number.isFinite(parsed)) return null
  const next = new Date(parsed + cooldownHours * 36e5)
  return next > now ? next.toISOString() : null
}

export function isPaidScrapingApproved(env: EnvShape = process.env) {
  return envBool(env, 'ALLOW_PAID_SCRAPING', false)
}

export function isOutscraperApproved(env: EnvShape = process.env) {
  return (
    isPaidScrapingApproved(env) &&
    envBool(env, 'LEADS_ENABLE_OUTSCRAPER', false) &&
    Boolean(env.OUTSCRAPER_API_KEY?.trim())
  )
}

export function assertOutscraperApproved(env: EnvShape = process.env) {
  if (!isOutscraperApproved(env)) {
    throw new Error(
      'Outscraper is quarantined until revenue justifies paid scraping. Set ALLOW_PAID_SCRAPING=true, LEADS_ENABLE_OUTSCRAPER=true, and OUTSCRAPER_API_KEY to override intentionally.'
    )
  }
}

export function evaluateSourceCost(provider: SourceCostProvider, input: SourceCostInput = {}): SourceCostDecision {
  const env = input.env || process.env
  const base = DEFAULT_POLICIES[provider]
  const policy = { ...base, ...(input.policy || {}) }
  const now = input.now || new Date()
  const dailyLimit = envInt(env, `SOURCE_LIMIT_${provider.toUpperCase()}_DAILY`, policy.dailyLimit)
  const usedToday = Math.max(0, Math.round(input.usedToday || 0))
  const lastRunAt = input.lastRunAt || null
  const cooldownHours = envInt(env, `SOURCE_COOLDOWN_${provider.toUpperCase()}_HOURS`, policy.cooldownHours)
  const enabled = policy.envEnableFlag
    ? envBool(env, policy.envEnableFlag, Boolean(policy.defaultEnabled))
    : Boolean(policy.defaultEnabled)

  if (!enabled) {
    return {
      provider,
      label: policy.label,
      status: 'blocked',
      canRun: false,
      costTier: policy.costTier,
      reason:
        provider === 'outscraper'
            ? 'Paid scraper disabled. Enable only with funded credits, ALLOW_PAID_SCRAPING=true, LEADS_ENABLE_OUTSCRAPER=true, and a daily source limit.'
          : 'Source disabled by environment policy.',
      dailyLimit,
      usedToday,
      cooldownHours,
      lastRunAt,
      nextAllowedAt: null,
    }
  }

  if (policy.requiresPaidApproval && !isPaidScrapingApproved(env)) {
    return {
      provider,
      label: policy.label,
      status: 'blocked',
      canRun: false,
      costTier: policy.costTier,
      reason: 'Paid scraping approval is off.',
      dailyLimit,
      usedToday,
      cooldownHours,
      lastRunAt,
      nextAllowedAt: null,
    }
  }

  if (policy.requiresApiKey && !env[policy.requiresApiKey]?.trim()) {
    return {
      provider,
      label: policy.label,
      status: 'blocked',
      canRun: false,
      costTier: policy.costTier,
      reason: `${policy.requiresApiKey} is not configured.`,
      dailyLimit,
      usedToday,
      cooldownHours,
      lastRunAt,
      nextAllowedAt: null,
    }
  }

  if (dailyLimit > 0 && usedToday >= dailyLimit) {
    return {
      provider,
      label: policy.label,
      status: 'cooldown',
      canRun: false,
      costTier: policy.costTier,
      reason: `Daily source limit reached (${usedToday}/${dailyLimit}).`,
      dailyLimit,
      usedToday,
      cooldownHours,
      lastRunAt,
      nextAllowedAt: null,
    }
  }

  const ageHours = hoursBetween(now, lastRunAt)
  const nextAt = nextAllowedAt(now, lastRunAt, cooldownHours)
  if (Number.isFinite(ageHours) && ageHours < cooldownHours) {
    return {
      provider,
      label: policy.label,
      status: 'cooldown',
      canRun: false,
      costTier: policy.costTier,
      reason: `Cooldown active for ${Math.ceil(cooldownHours - ageHours)} more hour${Math.ceil(cooldownHours - ageHours) === 1 ? '' : 's'}.`,
      dailyLimit,
      usedToday,
      cooldownHours,
      lastRunAt,
      nextAllowedAt: nextAt,
    }
  }

  return {
    provider,
    label: policy.label,
    status: policy.costTier === 'manual' ? 'manual_review' : 'allowed',
    canRun: policy.costTier !== 'manual',
    costTier: policy.costTier,
    reason: policy.costTier === 'manual' ? 'Manual source, import only after review.' : 'Source is within budget and cooldown policy.',
    dailyLimit,
    usedToday,
    cooldownHours,
    lastRunAt,
    nextAllowedAt: null,
  }
}

function sourceKeyMatches(row: Record<string, any>, provider: SourceCostProvider) {
  const source = String(row.source_key || row.source || '').toLowerCase()
  if (provider === 'dealmachine') return source.includes('dealmachine')
  if (provider === 'homeharvest') return source.includes('homeharvest') || source.includes('stale_listing')
  if (provider === 'google_places') return source.includes('google_places')
  if (provider === 'outscraper') return source.includes('outscraper')
  if (provider === 'instantly') return source.includes('instantly')
  if (provider === 'public_records') return /code|tax|probate|preforeclosure|vacant|accela|cincinnati|milwaukee/.test(source)
  return source.includes('csv')
}

function recentRunsForProvider(
  scrapeRuns: Array<Record<string, any>>,
  provider: SourceCostProvider,
  now: Date
) {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const rows = scrapeRuns.filter((row) => sourceKeyMatches(row, provider))
  const usedToday = rows.filter((row) => {
    const at = Date.parse(row.started_at || row.created_at || row.completed_at || '')
    return Number.isFinite(at) && at >= todayStart.getTime()
  }).length
  const latest = rows
    .map((row) => String(row.started_at || row.created_at || row.completed_at || ''))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
  return { usedToday, latest }
}

export function buildSourceGovernorSnapshot(input: SourceGovernorInput = {}): SourceGovernorSnapshot {
  const now = input.now || new Date()
  const env = input.env || process.env
  const scrapeRuns = input.scrapeRuns || []
  const providers: SourceCostProvider[] = [
    'dealmachine',
    'homeharvest',
    'public_records',
    'google_places',
    'outscraper',
    'instantly',
    'manual_csv',
  ]
  const lanes = providers.map((provider) => {
    const runStats = recentRunsForProvider(scrapeRuns, provider, now)
    return evaluateSourceCost(provider, {
      now,
      env,
      usedToday: runStats.usedToday,
      lastRunAt: runStats.latest,
    })
  })

  const paidSourcesBlocked = lanes.filter((lane) => lane.costTier === 'paid' && lane.status === 'blocked').length
  const cooldownsActive = lanes.filter((lane) => lane.status === 'cooldown').length
  const runnable = lanes.filter((lane) => lane.canRun && lane.status === 'allowed').length
  const red = lanes.some((lane) => lane.provider === 'dealmachine' && lane.status === 'blocked')
  const status: SourceGovernorSnapshot['status'] = red ? 'red' : paidSourcesBlocked > 0 || cooldownsActive > 0 ? 'yellow' : 'green'

  const nextActions = [
    paidSourcesBlocked > 0 ? 'Keep paid sources controlled until funded credits, explicit approval flags, and daily source limits are configured.' : null,
    cooldownsActive > 0 ? 'Do not rerun cooled-down markets; rotate into a different source or market first.' : null,
    runnable > 0 ? 'Use allowed lanes first: verified DealMachine native API records, public records, HomeHarvest/on-market sweeps, Instantly network building, or reviewed manual CSV.' : null,
  ].filter(Boolean) as string[]

  return {
    status,
    summary:
      status === 'green'
        ? 'Source usage is clean: allowed lanes are available and paid scrapers are inside configured limits.'
        : 'Source governor is protecting usage by blocking unapproved paid scrapers or cooling down repeated runs.',
    paidSourcesBlocked,
    cooldownsActive,
    lanes,
    nextActions,
  }
}
