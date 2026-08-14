export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { createOpportunityMatch, listAdminOpportunityMatches } from '@/lib/matching/opportunity-matches'
import { guardPublicMutation } from '@/lib/security/public-mutation'

const createSchema = z.object({
  participantProfileId: z.string().uuid(),
  strategyVersionId: z.string().uuid().nullable(),
  targetEntityType: z.enum(['seller_case', 'capital_case', 'dealvault_opportunity', 'crm_lead', 'participant_profile', 'business_opportunity', 'roadmap_action']),
  targetEntityId: z.string().trim().min(1).max(200),
  score: z.number().min(0).max(100),
  scoreExplanation: z.record(z.string(), z.unknown()),
  exclusions: z.array(z.string().trim().max(500)).max(30).default([]),
  sourceProvenance: z.array(z.object({
    source: z.string().trim().min(2).max(500),
    observedAt: z.string().datetime(),
  }).passthrough()).min(1).max(20),
  sourceObservedAt: z.string().datetime().nullable().optional(),
  uncertainty: z.enum(['low', 'medium', 'high']),
  customerSafeSummary: z.string().trim().min(20).max(1200),
  operatorOwnerUserId: z.string().uuid().nullable().optional(),
})

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}
export async function GET() {
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) return json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  try {
    return json({ matches: await listAdminOpportunityMatches() })
  } catch (error) {
    console.error('[opportunity-matches] list failed', error)
    return json({ error: 'Opportunity matches are temporarily unavailable.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const guard = guardPublicMutation(request, { scope: 'opportunity-match-create', maxRequests: 40 })
  if (guard) return guard
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) return json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Check the match criteria and provenance.', details: parsed.error.flatten() }, { status: 400 })
  try {
    return json(await createOpportunityMatch(parsed.data), { status: 201 })
  } catch (error) {
    console.error('[opportunity-matches] create failed', error)
    return json({ error: error instanceof Error ? error.message : 'Unable to create the match.' }, { status: 422 })
  }
}
