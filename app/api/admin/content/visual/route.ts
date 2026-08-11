export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import fs from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { z } from 'zod'

import { checkAdminAccess } from '@/lib/auth/admin'
import { getOpenAIClient } from '@/lib/openai-server'
import { isTrustedMutationOrigin } from '@/lib/security/sameOrigin'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

const requestSchema = z.object({
  contentAssetId: z.string().uuid(),
  format: z.enum(['square', 'portrait', 'landscape']).default('square'),
  style: z.string().trim().max(500).optional().default('premium editorial'),
})

const sizes = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
} as const

type ContentRow = {
  id: string
  title: string
  body_markdown: string
  metadata_json: Record<string, unknown> | null
}

export async function POST(request: Request) {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin || !adminCheck.user) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: adminCheck.user ? 403 : 401 }
    )
  }
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid visual generation request.', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const openai = getOpenAIClient()
  if (!openai) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_assets')
    .select('id,title,body_markdown,metadata_json')
    .eq('id', parsed.data.contentAssetId)
    .single()
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Content asset not found.' }, { status: 404 })
  }

  const asset = data as ContentRow
  const metadata = asset.metadata_json || {}
  const graphicPrompt =
    typeof metadata.graphicPrompt === 'string' && metadata.graphicPrompt.trim()
      ? metadata.graphicPrompt.trim()
      : `Create a useful editorial visual for: ${asset.title}. ${asset.body_markdown.slice(0, 800)}`
  const prompt = [
    graphicPrompt,
    `Style direction: ${parsed.data.style}.`,
    'VestBlock brand: deep black, brushed dark metal, restrained electric-lime light, crisp premium commercial photography or information design.',
    'Leave clean negative space in the lower-right corner for the real VestBlock mark, which will be added after generation.',
    'Do not generate a logo, watermark, gibberish text, fake statistic, currency claim, testimonial, or people with distorted anatomy.',
  ].join(' ')

  try {
    const generated = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      n: 1,
      size: sizes[parsed.data.format],
      quality: 'medium',
      output_format: 'png',
      background: 'opaque',
    })
    const base64 = generated.data?.[0]?.b64_json
    if (!base64) throw new Error('The image provider returned no image data.')

    const source = Buffer.from(base64, 'base64')
    const imageMeta = await sharp(source).metadata()
    const logoWidth = Math.max(96, Math.round((imageMeta.width || 1024) * 0.14))
    const logo = await sharp(
      await fs.readFile(path.join(process.cwd(), 'public/brand/vestblock-monogram.png'))
    )
      .resize({ width: logoWidth, withoutEnlargement: true })
      .png()
      .toBuffer()
    const finalImage = await sharp(source)
      .composite([{ input: logo, gravity: 'southeast', blend: 'over' }])
      .png()
      .toBuffer()

    const storagePath = `content-studio/${asset.id}/${Date.now()}-${parsed.data.format}.png`
    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(storagePath, finalImage, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      })
    if (uploadError) throw uploadError

    const previousVisuals = Array.isArray(metadata.visuals) ? metadata.visuals : []
    const visual = {
      storagePath,
      format: parsed.data.format,
      style: parsed.data.style,
      provider: 'openai',
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      status: 'draft',
      createdAt: new Date().toISOString(),
      logoApplied: true,
    }
    const { error: updateError } = await admin
      .from('content_assets')
      .update({
        metadata_json: { ...metadata, visuals: [...previousVisuals, visual].slice(-12) },
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id)
    if (updateError) throw updateError

    const { data: signed, error: signedError } = await admin.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600)
    if (signedError) throw signedError

    await logEvent({
      eventType: 'admin_action',
      actorUserId: adminCheck.user.id,
      entityType: 'content_asset',
      entityId: asset.id,
      metadata: { action: 'generate_branded_visual', storagePath, format: parsed.data.format },
    })

    return NextResponse.json({ success: true, visual, signedUrl: signed.signedUrl })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to generate visual.' },
      { status: 500 }
    )
  }
}
