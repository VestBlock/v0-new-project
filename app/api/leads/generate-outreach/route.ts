export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { generateOutreachSchema } from '@/lib/leads/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreOutreachForLead } from '@/lib/leads/service'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = generateOutreachSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: leads, error } = await admin
      .from('leads')
      .select('*')
      .in('id', parsed.data.leadIds)

    if (error) throw error

    const results = []
    for (const lead of leads || []) {
      results.push({
        leadId: lead.id,
        messages: await generateAndStoreOutreachForLead(lead as any),
      })
    }

    return NextResponse.json({ success: true, count: results.length, results })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Outreach generation failed.' },
      { status: 500 }
    )
  }
}
