export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { generateNextMoveAiRefinement } from '@/lib/next-move/ai'
import { sendNextMoveRoadmapEmail } from '@/lib/next-move/email'
import { persistNextMoveSubmission } from '@/lib/next-move/persistence'
import { buildNextMoveRoadmap, mergeAiRefinement } from '@/lib/next-move/roadmap'
import { nextMoveSubmissionSchema } from '@/lib/next-move/schema'
import { checkNextMoveRateLimit, createLifecycleToken, isSameOriginPublicMutation, normalizeAttribution } from '@/lib/next-move/security'
import type { NextMoveAnswers } from '@/lib/next-move/types'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  if (!isSameOriginPublicMutation(request)) return NextResponse.json({ error: 'Cross-site submissions are not allowed.' }, { status: 403 })
  const rate = checkNextMoveRateLimit(request)
  if (!rate.allowed) return NextResponse.json({ error: 'Please wait before requesting another roadmap.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = nextMoveSubmissionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Check the questionnaire and try again.', details: parsed.error.flatten() }, { status: 400 })
  if (parsed.data.website) return NextResponse.json({ success: true }, { status: 202 })

  const { attribution: rawAttribution, website: _website, ...answerInput } = parsed.data
  const answers = { ...answerInput, phone: answerInput.phone || undefined, goalDetails: answerInput.goalDetails || undefined } as NextMoveAnswers
  const attribution = normalizeAttribution(rawAttribution)
  const deterministic = buildNextMoveRoadmap(answers)
  let roadmap = deterministic
  let aiStatus: 'completed' | 'fallback' | 'not_requested' = 'not_requested'
  try {
    const refinement = await generateNextMoveAiRefinement(answers, deterministic)
    if (refinement) { roadmap = mergeAiRefinement(deterministic, refinement); aiStatus = 'completed' }
    else aiStatus = 'fallback'
  } catch (error) {
    aiStatus = 'fallback'
    console.warn('[next-move] AI refinement unavailable; deterministic roadmap retained.', error instanceof Error ? error.message : error)
  }

  const lifecycle = createLifecycleToken()
  try {
    const record = await persistNextMoveSubmission({ answers, roadmap, tokenHash: lifecycle.hash, attribution, aiStatus })
    const emailResult = await sendNextMoveRoadmapEmail({ firstName: answers.firstName, email: answers.email, roadmap, lifecycleToken: lifecycle.token })
    await createAdminClient().from('next_move_questionnaires').update({
      confirmation_status: emailResult.ok ? 'accepted' : emailResult.skipped ? 'skipped' : 'failed',
      confirmation_provider: 'provider' in emailResult ? emailResult.provider : null,
      confirmation_message_id: 'id' in emailResult ? emailResult.id : null,
    }).eq('id', record.questionnaireId)
    return NextResponse.json({ success: true, roadmap, lifecycleToken: lifecycle.token, confirmationAccepted: emailResult.ok })
  } catch (error) {
    console.error('[next-move] submission failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Your roadmap could not be saved. Please try again.' }, { status: 500 })
  }
}
