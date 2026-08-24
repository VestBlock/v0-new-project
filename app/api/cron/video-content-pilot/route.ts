export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import {
  buildVideoContentSnapshot,
  VIDEO_CONTENT_TYPES,
  type VideoContentAssetRow,
} from '@/lib/content/video/contentSystem'
import { seedVestBlockVideoPilots } from '@/lib/content/video/pilotSeed'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

const videoSelect =
  'id,parent_content_id,title,slug,content_type,service_key,language,audience,prompt,status,platform,post_type,body_markdown,cta_label,cta_url,metadata_json,approval_status,approved_by,approved_at,published_at,created_at,updated_at'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const seed = await seedVestBlockVideoPilots({ supabase: admin })
    const { data, error } = await admin
      .from('content_assets')
      .select(videoSelect)
      .in('content_type', [...VIDEO_CONTENT_TYPES])
      .order('updated_at', { ascending: false })
      .limit(500)
    if (error) throw error

    return NextResponse.json({
      success: true,
      seed,
      videoContent: buildVideoContentSnapshot((data || []) as VideoContentAssetRow[]),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video content pilot automation failed.' },
      { status: 500 }
    )
  }
}
