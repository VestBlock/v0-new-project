import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const name = args.find((value) => value.startsWith('--name='))?.slice('--name='.length)
const environment = args.find((value) => value.startsWith('--environment='))?.slice('--environment='.length) || 'production'
const allowed = new Set([
  'BUFFER_API_KEY',
  'BUFFER_FACEBOOK_CHANNEL_ID',
  'GOOGLE_REFRESH_TOKEN',
  'N8N_WEBHOOK_URL',
  'N8N_WEBHOOK_SECRET',
  'MICROSOFT_GRAPH_CLIENT_ID',
  'MICROSOFT_GRAPH_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'OUTLOOK_ACQUISITIONS_MAILBOX',
  'OPENAI_API_KEY',
  'OPENAI_ADS_API_KEY',
  'OPENAI_ADS_PIXEL_ID',
  'OPENAI_ADS_CONVERSIONS_API_KEY',
])
if (!allowed.has(name)) throw new Error('Environment name is not approved for secure Vercel push.')
if (!['production', 'preview', 'development'].includes(environment)) throw new Error('Invalid Vercel environment.')

const text = await fs.readFile('.env.local', 'utf8')
const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`))
if (!line) throw new Error(`${name} is missing from .env.local.`)
let value = line.slice(name.length + 1).trim()
if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
  value = value.slice(1, -1)
}
if (!value) throw new Error(`${name} is empty.`)

function runVercel(operation) {
  return spawnSync('pnpm', [
    'dlx',
    'vercel@latest',
    'env',
    operation,
    name,
    environment,
    '--sensitive',
    '--yes',
  ], {
    cwd: process.cwd(),
    input: `${value}\n`,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })
}

let operation = 'update'
let result = runVercel(operation)
const firstOutput = `${result.stdout || ''}\n${result.stderr || ''}`
if (result.status !== 0 && /variable .* was not found/i.test(firstOutput)) {
  operation = 'add'
  result = runVercel(operation)
}
if (result.status !== 0) {
  const safeReason = `${result.stdout || ''}\n${result.stderr || ''}`
    .replace(/sk-[A-Za-z0-9_-]+/g, '[credential redacted]')
    .replace(/[A-Za-z0-9+/_=-]{32,}/g, '[long value redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .trim()
    .slice(-800)
  throw new Error(`Vercel environment update failed with exit code ${result.status}: ${safeReason}`)
}
console.log(JSON.stringify({ ok: true, operation, name, environment, sensitive: true, secretValueExposed: false }, null, 2))
