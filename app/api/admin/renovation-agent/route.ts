export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAccess } from '@/lib/auth/admin'
import { buildRenovationEstimate, refineEstimateWithAi } from '@/lib/admin/renovationAgent'

const inputSchema = z.object({
  squareFeet: z.coerce.number().min(300).max(20000),
  scope: z.enum(['cosmetic', 'moderate', 'full', 'structural']),
  state: z.string().trim().max(2).optional().default(''),
  bedrooms: z.coerce.number().min(0).max(20).optional(),
  bathrooms: z.coerce.number().min(0).max(20).optional(),
  yearBuilt: z.coerce.number().min(1800).max(2030).optional(),
  conditionNotes: z.string().trim().max(2000).optional().default(''),
  arv: z.coerce.number().min(0).max(50000000).optional(),
  askingPrice: z.coerce.number().min(0).max(50000000).optional(),
})

export async function POST(request: NextRequest) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provide at least squareFeet (300+) and a scope (cosmetic/moderate/full/structural).' },
      { status: 400 }
    )
  }

  try {
    const base = buildRenovationEstimate(parsed.data)
    const estimate = await refineEstimateWithAi(base, parsed.data)
    return NextResponse.json({ success: true, estimate })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Renovation estimate failed.' },
      { status: 500 }
    )
  }
}
