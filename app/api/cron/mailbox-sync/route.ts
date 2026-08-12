export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { syncOutlookMailbox } from '@/lib/email/outlookMailbox'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const result = await syncOutlookMailbox({ dryRun: false, sinceHours: 72, limit: 100 })
  return NextResponse.json(
    { success: result.ok, ...result },
    { status: result.ok ? 200 : 503 }
  )
}
