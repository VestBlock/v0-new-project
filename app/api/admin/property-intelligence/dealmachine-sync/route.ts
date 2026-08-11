export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { fetchDealMachineLeads } from '@/lib/property-intelligence/dealmachine-adapter'
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

  const result = await fetchDealMachineLeads()
  return NextResponse.json({ success: result.configured && !result.error, ...result })
}
