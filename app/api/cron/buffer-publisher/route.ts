export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { runBufferPublisher } from '@/lib/social/bufferPublisher'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function flag(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const url = new URL(request.url)
  const dryRun = flag(url.searchParams.get('dryRun'))
  const requestedSend = url.searchParams.has('send')
    ? flag(url.searchParams.get('send'))
    : flag(process.env.BUFFER_AUTOPILOT_CRON_SEND)
  const result = await runBufferPublisher({ dryRun, send: requestedSend })
  return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 207 })
}
