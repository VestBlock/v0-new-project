export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyLeadEmailEnrichment } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const budgetMs = Number.parseInt(url.searchParams.get('budgetMs') || '', 10)

    if (Number.isFinite(limit) && limit > 0) {
      process.env.LEADS_DAILY_EMAIL_ENRICH_LIMIT = String(limit)
    }

    const result = await runDailyLeadEmailEnrichment({
      dryRun,
      budgetMs: Number.isFinite(budgetMs) && budgetMs >= 1000 ? budgetMs : undefined,
    })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead email enrichment failed.' },
      { status: 500 }
    )
  }
}
