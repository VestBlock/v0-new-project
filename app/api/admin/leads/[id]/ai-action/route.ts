export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

import { buildLeadAgentQualification } from '@/lib/ai/leadAgentQualification'
import { chooseLeadPartnerRouting, leadAgentActionSchema } from '@/lib/ai/leadAgentActions'
import { buildAiLeadScoreSummary } from '@/lib/ai/leadScoring'
import { buildAiOutreachDraft } from '@/lib/ai/outreachWriter'
import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { addLeadNote, getLeadById, insertOutreachSendEvent, updateLeadRecord, updateOutreachMessage } from '@/lib/leads/repository'
import { logEvent } from '@/lib/system/logEvent'

function firstApprovableEmailMessage(outreach: Awaited<ReturnType<typeof getLeadById>>['outreach']) {
  return outreach.find((message) => message.channel === 'email' && ['needs_review', 'draft', 'approved'].includes(message.status))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = leadAgentActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { id } = await params
    const bundle = await getLeadById(id)
    const { lead } = bundle
    const [scoreSummary, outreachDraft] = await Promise.all([
      buildAiLeadScoreSummary(lead),
      buildAiOutreachDraft(lead),
    ])
    const qualification = await buildLeadAgentQualification(bundle, {
      scoreSummary,
      outreachDraft,
    })

    const requestedAction =
      parsed.data.action === 'apply_ai_recommendation'
        ? qualification.approval_recommendation === 'approve_outreach'
          ? 'approve_outreach'
          : qualification.approval_recommendation === 'route_to_partner'
            ? 'route_to_partner'
            : null
        : parsed.data.action

    if (!requestedAction) {
      return NextResponse.json(
        { error: 'The AI recommendation is informational only and does not map to an automatic lead action yet.' },
        { status: 400 }
      )
    }

    if (requestedAction === 'approve_outreach') {
      const message = firstApprovableEmailMessage(bundle.outreach)
      if (!message) {
        return NextResponse.json({ error: 'No email outreach draft is ready to approve.' }, { status: 400 })
      }

      await updateOutreachMessage(message.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by_user_id: user?.id || null,
      })
      await updateLeadRecord(id, {
        outreach_status: 'approved',
        status: lead.status === 'new' || lead.status === 'scored' ? 'qualified' : lead.status,
      })
      await insertOutreachSendEvent({
        leadId: id,
        outreachMessageId: message.id,
        channel: message.channel,
        status: 'approved',
        recipient: lead.email,
        subject: message.subject,
        metadata: {
          actorUserId: user?.id || null,
          action: 'ai_approved_outreach',
          aiCategory: qualification.qualification_category,
          approvalRecommendation: qualification.approval_recommendation,
        },
      })
      await addLeadNote(
        id,
        user?.id || null,
        `AI qualification approved the first email draft.\n\nCategory: ${qualification.qualification_category}\nReason: ${qualification.qualification_reason}\nRecommended operator action: ${qualification.recommended_operator_action}`,
        true
      )
      await logEvent({
        eventType: 'admin_action',
        actorUserId: user?.id,
        entityType: 'lead',
        entityId: id,
        metadata: {
          action: 'lead_ai_outreach_approved',
          outreachMessageId: message.id,
          qualificationCategory: qualification.qualification_category,
          approvalRecommendation: qualification.approval_recommendation,
        },
      })

      return NextResponse.json({
        success: true,
        action: 'approve_outreach',
        message: 'The first email draft was approved from the AI qualification panel.',
        outreachMessageId: message.id,
        qualification,
      })
    }

    const partnerRouting = chooseLeadPartnerRouting({
      lead,
      qualification,
      scoreSummary,
    })

    if (!partnerRouting) {
      return NextResponse.json(
        { error: 'No partner routing path is configured for this lead yet.' },
        { status: 400 }
      )
    }

    const descriptionLines = [
      `Lead: ${lead.business_name || lead.name || lead.id}`,
      `AI category: ${qualification.qualification_category}`,
      `Route reason: ${partnerRouting.routeReason}`,
      `Fit summary: ${partnerRouting.fitSummary}`,
      `Recommended operator action: ${qualification.recommended_operator_action}`,
      partnerRouting.partnerPath ? `Partner path: ${partnerRouting.partnerPath}` : 'Partner path: manual review required',
      `Customer reply goal: ${qualification.customer_reply_goal}`,
    ]

    await createAdminTask({
      title: `Route lead to ${partnerRouting.partnerName}`,
      description: descriptionLines.join('\n\n'),
      taskType: 'lead_partner_routing',
      priority: 'high',
      entityType: 'lead',
      entityId: id,
      userEmail: lead.email || null,
      dueAt: adminTaskDueDates.hours(4),
      metadata: {
        partnerRouting,
        qualification,
        scoreSummary: {
          score: scoreSummary.score,
          offer: scoreSummary.recommended_offer_label,
          nextAction: scoreSummary.recommended_next_action,
        },
      },
      createdBy: user?.id || null,
    })
    await updateLeadRecord(id, {
      status: 'qualified',
      outreach_status: lead.outreach_status || 'needs_review',
      next_follow_up_at: adminTaskDueDates.hours(4),
    })
    await addLeadNote(
      id,
      user?.id || null,
      `AI routed this lead toward ${partnerRouting.partnerName}.\n\n${descriptionLines.join('\n')}`,
      true
    )
    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead',
      entityId: id,
      metadata: {
        action: 'lead_ai_partner_routing',
        partnerName: partnerRouting.partnerName,
        partnerPath: partnerRouting.partnerPath,
        qualificationCategory: qualification.qualification_category,
      },
    })

    return NextResponse.json({
      success: true,
      action: 'route_to_partner',
      message: `A partner-routing task was created for ${partnerRouting.partnerName}.`,
      partnerRouting,
      qualification,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead AI action failed.' },
      { status: 500 }
    )
  }
}
