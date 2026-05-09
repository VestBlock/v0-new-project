export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyLeadScrape } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const scrapeLimitPerSource = Number.parseInt(url.searchParams.get('scrapeLimitPerSource') || '', 10)
    const marketCount = Number.parseInt(url.searchParams.get('marketCount') || '', 10)

    if (Number.isFinite(marketCount) && marketCount > 0) {
      process.env.LEADS_DAILY_MARKET_COUNT = String(marketCount)
    }

    const result = await runDailyLeadScrape({
      dryRun,
      scrapeLimitPerSource: Number.isFinite(scrapeLimitPerSource) && scrapeLimitPerSource > 0 ? scrapeLimitPerSource : undefined,
    })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead scrape failed.' },
      { status: 500 }
    )
  }
}
