import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import OpenAI from 'openai'
import sharp from 'sharp'

assert.ok(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required.')
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const copy = await openai.chat.completions.create({
  model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o',
  temperature: 0.2,
  response_format: { type: 'json_object' },
  messages: [
    {
      role: 'system',
      content: 'Return valid JSON only. Do not promise funding, approval, rates, revenue, or search rankings.',
    },
    {
      role: 'user',
      content: 'Create a concise VestBlock educational post explaining DSCR for a first rental buyer. Return title, socialCaption, platformVariants for linkedin/facebook/instagram/x, graphicPrompt, videoScript, and shotList. Keep every platform on the same factual idea.',
    },
  ],
})
const parsed = JSON.parse(copy.choices[0]?.message?.content || '{}')
assert.ok(parsed.title)
assert.ok(parsed.socialCaption)
assert.equal(Object.keys(parsed.platformVariants || {}).length, 4)
assert.ok(parsed.graphicPrompt)
assert.ok(parsed.videoScript)
assert.ok(Array.isArray(parsed.shotList) && parsed.shotList.length > 0)

const image = await openai.images.generate({
  model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  prompt: `${parsed.graphicPrompt} Premium black and brushed-metal real-estate finance visual with restrained electric-lime light. No text, no logo, no watermark, no statistic. Leave lower-right negative space for the real VestBlock mark.`,
  n: 1,
  size: '1024x1024',
  quality: 'low',
  output_format: 'png',
  background: 'opaque',
})
const base64 = image.data?.[0]?.b64_json
assert.ok(base64, 'Image provider returned no image data.')
const source = Buffer.from(base64, 'base64')
const logo = await sharp(await fs.readFile(path.join(process.cwd(), 'public/brand/vestblock-monogram.png')))
  .resize({ width: 140 })
  .png()
  .toBuffer()
const branded = await sharp(source).composite([{ input: logo, gravity: 'southeast' }]).png().toBuffer()
const metadata = await sharp(branded).metadata()
assert.equal(metadata.format, 'png')
assert.ok((metadata.width || 0) >= 1024)
assert.ok(branded.length > 100_000)

console.log('Autopilot content provider test passed (copy variants + graphic generation + real-logo composite; no publish).')
