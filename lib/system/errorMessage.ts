const MAX_ERROR_MESSAGE_LENGTH = 500

function redactOperationalSecrets(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:bearer\s+)[A-Z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(/\b((?:api[_-]?key|token|secret|authorization)\s*[:=]\s*)["']?[^\s,"'}]+/gi, '$1[redacted]')
    .replace(/https?:\/\/[^\s,"'}]+/gi, '[url]')
    .replace(/\b[A-Z0-9_-]{32,}\b/gi, '[redacted]')
}

function nonBlankString(value: unknown, maxLength = MAX_ERROR_MESSAGE_LENGTH) {
  if (value === null || value === undefined) return null
  if (!['string', 'number', 'boolean', 'bigint'].includes(typeof value)) return null
  const text = redactOperationalSecrets(String(value))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return text || null
}

/**
 * Formats thrown values for persisted operational status without serializing
 * database row details, provider payloads, or other arbitrary object fields.
 */
export function formatStructuredError(error: unknown, fallback = 'Unexpected error.') {
  if (error instanceof Error) return nonBlankString(error.message) || fallback

  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>
    const message = nonBlankString(row.message)
    const code = nonBlankString(row.code, 80)
    if (message && code && !message.includes(code)) return `${message} (code: ${code})`
    if (message) return message
    if (code) return `Error code: ${code}`
    return fallback
  }

  return nonBlankString(error) || fallback
}

function allowlistedOperationalCode(error: unknown) {
  if (!error || typeof error !== 'object') return null
  const row = error as Record<string, unknown>
  for (const field of ['code', 'status', 'statusCode'] as const) {
    const code = nonBlankString(row[field], 80)
    if (code && /^[a-z0-9_.:-]+$/i.test(code)) return code
  }
  return null
}

/**
 * Formats errors that will be persisted or returned by unattended jobs.
 * Arbitrary provider/database messages are intentionally excluded because
 * they can echo request payloads, credentials, or lead data.
 */
export function formatPersistedOperationalError(error: unknown, fallback = 'Operational failure.') {
  const safeFallback = nonBlankString(fallback) || 'Operational failure.'
  const code = allowlistedOperationalCode(error)
  return code ? `${safeFallback} (code: ${code})` : safeFallback
}
