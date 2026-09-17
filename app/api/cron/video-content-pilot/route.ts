export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { runVideoContentPilot } from '@/lib/content/video/automation'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  try {
    const result = await runVideoContentPilot({ supabase: createAdminClient() })
    const healthy = !['blocked', 'failed'].includes(result.status)
    return NextResponse.json(
      {
        success: healthy,
        ...result,
      },
      { status: healthy ? 200 : 503 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video content pilot automation failed.' },
      { status: 500 }
    )
  }
}
