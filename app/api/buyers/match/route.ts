export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buyerMatchRequestSchema } from '@/lib/buyers/schemas'
import { persistPropertyBuyerMatches } from '@/lib/buyers/service'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = buyerMatchRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const matches = await persistPropertyBuyerMatches(parsed.data)
  return NextResponse.json({ matches })
}
