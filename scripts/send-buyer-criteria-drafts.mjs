import fs from 'node:fs'
import dns from 'node:dns/promises'
import path from 'node:path'
import { Resend } from 'resend'

import { loadSentLedgerSummary } from '../lib/leads/outreach-v4/sent-ledger.mjs'
import { getEmailDeliverabilityIssue, getEmailQualityIssue, normalizeEmailAddress } from './shared-email-quality.mjs'

const REQUIRED_OPTOUT = 'reply no and i will not follow up'

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const inline = process.argv.filter((arg) => arg.startsWith(prefix)).at(-1)
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.lastIndexOf(name)
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) return process.argv[index + 1]
  return fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function intArg(name, fallback, cap) {
  const parsed = Number.parseInt(getArgValue(name, ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.min(parsed, cap)
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'buyer-criteria'
}

function normalizeEmail(email) {
  return normalizeEmailAddress(String(email || ''))
}

function emailDomain(email) {
  return normalizeEmail(email).split('@')[1] || ''
}

function hostFor(value) {
  try {
    return new URL(String(value || '').startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

const COMMON_SMALL_BUSINESS_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
])
const BUYER_ROLE_LOCAL_PARTS = new Set([
  'acquisition',
  'acquisitions',
  'portfolio',
  'portfolioacquisitions',
  'investor',
  'investors',
  'deals',
  'offers',
  'buy',
  'buyers',
])
const mxCache = new Map()

function isSameBusinessDomain(emailDomainValue, websiteDomainValue) {
  if (!emailDomainValue || !websiteDomainValue) return true
  if (COMMON_SMALL_BUSINESS_EMAIL_DOMAINS.has(emailDomainValue)) return true
  return (
    emailDomainValue === websiteDomainValue ||
    emailDomainValue.endsWith(`.${websiteDomainValue}`) ||
    websiteDomainValue.endsWith(`.${emailDomainValue}`)
  )
}

async function hasMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain)
  try {
    const records = await dns.resolveMx(domain)
    const ok = records.length > 0
    mxCache.set(domain, ok)
    return ok
  } catch {
    mxCache.set(domain, false)
    return false
  }
}

async function getBuyerDeliverabilityIssue(email) {
  const normalized = normalizeEmail(email)
  const qualityIssue = getEmailQualityIssue(normalized)
  if (!qualityIssue) return getEmailDeliverabilityIssue(normalized)

  const [localPart, domain] = normalized.split('@')
  if (qualityIssue === 'blocked_local_part' && BUYER_ROLE_LOCAL_PARTS.has(localPart) && domain) {
    return (await hasMx(domain)) ? null : 'missing_mx_records'
  }

  return qualityIssue
}

function getEnv(name) {
  return process.env[name] || ''
}

function getOutreachMailingAddress() {
  return (
    getEnv('OUTREACH_MAILING_ADDRESS') ||
    getEnv('BUSINESS_MAILING_ADDRESS') ||
    getEnv('COMPANY_MAILING_ADDRESS') ||
    getEnv('PUBLIC_BUSINESS_ADDRESS')
  ).trim()
}

function getSender() {
  return getEnv('GOOGLE_WORKSPACE_SENDER') || getEnv('FROM_EMAIL') || 'contact@vestblock.io'
}

function getResendSender() {
  return getEnv('FROM_EMAIL') || 'contact@vestblock.io'
}

function hasGmailConfig() {
  return Boolean(
    getEnv('GOOGLE_CLIENT_ID') &&
      getEnv('GOOGLE_CLIENT_SECRET') &&
      getEnv('GOOGLE_REFRESH_TOKEN') &&
      getEnv('GOOGLE_WORKSPACE_SENDER')
  )
}

function hasResendConfig() {
  return Boolean(getEnv('RESEND_API_KEY') && getEnv('FROM_EMAIL'))
}

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getEnv('GOOGLE_CLIENT_ID'),
      client_secret: getEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: getEnv('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) throw new Error(`Google token refresh failed with ${response.status}.`)
  const data = await response.json()
  if (!data.access_token) throw new Error('Google token refresh did not return an access token.')
  return data.access_token
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function ensureComplianceBody(body) {
  const mailingAddress = getOutreachMailingAddress()
  const parts = [String(body || '').trim()]
  const normalized = parts[0].toLowerCase()
  if (!normalized.includes(REQUIRED_OPTOUT)) {
    parts.push('If this is not relevant, reply no and I will not follow up.')
  }
  if (mailingAddress && !normalized.includes(mailingAddress.toLowerCase())) {
    parts.push(`VestBlock mailing address: ${mailingAddress}`)
  }
  return parts.filter(Boolean).join('\n\n')
}

function readSentLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return new Set()
  return new Set(
    fs
      .readFileSync(ledgerPath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeEmail(JSON.parse(line).to)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
  )
}

function parseBuyerDraft(markdown, { filename }) {
  const toMatch = markdown.match(/^To:[ \t]*([^\r\n]*)$/im)
  const subjectMatch = markdown.match(/^Subject:[ \t]*([^\r\n]*)$/im)
  const marketMatch = markdown.match(/^Market:[ \t]*([^\r\n]*)$/im)
  const websiteMatch = markdown.match(/^(Website|Site):[ \t]*([^\r\n]*)$/im)

  const to = normalizeEmail(toMatch?.[1] || '')
  const subject = String(subjectMatch?.[1] || '').trim()
  const market = String(marketMatch?.[1] || '').trim()
  const website = String(websiteMatch?.[2] || '').trim()

  if (!to || !subject) {
    return { ok: false, filename, reasons: ['missing_to_or_subject'] }
  }

  const lines = markdown.split(/\r?\n/)
  const subjectIndex = lines.findIndex((line) => /^Subject:\s*/i.test(line))
  const bodyStart = subjectIndex >= 0 ? subjectIndex + 1 : 0
  const body = lines.slice(bodyStart).join('\n').trim().replace(/^[-–—\s]*do not send.*$/gim, '').trim()

  return {
    ok: true,
    filename,
    to,
    subject,
    market,
    website,
    body,
  }
}

async function sendWithGmail({ to, subject, body }) {
  const accessToken = await getGoogleAccessToken()
  const mime = [
    `From: VestBlock <${getSender()}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodeBase64Url(mime) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'gmail',
      error: typeof data?.error?.message === 'string' ? data.error.message : `Gmail send failed with ${response.status}.`,
    }
  }
  return { ok: true, provider: 'gmail', providerMessageId: data.id || null }
}

async function sendWithResend({ to, subject, body }) {
  const resend = new Resend(getEnv('RESEND_API_KEY'))
  const { data, error } = await resend.emails.send({
    from: getResendSender(),
    to,
    subject,
    text: body,
  })

  if (error) return { ok: false, provider: 'resend', error: error.message || 'Resend send failed.' }
  return { ok: true, provider: 'resend', providerMessageId: data?.id || null }
}

async function sendApprovedEmail(draft) {
  if (hasGmailConfig()) {
    const gmailResult = await sendWithGmail(draft)
    if (gmailResult.ok || !hasResendConfig()) return gmailResult
  }
  if (hasResendConfig()) return sendWithResend(draft)
  return { ok: false, provider: 'none', error: 'No Gmail or Resend outbound provider is configured.' }
}

async function main() {
  const date = getArgValue('--date', new Date().toISOString().slice(0, 10))
  const send = hasFlag('--send')
  const liveSendConfirm = getArgValue('--confirm-live-send', getEnv('BUYER_CRITERIA_LIVE_SEND_CONFIRM'))
  const lane = slugify(getArgValue('--lane', 'buyer_criteria')).replace(/-/g, '_')
  const limit = intArg('--limit', 15, 25)
  const dailyCap = intArg('--daily-cap', 50, 50)
  const defaultBuyerDraftsDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-drafts', date, 'buyers')
  const kimiBuyerDraftsDir = path.join(defaultBuyerDraftsDir, 'kimi')
  const draftsDir = getArgValue('--dir', fs.existsSync(kimiBuyerDraftsDir) ? kimiBuyerDraftsDir : defaultBuyerDraftsDir)

  const ledgerPath = path.join(process.cwd(), 'artifacts', 'outreach-v4', 'sent-ledger.jsonl')
  const ledgerSummary = loadSentLedgerSummary({ date })
  const sentEmails = readSentLedger(ledgerPath)
  const remainingDailySlots = Math.max(0, dailyCap - ledgerSummary.sentToday)
  const effectiveLimit = Math.min(limit, remainingDailySlots)

  const files = fs.existsSync(draftsDir)
    ? fs
        .readdirSync(draftsDir)
        .filter((entry) => entry.toLowerCase().endsWith('.md'))
        .sort()
    : []

  if (send && liveSendConfirm !== date) {
    throw new Error(`Buyer live send requires --confirm-live-send=${date}`)
  }

  const reviewedAt = new Date().toISOString()
  const provider = hasGmailConfig() ? 'gmail' : hasResendConfig() ? 'resend' : 'none'
  const sent = []
  const skipped = []
  const failed = []

  for (const entry of files) {
    if (sent.length >= effectiveLimit) break
    const filename = path.join(draftsDir, entry)
    const markdown = fs.readFileSync(filename, 'utf8')
    const parsed = parseBuyerDraft(markdown, { filename })
    if (!parsed.ok) {
      skipped.push({ filename, reasons: parsed.reasons || ['parse_failed'] })
      continue
    }

    const to = parsed.to
    const subject = parsed.subject
    const websiteDomain = hostFor(parsed.website)
    const domain = emailDomain(to)
    const reasons = []

    if (!getOutreachMailingAddress()) reasons.push('missing_mailing_address')
    if (!subject) reasons.push('missing_subject')
    if (!parsed.body || parsed.body.length < 120) reasons.push('body_too_short')
    if (!parsed.body.includes('VestBlock')) reasons.push('missing_brand_reference')
    if (!isSameBusinessDomain(domain, websiteDomain)) reasons.push(`email_domain_mismatch:${domain}:website:${websiteDomain}`)
    if (sentEmails.has(to)) reasons.push('already_sent_in_v4_ledger_or_today')

    const deliverabilityIssue = await getBuyerDeliverabilityIssue(to)
    if (deliverabilityIssue) reasons.push(`email_quality:${deliverabilityIssue}`)

    if (reasons.length) {
      skipped.push({ filename, to, subject, market: parsed.market, website: parsed.website, reasons })
      continue
    }

    const body = ensureComplianceBody(parsed.body)

    if (!send) {
      sent.push({ dryRun: true, filename, to, subject, market: parsed.market })
      sentEmails.add(to)
      continue
    }

    const result = await sendApprovedEmail({ to, subject, body })
    if (!result.ok) {
      failed.push({ filename, to, subject, provider: result.provider, error: result.error })
      continue
    }

    const sentRow = {
      sentAt: new Date().toISOString(),
      date,
      lane,
      to,
      subject,
      market: parsed.market,
      website: parsed.website,
      provider: result.provider,
      providerMessageId: result.providerMessageId || null,
      sourceDraftPath: filename,
    }
    sent.push(sentRow)
    sentEmails.add(to)
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
    fs.appendFileSync(ledgerPath, `${JSON.stringify(sentRow)}\n`)
  }

  const summary = {
    ok: failed.length === 0,
    dryRun: !send,
    lane,
    date,
    reviewedAt,
    provider,
    draftsDir,
    limitRequested: limit,
    dailyCap,
    sentBeforeThisRun: ledgerSummary.sentToday,
    remainingDailySlots,
    limit: effectiveLimit,
    draftsConsidered: files.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    sentRows: sent,
    skippedRows: skipped,
    failedRows: failed,
    ledgerPath,
  }

  const outDir = path.join(process.cwd(), 'artifacts', 'offline-automation', 'outreach-sends', date)
  const outputStem = slugify(lane.replace(/_/g, '-'))
  const outPath = path.join(outDir, send ? `${outputStem}-send-results.json` : `${outputStem}-send-preview.json`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
