import dns from 'node:dns/promises'

const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,24}$/
const DOMAIN_LABEL_RE = /^[a-z0-9-]+$/
const BLOCKED_SUBSTRINGS = [
  '@2x.',
  '@1x.',
  'user@domain.',
  'your@email.com',
  'youremail@',
  'your.name@',
  'john@email.com',
  'email@address.com',
  'example.com',
  'sentry',
  'wixpress',
  'asset-',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
]
const BLOCKED_LOCAL_PARTS = new Set([
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'info',
  'hello',
  'contact',
  'support',
  'admin',
  'office',
  'sales',
  'team',
  'accounts',
  'accounting',
  'billing',
  'careers',
  'employment',
  'hiring',
  'hr',
  'jobs',
  'help',
  'helpdesk',
  'developer',
  'developers',
  'development',
  'project',
  'projects',
  'dispatch',
  'operations',
  'contactus',
  'contact-us',
  'estimate',
  'estimates',
  'quote',
  'quotes',
  'frontdesk',
  'front-desk',
  'leasing',
  'tenant',
  'offers',
  'main',
  'service',
  'services',
  'customerservice',
  'customer-service',
  'filler',
  'email',
  'website',
  'webmaster',
  'mail',
])
const BLOCKED_DOMAINS = new Set([
  'address.com',
  'domain.com',
  'email.com',
  'example.com',
  'example.org',
  'example.net',
  'facebook.com',
  'fb.com',
  'instagram.com',
  'linkedin.com',
  'messenger.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'webador.com',
])
const SUSPICIOUS_APPENDED_TLD_RE = /\.(com|net|org|co|io|biz|info|us)(office|branch|location|team|corp|group)$/i
const COMBINED_ROLE_LOCAL_PART_RE =
  /^(?:email|mail)(?:info|hello|contact|support|admin|office|sales|team|billing|accounts|accounting|help|helpdesk)$|^(?:info|hello|contact|support|admin|office|sales|team|billing|accounts|accounting|help|helpdesk)(?:email|mail)$/i

export function normalizeEmailAddress(value) {
  let email = String(value || '').trim().toLowerCase()
  email = email.replace(/^mailto:/i, '')
  email = email.split('?')[0] || ''
  email = email
    .replace(/\\u00a0/gi, '')
    .replace(/u00a0/gi, '')
    .replace(/\u00a0/g, '')
    .replace(/&nbsp;|&#160;/gi, '')
  email = email
    .replace(/^(\\u003e|u003e|&#62;|&gt;|>)+/i, '')
    .replace(/^(\\u003c|u003c|&#60;|&lt;|<)+/i, '')
    .replace(/^[("'`]+/, '')
    .replace(/[)"'`,.]+$/, '')
  return email.trim()
}

export function getEmailQualityIssue(value) {
  const email = normalizeEmailAddress(value)
  if (!email) return 'missing'
  if (email.length > 254) return 'too_long'
  if (!BASIC_EMAIL_RE.test(email)) return 'invalid_format'
  if (BLOCKED_SUBSTRINGS.some((entry) => email.includes(entry))) return 'blocked_pattern'

  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return 'invalid_format'
  if (COMBINED_ROLE_LOCAL_PART_RE.test(localPart)) return 'blocked_local_part'
  if (BLOCKED_LOCAL_PARTS.has(localPart)) return 'blocked_local_part'
  if (localPart === 'example' || localPart === 'sample' || localPart.startsWith('test+')) {
    return 'blocked_local_part'
  }
  if (BLOCKED_DOMAINS.has(domain)) return 'blocked_domain'
  if (domain.endsWith('.local')) return 'local_domain'
  if (SUSPICIOUS_APPENDED_TLD_RE.test(domain)) return 'suspicious_domain_suffix'

  const labels = domain.split('.')
  if (labels.length < 2) return 'invalid_domain'

  for (const label of labels) {
    if (!label || label.startsWith('-') || label.endsWith('-') || !DOMAIN_LABEL_RE.test(label)) {
      return 'invalid_domain'
    }
  }

  return null
}

export function isUsableContactEmail(value) {
  return getEmailQualityIssue(value) === null
}

const mxCache = new Map()

export async function getEmailDeliverabilityIssue(value) {
  const qualityIssue = getEmailQualityIssue(value)
  if (qualityIssue) return qualityIssue

  const email = normalizeEmailAddress(value)
  const domain = email.split('@')[1]
  if (!domain) return 'invalid_domain'
  if (mxCache.has(domain)) return mxCache.get(domain)

  let issue = null
  try {
    const records = await dns.resolveMx(domain)
    if (!records.length) issue = 'missing_mx_records'
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : ''
    if (['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'ENODOMAIN'].includes(code)) {
      issue = `mx_lookup_${code.toLowerCase()}`
    } else {
      issue = 'mx_lookup_failed'
    }
  }

  mxCache.set(domain, issue)
  return issue
}

export function formatScriptError(error) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const message = typeof error.message === 'string' ? error.message : null
    try {
      return message || JSON.stringify(error)
    } catch {
      return message || String(error)
    }
  }
  return String(error)
}
