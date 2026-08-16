import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

import { isCronAuthorized } from '../lib/system/cronAuth'

const root = resolve(__dirname, '..')
const cronRoot = resolve(root, 'app/api/cron')
const secret = 'gate3d1-cron-isolation-test-secret'
const mailboxSyncPath = '/api/cron/mailbox-sync'

function discoverCronPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) return discoverCronPaths(entryPath)
    if (!entry.isFile() || entry.name !== 'route.ts') return []

    const routeDirectory = relative(cronRoot, resolve(entryPath, '..'))
      .split(sep)
      .filter(Boolean)
      .join('/')
    return [`/api/cron/${routeDirectory}`]
  })
}

function request(path: string, token: string | null = secret) {
  return new Request(`https://www.vestblock.io${path}`, {
    headers: token === null ? undefined : { authorization: `Bearer ${token}` },
  })
}

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

const originalEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  GATE3D1_CANARY_ISOLATION: process.env.GATE3D1_CANARY_ISOLATION,
  NODE_ENV: process.env.NODE_ENV,
}

try {
  const cronPaths = discoverCronPaths(cronRoot).sort()
  const nonMailboxCronPaths = cronPaths.filter((path) => path !== mailboxSyncPath)

  assert.equal(cronPaths.length, 55, 'The checkpoint must expose exactly 55 cron routes.')
  assert.ok(cronPaths.includes(mailboxSyncPath), 'The exact mailbox-sync cron route must exist.')
  assert.equal(nonMailboxCronPaths.length, 54, 'Exactly 54 non-mailbox cron routes must be isolated.')
  for (const path of cronPaths) {
    const routeSource = readFileSync(resolve(root, `app${path}/route.ts`), 'utf8')
    assert.match(
      routeSource,
      /isCronAuthorized\(request\)/,
      `Every cron route must pass through the central authorization guard: ${path}.`
    )
  }

  setEnv('NODE_ENV', 'production')
  setEnv('CRON_SECRET', secret)
  setEnv('GATE3D1_CANARY_ISOLATION', 'true')

  assert.equal(isCronAuthorized(request(mailboxSyncPath)), true)
  assert.equal(isCronAuthorized(request(`${mailboxSyncPath}?sinceHours=72`)), true)
  assert.equal(isCronAuthorized(request(mailboxSyncPath, 'wrong-secret')), false)
  assert.equal(isCronAuthorized(request(mailboxSyncPath, null)), false)

  for (const path of nonMailboxCronPaths) {
    assert.equal(
      isCronAuthorized(request(path)),
      false,
      `Canary isolation must reject valid CRON_SECRET access to ${path}.`
    )
  }

  for (const path of [
    '/api/cron/mailbox-sync/',
    '/api/cron/mailbox-sync/extra',
    '/api/cron/mailbox-sync-other',
    '/API/cron/mailbox-sync',
    '/api//cron/mailbox-sync',
    '/api/cron/mailbox%2Dsync',
    '/api/cron/%6dailbox-sync',
    '/api%2Fcron%2Fmailbox-sync',
    '/api/cron/mailbox-sync%2F',
    '/api/cron/investors-pipeline?pathname=/api/cron/mailbox-sync',
    '/api/cron/seller-targeted-send?path=/api/cron/mailbox-sync',
    '/?next=/api/cron/mailbox-sync',
  ]) {
    assert.equal(
      isCronAuthorized(request(path)),
      false,
      `Lookalike or encoded cron path must not bypass canary isolation: ${path}.`
    )
  }

  const malformedRequest = {
    url: 'not-an-absolute-url',
    headers: new Headers({ authorization: `Bearer ${secret}` }),
  } as Request
  assert.equal(isCronAuthorized(malformedRequest), false)

  setEnv('GATE3D1_CANARY_ISOLATION', undefined)
  assert.equal(isCronAuthorized(request('/api/cron/seller-targeted-send')), true)
  assert.equal(isCronAuthorized(request('/api/cron/investors-pipeline', 'wrong-secret')), false)

  setEnv('GATE3D1_CANARY_ISOLATION', 'false')
  assert.equal(isCronAuthorized(request('/api/cron/buyers-pipeline')), true)

  setEnv('CRON_SECRET', undefined)
  assert.equal(isCronAuthorized(request(mailboxSyncPath, null)), false)
  assert.equal(isCronAuthorized(request('/api/cron/seller-targeted-send', null)), false)

  setEnv('GATE3D1_CANARY_ISOLATION', 'true')
  assert.equal(isCronAuthorized(request(mailboxSyncPath, null)), false)
  assert.equal(isCronAuthorized(request('/api/cron/investors-pipeline', null)), false)

  setEnv('NODE_ENV', 'development')
  setEnv('GATE3D1_CANARY_ISOLATION', undefined)
  assert.equal(isCronAuthorized(request('/api/cron/seller-targeted-send', null)), true)

  setEnv('GATE3D1_CANARY_ISOLATION', 'true')
  assert.equal(isCronAuthorized(request(mailboxSyncPath, null)), false)
  assert.equal(isCronAuthorized(request('/api/cron/seller-targeted-send', null)), false)

  console.log('Gate 3D.1 central cron isolation checks passed for 55 routes.')
} finally {
  setEnv('CRON_SECRET', originalEnv.CRON_SECRET)
  setEnv('GATE3D1_CANARY_ISOLATION', originalEnv.GATE3D1_CANARY_ISOLATION)
  setEnv('NODE_ENV', originalEnv.NODE_ENV)
}
