import fs from 'node:fs/promises'
import path from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const prefix = `--${name}=`
  const match = args.find((value) => value.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}
const present = (name) => Boolean(String(process.env[name] || '').trim())
const redirectUri = arg('redirect-uri', process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:54873/oauth2callback')
const scopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

if (!present('GOOGLE_CLIENT_ID') || !present('GOOGLE_CLIENT_SECRET')) {
  throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.')
}

if (args.includes('--auth-url')) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'select_account consent')
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('include_granted_scopes', 'false')
  url.searchParams.set('state', arg('state', 'vestblock-gmail-oauth'))
  const loginHint = process.env.GOOGLE_WORKSPACE_SENDER || process.env.DEALMACHINE_GMAIL_ACCOUNT
  if (loginHint) url.searchParams.set('login_hint', loginHint)
  console.log(url.toString())
  process.exit(0)
}

if (!args.includes('--exchange-stdin')) throw new Error('Use --auth-url or --exchange-stdin.')

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const callbackValue = Buffer.concat(chunks).toString('utf8').trim()
const callback = new URL(callbackValue)
const expectedState = arg('state', 'vestblock-gmail-oauth')
if (callback.searchParams.get('state') !== expectedState) throw new Error('OAuth state did not match.')
if (callback.searchParams.get('error')) throw new Error(`Google authorization failed: ${callback.searchParams.get('error')}`)
const code = callback.searchParams.get('code')
if (!code) throw new Error('OAuth callback did not contain an authorization code.')

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  }),
  redirect: 'error',
  signal: AbortSignal.timeout(30_000),
})
const token = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(`Google token exchange failed: ${token.error || response.status}`)
const refreshToken = String(token.refresh_token || '').trim()
if (!refreshToken) throw new Error('Google did not return a refresh token.')

const target = path.resolve(process.cwd(), arg('target', '.env.local'))
const allowed = new Set([path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '.env')])
if (!allowed.has(target)) throw new Error('Refusing to write outside an approved local env file.')
const stat = await fs.lstat(target)
if (stat.isSymbolicLink()) throw new Error('Refusing to write through a symlink.')

let contents = await fs.readFile(target, 'utf8')
const assignment = `GOOGLE_REFRESH_TOKEN=${refreshToken}`
contents = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(contents)
  ? contents.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, assignment)
  : `${contents.replace(/\s*$/, '')}\n${assignment}\n`
const temporary = `${target}.google-oauth-${process.pid}`
try {
  await fs.writeFile(temporary, contents, { mode: 0o600 })
  await fs.rename(temporary, target)
  await fs.chmod(target, 0o600)
} finally {
  await fs.rm(temporary, { force: true })
}

console.log(JSON.stringify({
  ok: true,
  envName: 'GOOGLE_REFRESH_TOKEN',
  target: path.relative(process.cwd(), target),
  scopes: String(token.scope || scopes.join(' ')).split(/\s+/).filter(Boolean),
  secretValueExposed: false,
}, null, 2))
