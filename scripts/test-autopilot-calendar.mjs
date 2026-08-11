import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
assert.ok(url && serviceKey, 'Supabase admin environment is required.')
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const marker = `codex-autopilot-calendar-${Date.now()}`
const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
let assetId = null

try {
  const { data: inserted, error: insertError } = await admin
    .from('content_assets')
    .insert({
      title: 'Controlled Autopilot calendar proof',
      slug: marker,
      content_type: 'social_post',
      service_key: 'real_estate_funding',
      status: 'draft',
      platform: 'test-only',
      post_type: 'controlled_test',
      body_markdown: 'Tagged fixture. No provider call and no publishing authority.',
      metadata_json: { controlledTest: true },
    })
    .select('id,status,published_at,metadata_json')
    .single()
  if (insertError) throw insertError
  assetId = inserted.id

  const { error: updateError } = await admin
    .from('content_assets')
    .update({
      metadata_json: {
        ...inserted.metadata_json,
        scheduledFor,
        scheduleStatus: 'planned',
      },
    })
    .eq('id', assetId)
  if (updateError) throw updateError

  const { data: proof, error: proofError } = await admin
    .from('content_assets')
    .select('status,published_at,metadata_json')
    .eq('id', assetId)
    .single()
  if (proofError) throw proofError
  assert.equal(proof.status, 'draft')
  assert.equal(proof.published_at, null)
  assert.equal(proof.metadata_json.scheduleStatus, 'planned')
  assert.equal(proof.metadata_json.scheduledFor, scheduledFor)
  console.log('Autopilot calendar persistence passed; the fixture stayed draft and unpublished.')
} finally {
  if (assetId) await admin.from('content_assets').delete().eq('id', assetId)
}
