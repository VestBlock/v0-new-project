import fs from 'node:fs'
import path from 'node:path'
import { Resend } from 'resend'

import { loadSentLedgerSummary } from '../lib/leads/outreach-v4/sent-ledger.mjs'
import { getEmailDeliverabilityIssue } from './shared-email-quality.mjs'

const MANUAL_ONLY_VERTICALS = new Set(['funding_prep', 'distressed_house'])
const REQUIRED_OPTOUT = 'reply no and i will not follow up'
const BLOCKED_ROLE_LOCAL_PARTS = new Set([
  'info',
  'hello',
  'contact',
  'support',
  'admin',
  'office',
  'sales',
  'team',
  'leasing',
  'tenant',
  'offers',
  'main',
  'service',
  'services',
  'customerservice',
  'customer-service',
  'billing',
  'accounts',
  'accounting',
  'careers',
  'employment',
  'hiring',
  'hr',
  'jobs',
  'dispatch',
  'operations',
  'frontdesk',
  'front-desk',
  'help',
  'helpdesk',
  'estimate',
  'estimates',
  'quote',
  'quotes',
])

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

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function appendJsonl(filePath, rows) {
  if (!rows.length) return
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.appendFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function emailDomain(email) {
  return normalizeEmail(email).split('@')[1] || ''
}

function emailLocalPart(email) {
  return normalizeEmail(email).split('@')[0] || ''
}

function isBlockedRoleLocalPart(localPart) {
  const value = String(localPart || '').trim().toLowerCase()
  if (!value) return false
  if (BLOCKED_ROLE_LOCAL_PARTS.has(value)) return true
  const parts = value.split(/[._+-]+/).filter(Boolean)
  return parts.some((part) => BLOCKED_ROLE_LOCAL_PARTS.has(part))
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

function isSameBusinessDomain(emailDomainValue, websiteDomainValue) {
  if (!emailDomainValue || !websiteDomainValue) return true
  if (COMMON_SMALL_BUSINESS_EMAIL_DOMAINS.has(emailDomainValue)) return true
  return (
    emailDomainValue === websiteDomainValue ||
    emailDomainValue.endsWith(`.${websiteDomainValue}`) ||
    websiteDomainValue.endsWith(`.${emailDomainValue}`)
  )
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

async function reviewBeforeSend(draft, sentEmails, domainCounts, perDomainLimit) {
  const to = normalizeEmail(draft.to)
  const body = ensureComplianceBody(draft.body)
  const subject = String(draft.subject || '').trim()
  const domain = emailDomain(to)
  const websiteDomain = hostFor(draft.website)
  const emailIssue = await getEmailDeliverabilityIssue(to)
  const reasons = []

  if (emailIssue) reasons.push(`email_quality:${emailIssue}`)
  if (!subject) reasons.push('missing_subject')
  if (!body || body.length < 120) reasons.push('body_too_short')
  if (!body.includes('VestBlock')) reasons.push('missing_brand_reference')
  if (!body.toLowerCase().includes(REQUIRED_OPTOUT)) reasons.push('missing_plain_opt_out')
  if (!getOutreachMailingAddress()) reasons.push('missing_mailing_address')
  if (isBlockedRoleLocalPart(emailLocalPart(to))) reasons.push(`blocked_role_local_part:${emailLocalPart(to)}`)
  if (MANUAL_ONLY_VERTICALS.has(draft.vertical)) reasons.push(`manual_only_vertical:${draft.vertical}`)
  if (!isSameBusinessDomain(domain, websiteDomain)) reasons.push(`email_domain_mismatch:${domain}:website:${websiteDomain}`)
  if (draft.sendAllowed !== false || draft.sendRequiresExplicitApproval !== true) reasons.push('missing_v4_explicit_approval_guardrail')
  if (sentEmails.has(to)) reasons.push('already_sent_in_v4_ledger')
  if (domain && (domainCounts.get(domain) || 0) >= perDomainLimit) reasons.push('domain_cap_reached')

  return {
    ok: reasons.length === 0,
    reasons,
    normalizedDraft: {
      ...draft,
      to,
      subject,
      body,
    },
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
  const requestedLimit = intArg('--limit', Number.parseInt(getEnv('OUTREACH_V4_DAILY_SEND_LIMIT') || '50', 10), 50)
  const dailyCap = intArg('--daily-cap', Number.parseInt(getEnv('OUTREACH_V4_DAILY_SEND_LIMIT') || '50', 10), 50)
  const perDomainLimit = intArg('--per-domain-limit', 1, 5)
  const send = hasFlag('--send')
  const liveSendConfirm = getArgValue('--confirm-live-send', getEnv('OUTREACH_V4_LIVE_SEND_CONFIRM'))
  const artifactDir = path.join(process.cwd(), 'artifacts', 'outreach-v4', date)
  const approvedPath = path.join(artifactDir, 'approved-drafts.json')
  const previewPath = path.join(artifactDir, 'send-preview.json')
  const resultPath = path.join(artifactDir, send ? 'send-results.json' : 'send-preview.json')
  const ledgerPath = path.join(process.cwd(), 'artifacts', 'outreach-v4', 'sent-ledger.jsonl')
  const approvedDrafts = readJson(approvedPath, [])
  if (send) {
    if (liveSendConfirm !== date) {
      throw new Error(`Live send requires --confirm-live-send=${date}`)
    }
    if (!fs.existsSync(previewPath)) {
      throw new Error(`Live send requires an existing preview first: ${previewPath}`)
    }
    const approvedMtime = fs.existsSync(approvedPath) ? fs.statSync(approvedPath).mtimeMs : 0
    const previewMtime = fs.statSync(previewPath).mtimeMs
    if (previewMtime < approvedMtime) {
      throw new Error('Live send requires send-preview.json to be newer than approved-drafts.json')
    }
  }
  const ledgerSummary = loadSentLedgerSummary({ date })
  const sentEmails = readSentLedger(ledgerPath)
  const remainingDailySlots = Math.max(0, dailyCap - ledgerSummary.sentToday)
  const limit = Math.min(requestedLimit, remainingDailySlots)
  const domainCounts = new Map()
  const reviewedAt = new Date().toISOString()
  const sent = []
  const skipped = []
  const failed = []

  for (const draft of approvedDrafts) {
    if (sent.length >= limit) {
      skipped.push({
        leadId: draft.leadId,
        to: draft.to,
        vertical: draft.vertical,
        reasons: [remainingDailySlots <= 0 ? 'daily_cap_already_reached' : 'daily_limit_reached'],
      })
      continue
    }

    const review = await reviewBeforeSend(draft, sentEmails, domainCounts, perDomainLimit)
    if (!review.ok) {
      skipped.push({ leadId: draft.leadId, to: normalizeEmail(draft.to), vertical: draft.vertical, reasons: review.reasons })
      continue
    }

    const normalized = review.normalizedDraft
    if (!send) {
      sent.push({
        dryRun: true,
        leadId: normalized.leadId,
        to: normalized.to,
        vertical: normalized.vertical,
        subject: normalized.subject,
      })
      sentEmails.add(normalized.to)
      domainCounts.set(emailDomain(normalized.to), (domainCounts.get(emailDomain(normalized.to)) || 0) + 1)
      continue
    }

    const result = await sendApprovedEmail(normalized)
    if (!result.ok) {
      failed.push({
        leadId: normalized.leadId,
        to: normalized.to,
        vertical: normalized.vertical,
        provider: result.provider,
        error: result.error,
      })
      continue
    }

    const sentRow = {
      sentAt: new Date().toISOString(),
      date,
      leadId: normalized.leadId,
      to: normalized.to,
      vertical: normalized.vertical,
      subject: normalized.subject,
      provider: result.provider,
      providerMessageId: result.providerMessageId || null,
    }
    sent.push(sentRow)
    sentEmails.add(normalized.to)
    domainCounts.set(emailDomain(normalized.to), (domainCounts.get(emailDomain(normalized.to)) || 0) + 1)
    appendJsonl(ledgerPath, [sentRow])
  }

  const summary = {
    ok: failed.length === 0,
    dryRun: !send,
    date,
    reviewedAt,
    provider: hasGmailConfig() ? 'gmail' : hasResendConfig() ? 'resend' : 'none',
    requestedLimit,
    dailyCap,
    sentBeforeThisRun: ledgerSummary.sentToday,
    remainingDailySlots,
    limit,
    perDomainLimit,
    approvedDrafts: approvedDrafts.length,
    sent: sent.length,
    skipped: skipped.length,
    failed: failed.length,
    sentByVertical: sent.reduce((acc, row) => {
      acc[row.vertical] = (acc[row.vertical] || 0) + 1
      return acc
    }, {}),
    skippedByReason: skipped.reduce((acc, row) => {
      for (const reason of row.reasons) acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {}),
    failedByReason: failed.reduce((acc, row) => {
      const reason = row.error || 'unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {}),
    resultPath,
    ledgerPath,
    sentRows: sent,
    skippedRows: skipped,
    failedRows: failed,
  }
  writeJson(resultPath, summary)
  console.log(JSON.stringify(summary, null, 2))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
