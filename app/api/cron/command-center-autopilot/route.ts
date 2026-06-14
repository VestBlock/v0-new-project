export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { runCommandCenterAutopilot } from '@/lib/admin/autonomousOperatingSystem'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = !['0', 'false', 'no'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const dispatch = ['1', 'true', 'yes'].includes(url.searchParams.get('dispatch')?.toLowerCase() || '')
    const send = ['1', 'true', 'yes'].includes(url.searchParams.get('send')?.toLowerCase() || '')
    const data = await getCommandCenterData()
    const result = await runCommandCenterAutopilot(data, { dryRun, dispatch, send })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Command-center autopilot cron failed.' },
      { status: 500 }
    )
  }
}
