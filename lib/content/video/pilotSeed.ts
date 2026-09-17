import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildPilotAssetPayloads,
  VESTBLOCK_VIDEO_PILOT_BATCH,
  VESTBLOCK_VIDEO_PILOTS,
  videoMetadataSchema,
} from '@/lib/content/video/contentSystem'
import { logEvent } from '@/lib/system/logEvent'

type SupabaseLike = SupabaseClient<any, 'public', any>

export type VideoPilotSeedResult = {
  created: number
  refreshed: number
  skipped: number
  pilotCount: number
}

type ExistingPilotAsset = {
  id: string
  slug: string
  content_type: string
  status: string
  approval_status?: string | null
  metadata_json?: Record<string, unknown> | null
}

function shouldRefreshPilotAsset(row: ExistingPilotAsset) {
  if (row.status !== 'draft' || row.approval_status === 'approved') return false
  const metadata = videoMetadataSchema.safeParse(row.metadata_json || {})
  if (!metadata.success || metadata.data.pilot_batch === VESTBLOCK_VIDEO_PILOT_BATCH) return false
  if (row.content_type === 'video_script') {
    return metadata.data.render_status === 'not_started'
  }
  return row.content_type === 'video_brief'
}

// This remains a private, idempotent queue. Creating a brief or script never
// creates a public post or a render job.
export async function seedVestBlockVideoPilots(input: {
  supabase: SupabaseLike
  actorUserId?: string | null
}): Promise<VideoPilotSeedResult> {
  const actorUserId = input.actorUserId || null
  const definitions = VESTBLOCK_VIDEO_PILOTS.map((pilot) => ({
    pilot,
    payloads: buildPilotAssetPayloads(pilot),
  }))
  const slugs = definitions.flatMap(({ payloads }) => [payloads.brief.slug, payloads.script.slug])
  const { data: existing, error: existingError } = await input.supabase
    .from('content_assets')
    .select('id,slug,content_type,status,approval_status,metadata_json')
    .in('slug', slugs)

  if (existingError) throw existingError

  const bySlug = new Map(
    (existing || []).map((row) => [String(row.slug), row as ExistingPilotAsset])
  )
  let created = 0
  let refreshed = 0
  let skipped = 0

  for (const { pilot, payloads } of definitions) {
    let brief = bySlug.get(payloads.brief.slug)
    let briefId = brief?.id
    if (!brief) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .insert({ ...payloads.brief, created_by: actorUserId })
        .select('id,slug,content_type,status,approval_status,metadata_json')
        .single()
      if (error) throw error
      briefId = String(data.id)
      brief = data as ExistingPilotAsset
      bySlug.set(payloads.brief.slug, brief)
      created += 1
    } else if (shouldRefreshPilotAsset(brief)) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .update({ ...payloads.brief, updated_at: new Date().toISOString() })
        .eq('id', brief.id)
        .select('id,slug,content_type,status,approval_status,metadata_json')
        .single()
      if (error) throw error
      brief = data as ExistingPilotAsset
      bySlug.set(payloads.brief.slug, brief)
      refreshed += 1
    } else {
      skipped += 1
    }

    const script = bySlug.get(payloads.script.slug)
    if (!script) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .insert({ ...payloads.script, parent_content_id: briefId, created_by: actorUserId })
        .select('id,slug,content_type,status,approval_status,metadata_json')
        .single()
      if (error) throw error
      bySlug.set(payloads.script.slug, data as ExistingPilotAsset)
      created += 1
    } else if (shouldRefreshPilotAsset(script)) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .update({
          ...payloads.script,
          parent_content_id: briefId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', script.id)
        .select('id,slug,content_type,status,approval_status,metadata_json')
        .single()
      if (error) throw error
      bySlug.set(payloads.script.slug, data as ExistingPilotAsset)
      refreshed += 1
    } else {
      skipped += 1
    }

    await logEvent({
      eventType: 'content_generated',
      actorUserId,
      entityType: 'video_pilot',
      entityId: bySlug.get(payloads.script.slug)?.id || null,
      metadata: {
        source: VESTBLOCK_VIDEO_PILOT_BATCH,
        pilotKey: pilot.key,
        publicPublishing: false,
      },
    })
  }

  return { created, refreshed, skipped, pilotCount: definitions.length }
}
