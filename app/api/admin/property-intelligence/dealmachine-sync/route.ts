export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { runDealMachinePropertyDiscovery } from '@/lib/dealmachine/api'
import {
  getDealMachineConnectionHealth,
  isDealMachineDiscoveryEnabled,
} from '@/lib/dealmachine/v2-client.mjs'

const SyncRequestSchema = z.object({
  mode: z.enum(['count_only', 'property_sample']).default('count_only'),
  strategyKeys: z.array(z.string().trim().min(1).max(100)).min(1).max(16).optional(),
  maxStrategies: z.number().int().min(1).max(16).default(3),
  sampleSize: z.number().int().min(1).max(10).default(5),
  startAfter: z.number().int().min(0).max(15).default(0),
  approvalReference: z.string().trim().min(8).max(128).regex(/^[a-z0-9][a-z0-9_.:/-]+$/i).optional(),
}).strict()

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const verify = request.nextUrl.searchParams.get('verify') === 'true' && isDealMachineDiscoveryEnabled()
  const health = await getDealMachineConnectionHealth({ verify })
  return NextResponse.json({ success: health.state === 'working', health })
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  if (!isDealMachineDiscoveryEnabled()) {
    return NextResponse.json({
      success: false,
      health: await getDealMachineConnectionHealth(),
      error: 'DEALMACHINE_DISCOVERY_ENABLED is disabled. No provider request was made.',
    }, { status: 403 })
  }

  const parsed = SyncRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({
      success: false,
      error: 'Invalid DealMachine sync request.',
      issues: parsed.error.flatten(),
    }, { status: 400 })
  }

  const body = parsed.data
  if (body.mode === 'property_sample' && !body.approvalReference) {
    return NextResponse.json({
      success: false,
      error: 'A reviewed opaque approvalReference is required for a billable property sample.',
    }, { status: 400 })
  }
  const result = await runDealMachinePropertyDiscovery({
    mode: body.mode,
    strategyKeys: body.strategyKeys,
    maxStrategies: body.maxStrategies,
    sampleSize: body.sampleSize,
    startAfter: body.startAfter,
    approvalReference: body.approvalReference,
  })
  const health = await getDealMachineConnectionHealth()
  return NextResponse.json({
    success: result.configured && result.ok,
    health,
    ...result,
  })
}
