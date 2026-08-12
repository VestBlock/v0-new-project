export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashLifecycleToken } from '@/lib/next-move/security'
import { isSameOriginPublicMutation } from '@/lib/next-move/security'
import { guardPublicMutation } from '@/lib/security/public-mutation'

async function findRecord(token: string) {
  if (token.length < 32 || token.length > 128) return null
  const admin = createAdminClient()
  const { data, error } = await admin.from('next_move_questionnaires')
    .select('id,email,first_name,focus,primary_path,timeline,current_position,credit_range,weekly_time,main_obstacle,goal_details,marketing_consent,follow_up_requested,attribution_json,answers_json,roadmap_json,lead_id,created_at,deleted_at')
    .eq('public_token_hash', hashLifecycleToken(token)).is('deleted_at', null).maybeSingle()
  if (error) throw error
  return data
}

export async function POST(request: Request) {
  if (!isSameOriginPublicMutation(request)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const guard = guardPublicMutation(request, { scope: 'next-move-manage', maxRequests: 12 })
  if (guard) return guard
  const body = await request.json().catch(() => null) as { token?: string; action?: string } | null
  const token = String(body?.token || '')
  const record = await findRecord(token)
  if (!record) return NextResponse.json({ error: 'This management link is invalid or no longer active.' }, { status: 404 })
  const admin = createAdminClient()

  if (body?.action === 'export') {
    await admin.from('next_move_questionnaires').update({ last_exported_at: new Date().toISOString(), export_count: 1 }).eq('id', record.id)
    return NextResponse.json({ exportedAt: new Date().toISOString(), record: { ...record, id: undefined, lead_id: undefined } }, {
      headers: { 'Content-Disposition': 'attachment; filename="vestblock-next-move-export.json"', 'Cache-Control': 'no-store' },
    })
  }

  if (body?.action === 'delete') {
    const now = new Date().toISOString()
    await admin.from('admin_tasks').update({ status: 'dismissed', completed_at: now, user_email: null, description: 'Dismissed after the questionnaire owner deleted their stored personal data.', metadata_json: { deletionSource: 'public_lifecycle_request', deletedAt: now } }).eq('entity_type', 'next_move_questionnaire').eq('entity_id', record.id).in('status', ['open', 'in_progress', 'waiting'])
    const { data: emailActivities } = await admin.from('admin_activity').select('id,metadata_json').in('action_type', ['email_sent', 'email_failed']).eq('metadata_json->>eventType', 'user_next_move_roadmap').eq('metadata_json->>to', record.email)
    await Promise.all((emailActivities || []).map((activity) => {
      const metadata = { ...((activity.metadata_json || {}) as Record<string, unknown>) }
      delete metadata.to
      return admin.from('admin_activity').update({ metadata_json: metadata }).eq('id', activity.id)
    }))
    await admin.from('email_events').delete().eq('event_type', 'user_next_move_roadmap').eq('user_email', record.email)
    if (record.lead_id) await admin.from('leads').update({ status: 'do_not_contact', outreach_status: 'do_not_contact', email: null, phone: null, name: 'Deleted Next-Move record', contact_info: {}, form_data: {}, metadata_json: { deletionSource: 'public_lifecycle_request', deletedAt: now }, notes: 'Personal data deleted at the questionnaire owner’s request.' }).eq('id', record.lead_id)
    await admin.from('next_move_questionnaires').update({ email: `deleted+${record.id}@invalid.vestblock`, first_name: 'Deleted', phone: null, main_obstacle: 'Deleted by requester', goal_details: null, marketing_consent: false, marketing_consented_at: null, follow_up_requested: false, attribution_json: {}, answers_json: {}, roadmap_json: {}, deletion_requested_at: now, deleted_at: now }).eq('id', record.id)
    return NextResponse.json({ success: true, deletedAt: now })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
