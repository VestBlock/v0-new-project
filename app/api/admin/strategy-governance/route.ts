export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import {
  PLATFORM_STRATEGY_LANES,
  createStrategyProposal,
  getStrategyGovernanceSnapshot,
} from '@/lib/strategy/governance'

function response(body: unknown, init?: ResponseInit) {
  const result = NextResponse.json(body, init)
  result.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return result
}
const proposalSchema = z.object({
  laneKey: z.enum(PLATFORM_STRATEGY_LANES),
  title: z.string().trim().min(8).max(180),
  rationale: z.string().trim().min(20).max(4000),
  contractPatch: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, 'A contract change is required.'),
  sourcedFacts: z.array(z.object({
    claim: z.string().trim().min(3).max(1000),
    source: z.string().trim().min(3).max(500),
    observedAt: z.string().datetime(),
    sourceUrl: z.string().url().optional(),
  }).passthrough()).min(1).max(20),
  aiInferences: z.array(z.object({
    inference: z.string().trim().min(3).max(1000),
    confidence: z.number().min(0).max(1),
  }).passthrough()).max(20).default([]),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
})

export async function GET() {
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) return response({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  try {
    return response(await getStrategyGovernanceSnapshot())
  } catch (error) {
    console.error('[strategy-governance] snapshot failed', error)
    return response({ error: 'Strategy governance data is temporarily unavailable.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = guardPublicMutation(request, { scope: 'strategy-governance-proposal', maxRequests: 20 })
  if (guard) return guard
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) return response({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  const parsed = proposalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return response({ error: 'Check the proposed change and evidence.', details: parsed.error.flatten() }, { status: 400 })
  try {
    return response({ proposal: await createStrategyProposal(parsed.data) }, { status: 201 })
  } catch (error) {
    console.error('[strategy-governance] proposal failed', error)
    return response({ error: error instanceof Error ? error.message : 'Unable to save the strategy proposal.' }, { status: 500 })
  }
}
