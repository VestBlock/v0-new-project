export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { syncDealMachineLeadSource } from '@/lib/dealmachine/api'
import { isPropertyIntelligenceFeatureEnabled } from '@/lib/property-intelligence/feature-flags'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  if (!isPropertyIntelligenceFeatureEnabled('DEALMACHINE_SYNC_ENABLED')) {
    return NextResponse.json({
      success: false,
      error: 'DEALMACHINE_SYNC_ENABLED is disabled. Manual sync route is installed but intentionally blocked.',
    }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const apply = body?.apply === true
  const result = await syncDealMachineLeadSource({
    dryRun: !apply,
    maxPages: Math.min(17, Math.max(1, Number(body?.maxStrategies || 3))),
    pageSize: Math.min(100, Math.max(1, Number(body?.pageSize || 25))),
    startAfter: Math.max(0, Number(body?.startAfter || 0)),
  })
  return NextResponse.json({
    success: result.configured && result.ok,
    mode: apply ? 'official_v2_search_apply' : 'official_v2_free_estimate',
    ...result,
    leads: undefined,
  })
}
