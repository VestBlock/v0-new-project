export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getDailyPublisherConfigFromEnv, runDailyContentPublisher } from '@/lib/content/dailyPublisher'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function parsePositiveIntParam(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseBoolParam(value: string | null) {
  if (!value) return undefined
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false
  return undefined
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(
      url.searchParams.get('dryRun')?.toLowerCase() || ''
    )
    const clusters = url.searchParams
      .get('clusters')
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) as ReturnType<typeof getDailyPublisherConfigFromEnv>['clusters']
    const config = getDailyPublisherConfigFromEnv()
    const result = await runDailyContentPublisher({
      supabase: createAdminClient(),
      actorUserId: null,
      dryRun,
      ...config,
      limit: parsePositiveIntParam(url.searchParams.get('limit')) ?? config.limit,
      preferSpanish: parseBoolParam(url.searchParams.get('preferSpanish')) ?? config.preferSpanish,
      clusters: clusters?.length ? clusters : config.clusters,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Daily content publisher failed.',
      },
      { status: 500 }
    )
  }
}
