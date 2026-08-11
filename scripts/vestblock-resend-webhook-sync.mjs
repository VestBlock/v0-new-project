import fs from 'node:fs/promises'
import path from 'node:path'

const endpoint = 'https://vestblock.io/api/webhooks/resend'
const targetArg = process.argv.find((argument) => argument.startsWith('--target='))
const target = path.resolve(process.cwd(), targetArg?.slice('--target='.length) || '.env.local')
const allowedTargets = new Set([
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
])

if (!allowedTargets.has(target)) throw new Error('Refusing to write outside the approved local env files.')
const stat = await fs.lstat(target)
if (stat.isSymbolicLink()) throw new Error('Refusing to write through a symlink.')

const apiKey = String(process.env.RESEND_API_KEY || '').trim()
if (!apiKey) throw new Error('RESEND_API_KEY is missing.')

async function resendJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${apiKey}` },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Resend request failed with HTTP ${response.status}.`)
  return response.json()
}

const listing = await resendJson('https://api.resend.com/webhooks')
const webhooks = Array.isArray(listing?.data) ? listing.data : []
const webhook = webhooks.find((entry) => String(entry?.endpoint || '').replace(/\/+$/, '') === endpoint)
if (!webhook?.id) throw new Error(`No Resend webhook is registered for ${endpoint}.`)

const detail = webhook.signing_secret
  ? webhook
  : await resendJson(`https://api.resend.com/webhooks/${encodeURIComponent(webhook.id)}`)
const signingSecret = String(detail?.signing_secret || '').trim()
if (!signingSecret.startsWith('whsec_')) throw new Error('The webhook did not return a valid signing secret.')

const requiredEvents = [
  'email.sent',
  'email.scheduled',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
  'email.opened',
  'email.clicked',
  'email.received',
  'suppression.added',
  'suppression.removed',
]
const currentEvents = Array.isArray(detail.events) ? detail.events : webhook.events || []
const missingEvents = requiredEvents.filter((event) => !currentEvents.includes(event))
if (process.argv.includes('--ensure-events') && missingEvents.length) {
  await resendJson(`https://api.resend.com/webhooks/${encodeURIComponent(webhook.id)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      events: [...new Set([...currentEvents, ...requiredEvents])],
      status: 'enabled',
    }),
  })
}

let contents = await fs.readFile(target, 'utf8')
const assignment = `RESEND_WEBHOOK_SECRET=${signingSecret}`
if (/^RESEND_WEBHOOK_SECRET=.*$/m.test(contents)) {
  contents = contents.replace(/^RESEND_WEBHOOK_SECRET=.*$/m, assignment)
} else {
  contents = `${contents.replace(/\s*$/, '')}\n${assignment}\n`
}

const temporary = `${target}.resend-sync-${process.pid}`
try {
  await fs.writeFile(temporary, contents, { mode: 0o600 })
  await fs.rename(temporary, target)
  await fs.chmod(target, 0o600)
} finally {
  await fs.rm(temporary, { force: true })
}

console.log(JSON.stringify({
  ok: true,
  endpoint,
  status: detail.status || webhook.status || 'unknown',
  events: [...new Set([...currentEvents, ...(process.argv.includes('--ensure-events') ? missingEvents : [])])],
  eventsAdded: process.argv.includes('--ensure-events') ? missingEvents : [],
  target: path.relative(process.cwd(), target),
  envName: 'RESEND_WEBHOOK_SECRET',
  secretValueExposed: false,
}, null, 2))
