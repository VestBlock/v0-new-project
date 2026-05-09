export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { leadScoreRequestSchema } from '@/lib/leads/schemas'
import { scoreAndPersistLead } from '@/lib/leads/service'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = leadScoreRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    let query = admin.from('leads').select('*').order('created_at', { ascending: false }).limit(300)

    if (parsed.data.leadIds?.length) query = query.in('id', parsed.data.leadIds)

    const { data: leads, error } = await query
    if (error) throw error

    const saved = []
    for (const lead of leads || []) {
      const score = await scoreAndPersistLead(lead as any, {
        category: (lead as any).category,
        leadType: (lead as any).lead_type,
        name: (lead as any).name,
        businessName: (lead as any).business_name,
        email: (lead as any).email,
        phone: (lead as any).phone,
        sourceUrl: (lead as any).source_url,
        painSignal: (lead as any).pain_signal,
        source: (lead as any).source || 'lead_intelligence',
      })
      saved.push({ id: lead.id, score: score.score, offer: score.bestOffer })
    }

    return NextResponse.json({ success: true, count: saved.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scoring failed.' },
      { status: 500 }
    )
  }
}
