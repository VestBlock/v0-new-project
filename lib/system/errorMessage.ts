const STRUCTURED_ERROR_FIELDS = ['message', 'details', 'hint', 'code'] as const

function nonBlankString(value: unknown) {
  if (value === null || value === undefined) return null
  if (!['string', 'number', 'boolean', 'bigint'].includes(typeof value)) return null
  const text = String(value).trim()
  return text || null
}

export function formatStructuredError(error: unknown, fallback = 'Unexpected error.') {
  if (error instanceof Error) return nonBlankString(error.message) || fallback

  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>
    const details = Array.from(new Set(
      STRUCTURED_ERROR_FIELDS.map((field) => nonBlankString(row[field])).filter((value): value is string => Boolean(value))
    ))
    if (details.length) return details.join(' | ')
    return fallback
  }

  return nonBlankString(error) || fallback
}
