export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { createPartnerPortalAccess } from '@/lib/partners/portal'

const requestSchema = z.object({
  partnerType: z.enum(['lender', 'buyer']),
  partnerId: z.string().uuid(),
  label: z.string().max(120).optional(),
})

export async function POST(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const parsed = requestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const table = parsed.data.partnerType === 'lender' ? 'lenders' : 'buyers'
  const { data: partner, error } = await admin
    .from(table)
    .select('id,name,contact_email')
    .eq('id', parsed.data.partnerId)
    .single()

  if (error || !partner) {
    return NextResponse.json({ error: `${parsed.data.partnerType} not found.` }, { status: 404 })
  }

  try {
    const result = await createPartnerPortalAccess({
      partnerType: parsed.data.partnerType,
      partnerId: parsed.data.partnerId,
      partnerName: partner.name,
      contactEmail: partner.contact_email,
      label: parsed.data.label || 'primary',
      metadata: { issuedByUserId: user?.id || null },
    })

    return NextResponse.json({
      success: true,
      url: result.url,
      access: result.access,
      partnerName: partner.name,
    })
  } catch (createError) {
    return NextResponse.json(
      { error: createError instanceof Error ? createError.message : 'Failed to create portal access.' },
      { status: 500 }
    )
  }
}
