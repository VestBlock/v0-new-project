export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { bulkLeadActionSchema } from '@/lib/leads/schemas'
import type { LeadRecord, OutreachMessageRecord } from '@/lib/leads/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreOutreachForLead } from '@/lib/leads/service'
import { deleteLeads, insertOutreachSendEvent, listSuppressions, updateLeadRecord, updateOutreachMessage, upsertSuppression } from '@/lib/leads/repository'
import { logEvent } from '@/lib/system/logEvent'

function buildLeadSuppressionInput(lead: LeadRecord) {
  const email = typeof lead.email === 'string' && lead.email.trim() ? lead.email.trim().toLowerCase() : null
  const phone = typeof lead.phone === 'string' && lead.phone.trim() ? lead.phone.trim() : null
  const website = typeof lead.website === 'string' && lead.website.trim() ? lead.website.trim() : null
  const businessName =
    typeof lead.business_name === 'string' && lead.business_name.trim()
      ? lead.business_name.trim()
      : typeof lead.name === 'string' && lead.name.trim()
        ? lead.name.trim()
        : null
  const city = typeof lead.city === 'string' && lead.city.trim() ? lead.city.trim() : null
  const state = typeof lead.state === 'string' && lead.state.trim() ? lead.state.trim() : null

  if (!email && !phone && !website && !businessName) return null

  return {
    email,
    phone,
    website,
    businessName,
    city,
    state,
  }
}

function incrementReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] || 0) + 1
}

async function recordApprovalSkip(input: {
  lead: LeadRecord
  message?: OutreachMessageRecord | null
  reason: string
  actorUserId?: string | null
  guardrail: 'email_autopilot' | 'message_quality' | 'message_missing'
}) {
  await insertOutreachSendEvent({
    leadId: input.lead.id,
    outreachMessageId: input.message?.id || null,
    channel: input.message?.channel || 'email',
    status: 'skipped',
    recipient: input.lead.email,
    subject: input.message?.subject || null,
    metadata: {
      action: 'bulk_approval_skipped',
      actorUserId: input.actorUserId || null,
      guardrail: input.guardrail,
      reason: input.reason,
      skippedReason: input.reason,
    },
  })
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = bulkLeadActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const counters = {
      updated: 0,
      approvedMessages: 0,
      skipped: 0,
      generated: 0,
      skippedReasons: {} as Record<string, number>,
    }
    const suppressions =
      parsed.data.action === 'approve_outreach' ? await listSuppressions().catch(() => []) : []
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
      const leadRecord = lead as LeadRecord
      switch (parsed.data.action) {
        case 'generate_outreach':
          await generateAndStoreOutreachForLead(leadRecord)
          counters.generated += 1
          counters.updated += 1
          break
        case 'approve_outreach': {
          const decision = getLeadEmailAutopilotDecision(leadRecord, suppressions)
          if (!decision.eligible) {
            const reason = decision.reason || 'not_email_safe'
            incrementReason(counters.skippedReasons, reason)
            counters.skipped += 1
            await recordApprovalSkip({
              lead: leadRecord,
              reason,
              actorUserId: user?.id || null,
              guardrail: 'email_autopilot',
            })
            break
          }

          const { data: messages, error: messagesError } = await admin
            .from('outreach_messages')
            .select('*')
            .eq('lead_id', lead.id)
            .eq('channel', 'email')

          if (messagesError) throw messagesError

          if (!messages?.length) {
            incrementReason(counters.skippedReasons, 'missing_email_message')
            counters.skipped += 1
            await recordApprovalSkip({
              lead: leadRecord,
              reason: 'missing_email_message',
              actorUserId: user?.id || null,
              guardrail: 'message_missing',
            })
            break
          }

          let approvedForLead = 0
          for (const message of (messages || []) as OutreachMessageRecord[]) {
            const qualityIssue = validateOutreachMessageQuality({ lead: leadRecord, message })
            if (qualityIssue) {
              incrementReason(counters.skippedReasons, qualityIssue)
              counters.skipped += 1
              await recordApprovalSkip({
                lead: leadRecord,
                message,
                reason: qualityIssue,
                actorUserId: user?.id || null,
                guardrail: 'message_quality',
              })
              continue
            }

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
              metadata: {
                action: 'bulk_approved',
                actorUserId: user?.id || null,
              },
            })
            approvedForLead += 1
            counters.approvedMessages += 1
          }

          if (approvedForLead > 0) {
            await updateLeadRecord(lead.id, { outreach_status: 'approved' })
            counters.updated += 1
          }
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
          counters.updated += 1
          break
        }
        case 'pause':
          await updateLeadRecord(lead.id, { status: 'nurturing', outreach_status: 'do_not_contact' })
          counters.updated += 1
          break
        case 'assign_campaign':
          await updateLeadRecord(lead.id, { campaign_name: parsed.data.campaignName || null })
          counters.updated += 1
          break
        case 'mark_contacted':
          await updateLeadRecord(lead.id, { status: 'contacted', outreach_status: 'sent', last_contacted_at: new Date().toISOString() })
          counters.updated += 1
          break
        case 'mark_replied':
          await updateLeadRecord(lead.id, { status: 'replied', outreach_status: 'followup_due' })
          counters.updated += 1
          break
        case 'mark_interested':
          await updateLeadRecord(lead.id, { status: 'interested', outreach_status: 'followup_due' })
          counters.updated += 1
          break
        case 'mark_closed_won':
          await updateLeadRecord(lead.id, { status: 'closed_won', outreach_status: 'sent' })
          counters.updated += 1
          break
        case 'mark_closed_lost':
          await updateLeadRecord(lead.id, { status: 'closed_lost', outreach_status: 'sent' })
          counters.updated += 1
          break
        case 'mark_do_not_contact': {
          await updateLeadRecord(lead.id, { status: 'do_not_contact', outreach_status: 'do_not_contact' })
          const suppressionInput = buildLeadSuppressionInput(leadRecord)
          if (suppressionInput) {
            await upsertSuppression({
              ...suppressionInput,
              reason: 'admin_mark_do_not_contact',
            })
          }
          counters.updated += 1
          break
        }
      }
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead_bulk_action',
      metadata: {
        action: parsed.data.action,
        leadCount: parsed.data.leadIds.length,
        updatedCount: counters.updated,
        approvedMessages: counters.approvedMessages,
        skippedCount: counters.skipped,
        generatedCount: counters.generated,
        skippedReasons: counters.skippedReasons,
      },
    })

    return NextResponse.json({
      success: true,
      count: counters.updated,
      approvedMessages: counters.approvedMessages,
      skipped: counters.skipped,
      generated: counters.generated,
      skippedReasons: counters.skippedReasons,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk action failed.' },
      { status: 500 }
    )
  }
}
