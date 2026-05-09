export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queueSeoForBuyerRecord } from '@/lib/content/entitySeoExpansion'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { bulkBuyerActionSchema } from '@/lib/buyers/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreBuyerOutreach } from '@/lib/buyers/service'
import { insertBuyerRelationshipEvent, updateBuyerOutreachMessage, updateBuyerRecord } from '@/lib/buyers/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = bulkBuyerActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: buyers, error } = await admin.from('buyers').select('*').in('id', parsed.data.buyerIds)
    if (error) throw error

    for (const buyer of buyers || []) {
      switch (parsed.data.action) {
        case 'generate_outreach':
          await generateAndStoreBuyerOutreach(buyer as any)
          break
        case 'approve_outreach': {
          const { data: messages } = await admin.from('buyer_outreach_messages').select('*').eq('buyer_id', buyer.id)
          for (const message of messages || []) {
            await updateBuyerOutreachMessage(message.id, {
              status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by_user_id: user?.id || null,
            })
          }
          await updateBuyerRecord(buyer.id, { outreach_status: 'approved', relationship_stage: 'outreach_ready' })
          break
        }
        case 'archive_outreach': {
          const { data: messages } = await admin.from('buyer_outreach_messages').select('*').eq('buyer_id', buyer.id)
          for (const message of messages || []) {
            await updateBuyerOutreachMessage(message.id, { status: 'archived' })
          }
          await updateBuyerRecord(buyer.id, { outreach_status: 'not_started' })
          break
        }
        case 'pause':
          await updateBuyerRecord(buyer.id, { relationship_stage: 'paused', outreach_status: 'do_not_contact' })
          break
        case 'mark_contacted':
          await updateBuyerRecord(buyer.id, {
            relationship_stage: 'contacted',
            outreach_status: 'sent',
            last_contacted_at: new Date().toISOString(),
          })
          break
        case 'mark_responded':
          await updateBuyerRecord(buyer.id, { relationship_stage: 'responded', outreach_status: 'responded' })
          break
        case 'mark_active_buyer':
          await updateBuyerRecord(buyer.id, { relationship_stage: 'active_buyer', outreach_status: 'responded' })
          break
        case 'mark_not_a_fit':
          await updateBuyerRecord(buyer.id, { relationship_stage: 'not_a_fit', outreach_status: 'do_not_contact' })
          break
      }
      await insertBuyerRelationshipEvent({
        buyerId: buyer.id,
        eventType: parsed.data.action,
        actorUserId: user?.id || null,
      })

      if (['mark_responded', 'mark_active_buyer'].includes(parsed.data.action)) {
        const refreshed = await admin.from('buyers').select('*').eq('id', buyer.id).single()
        if (refreshed.data) {
          await queueSeoForBuyerRecord({
            id: refreshed.data.id,
            name: refreshed.data.name,
            category: refreshed.data.category,
            headquarters_city: refreshed.data.headquarters_city,
            headquarters_state: refreshed.data.headquarters_state,
            relationship_stage: refreshed.data.relationship_stage,
          }).catch((error) => {
            console.warn('[entity-seo] admin buyer queue skipped:', error)
          })
        }
      }
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'buyer_bulk_action',
      metadata: { action: parsed.data.action, buyerCount: parsed.data.buyerIds.length },
    })

    return NextResponse.json({ success: true, count: parsed.data.buyerIds.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bulk buyer action failed.' }, { status: 500 })
  }
}
