export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { runAttomLeadEnrichment } from '@/lib/property-intelligence/attom-enrichment'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const leadIds = url.searchParams.getAll('leadId').flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean)
  const result = await runAttomLeadEnrichment({
    limit: Number(url.searchParams.get('limit')) || 10,
    mode: url.searchParams.get('mode') === 'full' || url.searchParams.get('mode') === 'equity'
      ? url.searchParams.get('mode') as 'full' | 'equity'
      : 'smart',
    dryRun: url.searchParams.get('dryRun') === 'true',
    leadIds: leadIds.length ? leadIds : undefined,
  })
  return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 503 })
}
