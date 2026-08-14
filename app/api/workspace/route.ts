export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/lib/auth/admin'
import { normalizeMemberRoles } from '@/lib/auth/intent'
import { createAdminClient } from '@/lib/supabase/admin'
import { listCustomerOpportunityMatches } from '@/lib/matching/opportunity-matches'

const patchSchema = z.object({
  activeLane: z.enum(['capital', 'real-estate', 'opportunity', 'dealvault']).nullable().optional(),
  selectedScenario: z.enum(['business', 'property', 'sell', 'readiness', 'participate']).nullable().optional(),
  criteria: z.record(z.string(), z.string().max(500)).optional(),
  questionnaireProgress: z.object({
    focus: z.string().max(64).optional(),
    step: z.number().int().min(0).max(3).optional(),
    timeline: z.enum(['now', '30-days', '90-days', 'exploring']).optional(),
    position: z.enum(['starting', 'preparing', 'active', 'stalled']).optional(),
    creditRange: z.enum(['unknown', 'below-580', '580-669', '670-739', '740-plus', 'prefer-not-to-say']).optional(),
    weeklyTime: z.enum(['under-3', '3-7', '8-plus']).optional(),
    mainObstacle: z.string().max(500).optional(),
    goalDetails: z.string().max(1200).optional(),
    requestFollowUp: z.boolean().optional(),
  }).optional(),
  marketingConsent: z.boolean().optional(),
  profileVisibility: z.enum(['private', 'eligible-partners']).optional(),
  memberRoles: z.array(z.string()).max(8).optional(),
}).strict()

function cleanRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === 'string'))
}

function cleanRecommendations(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.slice(0, 160) : ''
    if (!title) return []
    return [{
      id: typeof record.id === 'string' ? record.id : `recommendation-${index + 1}`,
      title,
      summary: typeof record.summary === 'string' ? record.summary.slice(0, 500) : '',
      status: typeof record.status === 'string' ? record.status.slice(0, 80) : 'Recommended',
      href: typeof record.href === 'string' && record.href.startsWith('/') ? record.href : null,
    }]
  }).slice(0, 6)
}

async function loadWorkspace(user: { id: string; email?: string | null }) {
  const admin = createAdminClient()
  const email = user.email?.trim().toLowerCase() || ''

  const [workspace, profile, roadmap, questionnaire, participantProfiles, sellers, creditReports] = await Promise.all([
    admin.from('customer_workspaces').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('user_profiles').select('id,full_name,email,member_roles,financial_goal,updated_at').or(`id.eq.${user.id},user_id.eq.${user.id}`).maybeSingle(),
    admin.from('user_roadmaps').select('id,financial_goal_title,roadmap_data,generated_at,is_primary').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
    email ? admin.from('next_move_questionnaires').select('id,focus,primary_path,roadmap_json,created_at,updated_at').eq('email', email).is('deleted_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.from('participant_profiles').select('id,role,status,display_name,organization_name,public_visibility_consent,safe_failure_state,updated_at').eq('owner_user_id', user.id).eq('origin', 'customer').order('updated_at', { ascending: false }).limit(20),
    admin.from('seller_cases').select('id,property_address,city,state,status,updated_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
    admin.from('credit_reports').select('id,status,created_at,completed_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
  ])

  if (workspace.error) throw workspace.error
  if (profile.error) throw profile.error

  const state = workspace.data || {
    user_id: user.id,
    active_lane: null,
    selected_scenario: null,
    criteria_json: {},
    questionnaire_progress_json: {},
    recommendations_json: [],
    roadmap_status_json: {},
    marketing_consent: false,
    profile_visibility: 'private',
    last_status_message: null,
    updated_at: null,
  }

  let opportunityMatches: Awaited<ReturnType<typeof listCustomerOpportunityMatches>> = []
  try {
    opportunityMatches = await listCustomerOpportunityMatches(user.id)
  } catch (error) {
    console.error('[workspace] opportunity matches unavailable', error)
  }

  return {
    workspace: {
      activeLane: state.active_lane,
      selectedScenario: state.selected_scenario,
      criteria: cleanRecord(state.criteria_json),
      questionnaireProgress: state.questionnaire_progress_json || {},
      recommendations: cleanRecommendations(state.recommendations_json),
      marketingConsent: state.marketing_consent,
      profileVisibility: state.profile_visibility,
      updatedAt: state.updated_at,
    },
    profile: {
      fullName: profile.data?.full_name || user.email?.split('@')[0] || 'VestBlock member',
      memberRoles: normalizeMemberRoles(profile.data?.member_roles),
      financialGoal: profile.data?.financial_goal || null,
      updatedAt: profile.data?.updated_at || null,
    },
    roadmap: roadmap.error ? null : roadmap.data,
    questionnaire: questionnaire.error ? null : questionnaire.data,
    intake: {
      profiles: participantProfiles.error ? [] : participantProfiles.data || [],
      sellers: sellers.error ? [] : sellers.data || [],
    },
    creditReports: creditReports.error ? [] : creditReports.data || [],
    opportunityMatches,
  }
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  try {
    return NextResponse.json(await loadWorkspace(user))
  } catch (error) {
    console.error('[workspace] load failed', error)
    return NextResponse.json({ error: 'Your workspace is temporarily unavailable.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Check the workspace fields and try again.' }, { status: 400 })

  const admin = createAdminClient()
  const input = parsed.data
  const workspaceUpdate: Record<string, unknown> = { user_id: user.id }
  if ('activeLane' in input) workspaceUpdate.active_lane = input.activeLane
  if ('selectedScenario' in input) workspaceUpdate.selected_scenario = input.selectedScenario
  if (input.criteria) workspaceUpdate.criteria_json = input.criteria
  if (input.questionnaireProgress) workspaceUpdate.questionnaire_progress_json = input.questionnaireProgress
  if (typeof input.marketingConsent === 'boolean') workspaceUpdate.marketing_consent = input.marketingConsent
  if (input.profileVisibility) workspaceUpdate.profile_visibility = input.profileVisibility

  try {
    if (Object.keys(workspaceUpdate).length > 1) {
      const { error } = await admin.from('customer_workspaces').upsert(workspaceUpdate, { onConflict: 'user_id' })
      if (error) throw error
    }
    if (input.memberRoles) {
      const { error } = await admin.from('user_profiles').update({ member_roles: normalizeMemberRoles(input.memberRoles), updated_at: new Date().toISOString() }).or(`id.eq.${user.id},user_id.eq.${user.id}`)
      if (error) throw error
    }
    return NextResponse.json({ success: true, ...(await loadWorkspace(user)) })
  } catch (error) {
    console.error('[workspace] save failed', error)
    return NextResponse.json({ error: 'Your changes could not be saved. Please try again.' }, { status: 500 })
  }
}
