export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
import { runDailyInvestorPipeline } from '@/lib/investors/automation'
import { runDailyLenderPipeline } from '@/lib/lenders/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

function settle<T>(result: PromiseSettledResult<T>) {
  return result.status === 'fulfilled'
    ? {
        ok: !(
          result.value &&
          typeof result.value === 'object' &&
          'ok' in result.value &&
          result.value.ok === false
        ),
        result: result.value,
      }
    : { ok: false as const, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRunParam = url.searchParams.get('dryRun')
  const liveEnabled = enabled(process.env.PARTNER_PIPELINE_CRON_SEND || process.env.BUYERS_PIPELINE_CRON_SEND)
  const dryRun = dryRunParam === null ? !liveEnabled : enabled(dryRunParam)
  const [buyers, lenders, investors] = await Promise.allSettled([
    runDailyBuyerPipeline({ dryRun }),
    runDailyLenderPipeline({ dryRun }),
    runDailyInvestorPipeline({ dryRun }),
  ])
  const lanes = { buyers: settle(buyers), lenders: settle(lenders), investors: settle(investors) }
  const ok = Object.values(lanes).every((lane) => lane.ok)
  return NextResponse.json({ success: ok, dryRun, lanes }, { status: ok ? 200 : 207 })
}
