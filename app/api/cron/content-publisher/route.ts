export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { getDailyPublisherConfigFromEnv, runDailyContentPublisher } from '@/lib/content/dailyPublisher'
import { runVideoContentPilot } from '@/lib/content/video/automation'
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
    const admin = createAdminClient()
    // Start the SEO and private-video lanes independently. A failure or timeout
    // in one must not prevent the scheduler from exercising the other.
    const [seoOutcome, videoOutcome] = await Promise.allSettled([
      runDailyContentPublisher({
        supabase: admin,
        actorUserId: null,
        dryRun,
        ...config,
        limit: parsePositiveIntParam(url.searchParams.get('limit')) ?? config.limit,
        preferSpanish:
          parseBoolParam(url.searchParams.get('preferSpanish')) ?? config.preferSpanish,
        clusters: clusters?.length ? clusters : config.clusters,
      }),
      dryRun
        ? Promise.resolve({ status: 'skipped' as const, reason: 'dry_run' as const })
        : runVideoContentPilot({ supabase: admin }),
    ])
    const seoPublisherSucceeded = seoOutcome.status === 'fulfilled'
    const videoContentPilot =
      videoOutcome.status === 'fulfilled'
        ? videoOutcome.value
        : {
            status: 'failed',
            error:
              videoOutcome.reason instanceof Error
                ? videoOutcome.reason.message
                : 'Video content pilot failed.',
          }
    const videoLaneHealthy =
      dryRun || !['blocked', 'failed'].includes(videoContentPilot.status)
    return NextResponse.json(
      {
        success: seoPublisherSucceeded && videoLaneHealthy,
        seoPublisherSucceeded,
        seoPublisherError:
          seoOutcome.status === 'rejected'
            ? seoOutcome.reason instanceof Error
              ? seoOutcome.reason.message
              : 'Daily content publisher failed.'
            : null,
        dryRun,
        ...(seoOutcome.status === 'fulfilled' ? seoOutcome.value : {}),
        videoContentPilot,
      },
      { status: seoPublisherSucceeded && videoLaneHealthy ? 200 : 503 }
    )
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
