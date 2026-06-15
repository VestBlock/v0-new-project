export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { getCommandCenterData } from '@/lib/admin/commandCenter'
import { runCommandCenterAutopilot } from '@/lib/admin/autonomousOperatingSystem'
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
    const dispatch = paramFlag(url, 'dispatch') ?? envFlag('COMMAND_CENTER_AUTOPILOT_CRON_DISPATCH')
    const send = paramFlag(url, 'send') ?? envFlag('COMMAND_CENTER_AUTOPILOT_CRON_SEND')
    const dryRunParam = paramFlag(url, 'dryRun')
    const dryRun = dryRunParam ?? !(dispatch || send)
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
