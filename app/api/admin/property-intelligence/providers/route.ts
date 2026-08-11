export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { futureProviderStubs } from '@/lib/property-intelligence/adapters'
import { isDealMachineConfigured } from '@/lib/property-intelligence/dealmachine-adapter'
import { propertyIntelligenceFeatureSnapshot } from '@/lib/property-intelligence/feature-flags'

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  return NextResponse.json({
    features: propertyIntelligenceFeatureSnapshot(),
    providers: {
      ...futureProviderStubs,
      dealmachine: {
        ...futureProviderStubs.dealmachine,
        configured: isDealMachineConfigured(),
        enabled: propertyIntelligenceFeatureSnapshot().DEALMACHINE_SYNC_ENABLED,
      },
    },
  })
}
