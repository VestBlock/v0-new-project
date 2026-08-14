export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createHash } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { getServerUser } from '@/lib/auth/admin'
import { getOpenAIClient } from '@/lib/openai-server'
import { PARTICIPANT_ROLE_DEFINITIONS } from '@/lib/participant-profiles/config'
import { participantCriteriaSchema, participantNormalizationRequestSchema } from '@/lib/participant-profiles/schemas'
import { getOwnedParticipantProfile, recordParticipantEvent } from '@/lib/participant-profiles/server'
import { guardPublicMutation } from '@/lib/security/public-mutation'
import { createAdminClient } from '@/lib/supabase/admin'

const aiOutputSchema = z.object({
  summary: z.string().trim().min(20).max(800),
  fields: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    value: z.string().trim().max(4000),
  })).max(60),
})

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = guardPublicMutation(request, { scope: 'participant-profile-normalize', maxRequests: 12 })
  if (guard) return guard
  const user = await getServerUser()
  if (!user) return privateJson({ error: 'Authentication required.' }, { status: 401 })
  const parsed = participantNormalizationRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return privateJson({ error: 'Add at least a short paragraph for the assistant to organize.' }, { status: 400 })
  const { id } = await context.params
  const profile = await getOwnedParticipantProfile(id, user.id)
  if (!profile) return privateJson({ error: 'Participant profile not found.' }, { status: 404 })
  if (['withdrawn', 'archived'].includes(profile.status)) {
    return privateJson({ error: 'AI organization is unavailable for this profile status.' }, { status: 409 })
  }

  const admin = createAdminClient()
  const model = process.env.PARTICIPANT_PROFILE_OPENAI_MODEL || process.env.NEXT_MOVE_OPENAI_MODEL || 'gpt-5.6-luna'
  const { data: normalization, error: insertError } = await admin
    .from('participant_profile_normalizations')
    .insert({
      participant_profile_id: profile.id,
      owner_user_id: user.id,
      original_text: parsed.data.originalText,
      provider_model: 'openai/' + model,
      status: 'failed',
      failure_code: 'processing',
      failure_message: 'The interpretation is still being prepared.',
    })
    .select('*')
    .single()
  if (insertError || !normalization) {
    console.error('[participant-profile] normalization record failed', insertError)
    return privateJson({ error: 'The assistant could not begin this review. Continue with the manual fields.' }, { status: 500 })
  }

  const openai = getOpenAIClient()
  if (!openai) {
    await admin.from('participant_profile_normalizations').update({
      failure_code: 'provider_unavailable',
      failure_message: 'AI organization is unavailable. The manual profile remains fully available.',
    }).eq('id', normalization.id)
    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: user.id,
      actorKind: 'system',
      eventType: 'normalization_unavailable',
      fromStatus: profile.status,
      toStatus: profile.status,
      note: 'AI organization was unavailable. Manual completion remains available.',
    })
    return privateJson({
      normalization: { ...normalization, failure_code: 'provider_unavailable', failure_message: 'AI organization is unavailable. The manual profile remains fully available.' },
      manualPath: true,
      error: 'AI organization is unavailable right now. Continue with the manual fields.',
    }, { status: 503 })
  }

  const definition = PARTICIPANT_ROLE_DEFINITIONS[profile.role]
  try {
    const response = await openai.responses.parse({
      model,
      reasoning: { effort: 'low' },
      max_output_tokens: 1600,
      store: false,
      safety_identifier: createHash('sha256').update(user.id).digest('hex').slice(0, 48),
      text: { format: zodTextFormat(aiOutputSchema, 'participant_profile_proposal') },
      input: [
        {
          role: 'system',
          content: [
            'Convert customer free text into a proposed VestBlock participant profile.',
            'Use only the supplied text. Do not infer credentials, verification, proof of funds, rates, approvals, performance, availability, legal status, or financial results.',
            'Return only field keys from the supplied role definition. Preserve uncertainty in plain language.',
            'This is a proposal only. It will not activate a profile, run matching, or start outreach.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            role: profile.role,
            roleDescription: definition.description,
            allowedFields: definition.fields.map((field) => ({
              key: field.key,
              label: field.label,
              type: field.type,
              help: field.help,
            })),
            customerText: parsed.data.originalText,
          }),
        },
      ],
    }, { timeout: 15_000 })
    const output = aiOutputSchema.parse(response.output_parsed)
    const fieldMap = new Map(definition.fields.map((field) => [field.key, field]))
    const proposed: Record<string, string | string[] | number> = {}
    for (const item of output.fields) {
      const field = fieldMap.get(item.key)
      if (!field || !item.value) continue
      if (field.type === 'list') {
        proposed[item.key] = Array.from(new Set(item.value.split(/[,;\n]/).map((value) => value.trim()).filter(Boolean))).slice(0, 120)
      } else if (field.type === 'number') {
        const numberValue = Number(item.value.replace(/[^0-9.-]/g, ''))
        if (Number.isFinite(numberValue)) proposed[item.key] = numberValue
      } else {
        proposed[item.key] = item.value
      }
    }
    const valid = participantCriteriaSchema.parse(proposed)
    const proposedJson = { summary: output.summary, criteria: valid }
    const { data, error } = await admin.from('participant_profile_normalizations').update({
      proposed_json: proposedJson,
      status: 'proposed',
      failure_code: null,
      failure_message: null,
      proposed_at: new Date().toISOString(),
    }).eq('id', normalization.id).eq('owner_user_id', user.id).select('*').single()
    if (error) throw error
    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: user.id,
      actorKind: 'system',
      eventType: 'normalization_proposed',
      fromStatus: profile.status,
      toStatus: profile.status,
      note: 'A structured proposal is ready for customer review. No profile fields changed.',
    })
    return privateJson({ normalization: data, requiresApproval: true })
  } catch (error) {
    console.error('[participant-profile] normalization failed', error instanceof Error ? error.message : 'unknown error')
    await admin.from('participant_profile_normalizations').update({
      status: 'failed',
      failure_code: 'normalization_failed',
      failure_message: 'The assistant could not organize this text. The manual profile remains fully available.',
    }).eq('id', normalization.id)
    await admin.from('participant_profiles').update({
      safe_failure_state: 'normalization_retry_available',
      safe_failure_message: 'AI organization failed. Manual editing remains available.',
    }).eq('id', profile.id)
    await recordParticipantEvent({
      profileId: profile.id,
      actorUserId: user.id,
      actorKind: 'system',
      eventType: 'normalization_failed',
      fromStatus: profile.status,
      toStatus: profile.status,
      note: 'AI organization failed. Manual completion remains available.',
    })
    return privateJson({
      normalization: {
        id: normalization.id,
        status: 'failed',
        original_text: parsed.data.originalText,
        provider_model: 'openai/' + model,
        failure_code: 'normalization_failed',
        failure_message: 'The assistant could not organize this text. The manual profile remains fully available.',
      },
      manualPath: true,
      error: 'The assistant could not organize this text. Continue with the manual fields or try again.',
    }, { status: 502 })
  }
}
