export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { syncDealMachineLeadSource } from '@/lib/dealmachine/api'
import { getDealMachineConnectionHealth, isDealMachineSourceEnabled } from '@/lib/dealmachine/v2-client.mjs'

const SyncRequestSchema = z.object({
  apply: z.boolean().default(false),
  maxStrategies: z.number().int().min(1).max(17).default(3),
  pageSize: z.number().int().min(1).max(100).default(25),
  startAfter: z.number().int().min(0).max(10_000).default(0),
  page: z.number().int().min(1).max(10_000).default(1),
}).strict()

function statusForHealth(state: string) {
  if (state === 'unauthorized') return 401
  if (state === 'rate_limited') return 429
  if (state === 'provider_unavailable') return 503
  return 409
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const verify = request.nextUrl.searchParams.get('verify') === 'true'
  const health = await getDealMachineConnectionHealth({ verify })
  return NextResponse.json({ success: health.state === 'working', health })
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  if (!isDealMachineSourceEnabled()) {
    return NextResponse.json({
      success: false,
      health: await getDealMachineConnectionHealth(),
      error: 'DEALMACHINE_SOURCE_ENABLED is disabled. Native API synchronization is intentionally blocked.',
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

  const health = await getDealMachineConnectionHealth({ verify: true })
  if (health.state !== 'working') {
    return NextResponse.json({
      success: false,
      health,
      error: health.message,
    }, { status: statusForHealth(health.state) })
  }

  const body = parsed.data
  const result = await syncDealMachineLeadSource({
    dryRun: !body.apply,
    maxPages: body.maxStrategies,
    pageSize: body.pageSize,
    startAfter: body.startAfter,
    page: body.page,
  })
  return NextResponse.json({
    success: result.configured && result.ok,
    health,
    mode: body.apply ? 'native_api_apply' : 'native_api_cost_estimate',
    ...result,
    leads: undefined,
  })
}
