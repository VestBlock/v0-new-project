export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queueSeoForLenderRecord } from '@/lib/content/entitySeoExpansion'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { bulkLenderActionSchema } from '@/lib/lenders/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreLenderOutreach } from '@/lib/lenders/service'
import { insertLenderRelationshipEvent, updateLenderOutreachMessage, updateLenderRecord } from '@/lib/lenders/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = bulkLenderActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: lenders, error } = await admin.from('lenders').select('*').in('id', parsed.data.lenderIds)
    if (error) throw error

    for (const lender of lenders || []) {
      switch (parsed.data.action) {
        case 'generate_outreach':
          await generateAndStoreLenderOutreach(lender as any)
          break
        case 'approve_outreach': {
          const { data: messages } = await admin.from('lender_outreach_messages').select('*').eq('lender_id', lender.id)
          for (const message of messages || []) {
            await updateLenderOutreachMessage(message.id, {
              status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by_user_id: user?.id || null,
            })
          }
          await updateLenderRecord(lender.id, { outreach_status: 'approved', relationship_stage: 'outreach_ready' })
          break
        }
        case 'archive_outreach': {
          const { data: messages } = await admin.from('lender_outreach_messages').select('*').eq('lender_id', lender.id)
          for (const message of messages || []) {
            await updateLenderOutreachMessage(message.id, { status: 'archived' })
          }
          await updateLenderRecord(lender.id, { outreach_status: 'not_started' })
          break
        }
        case 'pause':
          await updateLenderRecord(lender.id, { relationship_stage: 'paused', outreach_status: 'do_not_contact' })
          break
        case 'mark_contacted':
          await updateLenderRecord(lender.id, {
            relationship_stage: 'contacted',
            outreach_status: 'sent',
            last_contacted_at: new Date().toISOString(),
          })
          break
        case 'mark_responded':
          await updateLenderRecord(lender.id, { relationship_stage: 'responded', outreach_status: 'responded' })
          break
        case 'mark_active_partner':
          await updateLenderRecord(lender.id, { relationship_stage: 'active_partner', outreach_status: 'responded' })
          break
        case 'mark_not_a_fit':
          await updateLenderRecord(lender.id, { relationship_stage: 'not_a_fit', outreach_status: 'do_not_contact' })
          break
      }
      await insertLenderRelationshipEvent({
        lenderId: lender.id,
        eventType: parsed.data.action,
        actorUserId: user?.id || null,
      })

      if (['mark_responded', 'mark_active_partner'].includes(parsed.data.action)) {
        const refreshed = await admin.from('lenders').select('*').eq('id', lender.id).single()
        if (refreshed.data) {
          await queueSeoForLenderRecord({
            id: refreshed.data.id,
            name: refreshed.data.name,
            category: refreshed.data.category,
            headquarters_city: refreshed.data.headquarters_city,
            headquarters_state: refreshed.data.headquarters_state,
            relationship_stage: refreshed.data.relationship_stage,
          }).catch((error) => {
            console.warn('[entity-seo] admin lender queue skipped:', error)
          })
        }
      }
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lender_bulk_action',
      metadata: { action: parsed.data.action, lenderCount: parsed.data.lenderIds.length },
    })

    return NextResponse.json({ success: true, count: parsed.data.lenderIds.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bulk lender action failed.' }, { status: 500 })
  }
}
