#!/usr/bin/env node

/**
 * Download DealMachine export CSVs from Gmail export-complete emails.
 *
 * DealMachine queues lead/contact exports and sends a download link. This
 * script removes the manual handoff: it searches Gmail for Export Complete
 * messages, follows the download link, saves the CSV to data/dm-exports, and
 * can optionally run the existing DealMachine ingest splitter.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'data', 'dm-exports')
const REPORT_DIR = path.join(ROOT, 'tmp', 'outreach')
const DEFAULT_QUERY = 'from:support@dealmachine.com subject:"Export Complete" newer_than:7d'
const GMAIL_READ_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const arg = (name, fallback = null) => {
  const prefix = `--${name}=`
  const found = [...args].reverse().find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const AUTH_URL = has('--auth-url')
const LEGACY_OOB = has('--legacy-oob')
const EXCHANGE_CODE = arg('exchange-code')
const WRITE_ENV = has('--write-env')
const APPLY = has('--apply')
const INGEST = has('--ingest')
const SPLIT_BY_MARKET = has('--split-by-market') || has('--split')
const QUERY = arg('query', DEFAULT_QUERY)
const MAX_RESULTS = Number.parseInt(arg('max', '10'), 10) || 10
const SINCE_ISO = arg('since')
const DESTINATION = arg('destination', OUT_DIR)
const FILENAME_HINT = arg('filename-contains')
const DEALMACHINE_GMAIL_ACCOUNT = process.env.DEALMACHINE_GMAIL_ACCOUNT || process.env.DEALMACHINE_EXPORT_EMAIL || 'profitautomationllc@gmail.com'

function requiredEnv() {
  return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
}

function missingEnv(keys) {
  return keys.filter((key) => !process.env[key])
}

function oauthRedirectUri() {
  if (LEGACY_OOB) return 'urn:ietf:wg:oauth:2.0:oob'
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:53682/oauth2callback'
}

function extractAuthCode(value) {
  const raw = String(value || '').trim()
  if (!raw) return raw
  if (!/^https?:\/\//i.test(raw)) return raw
  const parsed = new URL(raw)
  const error = parsed.searchParams.get('error')
  if (error) throw new Error(parsed.searchParams.get('error_description') || error)
  const code = parsed.searchParams.get('code')
  if (!code) throw new Error('Callback URL did not include a code query parameter.')
  return code
}

function authUrl() {
  const missing = missingEnv(requiredEnv())
  if (missing.length) throw new Error(`Missing Google OAuth env vars: ${missing.join(', ')}`)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', oauthRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'select_account consent')
  url.searchParams.set('scope', GMAIL_READ_SCOPES.join(' '))
  url.searchParams.set('include_granted_scopes', 'false')
  url.searchParams.set('authuser', '-1')
  url.searchParams.set('login_hint', DEALMACHINE_GMAIL_ACCOUNT)
  return url.toString()
}

async function exchangeCode(codeOrCallbackUrl) {
  const code = extractAuthCode(codeOrCallbackUrl)
  const missing = missingEnv(requiredEnv())
  if (missing.length) throw new Error(`Missing Google OAuth env vars: ${missing.join(', ')}`)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: oauthRedirectUri(),
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error_description || data.error || `Google code exchange failed with ${response.status}`)
  if (!data.refresh_token) throw new Error('Google did not return a refresh token. Re-run the auth URL with prompt=consent or revoke the old grant first.')
  if (WRITE_ENV) updateEnvValue('GOOGLE_REFRESH_TOKEN', data.refresh_token)
  return {
    ok: true,
    wroteEnv: WRITE_ENV,
    scopes: data.scope || GMAIL_READ_SCOPES.join(' '),
    account: DEALMACHINE_GMAIL_ACCOUNT,
    refreshTokenPreview: `${data.refresh_token.slice(0, 8)}...${data.refresh_token.slice(-4)}`,
  }
}

function updateEnvValue(key, value) {
  const envPath = path.join(ROOT, '.env.local')
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  const lines = text.split(/\r?\n/)
  let updated = false
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true
      return `${key}=${value}`
    }
    return line
  })
  if (!updated) next.push(`${key}=${value}`)
  fs.writeFileSync(envPath, `${next.join('\n').replace(/\n+$/g, '')}\n`)
}

async function googleAccessToken() {
  const missing = missingEnv([...requiredEnv(), 'GOOGLE_REFRESH_TOKEN'])
  if (missing.length) throw new Error(`Missing Google OAuth env vars: ${missing.join(', ')}`)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error_description || data.error || `Google token refresh failed with ${response.status}`)
  if (!data.access_token) throw new Error('Google token refresh did not return an access token.')
  return data.access_token
}

async function gmailFetch(accessToken, resource) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${resource}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Gmail request failed with ${response.status}`
    if (/insufficient authentication scopes/i.test(message)) {
      const error = new Error('Gmail read scope is missing. Run npm run dealmachine:gmail-auth-url, approve Gmail read access, then exchange the code with npm run dealmachine:download-export -- --exchange-code=<code> --write-env.')
      error.code = 'GMAIL_SCOPE_MISSING'
      throw error
    }
    throw new Error(message)
  }
  return data
}

function decodeBase64Url(value) {
  return Buffer.from(String(value || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function collectMessageText(payload, output = []) {
  if (!payload) return output
  if (payload.body?.data) output.push(decodeBase64Url(payload.body.data))
  for (const part of payload.parts || []) collectMessageText(part, output)
  return output
}

function headerValue(message, name) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function extractLinks(text) {
  const links = []
  const patterns = [/href=["']([^"']+)["']/gi, /\((https?:\/\/[^\s)]+)\)/gi, /\b(https?:\/\/[^\s<>"]+)/gi]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) links.push(cleanLink(match[1]))
  }
  return [...new Set(links.filter(Boolean))]
}

function cleanLink(link) {
  return String(link || '').replace(/&amp;/g, '&').replace(/[)>.,;]+$/g, '').trim()
}

function likelyDownloadLinks(links) {
  return links.filter((link) => {
    const lower = link.toLowerCase()
    return lower.includes('hubspotlinks.com') || lower.includes('dealmachine') || lower.includes('amazonaws.com') || lower.includes('cloudfront.net') || lower.includes('export') || lower.includes('download') || lower.includes('.csv') || lower.includes('.zip')
  })
}

async function fetchDownload(link) {
  const response = await fetch(link, {
    redirect: 'follow',
    headers: {
      accept: 'text/csv,application/zip,application/octet-stream,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    },
  })
  const bytes = Buffer.from(await response.arrayBuffer())
  return { ok: response.ok, status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type') || '', disposition: response.headers.get('content-disposition') || '', bytes }
}

function filenameFromDownload(download, fallback) {
  const dispositionMatch = download.disposition.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i)
  if (dispositionMatch) return safeFileName(decodeURIComponent(dispositionMatch[1]))
  try {
    const url = new URL(download.finalUrl)
    const base = path.basename(url.pathname)
    if (base && /\.(csv|zip|txt)$/i.test(base)) return safeFileName(base)
  } catch {}
  return safeFileName(fallback)
}

function safeFileName(name) {
  return String(name || 'dealmachine-export.csv').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180) || 'dealmachine-export.csv'
}

function looksLikeCsv(download) {
  const head = download.bytes.slice(0, 512).toString('utf8')
  return (/csv|comma-separated|octet-stream|text\/plain/i.test(download.contentType) || /\.csv(?:\?|$)/i.test(download.finalUrl) || /first[_ ]?name|last[_ ]?name|phone|email|property|address/i.test(head)) && !/^\s*</.test(head)
}

function looksLikeZip(download) {
  return download.bytes[0] === 0x50 && download.bytes[1] === 0x4b
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function searchMessages(accessToken) {
  const params = new URLSearchParams({ q: QUERY, maxResults: String(MAX_RESULTS) })
  const data = await gmailFetch(accessToken, `messages?${params.toString()}`)
  return data.messages || []
}

async function readMessage(accessToken, id) {
  const params = new URLSearchParams({ format: 'full' })
  return gmailFetch(accessToken, `messages/${id}?${params.toString()}`)
}

function shouldSkipByDate(message) {
  if (!SINCE_ISO) return false
  const received = Number(message.internalDate || 0)
  const since = Date.parse(SINCE_ISO)
  return Number.isFinite(since) && received > 0 && received < since
}

function ingestFile(file) {
  const ingestArgs = ['scripts/dealmachine-ingest-export.mjs', `--file=${file}`, '--apply']
  if (SPLIT_BY_MARKET) ingestArgs.push('--split-by-market')
  const result = spawnSync(process.execPath, ingestArgs, { cwd: ROOT, env: process.env, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Ingest failed: ${String(result.stderr || result.stdout).slice(-800)}`)
}

async function downloadFromMessages() {
  const accessToken = await googleAccessToken()
  const messages = await searchMessages(accessToken)
  const results = []
  fs.mkdirSync(DESTINATION, { recursive: true })
  fs.mkdirSync(REPORT_DIR, { recursive: true })

  for (const item of messages) {
    const message = await readMessage(accessToken, item.id)
    if (shouldSkipByDate(message)) continue
    const subject = headerValue(message, 'subject')
    const from = headerValue(message, 'from')
    const date = headerValue(message, 'date')
    const text = [message.snippet || '', ...collectMessageText(message.payload)].join('\n')
    const links = likelyDownloadLinks(extractLinks(text))
    const messageResult = { messageId: item.id, subject, from, date, linksChecked: 0, downloaded: false, downloads: [], errors: [] }

    for (const link of links) {
      if (FILENAME_HINT && !link.toLowerCase().includes(FILENAME_HINT.toLowerCase())) continue
      messageResult.linksChecked += 1
      try {
        const download = await fetchDownload(link)
        if (!download.ok) {
          messageResult.errors.push({ link, status: download.status, finalUrl: download.finalUrl })
          continue
        }
        if (!looksLikeCsv(download) && !looksLikeZip(download)) {
          messageResult.errors.push({ link, status: download.status, finalUrl: download.finalUrl, contentType: download.contentType, reason: 'not_csv_or_zip' })
          continue
        }
        const ext = looksLikeZip(download) ? '.zip' : '.csv'
        const name = filenameFromDownload(download, `dealmachine-export-${stamp()}${ext}`)
        const finalName = /\.(csv|zip|txt)$/i.test(name) ? name : `${name}${ext}`
        const destFile = path.join(DESTINATION, finalName)
        if (APPLY) fs.writeFileSync(destFile, download.bytes)
        const row = { link, finalUrl: download.finalUrl, contentType: download.contentType, bytes: download.bytes.length, file: destFile, wroteFile: APPLY }
        messageResult.downloads.push(row)
        messageResult.downloaded = true
        if (APPLY && INGEST && ext === '.csv') ingestFile(destFile)
        break
      } catch (error) {
        messageResult.errors.push({ link, error: error instanceof Error ? error.message : String(error) })
      }
    }
    results.push(messageResult)
    if (messageResult.downloaded) break
  }

  const report = { ok: results.some((row) => row.downloaded), createdAt: new Date().toISOString(), apply: APPLY, query: QUERY, messagesFound: messages.length, messagesChecked: results.length, destination: DESTINATION, results, nextAction: results.some((row) => row.downloaded) ? APPLY ? 'CSV downloaded. Run outreach or ingest if not already ingested.' : 'Dry run found a downloadable export. Re-run with --apply to save it.' : 'No downloadable CSV found yet. Confirm DealMachine sent the export email or broaden --max/--query.' }
  const reportPath = path.join(REPORT_DIR, `dealmachine-export-download-${stamp()}.json`)
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  process.exit(report.ok ? 0 : 1)
}

async function main() {
  if (AUTH_URL) {
    console.log(JSON.stringify({
      ok: true,
      account: DEALMACHINE_GMAIL_ACCOUNT,
      redirectUri: oauthRedirectUri(),
      authUrl: authUrl(),
      scopes: GMAIL_READ_SCOPES,
      nextStep: 'Approve with the DealMachine Gmail account. If the browser ends on a localhost error page, copy the full localhost URL and pass it to --exchange-code with --write-env.'
    }, null, 2))
    return
  }
  if (EXCHANGE_CODE) {
    console.log(JSON.stringify(await exchangeCode(EXCHANGE_CODE), null, 2))
    return
  }
  await downloadFromMessages()
}

main().catch((error) => {
  const payload = { ok: false, error: error instanceof Error ? error.message : String(error) }
  if (error?.code === 'GMAIL_SCOPE_MISSING') payload.authUrlCommand = 'npm run dealmachine:gmail-auth-url'
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
})
