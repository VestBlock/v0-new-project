export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const result = await runDailyInvestorPipeline({ dryRun })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor pipeline failed.' }, { status: 500 })
  }
}
