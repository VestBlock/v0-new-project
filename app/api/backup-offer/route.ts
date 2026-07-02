export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNewLeadAlertEmail } from '@/lib/email/sendEmail'

const backupOfferSchema = z.object({
  agentName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(''),
  brokerage: z.string().trim().max(200).optional().default(''),
  listingAddress: z.string().trim().min(5).max(300),
  listPrice: z.string().trim().max(40).optional().default(''),
  daysOnMarket: z.string().trim().max(20).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = backupOfferSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please complete the required backup-offer fields.' }, { status: 400 })
    }
    const data = parsed.data
    const supabaseAdmin = createAdminClient()

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'backup_offer',
        status: 'new',
        source: 'backup_offer_form',
        source_url: '/backup-offer',
        category: 'agent_backup_offer',
        name: data.agentName,
        email: data.email,
        phone: data.phone || null,
        business_name: data.brokerage || null,
        property_address: data.listingAddress,
        best_offer: 'Agent backup-offer request',
        pain_signal: `Listing at ${data.listingAddress}; ${data.daysOnMarket || '?'} DOM; list ${data.listPrice || 'n/a'}.`,
        market_segment: 'agent_backup_offer',
        outreach_angle: 'Standing backup cash review for a listed property; agent keeps full commission.',
        contact_info: { name: data.agentName, email: data.email, phone: data.phone || null, brokerage: data.brokerage || null },
        form_data: {
          listingAddress: data.listingAddress,
          listPrice: data.listPrice || null,
          daysOnMarket: data.daysOnMarket || null,
          notes: data.notes || null,
        },
        notes: data.notes || `Backup-offer request for ${data.listingAddress}.`,
      })
      .select('id')
      .single()

    if (error || !lead?.id) {
      console.error('[backup-offer] insert failed:', error)
      return NextResponse.json({ error: 'Unable to save the backup-offer request right now.' }, { status: 500 })
    }

    // after() keeps the function alive until the alert sends (see sell-lead route).
    after(() =>
      sendNewLeadAlertEmail({
        leadId: lead.id,
        leadType: 'backup_offer (agent)',
        name: `${data.agentName}${data.brokerage ? ` — ${data.brokerage}` : ''}`,
        email: data.email,
        phone: data.phone || null,
        propertyAddress: data.listingAddress,
        sourcePath: '/backup-offer',
        summary: `List ${data.listPrice || 'n/a'} · ${data.daysOnMarket || '?'} DOM · agent keeps commission. ${data.notes ? `Notes: ${data.notes.slice(0, 140)}` : ''}`,
      }).catch((alertError) => console.error('Backup-offer alert email failed:', alertError))
    )

    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (error) {
    console.error('[backup-offer] unexpected error:', error)
    return NextResponse.json({ error: 'Unable to save the backup-offer request right now.' }, { status: 500 })
  }
}
