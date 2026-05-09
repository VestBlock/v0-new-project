export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { bulkLeadActionSchema } from '@/lib/leads/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreOutreachForLead } from '@/lib/leads/service'
import { deleteLeads, insertOutreachSendEvent, updateLeadRecord, updateOutreachMessage } from '@/lib/leads/repository'
import { logEvent } from '@/lib/system/logEvent'

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = bulkLeadActionSchema.safeParse(await request.json().catch(() => ({})))
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

    if (parsed.data.action === 'delete') {
      await deleteLeads(parsed.data.leadIds)
      await logEvent({
        eventType: 'admin_action',
        actorUserId: user?.id,
        entityType: 'lead_bulk_action',
        metadata: {
          action: parsed.data.action,
          leadCount: parsed.data.leadIds.length,
        },
      })
      return NextResponse.json({ success: true, count: parsed.data.leadIds.length })
    }

    for (const lead of leads || []) {
      switch (parsed.data.action) {
        case 'generate_outreach':
          await generateAndStoreOutreachForLead(lead as any)
          break
        case 'approve_outreach': {
          const { data: messages } = await admin
            .from('outreach_messages')
            .select('*')
            .eq('lead_id', lead.id)
            .eq('channel', 'email')

          for (const message of messages || []) {
            await updateOutreachMessage(message.id, {
              status: 'approved',
              approved_at: new Date().toISOString(),
              approved_by_user_id: user?.id || null,
            })
            await insertOutreachSendEvent({
              leadId: lead.id,
              outreachMessageId: message.id,
              channel: message.channel,
              status: 'approved',
              recipient: lead.email,
              subject: message.subject,
            })
          }
          await updateLeadRecord(lead.id, { outreach_status: 'approved' })
          break
        }
        case 'archive_outreach': {
          const { data: messages } = await admin
            .from('outreach_messages')
            .select('*')
            .eq('lead_id', lead.id)

          for (const message of messages || []) {
            await updateOutreachMessage(message.id, { status: 'archived' })
          }
          await updateLeadRecord(lead.id, { outreach_status: 'not_started' })
          break
        }
        case 'pause':
          await updateLeadRecord(lead.id, { status: 'nurturing', outreach_status: 'do_not_contact' })
          break
        case 'assign_campaign':
          await updateLeadRecord(lead.id, { campaign_name: parsed.data.campaignName || null })
          break
        case 'mark_contacted':
          await updateLeadRecord(lead.id, { status: 'contacted', outreach_status: 'sent', last_contacted_at: new Date().toISOString() })
          break
        case 'mark_replied':
          await updateLeadRecord(lead.id, { status: 'replied', outreach_status: 'followup_due' })
          break
        case 'mark_interested':
          await updateLeadRecord(lead.id, { status: 'interested', outreach_status: 'followup_due' })
          break
        case 'mark_closed_won':
          await updateLeadRecord(lead.id, { status: 'closed_won', outreach_status: 'sent' })
          break
        case 'mark_closed_lost':
          await updateLeadRecord(lead.id, { status: 'closed_lost', outreach_status: 'sent' })
          break
        case 'mark_do_not_contact':
          await updateLeadRecord(lead.id, { status: 'do_not_contact', outreach_status: 'do_not_contact' })
          break
      }
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead_bulk_action',
      metadata: {
        action: parsed.data.action,
        leadCount: parsed.data.leadIds.length,
      },
    })

    return NextResponse.json({ success: true, count: parsed.data.leadIds.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk action failed.' },
      { status: 500 }
    )
  }
}
