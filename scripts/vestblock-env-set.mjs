#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const allowed = new Set([
  'BUFFER_API_KEY',
  'BUFFER_FACEBOOK_CHANNEL_ID',
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_SECRET',
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'OUTLOOK_ACQUISITIONS_MAILBOX',
  'OPENAI_ADS_API_KEY',
  'OPENAI_ADS_PIXEL_ID',
  'OPENAI_ADS_CONVERSIONS_API_KEY',
])

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)

let payload
try {
  payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
} catch {
  throw new Error('Expected a JSON object on stdin.')
}

const values = payload?.values
if (!values || typeof values !== 'object' || Array.isArray(values)) {
  throw new Error('Expected {"values":{"NAME":"value"}} on stdin.')
}

const entries = Object.entries(values)
if (!entries.length) throw new Error('No environment values were supplied.')
for (const [name, value] of entries) {
  if (!allowed.has(name)) throw new Error(`${name} is not approved for this setter.`)
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`)
  if (/\r|\n/.test(value)) throw new Error(`${name} cannot contain a line break.`)
}

const envPath = path.join(process.cwd(), '.env.local')
try {
  const stat = fs.lstatSync(envPath)
  if (stat.isSymbolicLink()) throw new Error('.env.local cannot be a symbolic link.')
  if (!stat.isFile()) throw new Error('.env.local must be a regular file.')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
for (const [name, value] of entries) {
  const encoded = JSON.stringify(value)
  const linePattern = new RegExp(`^${name}=.*$`, 'm')
  text = linePattern.test(text)
    ? text.replace(linePattern, `${name}=${encoded}`)
    : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${name}=${encoded}\n`
}

const tempPath = path.join(process.cwd(), `.env.local.vestblock-${process.pid}-${Date.now()}.tmp`)
try {
  fs.writeFileSync(tempPath, text, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  fs.renameSync(tempPath, envPath)
  fs.chmodSync(envPath, 0o600)
} finally {
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
}

console.log(JSON.stringify({
  ok: true,
  updated: entries.map(([name]) => name).sort(),
  valuesExposed: false,
}))
