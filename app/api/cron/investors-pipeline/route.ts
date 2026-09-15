export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const requestedDryRun = url.searchParams.get('dryRun')
    const liveEnabled = enabled(process.env.INVESTORS_PIPELINE_CRON_SEND)
    const dryRun = requestedDryRun === null
      ? !liveEnabled
      : enabled(requestedDryRun) || !liveEnabled
    const result = await runDailyInvestorPipeline({ dryRun })
    return NextResponse.json(
      { success: result.ok, dryRun, ...result },
      { status: result.ok ? 200 : 500 }
    )
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor pipeline failed.' }, { status: 500 })
  }
}
