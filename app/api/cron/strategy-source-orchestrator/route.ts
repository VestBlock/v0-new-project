export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { runStrategySourceOrchestrator } from '@/lib/admin/strategySourceOrchestrator'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function flag(value: string | null) {
  return value !== null && /^(1|true|yes|on)$/i.test(value)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>
    return [row.message, row.details, row.hint, row.code].filter(Boolean).map(String).join(' | ') || JSON.stringify(row)
  }
  return String(error || 'Strategy source orchestration failed.')
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const result = await runStrategySourceOrchestrator({
      dryRun: flag(url.searchParams.get('dryRun')),
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ success: false, error: errorMessage(error) }, { status: 500 })
  }
}
