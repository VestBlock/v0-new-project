import 'server-only'

const OPENAI_ADS_BASE_URL = 'https://api.ads.openai.com/v1'

export type OpenAiAdsOverview = {
  configured: boolean
  accountStatus: string | null
  reviewStatus: string | null
  currencyCode: string | null
  impressions: number | null
  clicks: number | null
  spend: number | null
  ctr: number | null
  reportingError: string | null
}

type FetchLike = typeof fetch

function adsApiKey() {
  return String(process.env.OPENAI_ADS_API_KEY || '').trim()
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

async function adsRequest(path: string, fetchImpl: FetchLike) {
  const key = adsApiKey()
  if (!key) throw new Error('OPENAI_ADS_API_KEY is not configured.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetchImpl(`${OPENAI_ADS_BASE_URL}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
      },
      redirect: 'error',
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`OpenAI Ads API returned HTTP ${response.status}.`)
    }
    return (await response.json()) as Record<string, any>
  } finally {
    clearTimeout(timeout)
  }
}

export async function getOpenAiAdsOverview(
  options: { fetchImpl?: FetchLike; now?: Date } = {}
): Promise<OpenAiAdsOverview> {
  if (!adsApiKey()) {
    return {
      configured: false,
      accountStatus: null,
      reviewStatus: null,
      currencyCode: null,
      impressions: null,
      clicks: null,
      spend: null,
      ctr: null,
      reportingError: null,
    }
  }

  const fetchImpl = options.fetchImpl || fetch
  const now = options.now || new Date()
  const start = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000)
  const end = Math.floor(now.getTime() / 1000)

  try {
    const account = await adsRequest('/ad_account', fetchImpl)
    const params = new URLSearchParams({
      time_granularity: 'none',
      aggregation_level: 'campaign',
      limit: '2000',
    })
    for (const field of [
      'campaign.id',
      'campaign.name',
      'campaign.impressions',
      'campaign.clicks',
      'campaign.spend',
    ]) {
      params.append('fields[]', field)
    }
    params.append('time_ranges[]', JSON.stringify({ type: 'unix_range', start, end }))

    let reportingError: string | null = null
    let rows: Array<Record<string, unknown>> = []
    try {
      const report = await adsRequest(`/ad_account/insights?${params.toString()}`, fetchImpl)
      rows = Array.isArray(report.data) ? report.data : []
    } catch (error) {
      reportingError = error instanceof Error ? error.message : 'OpenAI Ads reporting is unavailable.'
    }

    const totals = rows.reduce<{ impressions: number; clicks: number; spend: number }>(
      (sum, row) => ({
        impressions: sum.impressions + safeNumber(row.impressions),
        clicks: sum.clicks + safeNumber(row.clicks),
        spend: sum.spend + safeNumber(row.spend),
      }),
      { impressions: 0, clicks: 0, spend: 0 }
    )

    return {
      configured: true,
      accountStatus: typeof account.status === 'string' ? account.status : null,
      reviewStatus: typeof account.review?.status === 'string' ? account.review.status : null,
      currencyCode: typeof account.currency_code === 'string' ? account.currency_code : null,
      impressions: reportingError ? null : totals.impressions,
      clicks: reportingError ? null : totals.clicks,
      spend: reportingError ? null : Math.round(totals.spend * 100) / 100,
      ctr:
        reportingError || totals.impressions === 0
          ? reportingError
            ? null
            : 0
          : Math.round((totals.clicks / totals.impressions) * 10_000) / 100,
      reportingError,
    }
  } catch (error) {
    return {
      configured: true,
      accountStatus: null,
      reviewStatus: null,
      currencyCode: null,
      impressions: null,
      clicks: null,
      spend: null,
      ctr: null,
      reportingError: error instanceof Error ? error.message : 'OpenAI Ads account verification failed.',
    }
  }
}
