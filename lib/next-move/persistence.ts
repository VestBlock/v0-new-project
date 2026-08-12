import 'server-only'

import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { createAdminClient } from '@/lib/supabase/admin'
import { shouldCreateNextMoveFollowUp } from '@/lib/next-move/roadmap'
import type { NextMoveAnswers, NextMoveRoadmap } from '@/lib/next-move/types'

export async function persistNextMoveSubmission(input: {
  answers: NextMoveAnswers
  roadmap: NextMoveRoadmap
  tokenHash: string
  attribution: Record<string, string>
  aiStatus: 'completed' | 'fallback' | 'not_requested'
}) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const source = input.attribution.utm_source || 'direct'
  const externalId = `next-move:${input.tokenHash}`
  const leadPayload = {
    lead_type: 'lead_intelligence', status: 'new', source: 'next_move_questionnaire', source_url: '/next-move',
    external_id: externalId, category: input.roadmap.primaryPath.toLowerCase(), name: input.answers.firstName,
    email: input.answers.email, phone: input.answers.phone || null, best_offer: `${input.roadmap.primaryPath} roadmap`,
    pain_signal: input.answers.mainObstacle, market_segment: `next_move_${input.roadmap.primaryPath.toLowerCase()}`,
    outreach_status: 'not_started', next_follow_up_at: shouldCreateNextMoveFollowUp(input.answers) ? adminTaskDueDates.days(1) : null,
    contact_info: { name: input.answers.firstName, email: input.answers.email, phone: input.answers.phone || null },
    form_data: { ...input.answers, attribution: input.attribution, generatedRoadmap: input.roadmap },
    metadata_json: {
      source, attribution: input.attribution, analysisConsent: true, analysisConsentedAt: now,
      marketingConsent: input.answers.marketingConsent, marketingConsentedAt: input.answers.marketingConsent ? now : null,
      requestFollowUp: input.answers.requestFollowUp, aiStatus: input.aiStatus,
    },
    automation_flags_json: { marketingEligible: input.answers.marketingConsent, unattendedSendAllowed: false },
    notes: `Next-Move questionnaire: ${input.answers.focus}; primary path ${input.roadmap.primaryPath}; readiness ${input.roadmap.readiness}.`,
  }
  const { data: lead, error: leadError } = await admin.from('leads').insert(leadPayload).select('id').single()
  if (leadError || !lead?.id) throw new Error(leadError?.message || 'Unable to create the CRM record.')

  const { data: questionnaire, error: questionnaireError } = await admin.from('next_move_questionnaires').insert({
    public_token_hash: input.tokenHash, email: input.answers.email, first_name: input.answers.firstName,
    phone: input.answers.phone || null, focus: input.answers.focus, primary_path: input.roadmap.primaryPath,
    timeline: input.answers.timeline, current_position: input.answers.position, credit_range: input.answers.creditRange,
    weekly_time: input.answers.weeklyTime, main_obstacle: input.answers.mainObstacle,
    goal_details: input.answers.goalDetails || null, analysis_consent: true, analysis_consented_at: now,
    marketing_consent: input.answers.marketingConsent, marketing_consented_at: input.answers.marketingConsent ? now : null,
    follow_up_requested: input.answers.requestFollowUp, attribution_json: input.attribution,
    answers_json: input.answers, roadmap_json: input.roadmap, roadmap_model: input.roadmap.model,
    ai_status: input.aiStatus, lead_id: lead.id,
  }).select('id').single()
  if (questionnaireError || !questionnaire?.id) {
    await admin.from('leads').delete().eq('id', lead.id).eq('external_id', externalId)
    throw new Error(questionnaireError?.message || 'Unable to save the questionnaire record.')
  }

  if (shouldCreateNextMoveFollowUp(input.answers)) {
    const taskResult = await createAdminTask({
      title: `Review ${input.roadmap.primaryPath} Next-Move roadmap`,
      description: `Review ${input.answers.firstName}'s questionnaire and decide the appropriate human follow-up. No automated outreach is authorized by this task.`,
      taskType: 'next_move_followup', priority: input.answers.timeline === 'now' ? 'high' : 'normal',
      userEmail: input.answers.email, entityType: 'next_move_questionnaire', entityId: questionnaire.id,
      dueAt: adminTaskDueDates.days(1), metadata: { leadId: lead.id, focus: input.answers.focus, marketingConsent: input.answers.marketingConsent },
      createdBy: 'gate-3-next-move',
    })
    await admin.from('next_move_questionnaires').update({
      operator_task_status: taskResult.ok ? 'created' : 'failed',
      operator_task_id: taskResult.task?.id || null,
    }).eq('id', questionnaire.id)
  }

  return { questionnaireId: questionnaire.id as string, leadId: lead.id as string }
}
