export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { runDailyOperatingLoop } from '@/lib/admin/dailyOperatingLoop'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function paramFlag(url: URL, name: string) {
  const value = url.searchParams.get(name)
  if (value === null) return null
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function envFlag(name: string) {
  return ['1', 'true', 'yes', 'on'].includes((process.env[name] || '').toLowerCase())
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dispatch = paramFlag(url, 'dispatch') ?? envFlag('BOSS_DAILY_LOOP_CRON_DISPATCH')
    const send = paramFlag(url, 'send') ?? envFlag('BOSS_DAILY_LOOP_CRON_SEND')
    const syncMailbox = paramFlag(url, 'syncMailbox') ?? true
    const dryRunParam = paramFlag(url, 'dryRun')
    const dryRun = dryRunParam ?? !(dispatch || send)
    const result = await runDailyOperatingLoop({ dryRun, dispatch, send, syncMailbox })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Boss daily loop failed.' },
      { status: 500 }
    )
  }
}
