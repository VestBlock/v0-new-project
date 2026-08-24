import type { SupabaseClient } from '@supabase/supabase-js'

import { buildPilotAssetPayloads, VESTBLOCK_VIDEO_PILOTS } from '@/lib/content/video/contentSystem'
import { logEvent } from '@/lib/system/logEvent'

type SupabaseLike = SupabaseClient<any, 'public', any>

export type VideoPilotSeedResult = {
  created: number
  skipped: number
  pilotCount: number
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
    .select('id,slug')
    .in('slug', slugs)

  if (existingError) throw existingError

  const bySlug = new Map((existing || []).map((row) => [String(row.slug), String(row.id)]))
  let created = 0
  let skipped = 0

  for (const { pilot, payloads } of definitions) {
    let briefId = bySlug.get(payloads.brief.slug)
    if (!briefId) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .insert({ ...payloads.brief, created_by: actorUserId })
        .select('id')
        .single()
      if (error) throw error
      briefId = String(data.id)
      bySlug.set(payloads.brief.slug, briefId)
      created += 1
    } else {
      skipped += 1
    }

    if (!bySlug.has(payloads.script.slug)) {
      const { data, error } = await input.supabase
        .from('content_assets')
        .insert({ ...payloads.script, parent_content_id: briefId, created_by: actorUserId })
        .select('id')
        .single()
      if (error) throw error
      bySlug.set(payloads.script.slug, String(data.id))
      created += 1
    } else {
      skipped += 1
    }

    await logEvent({
      eventType: 'content_generated',
      actorUserId,
      entityType: 'video_pilot',
      entityId: bySlug.get(payloads.script.slug) || null,
      metadata: {
        source: 'vestblock-video-pilot-001',
        pilotKey: pilot.key,
        publicPublishing: false,
      },
    })
  }

  return { created, skipped, pilotCount: definitions.length }
}
