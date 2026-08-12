export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { runAttomLeadEnrichment } from '@/lib/property-intelligence/attom-enrichment'
import { getAttomProviderStatus } from '@/lib/property-intelligence/attom-client'

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response
  return NextResponse.json({ provider: getAttomProviderStatus() })
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const result = await runAttomLeadEnrichment({
      limit: Number(body.limit) || 10,
      mode: body.mode === 'full' || body.mode === 'equity' ? body.mode : 'smart',
      dryRun: body.dryRun === true,
      leadIds: Array.isArray(body.leadIds) ? body.leadIds.map(String) : undefined,
    })
    return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'ATTOM enrichment failed.',
    }, { status: 500 })
  }
}
