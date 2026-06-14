/**
 * VestBlock outreach compliance checker.
 *
 * Deterministic rules engine that every send script runs BEFORE delivering
 * email or SMS. Catches the language that creates legal or reputational
 * exposure: guarantees, funding promises, fake urgency, missing CAN-SPAM
 * elements, and TCPA-risky SMS phrasing.
 *
 * Pure functions, zero dependencies — importable from any .mjs send script.
 *
 * Usage in a sender:
 *   import { checkEmailCompliance, formatViolations } from "./lib/compliance-check.mjs"
 *   const result = checkEmailCompliance({ subject, body })
 *   if (!result.pass) { skip / report }
 *
 * Standalone:
 *   node scripts/compliance-check-cli.mjs --file=tmp/outreach/drafts.txt
 */

// ── Rules ────────────────────────────────────────────────────────────────────

// Hard blocks: these phrases must never appear in outreach. Each entry:
// pattern + reason. Case-insensitive.
const BANNED_PATTERNS = [
  { pattern: /\bguarantee[ds]?\b(?![^.]*\bno guarantee)/i, reason: 'Guarantee language ("guarantee/guaranteed") — VestBlock never guarantees offers, funding, timelines, or outcomes.' },
  { pattern: /\bwe (?:will|can) (?:definitely|certainly) (?:close|fund|buy)/i, reason: 'Definite closing/funding promise.' },
  { pattern: /\bguaranteed (?:offer|funding|closing|approval|cash)/i, reason: 'Guaranteed offer/funding/closing claim.' },
  { pattern: /\b(?:100%|fully) (?:approved|funded|guaranteed)\b/i, reason: 'Absolute approval/funding claim.' },
  { pattern: /\brisk[- ]free\b/i, reason: '"Risk-free" claim.' },
  { pattern: /\bno (?:risk|obligation to worry)\b/i, reason: 'No-risk claim.' },
  { pattern: /\bact now\b|\bdon'?t miss out\b|\blimited time(?: only)?\b|\boffer expires\b/i, reason: 'Manufactured urgency — banned in VestBlock outreach.' },
  { pattern: /\bpre[- ]?approved\b/i, reason: '"Pre-approved" implies a lending decision VestBlock cannot make.' },
  { pattern: /\bstop foreclosure\b|\bsave your (?:home|house)\b/i, reason: 'Foreclosure-rescue phrasing — regulated claims in many states (foreclosure-consultant statutes).' },
  { pattern: /\bwe buy houses? (?:for )?cash,? fast\b/i, reason: 'Generic cash-fast claim conflicts with the review-based positioning.' },
  { pattern: /\bdouble your\b|\btriple your\b|\b\d+x your (?:money|investment|return)\b/i, reason: 'Return-multiplier claim — securities-adjacent language.' },
  { pattern: /\bguaranteed (?:roi|return)/i, reason: 'Guaranteed return claim.' },
  { pattern: /\bas seen on\b|\bfeatured (?:on|in) (?:cnn|fox|abc|nbc|forbes)/i, reason: 'Media-feature claim — only allowed if VestBlock has verifiable coverage.' },
  { pattern: /\bDSCR\b|\bworking capital\b|\bborrower\b|\bget you funded\b|\bfunding for your\b/i, reason: 'Funding/lending language — must never appear in seller-owner or listing-agent outreach (campaign separation rule).', scope: 'seller' },
]

// Email requirements (CAN-SPAM + VestBlock house rules)
const EMAIL_REQUIRED = [
  {
    test: (email) => /unsubscribe|do not contact|remove (?:you|me)/i.test(email.body),
    reason: 'Missing opt-out instruction (reply "unsubscribe" line).',
  },
  {
    test: (email) =>
      /\d{2,5} [^,\n]{3,40},? [^,\n]{2,30},? ?[A-Z]{2} \d{5}/.test(email.body) || /P\.?O\.? Box \d+/i.test(email.body),
    reason: 'Missing physical mailing address (CAN-SPAM requires one in every commercial email).',
  },
  {
    test: (email) => !/^\s*$/.test(email.subject || '') && (email.subject || '').length <= 120,
    reason: 'Subject missing or over 120 characters.',
  },
  {
    test: (email) => !/\bre:\s/i.test(email.subject || '') || email.isReply === true,
    reason: 'Fake "Re:" subject on a cold email — deceptive header under CAN-SPAM.',
  },
]

// SMS rules (TCPA posture)
const SMS_REQUIRED = [
  {
    test: (sms) => /\bstop\b/i.test(sms.body),
    reason: 'SMS missing STOP opt-out language.',
  },
  {
    test: (sms) => (sms.body || '').length <= 320,
    reason: 'SMS over 320 characters — split or shorten.',
  },
  {
    test: (sms) => sms.consent === true,
    reason: 'SMS to a number without recorded prior express written consent. Cold texts to skip-traced numbers are a TCPA violation regardless of content.',
  },
]

// ── Engine ───────────────────────────────────────────────────────────────────

function findBanned(text, audience) {
  const violations = []
  for (const rule of BANNED_PATTERNS) {
    if (rule.scope === 'seller' && audience !== 'seller') continue
    const match = String(text || '').match(rule.pattern)
    if (match) {
      violations.push({ severity: 'block', reason: rule.reason, matched: match[0] })
    }
  }
  return violations
}

/**
 * Check one email draft.
 * @param {{ subject?: string, body: string, audience?: 'seller'|'agent'|'partner'|'investor', isReply?: boolean }} email
 * @returns {{ pass: boolean, violations: Array<{severity: string, reason: string, matched?: string}> }}
 */
export function checkEmailCompliance(email) {
  const audience = email.audience || 'seller'
  const violations = [
    ...findBanned(`${email.subject || ''}\n${email.body || ''}`, audience),
  ]
  for (const requirement of EMAIL_REQUIRED) {
    if (!requirement.test(email)) {
      violations.push({ severity: 'block', reason: requirement.reason })
    }
  }
  return { pass: violations.length === 0, violations }
}

/**
 * Check one SMS draft.
 * @param {{ body: string, consent?: boolean, audience?: string }} sms
 */
export function checkSmsCompliance(sms) {
  const violations = [...findBanned(sms.body || '', sms.audience || 'seller')]
  for (const requirement of SMS_REQUIRED) {
    if (!requirement.test(sms)) {
      violations.push({ severity: 'block', reason: requirement.reason })
    }
  }
  return { pass: violations.length === 0, violations }
}

/**
 * Check a batch of email drafts. Returns per-draft results plus a summary.
 * @param {Array<{ subject?: string, body: string, audience?: string }>} drafts
 */
export function checkEmailBatch(drafts, { audience } = {}) {
  const results = drafts.map((draft, index) => ({
    index,
    ...checkEmailCompliance({ ...draft, audience: draft.audience || audience }),
  }))
  const failed = results.filter((result) => !result.pass)
  return {
    total: drafts.length,
    passed: drafts.length - failed.length,
    failed: failed.length,
    allPass: failed.length === 0,
    results,
  }
}

export function formatViolations(violations, indent = '  ') {
  return violations
    .map((violation) => `${indent}✗ ${violation.reason}${violation.matched ? ` (matched: "${violation.matched}")` : ''}`)
    .join('\n')
}
